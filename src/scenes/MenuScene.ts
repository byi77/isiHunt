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
} from '@/ui/widgets';

export class MenuScene extends Phaser.Scene {
  private selectedWorld!: WorldDef;

  constructor() {
    super(SceneKey.Menu);
  }

  create(data: { fadeIn?: boolean; fadeColor?: number } = {}): void {
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
    this.buildProfilePanel(save.playerName, save.level);
    this.buildWorldList(save.level);
    this.buildFooter(save.bestScore);

    if (data.fadeIn) {
      const fadeColor = Phaser.Display.Color.IntegerToColor(data.fadeColor ?? 0);
      this.cameras.main.fadeIn(240, fadeColor.red, fadeColor.green, fadeColor.blue);
    }

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

  /** Name, Lichtfigur und die wichtigste Fortschrittszahl. */
  private buildProfilePanel(playerName: string, level: number): void {
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
      .text(172, y - 26, playerName, textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);

    this.add
      .text(
        172,
        y + 4,
        `LEVEL ${level}`,
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);

    this.add
      .text(172, y + 29, 'DEIN PROFIL', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);

    createButton(this, GAME_WIDTH - 148, y, 'PROFIL', () => this.scene.start(SceneKey.Profile), {
      width: 170,
      height: 62,
      accent: this.selectedWorld.accent,
      fontSize: FontSize.tiny,
    });
  }

  /** Vertikaler Welten-Carousel mit Sperr-Zustand. */
  private buildWorldList(level: number): void {
    const centerY = 530;
    const step = 112;
    const selectedIndex = Math.max(
      0,
      WORLDS.findIndex((world) => world.id === this.selectedWorld.id),
    );

    this.add.text(60, 350, 'WELTEN', textStyle(FontSize.tiny, Palette.inkDim)).setLetterSpacing(6);

    const carousel = this.add.container(0, 0);
    const cardWidth = GAME_WIDTH - 120;
    const cardHeight = 96;
    const wheelCards: Array<{
      card: Phaser.GameObjects.Container;
      offset: number;
      opacity: number;
    }> = [];

    WORLDS.forEach((world, index) => {
      const offset = index - selectedIndex;
      if (Math.abs(offset) > 1) return;

      const y = centerY + offset * step;
      const isUnlocked = world.unlockLevel <= level;
      const isSelected = offset === 0;
      const card = this.add.container(GAME_WIDTH / 2, y);

      const bg = this.add
        .image(0, 0, TextureKey.Pixel)
        .setDisplaySize(cardWidth, cardHeight)
        .setTint(world.accent)
        .setAlpha(0.18);

      const border = this.add.graphics();
      border.lineStyle(isSelected ? 3 : 1.5, world.accent, isUnlocked ? 0.9 : 0.3);
      border.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);

      card.add([bg, border]);

      // Ein sanfter Schein fuer jede Karte. Kein Post-FX-Blur: Auf mobilen
      // WebGL-Renderern fuellte der Blur den Container mit Schwarz.
      card.add(
        this.add
          .image(0, 0, TextureKey.Glow)
          .setDisplaySize(cardWidth * 1.08, cardHeight * 2.1)
          .setTint(world.accent)
          .setAlpha(0.06)
          .setBlendMode(Phaser.BlendModes.ADD),
      );

      // Farbmarke am linken Rand - macht die Welt auch ohne Lesen erkennbar.
      const swatch = this.add
        .image(-cardWidth / 2 + 18, 0, TextureKey.Pixel)
        .setDisplaySize(5, cardHeight - 34)
        .setTint(world.accent)
        .setAlpha(isUnlocked ? 1 : 0.3);

      const name = this.add.text(
        -cardWidth / 2 + 42,
        -14,
        world.name,
        textStyle(FontSize.body, isUnlocked ? toCss(world.accent) : Palette.inkDim, {
          fontStyle: 'bold',
        }),
      );
      name.setOrigin(0, 0.5);

      card.add([swatch, name]);

      const subtitle = this.add
        .text(
          -cardWidth / 2 + 42,
          18,
          isUnlocked ? world.flavor : `Freigeschaltet ab Level ${world.unlockLevel}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0, 0.5);
      subtitle.setWordWrapWidth(cardWidth - 76);
      card.add(subtitle);

      carousel.add(card);
      wheelCards.push({ card, offset, opacity: isUnlocked ? 1 : 0.5 });
    });

    // Die Karten liegen auf einer senkrechten Kreisbahn statt auf einer
    // geraden Liste. Die Karten selbst bleiben dabei immer gerade: Nur ihre
    // Hoehe, Groesse und Tiefe aendern sich wie bei einem echten Wheel.
    const dragState = { offset: 0 };
    const wheelRadius = 140;
    const wheelAngle = 0.8;
    const updateWheel = (dragY: number): void => {
      dragState.offset = dragY;
      const progress = dragY / step;

      for (const entry of wheelCards) {
        const position = Phaser.Math.Clamp(entry.offset + progress, -1.35, 1.35);
        const radians = position * wheelAngle;
        const curve = Math.sin(radians);
        const depth = Math.max(0, Math.cos(radians));

        entry.card.x = GAME_WIDTH / 2 + curve * 12;
        entry.card.y = centerY + curve * wheelRadius;
        entry.card.setScale(0.72 + depth * 0.28);
        entry.card.setAlpha(entry.opacity * (0.72 + depth * 0.28));
        entry.card.setAngle(0);
        entry.card.setDepth(Math.round(depth * 20));
      }

      carousel.sort('depth');
    };

    const snapWheelBack = (): void => {
      this.tweens.add({
        targets: dragState,
        offset: 0,
        duration: 160,
        ease: 'Cubic.Out',
        onUpdate: () => updateWheel(dragState.offset),
      });
    };

    updateWheel(0);

    this.add
      .text(GAME_WIDTH / 2, 730, 'HOCH / RUNTER WISCHEN', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(3);

    let startY = 0;
    let startX = 0;
    let activePointerId: number | null = null;
    const selectorTop = 370;
    const selectorBottom = 700;

    const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
      if (activePointerId !== null || pointer.y < selectorTop || pointer.y > selectorBottom) return;
      activePointerId = pointer.id;
      startY = pointer.y;
      startX = pointer.x;
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== activePointerId) return;
      updateWheel(pointer.y - startY);
    };

    const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== activePointerId) return;

      const deltaY = pointer.y - startY;
      const deltaX = pointer.x - startX;
      activePointerId = null;
      startY = 0;

      if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
        if (!this.selectWorld(selectedIndex + (deltaY < 0 ? 1 : -1), level)) {
          snapWheelBack();
        }
        return;
      }

      if (Math.abs(deltaY) < 24 && pointer.y >= selectorTop && pointer.y <= selectorBottom) {
        const offset = Math.round((pointer.y - centerY) / step);
        if (!this.selectWorld(selectedIndex + offset, level)) {
          snapWheelBack();
        }
        return;
      }

      snapWheelBack();
    };

    this.input.on('pointerdown', onPointerDown);
    this.input.on('pointermove', onPointerMove);
    this.input.on('pointerup', onPointerUp);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', onPointerDown);
      this.input.off('pointermove', onPointerMove);
      this.input.off('pointerup', onPointerUp);
    });
  }

  private selectWorld(index: number, level: number): boolean {
    const world = WORLDS[index];
    if (!world || world.unlockLevel > level || world.id === this.selectedWorld.id) return false;

    SaveSystem.update((data) => {
      data.lastWorldId = world.id;
    });

    // Erst ausblenden, dann den neuen Weltenhintergrund aufbauen. So gibt es
    // keinen harten Farbsprung zwischen zwei unterschiedlich gefaerbten
    // Welten.
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.scene.isActive()) this.scene.restart({ fadeIn: true, fadeColor: world.bgTop });
    });
    const fadeColor = Phaser.Display.Color.IntegerToColor(world.bgTop);
    camera.fadeOut(220, fadeColor.red, fadeColor.green, fadeColor.blue);
    return true;
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
