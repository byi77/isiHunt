import Phaser from 'phaser';
import { STAR_DUST as S } from '@/config/postFx';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { AtmosphereTexture, createAtmosphereTextures } from './worldAtmosphere';

/** Reproduzierbarer Zufall: jede Welt beginnt mit demselben Sternbild. */
function seeded(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Legt eine Schicht funkelnden Sternenstaubs an.
 *
 * Alle Sterne landen einmal im GPU-Puffer und werden danach nie wieder
 * angefasst - Aendern waere teuer (siehe `SpriteGPULayer`). Das Funkeln ist
 * eine Deckkraft-Animation je Stern mit eigener Dauer und Verzoegerung; bei
 * reduzierter Bewegung steht es still.
 */
export function createStarDust(
  scene: Phaser.Scene,
  width: number,
  height: number,
  tint: number,
  seed: number,
): Phaser.GameObjects.SpriteGPULayer {
  createAtmosphereTextures(scene);
  const rand = seeded(seed + 101);
  const layer = scene.add
    .spriteGPULayer(AtmosphereTexture.Soft, S.count)
    .setBlendMode(Phaser.BlendModes.ADD);
  const still = prefersReducedMotion();
  const between = (range: { min: number; max: number }): number =>
    range.min + rand() * (range.max - range.min);
  // Ein Objekt fuer alle Sterne - so empfiehlt es `SpriteGPULayer` selbst.
  const member: Phaser.Types.GameObjects.SpriteGPULayer.Member = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    originX: 0.5,
    originY: 0.5,
    tintMode: Phaser.TintModes.MULTIPLY,
    creationTime: 0,
    scrollFactorX: 1,
    scrollFactorY: 1,
    frame: 0,
    tintBlend: 1,
    tintBottomLeft: tint,
    tintTopLeft: tint,
    tintBottomRight: tint,
    tintTopRight: tint,
    alphaBottomLeft: 1,
    alphaTopLeft: 1,
    alphaBottomRight: 1,
    alphaTopRight: 1,
    alpha: 1,
  };
  for (let i = 0; i < S.count; i++) {
    const size = between(S.scale);
    const peak = between(S.alpha);
    member.x = rand() * (width + 40) - 20;
    member.y = rand() * (height + 40) - 20;
    member.scaleX = size;
    member.scaleY = size;
    member.alpha = still
      ? peak
      : {
          base: peak * 0.25,
          amplitude: peak * 0.75,
          duration: between(S.twinkleMs),
          delay: rand() * S.twinkleMs.max,
          ease: 'Sine.easeInOut',
        };
    layer.addMember(member);
  }
  return layer;
}
