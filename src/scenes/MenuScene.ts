/**
 * Startbildschirm: Profil, Weltenauswahl, Start.
 *
 * Der Bildschirm ist der schnelle Einstieg: Name, Welt und Jagd. Die
 * Fortschrittszahlen liegen im Profil und unterbrechen den Start nicht.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { isIos, isStandalone } from '@/core/display';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import { SceneKey } from '@/scenes/SceneKey';
import { attachHitDebug } from '@/ui/hitDebug';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { playerTextureForLevel, TextureKey } from '@/ui/textures';
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
  private worldBackdrop!: Phaser.GameObjects.Container;
  private worldCarousel: Phaser.GameObjects.Container | null = null;
  private worldInputCleanup: (() => void) | null = null;
  private worldListDecorations: Phaser.GameObjects.GameObject[] = [];
  private savePromptObjects: Phaser.GameObjects.GameObject[] = [];
  private saveSyncBusy = false;
  private readonly onlineHandler = (): void => {
    void this.checkCloudSave();
  };

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

    this.worldBackdrop = createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.selectedWorld.bgTop,
      this.selectedWorld.bgBottom,
      this.selectedWorld.accent,
      this.selectedWorld.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, this.selectedWorld.spaceVariant);
    createAmbientMotes(this, GAME_WIDTH, GAME_HEIGHT, this.selectedWorld.accent);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    this.buildTitle();
    this.buildFullscreenToggle();
    this.buildProfilePanel(save.playerName, save.level, save.bestScore, save.coins);
    this.buildWorldList(save.level);
    this.buildFooter();

    void this.showUpdateHintIfAny();
    void this.checkCloudSave();
    window.addEventListener('online', this.onlineHandler);

    // Nur mit ?hitboxes in der Adresse - zeigt, was Phaser fuer anfassbar haelt.
    attachHitDebug(this);

    this.events.once('shutdown', () => {
      this.cleanupWorldList();
      window.removeEventListener('online', this.onlineHandler);
      this.clearSavePrompt();
    });
  }

  /**
   * Prueft den bekannten Cloud-Stand. Offline bleibt das lokale Ergebnis
   * unangetastet; bei Rueckkehr des Netzes wird dieselbe Pruefung erneut
   * ausgefuehrt. Ein besserer Cloud-Stand braucht eine sichtbare Entscheidung.
   */
  private async checkCloudSave(): Promise<void> {
    if (this.saveSyncBusy || !CloudSystem.isAvailable() || !this.scene.isActive()) return;
    this.saveSyncBusy = true;

    const local = SaveSystem.load();
    if (!local.cloudId) {
      await CloudSystem.pushSave();
      this.saveSyncBusy = false;
      return;
    }

    const result = await CloudSystem.fetchSave(local.cloudId);
    if (!this.scene.isActive()) {
      this.saveSyncBusy = false;
      return;
    }

    if (!result.ok) {
      // Kein Netz: spaeter bzw. beim naechsten Run erneut versuchen. Der lokale
      // Stand bleibt die ganze Zeit erhalten.
      this.saveSyncBusy = false;
      return;
    }

    if (!result.value) {
      // Die Kennung ist lokal noch vorhanden, der Datensatz wurde aber etwa
      // nach einer Backend-Bereinigung entfernt. Den lokalen Stand neu anlegen.
      await CloudSystem.pushSave();
      this.saveSyncBusy = false;
      return;
    }

    if (CloudSystem.isRemoteAhead(local, result.value)) {
      this.showRemoteSavePrompt(result.value);
    } else if (CloudSystem.isLocalAhead(local, result.value)) {
      await CloudSystem.pushSave();
    }

    this.saveSyncBusy = false;
  }

  private showRemoteSavePrompt(remote: RemoteSave): void {
    if (this.savePromptObjects.length > 0) return;

    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.backdrop, 0.88)
      .setOrigin(0)
      .setDepth(100);
    // Das Overlay ist auch als Eingabeflaeche aktiv: Die darunterliegende
    // Weltenauswahl darf waehrend der Cloud-Entscheidung nicht aus Versehen
    // einen weiteren Bildschirm oeffnen.
    overlay.setInteractive();
    const panel = createPanel(this, GAME_WIDTH / 2, 650, GAME_WIDTH - 100, 430, Palette.goldHex, {
      alpha: 0.98,
      radius: 24,
    }).setDepth(101);

    const title = this.add
      .text(
        GAME_WIDTH / 2,
        490,
        'NEUERER SPIELSTAND GEFUNDEN',
        textStyle(FontSize.body, Palette.gold),
      )
      .setOrigin(0.5)
      .setDepth(102)
      .setLetterSpacing(2);
    const details = this.add
      .text(
        GAME_WIDTH / 2,
        565,
        `Cloud: Level ${remote.level}  ·  Bestwert ${remote.bestScore.toLocaleString('de-DE')}\n${remote.totalRuns} Runs\n\nSoll dieser Stand uebernommen werden?`,
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setDepth(102);

    const adopt = createButton(
      this,
      GAME_WIDTH / 2,
      725,
      'CLOUD-STAND NEHMEN',
      () => {
        const local = SaveSystem.load();
        if (!local.cloudId) return;
        SaveSystem.adoptRemote(remote.data, local.cloudId);
        this.clearSavePrompt();
        this.scene.restart();
      },
      { width: 430, height: 74, accent: Palette.goldHex, fontSize: FontSize.small },
    );
    adopt.container.setDepth(102);

    const keepLocal = createButton(
      this,
      GAME_WIDTH / 2,
      820,
      'DIESEN STAND BEHALTEN',
      () => {
        if (this.saveSyncBusy) return;
        this.saveSyncBusy = true;
        void CloudSystem.pushSave().then((result) => {
          this.saveSyncBusy = false;
          if (result.ok) this.clearSavePrompt();
        });
      },
      { width: 430, height: 68, accent: 0x9aa3bd, fontSize: FontSize.tiny },
    );
    keepLocal.container.setDepth(102);

    this.savePromptObjects = [overlay, panel, title, details, adopt.container, keepLocal.container];
  }

  private clearSavePrompt(): void {
    for (const object of this.savePromptObjects) object.destroy();
    this.savePromptObjects = [];
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

  /** Name, Lichtfigur, Level und Bestwert direkt im Profilblock. */
  private buildProfilePanel(
    playerName: string,
    level: number,
    bestScore: number,
    coins: number,
  ): void {
    const y = 270;
    const width = GAME_WIDTH - 120;

    createPanel(this, GAME_WIDTH / 2, y, width, 126, this.selectedWorld.accent, { alpha: 0.58 });

    this.add
      .image(112, y, TextureKey.PlayerHalo)
      .setTint(this.selectedWorld.accent)
      .setScale(0.48)
      .setAlpha(0.8);

    this.add.image(112, y, playerTextureForLevel(level)).setTint(Palette.goldHex).setScale(0.34);

    this.add
      .text(172, y - 26, playerName, textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);

    this.add
      .text(
        172,
        y + 2,
        `LEVEL ${level}`,
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);

    this.add
      .text(
        172,
        y + 28,
        `BESTWERT ${bestScore.toLocaleString('de-DE')}`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);

    this.add
      .text(
        172,
        y + 49,
        `COINS ${coins.toLocaleString('de-DE')}`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
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
    this.cleanupWorldList();

    const centerY = 530;
    const step = 112;
    const selectedIndex = Math.max(
      0,
      WORLDS.findIndex((world) => world.id === this.selectedWorld.id),
    );

    const worldLabel = this.add
      .text(60, 350, 'WELTEN', textStyle(FontSize.tiny, Palette.inkDim))
      .setLetterSpacing(6);
    this.worldListDecorations.push(worldLabel);

    const carousel = this.add.container(0, 0);
    this.worldCarousel = carousel;
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

      if (!isUnlocked) {
        // Zentrales Schloss: Die Welt bleibt lesbar, aber der Zustand ist
        // ohne Text sofort erkennbar. Der dunkle Kreis gibt dem Symbol auf
        // jeder Weltfarbe einen ruhigen, klaren Kontrast.
        const lock = this.add.graphics();
        lock.fillStyle(Palette.backdrop, 0.88);
        lock.fillRoundedRect(-34, -34, 68, 68, 16);
        lock.lineStyle(2, world.accent, 0.65);
        lock.strokeRoundedRect(-34, -34, 68, 68, 16);

        lock.lineStyle(4, Palette.goldHex, 1);
        lock.beginPath();
        lock.arc(0, -5, 13, Math.PI, 0, false);
        lock.strokePath();
        lock.fillStyle(Palette.goldHex, 1);
        lock.fillRoundedRect(-17, -5, 34, 27, 6);
        lock.fillStyle(Palette.backdrop, 1);
        lock.fillCircle(0, 7, 3.5);
        lock.fillRect(-1.5, 7, 3, 8);
        card.add(lock);
      }

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

    const swipeHint = this.add
      .text(GAME_WIDTH / 2, 730, 'HOCH / RUNTER WISCHEN', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.worldListDecorations.push(swipeHint);

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
    this.worldInputCleanup = () => {
      this.input.off('pointerdown', onPointerDown);
      this.input.off('pointermove', onPointerMove);
      this.input.off('pointerup', onPointerUp);
    };
  }

  private cleanupWorldList(): void {
    this.worldInputCleanup?.();
    this.worldInputCleanup = null;
    this.worldCarousel?.destroy(true);
    this.worldCarousel = null;
    for (const decoration of this.worldListDecorations) decoration.destroy();
    this.worldListDecorations = [];
  }

  private selectWorld(index: number, level: number): boolean {
    const world = WORLDS[index];
    if (!world || world.unlockLevel > level || world.id === this.selectedWorld.id) return false;

    SaveSystem.update((data) => {
      data.lastWorldId = world.id;
    });

    this.selectedWorld = world;
    this.transitionWorldBackdrop(world);
    this.buildWorldList(level);
    return true;
  }

  private transitionWorldBackdrop(world: WorldDef): void {
    const previous = this.worldBackdrop;
    const next = createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    next.setAlpha(0);
    this.worldBackdrop = next;

    this.tweens.add({
      targets: previous,
      alpha: 0,
      duration: 260,
      ease: 'Sine.InOut',
    });
    this.tweens.add({
      targets: next,
      alpha: 1,
      duration: 320,
      ease: 'Sine.InOut',
      onComplete: () => previous.destroy(true),
    });
  }

  private buildFooter(): void {
    // Der Hinweis endet bei y=730. Die Hauptaktionen folgen mit sichtbarem
    // Abstand und bleiben auch auf sehr hohen Handydisplays in diesem Block,
    // statt weit unten aus dem Blickfeld zu rutschen.
    const actionsY = Math.min(GAME_HEIGHT - 390, 840);

    createButton(
      this,
      GAME_WIDTH / 2,
      actionsY,
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
      actionsY + 94,
      'DUELL ZU ZWEIT',
      () => {
        ChallengeSystem.start(this.selectedWorld.id);
        this.scene.start(SceneKey.Challenge);
      },
      { width: 440, height: 76, accent: Palette.goldHex, fontSize: FontSize.body },
    );

    // Die Rangliste ist ein grosser Hauptbutton direkt unter dem Duell. Die
    // Einstellungen bleiben ein kleiner, einzelner Button ganz unten mittig.
    if (CloudSystem.isAvailable()) {
      createButton(
        this,
        GAME_WIDTH / 2,
        actionsY + 188,
        'RANGLISTE',
        () => this.scene.start(SceneKey.Leaderboard),
        {
          width: 440,
          accent: 0x9aa3bd,
          fontSize: FontSize.body,
        },
      );
    }

    const settingsY = GAME_HEIGHT - 165;
    createButton(
      this,
      GAME_WIDTH / 2,
      settingsY,
      'EINSTELLUNGEN',
      () => this.scene.start(SceneKey.Settings),
      {
        width: CloudSystem.isAvailable() ? 244 : 300,
        height: 66,
        accent: 0x9aa3bd,
        fontSize: FontSize.tiny,
      },
    );

    this.buildHint();
  }

  /**
   * Fusszeile: Auf dem iPhone der einzige Weg zum Vollbild, weil es dort keine
   * Fullscreen-API gibt (core/display.ts). Der Hinweis steht bewusst als
   * eigener Kasten: Beim Spieltest wurde ein
   * Fusszeilentext dort schlicht uebersehen, und die
   * Rueckmeldung lautete, es gebe gar keinen Vollbild-Knopf. Der Knopf fehlt
   * auf iOS zu Recht (ADR-0009) - dann muss aber der Ersatz auffindbar sein.
   */
  private buildHint(): void {
    if (isIos() && !isStandalone()) {
      // Der Kasten sitzt am unteren Rand des Menues.
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

    // Hier stand einmal eine zweite Versionsnummer. Sie ist entfernt: Die
    // Anzeige lebt im DOM (`index.html` -> #version, gesetzt in main.ts) und
    // war dadurch doppelt zu sehen. Das DOM gewinnt, weil es die Nummer auch
    // dann zeigt, wenn Phaser gar nicht erst startet - genau dafuer war sie da.
  }
}
