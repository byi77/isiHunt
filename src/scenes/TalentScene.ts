/**
 * Talentbaum: dauerhafte Verbesserungen aus Levelaufstiegen.
 *
 * Der Bildschirm funktioniert offline vollständig. Ist ein Profil angemeldet,
 * werden Käufe und der Reset atomar im gemeinsamen Profil geprüft und danach
 * in den lokalen Stand übernommen.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { TALENTS, type TalentDef, type TalentId } from '@/config/talents';
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
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  attachVerticalScroll,
  createBackButton,
  createButton,
  createMenuLayout,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export interface TalentSceneData {
  returnTo?: SceneKeyValue;
  /**
   * Scrollstand aus dem vorherigen Aufbau.
   *
   * Jeder Kauf baut die Scene neu auf (`restart`), damit Raenge, Pips und
   * Punktestand aus einer Quelle kommen. Ohne diesen Wert sprang die Liste
   * dabei an den Anfang - wer die unteren Talente ausbaute, wurde nach jedem
   * einzelnen Punkt wieder nach oben geworfen.
   */
  scrollOffset?: number;
}

export class TalentScene extends Phaser.Scene {
  private returnTo: SceneKeyValue = SceneKey.Profile;
  private busy = false;
  private feedbackText!: Phaser.GameObjects.Text;
  private resetDialogObjects: Phaser.GameObjects.GameObject[] = [];
  private scrollOffset = 0;

  constructor() {
    super(SceneKey.Talents);
  }

  create(data: TalentSceneData = {}): void {
    this.returnTo = data.returnTo ?? SceneKey.Profile;
    this.scrollOffset = data.scrollOffset ?? 0;
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
    const layout = createMenuLayout();
    const sections = layout.sections;
    const walletY = sections.next(30);
    this.add
      .text(
        GAME_WIDTH / 2,
        walletY,
        'TALENTPUNKTE ' + save.talentPoints + '  ·  COINS ' + save.coins.toLocaleString('de-DE'),
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    const rowTop = sections.next(82);
    // Drei Beschreibungszeilen brauchen Platz; die vorhandene Scrollfläche
    // hält die übrigen Talente und die Reset-Aktion erreichbar.
    const rowStep = 128;
    const content = this.add.container(0, 0);
    const groupOrder: readonly TalentDef['group'][] = ['BEWEGUNG', 'SAMMELN', 'ERTRAG'];
    let nextY = rowTop;
    for (const group of groupOrder) {
      const talents = TALENTS.filter((talent) => talent.group === group);
      if (talents.length === 0) continue;
      this.buildGroupHeader(group, nextY, world.accent, content);
      nextY += 42;
      for (const talent of talents) {
        this.buildTalentRow(talent.id, nextY, world.accent, content);
        nextY += rowStep;
      }
      nextY += 16;
    }

    const resetY = nextY;
    const resetButton = createButton(
      this,
      GAME_WIDTH / 2,
      resetY,
      'TALENTE ZURÜCKSETZEN',
      () => this.openResetConfirmation(),
      {
        width: 380,
        height: 64,
        accent: 0xb782ff,
        fontSize: FontSize.tiny,
      },
    );
    content.add(resetButton.container);
    resetButton.setEnabled(TALENTS.some((talent) => (save.talents[talent.id] ?? 0) > 0));
    content.add(
      this.add
        .text(
          GAME_WIDTH / 2,
          resetY + 48,
          'Reset ist kostenlos und erstattet alle investierten Talentpunkte.',
          textStyle(FontSize.tiny, Palette.ink),
        )
        .setOrigin(0.5),
    );
    this.feedbackText = this.add
      .text(GAME_WIDTH / 2, resetY + 82, '', textStyle(FontSize.tiny, Palette.gold))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 100)
      .setAlign('center');
    content.add(this.feedbackText);

    const contentBottom = resetY + 105;
    const listTop = rowTop - rowStep / 2;
    const clip = this.add.graphics().setVisible(false);
    clip.fillStyle(0xffffff).fillRect(0, listTop, GAME_WIDTH, layout.contentBottom - listTop);
    const mask = clip.createGeometryMask();
    content.setMask(mask);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => mask.destroy());
    const buttons = content.list
      .filter(
        (object): object is Phaser.GameObjects.Container =>
          object instanceof Phaser.GameObjects.Container && object.input !== null,
      )
      .map((button) => ({ button, enabled: button.input!.enabled }));
    // Masken begrenzen nur das Bild. Auch unsichtbare Trefferflächen müssen
    // oberhalb der Liste und unter der festen Zurück-Zone gesperrt bleiben.
    const maxScroll = Math.max(0, contentBottom - layout.contentBottom);
    const positionContent = (offset: number): void => {
      // Der Stand wird hier gemerkt, nicht im Scroll-Helfer: Nur die Scene
      // ueberlebt ihren eigenen `restart` - als Startwert im naechsten Aufbau.
      this.scrollOffset = offset;
      content.setY(-offset);
      for (const { button, enabled } of buttons) {
        const top = button.y - offset - button.height / 2;
        const bottom = top + button.height;
        button.input!.enabled = enabled && top >= listTop && bottom <= layout.contentBottom;
      }
    };
    // Ein gemerkter Stand kann groesser sein als die jetzige Liste zulaesst:
    // Nach einem Reset schrumpft nichts, nach dem letzten Kauf aber sehr wohl.
    positionContent(Phaser.Math.Clamp(this.scrollOffset, 0, maxScroll));
    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: listTop,
      dragZoneBottom: layout.contentBottom,
      onOffsetChange: positionContent,
      startOffset: this.scrollOffset,
    });
  }

  private buildTalentRow(
    id: TalentId,
    y: number,
    accent: number,
    content: Phaser.GameObjects.Container,
  ): void {
    const talent = TALENTS.find((entry) => entry.id === id)!;
    const save = SaveSystem.load();
    const rank = save.talents[id] ?? 0;
    content.add(
      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 100, 128, accent, {
        alpha: 0.5,
        radius: 14,
      }),
    );
    content.add(
      this.add
        .text(
          66,
          y - 38,
          talent.name,
          textStyle(FontSize.body, toCss(accent), { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5),
    );
    content.add(
      this.add
        .text(66, y - 10, talent.description, textStyle(FontSize.tiny, Palette.inkDim))
        .setOrigin(0, 0)
        .setWordWrapWidth(230),
    );
    content.add(
      this.add
        .text(
          405,
          y - 38,
          'RANG ' + rank + '/' + talent.maxRank,
          textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );
    content.add(
      this.add
        .text(
          405,
          y - 10,
          `AKTUELL RANG ${rank} · NÄCHSTER ${talent.perRank}`,
          textStyle(FontSize.tiny, Palette.gold),
        )
        .setWordWrapWidth(180)
        .setAlign('center')
        .setOrigin(0.5, 0),
    );
    // Rang-Pips machen den Ausbau sofort sichtbar: Jeder Kauf fuellt einen
    // weiteren Abschnitt, statt nur die kleine Zahl im Rangtext zu veraendern.
    const pipStartX = 378;
    for (let pip = 0; pip < talent.maxRank; pip += 1) {
      content.add(
        this.add
          .rectangle(pipStartX + pip * 11, y + 48, 8, 8, pip < rank ? Palette.goldHex : 0x66708c)
          .setAlpha(pip < rank ? 1 : 0.34)
          .setStrokeStyle(1, accent, 0.55),
      );
    }
    const purchaseButton = createButton(
      this,
      590,
      y,
      rank >= talent.maxRank ? 'MAX' : '1 PUNKT',
      () => void this.purchase(id),
      {
        width: 140,
        height: 58,
        accent: rank >= talent.maxRank ? 0x778099 : accent,
        fontSize: FontSize.tiny,
      },
    );
    content.add(purchaseButton.container);
    purchaseButton.setEnabled(rank < talent.maxRank && save.talentPoints > 0);
  }

  private buildGroupHeader(
    group: TalentDef['group'],
    y: number,
    accent: number,
    content: Phaser.GameObjects.Container,
  ): void {
    const label = this.add
      .text(58, y, group, textStyle(FontSize.small, toCss(accent), { fontStyle: 'bold' }))
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    const line = this.add.rectangle(232, y, 478, 2, accent, 0.62).setOrigin(0, 0.5);
    content.add([label, line]);
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
      if (!ProgressionSystem.purchaseTalent(id))
        error = 'Nicht genug Talentpunkte für diesen Rang.';
    }
    this.busy = false;

    // Erst ab hier wird die Oberflaeche angefasst. Waehrend der Netzaufrufe
    // oben bleibt der Zurueck-Knopf bedienbar (`busy` sperrt nur weitere
    // Kaeufe, nicht die Navigation) - wer in dieser Zeit das Menue waehlt,
    // hat eine zerstoerte Scene hinter sich. `setText` liefe dann auf ein
    // Text-Objekt, dessen Canvas bereits an den Pool zurueckgegeben wurde,
    // und `restart()` holte ihn ungefragt in den Talentbaum zurueck.
    //
    // Die Buchung oben laeuft bewusst trotzdem zu Ende: Ein bezahlter Rang
    // darf nicht verloren gehen, nur weil der Bildschirm gewechselt wurde
    // (Audit 2026-08-23).
    if (!this.scene.isActive()) return;

    if (error) {
      this.feedbackText.setText(error).setColor(Palette.gold);
      return;
    }
    this.scene.restart({ returnTo: this.returnTo, scrollOffset: this.scrollOffset });
  }

  private openResetConfirmation(): void {
    const investedRanks = TALENTS.reduce(
      (sum, talent) => sum + (SaveSystem.load().talents[talent.id] ?? 0),
      0,
    );
    if (this.resetDialogObjects.length > 0 || investedRanks <= 0) {
      this.feedbackText
        .setText('Es gibt keine investierten Talentpunkte zum Zurücksetzen.')
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
        'Kostenlos: Alle investierten Talentpunkte werden erstattet.',
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
        error = 'Es gibt keine investierten Talentpunkte zum Zurücksetzen.';
      }
    }
    this.busy = false;

    // Wie bei `purchase()`: Die Buchung oben laeuft zu Ende, die Oberflaeche
    // wird nur angefasst, wenn es sie noch gibt. Phaser raeumt die
    // Dialogobjekte beim Szenenwechsel selbst ab - `closeResetConfirmation()`
    // liefe hier sonst ueber bereits zerstoerte Objekte.
    if (!this.scene.isActive()) return;

    this.closeResetConfirmation();
    if (error) {
      this.feedbackText.setText(error).setColor(Palette.gold);
      return;
    }
    this.scene.restart({ returnTo: this.returnTo, scrollOffset: this.scrollOffset });
  }
}
