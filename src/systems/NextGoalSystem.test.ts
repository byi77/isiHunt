import { describe, expect, it } from 'vitest';

import { SHIP_SHAPES } from '@/config/shop';
import { getNextGoal } from '@/systems/NextGoalSystem';
import type { SaveData } from '@/types';

function save(overrides: Partial<SaveData> = {}): SaveData {
  return {
    version: 8,
    level: 1,
    xp: 0,
    talentPoints: 0,
    coins: 0,
    talents: {},
    bestScore: 0,
    bestScoreRecordedAt: null,
    bestCombo: 0,
    totalScore: 0,
    totalRuns: 0,
    totalPlayTimeMs: 0,
    totalCoinsEarned: 0,
    coinsSpent: 0,
    lastLoginBonusKey: null,
    lastDailyKey: null,
    dailyBestScore: 0,
    totalDailyRuns: 0,
    pendingDailyKey: null,
    pendingDailyEventId: null,
    pendingDailyCoins: 0,
    pendingDailyScore: 0,
    collected: { poor: 0, common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    unlockedAchievements: [],
    lastWorldId: 'silberhain',
    ownedShipShapes: ['arrow'],
    ownedShipColors: ['world'],
    ownedShipAuras: ['none'],
    shipShape: 'arrow',
    shipColor: 'world',
    shipAura: 'none',
    soundEnabled: false,
    hapticsEnabled: false,
    playerName: 'Test',
    cloudId: null,
    ...overrides,
  };
}

describe('NextGoalSystem', () => {
  it('priorisiert ein sofort kaufbares Talent', () => {
    const goal = getNextGoal(save({ coins: 250 }));

    expect(goal.kind).toBe('talent');
    expect(goal.title).toContain('Reichweite');
    expect(goal.detail).toContain('Rang 1');
  });

  it('zeigt ein nahes Gebiet vor einem weit entfernten Kaufziel', () => {
    const goal = getNextGoal(save({ level: 1, coins: 0 }));

    expect(goal.kind).toBe('world');
    expect(goal.title).toContain('Eisring');
  });

  it('zeigt die fehlenden Coins fuer den naechsten Talent-Rang', () => {
    const goal = getNextGoal(save({ level: 7, coins: 100 }));

    expect(goal.kind).toBe('talent');
    expect(goal.title).toContain('150');
  });

  it('faellt nach vollstaendigem Talent- und Formen-Ausbau auf den Tageslauf zurueck', () => {
    const allTalents = {
      reach: 5,
      swiftness: 5,
      magnetism: 4,
      endurance: 4,
      focus: 4,
      prospector: 3,
      insight: 5,
      fortune: 5,
      resonance: 3,
      shield: 3,
    } as const;
    const goal = getNextGoal(
      save({
        level: 100,
        talents: allTalents,
        ownedShipShapes: SHIP_SHAPES.map((shape) => shape.id),
      }),
    );

    expect(goal.kind).toBe('daily');
  });
});
