/**
 * Talente - dauerhafte Upgrades, gekauft mit kostenlosen Punkten aus Leveln.
 *
 * Die Stat-Aufloesung und die kostenlose Vergabe sind vollstaendig implementiert.
 */

import {
  COMBO_GRACE_MS,
  MAGNET_PULL_SPEED,
  PLAYER_BASE_COLLECT_RADIUS,
  PLAYER_BASE_SPEED,
  RUN_DURATION_MS,
} from './GameConfig';
import { BALANCE } from './balance';

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
    perRank: '+5 Sammelradius',
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
    perRank: '+45 Sogreichweite',
  },
  {
    id: 'endurance',
    name: 'Ausdauer',
    description: 'Verlängert die Dauer eines Runs.',
    maxRank: BALANCE.talents.maxRanks.endurance,
    perRank: '+3 Sekunden',
  },
  {
    id: 'focus',
    name: 'Fokus',
    description: 'Deine Combo hält länger, bevor sie zerfällt.',
    maxRank: BALANCE.talents.maxRanks.focus,
    perRank: '+100 ms Combo-Fenster',
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

export function talentMaxRank(id: TalentId): number {
  return TALENTS.find((talent) => talent.id === id)?.maxRank ?? 0;
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

/**
 * Berechnet den Bonus eines Talents mit einem staerkeren letzten Rang.
 *
 * Der Capstone gilt nur bei exakt erreichtem Maximalrang. So bleiben alle
 * ZwischenrÃ¤nge linear und der letzte Kauf fuehlt sich als Abschluss an.
 */
function talentBonus(
  currentRank: number,
  maxRank: number,
  perRank: number,
  capstoneMultiplier = BALANCE.talents.capstoneRankMultiplier,
): number {
  const hasCapstone = currentRank > 0 && currentRank === maxRank;
  const regularRanks = Math.max(0, currentRank - (hasCapstone ? 1 : 0));
  return perRank * (regularRanks + (hasCapstone ? capstoneMultiplier : 0));
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

  const reachBonus = talentBonus(
    talentRanks.reach,
    BALANCE.talents.maxRanks.reach,
    BALANCE.talents.reachRadiusPerRank,
  );
  const swiftnessBonus = talentBonus(
    talentRanks.swiftness,
    BALANCE.talents.maxRanks.swiftness,
    BALANCE.talents.swiftnessSpeedPerRank,
  );
  const magnetRadiusBonus = talentBonus(
    talentRanks.magnetism,
    BALANCE.talents.maxRanks.magnetism,
    BALANCE.talents.magnetRadiusPerRank,
    BALANCE.talents.magnetRadiusCapstoneRankMultiplier,
  );
  const magnetPullBonus = talentBonus(
    talentRanks.magnetism,
    BALANCE.talents.maxRanks.magnetism,
    BALANCE.talents.magnetPullSpeedPerRank,
  );
  const enduranceBonus = talentBonus(
    talentRanks.endurance,
    BALANCE.talents.maxRanks.endurance,
    BALANCE.talents.enduranceSecondsPerRank,
  );
  const focusBonus = talentBonus(
    talentRanks.focus,
    BALANCE.talents.maxRanks.focus,
    BALANCE.talents.focusComboMsPerRank,
  );
  const prospectorBonus = talentBonus(
    talentRanks.prospector,
    BALANCE.talents.maxRanks.prospector,
    BALANCE.talents.prospectorPromotionChancePerRank,
  );
  const insightBonus = talentBonus(
    talentRanks.insight,
    BALANCE.talents.maxRanks.insight,
    BALANCE.talents.insightXpPerRank,
  );
  const fortuneBonus = talentBonus(
    talentRanks.fortune,
    BALANCE.talents.maxRanks.fortune,
    BALANCE.talents.fortuneScorePerRank,
  );
  const resonanceBonus = talentBonus(
    talentRanks.resonance,
    BALANCE.talents.maxRanks.resonance,
    BALANCE.talents.resonanceSeriesMultiplierPerRank,
  );
  const shieldBonus = talentBonus(
    talentRanks.shield,
    BALANCE.talents.maxRanks.shield,
    BALANCE.talents.shieldObstacleResistancePerRank,
  );

  return {
    talentRanks,
    collectRadius: PLAYER_BASE_COLLECT_RADIUS + reachBonus,
    moveSpeed: PLAYER_BASE_SPEED * (1 + swiftnessBonus),
    magnetRadius: magnetRadiusBonus,
    magnetPullSpeed: talentRanks.magnetism > 0 ? MAGNET_PULL_SPEED * (1 + magnetPullBonus) : 0,
    runDurationMs: RUN_DURATION_MS + enduranceBonus * 1000,
    comboGraceMs: COMBO_GRACE_MS + focusBonus,
    rarityPromotionChance: prospectorBonus,
    xpMultiplier: 1 + insightBonus,
    scoreMultiplier: 1 + fortuneBonus,
    seriesMultiplierBonus: resonanceBonus,
    obstacleResistance: shieldBonus,
  };
}
