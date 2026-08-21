import { describe, expect, it } from 'vitest';

import { MAX_LEVEL, SAVE_VERSION } from '@/config/GameConfig';
import { DEFAULT_SHIP_AURA, DEFAULT_SHIP_COLOR, DEFAULT_SHIP_SHAPE } from '@/config/shop';
import { RARITY_IDS } from '@/config/rarities';
import { normalizeForComparison } from '@/systems/SaveSystem';

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function malformedSave(seed: number): Record<string, unknown> {
  const next = random(seed);
  const weird = [undefined, null, '', 'NaN', Number.NaN, Number.POSITIVE_INFINITY, -42];
  const pick = () => weird[Math.floor(next() * weird.length)];
  return {
    version: pick(),
    level: next() > 0.5 ? Math.floor(next() * 1000) - 500 : pick(),
    xp: pick(),
    talentPoints: pick(),
    coins: pick(),
    bestScore: pick(),
    bestCombo: pick(),
    totalScore: pick(),
    totalRuns: pick(),
    totalPlayTimeMs: pick(),
    totalCoinsEarned: pick(),
    coinsSpent: pick(),
    dailyBestScore: pick(),
    totalDailyRuns: pick(),
    pendingDailyCoins: pick(),
    pendingDailyScore: pick(),
    collected: next() > 0.4 ? Object.fromEntries(RARITY_IDS.map((id) => [id, pick()])) : pick(),
    talents: next() > 0.4 ? { reach: pick(), magnetism: pick(), injected: pick() } : pick(),
    unlockedAchievements: next() > 0.4 ? ['first-run', 4, null, 'first-run'] : pick(),
    ownedShipShapes: next() > 0.4 ? ['arrow', 'star', 7, null] : pick(),
    ownedShipColors: next() > 0.4 ? ['world', 'gold', {}, 'gold'] : pick(),
    ownedShipAuras: next() > 0.4 ? ['none', 'ember', false, 'ember'] : pick(),
    shipShape: next() > 0.5 ? 'not-owned' : pick(),
    shipColor: next() > 0.5 ? 'not-owned' : pick(),
    shipAura: next() > 0.5 ? 'not-owned' : pick(),
    soundEnabled: pick(),
    playerName: pick(),
    cloudId: pick(),
  };
}

function expectValidSave(save: ReturnType<typeof normalizeForComparison>): void {
  expect(save.version).toBe(SAVE_VERSION);
  expect(Number.isInteger(save.level)).toBe(true);
  expect(save.level).toBeGreaterThanOrEqual(1);
  expect(save.level).toBeLessThanOrEqual(MAX_LEVEL);
  expect(Number.isInteger(save.xp)).toBe(true);
  expect(save.xp).toBeGreaterThanOrEqual(0);
  if (save.level === MAX_LEVEL) expect(save.xp).toBe(0);

  for (const value of [
    save.talentPoints,
    save.coins,
    save.bestScore,
    save.bestCombo,
    save.totalScore,
    save.totalRuns,
    save.totalPlayTimeMs,
    save.totalCoinsEarned,
    save.coinsSpent,
    save.dailyBestScore,
    save.totalDailyRuns,
    save.pendingDailyCoins,
    save.pendingDailyScore,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }

  expect(save.ownedShipShapes).toContain(DEFAULT_SHIP_SHAPE);
  expect(save.ownedShipColors).toContain(DEFAULT_SHIP_COLOR);
  expect(save.ownedShipAuras).toContain(DEFAULT_SHIP_AURA);
  expect(save.ownedShipShapes).toContain(save.shipShape);
  expect(save.ownedShipColors).toContain(save.shipColor);
  expect(save.ownedShipAuras).toContain(save.shipAura);
  expect(
    Object.values(save.collected).every((value) => Number.isInteger(value) && value >= 0),
  ).toBe(true);
  expect(Object.values(save.talents).every((value) => Number.isInteger(value) && value >= 0)).toBe(
    true,
  );
}

describe('SaveSystem reconcile/migrate Robustheit', () => {
  it('normalisiert 250 deterministische beschädigte Payloads ohne zu werfen', () => {
    for (let seed = 1; seed <= 250; seed++) {
      expect(() => expectValidSave(normalizeForComparison(malformedSave(seed)))).not.toThrow();
    }
  });

  it('ist für denselben beschädigten Payload deterministisch', () => {
    const malformed = malformedSave(20260821);
    expect(normalizeForComparison(malformed)).toEqual(normalizeForComparison(malformed));
  });

  it('verliert bei ungültiger Auswahl keine gültige Standardausrüstung', () => {
    const save = normalizeForComparison({
      ownedShipShapes: ['star'],
      ownedShipColors: ['gold'],
      ownedShipAuras: ['ember'],
      shipShape: 'not-owned',
      shipColor: 'not-owned',
      shipAura: 'not-owned',
    });

    expect(save.ownedShipShapes).toContain(DEFAULT_SHIP_SHAPE);
    expect(save.ownedShipColors).toContain(DEFAULT_SHIP_COLOR);
    expect(save.ownedShipAuras).toContain(DEFAULT_SHIP_AURA);
    expect(save.shipShape).toBe(DEFAULT_SHIP_SHAPE);
    expect(save.shipColor).toBe(DEFAULT_SHIP_COLOR);
    expect(save.shipAura).toBe(DEFAULT_SHIP_AURA);
  });
});
