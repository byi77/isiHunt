import { describe, expect, it } from 'vitest';

import {
  BALANCE,
  RUN_BONUS_COLLECTION_TIERS,
  RUN_BONUS_MAX_SCORE,
  RUN_BONUS_MAX_SCORE_RUNS,
  RUN_BONUS_MAX_XP,
  RUN_BONUS_MAX_XP_RUNS,
  RUN_BONUS_RARITY_TIERS,
  RUN_BONUS_SERIES_TIERS,
  scoreForRuns,
  xpForRuns,
} from '@/config/balance';
import type { RarityId } from '@/config/rarities';
import { calculateRunBonus } from '@/systems/RunBonusSystem';

const LEER: Record<RarityId, number> = {
  poor: 0,
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 0,
  legendary: 0,
};

function collected(partial: Partial<Record<RarityId, number>>): Record<RarityId, number> {
  return { ...LEER, ...partial };
}

/**
 * Die Mengen eines durchschnittlichen Runs, aus den Gewichten gerechnet.
 *
 * Nicht von Hand eingetragen: Eine Aenderung der Seltenheitsgewichte soll den
 * Test mitziehen, statt ihn gegen einen veralteten Durchschnitt pruefen zu
 * lassen.
 */
function durchschnittlicheAusbeute(): Record<RarityId, number> {
  const gewichtSumme = Object.values(BALANCE.rarities).reduce((sum, r) => sum + r.weight, 0);
  const entries = Object.entries(BALANCE.rarities).map(([id, rarity]) => [
    id,
    Math.round((BALANCE.run.economyCatches * rarity.weight) / gewichtSumme),
  ]);
  return collected(Object.fromEntries(entries) as Partial<Record<RarityId, number>>);
}

describe('calculateRunBonus', () => {
  it('gibt einem leeren Run nichts', () => {
    const bonus = calculateRunBonus({ collected: LEER, bestCombo: 0 });
    expect(bonus.entries).toHaveLength(0);
    expect(bonus.score).toBe(0);
    expect(bonus.xp).toBe(0);
  });

  /**
   * Der eigentliche Balance-Anspruch: Eine Praemie, die in jedem Run faellt,
   * ist keine Praemie, sondern eine verspaetete Grundverguetung. Die Schwellen
   * muessen ueber dem Durchschnitt liegen.
   */
  it('faellt bei einem durchschnittlichen Run noch nicht', () => {
    const bonus = calculateRunBonus({
      collected: durchschnittlicheAusbeute(),
      bestCombo: BALANCE.score.comboTiers[3]!.minCombo,
    });
    expect(bonus.entries.map((entry) => entry.id)).not.toContain('rarity:rare');
    expect(bonus.entries.map((entry) => entry.id)).not.toContain('rarity:epic');
  });

  it('zahlt je Gruppe nur die hoechste Stufe, nicht alle erreichten', () => {
    const stufen = RUN_BONUS_RARITY_TIERS.rare!;
    const hoechste = stufen[stufen.length - 1]!;
    const bonus = calculateRunBonus({
      collected: collected({ rare: hoechste.minCount }),
      bestCombo: 0,
    });
    const posten = bonus.entries.find((entry) => entry.id === 'rarity:rare');
    expect(posten?.score).toBe(scoreForRuns(hoechste.scoreRuns));
    // Aufsummiert waere es die Summe aller drei Stufen - das waere zu viel.
    expect(posten?.score).toBeLessThan(
      scoreForRuns(stufen.reduce((sum, tier) => sum + tier.scoreRuns, 0)),
    );
  });

  it('deckelt die Summe und sagt es', () => {
    const bonus = calculateRunBonus({
      collected: collected({ poor: 200, rare: 99, epic: 99, legendary: 99 }),
      bestCombo: 400,
    });
    expect(bonus.capped).toBe(true);
    expect(bonus.score).toBe(RUN_BONUS_MAX_SCORE);
    expect(bonus.xp).toBe(RUN_BONUS_MAX_XP);
    // Die Posten bleiben vollstaendig sichtbar, nur die Summe ist gekuerzt.
    expect(bonus.entries.reduce((sum, entry) => sum + entry.score, 0)).toBeGreaterThan(bonus.score);
  });

  it('nennt zu jedem Posten die Menge, die ihn ausgeloest hat', () => {
    const stufe = RUN_BONUS_RARITY_TIERS.legendary![0]!;
    const bonus = calculateRunBonus({
      collected: collected({ legendary: stufe.minCount }),
      bestCombo: 0,
    });
    expect(bonus.entries[0]?.detail).toContain(String(stufe.minCount));
  });

  /**
   * Der Kern der Client-Server-Gleichheit.
   *
   * `run_bonus()` in `supabase/phase_2_52_run_bonus.sql` summiert die
   * Run-Anteile und rundet genau einmal. Rundet der Client stattdessen je
   * Stufe, laeuft seine Summe ein bis zwei Punkte daneben - bei den Punkten
   * harmlos, bei der XP nicht: Der Server schreibt seinen eigenen Wert ins
   * Konto, und der Spieler bekaeme eine andere Zahl gutgeschrieben als die
   * angezeigte.
   *
   * Der Test bildet den SQL-Weg nach und vergleicht. Er faellt um, sobald
   * jemand die Rundung wieder in die Stufen zieht.
   */
  it('rundet wie die serverseitige Rechnung: einmal auf der Summe', () => {
    const faelle: { collected: Record<RarityId, number>; bestCombo: number }[] = [
      {
        collected: collected({ rare: 19, epic: 9, legendary: 3, poor: 45, common: 37 }),
        bestCombo: 20,
      },
      {
        collected: collected({ rare: 25, epic: 14, legendary: 5, poor: 50, common: 40 }),
        bestCombo: 28,
      },
      { collected: collected({ rare: 32, epic: 18, legendary: 8 }), bestCombo: 16 },
    ];

    for (const fall of faelle) {
      const bonus = calculateRunBonus(fall);
      // Denselben Weg gehen, den `run_bonus()` in SQL geht.
      let scoreRuns = 0;
      let xpRuns = 0;
      for (const [rarityId, tiers] of Object.entries(RUN_BONUS_RARITY_TIERS)) {
        let treffer = null;
        for (const tier of tiers)
          if (fall.collected[rarityId as RarityId]! >= tier.minCount) treffer = tier;
        if (treffer) {
          scoreRuns += treffer.scoreRuns;
          xpRuns += treffer.xpRuns;
        }
      }
      let serie = null;
      for (const tier of RUN_BONUS_SERIES_TIERS) if (fall.bestCombo >= tier.minCount) serie = tier;
      if (serie) {
        scoreRuns += serie.scoreRuns;
        xpRuns += serie.xpRuns;
      }
      const gesamt = Object.values(fall.collected).reduce((sum, count) => sum + count, 0);
      let menge = null;
      for (const tier of RUN_BONUS_COLLECTION_TIERS) if (gesamt >= tier.minCount) menge = tier;
      if (menge) {
        scoreRuns += menge.scoreRuns;
        xpRuns += menge.xpRuns;
      }

      expect(bonus.score).toBe(scoreForRuns(Math.min(scoreRuns, RUN_BONUS_MAX_SCORE_RUNS)));
      expect(bonus.xp).toBe(xpForRuns(Math.min(xpRuns, RUN_BONUS_MAX_XP_RUNS)));
    }
  });

  /**
   * Unfug im Spielstand darf keine Praemie erzeugen: `safeCount` haelt
   * negative und nicht-endliche Werte ab, bevor sie eine Stufe erreichen.
   */
  it('behandelt kaputte Mengen als null', () => {
    const bonus = calculateRunBonus({
      collected: collected({ rare: Number.NaN, epic: -50 }),
      bestCombo: Number.POSITIVE_INFINITY,
    });
    expect(bonus.score).toBe(0);
    expect(bonus.entries).toHaveLength(0);
  });
});
