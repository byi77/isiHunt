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
export const ENDLESS_SCORE_BONUS_PER_ROUND = 0.02;

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
  talents: TalentRanks;
}

export function endlessGate(round: number): number {
  const index = Math.max(1, Math.floor(round)) - 1;
  return (
    ENDLESS_EASY_GATES[index] ??
    ENDLESS_LATER_GATE_BASE + (index - ENDLESS_EASY_GATES.length) * ENDLESS_LATER_GATE_STEP
  );
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
    scoreMultiplier: 1 + extra * ENDLESS_SCORE_BONUS_PER_ROUND,
    xpMultiplier: 1 + extra * ENDLESS_XP_BONUS_PER_ROUND,
    bonusCoins: extra * ENDLESS_COIN_BONUS_PER_ROUND,
  };
}

export function endlessTalentChoices(ranks: TalentRanks): TalentId[] {
  return ENDLESS_TALENTS.filter(
    (id) => (ranks[id] ?? 0) < (TALENTS.find((talent) => talent.id === id)?.maxRank ?? 0),
  );
}
