import { describe, expect, it } from 'vitest';

import { createDefaultSave } from '@/systems/SaveSystem';
import { getLevelUpRewardSummary } from '@/systems/LevelUpPresentationSystem';
import type { ProgressionResult } from '@/types';

function progression(overrides: Partial<ProgressionResult> = {}): ProgressionResult {
  return {
    levelsGained: 0,
    newLevel: 1,
    talentPointsGained: 0,
    coinsGained: 0,
    unlockedWorldIds: [],
    unlockedAchievementIds: [],
    isNewBestScore: false,
    ...overrides,
  };
}

describe('getLevelUpRewardSummary', () => {
  it('fasst Level, Level-Coins, Guthaben und neue Welt zusammen', () => {
    const save = createDefaultSave();
    save.level = 6;
    save.coins = 137;

    const summary = getLevelUpRewardSummary(
      save,
      progression({ levelsGained: 1, newLevel: 6, unlockedWorldIds: ['glutmark'] }),
    );

    expect(summary.isLevelUp).toBe(true);
    expect(summary.level).toBe(6);
    expect(summary.levelCoins).toBe(20);
    expect(summary.totalCoins).toBe(137);
    expect(summary.unlockedWorldNames).toEqual(['Glutnebel']);
  });

  it('meldet eine ab diesem Level kaufbare Aura genau beim Aufstieg', () => {
    const save = createDefaultSave();
    save.level = 50;
    save.coins = 25_000;

    const summary = getLevelUpRewardSummary(save, progression({ levelsGained: 1, newLevel: 50 }));

    expect(summary.availableAuraNames).toEqual(['Prismaflut']);
  });

  it('liefert bei einem normalen Run keinen Level-Up-Inhalt', () => {
    const summary = getLevelUpRewardSummary(createDefaultSave(), progression());

    expect(summary.isLevelUp).toBe(false);
    expect(summary.levelCoins).toBe(0);
    expect(summary.unlockedWorldNames).toEqual([]);
    expect(summary.availableAuraNames).toEqual([]);
  });
});
