/**
 * Wiederverwendbare UI-Bausteine.
 *
 * Bewusst Funktionen statt Klassen: die Widgets haben keinen eigenen Zustand,
 * sie bauen nur GameObjects zusammen. Wer Zustand braucht (z. B. Fortschritts-
 * balken), bekommt ein kleines Handle-Objekt mit `set*`-Methoden zurueck.
 */

import Phaser from 'phaser';

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

  container.add([bg, border, text]);
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

  container.add([track, fill]);

  return {
    container,
    setRatio(ratio: number) {
      const clamped = Phaser.Math.Clamp(ratio, 0, 1);
      // Sichtbar bleiben, solange ueberhaupt Fortschritt da ist.
      fill.setDisplaySize(Math.max(clamped * width, clamped > 0 ? 3 : 0), height);
    },
    setTint(value: number) {
      fill.setTint(value);
    },
  };
}

/** Vollflaechiger Hintergrundverlauf einer Welt. */
export function createWorldBackdrop(
  scene: Phaser.Scene,
  width: number,
  height: number,
  top: number,
  bottom: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, width, height);
  g.setDepth(-100);
  return g;
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

  emitter.setDepth(-90);
  return emitter;
}

/** Kurze Partikel-Explosion beim Einsammeln. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12): void {
  const emitter = scene.add.particles(0, 0, TextureKey.Spark, {
    speed: { min: 90, max: 280 },
    scale: { start: 0.7, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 480,
    tint: color,
    blendMode: 'ADD',
    emitting: false,
  });

  emitter.setDepth(60);
  emitter.explode(count, x, y);
  // Emitter nach Ablauf der Partikel-Lebensdauer aufraeumen.
  scene.time.delayedCall(700, () => emitter.destroy());
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
      textStyle(FontSize.body, `#${color.toString(16).padStart(6, '0')}`, { fontStyle: 'bold' }),
    )
    .setOrigin(0.5)
    .setDepth(70);

  scene.tweens.add({
    targets: text,
    y: y - 80,
    alpha: 0,
    duration: 750,
    ease: 'Quad.Out',
    onComplete: () => text.destroy(),
  });
}
