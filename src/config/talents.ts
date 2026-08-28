/**
 * Talente - dauerhafte Upgrades, gekauft mit Coins aus Runs und Erfolgen.
 *
 * Die Stat-Auflösung und die Coin-basierte Vergabe sind vollständig implementiert.
 */

import {
  COMBO_GRACE_MS,
  MAGNET_PULL_SPEED,
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
  | 'reach'
  | 'swiftness'
  | 'magnetism'
  | 'endurance'
  | 'focus'
  | 'prospector'
  | 'insight'
  | 'fortune'
  | 'resonance'
  | 'shield';

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
    maxRank: BALANCE.talents.maxRanks.reach,
    perRank: '+8 Sammelradius',
  },
  {
    id: 'swiftness',
    name: 'Flinkheit',
    description: 'Deine Figur bewegt sich schneller.',
    maxRank: BALANCE.talents.maxRanks.swiftness,
    perRank: '+5% Tempo',
  },
  {
    id: 'magnetism',
    name: 'Magnetismus',
    description: 'Relikte in der Nähe werden zu dir gezogen.',
    maxRank: BALANCE.talents.maxRanks.magnetism,
    perRank: '+65 Sogreichweite',
  },
  {
    id: 'endurance',
    name: 'Ausdauer',
    description: 'Verlängert die Dauer eines Runs.',
    maxRank: BALANCE.talents.maxRanks.endurance,
    perRank: '+4 Sekunden',
  },
  {
    id: 'focus',
    name: 'Fokus',
    description: 'Deine Combo hält länger, bevor sie zerfällt.',
    maxRank: BALANCE.talents.maxRanks.focus,
    perRank: '+150 ms Combo-Fenster',
  },
  {
    id: 'prospector',
    name: 'Spürsinn',
    description: 'Erhöht leicht die Chance, dass ein Relikt seltener wird.',
    maxRank: BALANCE.talents.maxRanks.prospector,
    perRank: '+3% Aufstiegschance',
  },
  {
    id: 'insight',
    name: 'Erkenntnis',
    description: 'Du erhältst mehr Erfahrung pro Relikt.',
    maxRank: BALANCE.talents.maxRanks.insight,
    perRank: '+5% XP',
  },
  {
    id: 'fortune',
    name: 'Gunst',
    description: 'Du erhältst mehr Punkte pro Relikt.',
    maxRank: BALANCE.talents.maxRanks.fortune,
    perRank: '+5% Punkte',
  },
  {
    id: 'resonance',
    name: 'Resonanz',
    description: 'Verstärkt deinen Serienbonus, sobald die Serie aktiv ist.',
    maxRank: BALANCE.talents.maxRanks.resonance,
    perRank: '+0,05x Serienbonus',
  },
  {
    id: 'shield',
    name: 'Schutzfeld',
    description: 'Schwächt die Wirkung von Hindernissen ab.',
    maxRank: BALANCE.talents.maxRanks.shield,
    perRank: '-8% Hinderniswirkung',
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
  readonly magnetPullSpeed: number;
  readonly runDurationMs: number;
  readonly comboGraceMs: number;
  readonly rarityPromotionChance: number;
  readonly xpMultiplier: number;
  readonly scoreMultiplier: number;
  readonly seriesMultiplierBonus: number;
  readonly obstacleResistance: number;
}

function rank(ranks: TalentRanks, id: TalentId): number {
  const def = TALENTS.find((t) => t.id === id);
  const value = ranks[id] ?? 0;
  if (!def || !Number.isFinite(value)) return 0;
  return Math.min(def.maxRank, Math.max(0, Math.floor(value)));
}

/** Rechnet Talentraenge in konkrete Spielwerte um. Reine Funktion, testbar. */
export function resolveStats(ranks: TalentRanks): PlayerStats {
  const talentRanks: ResolvedTalentRanks = {
    reach: rank(ranks, 'reach'),
    swiftness: rank(ranks, 'swiftness'),
    magnetism: rank(ranks, 'magnetism'),
    endurance: rank(ranks, 'endurance'),
    focus: rank(ranks, 'focus'),
    prospector: rank(ranks, 'prospector'),
    insight: rank(ranks, 'insight'),
    fortune: rank(ranks, 'fortune'),
    resonance: rank(ranks, 'resonance'),
    shield: rank(ranks, 'shield'),
  };

  return {
    talentRanks,
    collectRadius:
      PLAYER_BASE_COLLECT_RADIUS + talentRanks.reach * BALANCE.talents.reachRadiusPerRank,
    moveSpeed:
      PLAYER_BASE_SPEED * (1 + talentRanks.swiftness * BALANCE.talents.swiftnessSpeedPerRank),
    magnetRadius: talentRanks.magnetism * BALANCE.talents.magnetRadiusPerRank,
    magnetPullSpeed:
      talentRanks.magnetism > 0
        ? MAGNET_PULL_SPEED * (1 + talentRanks.magnetism * BALANCE.talents.magnetPullSpeedPerRank)
        : 0,
    runDurationMs:
      RUN_DURATION_MS + talentRanks.endurance * BALANCE.talents.enduranceSecondsPerRank * 1000,
    comboGraceMs: COMBO_GRACE_MS + talentRanks.focus * BALANCE.talents.focusComboMsPerRank,
    rarityPromotionChance:
      talentRanks.prospector * BALANCE.talents.prospectorPromotionChancePerRank,
    xpMultiplier: 1 + talentRanks.insight * BALANCE.talents.insightXpPerRank,
    scoreMultiplier: 1 + talentRanks.fortune * BALANCE.talents.fortuneScorePerRank,
    seriesMultiplierBonus: talentRanks.resonance * BALANCE.talents.resonanceSeriesMultiplierPerRank,
    obstacleResistance: talentRanks.shield * BALANCE.talents.shieldObstacleResistancePerRank,
  };
}
