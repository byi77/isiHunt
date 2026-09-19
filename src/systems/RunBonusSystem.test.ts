import { describe, expect, it } from 'vitest';

import {
  BALANCE,
  RUN_BONUS_MAX_SCORE,
  RUN_BONUS_MAX_XP,
  RUN_BONUS_RARITY_TIERS,
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
    expect(posten?.score).toBe(hoechste.score);
    // Aufsummiert waere es die Summe aller drei Stufen - das waere zu viel.
    expect(posten?.score).toBeLessThan(stufen.reduce((sum, tier) => sum + tier.score, 0));
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
