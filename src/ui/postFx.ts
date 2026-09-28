import Phaser from 'phaser';
import { BLOOM_BY_QUALITY, BLOOM_WORLD_STRENGTH } from '@/config/postFx';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';

/**
 * Legt Bloom auf eine Kamera - je nach Effektstufe und Welt.
 *
 * Auf der Kamera statt auf einzelnen Objekten: Bloom braucht den ganzen
 * Bildinhalt, um Licht in die Umgebung zu tragen, und ein Filter je Relikt
 * waere ein eigener Zwischenpuffer je Objekt. Die HUD-Szene hat eine eigene
 * Kamera und bleibt davon unberuehrt, Zahlen bleiben scharf.
 *
 * @returns Aufraeumfunktion, oder `null`, wenn die Stufe kein Bloom vorsieht.
 */
export function applyBloom(
  camera: Phaser.Cameras.Scene2D.Camera,
  spaceVariant: number,
): (() => void) | null {
  const quality = EffectsQualitySystem.current();
  if (quality === 'reduced') return null;
  const base = BLOOM_BY_QUALITY[quality];
  const strength = BLOOM_WORLD_STRENGTH[spaceVariant] ?? 1;
  const [bloom] = Phaser.Actions.AddEffectBloom(camera, {
    threshold: base.threshold,
    blurRadius: base.blurRadius,
    blurSteps: base.blurSteps,
    blurQuality: base.blurQuality,
    blendAmount: base.blendAmount * strength,
  });
  return () => bloom?.parallelFilters.destroy();
}
