/**
 * Wiederverwendbare UI-Bausteine.
 *
 * Bewusst Funktionen statt Klassen: die Widgets haben keinen eigenen Zustand,
 * sie bauen nur GameObjects zusammen. Wer Zustand braucht (z. B. Fortschritts-
 * balken), bekommt ein kleines Handle-Objekt mit `set*`-Methoden zurueck.
 */

import Phaser from 'phaser';

import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';

export interface ButtonHandle {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  setLabel(label: string): void;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: { width?: number; height?: number; accent?: number; fontSize?: number } = {},
): ButtonHandle {
  const width = options.width ?? 380;
  const height = options.height ?? 92;
  const accent = options.accent ?? Palette.goldHex;

  const container = scene.add.container(x, y);
  let enabled = true;

  // Weicher Schein hinter dem Knopf - hebt ihn vom Hintergrund ab, ohne eine
  // harte Kante zu brauchen.
  const halo = scene.add
    .image(0, 0, TextureKey.Glow)
    .setDisplaySize(width * 1.5, height * 2.6)
    .setTint(accent)
    .setAlpha(0.5)
    .setBlendMode(Phaser.BlendModes.ADD);

  const bg = scene.add
    .image(0, 0, TextureKey.Pixel)
    .setDisplaySize(width, height)
    .setTint(accent)
    .setAlpha(0.16);

  const border = scene.add.graphics();
  border.lineStyle(3, accent, 0.9);
  border.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);

  const text = scene.add
    .text(
      0,
      0,
      label,
      textStyle(options.fontSize ?? FontSize.body, Palette.ink, { fontStyle: 'bold' }),
    )
    .setOrigin(0.5);

  container.add([halo, bg, border, text]);
  container.setSize(width, height);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );

  const setVisualState = (alpha: number, scale: number) => {
    bg.setAlpha(alpha);
    container.setScale(scale);
  };

  container.on('pointerover', () => enabled && setVisualState(0.3, 1));
  container.on('pointerout', () => enabled && setVisualState(0.16, 1));
  container.on('pointerdown', () => enabled && setVisualState(0.42, 0.96));
  container.on('pointerup', () => {
    if (!enabled) return;
    setVisualState(0.16, 1);
    onClick();
  });

  return {
    container,
    setEnabled(value: boolean) {
      enabled = value;
      container.setAlpha(value ? 1 : 0.35);
      if (value) container.setInteractive();
      else container.disableInteractive();
    },
    setLabel(value: string) {
      text.setText(value);
    },
  };
}

export interface BarHandle {
  container: Phaser.GameObjects.Container;
  /** @param ratio 0 bis 1 */
  setRatio(ratio: number): void;
  setTint(color: number): void;
}

/** Schlanker Fortschrittsbalken - fuer XP, Timer und Combo-Fenster. */
export function createBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): BarHandle {
  const container = scene.add.container(x, y);

  const track = scene.add
    .image(0, 0, TextureKey.Pixel)
    .setDisplaySize(width, height)
    .setTint(0xffffff)
    .setAlpha(0.12)
    .setOrigin(0, 0.5);

  const fill = scene.add
    .image(0, 0, TextureKey.Pixel)
    .setDisplaySize(width, height)
    .setTint(color)
    .setOrigin(0, 0.5);

  // Leuchtkante auf dem gefuellten Teil - der Balken wirkt dadurch selbst
  // leuchtend statt nur eingefaerbt.
  const shine = scene.add
    .image(0, 0, TextureKey.Glow)
    .setDisplaySize(width, height * 5)
    .setTint(color)
    .setAlpha(0.5)
    .setOrigin(0, 0.5)
    .setBlendMode(Phaser.BlendModes.ADD);

  container.add([track, shine, fill]);

  return {
    container,
    setRatio(ratio: number) {
      const clamped = Phaser.Math.Clamp(ratio, 0, 1);
      // Sichtbar bleiben, solange ueberhaupt Fortschritt da ist.
      const visible = Math.max(clamped * width, clamped > 0 ? 3 : 0);
      fill.setDisplaySize(visible, height);
      shine.setDisplaySize(visible, height * 5);
      shine.setVisible(clamped > 0);
    },
    setTint(value: number) {
      fill.setTint(value);
      shine.setTint(value);
    },
  };
}

/**
 * Abgesetzte Flaeche fuer Menue- und Ergebnisinhalte.
 *
 * Kein eigenes Handle noetig - Panels sind reine Kulisse und werden nach dem
 * Erzeugen nicht mehr angefasst.
 */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: number,
  options: { alpha?: number; radius?: number } = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const radius = options.radius ?? 18;

  const fill = scene.add.graphics();
  fill.fillStyle(Palette.panel, options.alpha ?? 0.55);
  fill.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

  const border = scene.add.graphics();
  border.lineStyle(1.5, accent, 0.35);
  border.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

  container.add([fill, border]);
  return container;
}

/**
 * Vollflaechiger Hintergrund einer Welt.
 *
 * Drei Schichten statt einer Flaeche: Grundverlauf, ein Lichtschein am Horizont
 * und mehrere weiche Farbwolken. Das nimmt dem Hintergrund die Plakatwirkung
 * und laesst die Welt nach Tiefe aussehen, ohne ein einziges Bild zu laden.
 */
export function createWorldBackdrop(
  scene: Phaser.Scene,
  width: number,
  height: number,
  top: number,
  bottom: number,
  accent: number,
): void {
  const base = scene.add.graphics();
  base.fillGradientStyle(top, top, bottom, bottom, 1);
  base.fillRect(0, 0, width, height);
  base.setDepth(Depth.Backdrop);

  // Horizontschein im oberen Drittel - die Lichtquelle der Welt.
  scene.add
    .image(width / 2, height * 0.3, TextureKey.Glow)
    .setDisplaySize(width * 1.9, height * 0.85)
    .setTint(accent)
    .setAlpha(0.3)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Depth.BackdropGlow);

  // Farbwolken in fester Anordnung: bewusst nicht zufaellig, damit jede Welt
  // bei jedem Start gleich aussieht und wiedererkennbar bleibt.
  const clouds: readonly { x: number; y: number; scale: number; alpha: number }[] = [
    { x: 0.18, y: 0.16, scale: 0.9, alpha: 0.22 },
    { x: 0.86, y: 0.34, scale: 1.2, alpha: 0.16 },
    { x: 0.3, y: 0.62, scale: 1.5, alpha: 0.13 },
    { x: 0.76, y: 0.85, scale: 1.1, alpha: 0.18 },
  ];

  for (const cloud of clouds) {
    scene.add
      .image(width * cloud.x, height * cloud.y, TextureKey.Glow)
      .setDisplaySize(width * cloud.scale, width * cloud.scale)
      .setTint(accent)
      .setAlpha(cloud.alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.BackdropClouds);
  }
}

/**
 * Langsam treibende Lichtpunkte in zwei Ebenen.
 *
 * Die hintere Ebene ist kleiner, dunkler und langsamer als die vordere. Diese
 * Geschwindigkeitsdifferenz ist der gesamte Parallax-Effekt - er kostet nichts
 * und gibt dem Spielfeld sofort eine Tiefenachse.
 */
export function createDriftLayers(scene: Phaser.Scene, width: number, height: number): void {
  const layers: readonly {
    count: number;
    scale: number;
    alpha: number;
    speed: number;
    depth: number;
  }[] = [
    { count: 26, scale: 0.22, alpha: 0.25, speed: 6, depth: Depth.DriftFar },
    { count: 14, scale: 0.4, alpha: 0.4, speed: 14, depth: Depth.DriftNear },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const dot = scene.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), TextureKey.Spark)
        .setScale(layer.scale)
        .setAlpha(layer.alpha)
        .setTint(0xffffff)
        .setDepth(layer.depth);

      // Jeder Punkt bekommt eine eigene Dauer - sonst bewegt sich die Ebene
      // als Block und der Effekt kippt ins Kuenstliche.
      scene.tweens.add({
        targets: dot,
        y: dot.y - height,
        duration: (height / layer.speed) * 1000 * Phaser.Math.FloatBetween(0.8, 1.2),
        repeat: -1,
        onRepeat: () => {
          dot.y = height + 20;
          dot.x = Phaser.Math.Between(0, width);
        },
      });

      scene.tweens.add({
        targets: dot,
        alpha: { from: layer.alpha * 0.4, to: layer.alpha },
        duration: Phaser.Math.Between(1400, 3200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }
}

/** Aufsteigende Lichtpartikel - traegt die Stimmung einer Welt. */
export function createAmbientMotes(
  scene: Phaser.Scene,
  width: number,
  height: number,
  accent: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const emitter = scene.add.particles(0, 0, TextureKey.Spark, {
    x: { min: 0, max: width },
    y: height + 24,
    lifespan: 9000,
    speedY: { min: -30, max: -70 },
    speedX: { min: -14, max: 14 },
    scale: { start: 0.55, end: 0 },
    alpha: { start: 0.45, end: 0 },
    quantity: 1,
    frequency: 380,
    tint: accent,
    blendMode: 'ADD',
  });

  emitter.setDepth(Depth.AmbientMotes);
  return emitter;
}

/**
 * Abdunklung der Bildschirmraender.
 *
 * Zieht den Blick zur Bildmitte, wo gespielt wird, und nimmt den hellen
 * Hintergrundwolken an den Raendern die Aufdringlichkeit.
 */
export function createVignette(
  scene: Phaser.Scene,
  width: number,
  height: number,
): Phaser.GameObjects.Image {
  return (
    scene.add
      .image(width / 2, height / 2, TextureKey.Vignette)
      // Ueber die Diagonale ziehen, damit auch die Ecken abgedeckt sind.
      .setDisplaySize(width * 1.5, height * 1.15)
      .setDepth(Depth.Vignette)
  );
}

/** Kurze Partikel-Explosion beim Einsammeln. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12): void {
  const emitter = scene.add.particles(0, 0, TextureKey.Shard, {
    speed: { min: 90, max: 280 },
    scale: { start: 0.7, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { start: 0, end: 220 },
    lifespan: 480,
    tint: color,
    blendMode: 'ADD',
    emitting: false,
  });

  emitter.setDepth(Depth.Effects);
  emitter.explode(count, x, y);
  // Emitter nach Ablauf der Partikel-Lebensdauer aufraeumen.
  scene.time.delayedCall(700, () => emitter.destroy());
}

/**
 * Ausbreitender Ring am Fangort.
 *
 * Traegt die Information "hier ist gerade etwas passiert" weiter nach aussen,
 * als es die Partikel tun - auch dann noch lesbar, wenn der Daumen die Stelle
 * verdeckt.
 */
export function shockwave(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  targetScale = 1,
): void {
  const ring = scene.add
    .image(x, y, TextureKey.Ring)
    .setTint(color)
    .setScale(0.15)
    .setAlpha(0.85)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Depth.Effects);

  scene.tweens.add({
    targets: ring,
    scale: targetScale,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });
}

/** Aufsteigende Punktzahl am Fangort. */
export function floatingScore(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: number,
): void {
  const text = scene.add
    .text(
      x,
      y,
      label,
      textStyle(FontSize.body, `#${color.toString(16).padStart(6, '0')}`, {
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }),
    )
    .setOrigin(0.5)
    .setDepth(Depth.FloatingScore);

  scene.tweens.add({
    targets: text,
    y: y - 80,
    alpha: 0,
    duration: 750,
    ease: 'Quad.Out',
    onComplete: () => text.destroy(),
  });
}
