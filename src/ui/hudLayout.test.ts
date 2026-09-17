import { describe, expect, it } from 'vitest';
import { calculateHudLayout } from './hudLayout';

describe('HUD in screen pixels', () => {
  for (const [width, height] of [
    [301.5, 536],
    [390, 812],
    [430, 900],
    [720, 1280],
  ]) {
    it(`keeps columns and touch targets separate at ${width} × ${height}`, () => {
      const l = calculateHudLayout(width!, height!, 3, 20);
      expect(l.pauseSize / l.unit).toBe(44);
      expect((l.pauseY + l.pauseSize / 2) / l.unit).toBeCloseTo(height! - 28, 8);
      expect(l.scoreX + l.columnWidth / 2).toBeLessThan(l.timeX - l.columnWidth / 2);
      expect(l.timeX + l.columnWidth / 2).toBeLessThan(l.comboX - l.columnWidth / 2);
      expect(l.rowY(0)).toBeGreaterThan(72 * l.unit);
      expect(l.rowY(2) + 13 * l.unit).toBeLessThan(l.headerHeight);
    });
  }
});
