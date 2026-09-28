import Phaser from 'phaser';
import { BLOOM_BY_QUALITY, BLOOM_WORLD_STRENGTH, GRADING } from '@/config/postFx';
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

/**
 * Farbstimmung je Welt und kurzes Entsaettigen beim Hindernistreffer.
 *
 * Ein einziger ColorMatrix-Filter auf der Kamera; die Matrix wird nur neu
 * berechnet, solange ein Treffer abklingt.
 */
export class CameraGrading {
  private readonly filter: Phaser.Filters.ColorMatrix;
  private readonly saturation: number;
  private readonly contrast: number;
  private hitRestMs = 0;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, spaceVariant: number) {
    this.saturation = GRADING.saturation[spaceVariant] ?? 0;
    this.contrast = GRADING.contrast[spaceVariant] ?? 0;
    this.filter = camera.filters.external.addColorMatrix();
    this.apply(0);
  }

  hit(): void {
    this.hitRestMs = GRADING.hitMs;
    this.apply(1);
  }

  update(deltaMs: number): void {
    if (this.hitRestMs <= 0) return;
    this.hitRestMs = Math.max(0, this.hitRestMs - Math.max(0, deltaMs));
    this.apply(this.hitRestMs / GRADING.hitMs);
  }

  destroy(): void {
    this.filter.destroy();
  }

  /** @param hit Treffer-Anteil 1 (gerade getroffen) bis 0 (abgeklungen). */
  private apply(hit: number): void {
    const matrix = this.filter.colorMatrix;
    matrix.reset();
    matrix.saturate(this.saturation - hit * GRADING.hitDesaturate, true);
    matrix.contrast(this.contrast, true);
  }
}
