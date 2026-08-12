/** Gemeinsame Datenstrukturen, die von mehreren Systemen benutzt werden. */

import type { RarityId } from '@/config/rarities';
import type { TalentRanks } from '@/config/talents';

/**
 * Persistenter Spielstand (localStorage).
 *
 * WICHTIG: Diese Struktur ist versioniert. Jede breaking change erhoeht
 * SAVE_VERSION in GameConfig.ts und braucht eine Migration in SaveSystem.ts.
 */
export interface SaveData {
  version: number;
  level: number;
  /** XP innerhalb des aktuellen Levels, nicht kumulativ. */
  xp: number;
  talentPoints: number;
  talents: TalentRanks;
  bestScore: number;
  bestCombo: number;
  totalScore: number;
  totalRuns: number;
  /** Ueber alle Runs eingesammelte Relikte je Seltenheit. */
  collected: Record<RarityId, number>;
  unlockedAchievements: string[];
  lastWorldId: string;
}

/** Ergebnis eines einzelnen Runs - Eingabe fuer Progression und Achievements. */
export interface RunStats {
  worldId: string;
  score: number;
  bestCombo: number;
  bestMultiplier: number;
  collected: Record<RarityId, number>;
  totalCollected: number;
  /** Relikte, die verblasst sind, bevor sie eingesammelt wurden. */
  missed: number;
  xpGained: number;
}

/** Was ein Run an Progression ausgeloest hat - fuer den Ergebnisbildschirm. */
export interface ProgressionResult {
  levelsGained: number;
  newLevel: number;
  talentPointsGained: number;
  unlockedWorldIds: string[];
  unlockedAchievementIds: string[];
  isNewBestScore: boolean;
}
