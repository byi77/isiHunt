import { ShipOrbit } from '@/ui/shipOrbit';
import Phaser from 'phaser';

import { GAME_WIDTH } from '@/config/GameConfig';
import { getShipShape, shipAuraAssetId, shipAuraIndex, shipTint } from '@/config/shop';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { isIos, isStandalone } from '@/core/display';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import type { SaveData } from '@/types';
import { Depth } from '@/ui/depth';
import { auraAssetForId } from '@/ui/egoAssets';
import { calculateMenuLayout } from '@/ui/menuLayout';
import { createSpatialPlanet } from '@/ui/spatialPlanet';
import type { MenuLayout } from '@/ui/menuLayout';
import {
  AURA_FRAME_RUHE,
  applyTintShift,
  SHIP_ANIMATIONS,
  stehendesBild,
} from '@/ui/shipAnimations';
import { playerTextureForShape, TextureKey } from '@/ui/textures';
import { Palette, textStyle } from '@/ui/theme';
import { createButton, createPanel } from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';

export type MenuAction =
  | 'profile'
  | 'jagd'
  | 'daily'
  | 'duel'
  | 'achievements'
  | 'talents'
  | 'leaderboard'
  | 'settings'
  | 'shop'
  | 'info'
  | 'fullscreen'
  | 'logo'
  | 'update';

interface MenuCallbacks {
  onAction(action: MenuAction): void;
  onWorldSelected(world: WorldDef): void;
  leaderboardAvailable: boolean;
  signedIn: boolean;
}

/** Reine Menüansicht; Navigation, Sync und Persistenz bleiben in MenuScene. */
export class MenuView {
  private root!: Phaser.GameObjects.Container;
  private hero!: Phaser.GameObjects.Container;
  private orbit: ShipOrbit | null = null;
  private ship: Phaser.GameObjects.Image | null = null;
  private halo: Phaser.GameObjects.Image | null = null;
  private aura: Phaser.GameObjects.Image | null = null;
  private engineGlow: Phaser.GameObjects.Image | null = null;
  private layout!: MenuLayout;
  private elapsed = 0;
  private resizePending = false;
  private pointerStart: { id: number; x: number; y: number } | null = null;
  private updateVersion: string | null = null;
  private readonly onResize = (): void => {
    this.resizePending = true;
  };
  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    const { worldTop, worldTitleY, margin } = this.layout;
    if (
      pointer.y < worldTop ||
      pointer.y > worldTitleY - 28 * this.layout.unit ||
      pointer.x < margin + 48 * this.layout.unit ||
      pointer.x > GAME_WIDTH - margin - 48 * this.layout.unit
    )
      return;
    this.pointerStart = { id: pointer.id, x: pointer.x, y: pointer.y };
  };
  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (start?.id !== pointer.id) return;
    const dy = pointer.y - start.y;
    if (Math.abs(dy) > 28 * this.layout.unit && Math.abs(dy) > Math.abs(pointer.x - start.x)) {
      this.chooseWorld(dy < 0 ? 1 : -1);
    }
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly save: SaveData,
    private world: WorldDef,
    private readonly callbacks: MenuCallbacks,
  ) {
    this.build();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointerup', this.onPointerUp);
    scene.input.on('pointerupoutside', this.onPointerUp);
  }

  setUpdateAvailable(version: string): void {
    this.updateVersion = version;
    this.build();
  }

  update(delta: number): void {
    if (this.resizePending) {
      this.resizePending = false;
      this.build();
    }
    const reduced = prefersReducedMotion();
    if (!reduced) this.elapsed += Math.max(0, delta);
    const index = shipAuraIndex(this.save);
    const animation = index === null ? undefined : SHIP_ANIMATIONS[index];
    const frame =
      animation === undefined
        ? AURA_FRAME_RUHE
        : reduced
          ? stehendesBild(animation)
          : animation(this.elapsed);
    const tint = applyTintShift(shipTint(this.save, this.world.accent), frame.tint);
    const size = this.layout.shipSize;
    const bob = reduced ? 0 : Math.sin(this.elapsed / 1100) * 2 * this.layout.unit;
    this.hero.y = bob;
    // Begrenzte Präsentationsfläche: auch große Kosmetika bleiben oberhalb des Welttitels.
    if (this.ship) {
      const base = size / Math.max(this.ship.width, this.ship.height);
      this.ship
        .setScale(base * Math.min(1.15, frame.scaleX), base * Math.min(1.15, frame.scaleY))
        .setRotation(frame.rotation)
        .setTint(tint)
        .setAlpha(frame.alpha);
    }
    this.halo?.setTint(tint);
    this.engineGlow?.setAlpha(0.38 * frame.alpha);
    this.orbit?.update(index !== null);
    if (this.aura) {
      const asset = auraAssetForId(shipAuraAssetId(this.save));
      if (asset) {
        const frameIndex = reduced
          ? 0
          : Math.floor(this.elapsed / asset.frameDurationMs) % asset.frameTextureKeys.length;
        const key = asset.frameTextureKeys[frameIndex];
        if (key) this.aura.setTexture(key);
      }
      const scale = (size * 1.65) / Math.max(this.aura.width, this.aura.height);
      this.aura
        .setScale(scale * Math.min(1.15, frame.scaleX), scale * Math.min(1.15, frame.scaleY))
        .setTint(tint)
        .setAlpha(0.5 * frame.alpha);
    }
  }

  destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.input.off('pointerupoutside', this.onPointerUp);
    this.root.destroy(true);
    this.ship = this.halo = this.aura = this.engineGlow = null;
    this.orbit = null;
  }

  private build(): void {
    this.root?.destroy(true);
    this.ship = this.halo = this.aura = this.engineGlow = null;
    this.orbit = null;
    this.pointerStart = null;
    const canvas = this.scene.game.canvas.getBoundingClientRect();
    const safeBottom =
      document.getElementById('safe-bottom')?.getBoundingClientRect().bottom ?? window.innerHeight;
    const inset = Math.max(0, canvas.bottom - safeBottom);
    this.layout = calculateMenuLayout(
      canvas.width,
      canvas.height,
      inset,
      isIos() && !isStandalone(),
    );
    this.root = this.scene.add.container(0, 0).setDepth(Depth.UI);
    this.header();
    this.profile();
    this.worldSelection();
    this.navigation();
    this.update(0);
  }

  private label(
    x: number,
    y: number,
    value: string,
    size: number,
    maxWidth: number,
    color: string = Palette.ink,
    centered = false,
  ): Phaser.GameObjects.Text {
    const label = this.scene.add
      .text(
        x,
        y,
        value,
        textStyle(this.layout.font(size), color, {
          fontStyle: size >= 14 ? 'bold' : 'normal',
        }),
      )
      .setOrigin(centered ? 0.5 : 0, 0.5);
    // Die Schrift bleibt lesbar. Vollständige Werte sind über das Profil zugänglich.
    if (label.width > maxWidth) {
      let shortened = value;
      while (shortened.length > 0 && label.width > maxWidth) {
        shortened = shortened.slice(0, -1);
        label.setText(`${shortened}…`);
      }
    }
    this.root.add(label);
    return label;
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void,
    size = 14,
    primary = false,
  ): ButtonHandle {
    const handle = createButton(this.scene, x, y, label, action, {
      width,
      height,
      fontSize: this.layout.font(size),
      variant: primary ? 'primary' : 'secondary',
    });
    this.root.add(handle.container);
    return handle;
  }

  private header(): void {
    const { margin, headerHeight, unit, compact } = this.layout;
    // Der Hinweis ersetzt die dekorative Kopfzeile statt zusätzliche Höhe zu verlangen.
    if (this.updateVersion !== null) {
      this.updateBanner();
      return;
    }
    const logoHeight = headerHeight - 4 * unit;
    const logoWidth = (logoHeight * 400) / 225;
    const logo = this.scene.add
      .image(margin + logoWidth / 2, headerHeight / 2, TextureKey.Logo)
      .setDisplaySize(logoWidth, logoHeight)
      .setInteractive();
    logo.on('pointerdown', () => this.callbacks.onAction('logo'));
    this.root.add(logo);
    if (this.scene.scale.fullscreen.available && !isStandalone()) {
      this.button(
        GAME_WIDTH - margin - 22 * unit,
        headerHeight / 2,
        44 * unit,
        44 * unit,
        '⛶',
        () => this.callbacks.onAction('fullscreen'),
        23,
      );
    }
    if (!compact)
      this.label(
        GAME_WIDTH / 2 + 10 * unit,
        headerHeight / 2,
        'JAGE DAS LICHT',
        10,
        110 * unit,
        Palette.inkDim,
        true,
      );
  }

  /**
   * Der Update-Hinweis als eigener Balken statt als grauer Knopf.
   *
   * Vorher war es ein gewoehnlicher Sekundaerknopf in der Kopfzeile: gleiche
   * Farbe, gleiche Form und gleiche Groesse wie die acht Menueknoepfe
   * darunter. Wer nicht gezielt hinsah, hielt ihn fuer Teil des Menues - der
   * Hinweis war zwar da, wurde aber uebersehen.
   *
   * Deshalb bricht er jetzt bewusst aus dem Raster aus: goldene Flaeche in der
   * Warnfarbe, hoeher als eine Menuezeile, ein Glimmen darunter und ein
   * langsamer Puls. Ein Update zu verpassen kostet mehr als ein auffaelliger
   * Balken - genau daran sind vier Runden Fehlersuche gescheitert
   * (docs/CODE_STYLE.md 1.9).
   */
  private updateBanner(): void {
    const { headerHeight, innerWidth, unit } = this.layout;
    // Das Glimmen liegt aussen um den Balken herum. Es muss in die Kopfzeile
    // passen, sonst ragt es oben aus dem Canvas und unten in die Profilkarte -
    // zwischen beiden liegen nur 6 Pixel (`menuLayout.profileTop`).
    const saum = 5 * unit;
    const height = Math.min(headerHeight - 2 * saum, 58 * unit);
    const y = headerHeight / 2;

    // Liegt unter dem Knopf und traegt keine Trefferflaeche: reines Leuchten,
    // das den Balken aus der dunklen Kopfzeile heraushebt.
    const glow = this.scene.add.graphics();
    glow.fillStyle(Palette.goldHex, 0.22);
    glow.fillRoundedRect(
      GAME_WIDTH / 2 - innerWidth / 2 - saum,
      y - height / 2 - saum,
      innerWidth + 2 * saum,
      height + 2 * saum,
      Math.min(height / 3, 26 * unit),
    );
    this.root.add(glow);

    this.button(
      GAME_WIDTH / 2,
      y,
      innerWidth,
      height,
      // Kurz halten: `createButton` verkleinert die Schrift, sobald der Text
      // breiter wird als der Knopf - ein langer Hinweis endet also kleiner
      // gesetzt als der alte, den niemand gesehen hat.
      `UPDATE ${this.updateVersion} LADEN`,
      () => this.callbacks.onAction('update'),
      19,
      true,
    );

    if (prefersReducedMotion()) {
      // Ohne Puls traegt allein die Farbe den Hinweis - dann aber mit dem
      // vollen Glimmen, nicht mit dem Startwert des Dauerlaufs.
      glow.setAlpha(1);
      return;
    }
    const puls = this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.35, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    // `build()` zerstoert die Root bei jedem Resize und bei jedem Neuaufbau.
    // Ohne diese Kopplung schriebe der Dauerlauf danach in ein totes Objekt.
    glow.once(Phaser.GameObjects.Events.DESTROY, () => puls.remove());
  }

  private profile(): void {
    const { margin, innerWidth, profileTop, profileHeight, unit } = this.layout;
    const centerY = profileTop + profileHeight / 2;
    this.root.add(
      createPanel(
        this.scene,
        GAME_WIDTH / 2,
        centerY,
        innerWidth,
        profileHeight,
        Palette.panelBorder,
        { alpha: 0.95, radius: 12 * unit },
      ),
    );
    const buttonWidth = 76 * unit;
    const textWidth = innerWidth - buttonWidth - 34 * unit;
    const level = this.label(
      margin + 12 * unit + textWidth,
      centerY - 10 * unit,
      `Level ${this.save.level}`,
      12,
      textWidth,
      Palette.inkDim,
    ).setOrigin(1, 0.5);
    this.label(
      margin + 12 * unit,
      centerY - 10 * unit,
      this.save.playerName || 'GAST',
      14,
      textWidth - level.width - 10 * unit,
    );
    const status =
      this.callbacks.signedIn && navigator.onLine ? 'Profil verbunden' : 'Lokal gespeichert';
    this.label(
      margin + 12 * unit,
      centerY + 10 * unit,
      `${this.save.coins.toLocaleString('de-DE')} Coins · ${status}`,
      12,
      textWidth,
      Palette.inkDim,
    );
    this.button(
      GAME_WIDTH - margin - buttonWidth / 2 - 4 * unit,
      centerY,
      buttonWidth,
      44 * unit,
      'Profil ›',
      () => this.callbacks.onAction('profile'),
      13,
    );
  }

  private worldSelection(): void {
    const {
      unit,
      planetSize,
      planetY,
      shipY,
      shipSize,
      margin,
      innerWidth,
      worldTitleY,
      worldSubtitleY,
    } = this.layout;
    const glow = this.scene.add
      .image(GAME_WIDTH / 2, planetY, TextureKey.Glow)
      .setDisplaySize(planetSize * 1.3, planetSize * 1.3)
      .setTint(this.world.accent)
      .setAlpha(0.16);
    const planet = createSpatialPlanet(
      this.scene,
      GAME_WIDTH / 2,
      planetY,
      planetSize,
      this.world.spaceVariant,
    );
    this.root.add([glow, planet]);
    this.hero = this.scene.add.container(0, 0);
    this.root.add(this.hero);
    this.halo = this.scene.add
      .image(GAME_WIDTH / 2, shipY, TextureKey.PlayerHalo)
      .setDisplaySize(shipSize * 1.5, shipSize * 1.5)
      .setAlpha(0.3);
    this.hero.add(this.halo);
    if (shipAuraIndex(this.save) !== null || shipAuraAssetId(this.save)) {
      this.aura = this.scene.add.image(GAME_WIDTH / 2, shipY, TextureKey.Glow);
      this.hero.add(this.aura);
    }
    this.engineGlow = this.scene.add
      .image(GAME_WIDTH / 2, shipY + shipSize * 0.34, TextureKey.Glow)
      .setDisplaySize(shipSize * 0.34, shipSize * 0.52)
      .setTint(0xbfe8ff)
      .setAlpha(0.38);
    this.ship = this.scene.add.image(
      GAME_WIDTH / 2,
      shipY,
      playerTextureForShape(getShipShape(this.save.shipShape).id),
    );
    this.orbit = new ShipOrbit(this.scene, GAME_WIDTH / 2, shipY, shipSize);
    this.hero.add([this.engineGlow, this.orbit.back, this.ship, this.orbit.front]);
    const selectedIndex = WORLDS.indexOf(this.world);
    const previous = this.button(
      margin + 22 * unit,
      planetY,
      44 * unit,
      44 * unit,
      '↑',
      () => this.chooseWorld(-1),
      22,
    );
    previous.setEnabled(selectedIndex > 0);
    const nextWorld = WORLDS[selectedIndex + 1];
    const next = this.button(
      GAME_WIDTH - margin - 22 * unit,
      planetY,
      44 * unit,
      44 * unit,
      '↓',
      () => this.chooseWorld(1),
      22,
    );
    next.setEnabled(nextWorld !== undefined && nextWorld.unlockLevel <= this.save.level);
    this.button(
      GAME_WIDTH / 2,
      worldTitleY,
      innerWidth,
      44 * unit,
      `${this.world.name}  ⓘ`,
      () => this.callbacks.onAction('info'),
      this.layout.compact ? 20 : 24,
    );
    const subtitle =
      nextWorld && nextWorld.unlockLevel > this.save.level
        ? `Nächste: ${nextWorld.name} · Level ${nextWorld.unlockLevel}`
        : `Welt ${selectedIndex + 1} / ${WORLDS.length} · Hoch / runter wischen`;
    this.label(GAME_WIDTH / 2, worldSubtitleY, subtitle, 12, innerWidth, Palette.inkDim, true);
  }

  private chooseWorld(direction: number): void {
    const world = WORLDS[WORLDS.indexOf(this.world) + direction];
    if (!world || world.unlockLevel > this.save.level) return;
    this.world = world;
    this.callbacks.onWorldSelected(world);
    this.build();
  }

  private navigation(): void {
    const {
      margin,
      innerWidth,
      gap,
      primaryY,
      primaryHeight,
      secondaryY,
      tertiaryY,
      settingsY,
      rowHeight,
      installHeight,
      installY,
      unit,
    } = this.layout;
    const half = (innerWidth - gap) / 2;
    const third = (innerWidth - gap * 2) / 3;
    const action = (key: MenuAction) => () => this.callbacks.onAction(key);
    this.button(
      GAME_WIDTH / 2,
      primaryY,
      innerWidth,
      primaryHeight,
      'JAGD STARTEN',
      action('jagd'),
      this.layout.compact ? 17 : 19,
      true,
    );
    this.button(margin + half / 2, secondaryY, half, rowHeight, 'Tageslauf', action('daily'));
    this.button(
      GAME_WIDTH - margin - half / 2,
      secondaryY,
      half,
      rowHeight,
      'Duell',
      action('duel'),
    );
    this.button(
      margin + third / 2,
      tertiaryY,
      third,
      rowHeight,
      'Erfolge',
      action('achievements'),
      13,
    );
    this.button(GAME_WIDTH / 2, tertiaryY, third, rowHeight, 'Talente', action('talents'), 13);
    this.button(
      GAME_WIDTH - margin - third / 2,
      tertiaryY,
      third,
      rowHeight,
      'Rangliste',
      action('leaderboard'),
      13,
    ).setEnabled(this.callbacks.leaderboardAvailable);
    this.button(
      margin + half / 2,
      settingsY,
      half,
      rowHeight,
      'Einstellungen',
      action('settings'),
      13,
    );
    this.button(GAME_WIDTH - margin - half / 2, settingsY, half, rowHeight, 'Shop', action('shop'));
    if (installHeight > 0) {
      this.label(
        GAME_WIDTH / 2,
        installY - 8 * unit,
        'Vollbild auf dem iPhone',
        12,
        innerWidth,
        Palette.gold,
        true,
      );
      this.label(
        GAME_WIDTH / 2,
        installY + 8 * unit,
        'Teilen › Zum Home-Bildschirm',
        12,
        innerWidth,
        Palette.inkDim,
        true,
      );
    }
  }
}
