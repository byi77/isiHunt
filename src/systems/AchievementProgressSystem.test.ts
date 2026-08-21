import { describe, expect, it } from 'vitest';

import { ACHIEVEMENTS } from '@/config/achievements';
import {
  achievementCategory,
  getAchievementProgress,
  getNextAchievement,
} from '@/systems/AchievementProgressSystem';
import { createDefaultSave } from '@/systems/SaveSystem';

function achievement(id: string) {
  return ACHIEVEMENTS.find((entry) => entry.id === id)!;
}

describe('AchievementProgressSystem', () => {
  it('ordnet historische Tageslauf-IDs korrekt ein und berechnet ihr Ziel', () => {
    const save = createDefaultSave();
    save.totalDailyRuns = 5;

    const progress = getAchievementProgress(achievement('combo_125'), save);

    expect(achievementCategory(achievement('combo_125'))).toBe('daily');
    expect(progress.label).toBe('5 / 7 Tagesläufe');
  });

  it('verwendet die fachlichen Score-Ziele statt der alten ID-Zahl', () => {
    const save = createDefaultSave();
    save.bestScore = 2_750;

    const progress = getAchievementProgress(achievement('score_5000'), save);

    expect(progress.target).toBe(3_000);
    expect(progress.label).toBe('2.750 / 3.000 Punkte');
  });

  it('zeigt Run-only-Ziele ehrlich ohne erfundenen Gesamtfortschritt', () => {
    const save = createDefaultSave();
    save.collected.legendary = 12;

    const progress = getAchievementProgress(achievement('legendary_3_run'), save);

    expect(progress.trackable).toBe(false);
    expect(progress.label).toBe('Ziel: 3 legendäre in einem Run');
  });

  it('markiert das prozentual naechste gesperrte Ziel zentral', () => {
    const save = createDefaultSave();
    save.bestCombo = 9;
    save.unlockedAchievements = ['first_hunt'];

    expect(getNextAchievement(ACHIEVEMENTS, save)?.id).toBe('combo_10');
  });
});
