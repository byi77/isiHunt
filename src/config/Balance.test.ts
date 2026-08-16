/** Regressionstests fuer die bewusst abgestufte Phase-5-Balance. */

import { describe, expect, it } from 'vitest';

import {
  COINS_PER_RUN,
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_LOGIN_BONUS_COINS,
  TALENT_RESET_COST,
} from '@/config/GameConfig';
import { talentCost } from '@/config/talents';
import { WORLDS } from '@/config/worlds';

describe('Phase-5-Balance', () => {
  it('laesst die ersten drei Welten ohne Zeitverlust-Hindernisse', () => {
    expect(WORLDS.slice(0, 3).every((world) => world.obstacleMode !== 'penalty')).toBe(true);
  });

  it('steigert Herausforderung und Belohnung gemeinsam', () => {
    for (let index = 1; index < WORLDS.length; index += 1) {
      expect(WORLDS[index]!.difficultyScale).toBeGreaterThanOrEqual(
        WORLDS[index - 1]!.difficultyScale,
      );
      expect(WORLDS[index]!.scoreMultiplier).toBeGreaterThanOrEqual(
        WORLDS[index - 1]!.scoreMultiplier,
      );
      expect(WORLDS[index]!.xpMultiplier).toBeGreaterThanOrEqual(WORLDS[index - 1]!.xpMultiplier);
    }
  });

  it('haelt die Coin-Ziele der aktuellen Economy fest', () => {
    expect(COINS_PER_RUN).toBe(20);
    expect(DAILY_LOGIN_BONUS_COINS).toBe(25);
    expect(DAILY_COMPLETION_BONUS_COINS).toBe(90);
    expect(talentCost(0)).toBe(250);
    expect(talentCost(1)).toBe(350);
    expect(TALENT_RESET_COST).toBe(200);
  });
});
