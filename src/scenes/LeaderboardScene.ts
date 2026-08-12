/**
 * Online-Bestenliste je Welt.
 *
 * Die Liste laedt beim Betreten und bei jedem Weltwechsel. Waehrenddessen
 * bleibt der Bildschirm bedienbar - ein haengender Netzaufruf darf nie dazu
 * fuehren, dass man nicht zurueck ins Menue kommt.
 */

import Phaser from 'phaser';

import { PLAYER_NAME_MAX_LENGTH } from '@/config/backend';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import type { LeaderboardEntry } from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { createTextInput } from '@/ui/textInput';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

const LIST_TOP = 430;
const ROW_HEIGHT = 58;

export class LeaderboardScene extends Phaser.Scene {
  private world!: WorldDef;
  private listItems: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  /** Zaehlt Ladevorgaenge, damit eine veraltete Antwort nichts ueberschreibt. */
  private requestId = 0;

  constructor() {
    super(SceneKey.Leaderboard);
  }

  create(): void {
    const save = SaveSystem.load();
    this.world = WORLDS.find((w) => w.id === save.lastWorldId) ?? WORLDS[0]!;
    this.listItems = [];
    this.requestId = 0;

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.world.bgTop,
      this.world.bgBottom,
      this.world.accent,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(
        GAME_WIDTH / 2,
        120,
        'BESTENLISTE',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);

    this.buildWorldTabs();

    this.statusText = this.add
      .text(GAME_WIDTH / 2, LIST_TOP + 120, '', textStyle(FontSize.small, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 140)
      .setAlign('center');

    this.buildNameField();

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 84,
      'ZURUECK',
      () => this.scene.start(SceneKey.Menu),
      { width: 300, height: 64, accent: 0x9aa3bd, fontSize: FontSize.small },
    );

    void this.loadList();
  }

  /**
   * Namensfeld.
   *
   * Der Name liegt hier und nicht in einem Einstellungsmenue, weil er genau
   * einen Zweck hat: Er steht in dieser Liste. Wer ihn aendern will, sieht
   * sofort, wo die Aenderung landet.
   *
   * Gespeichert wird beim Verlassen des Feldes - ohne Bestaetigungsknopf, der
   * nur vergessen werden koennte.
   */
  private buildNameField(): void {
    const save = SaveSystem.load();

    this.add
      .text(
        GAME_WIDTH / 2,
        1042,
        'DEIN NAME IN DER LISTE',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setLetterSpacing(4);

    const input = createTextInput(this, GAME_WIDTH / 2, 1104, {
      placeholder: 'Name eingeben',
      maxLength: PLAYER_NAME_MAX_LENGTH,
      width: 400,
      accent: this.world.accent,
    });

    input.setValue(save.playerName);

    const persist = (): void => {
      const cleaned = CloudSystem.sanitizePlayerName(input.getValue());
      if (cleaned !== SaveSystem.load().playerName) SaveSystem.setPlayerName(cleaned);
      input.setValue(cleaned);
    };

    input.element.node.addEventListener('blur', persist);
    // Auch beim Verlassen der Scene sichern: auf dem Handy tippt man haeufig
    // direkt auf "Zurueck", ohne das Feld vorher zu verlassen.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, persist);
  }

  /** Waagerechte Auswahl der Welten - nur freigeschaltete sind anwaehlbar. */
  private buildWorldTabs(): void {
    const level = SaveSystem.load().level;
    const y = 220;
    const spacing = (GAME_WIDTH - 120) / WORLDS.length;

    WORLDS.forEach((world, index) => {
      const x = 60 + spacing * (index + 0.5);
      const isUnlocked = world.unlockLevel <= level;
      const isActive = world.id === this.world.id;

      const marker = this.add
        .image(x, y, TextureKey.Orb)
        .setTint(world.accent)
        .setScale(isActive ? 0.5 : 0.34)
        .setAlpha(isUnlocked ? (isActive ? 1 : 0.5) : 0.18);

      if (!isUnlocked) return;

      marker.setInteractive({ useHandCursor: true });
      marker.on('pointerup', () => {
        if (world.id === this.world.id) return;
        this.world = world;
        // Neu aufbauen statt selektiv aendern - der Hintergrund wechselt mit.
        this.scene.restart();
      });
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        y + 52,
        this.world.name,
        textStyle(FontSize.body, toCss(this.world.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        y + 90,
        'Welt antippen zum Wechseln',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
  }

  private async loadList(): Promise<void> {
    const requestId = ++this.requestId;
    this.clearList();
    this.statusText.setText('Wird geladen ...').setColor(Palette.inkDim);

    const result = await CloudSystem.fetchLeaderboard(this.world.id);

    // Zwischenzeitlich wurde die Welt gewechselt oder die Scene verlassen -
    // diese Antwort ist nicht mehr die aktuelle.
    if (requestId !== this.requestId || !this.scene.isActive()) return;

    if (!result.ok) {
      this.statusText
        .setText(`Bestenliste nicht erreichbar.\n${result.error}`)
        .setColor(Palette.danger);
      return;
    }

    if (result.value.length === 0) {
      this.statusText
        .setText('Noch kein Eintrag in dieser Welt.\nSpiel einen Run und trag dich ein.')
        .setColor(Palette.inkDim);
      return;
    }

    this.statusText.setText('');
    this.renderList(result.value);
  }

  private renderList(entries: readonly LeaderboardEntry[]): void {
    const ownName = SaveSystem.load().playerName;

    entries.forEach((entry, index) => {
      const y = LIST_TOP + index * ROW_HEIGHT;
      const isOwn = ownName.length > 0 && entry.playerName === ownName;
      const isPodium = index < 3;

      if (isOwn) {
        this.listItems.push(
          createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 110, ROW_HEIGHT - 6, Palette.goldHex, {
            alpha: 0.4,
            radius: 10,
          }),
        );
      }

      const rankColor = isPodium ? Palette.gold : Palette.inkDim;

      this.listItems.push(
        this.add
          .text(76, y, `${index + 1}`, textStyle(FontSize.small, rankColor, { fontStyle: 'bold' }))
          .setOrigin(0, 0.5),
        this.add
          .text(
            134,
            y,
            entry.playerName,
            textStyle(FontSize.small, isOwn ? Palette.gold : Palette.ink),
          )
          .setOrigin(0, 0.5),
        this.add
          .text(
            GAME_WIDTH - 76,
            y,
            entry.score.toLocaleString('de-DE'),
            textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
          )
          .setOrigin(1, 0.5),
      );
    });
  }

  private clearList(): void {
    for (const item of this.listItems) item.destroy();
    this.listItems = [];
  }
}
