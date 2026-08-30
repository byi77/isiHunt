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
  /** Nicht ausgegebene, durch Levelaufstiege verdiente Talentpunkte. */
  talentPoints: number;
  /** Waehrung fuer Run-Belohnungen und den kosmetischen Shop. */
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
  /** Historische Buchhaltung frueherer Talent- und Resetkosten. */
  coinsSpent: number;
  /** Serverbestätigter Kalendertag des zuletzt abgeholten Login-Bonus. */
  lastLoginBonusKey: string | null;
  /** Lokaler Schlüssel des zuletzt abgeschlossenen Tageslaufs. */
  lastDailyKey: string | null;
  dailyBestScore: number;
  totalDailyRuns: number;
  /** Cloud-Nachholung, falls der Tagesbonus offline verdient wurde. */
  pendingDailyKey: string | null;
  /** Das zugehoerige Laufereignis muss vor dem Tagesbonus synchronisiert sein. */
  pendingDailyEventId: string | null;
  pendingDailyCoins: number;
  pendingDailyScore: number;
  /** Ueber alle Runs eingesammelte Relikte je Seltenheit. */
  collected: Record<RarityId, number>;
  unlockedAchievements: string[];
  lastWorldId: string;

  /** Im Laden gekaufte Schiffsformen. Der Pfeil ist immer dabei. */
  ownedShipShapes: string[];
  /** Im Laden gekaufte Farben. Die Weltfarbe ist immer dabei. */
  ownedShipColors: string[];
  /** Im Laden gekaufte Auren. "Keine" ist immer dabei. */
  ownedShipAuras: string[];
  /** Aktuell getragene Form. */
  shipShape: string;
  /** Aktuell getragene Farbe. */
  shipColor: string;
  /** Aktuell getragene Aura - die Bewegung der Figur. */
  shipAura: string;
  /** Kosmetik, die seit dem letzten Besuch im jeweiligen Shop-Reiter neu ist. */
  newCosmeticIds?: string[];
  /** Letzter Kauf fuer die sichtbare Rueckmeldung im Laden. */
  lastPurchasedCosmetic?: {
    category: 'shapes' | 'colors' | 'auras';
    id: string;
  } | null;
  /** Audio-Feedback in den Einstellungen ein- oder ausgeschaltet. */
  soundEnabled: boolean;
  /** Haptisches Feedback ist separat vom Ton schaltbar. */
  hapticsEnabled: boolean;

  /** Anzeigename im Profil und in der Bestenliste. Leer beim ersten Start. */
  playerName: string;
  /** Offline geaenderter Name, der noch serverseitig geprueft werden muss. */
  pendingPlayerName?: string | null;
  /**
   * Kennung dieses Spielstands im Online-Speicher.
   *
   * Zufaellige UUID, entsteht erst beim ersten Abgleich - wer nie synchronisiert,
   * hinterlaesst nichts. Zwei Geraete mit derselben Kennung teilen sich einen
   * Spielstand; genau das stellt der Sync-Code her.
   */
  cloudId: string | null;
  /** Revision des zuletzt gelesenen/geschriebenen Cloud-Saves fuer CAS. */
  cloudUpdatedAt?: string | null;
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
  /** Dauer des abgeschlossenen Runs; temporäre Duell-Talente können sie verlängern. */
  durationMs?: number;
  /** Lokaler Zeitpunkt des Run-Endes, auch für einen späteren Offline-Upload. */
  completedAt?: string;
}

/**
 * In welchem Modus ein Run laeuft.
 *
 * `solo` und `daily` schreiben Progression, `challenge` nicht - siehe
 * config/challenge.ts.
 */
export type RunMode = 'solo' | 'challenge' | 'daily' | 'bot';

export type ChallengeKind = 'duel' | 'daily' | 'bot' | 'duel-online';
export type BotDifficulty = 'easy' | 'normal' | 'hard';

/** Das Ergebnis eines einzelnen Duell-Durchgangs. */
export interface ChallengeRound {
  score: number;
  bestCombo: number;
  totalCollected: number;
}

/**
 * Zusaetzliche Angaben, die nur ein Netzwerk-Duell (`kind === 'duel-online'`)
 * braucht - Raum-Code, welcher der beiden Spieler dieses Geraet ist, und die
 * Zeitsynchronisation fuer den gemeinsamen Start.
 */
export interface OnlineDuelInfo {
  /** Raum-Code, ueber den beide Geraete denselben Realtime-Kanal finden. */
  roomCode: string;
  /** Kurzlebiges Capability-Token des serverseitig zugewiesenen Slots. */
  participantToken: string;
  /** 0 = Gastgeber (hat den Raum erzeugt), 1 = Beigetretener. */
  localPlayerIndex: 0 | 1;
  /** Anzeigenamen beider Geraete, an fester Spielerposition. */
  playerNames: [string | null, string | null];
  /** localTime + offset ergibt die geschaetzte Supabase-Serverzeit. */
  clockOffsetMs: number;
  /** Serverzeit (ms seit Epoch), zu der beide gleichzeitig starten sollen. */
  startAtServerMs: number | null;
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
  /** Spielart: klassisches Duell, Tageslauf, Bot-Gegner oder Netzwerk-Duell. */
  kind?: ChallengeKind;
  botDifficulty?: BotDifficulty;
  dailyKey?: string;
  dailyCompleted?: boolean;
  dailyRewardCoins?: number;
  dailyRewardXp?: number;
  dailyPerformanceTier?: number;
  /** Temporäre Talent-Builds je Spieler; bleiben nur im Duellzustand. */
  duelTalentDrafts?: TalentRanks[];
  /** Anzahl lokaler Spieler; alte Zustände ohne Feld bedeuten zwei. */
  playerCount?: number;
  /** Einmaliger Bonus für einen Sieg gegen den Bot. */
  botVictoryReward?: {
    coins: number;
    xp: number;
  };
  /** Serverseitige Generation des Netzwerk-Duells, wichtig fuer Rematches. */
  duelMatchNumber?: number;
  /** Nur bei kind === 'duel-online'. */
  online?: OnlineDuelInfo;
  /**
   * Nur bei kind === 'duel-online': Ergebnisse an fester Position
   * (Index = `OnlineDuelInfo.localPlayerIndex` des jeweiligen Spielers),
   * getrennt von `rounds`, weil sie unabhaengig voneinander eintreffen -
   * anders als beim lokalen Duell entscheidet nicht die Ankunftsreihenfolge
   * ueber die Spielerzuordnung. `rounds` wird erst befuellt, sobald beide
   * Positionen gesetzt sind, damit winnerIndex()/scoreToBeat() unveraendert
   * funktionieren.
   */
  onlineRounds?: [ChallengeRound | null, ChallengeRound | null];
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
  /** Nur fuer Tageslaeufe; der Server bindet den Bonus an dieses Event. */
  dailyKey?: string | null;
  createdAt: string;
}
