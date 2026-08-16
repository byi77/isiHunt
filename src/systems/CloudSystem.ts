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
  PLAYER_NAME_MAX_LENGTH,
  SYNC_CODE_ALPHABET,
  SYNC_CODE_LENGTH,
} from '@/config/backend';
import { xpForLevel } from '@/config/GameConfig';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressEvent, SaveData } from '@/types';
import type { TalentId } from '@/config/talents';

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
  playerId: string;
  playerName: string;
  level: number;
  score: number;
  bestCombo: number;
  createdAt: string;
  /** In welcher Welt der Lauf stattfand - in der Gesamtliste als Farbmarke. */
  worldId: string;
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

const PENDING_LEADERBOARD_SCORE_KEY = 'isihunt.pending-leaderboard-score.v1';

function readPendingLeaderboardScore(): PendingLeaderboardScore | null {
  try {
    const raw = window.localStorage.getItem(PENDING_LEADERBOARD_SCORE_KEY);
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
  const existing = readPendingLeaderboardScore();
  if (existing && existing.playerId === score.playerId && existing.score > score.score) return;
  try {
    window.localStorage.setItem(PENDING_LEADERBOARD_SCORE_KEY, JSON.stringify(score));
  } catch {
    // Privater Browsermodus darf einen Lauf nicht beeintraechtigen.
  }
}

function clearPendingLeaderboardScore(): void {
  try {
    window.localStorage.removeItem(PENDING_LEADERBOARD_SCORE_KEY);
  } catch {
    // Siehe savePendingLeaderboardScore.
  }
}

/** Ob ein offline erspielter Ranglisten-Bestwert noch hochgeladen werden muss. */
export function hasPendingLeaderboardScore(): boolean {
  return readPendingLeaderboardScore() !== null;
}

/** Kurzfassung eines Spielstands - genug, um zwei Staende zu unterscheiden. */
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

/** Vergleicht die Fortschrittsmarker, die fuer den Nutzer sichtbar sind. */
export function isRemoteAhead(local: SaveData, remote: RemoteSave): boolean {
  return (
    remote.level > local.level ||
    remote.bestScore > local.bestScore ||
    remote.totalRuns > local.totalRuns ||
    remote.data.totalScore > local.totalScore ||
    Number(remote.data.coins ?? 0) > local.coins
  );
}

/** Das Gegenstueck fuer einen sicheren Upload nach Offline-Zeit. */
export function isLocalAhead(local: SaveData, remote: RemoteSave): boolean {
  return (
    local.level > remote.level ||
    local.bestScore > remote.bestScore ||
    local.totalRuns > remote.totalRuns ||
    local.totalScore > remote.data.totalScore ||
    local.coins > Number(remote.data.coins ?? 0)
  );
}

function totalXpForSave(save: SaveData): number {
  let total = save.xp;
  for (let level = 1; level < save.level; level++) total += xpForLevel(level);
  return total;
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
async function withTimeout<T>(operation: PromiseLike<T>, label: string): Promise<CloudResult<T>> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Zeitüberschreitung')), BACKEND_TIMEOUT_MS);
    });

    return { ok: true, value: await Promise.race([operation, timeout]) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.warn(`[CloudSystem] ${label} fehlgeschlagen:`, error);
    return { ok: false, error: `${label}: ${reason}` };
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

  let query = supabase
    .from('scores')
    .select('player_id, player_name, player_level, score, best_combo, created_at, world_id');

  if (worldId) query = query.eq('world_id', worldId);

  const result = await withTimeout(
    query
      .order('score', { ascending: false })
      // Bei Gleichstand gewinnt, wer es zuerst geschafft hat.
      .order('created_at', { ascending: true })
      .limit(LEADERBOARD_LIMIT),
    'Bestenliste laden',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const seenPlayerIds = new Set<string>();
  const rows = (result.value.data ?? []).filter((row) => {
    const playerId = String(row.player_id ?? '');
    if (!playerId || seenPlayerIds.has(playerId)) return false;
    seenPlayerIds.add(playerId);
    return true;
  });
  return {
    ok: true,
    value: rows.map((row) => ({
      playerId: String(row.player_id),
      playerName: String(row.player_name),
      level: Math.max(1, Number(row.player_level ?? 1)),
      score: Number(row.score),
      bestCombo: Number(row.best_combo),
      createdAt: String(row.created_at),
      worldId: String(row.world_id),
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
  const result = await withTimeout(
    supabase.rpc('submit_best_score', {
      ...scoreArgs,
      p_recorded_at: normalizedRecordTimestamp(recordedAt),
    }),
    'Bestwert eintragen',
  );

  if (!result.ok) return result;
  if (!result.value.error) return { ok: true, value: true };
  if (!needsLegacyLeaderboardRpc(result.value.error.message)) {
    return { ok: false, error: result.value.error.message };
  }

  // Die App darf zwischen Web-Release und SQL-Migration nicht jeden neuen
  // Bestwert verlieren. Der Rückfall speichert dann noch das Upload-Datum;
  // nach Ausführen der Migration wird automatisch der echte Laufzeitpunkt
  // übertragen.
  const legacyResult = await withTimeout(
    supabase.rpc('submit_best_score', scoreArgs),
    'Bestwert eintragen',
  );
  if (!legacyResult.ok) return legacyResult;
  if (legacyResult.value.error) return { ok: false, error: legacyResult.value.error.message };
  return { ok: true, value: true };
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
      const existing = readPendingLeaderboardScore();
      if (!existing || (existing.playerId === playerId && existing.score <= score)) {
        clearPendingLeaderboardScore();
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
  const pending = readPendingLeaderboardScore();
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
  if (result.ok) clearPendingLeaderboardScore();
}

/** Der Run-Zeitpunkt muss beim Offline-Upload weitergereicht werden. */
function normalizedRecordTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function needsLegacyLeaderboardRpc(message: string): boolean {
  return (
    /submit_best_score|p_recorded_at/i.test(message) &&
    /function|schema cache|parameter/i.test(message)
  );
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

/**
 * Bereinigt einen Spielernamen.
 *
 * Steuerzeichen raus, Leerraum zusammenfassen, kuerzen. Die Datenbank prueft
 * die Laenge ebenfalls - hier passiert es nur frueher, damit der Nutzer eine
 * verstaendliche Rueckmeldung statt eines Datenbankfehlers bekommt.
 */
export function sanitizePlayerName(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX_LENGTH);
}

// --- Spielstand --------------------------------------------------------------

/** Laedt den lokalen Spielstand hoch und legt ihn bei Bedarf neu an. */
export async function pushSave(): Promise<CloudResult<string>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const save = SaveSystem.load();
  const cloudId = SaveSystem.ensureCloudId();

  const result = await withTimeout(
    supabase.from('saves').upsert(
      {
        id: cloudId,
        data: save,
        level: save.level,
        best_score: save.bestScore,
        total_runs: save.totalRuns,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    ),
    'Spielstand hochladen',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

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
  return uploaded.ok ? { ok: true, value: 'uploaded' } : uploaded;
}

/** Holt einen Spielstand, ohne ihn zu uebernehmen - der Aufrufer entscheidet. */
export async function fetchSave(cloudId: string): Promise<CloudResult<RemoteSave | null>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase
      .from('saves')
      .select('data, level, best_score, total_runs, updated_at')
      .eq('id', cloudId)
      .maybeSingle(),
    'Spielstand laden',
  );

  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const row = result.value.data;
  if (!row) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      data: row.data as SaveData,
      level: Number(row.level),
      bestScore: Number(row.best_score),
      totalRuns: Number(row.total_runs),
      updatedAt: String(row.updated_at),
    },
  };
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

function readProfileProgress(raw: unknown): RemoteProfileProgress | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return null;

  const value = row as {
    data?: unknown;
    total_xp?: unknown;
    updated_at?: unknown;
  };
  if (!value.data || typeof value.data !== 'object') return null;

  return {
    data: value.data as SaveData,
    totalXp: Number(value.total_xp ?? 0),
    updatedAt: String(value.updated_at ?? ''),
  };
}

function readAdminDashboard(raw: unknown): AdminDashboard | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'object') return null;

  const dashboard = value as Record<string, unknown>;
  const users = Array.isArray(dashboard.users)
    ? dashboard.users
        .filter(
          (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => ({
          playerName: String(entry.playerName ?? 'Ohne Namen'),
          level: Math.max(1, Number(entry.level ?? 1)),
          totalRuns: Math.max(0, Number(entry.totalRuns ?? 0)),
          totalPlayTimeMs: Math.max(0, Number(entry.totalPlayTimeMs ?? 0)),
          totalCoinsEarned: Math.max(0, Number(entry.totalCoinsEarned ?? 0)),
          currentCoins: Math.max(0, Number(entry.currentCoins ?? 0)),
          totalDailyRuns: Math.max(0, Number(entry.totalDailyRuns ?? 0)),
          totalXp: Math.max(0, Number(entry.totalXp ?? 0)),
          bestScore: Math.max(0, Number(entry.bestScore ?? 0)),
          bestCombo: Math.max(0, Number(entry.bestCombo ?? 0)),
          achievementCount: Math.max(0, Number(entry.achievementCount ?? 0)),
          updatedAt: String(entry.updatedAt ?? ''),
        }))
    : [];

  return {
    profileCount: Math.max(0, Number(dashboard.profileCount ?? 0)),
    playedProfileCount: Math.max(0, Number(dashboard.playedProfileCount ?? 0)),
    totalRuns: Math.max(0, Number(dashboard.totalRuns ?? 0)),
    totalPlayTimeMs: Math.max(0, Number(dashboard.totalPlayTimeMs ?? 0)),
    totalCoinsEarned: Math.max(0, Number(dashboard.totalCoinsEarned ?? 0)),
    totalCoinsHeld: Math.max(0, Number(dashboard.totalCoinsHeld ?? 0)),
    totalDailyRuns: Math.max(0, Number(dashboard.totalDailyRuns ?? 0)),
    totalXp: Math.max(0, Number(dashboard.totalXp ?? 0)),
    totalAchievements: Math.max(0, Number(dashboard.totalAchievements ?? 0)),
    highestScore: Math.max(0, Number(dashboard.highestScore ?? 0)),
    users,
  };
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

  return { ok: true, value: readAdminDashboard(result.value.data) };
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

  return { ok: true, value: readProfileProgress(result.value.data) };
}

/** Erstellt den gemeinsamen Stand, falls das Profil noch keinen besitzt. */
export async function initializeProfileProgress(
  save: SaveData = SaveSystem.load(),
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('initialize_profile_progress', {
      p_data: save,
      p_total_xp: totalXpForSave(save),
    }),
    'Profilstand anlegen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: readProfileProgress(result.value.data) };
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
      p_total_xp: totalXpForSave(SaveSystem.load()),
    }),
    'Bestehendes Profil übernehmen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  return { ok: true, value: readProfileProgress(result.value.data) };
}

/**
 * Schreibt eine Profiländerung und synchronisiert den Ranglistennamen.
 * Die Datenbank bindet die Änderung an auth.uid().
 */
export async function updateProfileName(name: string): Promise<CloudResult<true>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const safeName = sanitizePlayerName(name);
  if (!safeName) return { ok: false, error: 'Kein Name angegeben' };

  const result = await withTimeout(
    authenticated.value.rpc('update_profile_name', { p_player_name: safeName }),
    'Profilnamen speichern',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/** Speichert den sichtbaren Alias des angemeldeten Profils. */
export async function updateProfileAlias(alias: string): Promise<CloudResult<true>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const safeAlias = alias.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,16}$/.test(safeAlias)) {
    return { ok: false, error: 'Ungültiger Alias' };
  }

  const result = await withTimeout(
    authenticated.value.rpc('update_profile_alias', { p_alias: safeAlias }),
    'Alias speichern',
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
  return { ok: true, value: readProfileProgress(result.value.data) };
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
  return { ok: true, value: readProfileProgress(result.value.data) };
}

/** Beansprucht den einmaligen Tagesbonus atomar im gemeinsamen Profil. */
export async function claimDailyBonus(
  dailyKey: string,
  score: number,
  eventId: string,
): Promise<CloudResult<RemoteProfileProgress | null>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('claim_daily_bonus', {
      p_daily_key: dailyKey,
      p_score: Math.max(0, Math.round(score)),
      p_event_id: eventId,
    }),
    'Tagesbonus synchronisieren',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: readProfileProgress(result.value.data) };
}

/** Beansprucht den kleinen Login-Bonus; der Server erlaubt ihn nur einmal je Tag. */
export async function claimDailyLoginBonus(
  dailyKey: string,
): Promise<CloudResult<DailyLoginClaim>> {
  const authenticated = await requireAuthenticatedClient();
  if (!authenticated.ok) return authenticated;

  const result = await withTimeout(
    authenticated.value.rpc('claim_daily_login_bonus', { p_daily_key: dailyKey }),
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
      profile: readProfileProgress(value.profile),
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
    }),
    'Fortschritt synchronisieren',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: readProfileProgress(result.value.data) };
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
      supabase.from('sync_codes').insert({ code, save_id: uploaded.value }),
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
): Promise<CloudResult<{ cloudId: string; save: RemoteSave } | null>> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const code = normalizeSyncCode(rawCode);
  if (code.length !== SYNC_CODE_LENGTH) {
    return { ok: false, error: `Ein Code hat ${SYNC_CODE_LENGTH} Zeichen` };
  }

  // Abgelaufene Codes sind per Zugriffsregel unsichtbar - ein verfallener Code
  // liefert deshalb dasselbe wie ein falscher.
  const lookup = await withTimeout(
    supabase.from('sync_codes').select('save_id').eq('code', code).maybeSingle(),
    'Code prüfen',
  );

  if (!lookup.ok) return lookup;
  if (lookup.value.error) return { ok: false, error: lookup.value.error.message };
  if (!lookup.value.data) return { ok: true, value: null };

  const cloudId = String(lookup.value.data.save_id);
  const remote = await fetchSave(cloudId);
  if (!remote.ok) return remote;
  if (!remote.value) return { ok: true, value: null };

  return { ok: true, value: { cloudId, save: remote.value } };
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
