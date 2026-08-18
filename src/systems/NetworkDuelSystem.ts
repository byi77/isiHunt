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

import { BACKEND_TIMEOUT_MS, SYNC_CODE_ALPHABET } from '@/config/backend';
import { DUEL_ROOM_CODE_TTL_MINUTES, ONLINE_DUEL_CLOCK_SYNC_SAMPLES } from '@/config/onlineDuel';
import * as CloudSystem from '@/systems/CloudSystem';
import type { CloudResult } from '@/systems/CloudSystem';
import * as DebugSystem from '@/systems/DebugSystem';

const DUEL_ROOM_CODE_LENGTH = 6;

// --- Ergebnistypen ------------------------------------------------------------

export interface DuelRoomInfo {
  seed: string;
  worldId: string;
}

export interface DuelRoomStatus {
  seed: string;
  worldId: string;
  hostReady: boolean;
  guestReady: boolean;
  guestJoined: boolean;
  /** Serverzeit (ms seit Epoch), zu der beide gleichzeitig starten sollen. */
  startAtMs: number | null;
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
 * Der Seed wird hier (nicht serverseitig) erzeugt, weil `crypto.
 * getRandomValues` im Client genauso gut geeignet ist und die RPC dadurch
 * keinen Zufallsgenerator braucht - der Server validiert nur Format, erzeugt
 * ihn aber nicht. Bei einer Code-Kollision (Postgres 23505) wird bis zu
 * dreimal neu versucht, exakt wie bei `CloudSystem.createSyncCode()`.
 */
export async function createRoom(
  worldId: string,
): Promise<CloudResult<{ code: string; seed: string }>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const seed = createSeed();

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = createRoomCode();
    const result = await withTimeout(
      supabase.rpc('create_duel_room', { p_world_id: worldId, p_code: code, p_seed: seed }),
      'Raum erzeugen',
    );

    if (!result.ok) return result;
    if (!result.value.error) return { ok: true, value: { code, seed } };

    // 23505 = unique_violation. Alles andere ist ein echter Fehler.
    if (result.value.error.code !== '23505') {
      return { ok: false, error: result.value.error.message };
    }
  }

  return { ok: false, error: 'Kein freier Code gefunden - bitte erneut versuchen' };
}

/** Zufaelliger Seed fuer die Relikt-Abfolge - Format analog `ChallengeSystem.createSeed`. */
function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  return { ok: true, value: { seed: String(row.seed), worldId: String(row.world_id) } };
}

/** Meldet dieses Geraet als bereit fuer den Start. */
export async function markReady(code: string, isHost: boolean): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('mark_duel_ready', { p_code: code, p_is_host: isHost }),
    'Bereit melden',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };
  return { ok: true, value: true };
}

/**
 * Setzt die gemeinsame Startzeit - nur sinnvoll, wenn der aufrufende Client
 * der Gastgeber ist und beide Spieler laut `getRoomStatus()` bereit sind; die
 * RPC selbst prueft das serverseitig noch einmal und lehnt sonst ab.
 */
export async function setStartTime(code: string): Promise<CloudResult<number>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('set_duel_start_time', { p_code: code }),
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
export async function getRoomStatus(code: string): Promise<CloudResult<DuelRoomStatus | null>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await withTimeout(
    supabase.rpc('get_duel_room', { p_code: code }),
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
      hostReady: Boolean(row.host_ready),
      guestReady: Boolean(row.guest_ready),
      guestJoined: Boolean(row.guest_joined),
      startAtMs: row.start_at ? Date.parse(String(row.start_at)) : null,
    },
  };
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
}

export interface DuelChannelHandlers {
  onOpponentReady?: () => void;
  onStartTimeSet?: (startAtMs: number) => void;
  /** Feuert, wenn der jeweils ANDERE Spieler den Kanal verlaesst. */
  onOpponentDisconnected?: () => void;
  onChannelError?: (reason: string) => void;
  onOpponentRoundResult?: (playerIndex: 0 | 1, result: DuelRoundResult) => void;
}

let activeChannel: RealtimeChannel | null = null;
let activeLocalPlayerIndex: 0 | 1 = 0;

/**
 * Aktuell registrierte Handler - veraenderbar statt einmalig in `subscribeToRoom()`
 * fest verdrahtet, weil der Kanal als Modul-Singleton den Scene-Wechsel
 * Lobby -> GameScene ueberlebt (siehe `ChallengeSystem`-Kommentar zum selben
 * Muster), aber jede Scene ihre eigene Reaktion auf dieselben Ereignisse
 * braucht. `OnlineDuelScene` will z. B. einen Disconnect nur in der Lobby
 * anzeigen, `GameScene` dagegen waehrend des laufenden Runs.
 */
let activeHandlers: DuelChannelHandlers = {};

/** Ersetzt die Handler auf dem bereits verbundenen Kanal, ohne neu zu verbinden. */
export function updateHandlers(handlers: DuelChannelHandlers): void {
  activeHandlers = handlers;
}

/**
 * Abonniert den privaten Broadcast-/Presence-Kanal fuer einen Raum.
 *
 * Topic = der Raum-Code selbst, kein Praefix - siehe
 * `supabase/phase_2_11_duel_rooms.sql` fuer die RLS-Policy, die genau diesen
 * Topic-Namen gegen `duel_rooms.code` prueft. `private: true` aktiviert die
 * RLS-Pruefung ueberhaupt erst; ohne dieses Flag wuerde Supabase den Kanal
 * als oeffentlich behandeln.
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
  localPlayerIndex: 0 | 1,
  handlers: DuelChannelHandlers,
): void {
  unsubscribeFromRoom();
  activeHandlers = handlers;
  activeLocalPlayerIndex = localPlayerIndex;

  const channel = supabase.channel(code, {
    config: { private: true, presence: { key: String(localPlayerIndex) } },
  });

  channel
    .on('broadcast', { event: 'ready' }, () => activeHandlers.onOpponentReady?.())
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
        const playerIndex = payload.playerIndex;
        if (playerIndex !== 0 && playerIndex !== 1) return;
        activeHandlers.onOpponentRoundResult?.(playerIndex, {
          score: Number(payload.score) || 0,
          bestCombo: Number(payload.bestCombo) || 0,
          totalCollected: Number(payload.totalCollected) || 0,
        });
      },
    )
    .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
      // Nur reagieren, wenn der ANDERE Spieler gegangen ist - Presence
      // meldet grundsaetzlich jeden Abgang im Kanal, auch den eigenen beim
      // Neuverbinden.
      if (key !== String(activeLocalPlayerIndex)) activeHandlers.onOpponentDisconnected?.();
    })
    .subscribe((status, error) => {
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
        void channel.track({ online: true });
      }
    });

  activeChannel = channel;
}

/** Sendet ein "ich bin bereit"-Signal an den Kanal. */
export function broadcastReady(): void {
  void activeChannel?.send({ type: 'broadcast', event: 'ready', payload: {} });
}

/** Verteilt die vom Gastgeber gesetzte Startzeit an den Kanal. */
export function broadcastStartTime(startAtMs: number): void {
  void activeChannel?.send({ type: 'broadcast', event: 'start', payload: { startAtMs } });
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
export function broadcastRoundResult(playerIndex: 0 | 1, result: DuelRoundResult): void {
  void activeChannel?.send({
    type: 'broadcast',
    event: 'round-result',
    payload: { playerIndex, ...result },
  });
}

/** Verlaesst den aktuellen Kanal, falls einer aktiv ist - wirft nie. */
export function unsubscribeFromRoom(): void {
  activeHandlers = {};
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
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Zeitüberschreitung')), BACKEND_TIMEOUT_MS);
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
  }
}

/** Gueltigkeit eines Raum-Codes, fuer die Anzeige im UI ("gueltig fuer X Minuten"). */
export function roomCodeTtlMinutes(): number {
  return DUEL_ROOM_CODE_TTL_MINUTES;
}
