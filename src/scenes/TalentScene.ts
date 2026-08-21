/**
 * Talentbaum: dauerhafte Verbesserungen aus Levelaufstiegen.
 *
 * Der Bildschirm funktioniert offline vollständig. Ist ein Profil angemeldet,
 * werden Käufe und der Reset atomar im gemeinsamen Profil geprüft und danach
 * in den lokalen Stand übernommen.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, TALENT_RESET_COST } from '@/config/GameConfig';
import { TALENTS, talentCost, type TalentId } from '@/config/talents';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import type { SceneKeyValue } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { shipTint } from '@/config/shop';
import { playerTextureForShape, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createMenuLayout,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

/** Reine Darstellung: Reihenfolge und Linien sind keine Kaufvoraussetzungen. */
const TALENT_ROUTE_LAYOUT: readonly { id: TalentId; column: 0 | 1; row: number }[] = [
  { id: 'reach', column: 0, row: 0 },
  { id: 'swiftness', column: 1, row: 0 },
  { id: 'magnetism', column: 1, row: 1 },
  { id: 'endurance', column: 0, row: 1 },
  { id: 'focus', column: 0, row: 2 },
  { id: 'insight', column: 1, row: 2 },
  { id: 'fortune', column: 1, row: 3 },
];

export interface TalentSceneData {
  returnTo?: SceneKeyValue;
}

export class TalentScene extends Phaser.Scene {
  private returnTo: SceneKeyValue = SceneKey.Profile;
  private busy = false;
  private feedbackText!: Phaser.GameObjects.Text;
  private resetDialogObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SceneKey.Talents);
  }

  create(data: TalentSceneData = {}): void {
    this.returnTo = data.returnTo ?? SceneKey.Profile;
    SafeAreaSystem.showStatic('TALENTE');

    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);
    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    createBackButton(this, () => this.scene.start(this.returnTo));
    const sections = createMenuLayout().sections;
    const walletY = sections.next(30);
    this.add
      .text(
        GAME_WIDTH / 2,
        walletY,
        'COINS ' + save.coins.toLocaleString('de-DE'),
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    this.add
      .image(92, walletY, playerTextureForShape(save.shipShape))
      .setTint(shipTint(save, world.accent))
      .setScale(0.26);

    const routeTop = sections.next(116) + 24;
    this.buildTalentRoute(routeTop, world.accent);

    const resetY = Math.min(GAME_HEIGHT - 190, routeTop + 3 * 140 + 155);
    const resetButton = createButton(
      this,
      GAME_WIDTH / 2,
      resetY,
      'RESET ' + TALENT_RESET_COST + ' COINS',
      () => this.openResetConfirmation(),
      {
        width: 380,
        height: 64,
        accent: 0xb782ff,
        fontSize: FontSize.tiny,
      },
    );
    resetButton.setEnabled(save.coins >= TALENT_RESET_COST);
    // Einzige Warnung vor einem unwiderruflichen Coin-Verlust - keine
    // Dekoration, deshalb der helle Standardton statt gedaempft.
    this.add
      .text(
        GAME_WIDTH / 2,
        resetY + 48,
        'Reset kostet ' + TALENT_RESET_COST + ' Coins und erstattet nichts.',
        textStyle(FontSize.tiny, Palette.ink),
      )
      .setOrigin(0.5);
    this.feedbackText = this.add
      .text(GAME_WIDTH / 2, resetY + 82, '', textStyle(FontSize.tiny, Palette.gold))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 100)
      .setAlign('center');
  }

  private buildTalentRoute(routeTop: number, accent: number): void {
    const points = TALENT_ROUTE_LAYOUT.map((entry) => ({
      ...entry,
      x: entry.column === 0 ? 180 : 540,
      y: routeTop + entry.row * 140,
    }));

    const routeLine = this.add.graphics();
    routeLine.lineStyle(8, accent, 0.24);
    routeLine.beginPath();
    points.forEach((point, index) => {
      if (index === 0) routeLine.moveTo(point.x, point.y);
      else routeLine.lineTo(point.x, point.y);
    });
    routeLine.strokePath();
    routeLine.fillStyle(accent, 0.34);
    points.forEach((point) => routeLine.fillCircle(point.x, point.y, 18));

    this.add
      .text(
        GAME_WIDTH / 2,
        routeTop - 72,
        'Jeder Knoten ist unabhaengig. Kaufe in beliebiger Reihenfolge.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setAlign('center');

    points.forEach((point) => this.buildTalentNode(point.id, point.x, point.y, accent));
  }

  private buildTalentNode(id: TalentId, x: number, y: number, accent: number): void {
    const talent = TALENTS.find((entry) => entry.id === id)!;
    const save = SaveSystem.load();
    const rank = save.talents[id] ?? 0;
    const cardWidth = 320;
    const cardHeight = 112;
    if (rank > 0) {
      this.add
        .image(x, y, TextureKey.Glow)
        .setDisplaySize(cardWidth + 30, cardHeight + 20)
        .setTint(accent)
        .setAlpha(0.18 + Math.min(rank, talent.maxRank) * 0.035)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    createPanel(this, x, y, cardWidth, cardHeight, accent, {
      alpha: rank > 0 ? 0.68 : 0.5,
      radius: 14,
    });
    this.add
      .text(
        x - 144,
        y - 38,
        talent.name,
        textStyle(FontSize.small, toCss(accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    this.add
      .text(x - 144, y - 7, talent.description, textStyle(14, Palette.inkDim))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(168);
    this.add
      .text(
        x - 144,
        y + 38,
        `RANG ${rank}/${talent.maxRank}  ${talent.perRank}`,
        textStyle(14, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    const cost = talentCost(rank);
    const purchaseButton = createButton(
      this,
      x + 76,
      y + 18,
      rank >= talent.maxRank ? 'MAX' : `${cost.toLocaleString('de-DE')} C`,
      () => void this.purchase(id),
      {
        width: 126,
        height: 52,
        accent: rank >= talent.maxRank ? 0x778099 : accent,
        fontSize: 14,
      },
    );
    purchaseButton.setEnabled(rank < talent.maxRank && save.coins >= cost);
  }

  private async purchase(id: TalentId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.feedbackText.setText('KAUF WIRD GEBUCHT · BITTE WARTEN …').setColor(Palette.gold);
    let error = '';
    if (AuthSystem.isSignedIn() && !SaveSystem.isTestProfileActive()) {
      // Lokale Runs und Tagesboni muessen vor dem atomaren Serverkauf
      // angekommen sein, sonst zeigt die Scene mehr Coins als der Server.
      await ProgressSyncSystem.flush();
      const currentProfile = await CloudSystem.fetchProfileProgress();
      if (!currentProfile.ok) {
        error = currentProfile.error;
      } else if (!currentProfile.value) {
        error = 'Profilstand nicht erhalten.';
      } else {
        // Die Kaufpruefung muss genau auf demselben Stand laufen, den der
        // Server selbst verwendet. So bleiben lokale und Cloud-Coins gleich.
        SaveSystem.adoptProfileProgress(currentProfile.value.data);
        const result = await CloudSystem.purchaseTalent(id);
        if (result.ok && result.value) {
          SaveSystem.adoptProfileProgress(result.value.data);
        } else error = result.ok ? 'Profilstand nicht erhalten.' : result.error;
      }
    } else {
      if (!ProgressionSystem.purchaseTalent(id)) error = 'Nicht genug Coins für diesen Rang.';
    }
    this.busy = false;
    if (error) {
      this.feedbackText.setText(error).setColor(Palette.gold);
      return;
    }
    this.scene.restart({ returnTo: this.returnTo });
  }

  private openResetConfirmation(): void {
    if (this.resetDialogObjects.length > 0 || SaveSystem.load().coins < TALENT_RESET_COST) {
      this.feedbackText
        .setText('Für den Reset fehlen ' + TALENT_RESET_COST + ' Coins.')
        .setColor(Palette.gold);
      return;
    }

    const overlay = this.add
      .image(0, 0, TextureKey.Pixel)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(Palette.backdrop)
      .setAlpha(0.88)
      .setDepth(Depth.Overlay)
      .setInteractive();
    const panel = createPanel(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH - 90,
      330,
      0xb782ff,
      { alpha: 0.98, radius: 22 },
    ).setDepth(Depth.Overlay + 1);
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 105,
        'WILLST DU WIRKLICH\\nALLE TALENTE ZURÜCKSETZEN?',
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold', align: 'center' }),
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setDepth(Depth.Overlay + 2);
    const detail = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 20,
        'Das kostet ' + TALENT_RESET_COST + ' Coins.',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay + 2);

    const cancel = createButton(
      this,
      GAME_WIDTH / 2 - 105,
      GAME_HEIGHT / 2 + 88,
      'ABBRECHEN',
      () => this.closeResetConfirmation(),
      { width: 190, height: 68, accent: 0x778099, fontSize: FontSize.tiny },
    );
    const confirm = createButton(
      this,
      GAME_WIDTH / 2 + 105,
      GAME_HEIGHT / 2 + 88,
      'ZURÜCKSETZEN',
      () => void this.reset(),
      { width: 190, height: 68, accent: 0xb782ff, fontSize: FontSize.tiny },
    );
    cancel.container.setDepth(Depth.Overlay + 2);
    confirm.container.setDepth(Depth.Overlay + 2);
    this.resetDialogObjects = [overlay, panel, title, detail, cancel.container, confirm.container];
  }

  private closeResetConfirmation(): void {
    for (const object of this.resetDialogObjects) object.destroy();
    this.resetDialogObjects = [];
  }

  private async reset(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.feedbackText.setText('RESET WIRD GEBUCHT · BITTE WARTEN …').setColor(Palette.gold);
    let error = '';
    if (AuthSystem.isSignedIn()) {
      const result = await CloudSystem.resetTalents();
      if (result.ok && result.value) SaveSystem.adoptProfileProgress(result.value.data);
      else error = result.ok ? 'Profilstand nicht erhalten.' : result.error;
    } else {
      if (!ProgressionSystem.resetTalents()) {
        error = 'Für den Reset fehlen ' + TALENT_RESET_COST + ' Coins.';
      }
    }
    this.busy = false;
    if (error) {
      this.closeResetConfirmation();
      this.feedbackText.setText(error).setColor(Palette.gold);
      return;
    }
    this.closeResetConfirmation();
    this.scene.restart({ returnTo: this.returnTo });
  }
}
