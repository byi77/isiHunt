/** Besitz, Kategorien und Shop-Hinweise fuer alle Kosmetiktypen. */

import { SHIP_AURAS, SHIP_COLORS, SHIP_SHAPES } from '@/config/shop';
import type { SaveData } from '@/types';

export type CosmeticCategory = 'shapes' | 'colors' | 'auras';

export interface CosmeticCatalogEntry {
  readonly id: string;
  readonly name: string;
}

export interface CosmeticCollectionSummary {
  readonly category: CosmeticCategory;
  readonly label: string;
  readonly owned: number;
  readonly total: number;
  readonly ownedIds: readonly string[];
  readonly newIds: readonly string[];
  readonly lastPurchasedId: string | null;
}

const CATEGORY_LABELS: Readonly<Record<CosmeticCategory, string>> = {
  shapes: 'FORMEN',
  colors: 'FARBEN',
  auras: 'AUREN',
};

export function cosmeticCategoryLabel(category: CosmeticCategory): string {
  return CATEGORY_LABELS[category];
}

export function cosmeticKey(category: CosmeticCategory, id: string): string {
  return `${category}:${id}`;
}

export function getCosmeticCatalog(category: CosmeticCategory): readonly CosmeticCatalogEntry[] {
  if (category === 'shapes') return SHIP_SHAPES;
  if (category === 'colors') return SHIP_COLORS;
  return SHIP_AURAS;
}

function ownedIds(save: SaveData, category: CosmeticCategory): readonly string[] {
  if (category === 'shapes') return save.ownedShipShapes;
  if (category === 'colors') return save.ownedShipColors;
  return save.ownedShipAuras;
}

export function getCosmeticCollectionSummary(
  save: SaveData,
  category: CosmeticCategory,
): CosmeticCollectionSummary {
  const catalog = getCosmeticCatalog(category);
  const owned = new Set(ownedIds(save, category));
  const prefix = `${category}:`;
  const newIds = (save.newCosmeticIds ?? [])
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .filter((id) => catalog.some((entry) => entry.id === id));
  const lastPurchasedId =
    save.lastPurchasedCosmetic?.category === category ? save.lastPurchasedCosmetic.id : null;

  return {
    category,
    label: cosmeticCategoryLabel(category),
    owned: catalog.filter((entry) => owned.has(entry.id)).length,
    total: catalog.length,
    ownedIds: catalog.filter((entry) => owned.has(entry.id)).map((entry) => entry.id),
    newIds,
    lastPurchasedId,
  };
}

export function getAllCosmeticCollectionSummaries(
  save: SaveData,
): readonly CosmeticCollectionSummary[] {
  return (['shapes', 'colors', 'auras'] as const).map((category) =>
    getCosmeticCollectionSummary(save, category),
  );
}

export function cosmeticStatusText(
  save: SaveData,
  category: CosmeticCategory,
  id: string,
  equipped: boolean,
): string {
  if (equipped) return 'GETRAGEN';
  if (save.lastPurchasedCosmetic?.category === category && save.lastPurchasedCosmetic.id === id) {
    return 'ZULETZT GEKAUFT';
  }
  if ((save.newCosmeticIds ?? []).includes(cosmeticKey(category, id))) return 'NEU';
  if (ownedIds(save, category).includes(id)) return 'IM BESITZ';
  return 'NICHT IM BESITZ';
}

export function getShopCollectionSummaryText(save: SaveData): {
  counts: string;
  activity: string;
} {
  const summaries = getAllCosmeticCollectionSummaries(save);
  const counts = summaries
    .map((summary) => `${summary.label} ${summary.owned}/${summary.total}`)
    .join('  ·  ');
  const newCount = summaries.reduce((sum, summary) => sum + summary.newIds.length, 0);
  const last = save.lastPurchasedCosmetic
    ? getCosmeticCatalog(save.lastPurchasedCosmetic.category).find(
        (entry) => entry.id === save.lastPurchasedCosmetic?.id,
      )
    : undefined;
  const activity = `NEU SEIT BESUCH: ${newCount}  ·  ZULETZT GEKAUFT: ${last?.name ?? '—'}`;
  return { counts, activity };
}
