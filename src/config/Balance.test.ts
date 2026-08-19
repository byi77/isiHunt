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

  /**
   * Die Pruefung oben laesst `>=` zu und war damit blind fuer den Fall, der
   * 2026-08-19 auffiel: Die Welten 2 bis 5 standen alle auf
   * `difficultyScale: 1` - fuenf aufeinander folgende Welten ohne jede
   * mechanische Steigerung, und `1 >= 1` ist wahr. Eine Welt darf sich von
   * ihrer Vorgaengerin nicht nur durch Farbe und Modifikator unterscheiden.
   */
  it('macht jede Welt spuerbar schwerer als ihre Vorgaengerin', () => {
    for (let index = 1; index < WORLDS.length; index += 1) {
      const vorher = WORLDS[index - 1]!;
      const jetzt = WORLDS[index]!;

      expect(
        jetzt.difficultyScale,
        `${jetzt.name} ist nicht schwerer als ${vorher.name}`,
      ).toBeGreaterThan(vorher.difficultyScale);
    }
  });

  /**
   * Die Erschwernis muss bezahlt werden. Ohne diese Pruefung koennte eine
   * Welt schwerer werden, ohne mehr Punkte zu geben - dann waehlt sie
   * niemand freiwillig.
   */
  it('bezahlt jede Erschwernis mit mehr Punkten und XP', () => {
    for (let index = 1; index < WORLDS.length; index += 1) {
      const vorher = WORLDS[index - 1]!;
      const jetzt = WORLDS[index]!;

      expect(jetzt.scoreMultiplier, `${jetzt.name} gibt nicht mehr Punkte`).toBeGreaterThan(
        vorher.scoreMultiplier,
      );
      expect(jetzt.xpMultiplier, `${jetzt.name} gibt nicht mehr XP`).toBeGreaterThan(
        vorher.xpMultiplier,
      );
    }
  });

  it('haelt die Coin-Ziele der aktuellen Economy fest', () => {
    expect(COINS_PER_RUN).toBe(20);
    expect(DAILY_LOGIN_BONUS_COINS).toBe(25);
    expect(DAILY_COMPLETION_BONUS_COINS).toBe(90);
    expect(talentCost(0)).toBe(250);
    expect(talentCost(1)).toBe(350);
    expect(TALENT_RESET_COST).toBe(100);
  });
});
