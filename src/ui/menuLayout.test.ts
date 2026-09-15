import { describe, expect, it } from 'vitest';

import { calculateMenuLayout } from './menuLayout';

describe('Menü in tatsächlichen Bildschirm-Pixeln', () => {
  for (const [width, height] of [
    [301.5, 536],
    [360, 640],
    [390, 812],
    [430, 900],
    [560, 996],
  ]) {
    for (const install of [false, true]) {
      it(`${width} × ${height}, Installationshinweis ${install}`, () => {
        const layout = calculateMenuLayout(width!, height!, 20, install);
        const scale = 1 / layout.unit;
        const rows = [
          [layout.primaryY, layout.primaryHeight],
          [layout.secondaryY, layout.rowHeight],
          [layout.tertiaryY, layout.rowHeight],
          [layout.settingsY, layout.rowHeight],
        ];
        let previousBottom = layout.worldBottom;
        for (const [y, h] of rows) {
          expect(h! * scale).toBeGreaterThanOrEqual(44);
          expect(y! - h! / 2).toBeGreaterThan(previousBottom);
          previousBottom = y! + h! / 2;
        }
        expect(previousBottom * scale).toBeLessThan(height! - 20);
        expect(layout.profileTop + layout.profileHeight).toBeLessThan(layout.worldTop);
        expect(layout.planetY - layout.planetSize / 2).toBeGreaterThan(
          layout.profileTop + layout.profileHeight,
        );
        expect(layout.shipY + layout.shipSize * 0.95).toBeLessThan(
          layout.worldTitleY - 22 * layout.unit,
        );
      });
    }
  }
});
