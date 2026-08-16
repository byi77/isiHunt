/**
 * Charakterlevel, XP, Coins, Weltenfreischaltung und Achievements.
 *
 * Reine Logik ohne Phaser-Abhaengigkeit - dadurch komplett unit-testbar und
 * unabhaengig davon, ob ein Run gerade laeuft.
 */

import { ACHIEVEMENT_BY_ID, ACHIEVEMENTS } from '@/config/achievements';
import {
  COLLECTION_STEP_SIZE,
  COINS_PER_COLLECTION_STEP,
  COINS_PER_LEVEL,
  COINS_PER_RUN,
  MAX_LEVEL,
  MAX_COLLECTION_BONUS_COINS,
  TALENT_RESET_COST,
  xpForLevel,
} from '@/config/GameConfig';
import { TALENTS, talentCost, type TalentId } from '@/config/talents';
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

/** Coins bleiben wertvoll: Fangmenge und hochwertige Beute helfen, nicht Masse allein. */
export function coinsForRun(run: RunStats): number {
  const collectionBonus = Math.min(
    MAX_COLLECTION_BONUS_COINS,
    Math.floor(run.totalCollected / COLLECTION_STEP_SIZE) * COINS_PER_COLLECTION_STEP,
  );
  const rarityBonus =
    Math.floor(run.collected.rare / 5) +
    Math.floor(run.collected.epic / 2) * 2 +
    run.collected.legendary * 3;
  return COINS_PER_RUN + collectionBonus + rarityBonus;
}

function grantLevelReward(data: SaveData): number {
  data.talentPoints = 0;
  data.coins += COINS_PER_LEVEL;
  return COINS_PER_LEVEL;
}

export function getLevelProgress(save: SaveData): LevelProgress {
  if (save.level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, xpInLevel: 0, xpNeeded: 0, ratio: 1 };
  }

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
  const recordTimestamp = normalizedTimestamp(run.completedAt);
  const talentPointsGained = 0;
  let coinsGained = 0;
  const runCoins = coinsForRun(run);
  coinsGained += runCoins;

  const after = SaveSystem.update((data) => {
    data.totalRuns += 1;
    data.totalScore += run.score;
    data.totalPlayTimeMs += Math.max(0, run.durationMs ?? 0);
    data.bestScore = Math.max(data.bestScore, run.score);
    if (isNewBestScore) data.bestScoreRecordedAt = recordTimestamp;
    data.bestCombo = Math.max(data.bestCombo, run.bestCombo);
    data.lastWorldId = run.worldId;
    data.coins += runCoins;

    for (const [rarityId, count] of Object.entries(run.collected)) {
      data.collected[rarityId as keyof typeof data.collected] += count;
    }

    // XP verrechnen; mehrere Levelaufstiege in einem Run sind moeglich.
    data.xp += run.xpGained;
    let guard = 0;
    while (data.level < MAX_LEVEL && data.xp >= xpForLevel(data.level) && guard < MAX_LEVEL) {
      data.xp -= xpForLevel(data.level);
      data.level += 1;
      coinsGained += grantLevelReward(data);
      guard += 1;
    }

    // Auf Maximalstufe gibt es keinen unsichtbar anwachsenden XP-Vorrat.
    if (data.level >= MAX_LEVEL) {
      data.level = MAX_LEVEL;
      data.xp = 0;
    }
  });

  const levelsGained = after.level - levelBefore;

  const unlockedWorldIds = WORLDS.filter(
    (w) => w.unlockLevel > levelBefore && w.unlockLevel <= after.level,
  ).map((w) => w.id);

  // Achievements erst NACH der XP-Verrechnung pruefen: manche haengen am Level.
  const unlockedAchievementIds = evaluateAchievements(after, run);
  const achievementCoins = unlockedAchievementIds.reduce(
    (sum, id) => sum + (ACHIEVEMENT_BY_ID[id]?.coinReward ?? 0),
    0,
  );
  if (achievementCoins > 0) {
    SaveSystem.update((data) => {
      data.coins += achievementCoins;
    });
    coinsGained += achievementCoins;
  }

  SaveSystem.update((data) => {
    data.totalCoinsEarned += coinsGained;
  });

  return {
    levelsGained,
    newLevel: after.level,
    talentPointsGained,
    coinsGained,
    unlockedWorldIds,
    unlockedAchievementIds,
    isNewBestScore,
  };
}

/**
 * Gewaehrt den einmaligen Tageslauf-Bonus lokal. Der gleiche Schritt wird beim
 * naechsten Sync serverseitig wiederholt; die Merker im Save machen ihn
 * geraeteuebergreifend idempotent.
 */
export function applyDailyBonus(
  coins: number,
  xp: number,
): {
  coinsGained: number;
  xpGained: number;
  levelsGained: number;
} {
  const before = SaveSystem.load();
  const safeCoins = Math.max(0, Math.round(coins));
  const safeXp = Math.max(0, Math.round(xp));
  let totalCoinGain = safeCoins;

  const after = SaveSystem.update((data) => {
    data.coins += safeCoins;
    data.xp += safeXp;
    let guard = 0;
    while (data.level < MAX_LEVEL && data.xp >= xpForLevel(data.level) && guard < MAX_LEVEL) {
      data.xp -= xpForLevel(data.level);
      data.level += 1;
      totalCoinGain += grantLevelReward(data);
      guard += 1;
    }
    if (data.level >= MAX_LEVEL) data.xp = 0;
    data.totalCoinsEarned += totalCoinGain;
  });

  return {
    coinsGained: totalCoinGain,
    xpGained: safeXp,
    levelsGained: after.level - before.level,
  };
}

/** Bewahrt einen vom Run stammenden Zeitstempel, ohne kaputte Altwerte zu speichern. */
function normalizedTimestamp(value: string | undefined): string {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

/** Kauft genau einen Rang lokal; der Talentbildschirm validiert nicht blind. */
export function purchaseTalent(talentId: TalentId): SaveData | null {
  const talent = TALENTS.find((entry) => entry.id === talentId);
  if (!talent) return null;

  let purchased = false;
  const result = SaveSystem.update((data) => {
    const currentRank = data.talents[talentId] ?? 0;
    const cost = talentCost(currentRank);
    if (data.coins < cost || currentRank >= talent.maxRank) return;
    data.coins -= cost;
    data.coinsSpent += cost;
    data.talents[talentId] = currentRank + 1;
    purchased = true;
  });
  return purchased ? result : null;
}

/** Setzt alle Talentränge gegen die konfigurierte Reset-Gebühr zurück. */
export function resetTalents(): SaveData | null {
  if (SaveSystem.load().coins < TALENT_RESET_COST) return null;
  return SaveSystem.update((data) => {
    if (data.coins < TALENT_RESET_COST) return;
    data.coins -= TALENT_RESET_COST;
    data.coinsSpent += TALENT_RESET_COST;
    data.talents = {};
  });
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
    const currentLevel = Math.min(MAX_LEVEL, Math.max(1, data.level));
    const nextLevel = Math.min(MAX_LEVEL, currentLevel + Math.max(0, count));
    const gained = nextLevel - currentLevel;
    data.level = nextLevel;
    for (let index = 0; index < gained; index++) grantLevelReward(data);
    data.xp = 0;
  });
}
