/**
 * Tests fuer Punkte, Combo und Multiplikator.
 *
 * Die Tests lesen ihre Erwartungen aus `COMBO_TIERS` statt feste Zahlen zu
 * setzen: ein Balancing-Wechsel in der Config soll die Tests nicht rot faerben,
 * ein Bruch der Combo-REGEL dagegen schon.
 */

import { describe, expect, it } from 'vitest';

import { COMBO_GRACE_MS, COMBO_TIERS } from '@/config/GameConfig';
import { RARITY_BY_ID } from '@/config/rarities';
import { multiplierForCombo, ScoreSystem } from '@/systems/ScoreSystem';

const POOR = RARITY_BY_ID.poor;
const LEGENDARY = RARITY_BY_ID.legendary;
const RARE = RARITY_BY_ID.rare;

/** Ein System ohne Talent-Boni: Multiplikatoren neutral bei 1. */
function createSystem(scoreMultiplier = 1, xpMultiplier = 1): ScoreSystem {
  return new ScoreSystem(COMBO_GRACE_MS, scoreMultiplier, xpMultiplier);
}

describe('multiplierForCombo', () => {
  it('liefert fuer jede konfigurierte Stufe genau deren Multiplikator', () => {
    for (const tier of COMBO_TIERS) {
      expect(multiplierForCombo(tier.minCombo)).toBe(tier.multiplier);
    }
  });

  it('haelt den Multiplikator bis zur naechsten Stufe', () => {
    const [first, second] = COMBO_TIERS;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(multiplierForCombo(second!.minCombo - 1)).toBe(first!.multiplier);
  });

  it('steigt nie wieder ab', () => {
    let previous = 0;
    for (let combo = 0; combo <= 60; combo++) {
      const current = multiplierForCombo(combo);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('ScoreSystem - Fangen', () => {
  it('zaehlt Punkte mit dem Multiplikator der NEUEN Combo', () => {
    const system = createSystem();

    // Erster Fang: Combo 1, damit Multiplikator 1.
    const outcome = system.registerCollect(POOR!);

    expect(outcome.combo).toBe(1);
    expect(outcome.multiplier).toBe(1);
    expect(outcome.awardedPoints).toBe(POOR!.points);
    expect(system.currentScore).toBe(POOR!.points);
  });

  it('meldet einen Stufensprung nur in dem Fang, der ihn ausloest', () => {
    const system = createSystem();
    const tier = COMBO_TIERS[1];
    expect(tier).toBeDefined();

    const outcomes = Array.from({ length: tier!.minCombo }, () => system.registerCollect(POOR!));

    const jumpIndex = outcomes.findIndex((o) => o.multiplierIncreased);
    expect(outcomes[jumpIndex]?.combo).toBe(tier!.minCombo);
    // Genau ein Sprung bis hierher: der auf die zweite Stufe.
    expect(outcomes.filter((o) => o.multiplierIncreased)).toHaveLength(1);
  });

  it('wendet den Talent-Punktemultiplikator an und rundet kaufmaennisch', () => {
    const system = createSystem(1.5);

    // 1 Punkt * Multiplikator 1 * 1.5 = 1.5 -> gerundet 2.
    expect(system.registerCollect(POOR!).awardedPoints).toBe(2);
  });

  it('setzt die Kette bei einer anderen Seltenheit auf eins zurueck', () => {
    const system = createSystem();
    system.registerCollect(POOR!);
    system.registerCollect(POOR!);
    const outcome = system.registerCollect(LEGENDARY!);
    expect(outcome.combo).toBe(1);
    expect(outcome.multiplier).toBe(1);
    expect(outcome.xpGained).toBe(LEGENDARY!.xp);
  });
});

describe('ScoreSystem - Combo-Zerfall', () => {
  it('haelt die Combo, solange das Fenster laeuft', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    expect(system.update(COMBO_GRACE_MS - 1).comboReset).toBe(false);
    expect(system.currentCombo).toBe(1);
  });

  it('setzt die Combo zurueck, wenn das Fenster ablaeuft', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    expect(system.update(COMBO_GRACE_MS).comboReset).toBe(true);
    expect(system.currentCombo).toBe(0);
  });

  it('meldet den Zerfall nur einmal', () => {
    const system = createSystem();
    system.registerCollect(POOR!);
    system.update(COMBO_GRACE_MS);

    expect(system.update(COMBO_GRACE_MS).comboReset).toBe(false);
  });

  it('startet das Fenster bei jedem Fang neu', () => {
    const system = createSystem();
    system.registerCollect(POOR!);
    system.update(COMBO_GRACE_MS - 1);

    system.registerCollect(POOR!);

    expect(system.comboTimerRatio).toBe(1);
    expect(system.update(COMBO_GRACE_MS - 1).comboReset).toBe(false);
    expect(system.currentCombo).toBe(2);
  });

  it('bricht die Combo NICHT bei einem verpassten Relikt', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    system.registerMiss();

    // Die dokumentierte Kernregel: belohnt wird Flow, nicht Perfektion.
    expect(system.currentCombo).toBe(1);
  });

  it('haelt den Timer-Anteil zwischen 0 und 1', () => {
    const system = createSystem();
    expect(system.comboTimerRatio).toBe(0);

    system.registerCollect(POOR!);
    expect(system.comboTimerRatio).toBe(1);

    system.update(COMBO_GRACE_MS / 2);
    expect(system.comboTimerRatio).toBeCloseTo(0.5);
  });
});

describe('ScoreSystem - Seltenheitsserie', () => {
  it('verdoppelt ab dem dritten gleichen grünen oder selteneren Relikt die Punkte', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    const second = system.registerCollect(RARE!);
    const third = system.registerCollect(RARE!);

    expect(second.sameRarityStreak).toBe(2);
    expect(second.multiplier).toBe(2);
    expect(third.sameRarityStreak).toBe(3);
    expect(third.multiplier).toBe(3);
    expect(third.awardedPoints).toBe(RARE!.points * 3);
  });

  it('setzt die Serie bei einer anderen Seltenheit zurück', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.registerCollect(RARE!);
    system.registerCollect(LEGENDARY!);

    const restarted = system.registerCollect(RARE!);
    expect(restarted.sameRarityStreak).toBe(1);
    expect(restarted.multiplier).toBe(1);
  });
});

describe('ScoreSystem - Run-Statistik', () => {
  it('haelt den hoechsten erreichten Wert fest, nicht den letzten', () => {
    const system = createSystem();
    const tier = COMBO_TIERS[1];

    for (let i = 0; i < tier!.minCombo; i++) system.registerCollect(POOR!);
    const peakCombo = system.currentCombo;
    const peakMultiplier = system.currentMultiplier;

    // Combo verfallen lassen und neu anfangen.
    system.update(COMBO_GRACE_MS);
    system.registerCollect(POOR!);

    const stats = system.toRunStats('meadow');
    expect(stats.bestCombo).toBe(peakCombo);
    expect(stats.bestMultiplier).toBe(peakMultiplier);
  });

  it('zaehlt Faenge je Seltenheit und die Fehlversuche', () => {
    const system = createSystem();
    system.registerCollect(POOR!);
    system.registerCollect(POOR!);
    system.registerCollect(LEGENDARY!);
    system.registerMiss();

    const stats = system.toRunStats('meadow');
    expect(stats.collected.poor).toBe(2);
    expect(stats.collected.legendary).toBe(1);
    expect(stats.totalCollected).toBe(3);
    expect(stats.missed).toBe(1);
    expect(stats.worldId).toBe('meadow');
  });

  it('liefert eine Kopie der Zaehler, nicht den internen Zustand', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    const stats = system.toRunStats('meadow');
    stats.collected.poor = 999;

    expect(system.toRunStats('meadow').collected.poor).toBe(1);
  });
});
