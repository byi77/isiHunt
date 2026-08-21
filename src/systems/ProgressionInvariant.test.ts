import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_LEVEL, xpForLevel } from '@/config/GameConfig';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type * as ProgressionModule from '@/systems/ProgressionSystem';
import type * as SaveSystemModule from '@/systems/SaveSystem';
import type { RunStats, SaveData } from '@/types';

let Progression: typeof ProgressionModule;
let SaveSystem: typeof SaveSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  SaveSystem = await import('@/systems/SaveSystem');
  Progression = await import('@/systems/ProgressionSystem');
});

function run(overrides: Partial<RunStats> = {}): RunStats {
  return {
    worldId: DEFAULT_WORLD_ID,
    score: 0,
    bestCombo: 0,
    bestMultiplier: 1,
    collected: emptyRarityCounts(),
    totalCollected: 0,
    missed: 0,
    xpGained: 0,
    ...overrides,
  };
}

function remote(save: SaveData) {
  return {
    data: save,
    level: save.level,
    bestScore: save.bestScore,
    totalRuns: save.totalRuns,
    updatedAt: new Date().toISOString(),
  };
}

describe('Progressions-Invarianten', () => {
  it('lässt keine negativen Run-Werte in Coins, XP, Score oder Sammelstatistik durch', () => {
    const before = SaveSystem.load();
    const malformed = run({
      score: -500,
      bestCombo: -4,
      xpGained: -10_000,
      totalCollected: -50,
      missed: -3,
      durationMs: -90_000,
      collected: {
        ...emptyRarityCounts(),
        rare: -10,
        epic: Number.NaN,
        legendary: -2,
      },
    });

    expect(Progression.coinsForRun(malformed)).toBeGreaterThanOrEqual(0);
    Progression.applyRun(malformed);
    const after = SaveSystem.load();

    expect(after.coins).toBeGreaterThanOrEqual(before.coins);
    expect(after.xp).toBeGreaterThanOrEqual(0);
    expect(after.totalScore).toBeGreaterThanOrEqual(before.totalScore);
    expect(Object.values(after.collected).every((value) => value >= 0)).toBe(true);
    expect(after.totalPlayTimeMs).toBe(before.totalPlayTimeMs);
  });

  it('beendet XP-Fortschritt auf Maximalstufe ohne Rest-XP', () => {
    SaveSystem.update((data) => {
      data.level = MAX_LEVEL;
      data.xp = 999_999;
    });

    const result = Progression.applyDailyBonus(1_000_000, 1_000_000);
    const after = SaveSystem.load();

    expect(result.levelsGained).toBe(0);
    expect(after.level).toBe(MAX_LEVEL);
    expect(after.xp).toBe(0);
    expect(xpForLevel(MAX_LEVEL)).toBe(0);
  });

  it('hält die Sync-Richtung exklusiv, wenn genau ein Fortschrittsmarker steigt', async () => {
    const CloudSystem = await import('@/systems/CloudSystem');
    const local = SaveSystem.load();
    const markers: Partial<SaveData>[] = [
      { level: 2 },
      { bestScore: 100 },
      { totalRuns: 1 },
      { totalScore: 100 },
      { coins: 100, totalCoinsEarned: 100 },
      { talents: { reach: 1 } },
      { unlockedAchievements: ['first-run'] },
    ];

    for (const marker of markers) {
      const remoteSave = { ...local, ...marker };
      expect(CloudSystem.isRemoteAhead(local, remote(remoteSave))).toBe(true);
      expect(CloudSystem.isLocalAhead(local, remote(remoteSave))).toBe(false);
    }
  });

  it('lässt gleichauf liegende Spielstände in beide Richtungen neutral', async () => {
    const CloudSystem = await import('@/systems/CloudSystem');
    const save = SaveSystem.load();
    const copy = SaveSystem.normalizeForComparison(save);

    expect(CloudSystem.isRemoteAhead(save, remote(copy))).toBe(false);
    expect(CloudSystem.isLocalAhead(save, remote(copy))).toBe(false);
  });
});
