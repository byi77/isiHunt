import type { RarityId } from '@/config/rarities';
import type { RunStats } from '@/types';

export type WorldGoalMetric = 'collected' | 'rarePlus' | 'epicPlus' | 'combo' | 'score';

export interface WorldGoal {
  readonly title: string;
  readonly description: string;
  readonly metric: WorldGoalMetric;
  readonly target: number;
  readonly unit: string;
}

export interface WorldGoalMetrics {
  readonly totalCollected: number;
  readonly rarePlus: number;
  readonly epicPlus: number;
  readonly bestCombo: number;
  readonly score: number;
}

const WORLD_GOALS: Readonly<Record<string, WorldGoal>> = {
  silberhain: {
    title: 'Sternenspur',
    description: 'Fange 110 Relikte in einer Jagd.',
    metric: 'collected',
    target: 110,
    unit: 'Relikte',
  },
  frostzinne: {
    title: 'Eisbrecher',
    description: 'Erreiche eine Serie von 16.',
    metric: 'combo',
    target: 16,
    unit: 'Serie',
  },
  glutmark: {
    title: 'Glutfang',
    description: 'Fange 8 seltene oder bessere Relikte.',
    metric: 'rarePlus',
    target: 8,
    unit: 'seltene Funde',
  },
  __LEERENBLÜTE__: {
    title: 'Rissfinder',
    description: 'Fange 3 epische oder bessere Relikte.',
    metric: 'epicPlus',
    target: 3,
    unit: 'epische Funde',
  },
  sonnenhort: {
    title: 'Kronenbeute',
    description: 'Fange 14 seltene oder bessere Relikte.',
    metric: 'rarePlus',
    target: 14,
    unit: 'seltene Funde',
  },
  mondschmiede: {
    title: 'Mondkette',
    description: 'Erreiche eine Serie von 25.',
    metric: 'combo',
    target: 25,
    unit: 'Serie',
  },
  kristallbruch: {
    title: 'Splitterflug',
    description: 'Fange 155 Relikte in einer Jagd.',
    metric: 'collected',
    target: 155,
    unit: 'Relikte',
  },
  sturmgrenze: {
    title: 'Sturmleuchten',
    description: 'Fange 5 epische oder bessere Relikte.',
    metric: 'epicPlus',
    target: 5,
    unit: 'epische Funde',
  },
  lichtkern: {
    title: 'Kernsammler',
    description: 'Fange 24 seltene oder bessere Relikte.',
    metric: 'rarePlus',
    target: 24,
    unit: 'seltene Funde',
  },
  horizonttor: {
    title: 'Horizontrekord',
    description: 'Erreiche 20.000 Punkte in einer Jagd.',
    metric: 'score',
    target: 20_000,
    unit: 'Punkte',
  },
};

export function getWorldGoal(worldId: string): WorldGoal {
  return WORLD_GOALS[worldId] ?? WORLD_GOALS.silberhain!;
}

export function worldGoalMetrics(stats: RunStats): WorldGoalMetrics {
  return {
    totalCollected: stats.totalCollected,
    rarePlus: stats.collected.rare + stats.collected.epic + stats.collected.legendary,
    epicPlus: stats.collected.epic + stats.collected.legendary,
    bestCombo: stats.bestCombo,
    score: stats.score - (stats.bonus?.score ?? 0),
  };
}

export function worldGoalProgress(goal: WorldGoal, metrics: WorldGoalMetrics): number {
  switch (goal.metric) {
    case 'collected':
      return metrics.totalCollected;
    case 'rarePlus':
      return metrics.rarePlus;
    case 'epicPlus':
      return metrics.epicPlus;
    case 'combo':
      return metrics.bestCombo;
    case 'score':
      return metrics.score;
  }
}

export function worldGoalProgressFromRarity(metric: WorldGoalMetric, rarityId: RarityId): number {
  if (metric === 'collected') return 1;
  if (
    metric === 'rarePlus' &&
    (rarityId === 'rare' || rarityId === 'epic' || rarityId === 'legendary')
  )
    return 1;
  if (metric === 'epicPlus' && (rarityId === 'epic' || rarityId === 'legendary')) return 1;
  return 0;
}
