import { describe, expect, it } from 'vitest';

import { SHIP_SHAPES, getShipAura } from '@/config/shop';
import {
  auraAssetForId,
  egoProviderIds,
  textureKeyForEgoShape,
  threeDAssetForId,
} from '@/ui/egoAssets';

describe('Ego-Asset-Registry', () => {
  it('haelt den recherchierten 2D-Piloten ueber eine stabile Shop-ID erreichbar', () => {
    const scout = SHIP_SHAPES.find((shape) => shape.id === 'cc0-scout');

    expect(scout?.assetId).toBe('cc0-scout');
    expect(textureKeyForEgoShape('cc0-scout')).toBe('asset-ego-cc0-scout');
    expect(egoProviderIds()).toContain('cc0-pilot-assets');
  });

  it('liefert die sechs austauschbaren CC0-Aura-Frames', () => {
    const aura = getShipAura('prismasurge');
    const asset = auraAssetForId(aura.assetId);

    expect(asset?.frameTextureKeys).toHaveLength(6);
    expect(asset?.frameDurationMs).toBeGreaterThan(0);
    expect(asset?.scaleMultiplier).toBeGreaterThan(0);
  });

  it('faellt fuer unbekannte Designs auf den prozeduralen Provider zurueck', () => {
    expect(textureKeyForEgoShape('not-a-real-ship')).toBeUndefined();
    expect(auraAssetForId('not-a-real-aura')).toBeUndefined();
  });

  it('registriert alle neun CC0-3D-Modelle mit einem sicheren OBJ-Fallback', () => {
    for (let number = 1; number <= 9; number++) {
      const asset = threeDAssetForId(`cc0-3d-ship-${number}`);
      expect(asset?.format).toBe('obj');
      expect(asset?.modelUrl).toContain(`/ship${number}.obj`);
    }
    expect(egoProviderIds()).toContain('cc0-3d-spaceships');
  });
});
