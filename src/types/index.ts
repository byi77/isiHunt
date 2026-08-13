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

  /** Anzeigename im Profil und in der Bestenliste. Leer beim ersten Start. */
  playerName: string;
  /**
   * Kennung dieses Spielstands im Online-Speicher.
   *
   * Zufaellige UUID, entsteht erst beim ersten Abgleich - wer nie synchronisiert,
   * hinterlaesst nichts. Zwei Geraete mit derselben Kennung teilen sich einen
   * Spielstand; genau das stellt der Sync-Code her.
   */
  cloudId: string | null;
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

/**
 * In welchem Modus ein Run laeuft.
 *
 * `solo` schreibt Progression, `challenge` nicht - siehe config/challenge.ts.
 */
export type RunMode = 'solo' | 'challenge';

/** Das Ergebnis eines einzelnen Duell-Durchgangs. */
export interface ChallengeRound {
  score: number;
  bestCombo: number;
  totalCollected: number;
}

/**
 * Ein laufendes Duell. `rounds` waechst mit jedem beendeten Durchgang; die
 * Laenge sagt zugleich, welcher Spieler als naechstes dran ist.
 */
export interface ChallengeState {
  /** Bestimmt die Relikt-Abfolge. Beide Spieler bekommen denselben. */
  seed: string;
  worldId: string;
  rounds: ChallengeRound[];
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
