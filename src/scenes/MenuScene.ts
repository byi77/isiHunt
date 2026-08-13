/**
 * Startbildschirm: Charakterfortschritt, Weltenauswahl, Start.
 *
 * Der Bildschirm ist die "Charakteruebersicht" des Spiels - hier sieht man auf
 * einen Blick, wo man steht, und was das naechste Level freischaltet.
 */

import Phaser from 'phaser';

import { APP_VERSION, DEBUG_ENABLED, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { isIos, isStandalone } from '@/core/display';
import { SceneKey } from '@/scenes/SceneKey';
import { attachHitDebug } from '@/ui/hitDebug';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createAmbientMotes,
  createBar,
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
    this.buildCharacterPanel(save.level);
    this.buildWorldList(save.level);
    this.buildFooter(save.bestScore);

    // Nur mit ?hitboxes in der Adresse - zeigt, was Phaser fuer anfassbar haelt.
    attachHitDebug(this);
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

  /** Level, XP-Balken und offene Talentpunkte. */
  private buildCharacterPanel(level: number): void {
    const save = SaveSystem.load();
    const progress = ProgressionSystem.getLevelProgress(save);
    const y = 232;

    this.add
      .text(60, y, `Level ${level}`, textStyle(FontSize.large, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);

    this.add
      .text(
        GAME_WIDTH - 60,
        y,
        `${progress.xpInLevel} / ${progress.xpNeeded} XP`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(1, 0.5);

    const bar = createBar(this, 60, y + 34, GAME_WIDTH - 120, 10, this.selectedWorld.accent);
    bar.setRatio(progress.ratio);

    if (save.talentPoints > 0) {
      this.add
        .text(
          60,
          y + 62,
          `${save.talentPoints} Talentpunkt${save.talentPoints === 1 ? '' : 'e'} verfuegbar  (Vergabe folgt)`,
          textStyle(FontSize.tiny, Palette.gold),
        )
        .setOrigin(0, 0.5);
    }
  }

  /** Weltenliste mit Sperr-Zustand. */
  private buildWorldList(level: number): void {
    const startY = 352;
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

    // Versionsnummer unten rechts: beim Test auf dem Handy die einzige
    // verlaessliche Auskunft darueber, ob der neue Stand geladen wurde.
    this.add
      .text(GAME_WIDTH - 16, GAME_HEIGHT - 14, `v${APP_VERSION}`, textStyle(14, Palette.inkDim))
      .setOrigin(1, 1)
      .setAlpha(0.6);
  }
}
