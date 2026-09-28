import type Phaser from 'phaser';
import { DISTORTION as D } from '@/config/postFx';

const NOISE_KEY = 'distortion-noise';

/**
 * Weiche Rauschtextur fuer den Displacement-Filter.
 *
 * Rot und Gruen tragen die Verschiebung in x und y. Werte um 128 verschieben
 * nicht; ein paar ueberlagerte Sinuswellen statt Zufall geben weiche,
 * wolkige Schlieren, wie heisse Luft sie macht.
 */
function noiseTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(NOISE_KEY)) return NOISE_KEY;
  const size = D.noiseSize;
  const texture = scene.textures.createCanvas(NOISE_KEY, size, size)!;
  const ctx = texture.getContext();
  const pixels = ctx.createImageData(size, size);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const r =
        Math.sin(tau * (u * 3 + v * 1)) * 0.5 +
        Math.sin(tau * (u * 7 - v * 4) + 1.3) * 0.3 +
        Math.sin(tau * (v * 11) + 2.1) * 0.2;
      const g =
        Math.sin(tau * (v * 3 - u * 2)) * 0.5 +
        Math.sin(tau * (v * 6 + u * 5) + 0.7) * 0.3 +
        Math.sin(tau * (u * 9) + 1.9) * 0.2;
      const i = (y * size + x) * 4;
      pixels.data[i] = 128 + r * 120;
      pixels.data[i + 1] = 128 + g * 120;
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  texture.refresh();
  return NOISE_KEY;
}

/**
 * Verzerrt die Kulisse je nach Welt. Getaktet ueber `update(delta)` aus
 * `GameBackdrop` - kein eigener Timer.
 */
export class BackdropDistortion {
  private readonly displacement?: Phaser.Filters.Displacement;
  private readonly barrel?: Phaser.Filters.Barrel;
  private elapsed = 0;

  constructor(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Container,
    private readonly mode: (typeof D.mode)[number],
  ) {
    if (mode === 'none') return;
    target.enableFilters();
    const filters = target.filters!.internal;
    if (mode === 'lens') this.barrel = filters.addBarrel(1);
    else this.displacement = filters.addDisplacement(noiseTexture(scene), 0, 0);
    this.update(0);
  }

  update(deltaMs: number): void {
    this.elapsed += Math.max(0, deltaMs);
    const t = this.elapsed;
    if (this.mode === 'haze' && this.displacement) {
      const phase = (t / D.haze.periodMs) * Math.PI * 2;
      this.displacement.x = D.haze.amount * (0.6 + 0.4 * Math.sin(phase));
      this.displacement.y = D.haze.amount * (0.6 + 0.4 * Math.cos(phase * 0.7));
    } else if (this.mode === 'tremor' && this.displacement) {
      const inPulse = t % D.tremor.everyMs;
      const strength =
        inPulse < D.tremor.durationMs ? Math.sin((inPulse / D.tremor.durationMs) * Math.PI) : 0;
      this.displacement.x = D.tremor.amount * strength;
      this.displacement.y = D.tremor.amount * strength * 0.6;
    } else if (this.mode === 'lens' && this.barrel) {
      const phase = (t / D.lens.periodMs) * Math.PI * 2;
      this.barrel.amount = 1 + D.lens.amount * (0.5 + 0.5 * Math.sin(phase));
    }
  }
}
