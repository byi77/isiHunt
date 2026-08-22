/**
 * Talente - dauerhafte Upgrades, gekauft mit Coins aus Runs und Erfolgen.
 *
 * Die Stat-Auflösung und die Coin-basierte Vergabe sind vollständig implementiert.
 */

import {
  COMBO_GRACE_MS,
  PLAYER_BASE_COLLECT_RADIUS,
  PLAYER_BASE_SPEED,
  RUN_DURATION_MS,
} from './GameConfig';
import {
  BALANCE,
  TALENT_COSTS as BALANCED_TALENT_COSTS,
  talentCost as balanceTalentCost,
} from './balance';

export type TalentId =
  'reach' | 'swiftness' | 'magnetism' | 'endurance' | 'focus' | 'insight' | 'fortune';

export interface TalentDef {
  readonly id: TalentId;
  readonly name: string;
  readonly description: string;
  readonly maxRank: number;
  /** Zuwachs pro Rang, als Text fuers UI. */
  readonly perRank: string;
}

export const TALENTS: readonly TalentDef[] = [
  {
    id: 'reach',
    name: 'Reichweite',
    description: 'Vergrößert den Radius, in dem du Relikte einsammelst.',
    maxRank: 5,
    perRank: '+6 Radius',
  },
  {
    id: 'swiftness',
    name: 'Flinkheit',
    description: 'Deine Figur bewegt sich schneller.',
    maxRank: 5,
    perRank: '+5% Tempo',
  },
  {
    id: 'magnetism',
    name: 'Magnetismus',
    description: 'Relikte in der Nähe werden zu dir gezogen.',
    maxRank: 4,
    perRank: '+35 Sogreichweite',
  },
  {
    id: 'endurance',
    name: 'Ausdauer',
    description: 'Verlängert die Dauer eines Runs.',
    maxRank: 4,
    perRank: '+3 Sekunden',
  },
  {
    id: 'focus',
    name: 'Fokus',
    description: 'Deine Combo hält länger, bevor sie zerfällt.',
    maxRank: 4,
    perRank: '+150 ms Combo-Fenster',
  },
  {
    id: 'insight',
    name: 'Erkenntnis',
    description: 'Du erhältst mehr Erfahrung pro Relikt.',
    maxRank: 5,
    perRank: '+5% XP',
  },
  {
    id: 'fortune',
    name: 'Gunst',
    description: 'Du erhältst mehr Punkte pro Relikt.',
    maxRank: 5,
    perRank: '+5% Punkte',
  },
];

export type TalentRanks = Partial<Record<TalentId, number>>;

/** Aufgeloeste, begrenzte Raenge fuer Gameplay- und Visual-Feedback. */
export type ResolvedTalentRanks = Readonly<Record<TalentId, number>>;

/** Kosten des nächsten Rangs: steigend, damit der Talentbaum langfristig bleibt. */
/** Ein brauchbarer Rang soll etwa vier bis sechs normale Runs erfordern. */
export const TALENT_COSTS = BALANCED_TALENT_COSTS;

export function talentMaxRank(id: TalentId): number {
  return TALENTS.find((talent) => talent.id === id)?.maxRank ?? 0;
}

export function talentCost(currentRank: number): number {
  return balanceTalentCost(currentRank);
}

/**
 * Effektive Werte einer Figur. Alles, was ein Talent beeinflussen kann, wird
 * hier gebuendelt - Scenes lesen nur noch diese Struktur, nie einzelne Talente.
 */
export interface PlayerStats {
  readonly talentRanks: ResolvedTalentRanks;
  readonly moveSpeed: number;
  readonly collectRadius: number;
  readonly magnetRadius: number;
  readonly runDurationMs: number;
  readonly comboGraceMs: number;
  readonly xpMultiplier: number;
  readonly scoreMultiplier: number;
}

function rank(ranks: TalentRanks, id: TalentId): number {
  const def = TALENTS.find((t) => t.id === id);
  const value = ranks[id] ?? 0;
  return def ? Math.min(value, def.maxRank) : 0;
}

/** Rechnet Talentraenge in konkrete Spielwerte um. Reine Funktion, testbar. */
export function resolveStats(ranks: TalentRanks): PlayerStats {
  const talentRanks: ResolvedTalentRanks = {
    reach: rank(ranks, 'reach'),
    swiftness: rank(ranks, 'swiftness'),
    magnetism: rank(ranks, 'magnetism'),
    endurance: rank(ranks, 'endurance'),
    focus: rank(ranks, 'focus'),
    insight: rank(ranks, 'insight'),
    fortune: rank(ranks, 'fortune'),
  };

  return {
    talentRanks,
    collectRadius: PLAYER_BASE_COLLECT_RADIUS + talentRanks.reach * 6,
    moveSpeed: PLAYER_BASE_SPEED * (1 + talentRanks.swiftness * 0.05),
    magnetRadius: talentRanks.magnetism * 35,
    runDurationMs: RUN_DURATION_MS + talentRanks.endurance * 3000,
    comboGraceMs: COMBO_GRACE_MS + talentRanks.focus * 150,
    xpMultiplier: 1 + talentRanks.insight * BALANCE.talents.insightXpPerRank,
    scoreMultiplier: 1 + talentRanks.fortune * BALANCE.talents.fortuneScorePerRank,
  };
}
