/**
 * Netzwerk-Duell: Raum erzeugen/beitreten, Uhr-Synchronisation, Realtime-
 * Kanal fuer den gemeinsamen Rundenstart.
 *
 * ## Zwei Kommunikationswege, zwei Stile
 *
 * Raum-Verwaltung (erzeugen, beitreten, bereit melden, Startzeit setzen)
 * laeuft ueber `supabase.rpc(...)` - klassisches Request/Response, deshalb im
 * `CloudResult`-Stil wie `CloudSystem` (nie werfen, Zeitlimit, Ergebnisobjekt).
 *
 * Der laufende Kanalbetrieb (Verbindungsstatus, Presence-Trennung, spaeter in
 * Phase 2 der Score-Broadcast) ist dagegen ein Push-Modell - kein Promise,
 * das auf eine einzelne Antwort wartet, sondern Handler, die wiederholt
 * aufgerufen werden. Dafuer gibt es keinen `CloudResult`-Wrapper, sondern
 * Registrierungsfunktionen (`onDisconnected`, `onChannelError`).
 *
 * ## Warum ein eigenes Modul und nicht Teil von CloudSystem
 *
 * CloudSystem ist bereits gross und ausschliesslich auf Request/Response
 * ausgelegt (Bestenliste, Spielstand-Abgleich, Profilfortschritt). Realtime
 * bringt einen fundamental anderen Lebenszyklus (Kanal oeffnen/schliessen,
 * laufende Zustandsaenderungen) mit, der eine eigene Datei rechtfertigt -
 * genau wie `ProgressSyncSystem` als eigenes Modul neben `CloudSystem` steht,
 * obwohl es denselben Client nutzt.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import {
  BACKEND_TIMEOUT_MS,
  DUEL_RESULT_RETRY_DELAYS_MS,
  SYNC_CODE_ALPHABET,
} from '@/config/backend';
import {
  CHALLENGE_DEFAULT_PLAYER_COUNT,
  CHALLENGE_MAX_PLAYER_COUNT,
  DUEL_TALENT_POINT_BUDGET,
} from '@/config/challenge';
import { sanitizePlayerName } from '@/config/playerName';
import type { TalentRanks } from '@/config/talents';
import { normalizeTalentRanks } from '@/systems/TalentAllocationSystem';
import {
  DUEL_ROOM_CODE_TTL_MINUTES,
  ONLINE_DUEL_CLOCK_SYNC_SAMPLES,
  ONLINE_DUEL_PRESENCE_GRACE_MS,
} from '@/config/onlineDuel';
import * as CloudSystem from '@/systems/CloudSystem';
import type { CloudResult } from '@/systems/CloudSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as DebugSystem from '@/systems/DebugSystem';

const DUEL_ROOM_CODE_LENGTH = 6;
const DUEL_RESULT_OUTBOX_PREFIX = 'isihunt.duel-results.v1.';
const DUEL_RESULT_OUTBOX_MAX = 8;

interface PendingDuelResult {
  code: string;
  participantToken: string;
  result: DuelRoundResult;
  queuedAt: number;
}

let pendingDuelFlush: Promise<void> | null = null;

function duelResultOutboxKey(accountId: string | null): string {
  return `${DUEL_RESULT_OUTBOX_PREFIX}${accountId ?? 'anonymous'}`;
}

function pendingDuelResultId(item: Pick<PendingDuelResult, 'code' | 'participantToken'>): string {
  return `${item.code}\u0000${item.participantToken}`;
}

function validDuelResult(value: unknown): value is DuelRoundResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const integer = (entry: unknown, min: number, max: number): boolean =>
    typeof entry === 'number' && Number.isInteger(entry) && entry >= min && entry <= max;
  return (
    integer(record.score, 0, 10_000_000) &&
    integer(record.bestCombo, 0, 10_000) &&
    integer(record.totalCollected, 0, 632) &&
    (record.durationMs === undefined || integer(record.durationMs, 60_000, 120_000)) &&
    (record.collected === undefined ||
      (record.collected !== null &&
        typeof record.collected === 'object' &&
        !Array.isArray(record.collected)))
  );
}

function readPendingDuelResults(accountId = AuthSystem.currentUserId()): PendingDuelResult[] {
  try {
    const raw = window.localStorage.getItem(duelResultOutboxKey(accountId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is PendingDuelResult => {
        if (!entry || typeof entry !== 'object') return false;
        const value = entry as Partial<PendingDuelResult>;
        return (
          typeof value.code === 'string' &&
          /^[0-9A-HJKMNP-Z]{6}$/.test(value.code) &&
          typeof value.participantToken === 'string' &&
          value.participantToken.length >= 1 &&
          value.participantToken.length <= 128 &&
          validDuelResult(value.result) &&
          typeof value.queuedAt === 'number' &&
          Number.isFinite(value.queuedAt)
        );
      })
      .slice(-DUEL_RESULT_OUTBOX_MAX);
  } catch {
    return [];
  }
}

function writePendingDuelResults(accountId: string | null, entries: PendingDuelResult[]): boolean {
  try {
    if (entries.length === 0) window.localStorage.removeItem(duelResultOutboxKey(accountId));
    else window.localStorage.setItem(duelResultOutboxKey(accountId), JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function queueDuelResult(code: string, participantToken: string, result: DuelRoundResult): boolean {
  const accountId = AuthSystem.currentUserId();
  const pending = readPendingDuelResults(accountId);
  const id = pendingDuelResultId({ code, participantToken });
  const next = pending.filter((entry) => pendingDuelResultId(entry) !== id);
  if (next.length >= DUEL_RESULT_OUTBOX_MAX) return false;
  next.push({ code, participantToken, result, queuedAt: Date.now() });
  return writePendingDuelResults(accountId, next);
}

function removeQueuedDuelResult(item: PendingDuelResult, accountId: string | null): void {
  const pending = readPendingDuelResults(accountId).filter(
    (entry) => pendingDuelResultId(entry) !== pendingDuelResultId(item),
  );
  writePendingDuelResults(accountId, pending);
}

/**
 * Fachliche Ablehnungen von `submit_duel_result`, die allein am Inhalt des
 * abgegebenen Ergebnisses haengen (phase_2_46_duel_result_grace.sql, Zeilen
 * 124-171). Sie fallen bei jedem weiteren Versuch identisch aus; nur diese
 * duerfen ein Ergebnis aus der Outbox nehmen.
 *
 * Bewusst NICHT in dieser Liste: 'Duell-Teilnehmer nicht autorisiert', 'Duell
 * nicht gefunden oder abgelaufen' und 'Duell noch nicht gestartet'. Sie sind
 * zeit- bzw. zustandsabhaengig - ein Rundenende kann den noch nicht
 * committeten Raumstart ueberholen. Im Zweifel wird wiederholt: ein
 * faelschlich behaltenes Ergebnis kostet einen Retry, ein faelschlich
 * verworfenes kostet die Wertung des ganzen Matches
 * (AUDIT_2026-09-05_REAUDIT, Befund 1).
 */
const PERMANENT_DUEL_RESULT_REJECTIONS = [
  'Ungueltiges Ergebnisformat',
  'Ergebnis zu gross',
  'Ergebnis unvollstaendig',
  'Ergebnis ausserhalb des Wertebereichs',
  'Ungueltige Rundendauer',
  'Ergebnis nicht plausibel',
  'Ungueltige Reliktstatistik',
  'Reliktstatistik passt nicht zum Ergebnis',
] as const;

/**
 * Ob eine RPC-Fehlermeldung eine dauerhafte fachliche Ablehnung ist.
 *
 * Das installierte PostgREST-SDK liefert auch reine Transportfehler als
 * *aufgeloeste* Antwort mit gesetztem `error` - ein Funkloch kommt als
 * `TypeError: Failed to fetch` mit Status 0 an, nicht als abgelehnte Promise.
 * Frueher galt jedes `response.value.error` als fachliche Ablehnung; das
 * Ergebnis wurde daraufhin aus der Outbox entfernt und war unwiederbringlich
 * verloren (AUDIT_2026-09-05_REAUDIT, Befund 1). Deshalb entscheidet jetzt
 * eine Allowlist der tatsaechlichen SQL-Meldungen, nicht die blosse Existenz
 * eines Fehlers.
 */
function isPermanentDuelResultRejection(message: string): boolean {
  return PERMANENT_DUEL_RESULT_REJECTIONS.some((reason) => message.includes(reason));
}

/**
 * Ob ein fehlgeschlagener Abgabeversuch spaeter wiederholt werden soll.
 *
 * Umgekehrte Logik zur Allowlist: alles, was keine belegte fachliche
 * Ablehnung ist, bleibt in der Outbox. 'Kein Online-Dienst eingerichtet'
 * gehoert ausdruecklich dazu - der Dienst kann beim naechsten Start
 * konfiguriert sein.
 */
function isRetryableDuelResultError(error: string): boolean {
  return !isPermanentDuelResultRejection(error);
}

// --- Ergebnistypen ------------------------------------------------------------

export interface DuelRoomInfo {
  seed: string;
  worldId: string;
  participantToken: string;
  playerIndex: number;
  playerCount: number;
  maxPlayers: number;
  matchNumber?: number;
}

export type DuelLobbyAvailability = 'available' | 'busy';

export interface DuelLobbyPlayer {
  /** Presence-Schluessel der konkreten Browser-Verbindung. */
  presenceKey: string;
  playerName: string;
  availability: DuelLobbyAvailability;
}

export interface DuelInvitation {
  id: string;
  inviterName: string;
  worldId: string;
  expiresAt: string;
}

export interface CreatedDuelInvitation extends DuelInvitation {
  code: string;
  seed: string;
  /** Nur beim Anlegen eines neuen Host-Raums vorhanden. */
  participantToken: string;
}

export interface AcceptedDuelInvitation extends DuelRoomInfo {
  code: string;
}

export interface DuelLobbyHandlers {
  onPlayersSync?: (players: DuelLobbyPlayer[]) => void;
  /** Nur eine Einladung-ID; Details werden anschliessend per RPC geladen. */
  onInvitationReceived?: (invitationId: string) => void;
  onChannelError?: (reason: string) => void;
}

export interface DuelRoomStatus {
  seed: string;
  worldId: string;
  /** Serverseitige Generation; steigt bei jedem Rematch atomar. */
  matchNumber: number;
  hostReady: boolean;
  guestReady: boolean;
  guestJoined: boolean;
  hostTalentReady: boolean;
  guestTalentReady: boolean;
  hostTalentDraft: TalentRanks;
  guestTalentDraft: TalentRanks;
  /** Serverzeit (ms seit Epoch), zu der die Talentphase geoeffnet wurde. */
  talentDraftStartedAtMs: number | null;
  /** Anzahl der Teilnehmer, die ihren Build fuer diese Runde bestaetigt haben. */
  talentReadyCount: number;
  /** Serverzeit (ms seit Epoch), zu der beide gleichzeitig starten sollen. */
  startAtMs: number | null;
  /** `null`, solange der jeweilige Spieler seine Runde nicht abgegeben hat. */
  hostResult: DuelRoundResult | null;
  guestResult: DuelRoundResult | null;
  playerCount: number;
  maxPlayers: number;
  playerResults: (DuelRoundResult | null)[];
}

// --- Code-Erzeugung -----------------------------------------------------------

/**
 * Erzeugt einen Code aus demselben Alphabet wie der Sync-Code
 * (`SYNC_CODE_ALPHABET` in `config/backend.ts`) - dasselbe Ablese-Problem auf
 * einem Handy gilt hier genauso, deshalb dieselbe Zeichenauswahl.
 */
function createRoomCode(): string {
  const bytes = new Uint8Array(DUEL_ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = '';
  for (const byte of bytes) {
    code += SYNC_CODE_ALPHABET[byte % SYNC_CODE_ALPHABET.length];
  }
  return code;
}

/** Wie `CloudSystem.normalizeSyncCode`, aber mit der eigenen Duell-Code-Laenge. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .slice(0, DUEL_ROOM_CODE_LENGTH);
}

// --- Raum erzeugen und beitreten ----------------------------------------------

/**
 * Erzeugt einen neuen Duell-Raum mit frischem Seed und Code.
 *
 * Der Client liefert nur noch einen Kompatibilitaets-Seed mit. Neue
 * Servermigrationen ersetzen ihn durch einen serverseitig erzeugten Seed und
 * geben diesen zusammen mit dem Teilnehmer-Token zurueck. Bei einer
 * Code-Kollision (Postgres 23505) wird bis zu dreimal neu versucht.
 */
export async function createRoom(worldId: string): Promise<
  CloudResult<{
    code: string;
    seed: string;
    participantToken: string;
    playerIndex: number;
    playerCount: number;
    maxPlayers: number;
  }>
> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const seed = createSeed();

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = createRoomCode();
    const result = await withTimeout(
      supabase.rpc('create_duel_room', {
        p_world_id: worldId,
        p_code: code,
        p_seed: seed,
        p_max_players: CHALLENGE_MAX_PLAYER_COUNT,
      }),
      'Raum erzeugen',
    );

    if (!result.ok) return result;
    if (!result.value.error) {
      const rawRoom = String(result.value.data ?? '');
      let participantToken = rawRoom;
      let serverSeed = seed;
      let playerIndex = 0;
      let playerCount = 1;
      let maxPlayers = CHALLENGE_MAX_PLAYER_COUNT;
      try {
        const parsed = JSON.parse(rawRoom) as {
          participantToken?: unknown;
          seed?: unknown;
          playerIndex?: unknown;
          playerCount?: unknown;
          maxPlayers?: unknown;
        };
        if (typeof parsed.participantToken === 'string') participantToken = parsed.participantToken;
        if (typeof parsed.seed === 'string' && parsed.seed.length > 0) serverSeed = parsed.seed;
        if (Number.isInteger(parsed.playerIndex)) playerIndex = Number(parsed.playerIndex);
        if (Number.isInteger(parsed.playerCount)) playerCount = Number(parsed.playerCount);
        if (Number.isInteger(parsed.maxPlayers)) maxPlayers = Number(parsed.maxPlayers);
      } catch {
        // Alte Servermigration: Die Antwort war direkt das Teilnehmer-Token.
      }
      if (!/^[a-f0-9]{64}$/i.test(participantToken)) {
        return { ok: false, error: 'Ungueltiges Teilnehmer-Token vom Server' };
      }
      return {
        ok: true,
        value: {
          code,
          seed: serverSeed,
          participantToken,
          playerIndex,
          playerCount,
          maxPlayers,
        },
      };
    }

    // 23505 = unique_violation. Alles andere ist ein echter Fehler.
    if (result.value.error.code !== '23505') {
      return { ok: false, error: result.value.error.message };
    }
  }

  return { ok: false, error: 'Kein freier Code gefunden - bitte erneut versuchen' };
}

/**
 * Erzeugt einen invite-only Raum und legt die Einladung atomar beim Server an.
 * Der Gast betritt ihn spaeter ueber `acceptDuelInvitation`, nicht ueber den
 * normalen Code-Pfad.
 */
export async function createDuelInvitation(
  worldId: string,
  targetPlayerName: string,
): Promise<CloudResult<CreatedDuelInvitation>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const cleanTargetName = sanitizePlayerName(targetPlayerName);
  if (!cleanTargetName) return { ok: false, error: 'Ungueltiger Spielername' };

  const result = await withTimeout(
    supabase.rpc('create_duel_invitation', {
      p_world_id: worldId,
      p_target_player_name: cleanTargetName,
    }),
    'Duell-Einladung senden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const record = objectFrom(result.value.data);
  if (!record) return { ok: false, error: 'Ungueltige Einladungsantwort vom Server' };

  const invitationId = stringValue(record.invitationId ?? record.invitation_id);
  const code = stringValue(record.code);
  const seed = stringValue(record.seed);
  const worldIdFromServer = stringValue(record.worldId ?? record.world_id);
  const participantToken = stringValue(record.participantToken ?? record.participant_token);
  const inviterName = sanitizePlayerName(stringValue(record.inviterName ?? record.inviter_name));
  const expiresAt = stringValue(record.expiresAt ?? record.expires_at);
  if (
    !invitationId ||
    !code ||
    !seed ||
    !worldIdFromServer ||
    !inviterName ||
    !expiresAt ||
    (participantToken !== '' && !/^[a-f0-9]{64}$/i.test(participantToken))
  ) {
    return { ok: false, error: 'Ungueltige Einladungsantwort vom Server' };
  }

  broadcastLobbyInvitation(cleanTargetName, invitationId);
  return {
    ok: true,
    value: {
      id: invitationId,
      inviterName,
      worldId: worldIdFromServer,
      expiresAt,
      code,
      seed,
      participantToken,
    },
  };
}

/** Laedt die eigenen noch offenen Einladungen nach App-Start oder Reconnect. */
export async function listDuelInvitations(): Promise<CloudResult<DuelInvitation[]>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('list_duel_invitations'),
    'Duell-Einladungen laden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const rows = Array.isArray(result.value.data) ? result.value.data : [];
  const invitations: DuelInvitation[] = [];
  for (const raw of rows) {
    const record = objectFrom(raw);
    if (!record) continue;
    const id = stringValue(record.id);
    const inviterName = sanitizePlayerName(stringValue(record.inviterName ?? record.inviter_name));
    const worldId = stringValue(record.worldId ?? record.world_id);
    const expiresAt = stringValue(record.expiresAt ?? record.expires_at);
    if (!id || !inviterName || !worldId || !expiresAt) continue;
    invitations.push({ id, inviterName, worldId, expiresAt });
  }
  return { ok: true, value: invitations };
}

/** Nimmt eine Einladung serverseitig an und liefert den normalen Gastzugang. */
export async function acceptDuelInvitation(
  invitationId: string,
): Promise<CloudResult<AcceptedDuelInvitation>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };
  if (!invitationId) return { ok: false, error: 'Ungueltige Einladung' };

  const result = await withTimeout(
    supabase.rpc('accept_duel_invitation', { p_invitation_id: invitationId }),
    'Duell-Einladung annehmen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const row = Array.isArray(result.value.data) ? objectFrom(result.value.data[0]) : null;
  if (!row) return { ok: false, error: 'Ungueltige Beitrittsantwort vom Server' };
  const code = stringValue(row.code);
  const seed = stringValue(row.seed);
  const worldId = stringValue(row.worldId ?? row.world_id);
  const participantToken = stringValue(row.participantToken ?? row.participant_token);
  const matchNumber = Number(row.matchNumber ?? row.match_number ?? 1);
  const playerIndex = Number(row.playerIndex ?? row.player_index ?? 1);
  const playerCount = Number(row.playerCount ?? row.player_count ?? CHALLENGE_DEFAULT_PLAYER_COUNT);
  const maxPlayers = Number(row.maxPlayers ?? row.max_players ?? CHALLENGE_MAX_PLAYER_COUNT);
  if (
    !code ||
    !seed ||
    !worldId ||
    !/^[a-f0-9]{64}$/i.test(participantToken) ||
    !Number.isInteger(playerIndex) ||
    playerIndex < 1 ||
    playerIndex >= CHALLENGE_MAX_PLAYER_COUNT ||
    !Number.isInteger(playerCount) ||
    playerCount < CHALLENGE_DEFAULT_PLAYER_COUNT ||
    playerCount > CHALLENGE_MAX_PLAYER_COUNT ||
    !Number.isInteger(maxPlayers) ||
    maxPlayers < playerCount ||
    maxPlayers > CHALLENGE_MAX_PLAYER_COUNT
  ) {
    return { ok: false, error: 'Ungueltige Beitrittsantwort vom Server' };
  }
  return {
    ok: true,
    value: {
      code,
      seed,
      worldId,
      participantToken,
      playerIndex,
      playerCount,
      maxPlayers,
      ...(Number.isInteger(matchNumber) && matchNumber > 0 ? { matchNumber } : {}),
    },
  };
}

export async function declineDuelInvitation(invitationId: string): Promise<CloudResult<true>> {
  return respondToDuelInvitation(
    invitationId,
    'decline_duel_invitation',
    'Duell-Einladung ablehnen',
  );
}

/** Bricht eine eigene, noch nicht angenommene Einladung ab. */
export async function cancelDuelInvitation(invitationId: string): Promise<CloudResult<true>> {
  return respondToDuelInvitation(
    invitationId,
    'cancel_duel_invitation',
    'Duell-Einladung abbrechen',
  );
}

async function respondToDuelInvitation(
  invitationId: string,
  rpcName: 'decline_duel_invitation' | 'cancel_duel_invitation',
  label: string,
): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };
  if (!invitationId) return { ok: false, error: 'Ungueltige Einladung' };

  const result = await withTimeout(supabase.rpc(rpcName, { p_invitation_id: invitationId }), label);
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/** Zufaelliger Seed fuer die Relikt-Abfolge - Format analog `ChallengeSystem.createSeed`. */
function createSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Tritt einem bestehenden Raum bei und liefert Seed/Welt fuer denselben Run. */
export async function joinRoom(rawCode: string): Promise<CloudResult<DuelRoomInfo | null>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const code = normalizeRoomCode(rawCode);
  if (code.length !== DUEL_ROOM_CODE_LENGTH) {
    return { ok: false, error: `Ein Code hat ${DUEL_ROOM_CODE_LENGTH} Zeichen` };
  }

  const result = await withTimeout(
    supabase.rpc('join_duel_room', { p_code: code }),
    'Raum beitreten',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const row = Array.isArray(result.value.data) ? result.value.data[0] : null;
  if (!row) return { ok: true, value: null };

  const participantToken = String(row.participant_token ?? '');
  if (!/^[a-f0-9]{64}$/i.test(participantToken)) {
    return { ok: false, error: 'Ungueltiges Teilnehmer-Token vom Server' };
  }
  return {
    ok: true,
    value: {
      seed: String(row.seed),
      worldId: String(row.world_id),
      participantToken,
      playerIndex: Number.isInteger(Number(row.player_index)) ? Number(row.player_index) : 1,
      playerCount: Number.isInteger(Number(row.player_count))
        ? Number(row.player_count)
        : CHALLENGE_DEFAULT_PLAYER_COUNT,
      maxPlayers: Number.isInteger(Number(row.max_players))
        ? Number(row.max_players)
        : CHALLENGE_MAX_PLAYER_COUNT,
    },
  };
}

/** Meldet dieses Geraet als bereit fuer den Start. */
export async function markReady(
  code: string,
  _isHost: boolean,
  participantToken = '',
): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('mark_duel_ready', { p_code: code, p_participant_token: participantToken }),
    'Bereit melden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/** Speichert den temporaeren Build fuer die aktuelle Duell-Generation. */
export async function submitTalentDraft(
  code: string,
  draft: TalentRanks,
  participantToken = '',
): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const response = await withTimeout(
    supabase.rpc('submit_duel_talent_draft', {
      p_code: code,
      p_participant_token: participantToken,
      p_draft: normalizeTalentRanks(draft, DUEL_TALENT_POINT_BUDGET),
    }),
    'Talent-Build speichern',
  );
  if (!response.ok) return response;
  if (response.value.error) return { ok: false, error: response.value.error.message };
  return { ok: true, value: true };
}

/** Oeffnet die Talentphase fuer alle Teilnehmer; nur der Host darf sie starten. */
export async function startTalentDraft(
  code: string,
  participantToken = '',
): Promise<CloudResult<number>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('start_duel_talent_draft', {
      p_code: code,
      p_participant_token: participantToken,
    }),
    'Talentphase starten',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const startedAtMs = Date.parse(String(result.value.data));
  if (!Number.isFinite(startedAtMs)) {
    return { ok: false, error: 'Ungueltiger Start der Talentphase vom Server' };
  }
  return { ok: true, value: startedAtMs };
}

/** Meldet ein Rematch inklusive des neuen eigenen Build-Vorschlags an. */
export async function requestRematch(
  code: string,
  draft: TalentRanks,
  participantToken = '',
): Promise<CloudResult<{ ready: boolean; matchNumber: number; seed: string | null }>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const response = await withTimeout(
    supabase.rpc('request_duel_rematch', {
      p_code: code,
      p_participant_token: participantToken,
      p_draft: normalizeTalentRanks(draft, DUEL_TALENT_POINT_BUDGET),
    }),
    'Rematch vorbereiten',
  );
  if (!response.ok) return response;
  if (response.value.error) return { ok: false, error: response.value.error.message };

  const raw = response.value.data;
  const value = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Ungueltige Rematch-Antwort vom Server' };
  }
  const record = value as Record<string, unknown>;
  const matchNumber = Number(record.matchNumber ?? record.match_number);
  if (!Number.isInteger(matchNumber) || matchNumber < 1) {
    return { ok: false, error: 'Ungueltige Duell-Generation vom Server' };
  }
  const seed = record.seed;
  return {
    ok: true,
    value: {
      ready: Boolean(record.ready),
      matchNumber,
      seed: typeof seed === 'string' && seed.length > 0 ? seed : null,
    },
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function objectFrom(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') return parseJsonObject(raw);
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function stringValue(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

/**
 * Setzt die gemeinsame Startzeit - nur sinnvoll, wenn der aufrufende Client
 * der Gastgeber ist und beide Spieler laut `getRoomStatus()` bereit sind; die
 * RPC selbst prueft das serverseitig noch einmal und lehnt sonst ab.
 */
export async function setStartTime(
  code: string,
  participantToken = '',
): Promise<CloudResult<number>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('set_duel_start_time', { p_code: code, p_participant_token: participantToken }),
    'Startzeit setzen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const startAt = Date.parse(String(result.value.data));
  if (!Number.isFinite(startAt)) return { ok: false, error: 'Ungueltige Startzeit vom Server' };
  return { ok: true, value: startAt };
}

/**
 * Fragt den aktuellen Raumzustand ab - fuer den Fall, dass ein Client einen
 * Realtime-Broadcast verpasst (kurzer Verbindungsabriss) und den Stand
 * nachholen muss, statt auf einen einmaligen, nicht wiederholbaren Broadcast
 * angewiesen zu sein.
 */
export async function getRoomStatus(
  code: string,
  participantToken = '',
): Promise<CloudResult<DuelRoomStatus | null>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('get_duel_room', { p_code: code, p_participant_token: participantToken }),
    'Raumstatus laden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  const row = Array.isArray(result.value.data) ? result.value.data[0] : null;
  if (!row) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      seed: String(row.seed),
      worldId: String(row.world_id),
      matchNumber: Number.isInteger(Number(row.match_number)) ? Number(row.match_number) : 1,
      hostReady: Boolean(row.host_ready),
      guestReady: Boolean(row.guest_ready),
      guestJoined: Boolean(row.guest_joined),
      hostTalentReady: Boolean(row.host_talent_ready),
      guestTalentReady: Boolean(row.guest_talent_ready),
      hostTalentDraft: parseTalentDraft(row.host_talent_draft),
      guestTalentDraft: parseTalentDraft(row.guest_talent_draft),
      talentDraftStartedAtMs: row.talent_draft_started_at
        ? Date.parse(String(row.talent_draft_started_at))
        : null,
      talentReadyCount: Number.isInteger(Number(row.talent_ready_count))
        ? Number(row.talent_ready_count)
        : 0,
      startAtMs: row.start_at ? Date.parse(String(row.start_at)) : null,
      hostResult: parseRoundResult(row.host_result),
      guestResult: parseRoundResult(row.guest_result),
      playerCount: Number.isInteger(Number(row.player_count))
        ? Number(row.player_count)
        : CHALLENGE_DEFAULT_PLAYER_COUNT,
      maxPlayers: Number.isInteger(Number(row.max_players))
        ? Number(row.max_players)
        : CHALLENGE_MAX_PLAYER_COUNT,
      playerResults: parsePlayerResults(row.player_results, row.host_result, row.guest_result),
    },
  };
}

function parseTalentDraft(raw: unknown): TalentRanks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return normalizeTalentRanks(raw as TalentRanks, DUEL_TALENT_POINT_BUDGET);
}

/**
 * Liest ein Rundenergebnis aus der `jsonb`-Spalte.
 *
 * Gibt `null` zurueck, sobald irgendetwas nicht stimmt - und zwar bewusst
 * dasselbe `null` wie bei "noch nicht abgegeben". Ein halb gelesenes Ergebnis
 * waere schlimmer als gar keines: es wuerde das Duell mit erfundenen Zahlen
 * als entschieden ausweisen. Solange `null` steht, wartet der Bildschirm
 * weiter und der naechste Abruf kann es korrigieren.
 */
function parseRoundResult(raw: unknown): DuelRoundResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const score = Number(record.score);
  const bestCombo = Number(record.bestCombo);
  const totalCollected = Number(record.totalCollected);
  if (!Number.isFinite(score) || !Number.isFinite(bestCombo) || !Number.isFinite(totalCollected)) {
    return null;
  }

  return { score, bestCombo, totalCollected };
}

function parsePlayerResults(
  raw: unknown,
  hostResult: unknown,
  guestResult: unknown,
): (DuelRoundResult | null)[] {
  const results = Array.from(
    { length: CHALLENGE_MAX_PLAYER_COUNT },
    () => null as DuelRoundResult | null,
  );
  if (Array.isArray(raw)) {
    raw.slice(0, CHALLENGE_MAX_PLAYER_COUNT).forEach((value, index) => {
      results[index] = parseRoundResult(value);
    });
  }
  results[0] ??= parseRoundResult(hostResult);
  results[1] ??= parseRoundResult(guestResult);
  return results;
}

/**
 * Legt das eigene Rundenergebnis dauerhaft im Raum ab.
 *
 * Der Gegenpart zu `broadcastRoundResult()`, und der eigentlich tragende Weg:
 * ein Broadcast erreicht nur, wer in genau diesem Moment zuhoert - beim
 * Rundenende ist der Gegner aber typischerweise noch mitten im eigenen Lauf
 * und hat gar keinen Empfaenger registriert. Der Broadcast bleibt als
 * Beschleuniger fuer den Fall, dass beide fast gleichzeitig fertig werden;
 * die Tabelle ist die Quelle, auf die man sich verlassen kann.
 */
async function submitRoundResultWithRetry(
  code: string,
  result: DuelRoundResult,
  participantToken = '',
): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  // Ein einzelner Fehlversuch darf das Ergebnis nicht kosten. Frueher wurde
  // der Aufruf mit `void` gestartet und ein Funkloch beim Rundenende loeschte
  // das Ergebnis endgueltig - die Rangliste wertete das Match nie, obwohl der
  // Ergebnisbildschirm ueber den Broadcast bereits fertig aussah
  // (AUDIT_2026-09-05, Befund 4). Wiederholen ist gefahrlos: der Server
  // behaelt das erste Ergebnis (`coalesce(result, p_result)`).
  let lastError = 'Ergebnis konnte nicht abgegeben werden';
  for (let attempt = 0; attempt <= DUEL_RESULT_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const delay = DUEL_RESULT_RETRY_DELAYS_MS[attempt - 1] ?? 0;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const response = await withTimeout(
      supabase.rpc('submit_duel_result', {
        p_code: code,
        p_participant_token: participantToken,
        p_result: result,
      }),
      'Ergebnis abgeben',
    );

    if (response.ok) {
      const rpcError = response.value.error;
      if (!rpcError) return { ok: true, value: true };
      // Eine fachliche Ablehnung (unplausibles Ergebnis, falsches Format)
      // faellt beim naechsten Versuch identisch aus und bricht sofort ab.
      // Jede andere Fehlerantwort wird dagegen wiederholt: das SDK meldet
      // auch ein Funkloch als aufgeloeste Antwort mit gesetztem `error`
      // (AUDIT_2026-09-05_REAUDIT, Befund 1).
      if (isPermanentDuelResultRejection(rpcError.message)) {
        return { ok: false, error: rpcError.message };
      }
      lastError = `Ergebnis abgeben: ${rpcError.message}`;
      continue;
    }
    lastError = response.error;
  }
  return { ok: false, error: lastError };
}

/**
 * Gibt ein Rundenergebnis ab und legt es vor dem ersten Netzversuch dauerhaft
 * ab. Ein Reload waehrend des Ergebnisbildschirms kann den Upload dadurch nicht
 * mehr verlieren; die MenuScene leert die Warteschlange beim naechsten Start.
 */
export async function submitRoundResult(
  code: string,
  _isHost: boolean,
  result: DuelRoundResult,
  participantToken = '',
): Promise<CloudResult<true>> {
  const accountId = AuthSystem.currentUserId();
  queueDuelResult(code, participantToken, result);
  const response = await submitRoundResultWithRetry(code, result, participantToken);
  if (response.ok || !isRetryableDuelResultError(response.error)) {
    removeQueuedDuelResult({ code, participantToken, result, queuedAt: 0 }, accountId);
  }
  return response;
}

/**
 * Wiederholt Ergebnisse, die vor einem App-Neustart noch nicht bestaetigt
 * waren. Gleichzeitige Aufrufe werden im Modul zusammengefuehrt; die
 * serverseitige Speicherung ist idempotent, falls zwei Tabs denselben Eintrag
 * trotzdem nahezu gleichzeitig abgeben.
 */
export function flushPendingRoundResults(): Promise<void> {
  pendingDuelFlush ??= (async () => {
    const accountId = AuthSystem.currentUserId();
    for (const item of readPendingDuelResults(accountId)) {
      const response = await submitRoundResultWithRetry(
        item.code,
        item.result,
        item.participantToken,
      );
      if (!response.ok && isRetryableDuelResultError(response.error)) break;
      removeQueuedDuelResult(item, accountId);
    }
  })().finally(() => {
    pendingDuelFlush = null;
  });
  return pendingDuelFlush;
}

/**
 * Schliesst einen Raum sofort, wenn ein Spieler Lobby, Ergebnis oder laufendes
 * Duell bewusst verlaesst. Ohne diesen RPC blieb die Profilmitgliedschaft bis
 * zum zehnminuetigen Raum-Timeout aktiv: Die globale Presence-Lobby zeigte den
 * Spieler bereits wieder als verfuegbar, `create_duel_invitation()` lehnte ihn
 * serverseitig aber weiterhin als "bereits in einem Duell" ab.
 *
 * Der Server prueft das Teilnehmer-Token. Ein abgelaufener oder bereits
 * geschlossener Raum ist ein idempotenter No-op; dadurch kann jeder Exit-Pfad
 * dieselbe Aufraeumroutine sicher aufrufen.
 */
export async function leaveRoom(code: string, participantToken = ''): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };
  if (!code || !participantToken) return { ok: true, value: true };

  const result = await withTimeout(
    supabase.rpc('leave_duel_room', {
      p_code: code,
      p_participant_token: participantToken,
    }),
    'Duell verlassen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

// --- Uhr-Synchronisation --------------------------------------------------------

/**
 * Ermittelt den Offset der lokalen Uhr zur Supabase-Serverzeit.
 *
 * NTP-artiges Muster: mehrere Messungen ueber `get_server_time()`
 * (`supabase/phase_2_11_duel_rooms.sql`), Median gegen Ausreisser durch
 * Mobilfunk-Jitter. `localTime + offset` ergibt die geschaetzte Serverzeit.
 *
 * Klassische NTP-Schaetzung: die Serverzeit wird ungefaehr in der Mitte des
 * Roundtrips gemessen, also `offset = serverTime - (requestStart +
 * roundTrip / 2)`. Ohne den echten `serverTime`-Rueckgabewert (reine
 * Roundtrip-Messung ohne Zeitstempel) liesse sich nur die Latenz bestimmen,
 * nicht der tatsaechliche Uhrenversatz - deshalb braucht es `get_server_time()`
 * als eigene RPC statt eines beliebigen schnellen Aufrufs.
 */
export async function measureClockOffset(): Promise<CloudResult<number>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const offsets: number[] = [];
  for (let sample = 0; sample < ONLINE_DUEL_CLOCK_SYNC_SAMPLES; sample++) {
    const requestStart = Date.now();
    const result = await withTimeout(supabase.rpc('get_server_time'), 'Uhr abgleichen');
    const requestEnd = Date.now();
    if (!result.ok) return result;
    if (result.value.error) return { ok: false, error: result.value.error.message };

    const serverTime = Date.parse(String(result.value.data));
    if (!Number.isFinite(serverTime)) {
      return { ok: false, error: 'Ungueltige Serverzeit erhalten' };
    }

    const roundTrip = requestEnd - requestStart;
    const estimatedRequestArrival = requestStart + roundTrip / 2;
    offsets.push(Math.round(serverTime - estimatedRequestArrival));
  }

  offsets.sort((a, b) => a - b);
  const median = offsets[Math.floor(offsets.length / 2)] ?? 0;
  return { ok: true, value: median };
}

// --- Realtime-Kanal --------------------------------------------------------------

/** Das Rundenergebnis, wie es ChallengeSystem.submitOnlineRound() erwartet. */
export interface DuelRoundResult {
  score: number;
  bestCombo: number;
  totalCollected: number;
  /** Serverpruefung der echten Rundenstatistik; alte Clients bleiben lesbar. */
  durationMs?: number;
  collected?: Record<string, number>;
}

/**
 * Zustand des Gegners waehrend des laufenden Runs.
 *
 * `away` heisst ausdruecklich NICHT "angehalten": im Duell laeuft die
 * Simulation beim Pausieren weiter (Fairness-Regel, siehe
 * `GameScene.togglePause`). Der Gegner sammelt also weiter, er sieht es nur
 * gerade nicht - Anruf, App-Wechsel oder Pause-Knopf. Die Anzeige muss das so
 * benennen, sonst entsteht der falsche Eindruck eines eingefrorenen Runs,
 * waehrend die Punktzahl daneben sichtbar weitersteigt.
 */
export type DuelOpponentActivity = 'playing' | 'away' | 'left' | 'finished';

export interface DuelLiveState {
  score: number;
  activity: DuelOpponentActivity;
}

export type DuelPlayerNames = (string | null)[];

export interface DuelChannelHandlers {
  onOpponentReady?: () => void;
  onTalentDraftStarted?: (startedAtMs: number) => void;
  onStartTimeSet?: (startAtMs: number) => void;
  /** Feuert, wenn der jeweils ANDERE Spieler den Kanal verlaesst. */
  onOpponentDisconnected?: (playerIndex: number) => void;
  onChannelError?: (reason: string) => void;
  onOpponentRoundResult?: (playerIndex: number, result: DuelRoundResult) => void;
  /** Laufender Zwischenstand des Gegners waehrend des Runs. */
  onOpponentLiveState?: (state: DuelLiveState, playerIndex: number) => void;
  /** Anzeigenamen aus dem aktuellen Presence-Zustand. */
  onPresenceSync?: (playerNames: DuelPlayerNames, isFullSync?: boolean) => void;
}

let activeChannel: RealtimeChannel | null = null;
let activeLocalPlayerIndex = 0;

/**
 * Aktuell registrierte Handler - veraenderbar statt einmalig in `subscribeToRoom()`
 * fest verdrahtet, weil der Kanal als Modul-Singleton den Scene-Wechsel
 * Lobby -> GameScene ueberlebt (siehe `ChallengeSystem`-Kommentar zum selben
 * Muster), aber jede Scene ihre eigene Reaktion auf dieselben Ereignisse
 * braucht. `OnlineDuelScene` will z. B. einen Disconnect nur in der Lobby
 * anzeigen, `GameScene` dagegen waehrend des laufenden Runs.
 */
let activeHandlers: DuelChannelHandlers = {};

let activeLobbyChannel: RealtimeChannel | null = null;
let activeLobbyHandlers: DuelLobbyHandlers = {};
let lobbyLocalPlayerName = '';
let lobbyPresenceKey = '';
let lobbyAvailability: DuelLobbyAvailability = 'available';

/**
 * Meldet einen eingeloggten Spieler in der globalen Duell-Lobby an.
 *
 * Presence ist hier bewusst nur fuer die fluechtige Liste zustaendig. Eine
 * Einladung wird nach dem Klick separat ueber einen RPC angelegt; dadurch ist
 * ein verlorenes Broadcast-Ereignis kein verlorener Duellstart.
 */
export function subscribeToDuelLobby(
  supabase: SupabaseClient,
  localPlayerName: string,
  handlers: DuelLobbyHandlers,
): void {
  unsubscribeFromDuelLobby();
  activeLobbyHandlers = handlers;
  lobbyLocalPlayerName = cleanPresencePlayerName(localPlayerName) ?? '';
  lobbyPresenceKey = createPresenceKey();
  lobbyAvailability = 'available';

  // Die globale Lobby ist absichtlich ein oeffentlicher Realtime-Kanal. Die
  // Raumkanaele bleiben privat und werden ueber duel_channel_is_authorized
  // geschuetzt. Fuer die globale Presence gibt es dagegen keine einzelne
  // Raum-Mitgliedschaft, gegen die Supabase die private Kanal-Policy pruefen
  // koennte; auf iOS wurden deshalb trotz SUBSCRIBED nur lokale Presence-
  // Eintraege geliefert. Die Einladung selbst bleibt serverseitig ueber den
  // authentifizierten RPC und die Zielspieler-ID geschuetzt.
  const channel = supabase.channel('duel-lobby', {
    config: { private: false, presence: { key: lobbyPresenceKey } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      activeLobbyHandlers.onPlayersSync?.(
        readDuelLobbyPlayers(channel.presenceState(), lobbyPresenceKey),
      );
    })
    .on(
      'broadcast',
      { event: 'duel-invitation' },
      ({ payload }: { payload: { invitationId?: unknown; targetPlayerName?: unknown } }) => {
        const invitationId = stringValue(payload.invitationId);
        const targetName = cleanPresencePlayerName(payload.targetPlayerName);
        if (
          invitationId &&
          targetName &&
          targetName.toLowerCase() === lobbyLocalPlayerName.toLowerCase()
        ) {
          activeLobbyHandlers.onInvitationReceived?.(invitationId);
        }
      },
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        activeLobbyHandlers.onChannelError?.(error?.message ?? `Kanalstatus: ${status}`);
        return;
      }
      if (status !== 'SUBSCRIBED') return;

      void channel
        .track({
          online: true,
          playerName: lobbyLocalPlayerName,
          availability: lobbyAvailability,
        })
        .catch(() => {
          activeLobbyHandlers.onChannelError?.('Duell-Lobby konnte nicht betreten werden');
        });
    });

  activeLobbyChannel = channel;
}

/** Aktualisiert den sichtbaren Bereitschaftsstatus ohne den Kanal neu zu oeffnen. */
export function setDuelLobbyAvailability(availability: DuelLobbyAvailability): void {
  lobbyAvailability = availability;
  if (!activeLobbyChannel) return;
  void activeLobbyChannel.track({
    online: true,
    playerName: lobbyLocalPlayerName,
    availability,
  });
}

/** Verlaesst die globale Lobby, z. B. beim Wechsel in einen Duellraum. */
export function unsubscribeFromDuelLobby(): void {
  activeLobbyHandlers = {};
  if (!activeLobbyChannel) return;
  void activeLobbyChannel.unsubscribe();
  activeLobbyChannel = null;
  lobbyLocalPlayerName = '';
  lobbyPresenceKey = '';
}

function createPresenceKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readDuelLobbyPlayers(
  state: Record<string, unknown>,
  localPresenceKey: string,
): DuelLobbyPlayer[] {
  const byName = new Map<string, DuelLobbyPlayer>();
  for (const [presenceKey, rawEntries] of Object.entries(state)) {
    if (presenceKey === localPresenceKey || !Array.isArray(rawEntries)) continue;
    const latest = rawEntries[rawEntries.length - 1];
    if (!latest || typeof latest !== 'object') continue;
    const record = latest as Record<string, unknown>;
    const playerName = cleanPresencePlayerName(record.playerName);
    if (!playerName) continue;
    const availability: DuelLobbyAvailability =
      record.availability === 'available' ? 'available' : 'busy';
    const key = playerName.toLowerCase();
    const existing = byName.get(key);
    // Mehrere Tabs desselben Profils werden zu einem Eintrag zusammengelegt;
    // sichtbar bleibt der guenstigere Status.
    if (!existing || (availability === 'available' && existing.availability === 'busy')) {
      byName.set(key, { presenceKey, playerName, availability });
    }
  }

  return [...byName.values()].sort((left, right) =>
    left.playerName.localeCompare(right.playerName, 'de'),
  );
}

function broadcastLobbyInvitation(targetPlayerName: string, invitationId: string): void {
  if (!activeLobbyChannel) return;
  void activeLobbyChannel.send({
    type: 'broadcast',
    event: 'duel-invitation',
    payload: { invitationId, targetPlayerName },
  });
}

/**
 * Legt Handler auf dem bereits verbundenen Kanal nach, ohne neu zu verbinden.
 *
 * Ergaenzt statt zu ersetzen - belegt durch den Zwei-Geraete-Testbericht
 * v0.1.236 (2026-08-22). Vorher setzte diese Funktion `activeHandlers`
 * komplett neu; `GameScene` uebergab dabei nur `onOpponentDisconnected` und
 * meldete damit still alles ab, was die Lobby registriert hatte. Das fiel
 * nicht auf, weil ein fehlender optionaler Handler kein Fehler ist: das
 * Ereignis kam an, `?.` schluckte es, niemand reagierte.
 *
 * Wer einen geerbten Handler gezielt loswerden will, uebergibt ihn explizit
 * als `undefined` - das bleibt moeglich, ist dann aber eine sichtbare
 * Entscheidung statt eines Nebeneffekts.
 */
export function updateHandlers(handlers: DuelChannelHandlers): void {
  activeHandlers = { ...activeHandlers, ...handlers };
}

function cleanPresencePlayerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = sanitizePlayerName(raw);
  return clean || null;
}

function readPresencePlayerNames(state: Record<string, unknown>): DuelPlayerNames {
  const names: DuelPlayerNames = Array.from({ length: CHALLENGE_MAX_PLAYER_COUNT }, () => null);

  for (let index = 0; index < CHALLENGE_MAX_PLAYER_COUNT; index += 1) {
    const entries = state[String(index)];
    if (!Array.isArray(entries)) continue;

    const latest = entries[entries.length - 1];
    if (!latest || typeof latest !== 'object') continue;
    names[index] = cleanPresencePlayerName((latest as { playerName?: unknown }).playerName);
  }

  return names;
}

/**
 * Abonniert den privaten Broadcast-/Presence-Kanal fuer einen Raum.
 *
 * Topic = Raum-Code und gemeinsamer Server-Seed. Beide Spieler erhalten den
 * Seed beim Erzeugen/Beitreten desselben Raums und muessen deshalb exakt den
 * gleichen Realtime-Kanal abonnieren. `private: true` aktiviert die
 * RLS-Pruefung; die Policy verifiziert Code und Seed gemeinsam gegen den
 * Raum. Die individuellen Teilnehmer-Tokens bleiben fuer die RPCs zustaendig.
 *
 * `localPlayerIndex` wird als Presence-Key genutzt (nicht der Raum-Code):
 * Presence unterscheidet Clients ueber ihren Key - mit demselben Key fuer
 * beide Spieler (frueherer Fehler, am Geraet reproduziert 2026-08-18) sieht
 * Realtime nur einen einzigen, geteilten Presence-Eintrag und kann "wer hat
 * die Verbindung verloren" nicht mehr unterscheiden.
 *
 * `channel.track(...)` ist zwingend: ohne aktives Tracking meldet sich kein
 * Client als anwesend, und ohne einen anwesenden Client kann auch kein
 * `leave`-Event entstehen - Presence ist kein passiver Verbindungsstatus,
 * sondern muss aktiv gesetzt werden.
 */
export function subscribeToRoom(
  supabase: SupabaseClient,
  code: string,
  localPlayerIndex: number,
  handlers: DuelChannelHandlers,
  localPlayerName = '',
  participantToken = '',
  sharedChannelKey = '',
): void {
  unsubscribeFromRoom();
  activeHandlers = handlers;
  activeLocalPlayerIndex = localPlayerIndex;
  // Ein neuer Kanal ist ein neuer Diagnosefall - sonst bliebe ein Grund, der
  // im ersten Duell einmal gemeldet wurde, im zweiten fuer immer stumm.
  reportedLiveDrops.clear();
  // Eine Karenzfrist aus dem alten Kanal darf nicht in den neuen hineinlaufen
  // und dort eine Trennung melden, die es gar nicht gibt.
  clearPendingDisconnects();
  // Beide Diagnosemarken gelten je Kanal: ein neuer Kanal soll seinen ersten
  // Presence-Stand und seinen ersten empfangenen Zwischenstand erneut melden.
  lastPresenceKeys = null;
  firstLiveLogged = false;

  // **Kein `broadcast: { ack: true }`.** Es war in v0.1.255 kurzzeitig
  // gesetzt, um stille RLS-Ablehnungen sichtbar zu machen - und hat genau das
  // geleistet: die fehlende INSERT-Policy wurde gefunden und in
  // `supabase/phase_2_20_duel_realtime_policies.sql` behoben.
  //
  // Zurueckgenommen, weil `ack` nicht nur diagnostiziert, sondern das
  // Laufzeitverhalten aendert: `send()` wartet dann auf eine
  // Serverbestaetigung. Die Kosten wurden am haeufigsten Aufrufer bemessen
  // (`live`, 400ms-Takt, unkritisch) statt am empfindlichsten -
  // `broadcastReady()` und `broadcastStartTime()` liegen im Lobby-Ablauf, der
  // zum Rundenstart fuehren MUSS. Am Geraet (2026-08-28) brach die Kette
  // danach unmittelbar nach `presence-track: ok` ab, das Duell kam nicht mehr
  // zustande.
  //
  // Der Verzicht kostet wenig: die Lobby haengt ohnehin nicht am Broadcast,
  // sondern am Polling ueber `getRoomStatus()` (der Broadcast ist dort nur
  // die Abkuerzung), und eine kuenftige Ablehnung wuerde sich heute in
  // `duel:presence-sync` und `duel:live-empfangen` zeigen - beide gab es
  // damals noch nicht.
  // Beide Spieler muessen denselben Kanal sehen. Ihre Teilnehmer-Tokens sind
  // absichtlich verschieden und wuerden den Host- und Gast-Kanal trennen:
  // genau dadurch blieben Live-Score, Presence und Namen bisher unsichtbar.
  // Der Server-Seed ist beiden Clients bekannt und bindet den gemeinsamen
  // Kanal per Realtime-RLS an exakt diesen Raum. Der Token-Fallback haelt alte
  // isolierte Aufrufer testbar; der produktive Online-Duell-Pfad uebergibt
  // immer den Seed.
  const channelKey = sharedChannelKey || participantToken;
  const channel = supabase.channel(`${code}:${channelKey}`, {
    config: { private: true, presence: { key: String(localPlayerIndex) } },
  });
  const cleanLocalPlayerName = cleanPresencePlayerName(localPlayerName);
  const broadcastLocalPlayerName = (): void => {
    if (!cleanLocalPlayerName) return;
    void channel.send({
      type: 'broadcast',
      event: 'player-info',
      payload: { playerIndex: localPlayerIndex, playerName: cleanLocalPlayerName },
    });
  };

  channel
    .on('broadcast', { event: 'ready' }, () => activeHandlers.onOpponentReady?.())
    .on(
      'broadcast',
      { event: 'talent-draft-start' },
      ({ payload }: { payload: { startedAtMs?: unknown } }) => {
        const startedAtMs = Number(payload.startedAtMs);
        if (Number.isFinite(startedAtMs)) activeHandlers.onTalentDraftStarted?.(startedAtMs);
      },
    )
    .on('broadcast', { event: 'start' }, ({ payload }: { payload: { startAtMs?: unknown } }) => {
      const startAtMs = Number(payload.startAtMs);
      if (Number.isFinite(startAtMs)) activeHandlers.onStartTimeSet?.(startAtMs);
    })
    .on(
      'broadcast',
      { event: 'round-result' },
      ({
        payload,
      }: {
        payload: {
          playerIndex?: unknown;
          score?: unknown;
          bestCombo?: unknown;
          totalCollected?: unknown;
        };
      }) => {
        const playerIndex = Number(payload.playerIndex);
        if (
          !Number.isInteger(playerIndex) ||
          playerIndex < 0 ||
          playerIndex >= CHALLENGE_MAX_PLAYER_COUNT
        )
          return;
        activeHandlers.onOpponentRoundResult?.(playerIndex, {
          score: Number(payload.score) || 0,
          bestCombo: Number(payload.bestCombo) || 0,
          totalCollected: Number(payload.totalCollected) || 0,
        });
      },
    )
    .on(
      'broadcast',
      { event: 'live' },
      ({
        payload,
      }: {
        payload: { playerIndex?: unknown; score?: unknown; activity?: unknown };
      }) => {
        // Der eigene Broadcast kommt auf demselben Kanal zurueck - ohne diese
        // Pruefung wuerde das Geraet den eigenen Stand als den des Gegners
        // anzeigen. Das ist der einzige stille Fall: er tritt bei JEDEM
        // eigenen Takt ein und ist voellig normal.
        const playerIndex = Number(payload.playerIndex);
        if (
          !Number.isInteger(playerIndex) ||
          playerIndex < 0 ||
          playerIndex >= CHALLENGE_MAX_PLAYER_COUNT ||
          playerIndex === activeLocalPlayerIndex
        )
          return;

        const score = Number(payload.score);

        // Ein angekommener, aber verworfener Stand sah bisher genauso aus wie
        // ein nie angekommener: beides hinterliess keine Spur. Diese
        // Unterscheidung war der fehlende Befund am 2026-08-23 - deshalb wird
        // jedes Verwerfen protokolliert. Nur EINMAL pro Ursache, damit der
        // 400ms-Takt den Ringpuffer nicht flutet.
        if (!Number.isFinite(score) || !isOpponentActivity(payload.activity)) {
          logLiveDropOnce('unbrauchbare Nutzlast', JSON.stringify(payload));
          return;
        }

        if (!activeHandlers.onOpponentLiveState) {
          // Genau die Falle, die beim Rundenergebnis schon einmal zuschlug
          // (v0.1.236): der Handler war deklariert, aber keine Scene hatte
          // ihn gesetzt - `?.` schluckte jede Meldung lautlos.
          logLiveDropOnce('kein Empfaenger registriert', '');
          return;
        }

        // Einmalig belegen, dass ueberhaupt je ein Stand des Gegners ankam.
        // Bisher liess sich "es kam nichts an" nicht von "es kam an und
        // wurde weitergereicht" unterscheiden: der Erfolgsfall hinterliess
        // gar keine Spur, nur die Verwurfsgruende taten es. Genau diese
        // Zeile beantwortet die Ausgangsfrage direkt.
        if (!firstLiveLogged) {
          firstLiveLogged = true;
          DebugSystem.pushProtectedLogEntry({
            timestamp: Date.now(),
            kind: 'event',
            label: 'duel:live-empfangen',
            detail: `erster Stand des Gegners: ${score}`,
          });
        }

        activeHandlers.onOpponentLiveState({ score, activity: payload.activity }, playerIndex);
      },
    )
    .on(
      'broadcast',
      { event: 'player-info' },
      ({ payload }: { payload: { playerIndex?: unknown; playerName?: unknown } }) => {
        const playerIndex = Number(payload.playerIndex);
        if (
          !Number.isInteger(playerIndex) ||
          playerIndex < 0 ||
          playerIndex >= CHALLENGE_MAX_PLAYER_COUNT
        )
          return;
        const playerName = cleanPresencePlayerName(payload.playerName);
        if (!playerName) return;
        const playerNames: DuelPlayerNames = Array.from(
          { length: CHALLENGE_MAX_PLAYER_COUNT },
          () => null,
        );
        playerNames[playerIndex] = playerName;
        activeHandlers.onPresenceSync?.(playerNames);
      },
    )
    .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
      // Nur reagieren, wenn der ANDERE Spieler gegangen ist - Presence
      // meldet grundsaetzlich jeden Abgang im Kanal, auch den eigenen beim
      // Neuverbinden.
      if (key === String(activeLocalPlayerIndex)) return;
      scheduleDisconnect(key);
    })
    .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
      // Der Gegenpart zur Karenz im `leave`: kehrt derselbe Schluessel
      // zurueck, war das `leave` ein Kanalwechsel und kein Abbruch.
      if (key === String(activeLocalPlayerIndex)) return;
      cancelPendingDisconnect(key, 'join');
      broadcastLocalPlayerName();
    })
    .on('presence', { event: 'sync' }, () => {
      // `sync` liefert den VOLLSTAENDIGEN Anwesenheitsstand, nicht nur eine
      // Aenderung - damit laesst sich als einziges Ereignis beantworten, ob
      // der Gegner im Kanal ueberhaupt sichtbar ist.
      //
      // Der Bericht vom 2026-08-28 zeigte einen stehenden Kanal
      // (`SUBSCRIBED`) ohne ein einziges Presence-Ereignis ueber die ganze
      // Runde. Offen blieb: meldet sich der Gegner nicht an, oder kommen
      // seine Ereignisse nicht durch? `sync` unterscheidet das - es feuert
      // auch dann, wenn ein `join` verlorenging.
      //
      // Nur der ERSTE Stand pro Kanal wird protokolliert und danach jede
      // Aenderung der Schluesselmenge: `sync` kann bei jedem Presence-Wechsel
      // feuern und wuerde den Puffer sonst fluten.
      const presenceState = channel.presenceState();
      const keys = Object.keys(presenceState).sort().join(',');
      activeHandlers.onPresenceSync?.(readPresencePlayerNames(presenceState), true);
      broadcastLocalPlayerName();
      if (keys === lastPresenceKeys) return;
      lastPresenceKeys = keys;

      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'duel:presence-sync',
        detail: keys ? `anwesend: ${keys}` : 'niemand anwesend',
      });
    })
    .subscribe((status, error) => {
      // JEDEN Statuswechsel mitschreiben, nicht nur den Fehlerfall. Ein
      // `CLOSED` beim Szenenwechsel ist kein Fehler und wuerde deshalb still
      // bleiben - genau die Beobachtung, die fehlte, als waehrend eines
      // ganzen Runs kein Zwischenstand ankam (2026-08-23). Der Statuswechsel
      // ist selten (eine Handvoll pro Duell) und belastet den Ringpuffer
      // nicht.
      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: status === 'SUBSCRIBED' ? 'event' : 'error',
        label: 'duel:kanalstatus',
        detail: error ? `${status}: ${error.message}` : status,
      });

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const reason = error?.message ?? `Kanalstatus: ${status}`;
        // Landet im Debug-Ringpuffer (DebugSystem.installConsoleCapture) -
        // ohne dieses Log verschwindet der Fehler spurlos, weil der
        // UI-Handler ihn nur als Text anzeigt, nicht protokolliert. Genau
        // diese Luecke hat den ersten Realtime-Verbindungsfehler
        // (2026-08-18) im Debug-Report unsichtbar gemacht.
        console.warn(`[NetworkDuelSystem] Kanalfehler fuer Raum ${code}:`, reason, error);
        activeHandlers.onChannelError?.(reason);
        return;
      }
      if (status === 'SUBSCRIBED') {
        // **Der Rueckgabewert wurde bisher mit `void` verworfen** - dieselbe
        // blinde Stelle wie beim Senden vor v0.1.250. `track()` ist die
        // Anmeldung dieses Geraets als anwesend; schlaegt sie fehl, entsteht
        // fuer den Gegner nie ein `join`, und niemand erfaehrt davon.
        //
        // Besonders wichtig nach einem `transport failure`: der Bericht vom
        // 2026-08-28 zeigt Abbruch und Wiederaufbau innerhalb von 1,5
        // Sekunden, danach aber ueber die ganze Runde kein einziges
        // Presence-Ereignis. Ob die Wiederanmeldung dabei ueberhaupt gelang,
        // war nicht feststellbar.
        void channel
          .track({
            online: true,
            ...(cleanLocalPlayerName ? { playerName: cleanLocalPlayerName } : {}),
          })
          .then((trackStatus) => {
            DebugSystem.pushProtectedLogEntry({
              timestamp: Date.now(),
              kind: trackStatus === 'ok' ? 'event' : 'error',
              label: 'duel:presence-track',
              detail: String(trackStatus),
            });
          })
          .catch((trackError: unknown) => {
            DebugSystem.pushProtectedLogEntry({
              timestamp: Date.now(),
              kind: 'error',
              label: 'duel:presence-track',
              detail: trackError instanceof Error ? trackError.message : 'Unbekannter Fehler',
            });
          });
        // Presence-Metadaten waren in einigen realen Kanalstaenden nicht im
        // lesbaren Snapshot enthalten. Der Broadcast ist die zusaetzliche,
        // kurzlebige Zustellung ueber denselben Kanal, ueber den auch der
        // laufende Gegnerstand verlaesslich ankommt. Bei jedem Sync und Join
        // wird er erneut gesendet, damit auch ein spaet beigetretener Client
        // den Namen erhaelt.
        broadcastLocalPlayerName();
      }
    });

  activeChannel = channel;
}

/**
 * Sendet ein Broadcast-Ereignis und protokolliert, was dabei herauskam.
 *
 * **Warum das Protokoll noetig wurde.** Bis v0.1.249 lautete jede Sendestelle
 * `void activeChannel?.send(...)`. Beide Teile dieser Zeile schlucken
 * Information: `?.` macht einen fehlenden Kanal zu einem stillen Nichtstun,
 * und `void` verwirft die Antwort des Kanals. Als im Zwei-Geraete-Test
 * (2026-08-23) waehrend des gesamten Runs kein einziger Zwischenstand beim
 * Gegner ankam, liess sich deshalb nicht entscheiden, ob gar nicht gesendet
 * oder nur nicht empfangen wurde - der Sendepfad war vollstaendig blind.
 * Dieselbe Luecke hatte `withTimeout()` fuer die RPC-Seite schon einmal
 * (Kommentar dort); hier war sie noch offen.
 *
 * `send()` loest ohne `broadcast.ack`-Option bereits mit "ok" auf, sobald die
 * Nachricht lokal in der Warteschlange liegt - das Protokoll belegt also den
 * Absendeversuch, nicht die Zustellung. Genau diese Unterscheidung ist der
 * gesuchte Befund: "ok" bei ausbleibendem Empfang zeigt auf die Strecke,
 * "kein Kanal" auf den eigenen Client.
 */
function sendBroadcast(event: string, payload: Record<string, unknown>): void {
  if (!activeChannel) {
    DebugSystem.pushProtectedLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: `duel:send/${event}`,
      detail: 'kein aktiver Kanal - Nachricht verworfen',
    });
    return;
  }

  void activeChannel
    .send({ type: 'broadcast', event, payload })
    .then((status) => {
      // Nur der Fehlerfall wird protokolliert: `live` feuert im 400ms-Takt
      // und wuerde selbst den geschuetzten Puffer
      // (`DEBUG_PROTECTED_BUFFER_SIZE`, 60 Plaetze) in 24 Sekunden fuellen.
      // Der Schutz erlaubt seltene Eintraege, er hebt die Ereignisrate nicht
      // auf - deshalb bleibt der Erfolgsfall stumm.
      if (status === 'ok') return;
      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'error',
        label: `duel:send/${event}`,
        detail: String(status),
      });
    })
    .catch((error: unknown) => {
      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'error',
        label: `duel:send/${event}`,
        detail: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    });
}

/** Sendet ein "ich bin bereit"-Signal an den Kanal. */
export function broadcastReady(): void {
  sendBroadcast('ready', {});
}

/** Teilt den anderen Clients den Beginn der serverseitigen Talentphase mit. */
export function broadcastTalentDraftStarted(startedAtMs: number): void {
  sendBroadcast('talent-draft-start', { startedAtMs });
}

/** Verteilt die vom Gastgeber gesetzte Startzeit an den Kanal. */
export function broadcastStartTime(startAtMs: number): void {
  sendBroadcast('start', { startAtMs });
}

/**
 * Sendet das eigene Rundenergebnis einmalig an den Gegner.
 *
 * Anders als der laufende Score-Broadcast aus Phase 2 (400ms-Takt, siehe
 * `config/onlineDuel.ts`) ist das ein einzelner Aufruf direkt nach
 * Rundenende - dieselbe Kanal-Infrastruktur, aber ein eigener Event-Typ, weil
 * ein Rundenergebnis eine andere Payload und Bedeutung hat als ein
 * Zwischenstand waehrend des Laufs.
 */
export function broadcastRoundResult(playerIndex: number, result: DuelRoundResult): void {
  sendBroadcast('round-result', { playerIndex, ...result });
}

/**
 * Sendet den eigenen Zwischenstand an den Gegner.
 *
 * Bewusst Broadcast und NICHT die Tabelle - das ist die andere Seite der
 * Regel aus `supabase/phase_2_11_duel_rooms.sql` Abschnitt 3: haeufig und
 * kurzlebig gehoert auf den Kanal. Ein verlorener Zwischenstand ist
 * unkritisch, der naechste Takt liefert ihn nach; das Rundenergebnis
 * dagegen liegt aus genau diesem Grund persistent im Raum
 * (`submitRoundResult`).
 */
export function broadcastLiveState(playerIndex: number, state: DuelLiveState): void {
  sendBroadcast('live', { playerIndex, ...state });
}

function isOpponentActivity(raw: unknown): raw is DuelOpponentActivity {
  return raw === 'playing' || raw === 'away' || raw === 'left' || raw === 'finished';
}

/**
 * Laufende Karenzfristen je Presence-Schluessel.
 *
 * Eine Map und kein einzelner Timer: theoretisch koennen mehrere Schluessel
 * gleichzeitig in Karenz sein, und ein `join` darf nur die Frist des eigenen
 * Schluessels aufheben - sonst wuerde die Rueckkehr des einen den Abbruch des
 * anderen verschlucken.
 */
const pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Zuletzt protokollierte Presence-Schluesselmenge.
 *
 * `sync` feuert bei jedem Presence-Wechsel; ohne diesen Vergleich stuende
 * derselbe Stand mehrfach im Puffer. Interessant ist nur die Aenderung -
 * "wer ist jetzt da" statt "sync ist gefeuert".
 *
 * `null` als Startwert und nicht `''`: der leere Kanal ist ein GUELTIGER
 * Stand ("niemand anwesend") und genau der interessanteste Verdachtsfall -
 * mit `''` als Startwert waere ausgerechnet er als "unveraendert" verschluckt
 * worden.
 */
let lastPresenceKeys: string | null = null;

/** Belegt einmalig pro Kanal, dass ueberhaupt ein Stand des Gegners ankam. */
let firstLiveLogged = false;

/**
 * Meldet eine Trennung erst nach `ONLINE_DUEL_PRESENCE_GRACE_MS`.
 *
 * Der Grund steht ausfuehrlich bei der Konstante: ein Presence-`leave` ist
 * beim Szenenwechsel Lobby -> GameScene der Normalfall, kein Abbruch. Ohne
 * Karenz meldete das Geraet die Trennung 5ms nach dem Rundenstart und zeigte
 * danach die ganze Runde lang "Verbindung weg" (Bericht 2026-08-25).
 *
 * `setTimeout` statt eines Phaser-Timers: `systems/` kennt Phaser nicht
 * (Regel 6), und der Kanal lebt ohnehin laenger als jede einzelne Scene.
 */
function scheduleDisconnect(key: string): void {
  if (pendingDisconnects.has(key)) return;

  DebugSystem.pushProtectedLogEntry({
    timestamp: Date.now(),
    kind: 'event',
    label: 'duel:presence-leave',
    detail: `Schluessel ${key} - Karenz laeuft`,
  });

  pendingDisconnects.set(
    key,
    setTimeout(() => {
      pendingDisconnects.delete(key);
      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'error',
        label: 'duel:presence-weg',
        detail: `Schluessel ${key} - keine Rueckkehr, Trennung gemeldet`,
      });
      const playerIndex = Number(key);
      activeHandlers.onOpponentDisconnected?.(Number.isInteger(playerIndex) ? playerIndex : -1);
    }, ONLINE_DUEL_PRESENCE_GRACE_MS),
  );
}

/**
 * Hebt eine laufende Karenzfrist auf - der Gegner ist zurueck.
 *
 * Protokolliert bewusst auch den Fall ohne laufende Frist: ein `join` ohne
 * vorheriges `leave` ist die normale Erstanmeldung und belegt, dass Presence
 * ueberhaupt funktioniert. Beides zusammen macht im Bericht den Unterschied
 * zwischen "Kanalwechsel" und "echter Abbruch" lesbar, ohne dass man ihn
 * erraten muss.
 */
function cancelPendingDisconnect(key: string, reason: string): void {
  const pending = pendingDisconnects.get(key);

  DebugSystem.pushProtectedLogEntry({
    timestamp: Date.now(),
    kind: 'event',
    label: 'duel:presence-join',
    detail: pending
      ? `Schluessel ${key} - zurueck (${reason}), Karenz aufgehoben`
      : `Schluessel ${key} - angemeldet (${reason})`,
  });

  if (!pending) return;
  clearTimeout(pending);
  pendingDisconnects.delete(key);
}

/** Beendet alle laufenden Karenzfristen - beim Kanalwechsel und beim Verlassen. */
function clearPendingDisconnects(): void {
  for (const timer of pendingDisconnects.values()) clearTimeout(timer);
  pendingDisconnects.clear();
}

/**
 * Bereits gemeldete Verwurfsgruende - der `live`-Takt feuert alle 400ms, eine
 * Meldung pro Nachricht wuerde den Ringpuffer (`DEBUG_LOG_BUFFER_SIZE`) in gut
 * zwei Minuten vollstaendig ueberschreiben und damit genau den Verlauf
 * loeschen, den der Bericht zeigen soll.
 *
 * Fuer die Diagnose genuegt die erste Meldung: die Frage lautet "kommt etwas
 * an und wird verworfen?", nicht "wie oft".
 */
const reportedLiveDrops = new Set<string>();

function logLiveDropOnce(reason: string, detail: string): void {
  if (reportedLiveDrops.has(reason)) return;
  reportedLiveDrops.add(reason);

  DebugSystem.pushProtectedLogEntry({
    timestamp: Date.now(),
    kind: 'error',
    label: 'duel:live-verworfen',
    detail: detail ? `${reason}: ${detail}` : reason,
  });
}

/** Verlaesst den aktuellen Kanal, falls einer aktiv ist - wirft nie. */
export function unsubscribeFromRoom(): void {
  activeHandlers = {};
  // Ohne das feuerte eine laufende Frist nach dem Verlassen noch in einen
  // Handler, den niemand mehr erwartet.
  clearPendingDisconnects();
  if (!activeChannel) return;
  void activeChannel.unsubscribe();
  activeChannel = null;
}

// --- Hilfsfunktionen ---------------------------------------------------------

/**
 * Legt ein Zeitlimit ueber eine Anfrage - identisches Muster zu
 * `CloudSystem.withTimeout`, hier dupliziert statt importiert, weil
 * `withTimeout` in CloudSystem nicht exportiert ist und ein Export nur fuer
 * diesen einen Wiederverwendungsfall den Modulschnitt unnoetig aufweichen
 * wuerde.
 *
 * Protokolliert Erfolg UND Fehlschlag im Debug-Ringpuffer (nicht nur
 * console.warn im Fehlerfall) - dieselbe Luecke wie bei `CloudSystem.
 * withTimeout` vor 2026-08-18, hier aber uebersehen, weil die Kopie separat
 * gepflegt wird. Ein Zwei-Geraete-Testbericht ohne einen einzigen
 * NetworkDuelSystem-Eintrag hat das aufgedeckt: unklar, ob create_duel_room/
 * join_duel_room/get_server_time ueberhaupt liefen, weil weder Erfolg noch
 * (sichtbarer) Fehlschlag geloggt wurden.
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
      label: `duel:${label}`,
      detail: `ok ${Date.now() - startedAt}ms`,
    });
    return { ok: true, value };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: `duel:${label}`,
      detail: `fehlgeschlagen ${Date.now() - startedAt}ms: ${reason}`,
    });
    console.warn(`[NetworkDuelSystem] ${label} fehlgeschlagen:`, error);
    return { ok: false, error: `${label}: ${reason}` };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

/** Gueltigkeit eines Raum-Codes, fuer die Anzeige im UI ("gueltig fuer X Minuten"). */
export function roomCodeTtlMinutes(): number {
  return DUEL_ROOM_CODE_TTL_MINUTES;
}
