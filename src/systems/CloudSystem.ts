/**
 * Bestenliste und Spielstand-Abgleich ueber Supabase.
 *
 * ## Zwei Grundsaetze
 *
 * **1. Das Netz darf das Spiel nie aufhalten.** Jede Funktion hier gibt ein
 * Ergebnisobjekt zurueck und wirft nie. Kein Fehlschlag - kein Empfang, kein
 * Dienst, keine Zugangsdaten - darf dazu fuehren, dass man nicht mehr spielen
 * kann. Online ist eine Zugabe, kein Bestandteil der Schleife.
 *
 * **2. Das Netz darf den Start nicht erzwingen.** Ohne Login bleibt der lokale
 * Spielstand gültig. Wer dasselbe Profil auf mehreren Geräten nutzen möchte,
 * kann sich freiwillig über Supabase Auth anmelden.
 *
 * Spielstaende werden nach einem Solo-Run automatisch hochgeladen. Ein
 * Netzwerkfehler bleibt dabei folgenlos: Der lokale Stand ist die Quelle, und
 * der naechste Start bzw. eine neue Verbindung versucht den Upload erneut.
 * Sobald ein Cloud-Stand weiter ist, entscheidet aber immer der Spieler.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  BACKEND_ANON_KEY,
  BACKEND_TIMEOUT_MS,
  BACKEND_URL,
  isBackendConfigured,
  LEADERBOARD_LIMIT,
  SYNC_CODE_ALPHABET,
  SYNC_CODE_LENGTH,
} from '@/config/backend';
import { totalXpForLevel } from '@/config/balance';
import { sanitizePlayerName } from '@/config/playerName';
import * as DebugSystem from '@/systems/DebugSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressEvent, SaveData } from '@/types';
import type { TalentId, TalentRanks } from '@/config/talents';

// --- Ergebnistypen ----------------------------------------------------------

/**
 * Ergebnis jeder Netzoperation.
 *
 * Bewusst kein `throw`: Aufrufer sind Scenes, und eine Scene, die eine Ausnahme
 * nicht faengt, reisst das Spiel mit. Ein Ergebnisobjekt zwingt dazu, den
 * Fehlerfall anzusehen.
 */
export type CloudResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface LeaderboardEntry {
  playerName: string;
  level: number;
  score: number;
  bestCombo: number;
  createdAt: string;
  /** In welcher Welt der Lauf stattfand - in der Gesamtliste als Farbmarke. */
  worldId: string;
  /** Serverseitig berechnet; die stabile Spieler-ID bleibt privat. */
  isOwn: boolean;
}

/** Eine serverseitig berechnete Platzierung fuer Online-Duelle. */
export interface DuelLeaderboardEntry {
  rank: number;
  playerName: string;
  rating: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  isOwn: boolean;
}

interface PendingLeaderboardScore {
  playerId: string;
  playerName: string;
  worldId: string;
  level: number;
  score: number;
  bestCombo: number;
  durationMs: number;
  collected: Record<string, number>;
  recordedAt: string;
}

const PENDING_LEADERBOARD_SCORE_PREFIX = 'isihunt.pending-leaderboard-score.v2.';
const PENDING_COSMETIC_SYNC_PREFIX = 'isihunt.pending-cosmetic-sync.v2.';
const LEGACY_PENDING_LEADERBOARD_SCORE_KEY = 'isihunt.pending-leaderboard-score.v1';
const LEGACY_PENDING_COSMETIC_SYNC_KEY = 'isihunt.pending-cosmetic-sync.v1';
const LEGACY_PENDING_QUARANTINE_PREFIX = 'isihunt.pending-unbound.v1.';

interface PendingCosmeticSync {
  identity: string;
  ownedShipShapes: string[];
  ownedShipColors: string[];
  ownedShipAuras: string[];
  shipShape: string;
  shipColor: string;
  shipAura: string;
  /** Monotoner Marker, damit der Server lokale Shop-Ausgaben nachbuchen kann. */
  coinsSpent: number;
}

function cosmeticSnapshot(save: SaveData = SaveSystem.load()): PendingCosmeticSync {
  const identity = currentOutboxIdentity(save);
  if (!identity) throw new Error('Kein Profil fuer den Kosmetik-Outbox-Eintrag');
  return {
    identity,
    ownedShipShapes: [...save.ownedShipShapes],
    ownedShipColors: [...save.ownedShipColors],
    ownedShipAuras: [...save.ownedShipAuras],
    shipShape: save.shipShape,
    shipColor: save.shipColor,
    shipAura: save.shipAura,
    coinsSpent: save.coinsSpent,
  };
}

function currentOutboxIdentity(save: SaveData = SaveSystem.load()): string | null {
  return AuthSystem.currentUserId() ?? save.cloudId;
}

function outboxKey(prefix: string, identity: string): string {
  return `${prefix}${encodeURIComponent(identity)}`;
}

function quarantineLegacyOutbox(key: string, label: string): void {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const quarantineKey = `${LEGACY_PENDING_QUARANTINE_PREFIX}${label}`;
      if (!window.localStorage.getItem(quarantineKey)) {
        window.localStorage.setItem(quarantineKey, raw);
      }
      window.localStorage.removeItem(key);
    }
  } catch {
    // Privater Browsermodus darf keinen Kauf/Run blockieren.
  }
}

function readPendingCosmeticSync(identity = currentOutboxIdentity()): PendingCosmeticSync | null {
  quarantineLegacyOutbox(LEGACY_PENDING_COSMETIC_SYNC_KEY, 'cosmetic');
  if (!identity) return null;
  try {
    const raw = window.localStorage.getItem(outboxKey(PENDING_COSMETIC_SYNC_PREFIX, identity));
    if (!raw) return null;
    const value = recordFrom(JSON.parse(raw));
    if (!value) return null;
    const arrays = ['ownedShipShapes', 'ownedShipColors', 'ownedShipAuras'].map((key) => {
      const entries = value[key];
      return Array.isArray(entries)
        ? [...new Set(entries.filter((entry): entry is string => typeof entry === 'string'))]
        : [];
    });
    if (
      typeof value.shipShape !== 'string' ||
      typeof value.shipColor !== 'string' ||
      typeof value.shipAura !== 'string'
    ) {
      return null;
    }
    const pending = {
      identity,
      ownedShipShapes: arrays[0]!,
      ownedShipColors: arrays[1]!,
      ownedShipAuras: arrays[2]!,
      shipShape: value.shipShape,
      shipColor: value.shipColor,
      shipAura: value.shipAura,
      coinsSpent: finiteNonNegative(value.coinsSpent),
    };
    return value.identity === identity ? pending : null;
  } catch {
    return null;
  }
}

/** Merkt den aktuellen Kosmetikstand fuer den naechsten Online-Abgleich vor. */
export function queueCosmeticSync(save: SaveData = SaveSystem.load()): void {
  const identity = currentOutboxIdentity(save);
  if (!identity) return;
  try {
    window.localStorage.setItem(
      outboxKey(PENDING_COSMETIC_SYNC_PREFIX, identity),
      JSON.stringify(cosmeticSnapshot(save)),
    );
  } catch {
    // Privater Browsermodus darf den Kauf nicht blockieren.
  }
}

export function clearPendingCosmeticSync(identity = currentOutboxIdentity()): void {
  if (!identity) return;
  try {
    window.localStorage.removeItem(outboxKey(PENDING_COSMETIC_SYNC_PREFIX, identity));
  } catch {
    // Siehe queueCosmeticSync.
  }
}

export function hasPendingCosmeticSync(identity = currentOutboxIdentity()): boolean {
  return readPendingCosmeticSync(identity) !== null;
}

function readPendingLeaderboardScore(
  playerId = currentOutboxIdentity(),
): PendingLeaderboardScore | null {
  quarantineLegacyOutbox(LEGACY_PENDING_LEADERBOARD_SCORE_KEY, 'leaderboard');
  if (!playerId) return null;
  try {
    const raw = window.localStorage.getItem(outboxKey(PENDING_LEADERBOARD_SCORE_PREFIX, playerId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingLeaderboardScore>;
    if (!value.playerId || !value.playerName || !value.worldId || !Number.isFinite(value.score)) {
      return null;
    }
    return {
      ...value,
      recordedAt: normalizedRecordTimestamp(value.recordedAt ?? new Date().toISOString()),
    } as PendingLeaderboardScore;
  } catch {
    return null;
  }
}

function savePendingLeaderboardScore(score: PendingLeaderboardScore): void {
  const existing = readPendingLeaderboardScore(score.playerId);
  if (existing && existing.playerId === score.playerId && existing.score > score.score) return;
  try {
    window.localStorage.setItem(
      outboxKey(PENDING_LEADERBOARD_SCORE_PREFIX, score.playerId),
      JSON.stringify(score),
    );
  } catch {
    // Privater Browsermodus darf einen Lauf nicht beeintraechtigen.
  }
}

function clearPendingLeaderboardScore(playerId = currentOutboxIdentity()): void {
  if (!playerId) return;
  try {
    window.localStorage.removeItem(outboxKey(PENDING_LEADERBOARD_SCORE_PREFIX, playerId));
  } catch {
    // Siehe savePendingLeaderboardScore.
  }
}

/** Ob ein offline erspielter Ranglisten-Bestwert noch hochgeladen werden muss. */
export function hasPendingLeaderboardScore(playerId = currentOutboxIdentity()): boolean {
  return readPendingLeaderboardScore(playerId) !== null;
}

/**
 * Kurzfassung eines Spielstands - genug, um zwei Staende zu unterscheiden.
 *
 * Die Nutzlast dazu (`RemoteSave.data`) kommt **unnormalisiert** vom Server.
 *
 * Der Typ ist `SaveData`, weil die Aufrufer die Felder direkt anzeigen
 * (`data.level` im Menue, im Sync-Vergleich, im Debug-Bericht) und ein
 * `unknown` dort nur ueberall Zusicherungen erzwingen wuerde. Die Garantie
 * liefert er aber nicht: Was hier ankommt, ist eine RPC-Antwort.
 *
 * **Wer diese Daten in den Spielstand uebernimmt, muss sie durch
 * `SaveSystem.adoptRemote()` bzw. `adoptProfileProgress()` schicken** - dort
 * laeuft `migrate()` und damit die Feldauffuellung und Wertpruefung. Direkt
 * gespeichert werden duerfen sie nie.
 *
 * Bewusst nicht hier normalisiert: `migrate()` traegt die
 * Versionsmigrationen, und die duerfen genau einmal laufen. Ein zweiter
 * Durchlauf rechnet bereits umgerechnete XP erneut um und senkt dabei das
 * Level - derselbe Mechanismus, der ueber einen falschen Versionsmarker
 * schon einmal zugeschlagen hat (Audit 2026-08-23, `phase_2_18`).
 */
export interface RemoteSaveSummary {
  level: number;
  bestScore: number;
  totalRuns: number;
  updatedAt: string;
}

export interface RemoteSave extends RemoteSaveSummary {
  data: SaveData;
}

export interface RemoteProfileProgress {
  data: SaveData;
  totalXp: number;
  updatedAt: string;
}

export interface DailyLoginClaim {
  claimed: boolean;
  profile: RemoteProfileProgress | null;
}

/** Eine Zeile der ausschließlich serverseitig autorisierten Wartungsansicht. */
export interface AdminUserStats {
  playerName: string;
  level: number;
  totalRuns: number;
  totalPlayTimeMs: number;
  totalCoinsEarned: number;
  currentCoins: number;
  totalDailyRuns: number;
  totalXp: number;
  bestScore: number;
  bestCombo: number;
  achievementCount: number;
  updatedAt: string;
}

/** Aggregierte Nutzung ohne Zugriff auf private Spielstand-Rohdaten. */
export interface AdminDashboard {
  profileCount: number;
  playedProfileCount: number;
  totalRuns: number;
  totalPlayTimeMs: number;
  totalCoinsEarned: number;
  totalCoinsHeld: number;
  totalDailyRuns: number;
  totalXp: number;
  totalAchievements: number;
  highestScore: number;
  users: AdminUserStats[];
}

/**
 * Zahlen aus RPC-/REST-Antworten sind nicht vertrauenswuerdig: Supabase kann
 * bei einer geaenderten SQL-Funktion `null`, Strings oder sogar Werte liefern,
 * die nach `Number()` zu `NaN` werden. `NaN` darf nie in Spielstand oder UI
 * gelangen, weil es dort jede weitere Berechnung unbrauchbar macht.
 */
function finiteNonNegative(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Normalisiert und validiert die Nutzlast von `get_save`. */
export function normalizeRemoteSave(raw: unknown): RemoteSave | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const value = recordFrom(row);
  const data = recordFrom(value?.data);
  if (!value || !data) return null;

  return {
    // Unvalidiert - siehe `RemoteSaveSummary`. Die Pruefung liegt bei
    // `SaveSystem.adoptRemote()`, nicht hier.
    data: data as unknown as SaveData,
    level: Math.max(1, finiteNonNegative(value.level, 1)),
    bestScore: finiteNonNegative(value.best_score),
    totalRuns: finiteNonNegative(value.total_runs),
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : '',
  };
}

/** Normalisiert eine Profil-RPC-Antwort; fehlerhafte Antworten werden verworfen. */
export function normalizeProfileProgress(raw: unknown): RemoteProfileProgress | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const value = recordFrom(row);
  const data = recordFrom(value?.data);
  if (!value || !data) return null;

  return {
    // Unvalidiert - siehe `RemoteSaveSummary`. Die Pruefung liegt bei
    // `SaveSystem.adoptProfileProgress()`, nicht hier.
    data: data as unknown as SaveData,
    totalXp: finiteNonNegative(value.total_xp),
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : '',
  };
}

/** Normalisiert die aggregierte Admin-Antwort und filtert kaputte Userzeilen. */
export function normalizeAdminDashboard(raw: unknown): AdminDashboard | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const dashboard = recordFrom(value);
  if (!dashboard) return null;

  const users = Array.isArray(dashboard.users)
    ? dashboard.users.flatMap((entry): AdminUserStats[] => {
        const user = recordFrom(entry);
        if (!user) return [];
        return [
          {
            playerName: typeof user.playerName === 'string' ? user.playerName : 'Ohne Namen',
            level: Math.max(1, finiteNonNegative(user.level, 1)),
            totalRuns: finiteNonNegative(user.totalRuns),
            totalPlayTimeMs: finiteNonNegative(user.totalPlayTimeMs),
            totalCoinsEarned: finiteNonNegative(user.totalCoinsEarned),
            currentCoins: finiteNonNegative(user.currentCoins),
            totalDailyRuns: finiteNonNegative(user.totalDailyRuns),
            totalXp: finiteNonNegative(user.totalXp),
            bestScore: finiteNonNegative(user.bestScore),
            bestCombo: finiteNonNegative(user.bestCombo),
            achievementCount: finiteNonNegative(user.achievementCount),
            updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : '',
          },
        ];
      })
    : [];

  return {
    profileCount: finiteNonNegative(dashboard.profileCount),
    playedProfileCount: finiteNonNegative(dashboard.playedProfileCount),
    totalRuns: finiteNonNegative(dashboard.totalRuns),
    totalPlayTimeMs: finiteNonNegative(dashboard.totalPlayTimeMs),
    totalCoinsEarned: finiteNonNegative(dashboard.totalCoinsEarned),
    totalCoinsHeld: finiteNonNegative(dashboard.totalCoinsHeld),
    totalDailyRuns: finiteNonNegative(dashboard.totalDailyRuns),
    totalXp: finiteNonNegative(dashboard.totalXp),
    totalAchievements: finiteNonNegative(dashboard.totalAchievements),
    highestScore: finiteNonNegative(dashboard.highestScore),
    users,
  };
}

/**
 * Summe aller Talentraenge - ein Kauf auf einem anderen Geraet aendert oft
 * weder Level noch Bestwert noch Coins (die sind ja gerade dafuer ausgegeben),
 * bliebe ohne diese Summe fuer den Vergleich unsichtbar.
 */
function totalTalentRanks(talents: TalentRanks): number {
  return Object.values(talents).reduce((sum: number, rank) => sum + (rank ?? 0), 0);
}

/**
 * Bringt einen Cloud-Stand auf die aktuelle Fassung, bevor verglichen wird.
 *
 * **Warum das noetig ist.** Ein Stand, der vor einer Migration hochgeladen
 * wurde, traegt noch die alten Werte. Der lokale Stand ist beim Vergleich
 * dagegen immer schon migriert (`load()` migriert beim Lesen). Ohne diese
 * Angleichung vergleicht man zwei verschiedene Zeitrechnungen.
 *
 * Konkret passiert nach SAVE_VERSION 7: Der Server lieferte Level 20, lokal
 * stand nach der XP-Umstellung 14. Der Remote-Stand galt damit als voraus,
 * `adoptRemote()` migrierte ihn beim Uebernehmen aber wieder auf 14 - und
 * beim naechsten Durchlauf begann alles von vorn. Ergebnis: ein
 * Sync-Popup, das sich endlos wiederholte, samt Scene-Neustart.
 */
function normalizedPair(
  local: SaveData,
  remote: RemoteSave,
): { lokal: SaveData; fern: SaveData; fernLevel: number } {
  // BEIDE Seiten angleichen, nicht nur die entfernte. Ein einseitiger Aufruf
  // wuerde einen bereits migrierten lokalen Stand gegen einen soeben
  // migrierten Cloud-Stand stellen und dabei genau die Verzerrung erzeugen,
  // die hier verhindert werden soll - nur mit umgekehrtem Vorzeichen.
  // `normalizeForComparison` ist fuer einen aktuellen Stand ein No-op.
  const fern = SaveSystem.normalizeForComparison(remote.data);
  return {
    lokal: SaveSystem.normalizeForComparison(local),
    fern,
    fernLevel: fern.level,
  };
}

/**
 * Alle jemals verdienten Muenzen - Kontostand plus Ausgegebenes.
 *
 * **Warum nicht der blosse Kontostand.** Wer im Laden kauft, hat danach
 * weniger Muenzen als die Cloud kennt. Ein Vergleich ueber `coins` allein
 * haelt den Cloud-Stand deshalb faelschlich fuer weiter, uebernimmt ihn - und
 * macht den Kauf damit rueckgaengig. Genau das war zu sehen: Die gekaufte
 * Figur blitzte im Menue kurz auf und sprang auf den Standard zurueck.
 *
 * Ausgeben ist kein Rueckschritt, sondern eine Umwandlung. Die Summe aus
 * beidem waechst monoton und ist damit der richtige Fortschrittsmarker.
 */
function totalCoinsEver(save: { coins?: number; coinsSpent?: number }): number {
  return Number(save.coins ?? 0) + Number(save.coinsSpent ?? 0);
}

/**
 * Wurde dieses Profil serverseitig zurueckgesetzt?
 *
 * **Warum das eine eigene Frage ist.** `isRemoteAhead()` fragt "ist die Cloud
 * weiter?" - ein zurueckgesetzter Stand ist das nie. Nach einem Reset ueber
 * die Benutzerverwaltung passierte deshalb gar nichts: Der leere Cloud-Stand
 * galt als Rueckschritt, der lokale blieb stehen, und der naechste Lauf lud
 * die alten Werte samt Ladenkaeufen wieder hoch. Der Reset war damit
 * wirkungslos.
 *
 * Ein Reset ist kein Rueckschritt, sondern eine Anweisung. Er muss uebernommen
 * werden, auch wenn lokal mehr steht.
 *
 * Erkannt an einem vollstaendig leeren Cloud-Stand bei bespieltem lokalem
 * Stand: Ein frisch angelegtes Profil sieht zwar genauso aus, aber dort ist
 * auch lokal nichts gespielt - und dann gibt es nichts zu ueberschreiben.
 */
export function isRemoteReset(local: SaveData, remote: RemoteSave): boolean {
  const { lokal, fern } = normalizedPair(local, remote);

  // Nur Felder pruefen, die der Login-Bonus nicht anfasst.
  //
  // Ein erster Anlauf nahm `coins === 0` als Teil des Signals. Das hielt nicht
  // einmal zwei Sekunden: `claim_daily_login_bonus()` laeuft direkt nach jedem
  // Abgleich und schreibt +25 Muenzen. Im Debug-Report war der Reset deshalb
  // genau einen Sync lang als `remoteCoins: 0` zu sehen und danach wieder 25.
  //
  // Der Bonus aendert ausschliesslich `coins`, `totalCoinsEarned` und
  // `lastLoginBonusKey`. Level, XP, Runs und Bestwert bleiben unberuehrt und
  // sind damit die verlaesslichen Marker.
  const fernLeer =
    fern.level === 1 &&
    fern.xp === 0 &&
    fern.totalRuns === 0 &&
    fern.totalScore === 0 &&
    fern.bestScore === 0 &&
    fern.unlockedAchievements.length === 0;

  // Der lokale Stand muss etwas haben, das der ferne nicht hat.
  //
  // Ein zweiter Anlauf verlangte hier Spielzeit (`totalRuns > 0`). Auch das
  // war zu eng: Wer bereits einmal zurueckgesetzt wurde, steht selbst auf
  // Stufe 1 ohne Runs - und trotzdem koennen Ladenkaeufe offen sein, weil die
  // ueber ein anderes Feld laufen. Der Besitz gehoert deshalb mit ins Signal.
  //
  // ALLE DREI Besitzkategorien pruefen, nicht nur zwei. Die Auren kamen als
  // dritte Kategorie dazu und fehlten hier: Wer ausschliesslich eine Aura
  // gekauft hatte (neun der zehn stehen ohne Mindestlevel im Laden, also
  // schon auf Stufe 1 erreichbar), loeste kein Reset-Signal aus. Der leere
  // Cloud-Stand galt als Rueckschritt, der lokale blieb stehen und wurde
  // wieder hochgeladen - der Reset war wirkungslos (Audit 2026-08-23).
  const lokalHatMehr =
    lokal.totalRuns > 0 ||
    lokal.level > 1 ||
    lokal.bestScore > 0 ||
    lokal.unlockedAchievements.length > 0 ||
    lokal.ownedShipShapes.length > fern.ownedShipShapes.length ||
    lokal.ownedShipColors.length > fern.ownedShipColors.length ||
    lokal.ownedShipAuras.length > fern.ownedShipAuras.length;

  return fernLeer && lokalHatMehr;
}

/** Vergleicht die Fortschrittsmarker, die fuer den Nutzer sichtbar sind. */
export function isRemoteAhead(local: SaveData, remote: RemoteSave): boolean {
  const { lokal, fern, fernLevel } = normalizedPair(local, remote);
  return (
    fernLevel > lokal.level ||
    fern.bestScore > lokal.bestScore ||
    fern.totalRuns > lokal.totalRuns ||
    fern.totalScore > lokal.totalScore ||
    totalCoinsEver(fern) > totalCoinsEver(lokal) ||
    totalXpForSave(fern) > totalXpForSave(lokal) ||
    totalTalentRanks(fern.talents) > totalTalentRanks(lokal.talents) ||
    fern.unlockedAchievements.length > lokal.unlockedAchievements.length
  );
}

/** Das Gegenstueck fuer einen sicheren Upload nach Offline-Zeit. */
export function isLocalAhead(local: SaveData, remote: RemoteSave): boolean {
  const { lokal, fern, fernLevel } = normalizedPair(local, remote);
  return (
    lokal.level > fernLevel ||
    lokal.bestScore > fern.bestScore ||
    lokal.totalRuns > fern.totalRuns ||
    lokal.totalScore > fern.totalScore ||
    totalCoinsEver(lokal) > totalCoinsEver(fern) ||
    totalXpForSave(lokal) > totalXpForSave(fern) ||
    totalTalentRanks(lokal.talents) > totalTalentRanks(fern.talents) ||
    lokal.unlockedAchievements.length > fern.unlockedAchievements.length
  );
}

function totalXpForSave(save: SaveData): number {
  return totalXpForLevel(save.level) + save.xp;
}

// --- Client ------------------------------------------------------------------

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isBackendConfigured) return null;

  client ??= createClient(BACKEND_URL, BACKEND_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
}

function getClient(): SupabaseClient | null {
  return getSupabaseClient();
}

export function isAvailable(): boolean {
  return isBackendConfigured;
}

/**
 * Legt ein Zeitlimit ueber eine Anfrage.
 *
 * Supabase bricht von sich aus nicht ab. Ohne Limit wartet der Sync-Bildschirm
 * bei schlechtem Empfang unbegrenzt auf eine Antwort, die nie kommt.
 */
/**
 * Jeder Backend-Aufruf laeuft hier durch - der zentrale Punkt, um Erfolg UND
 * Fehlschlag automatisch im Debug-Ringpuffer festzuhalten, ohne bei jedem
 * neuen Bug erneut manuell Logging nachruesten zu muessen. Vorher wurde nur
 * der Fehlerfall geloggt (via console.warn); "kein Fehler-Log" war dadurch
 * mehrfach mit "kein Problem" verwechselbar - siehe TODO.md, Boost-Bug
 * 2026-08-18, drei Diagnoserunden bis zur echten Ursache. Bewusst ohne
 * Nutzlast (Session-Token o.ae. duerfen nicht im Klartext im Ringpuffer
 * landen) - nur Label, Erfolg/Fehlschlag und Dauer.
 */
async function withTimeout<T>(operation: PromiseLike<T>, label: string): Promise<CloudResult<T>> {
  const startedAt = Date.now();
  let timeoutId: number | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error('Zeitüberschreitung')),
        BACKEND_TIMEOUT_MS,
      );
    });

    const value = await Promise.race([operation, timeout]);
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'event',
      label: `cloud:${label}`,
      detail: `ok ${Date.now() - startedAt}ms`,
    });
    return { ok: true, value };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: `cloud:${label}`,
      detail: `fehlgeschlagen ${Date.now() - startedAt}ms: ${reason}`,
    });
    console.warn(`[CloudSystem] ${label} fehlgeschlagen:`, error);
    return { ok: false, error: `${label}: ${reason}` };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

// --- Bestenliste -------------------------------------------------------------

/**
 * Beste Ergebnisse, absteigend.
 *
 * Ohne `worldId` ueber **alle** Welten hinweg - das ist der Normalfall. Eine
 * Liste je Welt zersplittert den Wettbewerb: Bei fuenf Welten und drei
 * Spielern steht ueberall jeder auf Platz eins, und niemand vergleicht sich
 * mit irgendwem.
 *
 * Mit `worldId` wird gefiltert; das ist der Sonderfall fuer die Weltentabs.
 *
 * **Ehrliche Grenze:** Eine Gesamtliste setzt voraus, dass die Welten
 * mechanisch gleich sind. Heute sind sie das (GAME_DESIGN.md 7.3). Mit den
 * Weltmodifikatoren aus M3 - Sonnenhort mit doppelter Legendaer-Chance - endet
 * das, und die Liste braucht entweder eine Normalisierung oder wieder eine
 * Trennung.
 */
export async function fetchLeaderboard(worldId?: string): Promise<CloudResult<LeaderboardEntry[]>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('get_public_leaderboard', {
      p_world_id: worldId ?? null,
      p_access_token: SaveSystem.getCloudAccessToken(),
      p_limit: LEADERBOARD_LIMIT,
    }),
    'Bestenliste laden',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const rows: Record<string, unknown>[] = Array.isArray(result.value.data)
    ? (result.value.data as Record<string, unknown>[])
    : [];
  return {
    ok: true,
    value: rows.map((row) => ({
      playerName: String(row.player_name),
      // Wie beim Sync-Vergleich: Diese Zahlen werden direkt angezeigt, hier
      // in der Bestenliste. `Number(null)` ergaebe stillschweigend 0, ein
      // String ergaebe NaN - beides stuende so in der Liste.
      level: Math.max(1, finiteNonNegative(row.player_level, 1)),
      score: finiteNonNegative(row.score),
      bestCombo: finiteNonNegative(row.best_combo),
      createdAt: String(row.created_at),
      worldId: String(row.world_id),
      isOwn: row.is_own === true,
    })),
  };
}

/**
 * Laedt die getrennte Mehrspieler-Rangliste fuer Online-Duelle.
 *
 * Die Wertung kennt bewusst keine Weltfilter: Ein Match mit zwei, drei oder
 * vier Teilnehmern wird serverseitig als ein gemeinsames Ergebnis gewertet.
 */
export async function fetchDuelLeaderboard(): Promise<CloudResult<DuelLeaderboardEntry[]>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('get_duel_leaderboard', { p_limit: LEADERBOARD_LIMIT }),
    'Duell-Bestenliste laden',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const rows: Record<string, unknown>[] = Array.isArray(result.value.data)
    ? (result.value.data as Record<string, unknown>[])
    : [];
  return {
    ok: true,
    value: rows.map((row) => ({
      rank: Math.max(1, finiteNonNegative(row.rank, 1)),
      playerName: String(row.player_name),
      rating: Math.max(100, finiteNonNegative(row.rating, 1000)),
      matches: finiteNonNegative(row.matches),
      wins: finiteNonNegative(row.wins),
      losses: finiteNonNegative(row.losses),
      draws: finiteNonNegative(row.draws),
      isOwn: row.is_own === true,
    })),
  };
}

/**
 * Meldet einen Lauf fuer dieses Profil.
 *
 * Die Datenbankfunktion haelt pro `playerId` genau einen Datensatz und ersetzt
 * darin nur dann Score/Welt/Combo, wenn der neue Lauf besser ist. Die ID ist
 * die bestehende Cloud-Kennung des Spielstands und bleibt beim Sync erhalten.
 */
export async function submitScore(
  playerId: string,
  playerName: string,
  worldId: string,
  level: number,
  score: number,
  bestCombo: number,
  durationMs: number,
  collected: Record<string, number>,
  recordedAt: string,
): Promise<CloudResult<true>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const name = sanitizePlayerName(playerName);
  if (!name) return { ok: false, error: 'Kein Name angegeben' };
  if (!playerId) return { ok: false, error: 'Kein Spielerprofil angegeben' };

  const scoreArgs = {
    p_player_id: playerId,
    p_player_name: name,
    p_world_id: worldId,
    p_player_level: Math.max(1, Math.round(level)),
    p_score: Math.max(0, Math.round(score)),
    p_best_combo: Math.max(0, Math.round(bestCombo)),
    p_duration_ms: Math.max(0, Math.round(durationMs)),
    p_collected: collected,
  };
  const accessToken =
    playerId === SaveSystem.load().cloudId
      ? SaveSystem.ensureCloudAccessToken()
      : SaveSystem.getCloudAccessToken();
  const result = await withTimeout(
    supabase.rpc('submit_best_score', {
      ...scoreArgs,
      p_access_token: accessToken,
      p_recorded_at: normalizedRecordTimestamp(recordedAt),
    }),
    'Bestwert eintragen',
  );

  if (!result.ok) return result;
  if (!result.value.error) return { ok: true, value: true };
  return { ok: false, error: result.value.error.message };
}

/**
 * Bewahrt einen nicht zugestellten Bestwert lokal auf und versucht ihn beim
 * naechsten Menue-Start erneut. Ohne Login darf gespielt werden; die
 * Bestenliste braucht aber eine erreichbare Datenbank in genau diesem Moment.
 */
export async function submitScoreSafely(
  playerId: string,
  playerName: string,
  worldId: string,
  level: number,
  score: number,
  bestCombo: number,
  durationMs: number,
  collected: Record<string, number>,
  recordedAt: string,
): Promise<CloudResult<true>> {
  const pending: PendingLeaderboardScore = {
    playerId,
    playerName,
    worldId,
    level,
    score,
    bestCombo,
    durationMs,
    collected,
    recordedAt: normalizedRecordTimestamp(recordedAt),
  };
  try {
    const result = await submitScore(
      playerId,
      playerName,
      worldId,
      level,
      score,
      bestCombo,
      durationMs,
      collected,
      pending.recordedAt,
    );
    if (result.ok) {
      const existing = readPendingLeaderboardScore(playerId);
      if (!existing || (existing.playerId === playerId && existing.score <= score)) {
        clearPendingLeaderboardScore(playerId);
      }
    } else {
      savePendingLeaderboardScore(pending);
    }
    return result;
  } catch {
    savePendingLeaderboardScore(pending);
    return { ok: false, error: 'Bestwert wird beim naechsten Start erneut versucht' };
  }
}

/** Versucht einen nach Netz- oder Serverfehler vorgemerkten Bestwert erneut. */
export async function flushPendingLeaderboardScore(): Promise<void> {
  const identity = currentOutboxIdentity();
  const pending = readPendingLeaderboardScore(identity);
  if (!pending || !isAvailable()) return;
  const result = await submitScoreSafely(
    pending.playerId,
    pending.playerName,
    pending.worldId,
    pending.level,
    pending.score,
    pending.bestCombo,
    pending.durationMs,
    pending.collected,
    pending.recordedAt,
  );
  if (currentOutboxIdentity() !== identity) return;
  if (result.ok) clearPendingLeaderboardScore(pending.playerId);
}

/** Der Run-Zeitpunkt muss beim Offline-Upload weitergereicht werden. */
function normalizedRecordTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

/** Aktualisiert den Anzeigenamen des bereits vorhandenen eigenen Bestwerts. */
export async function updateLeaderboardName(
  playerId: string,
  playerName: string,
): Promise<CloudResult<true>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const name = sanitizePlayerName(playerName);
  if (!name) return { ok: false, error: 'Kein Name angegeben' };
  if (!playerId) return { ok: false, error: 'Kein Spielerprofil angegeben' };

  const result = await withTimeout(
    supabase.rpc('rename_best_score', {
      p_player_id: playerId,
      p_player_name: name,
      p_access_token:
        playerId === SaveSystem.load().cloudId
          ? SaveSystem.ensureCloudAccessToken()
          : SaveSystem.getCloudAccessToken(),
    }),
    'Ranglistenname aktualisieren',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: true };
}

/** Prueft einen Spielernamen vor dem Speichern gegen Profile und Bestenliste. */
export async function isPlayerNameAvailable(
  playerName: string,
  playerId: string | null = null,
): Promise<CloudResult<boolean>> {
  const supabase = getClient();
  if (!supabase) return { ok: true, value: true };

  // Anonyme Besucher bekommen nur beim eigentlichen Schreibversuch eine
  // Antwort. Der separate Verfuegbarkeits-RPC ist fuer sie gesperrt, damit
  // sich die Profile-/Bestenlistenbelegung nicht als Oracle abfragen laesst.
  if (!AuthSystem.isSignedIn()) return { ok: true, value: true };

  const name = sanitizePlayerName(playerName);
  if (!name) return { ok: false, error: 'Kein Name angegeben' };

  const result = await withTimeout(
    supabase.rpc('is_player_name_available', {
      p_player_name: name,
      p_player_id: playerId,
    }),
    'Spielername prüfen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: result.value.data === true };
}

export { sanitizePlayerName } from '@/config/playerName';

// --- Spielstand --------------------------------------------------------------

/** Laedt den lokalen Spielstand hoch und legt ihn bei Bedarf neu an. */
export async function pushSave(): Promise<CloudResult<string>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const save = SaveSystem.load();
  const cloudId = SaveSystem.ensureCloudId();

  const result = await withTimeout(
    supabase.rpc('upsert_save', {
      p_id: cloudId,
      p_data: save,
      p_level: save.level,
      p_best_score: save.bestScore,
      p_total_runs: save.totalRuns,
      p_access_token: SaveSystem.ensureCloudAccessToken(),
      p_expected_updated_at: save.cloudUpdatedAt,
    }),
    'Spielstand hochladen',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const updatedAt =
    typeof result.value.data === 'string'
      ? result.value.data
      : Array.isArray(result.value.data) && typeof result.value.data[0]?.updated_at === 'string'
        ? result.value.data[0].updated_at
        : null;
  if (!updatedAt || !SaveSystem.setCloudUpdatedAt(updatedAt, cloudId)) {
    return { ok: false, error: 'Ungueltige Save-Revision vom Server' };
  }
  return { ok: true, value: cloudId };
}

/**
 * Upload fuer automatische Abgleiche. Vor dem Schreiben wird der aktuelle
 * Cloud-Stand gelesen, damit ein anderer Startpunkt nicht still ueberschrieben
 * wird, waehrend dieses Geraet noch offen war.
 */
export async function syncSaveSafely(): Promise<
  CloudResult<'uploaded' | 'unchanged' | 'remote-ahead'>
> {
  if (!getClient()) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const local = SaveSystem.load();
  if (!local.cloudId) {
    const uploaded = await pushSave();
    return uploaded.ok ? { ok: true, value: 'uploaded' } : uploaded;
  }

  const remote = await fetchSave(local.cloudId);
  if (!remote.ok) return remote;
  if (remote.value && isRemoteAhead(local, remote.value)) {
    return { ok: true, value: 'remote-ahead' };
  }

  // Ist der lokale Stand gleich oder weiter, darf der automatische Upload
  // fortgesetzt werden. So werden auch Namensaenderungen nachgezogen.
  const uploaded = await pushSave();
  if (uploaded.ok) return { ok: true, value: 'uploaded' };

  // Der CAS-Fehler ist kein gewoehnlicher Netzfehler: Zwischen Read und Write
  // hat ein anderes Geraet gespeichert. Den neuen Stand erneut lesen, damit
  // die UI den Nutzer zur echten Entscheidung fuehren kann, statt einen
  // parallelen Save still zu ueberschreiben.
  if (local.cloudId && isSaveConflict(uploaded.error)) {
    const latest = await fetchSave(local.cloudId);
    if (latest.ok && latest.value && isRemoteAhead(SaveSystem.load(), latest.value)) {
      return { ok: true, value: 'remote-ahead' };
    }
    return { ok: false, error: 'Spielstand wurde parallel geaendert. Bitte erneut abgleichen.' };
  }
  return uploaded;
}

function isSaveConflict(error: string): boolean {
  return error.includes('ander') && error.includes('Geraet');
}

/** Holt einen Spielstand, ohne ihn zu uebernehmen - der Aufrufer entscheidet. */
export async function fetchSave(cloudId: string): Promise<CloudResult<RemoteSave | null>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('get_save', {
      p_id: cloudId,
      p_access_token: SaveSystem.getCloudAccessToken(),
    }),
    'Spielstand laden',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  if (result.value.data === null || result.value.data === undefined) {
    return { ok: true, value: null };
  }

  const remote = normalizeRemoteSave(result.value.data);
  if (remote && SaveSystem.load().cloudId === cloudId) {
    SaveSystem.setCloudUpdatedAt(remote.updatedAt, cloudId);
  }
  return remote
    ? { ok: true, value: remote }
    : { ok: false, error: 'Ungueltige Spielstand-Antwort' };
}

// --- Auth-Profil und Mehrgeräte-Fortschritt -------------------------------

async function requireAuthenticatedClient(): Promise<CloudResult<SupabaseClient>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(supabase.auth.getUser(), 'Login prüfen');
  if (!result.ok) return result;
  if (result.value.error || !result.value.data.user) {
    return { ok: false, error: 'Bitte zuerst anmelden' };
  }

  return { ok: true, value: supabase };
}

/** Überträgt Besitz und Ausrüstung atomar; bei Offline bleibt der Snapshot liegen. */
export async function flushPendingCosmetics(
  identity = currentOutboxIdentity(),
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const pending = readPendingCosmeticSync(identity);
  if (!pending) return { ok: true, value: null };

  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;
  if (currentOutboxIdentity() !== identity) {
    return { ok: false, error: 'Profil waehrend des Kosmetik-Syncs gewechselt' };
  }

  const result = await withTimeout(
    authenticated.value.rpc('sync_profile_cosmetics', {
      p_owned_ship_shapes: pending.ownedShipShapes,
      p_owned_ship_colors: pending.ownedShipColors,
      p_owned_ship_auras: pending.ownedShipAuras,
      p_ship_shape: pending.shipShape,
      p_ship_color: pending.shipColor,
      p_ship_aura: pending.shipAura,
      p_coins_spent: Math.round(pending.coinsSpent),
    }),
    'Kosmetik synchronisieren',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  if (currentOutboxIdentity() !== identity) {
    return { ok: false, error: 'Profil waehrend des Kosmetik-Syncs gewechselt' };
  }

  const profile = normalizeProfileProgress(result.value.data);
  if (!profile) return { ok: false, error: 'Ungueltige Kosmetik-Antwort' };

  // Der Server vereinigt Besitzlisten. Dadurch kann ein Kauf auf Gerät A
  // nicht den Kauf von Gerät B überschreiben; die Auswahl kommt vom letzten
  // erfolgreichen Snapshot.
  SaveSystem.adoptProfileProgress(profile.data);
  if (currentOutboxIdentity() === identity) clearPendingCosmeticSync();
  return { ok: true, value: profile };
}

/**
 * Lädt die serverseitig geschützte Wartungsübersicht.
 *
 * Die Funktion liefert nur aggregierte Werte und die angeforderten
 * Profilkennzahlen. Die Datenbank prüft `profiles.is_admin`; ein lokaler PIN
 * oder eine sichtbare UI kann diese Berechtigung nicht ersetzen.
 */
export async function fetchAdminDashboard(): Promise<CloudResult<AdminDashboard | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('get_admin_dashboard', { p_limit: 200 }),
    'Wartungsstatistik laden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: normalizeAdminDashboard(result.value.data) };
}

/** Gibt einem Profil serverseitig einen Teststand fuer Wartungszwecke. */
export async function adminBoostUser(
  alias: string,
  level = 50,
  coins = 50000,
): Promise<CloudResult<true>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('admin_boost_user', {
      p_alias: alias.trim().toLowerCase(),
      p_level: level,
      p_coins: coins,
    }),
    'Profil auf Teststand setzen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/** Setzt ein Profil serverseitig auf den sauberen Anfangszustand zurueck. */
export async function adminResetUser(alias: string): Promise<CloudResult<true>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('admin_reset_user', { p_alias: alias.trim().toLowerCase() }),
    'Profil zuruecksetzen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/** Lädt den gemeinsamen Profilstand des angemeldeten Benutzers. */
export async function fetchProfileProgress(): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('get_profile_progress'),
    'Profilstand laden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/** Erstellt den gemeinsamen Stand, falls das Profil noch keinen besitzt. */
export async function initializeProfileProgress(
  save: SaveData = SaveSystem.load(),
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('initialize_profile_progress', {
      // Der Server verwendet ausschließlich den Namen. Fortschritt und XP
      // aus einem Browser-Snapshot sind keine vertrauenswürdige Quelle.
      p_data: { playerName: save.playerName },
      p_total_xp: 0,
    }),
    'Profilstand anlegen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/** Übernimmt ein bestehendes, anonymes Cloud-Profil nach dem Login. */
export async function claimCloudProfile(
  cloudId: string,
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('claim_cloud_profile', {
      p_cloud_id: cloudId,
      p_access_token: SaveSystem.getCloudAccessToken(),
    }),
    'Bestehendes Profil übernehmen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/**
 * Schreibt Login-Alias und Anzeigename gleichzeitig - seit
 * phase_2_8_unify_identity.sql derselbe Wert, damit ein gemeldeter
 * Spielername im Wartungsbildschirm immer zum Login passt.
 */
export async function updateProfileIdentity(name: string): Promise<CloudResult<true>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const safeName = sanitizePlayerName(name);
  if (!safeName) return { ok: false, error: 'Kein Name angegeben' };

  const result = await withTimeout(
    authenticated.value.rpc('update_profile_identity', { p_name: safeName }),
    'Namen speichern',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/** Kauft einen Talentpunkt atomar im gemeinsamen Profil. */
export async function purchaseTalent(
  talentId: TalentId,
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('purchase_talent', { p_talent_id: talentId }),
    'Talent kaufen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/** Setzt den Talentbaum zurück und erstattet alle investierten Punkte. */
export async function resetTalents(): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('reset_talents'),
    'Talentbaum zurücksetzen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/** Beansprucht den einmaligen Tagesbonus atomar im gemeinsamen Profil. */
export async function claimDailyBonus(
  dailyKey: string,
  eventIdOrLegacyScore: string | number,
  legacyEventId?: string,
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  // Der dritte Parameter bleibt nur als quellkompatible Uebergangssignatur
  // akzeptiert; der Score wird bewusst nie mehr an den Server gesendet.
  const eventId =
    typeof eventIdOrLegacyScore === 'string' ? eventIdOrLegacyScore : (legacyEventId ?? '');

  const result = await withTimeout(
    authenticated.value.rpc('claim_daily_bonus', {
      p_daily_key: dailyKey,
      p_event_id: eventId,
    }),
    'Tagesbonus synchronisieren',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/** Startet ein serverseitig registriertes Bot-Duell. */
export async function startBotMatch(): Promise<CloudResult<string>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(authenticated.value.rpc('start_bot_match'), 'Bot-Duell starten');
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return typeof result.value.data === 'string'
    ? { ok: true, value: result.value.data }
    : { ok: false, error: 'Ungueltige Bot-Duell-Antwort' };
}

/**
 * Laesst den Server die Praemie fuer einen gewonnenen Bot-Kampf gutschreiben.
 *
 * Die Match-ID wird jetzt ausschliesslich vom `start_bot_match`-RPC ausgegeben.
 * Der Server akzeptiert damit keine frei erfundene ID mehr und prueft zusaetzlich
 * das serverseitige Mindestalter des gestarteten Duells.
 */
export async function claimBotVictoryBonus(
  matchId: string,
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('claim_bot_victory_bonus', { p_match_id: matchId }),
    'Bot-Sieg synchronisieren',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

/** Beansprucht den kleinen Login-Bonus; der Server erlaubt ihn nur einmal je Tag. */
export async function claimDailyLoginBonus(
  _dailyKey?: string,
): Promise<CloudResult<DailyLoginClaim>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('claim_daily_login_bonus'),
    'Login-Bonus abholen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const raw = result.value.data;
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Ungültige Login-Bonus-Antwort' };
  const value = raw as { claimed?: unknown; profile?: unknown };
  return {
    ok: true,
    value: {
      claimed: value.claimed === true,
      profile: normalizeProfileProgress(value.profile),
    },
  };
}

/** Überträgt genau ein neues Solo-Ereignis. Wiederholungen sind idempotent. */
export async function submitProgressEvent(
  event: ProgressEvent,
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('submit_progress_event', {
      p_event_id: event.eventId,
      p_world_id: event.worldId,
      p_score: Math.max(0, Math.round(event.score)),
      p_best_combo: Math.max(0, Math.round(event.bestCombo)),
      p_xp_gained: Math.max(0, Math.round(event.xpGained)),
      p_duration_ms: Math.max(0, Math.round(event.durationMs ?? 0)),
      p_coins_gained: Math.max(0, Math.round(event.coinsGained)),
      p_talent_points_gained: Math.max(0, Math.round(event.talentPointsGained)),
      p_collected: event.collected,
      p_achievement_ids: event.unlockedAchievementIds,
      p_daily_key: event.dailyKey ?? null,
    }),
    'Fortschritt synchronisieren',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: normalizeProfileProgress(result.value.data) };
}

// --- Sync-Codes --------------------------------------------------------------

/**
 * Erzeugt einen Code aus dem verwechslungsarmen Alphabet.
 *
 * `crypto.getRandomValues` statt `Math.random`: bei einem so kurzen Code soll
 * die Verteilung nicht vorhersagbar sein, sonst reduziert sich der Suchraum.
 */
function createCode(): string {
  const bytes = new Uint8Array(SYNC_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = '';
  for (const byte of bytes) {
    code += SYNC_CODE_ALPHABET[byte % SYNC_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Laedt den Spielstand hoch und gibt einen kurzen Code darauf zurueck.
 *
 * Bei einer Kollision - der Code ist schon vergeben - wird ein neuer versucht.
 * Drei Versuche reichen: bei rund einer Milliarde Moeglichkeiten und wenigen
 * gleichzeitig gueltigen Codes ist schon der erste praktisch immer frei.
 */
export async function createSyncCode(): Promise<CloudResult<string>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const uploaded = await pushSave();
  if (!uploaded.ok) return uploaded;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = createCode();
    const result = await withTimeout(
      supabase.rpc('create_sync_code', {
        p_save_id: uploaded.value,
        p_code: code,
        p_access_token: SaveSystem.getCloudAccessToken(),
      }),
      'Code erzeugen',
    );

    if (!result.ok) return result;
    if (!result.value.error) return { ok: true, value: code };

    // 23505 = unique_violation. Alles andere ist ein echter Fehler.
    if (result.value.error.code !== '23505') {
      return { ok: false, error: result.value.error.message };
    }
  }

  return { ok: false, error: 'Kein freier Code gefunden - bitte erneut versuchen' };
}

/**
 * Loest einen Code ein und liefert den zugehoerigen Spielstand.
 *
 * Uebernommen wird er hier **nicht** - das entscheidet der Sync-Bildschirm,
 * nachdem er beide Staende nebeneinander gezeigt hat.
 */
export async function redeemSyncCode(
  rawCode: string,
): Promise<CloudResult<{ cloudId: string; accessToken: string; save: RemoteSave } | null>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const code = normalizeSyncCode(rawCode);
  if (code.length !== SYNC_CODE_LENGTH) {
    return { ok: false, error: `Ein Code hat ${SYNC_CODE_LENGTH} Zeichen` };
  }

  // Abgelaufene Codes liefert die RPC nicht mehr zurueck - ein verfallener
  // Code ergibt deshalb dasselbe wie ein falscher.
  const result = await withTimeout(
    supabase.rpc('redeem_sync_code', { p_code: code }),
    'Code prüfen',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const row = Array.isArray(result.value.data) ? result.value.data[0] : null;
  if (!row) return { ok: true, value: null };
  if (typeof row.access_token !== 'string' || !/^[a-f0-9]{64}$/i.test(row.access_token)) {
    return { ok: false, error: 'Server liefert kein gültiges Save-Zugriffstoken' };
  }

  return {
    ok: true,
    value: {
      cloudId: String(row.save_id),
      accessToken: typeof row.access_token === 'string' ? row.access_token : '',
      save: {
        data: row.data as SaveData,
        // Ueber `finiteNonNegative` statt blossem `Number()`: Diese Werte
        // gehen ungefiltert in die Vergleichsanzeige der Geraeteuebertragung
        // ("Welchen Stand willst du behalten?"). Ein `null` oder ein String
        // aus einer geaenderten SQL-Funktion stand dort woertlich als
        // "Level NaN" - und genau nach diesen Zahlen entscheidet der Nutzer,
        // welchen Spielstand er behaelt (Audit 2026-08-23).
        level: Math.max(1, finiteNonNegative(row.level, 1)),
        bestScore: finiteNonNegative(row.best_score),
        totalRuns: finiteNonNegative(row.total_runs),
        updatedAt: String(row.updated_at),
      },
    },
  };
}

/**
 * Bringt eine Eingabe auf die Code-Form.
 *
 * Grossbuchstaben, keine Leerzeichen - und die drei Zeichen, die es im
 * Alphabet nicht gibt, werden auf ihre Zwillinge abgebildet. Wer eine 0 als O
 * liest, soll trotzdem ankommen.
 */
export function normalizeSyncCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .slice(0, SYNC_CODE_LENGTH);
}
