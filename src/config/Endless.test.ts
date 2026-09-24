import { describe, expect, it } from 'vitest';
import { emptyRarityCounts } from './rarities';
import { coinsForRun } from '@/systems/ProgressionSystem';
import {
  ENDLESS_ROUND_MS,
  endlessGate,
  endlessTotalGate,
  endlessRewards,
  endlessTalentChoices,
  endlessWorld,
} from './endless';

describe('Endlosmodus', () => {
  it('laesst die ersten vier Gates leicht und erhoeht das Ziel danach', () => {
    expect(ENDLESS_ROUND_MS).toBe(30_000);
    expect([1, 2, 3, 4, 5, 6, 9].map(endlessGate)).toEqual([
      500, 700, 900, 1_100, 1_300, 1_600, 2_500,
    ]);
    expect(endlessGate(50)).toBeGreaterThan(endlessGate(20));
    expect([1, 2, 3, 4, 5, 6].map(endlessTotalGate)).toEqual([
      500, 1_200, 2_100, 3_200, 4_500, 6_100,
    ]);
  });

  it('wechselt alle zwei Runden die Welt und steigert die Belohnung', () => {
    expect(endlessWorld(1).id).toBe(endlessWorld(2).id);
    expect(endlessWorld(3).id).not.toBe(endlessWorld(2).id);
    expect(endlessWorld(100).id).toBe(endlessWorld(20).id);
    expect(endlessRewards(5).scoreMultiplier).toBeGreaterThan(endlessRewards(4).scoreMultiplier);
    expect(endlessRewards(5).xpMultiplier).toBeGreaterThan(endlessRewards(4).xpMultiplier);
    expect(endlessRewards(5).bonusCoins).toBeGreaterThan(endlessRewards(4).bonusCoins);
  });

  it('bietet Ausdauer und ausgeschöpfte Talente nicht an', () => {
    expect(endlessTalentChoices({})).not.toContain('endurance');
    expect(endlessTalentChoices({ reach: 5 })).not.toContain('reach');
    expect(endlessTalentChoices({ reach: 4 })).toContain('reach');
  });

  it('skaliert Basis-Coins auf 30 Sekunden und gibt spaeter mehr', () => {
    const base = {
      worldId: 'silberhain',
      score: 0,
      bestCombo: 0,
      bestMultiplier: 1,
      collected: emptyRarityCounts(),
      totalCollected: 0,
      missed: 0,
      xpGained: 0,
      durationMs: ENDLESS_ROUND_MS,
    };
    expect(coinsForRun({ ...base, endlessRound: 1 })).toBe(7);
    expect(coinsForRun({ ...base, endlessRound: 2 })).toBe(9);
  });
});
