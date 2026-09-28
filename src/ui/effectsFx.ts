/**
 * Leuchtshader und kurze Zierde, die an der Effektstufe haengen.
 *
 * Seit Phaser 4 laeuft das Spiel nur noch unter WebGL (ADR-0035); Leuchten ist
 * ein Filter. Die Effektstufe bleibt die einzige Bedingung.
 */

import Phaser from 'phaser';

import { GLOW_FX, RARE_ARRIVAL, RARE_SPAWN_WARNING } from '@/config/effectVisuals';
import { RELIC_SHINE, SHIP_SHADOW } from '@/config/postFx';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';

/**
 * Legt einen Leuchtshader um ein Bild - nur bei voller Effektstufe.
 *
 * Bewusst nur fuer wenige Objekte gleichzeitig (Figur, epische und
 * legendaere Relikte): Jeder Filter rendert sein Objekt in einen eigenen
 * Zwischenpuffer. Ein Shader je Relikt waere bei zwanzig Relikten zwanzig
 * zusaetzliche Durchgaenge pro Frame.
 */
export function applyGlow(
  image: Phaser.GameObjects.Image,
  color: number,
  outerStrength: number,
  innerStrength: number,
): Phaser.Filters.Glow | null {
  if (!EffectsQualitySystem.atLeast('medium')) return null;
  image.enableFilters();
  const glow = image.filters!.internal.addGlow(
    color,
    outerStrength,
    innerStrength,
    1,
    false,
    GLOW_FX.quality,
    GLOW_FX.distance,
  );
  // Ohne Polster schneidet der Zwischenpuffer den Schein an der Bildkante ab.
  glow.setPaddingOverride(null);
  return glow;
}

/**
 * Ein kurzer Lichtriss an der Stelle, an der ein seltenes Relikt erscheint.
 *
 * Er laeuft gleichzeitig mit dem Aufspringen des Relikts. Der separate
 * Vorblitz wird vorher aus der fertigen Spawn-Anfrage abgespielt; die
 * Zufallsfolge der Duellanten bleibt dabei gleich.
 */
export function playRareArrival(scene: Phaser.Scene, x: number, y: number, color: number): void {
  if (prefersReducedMotion() || !EffectsQualitySystem.atLeast('medium')) return;
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

/** Kleiner Stern am bereits festgelegten Spawnort; bleibt auch ohne Animation lesbar. */
export function playRareSpawnWarning(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  durationMs: number,
): () => void {
  const visual = RARE_SPAWN_WARNING;
  const star = scene.add
    .star(x, y, 5, visual.starInnerPx, visual.starOuterPx, color)
    .setDepth(Depth.Effects)
    .setBlendMode(Phaser.BlendModes.ADD);
  const parts: Phaser.GameObjects.GameObject[] = [star];

  if (!prefersReducedMotion()) {
    const ring = scene.add
      .circle(x, y, visual.ringRadiusPx)
      .setStrokeStyle(1.5, color, 0.8)
      .setDepth(Depth.Effects)
      .setBlendMode(Phaser.BlendModes.ADD);
    parts.push(ring);
    scene.tweens.add({
      targets: star,
      scale: visual.starBurstScale,
      alpha: 0.65,
      duration: Math.max(1, durationMs),
      ease: 'Cubic.Out',
    });
    scene.tweens.add({
      targets: ring,
      scale: visual.ringBurstScale,
      alpha: 0,
      duration: Math.max(1, durationMs),
      ease: 'Cubic.Out',
    });

    if (EffectsQualitySystem.atLeast('medium')) {
      for (let index = 0; index < 4; index += 1) {
        const angle = (index * Math.PI) / 2;
        const shard = scene.add
          .circle(x, y, visual.shardRadiusPx, color)
          .setDepth(Depth.Effects)
          .setBlendMode(Phaser.BlendModes.ADD);
        parts.push(shard);
        scene.tweens.add({
          targets: shard,
          x: x + Math.cos(angle) * visual.shardDistancePx,
          y: y + Math.sin(angle) * visual.shardDistancePx,
          alpha: 0,
          duration: Math.max(1, durationMs),
          ease: 'Cubic.Out',
        });
      }
    }
  }

  return () => {
    scene.tweens.killTweensOf(parts);
    for (const part of parts) part.destroy();
  };
}

/**
 * Laesst einen Glanzstreif ueber ein Bild wandern - nur auf der vollen Stufe.
 * Der Streif raeumt sich mit dem Bild selbst ab (Tween und Textur).
 */
export function applyShine(image: Phaser.GameObjects.Image): void {
  if (!EffectsQualitySystem.isFull() || prefersReducedMotion()) return;
  Phaser.Actions.AddEffectShine(image, {
    radius: RELIC_SHINE.radius,
    duration: RELIC_SHINE.durationMs,
    repeatDelay: RELIC_SHINE.repeatDelayMs,
    colorFactor: [...RELIC_SHINE.colorFactor],
  });
}

/** Weicher Schatten unter einem Bild - nur auf der vollen Stufe. */
export function applyDropShadow(image: Phaser.GameObjects.Image): void {
  if (!EffectsQualitySystem.isFull()) return;
  const s = SHIP_SHADOW;
  image.enableFilters();
  image
    .filters!.internal.addShadow(s.x, s.y, s.decay, s.power, s.color, s.samples, s.intensity)
    .setPaddingOverride(null);
}
