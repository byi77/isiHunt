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
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { playerTextureForLevel } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export interface TalentSceneData {
  returnTo?: SceneKeyValue;
}

export class TalentScene extends Phaser.Scene {
  private returnTo: SceneKeyValue = SceneKey.Profile;
  private busy = false;
  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKey.Talents);
  }

  create(data: TalentSceneData = {}): void {
    this.returnTo = data.returnTo ?? SceneKey.Profile;
    SafeAreaSystem.showStatic('TALENTBAUM');

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
    this.add
      .text(
        GAME_WIDTH / 2,
        116,
        'TALENTBAUM',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(4);
    this.add
      .text(
        GAME_WIDTH / 2,
        160,
        'COINS ' + save.coins.toLocaleString('de-DE'),
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    this.add
      .image(92, 120, playerTextureForLevel(save.level))
      .setTint(Palette.goldHex)
      .setScale(0.26);

    const rowTop = 230;
    const rowStep = 108;
    TALENTS.forEach((talent, index) =>
      this.buildTalentRow(talent.id, rowTop + index * rowStep, world.accent),
    );

    const resetY = Math.min(GAME_HEIGHT - 190, rowTop + TALENTS.length * rowStep + 16);
    const resetButton = createButton(
      this,
      GAME_WIDTH / 2,
      resetY,
      'RESET ' + TALENT_RESET_COST + ' COINS',
      () => void this.reset(),
      {
        width: 380,
        height: 64,
        accent: 0xb782ff,
        fontSize: FontSize.tiny,
      },
    );
    resetButton.setEnabled(save.coins >= TALENT_RESET_COST);
    this.add
      .text(
        GAME_WIDTH / 2,
        resetY + 48,
        'Reset kostet ' + TALENT_RESET_COST + ' Coins und erstattet nichts.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
    this.feedbackText = this.add
      .text(GAME_WIDTH / 2, resetY + 82, '', textStyle(FontSize.tiny, Palette.gold))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 100)
      .setAlign('center');
  }

  private buildTalentRow(id: TalentId, y: number, accent: number): void {
    const talent = TALENTS.find((entry) => entry.id === id)!;
    const save = SaveSystem.load();
    const rank = save.talents[id] ?? 0;
    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 100, 96, accent, {
      alpha: 0.5,
      radius: 14,
    });
    this.add
      .text(66, y - 24, talent.name, textStyle(FontSize.body, toCss(accent), { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);
    this.add
      .text(66, y + 10, talent.description, textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(315);
    this.add
      .text(
        405,
        y - 20,
        'RANG ' + rank + '/' + talent.maxRank,
        textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    this.add
      .text(405, y + 12, talent.perRank, textStyle(FontSize.tiny, Palette.gold))
      .setOrigin(0.5);
    const cost = talentCost(rank);
    const purchaseButton = createButton(
      this,
      605,
      y,
      rank >= talent.maxRank ? 'MAX' : cost + ' COINS',
      () => void this.purchase(id),
      {
        width: 150,
        height: 58,
        accent: rank >= talent.maxRank ? 0x778099 : accent,
        fontSize: FontSize.tiny,
      },
    );
    purchaseButton.setEnabled(rank < talent.maxRank && save.coins >= cost);
  }

  private async purchase(id: TalentId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    let error = '';
    if (AuthSystem.isSignedIn()) {
      const result = await CloudSystem.purchaseTalent(id);
      if (result.ok && result.value) {
        SaveSystem.adoptProfileProgress(result.value.data);
      } else error = result.ok ? 'Profilstand nicht erhalten.' : result.error;
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

  private async reset(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
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
      this.feedbackText.setText(error).setColor(Palette.gold);
      return;
    }
    this.scene.restart({ returnTo: this.returnTo });
  }
}
