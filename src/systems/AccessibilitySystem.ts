import type { RarityId } from '@/config/rarities';

export const MIN_TOUCH_TARGET_PX = 44;

/** Nicht farbgebundene Formmarken fuer Seltenheit und Ergebnislisten. */
export const RARITY_MARKERS: Readonly<Record<RarityId, string>> = {
  poor: '·',
  common: '○',
  uncommon: '+',
  rare: '◆',
  epic: '✦',
  legendary: '★',
};

function mediaMatches(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  );
}

export function prefersReducedMotion(): boolean {
  return mediaMatches('(prefers-reduced-motion: reduce)');
}

export function prefersHighContrast(): boolean {
  return mediaMatches('(prefers-contrast: more)');
}

/** Animationen werden bei reduziertem Motion-Wunsch nicht nur unsichtbar, sondern sofort. */
export function motionDuration(durationMs: number): number {
  return prefersReducedMotion() ? 0 : durationMs;
}

export function ensureTouchTarget(
  width: number,
  height: number,
): { width: number; height: number } {
  return {
    width: Math.max(MIN_TOUCH_TARGET_PX, width),
    height: Math.max(MIN_TOUCH_TARGET_PX, height),
  };
}

export function rarityMarker(rarityId: RarityId): string {
  return RARITY_MARKERS[rarityId];
}

export function accessibleRarityLabel(rarityId: RarityId, label: string): string {
  return `${rarityMarker(rarityId)} ${label}`;
}
