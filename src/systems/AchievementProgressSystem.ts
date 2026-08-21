/** Zentrale Kategorien und Fortschrittswerte fuer die Erfolgsanzeige. */

import { type AchievementDef } from '@/config/achievements';
import { unlockedWorlds } from '@/config/worlds';
import type { SaveData } from '@/types';

export type AchievementCategory =
  'combo' | 'collection' | 'score' | 'worlds' | 'playtime' | 'talents' | 'daily' | 'special';

export interface AchievementProgress {
  readonly category: AchievementCategory;
  readonly current: number;
  readonly target: number;
  readonly unit: string;
  /** Run-only achievements haben ohne einen laufenden Run keinen falschen Wert. */
  readonly trackable: boolean;
  readonly label: string;
}

const CATEGORY_LABELS: Readonly<Record<AchievementCategory, string>> = {
  combo: 'KOMBO',
  collection: 'SAMMLUNG',
  score: 'PUNKTE',
  worlds: 'WELTEN',
  playtime: 'SPIELZEIT',
  talents: 'TALENTE',
  daily: 'TAGESZIEL',
  special: 'SPEZIAL',
};

const SCORE_TARGETS: Readonly<Record<string, number>> = {
  score_1000: 1_000,
  score_5000: 3_000,
  score_15000: 6_000,
  score_30000: 10_000,
  score_60000: 16_000,
  score_100000: 24_000,
  score_150000: 35_000,
};

const PLAYTIME_TARGETS: Readonly<Record<string, number>> = {
  playtime_hour: 60,
  playtime_five_hours: 300,
  playtime_ten_hours: 600,
};

function numberSuffix(id: string, fallback: number): number {
  const match = id.match(/_(\d+)$/);
  return match ? Number(match[1]) : fallback;
}

function totalRelics(save: SaveData): number {
  return Object.values(save.collected).reduce((sum, count) => sum + count, 0);
}

function totalTalentRanks(save: SaveData): number {
  return Object.values(save.talents).reduce((sum, rank) => sum + rank, 0);
}

/** IDs, deren historische Namen nicht zu ihrer fachlichen Kategorie passen. */
export function achievementCategory(achievement: AchievementDef): AchievementCategory {
  const { id } = achievement;
  if (id === 'combo_125' || id === 'combo_150') return 'daily';
  if (id.startsWith('combo_')) return 'combo';
  if (id.startsWith('score_')) return 'score';
  if (
    id.startsWith('rare_') ||
    id.startsWith('epic_') ||
    id.startsWith('legendary_') ||
    id.startsWith('collector_')
  ) {
    return id === 'legendary_3_run' ? 'special' : 'collection';
  }
  if (id.startsWith('level_') || id.startsWith('world_traveller')) return 'worlds';
  if (id.startsWith('playtime_')) return 'playtime';
  if (id.startsWith('talents_')) return 'talents';
  if (id.startsWith('runs_') || id.startsWith('clean_run_') || id === 'first_hunt') {
    return 'special';
  }
  return 'special';
}

export function achievementCategoryLabel(category: AchievementCategory): string {
  return CATEGORY_LABELS[category];
}

/** Liefert das noch gesperrte Ziel mit dem kleinsten verbleibenden Anteil. */
export function getNextAchievement(
  achievements: readonly AchievementDef[],
  save: SaveData,
): AchievementDef | null {
  return (
    achievements
      .filter((achievement) => !save.unlockedAchievements.includes(achievement.id))
      .map((achievement, index) => {
        const progress = getAchievementProgress(achievement, save);
        const remaining = progress.trackable
          ? Math.max(0, progress.target - progress.current) / progress.target
          : 1;
        return { achievement, remaining, index };
      })
      .sort((left, right) => left.remaining - right.remaining || left.index - right.index)[0]
      ?.achievement ?? null
  );
}

function progressFor(
  achievement: AchievementDef,
  save: SaveData,
): Omit<AchievementProgress, 'category' | 'label'> {
  const { id } = achievement;

  if (id === 'first_hunt')
    return { current: save.totalRuns, target: 1, unit: 'Runs', trackable: true };

  if (id.startsWith('combo_') && id !== 'combo_125' && id !== 'combo_150') {
    return { current: save.bestCombo, target: numberSuffix(id, 1), unit: 'Combo', trackable: true };
  }

  if (id === 'combo_125' || id === 'combo_150') {
    const target = id === 'combo_125' ? 7 : 30;
    return { current: save.totalDailyRuns, target, unit: 'Tagesläufe', trackable: true };
  }

  if (id.startsWith('score_')) {
    return {
      current: save.bestScore,
      target: SCORE_TARGETS[id] ?? numberSuffix(id, 1),
      unit: 'Punkte',
      trackable: true,
    };
  }

  if (id.startsWith('rare_') || id.startsWith('epic_') || id.startsWith('legendary_')) {
    const rarity = id.startsWith('rare_') ? 'rare' : id.startsWith('epic_') ? 'epic' : 'legendary';
    const target = id === 'legendary_3_run' ? 3 : id.endsWith('_first') ? 1 : numberSuffix(id, 1);
    return {
      current: save.collected[rarity],
      target,
      unit: id === 'legendary_3_run' ? 'legendäre in einem Run' : `${rarity} Relikte`,
      trackable: id !== 'legendary_3_run',
    };
  }

  if (id.startsWith('collector_')) {
    return {
      current: totalRelics(save),
      target: numberSuffix(id, 1),
      unit: 'Relikte',
      trackable: true,
    };
  }

  if (id.startsWith('level_')) {
    return { current: save.level, target: numberSuffix(id, 1), unit: 'Level', trackable: true };
  }

  if (id.startsWith('world_traveller')) {
    return {
      current: unlockedWorlds(save.level).length,
      target: numberSuffix(id, 3),
      unit: 'Welten',
      trackable: true,
    };
  }

  if (id.startsWith('playtime_')) {
    return {
      current: Math.floor(save.totalPlayTimeMs / 60_000),
      target: PLAYTIME_TARGETS[id] ?? 60,
      unit: 'Minuten',
      trackable: true,
    };
  }

  if (id.startsWith('talents_')) {
    return {
      current: totalTalentRanks(save),
      target: numberSuffix(id, 1),
      unit: 'Ränge',
      trackable: true,
    };
  }

  if (id.startsWith('runs_')) {
    return { current: save.totalRuns, target: numberSuffix(id, 1), unit: 'Runs', trackable: true };
  }

  if (id.startsWith('clean_run_')) {
    return {
      current: 0,
      target: numberSuffix(id, 1),
      unit: 'Relikte in einem Run',
      trackable: false,
    };
  }

  return { current: 0, target: 1, unit: 'Ziel', trackable: false };
}

export function getAchievementProgress(
  achievement: AchievementDef,
  save: SaveData,
): AchievementProgress {
  const category = achievementCategory(achievement);
  const raw = progressFor(achievement, save);
  const current = Math.max(0, Math.floor(raw.current));
  const target = Math.max(1, Math.floor(raw.target));
  const format = (value: number): string => value.toLocaleString('de-DE');
  const value = raw.trackable
    ? `${format(Math.min(current, target))} / ${format(target)}`
    : `Ziel: ${format(target)}`;

  return {
    ...raw,
    category,
    current,
    target,
    label: `${value} ${raw.unit}`,
  };
}
