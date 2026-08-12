/**
 * Charakterlevel, XP, Talentpunkte, Weltenfreischaltung und Achievements.
 *
 * Reine Logik ohne Phaser-Abhaengigkeit - dadurch komplett unit-testbar und
 * unabhaengig davon, ob ein Run gerade laeuft.
 */

import { ACHIEVEMENTS } from '@/config/achievements';
import { TALENT_POINTS_PER_LEVEL, xpForLevel } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressionResult, RunStats, SaveData } from '@/types';

/** XP-Fortschritt innerhalb des aktuellen Levels - fuer die HUD-Leiste. */
export interface LevelProgress {
  level: number;
  xpInLevel: number;
  xpNeeded: number;
  /** 0 bis 1. */
  ratio: number;
}

export function getLevelProgress(save: SaveData): LevelProgress {
  const xpNeeded = xpForLevel(save.level);
  return {
    level: save.level,
    xpInLevel: save.xp,
    xpNeeded,
    ratio: xpNeeded > 0 ? Math.min(save.xp / xpNeeded, 1) : 0,
  };
}

/**
 * Verrechnet einen abgeschlossenen Run mit dem Spielstand.
 *
 * Schreibt den Spielstand und liefert zurueck, was sich veraendert hat, damit
 * der Ergebnisbildschirm Levelaufstiege und neue Achievements feiern kann.
 */
export function applyRun(run: RunStats): ProgressionResult {
  const before = SaveSystem.load();
  const levelBefore = before.level;
  const isNewBestScore = run.score > before.bestScore;

  const after = SaveSystem.update((data) => {
    data.totalRuns += 1;
    data.totalScore += run.score;
    data.bestScore = Math.max(data.bestScore, run.score);
    data.bestCombo = Math.max(data.bestCombo, run.bestCombo);
    data.lastWorldId = run.worldId;

    for (const [rarityId, count] of Object.entries(run.collected)) {
      data.collected[rarityId as keyof typeof data.collected] += count;
    }

    // XP verrechnen; mehrere Levelaufstiege in einem Run sind moeglich.
    data.xp += run.xpGained;
    let guard = 0;
    while (data.xp >= xpForLevel(data.level) && guard < 100) {
      data.xp -= xpForLevel(data.level);
      data.level += 1;
      data.talentPoints += TALENT_POINTS_PER_LEVEL;
      guard += 1;
    }
  });

  const levelsGained = after.level - levelBefore;

  const unlockedWorldIds = WORLDS.filter(
    (w) => w.unlockLevel > levelBefore && w.unlockLevel <= after.level,
  ).map((w) => w.id);

  // Achievements erst NACH der XP-Verrechnung pruefen: manche haengen am Level.
  const unlockedAchievementIds = evaluateAchievements(after, run);

  return {
    levelsGained,
    newLevel: after.level,
    talentPointsGained: levelsGained * TALENT_POINTS_PER_LEVEL,
    unlockedWorldIds,
    unlockedAchievementIds,
    isNewBestScore,
  };
}

/** Prueft alle noch nicht freigeschalteten Achievements und speichert Treffer. */
function evaluateAchievements(save: SaveData, run: RunStats): string[] {
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (a) => !save.unlockedAchievements.includes(a.id) && a.check(save, run),
  ).map((a) => a.id);

  if (newlyUnlocked.length > 0) {
    SaveSystem.update((data) => {
      data.unlockedAchievements.push(...newlyUnlocked);
    });
  }

  return newlyUnlocked;
}

/** Debug-Hilfe: gewaehrt Level, ohne einen Run spielen zu muessen. */
export function grantLevels(count: number): SaveData {
  return SaveSystem.update((data) => {
    data.level += count;
    data.talentPoints += count * TALENT_POINTS_PER_LEVEL;
    data.xp = 0;
  });
}
