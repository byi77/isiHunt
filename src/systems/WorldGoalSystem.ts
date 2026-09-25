import type { RarityId } from '@/config/rarities';
import type { RunStats } from '@/types';
import {
  WORLD_GOAL_TEXT,
  getWorldStars,
  worldGoalValue,
  type WorldGoalMetric,
} from '@/config/worldStars';

export type { WorldGoalMetric } from '@/config/worldStars';

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

// Metrik und Ziel stehen in `balance-data.json` (`worldStars`), weil der
// Weltauftrag zugleich der dritte Stern ist und der Server ihn nachprueft.
// Hier bleibt nur, was der Spieler liest.
const WORLD_GOAL_TITLES: Readonly<Record<string, string>> = {
  silberhain: 'Sternenspur',
  frostzinne: 'Eisbrecher',
  glutmark: 'Glutfang',
  __LEERENBLÜTE__: 'Rissfinder',
  sonnenhort: 'Kronenbeute',
  mondschmiede: 'Mondkette',
  kristallbruch: 'Splitterflug',
  sturmgrenze: 'Sturmleuchten',
  lichtkern: 'Kernsammler',
  horizonttor: 'Horizontrekord',
};

export function getWorldGoal(worldId: string): WorldGoal {
  const stars = getWorldStars(worldId) ?? getWorldStars('silberhain')!;
  const { metric, target } = stars.goal;
  const text = WORLD_GOAL_TEXT[metric];
  return {
    title: WORLD_GOAL_TITLES[stars.worldId] ?? WORLD_GOAL_TITLES.silberhain!,
    description: text.describe(target.toLocaleString('de-DE')),
    metric,
    target,
    unit: text.unit,
  };
}

export function worldGoalMetrics(stats: RunStats): WorldGoalMetrics {
  return {
    totalCollected: worldGoalValue('collected', stats),
    rarePlus: worldGoalValue('rarePlus', stats),
    epicPlus: worldGoalValue('epicPlus', stats),
    bestCombo: worldGoalValue('combo', stats),
    score: worldGoalValue('score', stats),
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
