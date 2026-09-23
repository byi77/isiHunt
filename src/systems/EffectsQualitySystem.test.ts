import { beforeEach, describe, expect, it } from 'vitest';

import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';
import * as SaveSystem from '@/systems/SaveSystem';

describe('EffectsQualitySystem', () => {
  beforeEach(() => {
    SaveSystem.reset();
  });

  it('startet mit vollen Effekten', () => {
    expect(EffectsQualitySystem.current()).toBe('full');
    expect(EffectsQualitySystem.isFull()).toBe(true);
  });

  it('merkt sich die sparsame Stufe im Spielstand', () => {
    EffectsQualitySystem.setQuality('reduced');
    expect(EffectsQualitySystem.isFull()).toBe(false);
    expect(SaveSystem.load().effectsQuality).toBe('reduced');
  });

  it('fuellt einen alten Spielstand ohne Feld und verwirft unbekannte Werte', () => {
    const { effectsQuality: _dropped, ...legacy } = SaveSystem.createDefaultSave();
    expect(SaveSystem.normalizeForComparison(legacy).effectsQuality).toBe('full');
    expect(
      SaveSystem.normalizeForComparison({ ...legacy, effectsQuality: 'ultra' as never })
        .effectsQuality,
    ).toBe('full');
    expect(
      SaveSystem.normalizeForComparison({ ...legacy, effectsQuality: 'reduced' }).effectsQuality,
    ).toBe('reduced');
  });
});
