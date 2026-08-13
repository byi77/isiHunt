/**
 * Startbildschirm: Profil, Weltenauswahl, Start.
 *
 * Der Bildschirm ist der schnelle Einstieg: Name, Welt und Jagd. Die
 * Fortschrittszahlen liegen im Profil und unterbrechen den Start nicht.
 */

import Phaser from 'phaser';

import { DEBUG_ENABLED, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { isIos, isStandalone } from '@/core/display';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import { SceneKey } from '@/scenes/SceneKey';
import { attachHitDebug } from '@/ui/hitDebug';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createAmbientMotes,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
  makeAlignedHitArea,
} from '@/ui/widgets';

export class MenuScene extends Phaser.Scene {
  private selectedWorld!: WorldDef;

  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const save = SaveSystem.load();
    if (!save.playerName) {
      this.scene.start(SceneKey.Profile, { firstStart: true });
      return;
    }

    const unlocked = WORLDS.filter((w) => w.unlockLevel <= save.level);
    this.selectedWorld =
      unlocked.find((w) => w.id === save.lastWorldId) ??
      unlocked[unlocked.length - 1] ??
      WORLDS[0]!;

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.selectedWorld.bgTop,
      this.selectedWorld.bgBottom,
      this.selectedWorld.accent,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT);
    createAmbientMotes(this, GAME_WIDTH, GAME_HEIGHT, this.selectedWorld.accent);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    this.buildTitle();
    this.buildFullscreenToggle();
    this.buildProfilePanel(save.playerName);
    this.buildWorldList(save.level);
    this.buildFooter(save.bestScore);

    void this.showUpdateHintIfAny();

    // Nur mit ?hitboxes in der Adresse - zeigt, was Phaser fuer anfassbar haelt.
    attachHitDebug(this);
  }

  /**
   * Hinweis, wenn auf dem Server eine neuere Fassung liegt.
   *
   * Im Menue und nicht im Run: Ein Neuladen mitten im Spiel waere das Gegenteil
   * von hilfreich. Und nur als Angebot - entschieden wird per Tipp, nicht
   * selbsttaetig.
   *
   * Ohne Netz oder ohne `version.json` (Dev-Server) passiert schlicht nichts.
   */
  private async showUpdateHintIfAny(): Promise<void> {
    const info = await checkForUpdate();
    if (!info || !this.scene.isActive()) return;

    // y=190, Hoehe 44: der freie Streifen zwischen Untertitel (bis 164) und
    // Level-Zeile (ab 219). Knapp, aber der Hinweis soll oben stehen, wo man
    // ihn beim Oeffnen sieht - weiter unten wuerde er zwischen Weltenliste und
    // Startknopf gequetscht.
    //
    // 44 px liegen genau auf dem Mindestmass aus ART_STYLE.md 8; seitlich ist
    // die Flaeche mit 520 px dagegen sehr grosszuegig.
    const banner = createButton(
      this,
      GAME_WIDTH / 2,
      190,
      `NEUE VERSION v${info.available}  ·  JETZT LADEN`,
      () => forceReload(),
      { width: 520, height: 44, accent: Palette.goldHex, fontSize: FontSize.tiny },
    );

    banner.container.setAlpha(0);
    this.tweens.add({ targets: banner.container, alpha: 1, duration: 320, ease: 'Quad.Out' });
  }

  private buildTitle(): void {
    // Lichtschein hinter dem Titel - der Name bedeutet Licht, das darf man sehen.
    this.add
      .image(GAME_WIDTH / 2, 100, TextureKey.Glow)
      .setDisplaySize(560, 320)
      .setTint(Palette.goldHex)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);

    const title = this.add
      .text(
        GAME_WIDTH / 2,
        96,
        'isiHunt',
        textStyle(FontSize.title, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 152, 'JAGE DAS LICHT', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(8);

    this.tweens.add({
      targets: title,
      y: 92,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /**
   * Vollbild-Umschalter oben rechts.
   *
   * Erscheint nur, wo die Fullscreen-API wirklich etwas bewirkt - auf dem
   * iPhone gibt es sie nicht (siehe core/display.ts), dort steht stattdessen
   * der Installationshinweis in der Fusszeile.
   */
  private buildFullscreenToggle(): void {
    if (!this.scale.fullscreen.available || isStandalone()) return;

    const button = createButton(
      this,
      GAME_WIDTH - 96,
      52,
      this.scale.isFullscreen ? 'ZURUECK' : 'VOLLBILD',
      () => {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
          button.setLabel('VOLLBILD');
        } else {
          this.scale.startFullscreen();
          button.setLabel('ZURUECK');
        }
      },
      { width: 148, height: 52, accent: 0x9aa3bd, fontSize: FontSize.tiny },
    );
  }

  /** Name und Lichtfigur - Fortschrittszahlen liegen jetzt im Profil. */
  private buildProfilePanel(playerName: string): void {
    const y = 270;
    const width = GAME_WIDTH - 120;

    createPanel(this, GAME_WIDTH / 2, y, width, 108, this.selectedWorld.accent, { alpha: 0.58 });

    this.add
      .image(112, y, TextureKey.PlayerHalo)
      .setTint(this.selectedWorld.accent)
      .setScale(0.48)
      .setAlpha(0.8);

    this.add.image(112, y, TextureKey.PlayerCore).setTint(Palette.goldHex).setScale(0.34);

    this.add
      .text(172, y - 14, playerName, textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);

    this.add
      .text(172, y + 18, 'DEIN PROFIL', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);

    createButton(this, GAME_WIDTH - 148, y, 'PROFIL', () => this.scene.start(SceneKey.Profile), {
      width: 170,
      height: 62,
      accent: this.selectedWorld.accent,
      fontSize: FontSize.tiny,
    });
  }

  /** Weltenliste mit Sperr-Zustand. */
  private buildWorldList(level: number): void {
    const startY = 372;
    const rowHeight = 98;

    this.add
      .text(60, startY - 32, 'WELTEN', textStyle(FontSize.tiny, Palette.inkDim))
      .setLetterSpacing(6);

    WORLDS.forEach((world, index) => {
      const y = startY + index * rowHeight;
      const isUnlocked = world.unlockLevel <= level;
      const isSelected = world.id === this.selectedWorld.id;

      const row = this.add.container(GAME_WIDTH / 2, y + rowHeight / 2 - 18);

      const bg = this.add
        .image(0, 0, TextureKey.Pixel)
        .setDisplaySize(GAME_WIDTH - 120, rowHeight - 14)
        .setTint(world.accent)
        .setAlpha(isSelected ? 0.22 : 0.08);

      const border = this.add.graphics();
      border.lineStyle(isSelected ? 3 : 1.5, world.accent, isUnlocked ? 0.9 : 0.25);
      border.strokeRoundedRect(
        -(GAME_WIDTH - 120) / 2,
        -(rowHeight - 14) / 2,
        GAME_WIDTH - 120,
        rowHeight - 14,
        12,
      );

      // Farbmarke am linken Rand - macht die Welt auch ohne Lesen erkennbar.
      const swatch = this.add
        .image(-(GAME_WIDTH - 120) / 2 + 14, 0, TextureKey.Pixel)
        .setDisplaySize(5, rowHeight - 40)
        .setTint(world.accent)
        .setAlpha(isUnlocked ? 1 : 0.3);

      const name = this.add
        .text(
          -(GAME_WIDTH - 120) / 2 + 34,
          -15,
          world.name,
          textStyle(FontSize.body, isUnlocked ? toCss(world.accent) : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5);

      const subtitle = this.add
        .text(
          -(GAME_WIDTH - 120) / 2 + 34,
          15,
          isUnlocked ? world.flavor : `Freigeschaltet ab Level ${world.unlockLevel}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0, 0.5);
      subtitle.setWordWrapWidth(GAME_WIDTH - 210);

      row.add([bg, border, swatch, name, subtitle]);

      if (!isUnlocked) {
        row.setAlpha(0.5);
        return;
      }

      const rowWidth = GAME_WIDTH - 120;
      const rowHit = rowHeight - 14;

      // Trefferflaeche am gemessenen Ursprung ausrichten - dieselbe Falle wie
      // bei den Knoepfen, ausfuehrlich begruendet in ui/widgets.ts.
      row.setSize(rowWidth, rowHit);
      row.setInteractive(makeAlignedHitArea(row, rowWidth, rowHit), Phaser.Geom.Rectangle.Contains);

      row.on('pointerup', () => {
        SaveSystem.update((data) => {
          data.lastWorldId = world.id;
        });
        // Neu aufbauen ist hier billiger und fehlerfreier als selektives Update.
        this.scene.restart();
      });
    });
  }

  private buildFooter(bestScore: number): void {
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 390,
      'JAGD BEGINNEN',
      () => {
        this.scene.start(SceneKey.Game, { worldId: this.selectedWorld.id });
      },
      {
        width: 440,
        accent: this.selectedWorld.accent,
        fontSize: FontSize.large,
      },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 296,
      'DUELL ZU ZWEIT',
      () => {
        ChallengeSystem.start(this.selectedWorld.id);
        this.scene.start(SceneKey.Challenge);
      },
      { width: 440, height: 76, accent: Palette.goldHex, fontSize: FontSize.body },
    );

    // Online-Knoepfe nur zeigen, wenn ein Dienst eingerichtet ist - ein Knopf,
    // der zuverlaessig in eine Fehlermeldung fuehrt, ist schlimmer als keiner.
    if (CloudSystem.isAvailable()) {
      const y = GAME_HEIGHT - 212;
      createButton(this, 196, y, 'BESTENLISTE', () => this.scene.start(SceneKey.Leaderboard), {
        width: 244,
        height: 66,
        accent: 0x9aa3bd,
        fontSize: FontSize.tiny,
      });
      createButton(this, 524, y, 'SPIELSTAND', () => this.scene.start(SceneKey.Sync), {
        width: 244,
        height: 66,
        accent: 0x9aa3bd,
        fontSize: FontSize.tiny,
      });
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 142,
        `Bestwert: ${bestScore.toLocaleString('de-DE')}`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    this.buildHint();
  }

  /**
   * Fusszeile: Steuerungshinweis - und auf dem iPhone der einzige Weg zum
   * Vollbild, weil es dort keine Fullscreen-API gibt (core/display.ts).
   *
   * Der iOS-Hinweis steht bewusst in einem eigenen Kasten und nicht als
   * Fusszeilentext: Beim Spieltest wurde er dort schlicht uebersehen, und die
   * Rueckmeldung lautete, es gebe gar keinen Vollbild-Knopf. Der Knopf fehlt
   * auf iOS zu Recht (ADR-0009) - dann muss aber der Ersatz auffindbar sein.
   */
  private buildHint(): void {
    if (isIos() && !isStandalone()) {
      // Zwischen Bestwert (1138) und Steuerungshinweis (1244) - der Kasten
      // passt genau dazwischen, ohne eines von beiden zu ueberdecken.
      const y = GAME_HEIGHT - 88;

      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 76, Palette.goldHex, { alpha: 0.5 });

      this.add
        .text(
          GAME_WIDTH / 2,
          y - 15,
          'VOLLBILD OHNE ADRESSLEISTE',
          textStyle(FontSize.tiny, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setLetterSpacing(3);

      this.add
        .text(
          GAME_WIDTH / 2,
          y + 15,
          'Teilen-Symbol  ›  Zum Home-Bildschirm',
          textStyle(FontSize.tiny, Palette.ink),
        )
        .setOrigin(0.5);
    }

    const hint = DEBUG_ENABLED
      ? 'Ziehen zum Steuern  ·  am PC: WASD / Pfeiltasten  ·  Debug: 1-6, L, K, J, P, 0'
      : 'Ziehen zum Steuern  ·  am PC: WASD / Pfeiltasten';

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 36, hint, textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 80)
      .setAlign('center');

    // Hier stand einmal eine zweite Versionsnummer. Sie ist entfernt: Die
    // Anzeige lebt im DOM (`index.html` -> #version, gesetzt in main.ts) und
    // war dadurch doppelt zu sehen. Das DOM gewinnt, weil es die Nummer auch
    // dann zeigt, wenn Phaser gar nicht erst startet - genau dafuer war sie da.
  }
}
