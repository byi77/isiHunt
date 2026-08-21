import { describe, expect, it } from 'vitest';

import {
  cosmeticStatusText,
  getCosmeticCollectionSummary,
  getShopCollectionSummaryText,
} from '@/systems/CosmeticCollectionSystem';
import * as SaveSystem from '@/systems/SaveSystem';

describe('CosmeticCollectionSystem', () => {
  it('liefert getrennte Besitzzaehler fuer Formen, Farben und Auren', () => {
    const save = SaveSystem.createDefaultSave();

    const shapes = getCosmeticCollectionSummary(save, 'shapes');
    const colors = getCosmeticCollectionSummary(save, 'colors');
    const auras = getCosmeticCollectionSummary(save, 'auras');

    expect(shapes.owned).toBe(1);
    expect(colors.owned).toBe(1);
    expect(auras.owned).toBe(1);
    expect(shapes.total).toBeGreaterThan(1);
    expect(colors.total).toBeGreaterThan(1);
    expect(auras.total).toBeGreaterThan(1);
  });

  it('merkt einen Kauf als neu und zuletzt gekauft, bis der Reiter besucht wurde', () => {
    SaveSystem.reset();
    SaveSystem.recordCosmeticPurchase('auras', 'prismaflut');
    let save = SaveSystem.load();

    expect(save.newCosmeticIds).toContain('auras:prismaflut');
    expect(cosmeticStatusText(save, 'auras', 'prismaflut', false)).toBe('ZULETZT GEKAUFT');
    expect(getShopCollectionSummaryText(save).activity).toContain('ZULETZT GEKAUFT');

    save = SaveSystem.markCosmeticsSeen('auras');
    expect(save.newCosmeticIds).not.toContain('auras:prismaflut');
    expect(save.lastPurchasedCosmetic).toEqual({ category: 'auras', id: 'prismaflut' });
  });
});
