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
    expect(EffectsQualitySystem.wasLoweredAutomatically()).toBe(false);
  });

  it('merkt sich die sparsame Stufe im Spielstand', () => {
    EffectsQualitySystem.setQuality('reduced');
    expect(EffectsQualitySystem.isFull()).toBe(false);
    expect(SaveSystem.load().effectsQuality).toBe('reduced');
  });

  it('ordnet die Stufen fuer atLeast', () => {
    EffectsQualitySystem.setQuality('medium');
    expect(EffectsQualitySystem.atLeast('reduced')).toBe(true);
    expect(EffectsQualitySystem.atLeast('medium')).toBe(true);
    expect(EffectsQualitySystem.atLeast('full')).toBe(false);
    expect(EffectsQualitySystem.isFull()).toBe(false);
  });

  it('schaltet von Hand reihum: voll, mittel, sparsam, voll', () => {
    expect(EffectsQualitySystem.nextManual('full')).toBe('medium');
    expect(EffectsQualitySystem.nextManual('medium')).toBe('reduced');
    expect(EffectsQualitySystem.nextManual('reduced')).toBe('full');
  });

  it('senkt automatisch um genau eine Stufe und merkt sich das', () => {
    expect(EffectsQualitySystem.lowerAutomatically()).toBe(true);
    expect(EffectsQualitySystem.current()).toBe('medium');
    expect(EffectsQualitySystem.wasLoweredAutomatically()).toBe(true);
    expect(EffectsQualitySystem.lowerAutomatically()).toBe(true);
    expect(EffectsQualitySystem.current()).toBe('reduced');
    // Unter sparsam geht es nicht weiter.
    expect(EffectsQualitySystem.lowerAutomatically()).toBe(false);
    expect(EffectsQualitySystem.current()).toBe('reduced');
  });

  it('hebt den Hinweis auf, sobald man von Hand waehlt', () => {
    EffectsQualitySystem.lowerAutomatically();
    EffectsQualitySystem.setQuality('full');
    expect(EffectsQualitySystem.wasLoweredAutomatically()).toBe(false);
  });

  it('fuellt einen alten Spielstand ohne Feld und verwirft unbekannte Werte', () => {
    const {
      effectsQuality: _dropped,
      effectsQualityAutoLowered: _alsoDropped,
      ...legacy
    } = SaveSystem.createDefaultSave();
    const filled = SaveSystem.normalizeForComparison(legacy);
    expect(filled.effectsQuality).toBe('full');
    expect(filled.effectsQualityAutoLowered).toBe(false);
    expect(
      SaveSystem.normalizeForComparison({ ...legacy, effectsQuality: 'ultra' as never })
        .effectsQuality,
    ).toBe('full');
    expect(
      SaveSystem.normalizeForComparison({ ...legacy, effectsQuality: 'reduced' }).effectsQuality,
    ).toBe('reduced');
    expect(
      SaveSystem.normalizeForComparison({ ...legacy, effectsQuality: 'medium' }).effectsQuality,
    ).toBe('medium');
  });
});
