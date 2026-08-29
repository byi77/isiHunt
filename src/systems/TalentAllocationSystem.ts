/**
 * Gemeinsame Rangvergabe fuer Talente.
 *
 * Die Funktionen kennen weder Phaser noch den Spielstand. Dadurch kann der
 * temporaere Duell-Build dieselbe Plus-/Minus-Logik spaeter mit dem normalen
 * Talentbaum teilen, ohne dass eine Oberflaeche eigene Rangregeln erfindet.
 */

import { TALENTS, type TalentId, type TalentRanks } from '@/config/talents';

/** Zaehlt nur bekannte, positive und ganzzahlige Talentraenge. */
export function talentPointsSpent(ranks: TalentRanks): number {
  return TALENTS.reduce((sum, talent) => {
    const value = ranks[talent.id];
    return sum + (Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0);
  }, 0);
}

/**
 * Bereinigt eine Rangliste und begrenzt sie auf das bekannte Talentinventar.
 * Ein Budget wird von der Reihenfolge der Talentdefinitionen ausgehend
 * eingehalten; normale UI-Eingaben erreichen diesen Korrekturpfad nicht, aber
 * Netzwerk- und alte lokale Daten bleiben damit defensiv behandelbar.
 */
export function normalizeTalentRanks(
  ranks: TalentRanks,
  budget = Number.POSITIVE_INFINITY,
): TalentRanks {
  let remaining = Math.max(0, Math.floor(budget));
  const normalized: TalentRanks = {};

  for (const talent of TALENTS) {
    const raw = ranks[talent.id];
    const requested = Number.isFinite(raw) ? Math.max(0, Math.floor(raw ?? 0)) : 0;
    const rank = Math.min(talent.maxRank, requested, remaining);
    if (rank > 0) normalized[talent.id] = rank;
    remaining -= rank;
  }

  return normalized;
}

/**
 * Veraendert genau einen Rang. `null` bedeutet, dass der Schritt wegen Budget
 * oder Maximalrang nicht moeglich ist.
 */
export function changeTalentRank(
  ranks: TalentRanks,
  talentId: TalentId,
  delta: -1 | 1,
  budget = Number.POSITIVE_INFINITY,
): TalentRanks | null {
  const normalized = normalizeTalentRanks(ranks, budget);
  const talent = TALENTS.find((entry) => entry.id === talentId);
  if (!talent) return null;

  const currentRank = normalized[talentId] ?? 0;
  const nextRank = currentRank + delta;
  if (nextRank < 0 || nextRank > talent.maxRank) return null;
  if (delta > 0 && talentPointsSpent(normalized) >= budget) return null;

  const next = { ...normalized };
  if (nextRank === 0) delete next[talentId];
  else next[talentId] = nextRank;
  return next;
}
