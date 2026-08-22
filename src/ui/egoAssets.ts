/**
 * Austauschbare Asset-Schicht fuer die sichtbare Schiffsidentitaet.
 *
 * Der Shop speichert stabile IDs, nie Dateinamen. Provider koennen dadurch
 * eigene Rastergrafiken, externe Packs oder spaeter eine 3D-Ansicht liefern,
 * ohne SaveSystem, Shop-Logik oder Progression zu veraendern.
 */

export const EGO_ASSET_KEY = {
  cc0Scout: 'asset-ego-cc0-scout',
  cc0Flame: [
    'asset-ego-aura-flame-01',
    'asset-ego-aura-flame-02',
    'asset-ego-aura-flame-03',
    'asset-ego-aura-flame-04',
    'asset-ego-aura-flame-05',
    'asset-ego-aura-flame-06',
  ] as const,
} as const;

export interface EgoAuraAsset {
  readonly id: string;
  readonly frameTextureKeys: readonly string[];
  readonly frameDurationMs: number;
  /** 512px-Kenney-Partikel auf eine spielbare Aura-Groesse bringen. */
  readonly scaleMultiplier: number;
  /** Kleinere Variante fuer die 230px-Shopvorschau. */
  readonly previewScaleMultiplier: number;
}

export interface EgoAssetProvider {
  readonly id: string;
  getShapeTextureKey(shapeId: string): string | undefined;
  getAuraAsset(assetId: string): EgoAuraAsset | undefined;
}

class EgoAssetRegistry {
  private readonly providers: EgoAssetProvider[] = [];

  register(provider: EgoAssetProvider): void {
    this.unregister(provider.id);
    this.providers.unshift(provider);
  }

  unregister(id: string): void {
    for (let i = this.providers.length - 1; i >= 0; i--) {
      if (this.providers[i]?.id === id) this.providers.splice(i, 1);
    }
  }

  shapeTextureKey(shapeId: string): string | undefined {
    for (const provider of this.providers) {
      const key = provider.getShapeTextureKey(shapeId);
      if (key !== undefined) return key;
    }
    return undefined;
  }

  auraAsset(assetId: string | undefined): EgoAuraAsset | undefined {
    if (assetId === undefined) return undefined;
    for (const provider of this.providers) {
      const asset = provider.getAuraAsset(assetId);
      if (asset !== undefined) return asset;
    }
    return undefined;
  }

  providerIds(): readonly string[] {
    return this.providers.map((provider) => provider.id);
  }
}

export const egoAssetRegistry = new EgoAssetRegistry();

/**
 * Provider fuer die beiden recherchierten CC0-Piloten. Die Schiffsform ist
 * die erste Sprite-Sheet-Frame; die Flammenframes werden als Aura-Overlay
 * abgespielt. Beide Eintraege sind bewusst nur ueber stabile IDs verbunden.
 */
egoAssetRegistry.register({
  id: 'cc0-pilot-assets',
  getShapeTextureKey: (shapeId) => (shapeId === 'cc0-scout' ? EGO_ASSET_KEY.cc0Scout : undefined),
  getAuraAsset: (assetId) =>
    assetId === 'cc0-kenney-flame'
      ? {
          id: assetId,
          frameTextureKeys: EGO_ASSET_KEY.cc0Flame,
          frameDurationMs: 90,
          scaleMultiplier: 0.34,
          previewScaleMultiplier: 0.175,
        }
      : undefined,
});

export function textureKeyForEgoShape(shapeId: string): string | undefined {
  return egoAssetRegistry.shapeTextureKey(shapeId);
}

export function auraAssetForId(assetId: string | undefined): EgoAuraAsset | undefined {
  return egoAssetRegistry.auraAsset(assetId);
}

export function egoProviderIds(): readonly string[] {
  return egoAssetRegistry.providerIds();
}
