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
  /** Legacy-Feld aus der früheren Talentpunkt-Phase; bleibt für Migration. */
  talentPoints: number;
  /** Waehrung fuer Run-Belohnungen und Talentkäufe. */
  coins: number;
  talents: TalentRanks;
  bestScore: number;
  /** Zeitpunkt, zu dem der aktuelle Bestwert erspielt wurde. */
  bestScoreRecordedAt: string | null;
  bestCombo: number;
  totalScore: number;
  totalRuns: number;
  /** Gesamte abgeschlossene Solo-Spielzeit in Millisekunden. */
  totalPlayTimeMs: number;
  /** Alle im Spiel gutgeschriebenen Coins, inklusive Boni. */
  totalCoinsEarned: number;
  /** Alle für Talente und Resets ausgegebenen Coins. */
  coinsSpent: number;
  /** Lokaler Schlüssel des zuletzt abgeschlossenen Tageslaufs. */
  lastDailyKey: string | null;
  dailyBestScore: number;
  totalDailyRuns: number;
  /** Cloud-Nachholung, falls der Tagesbonus offline verdient wurde. */
  pendingDailyKey: string | null;
  pendingDailyCoins: number;
  pendingDailyScore: number;
  /** Ueber alle Runs eingesammelte Relikte je Seltenheit. */
  collected: Record<RarityId, number>;
  unlockedAchievements: string[];
  lastWorldId: string;
  /** Audio-Feedback in den Einstellungen ein- oder ausgeschaltet. */
  soundEnabled: boolean;

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
  /** Dauer des abgeschlossenen Runs; Challenge-Runs setzen diesen Wert nicht. */
  durationMs?: number;
  /** Lokaler Zeitpunkt des Run-Endes, auch für einen späteren Offline-Upload. */
  completedAt?: string;
}

/**
 * In welchem Modus ein Run laeuft.
 *
 * `solo` schreibt Progression, `challenge` nicht - siehe config/challenge.ts.
 */
export type RunMode = 'solo' | 'challenge' | 'daily' | 'bot';

export type ChallengeKind = 'duel' | 'daily' | 'bot';
export type BotDifficulty = 'easy' | 'normal' | 'hard';

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
  /** Spielart: klassisches Duell, Tageslauf oder Bot-Gegner. */
  kind?: ChallengeKind;
  botDifficulty?: BotDifficulty;
  dailyKey?: string;
  dailyCompleted?: boolean;
  dailyRewardCoins?: number;
}

/** Was ein Run an Progression ausgeloest hat - fuer den Ergebnisbildschirm. */
export interface ProgressionResult {
  levelsGained: number;
  newLevel: number;
  talentPointsGained: number;
  coinsGained: number;
  unlockedWorldIds: string[];
  unlockedAchievementIds: string[];
  isNewBestScore: boolean;
}

/** Ein abgeschlossener Solo-Run für den geräteübergreifenden Abgleich. */
export interface ProgressEvent {
  eventId: string;
  worldId: string;
  score: number;
  bestCombo: number;
  xpGained: number;
  durationMs: number;
  coinsGained: number;
  talentPointsGained: number;
  collected: Record<RarityId, number>;
  unlockedAchievementIds: string[];
  createdAt: string;
}
