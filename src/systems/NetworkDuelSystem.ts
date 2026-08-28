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
import {
  DUEL_ROOM_CODE_TTL_MINUTES,
  ONLINE_DUEL_CLOCK_SYNC_SAMPLES,
  ONLINE_DUEL_PRESENCE_GRACE_MS,
} from '@/config/onlineDuel';
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
  /** `null`, solange der jeweilige Spieler seine Runde nicht abgegeben hat. */
  hostResult: DuelRoundResult | null;
  guestResult: DuelRoundResult | null;
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
      hostResult: parseRoundResult(row.host_result),
      guestResult: parseRoundResult(row.guest_result),
    },
  };
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
export async function submitRoundResult(
  code: string,
  isHost: boolean,
  result: DuelRoundResult,
): Promise<CloudResult<true>> {
  const supabase = CloudSystem.getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const response = await withTimeout(
    supabase.rpc('submit_duel_result', {
      p_code: code,
      p_is_host: isHost,
      p_result: result,
    }),
    'Ergebnis abgeben',
  );
  if (!response.ok) return response;
  if (response.value.error) return { ok: false, error: response.value.error.message };
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

export interface DuelChannelHandlers {
  onOpponentReady?: () => void;
  onStartTimeSet?: (startAtMs: number) => void;
  /** Feuert, wenn der jeweils ANDERE Spieler den Kanal verlaesst. */
  onOpponentDisconnected?: () => void;
  onChannelError?: (reason: string) => void;
  onOpponentRoundResult?: (playerIndex: 0 | 1, result: DuelRoundResult) => void;
  /** Laufender Zwischenstand des Gegners waehrend des Runs. */
  onOpponentLiveState?: (state: DuelLiveState) => void;
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
        if (payload.playerIndex === activeLocalPlayerIndex) return;

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

        activeHandlers.onOpponentLiveState({ score, activity: payload.activity });
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
      const keys = Object.keys(channel.presenceState()).sort().join(',');
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
          .track({ online: true })
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
export function broadcastRoundResult(playerIndex: 0 | 1, result: DuelRoundResult): void {
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
export function broadcastLiveState(playerIndex: 0 | 1, state: DuelLiveState): void {
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
      activeHandlers.onOpponentDisconnected?.();
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
