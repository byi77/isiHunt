/**
 * Leuchtshader und kurze Zierde, die an der Effektstufe haengen.
 *
 * Phasers `preFX` gibt es nur unter WebGL; im Canvas-Rueckfall ist das Feld
 * leer. Jeder Aufruf hier prueft deshalb selbst und gibt `null` zurueck,
 * statt dass der Aufrufer den Renderer kennen muss.
 */

import Phaser from 'phaser';

import { GLOW_FX, RARE_ARRIVAL } from '@/config/effectVisuals';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';

/**
 * Legt einen Leuchtshader um ein Bild - nur bei voller Effektstufe.
 *
 * Bewusst nur fuer wenige Objekte gleichzeitig (Figur, epische und
 * legendaere Relikte): Jeder `preFX` rendert sein Objekt in einen eigenen
 * Zwischenpuffer. Ein Shader je Relikt waere bei zwanzig Relikten zwanzig
 * zusaetzliche Durchgaenge pro Frame.
 */
export function applyGlow(
  image: Phaser.GameObjects.Image,
  color: number,
  outerStrength: number,
  innerStrength: number,
): Phaser.FX.Glow | null {
  if (!EffectsQualitySystem.isFull() || !image.preFX) return null;
  image.preFX.padding = GLOW_FX.distance;
  return image.preFX.addGlow(
    color,
    outerStrength,
    innerStrength,
    false,
    GLOW_FX.quality,
    GLOW_FX.distance,
  );
}

/**
 * Ein kurzer Lichtriss an der Stelle, an der ein seltenes Relikt erscheint.
 *
 * Er laeuft gleichzeitig mit dem Aufspringen des Relikts, nicht davor: Eine
 * Vorankuendigung mit Verzoegerung haette den Spawnzeitpunkt verschoben, und
 * im Duell muessen beide Geraete dieselbe Abfolge sehen.
 */
export function playRareArrival(scene: Phaser.Scene, x: number, y: number, color: number): void {
  if (prefersReducedMotion() || !EffectsQualitySystem.isFull()) return;
  const a = RARE_ARRIVAL;

  const rift = scene.add
    .image(x, y, TextureKey.Glow)
    .setTint(color)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Depth.Effects);
  rift.setScale(a.riftWidthPx / rift.width, 0);
  scene.tweens.chain({
    targets: rift,
    tweens: [
      { scaleY: a.riftHeightPx / rift.height, duration: a.riftMs, ease: 'Cubic.Out' },
      { scaleX: 0, alpha: 0, delay: a.holdMs, duration: a.closeMs, ease: 'Cubic.In' },
    ],
    onComplete: () => rift.destroy(),
  });

  const ring = scene.add
    .image(x, y, TextureKey.Ring)
    .setTint(color)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Depth.Effects)
    .setScale(a.ringFromScale)
    .setAlpha(a.ringAlpha);
  scene.tweens.add({
    targets: ring,
    scale: a.ringToScale,
    alpha: 0,
    duration: a.ringMs,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });
}
