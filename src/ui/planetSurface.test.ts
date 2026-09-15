import { describe, expect, it } from 'vitest';
import { WORLD_VISUALS } from '@/config/worldVisuals';
import { planetFrame } from './planetSurface';

describe('Kugeloberfläche', () => {
  it('schließt die Rotationsnaht für jede Welt und bleibt innerhalb der Kugel', () => {
    for (const visual of WORLD_VISUALS) {
      const first = planetFrame(24, 0, visual);
      const last = planetFrame(24, Math.PI * 2, visual);
      expect(last).toEqual(first);
      expect(first[3]).toBe(0);
      expect(first[(12 * 24 + 12) * 4 + 3]).toBe(255);
    }
  });
  it('verschiebt Oberfläche, nicht die Beleuchtungsrichtung', () => {
    const frame = planetFrame(48, 0, WORLD_VISUALS[1]);
    const rotated = planetFrame(48, 1, WORLD_VISUALS[1]);
    expect(rotated).not.toEqual(frame);
    const brightness = (data: Uint8ClampedArray, x: number, y: number) => {
      const i = (y * 48 + x) * 4;
      return data[i]! + data[i + 1]! + data[i + 2]!;
    };
    for (const data of [frame, rotated])
      expect(brightness(data, 14, 14)).toBeGreaterThan(brightness(data, 34, 34));
  });
});
