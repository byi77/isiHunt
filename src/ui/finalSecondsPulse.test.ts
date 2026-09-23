import { describe, expect, it } from 'vitest';

import { FINAL_SECONDS } from '@/config/effectVisuals';
import { finalSecondsAlpha } from './finalSecondsPulse';

describe('Warnrand der Schlussphase', () => {
  it('bleibt ausserhalb der Schlussphase und nach dem Ende unsichtbar', () => {
    expect(finalSecondsAlpha(FINAL_SECONDS.thresholdMs + 1, false)).toBe(0);
    expect(finalSecondsAlpha(0, false)).toBe(0);
  });

  it('beginnt genau mit der roten Zeitanzeige des HUD', () => {
    // Das HUD schlaegt bei ceil(ms / 1000) <= 10 um, also bei 10000 ms.
    expect(finalSecondsAlpha(FINAL_SECONDS.thresholdMs, false)).toBeGreaterThan(0);
  });

  it('schlaegt beim Sekundenwechsel an und klingt bis zum naechsten ab', () => {
    const peak = finalSecondsAlpha(8999, false);
    const middle = finalSecondsAlpha(8500, false);
    const late = finalSecondsAlpha(8001, false);
    expect(peak).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
    expect(late).toBeGreaterThanOrEqual(FINAL_SECONDS.baseAlpha);
    expect(peak).toBeLessThanOrEqual(FINAL_SECONDS.baseAlpha + FINAL_SECONDS.pulseAlpha);
  });

  it('steht bei reduzierter Bewegung still', () => {
    expect(finalSecondsAlpha(8999, true)).toBe(FINAL_SECONDS.baseAlpha);
    expect(finalSecondsAlpha(8001, true)).toBe(FINAL_SECONDS.baseAlpha);
  });
});
