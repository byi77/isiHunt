import { WORLDS } from './worlds';
import { TALENTS } from './talents';
import type { TalentId, TalentRanks } from './talents';

export const ENDLESS_ROUND_MS = 30_000;
export const ENDLESS_EASY_GATES = [500, 700, 900, 1_100] as const;
export const ENDLESS_LATER_GATE_BASE = 1_300;
export const ENDLESS_LATER_GATE_STEP = 300;
export const ENDLESS_DOUBLE_TALENT_EVERY = 4;
export const ENDLESS_TALENT_CHOICES = 3;
export const ENDLESS_XP_BONUS_PER_ROUND = 0.04;
export const ENDLESS_COIN_BONUS_PER_ROUND = 2;
/**
 * Runde N zaehlt jeden Punkt N-fach. Damit das Ziel nicht zur Formsache wird,
 * waechst es mit demselben Faktor (`endlessGate`) - die Zahlen werden gross,
 * die Huerde bleibt relativ gleich. Den Druck erzeugen stattdessen das
 * schrumpfende Serienfenster und kuerzer sichtbare Relikte.
 */
export const ENDLESS_SCORE_MULTIPLIER_PER_ROUND = 1;
/** Die aus der Vorrunde mitgenommene Serie kann so lange nicht reissen. */
export const ENDLESS_SERIES_SHIELD_MS = 3_000;
export const ENDLESS_SERIES_GRACE_SHRINK_PER_ROUND = 0.03;
export const ENDLESS_SERIES_GRACE_FLOOR = 0.6;
export const ENDLESS_LIFETIME_SHRINK_PER_ROUND = 0.025;
export const ENDLESS_LIFETIME_FLOOR = 0.65;
export const ENDLESS_DIFFICULTY_ROUND_8 = 1.6;
export const ENDLESS_DIFFICULTY_ROUND_9 = 2.1;
export const ENDLESS_DIFFICULTY_ROUND_10 = 2.8;

export const ENDLESS_TALENTS: readonly TalentId[] = [
  'reach',
  'swiftness',
  'magnetism',
  'focus',
  'prospector',
  'insight',
  'fortune',
  'resonance',
  'shield',
  'luck',
];

export interface EndlessState {
  sessionId: string;
  round: number;
  totalScore: number;
  totalXp: number;
  totalCoins: number;
  rescueUsed?: boolean;
  /** Serie am Ende der Vorrunde - sie laeuft in der naechsten weiter. */
  carriedCombo?: number;
  talents: TalentRanks;
}

export function endlessDifficultyScale(round: number): number {
  if (round >= 10) return ENDLESS_DIFFICULTY_ROUND_10;
  if (round >= 9) return ENDLESS_DIFFICULTY_ROUND_9;
  if (round >= 8) return ENDLESS_DIFFICULTY_ROUND_8;
  return 1;
}

/** Punkteziel dieser Runde, bereits mit dem Rundenmultiplikator gerechnet. */
export function endlessGate(round: number): number {
  const index = Math.max(1, Math.floor(round)) - 1;
  const base =
    ENDLESS_EASY_GATES[index] ??
    ENDLESS_LATER_GATE_BASE + (index - ENDLESS_EASY_GATES.length) * ENDLESS_LATER_GATE_STEP;
  return base * endlessRewards(round).scoreMultiplier;
}

/** Gesamtstand, der am Ende dieser Runde mindestens erreicht sein muss. */
export function endlessTotalGate(round: number): number {
  const lastRound = Math.max(1, Math.floor(round));
  let total = 0;
  for (let current = 1; current <= lastRound; current += 1) total += endlessGate(current);
  return total;
}

export function endlessWorld(round: number) {
  return WORLDS[Math.min(WORLDS.length - 1, Math.floor((Math.max(1, round) - 1) / 2))]!;
}

export function endlessRewards(round: number): {
  scoreMultiplier: number;
  xpMultiplier: number;
  bonusCoins: number;
} {
  const extra = Math.max(0, Math.floor(round) - 1);
  return {
    scoreMultiplier: 1 + extra * ENDLESS_SCORE_MULTIPLIER_PER_ROUND,
    xpMultiplier: 1 + extra * ENDLESS_XP_BONUS_PER_ROUND,
    bonusCoins: extra * ENDLESS_COIN_BONUS_PER_ROUND,
  };
}

/** Faktor auf das Serienfenster: spaete Runden verzeihen weniger. */
export function endlessSeriesGraceScale(round: number): number {
  const extra = Math.max(0, Math.floor(round) - 1);
  return Math.max(ENDLESS_SERIES_GRACE_FLOOR, 1 - extra * ENDLESS_SERIES_GRACE_SHRINK_PER_ROUND);
}

/** Faktor auf die Sichtdauer der Relikte - ohne ein einziges Hindernis mehr. */
export function endlessLifetimeScale(round: number): number {
  const extra = Math.max(0, Math.floor(round) - 1);
  return Math.max(ENDLESS_LIFETIME_FLOOR, 1 - extra * ENDLESS_LIFETIME_SHRINK_PER_ROUND);
}

export function endlessTalentChoices(ranks: TalentRanks): TalentId[] {
  return ENDLESS_TALENTS.filter(
    (id) => (ranks[id] ?? 0) < (TALENTS.find((talent) => talent.id === id)?.maxRank ?? 0),
  );
}
