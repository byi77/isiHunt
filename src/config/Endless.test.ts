import { describe, expect, it } from 'vitest';
import { emptyRarityCounts } from './rarities';
import { coinsForRun } from '@/systems/ProgressionSystem';
import {
  ENDLESS_LIFETIME_FLOOR,
  ENDLESS_ROUND_MS,
  ENDLESS_SERIES_GRACE_FLOOR,
  endlessGate,
  endlessLifetimeScale,
  endlessSeriesGraceScale,
  endlessTotalGate,
  endlessRewards,
  endlessTalentChoices,
  endlessWorld,
} from './endless';

describe('Endlosmodus', () => {
  it('laesst die ersten vier Gates leicht und erhoeht das Ziel danach', () => {
    expect(ENDLESS_ROUND_MS).toBe(30_000);
    // Grundziel 500, 700, ... mal Rundennummer - der Punktemultiplikator.
    expect([1, 2, 3, 4, 5, 6, 9].map(endlessGate)).toEqual([
      500, 1_400, 2_700, 4_400, 6_500, 9_600, 22_500,
    ]);
    expect(endlessGate(50)).toBeGreaterThan(endlessGate(20));
    expect([1, 2, 3, 4, 5, 6].map(endlessTotalGate)).toEqual([
      500, 1_900, 4_600, 9_000, 15_500, 25_100,
    ]);
  });

  it('zaehlt Punkte in Runde N N-fach und macht spaete Runden knapper', () => {
    expect(endlessRewards(1).scoreMultiplier).toBe(1);
    expect(endlessRewards(14).scoreMultiplier).toBe(14);
    expect(endlessRewards(21).scoreMultiplier).toBe(21);
    expect(endlessSeriesGraceScale(1)).toBe(1);
    expect(endlessSeriesGraceScale(5)).toBeLessThan(endlessSeriesGraceScale(4));
    expect(endlessSeriesGraceScale(100)).toBe(ENDLESS_SERIES_GRACE_FLOOR);
    expect(endlessLifetimeScale(1)).toBe(1);
    expect(endlessLifetimeScale(5)).toBeLessThan(endlessLifetimeScale(4));
    expect(endlessLifetimeScale(100)).toBe(ENDLESS_LIFETIME_FLOOR);
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
