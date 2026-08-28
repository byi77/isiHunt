/**
 * Tests fuer NetworkDuelSystem.
 *
 * WICHTIG: `@/config/backend` wird fest auf "nicht konfiguriert" gemockt,
 * exakt aus demselben Grund wie in `CloudSystem.test.ts` - ohne diesen Mock
 * wuerde `getSupabaseClient()` in einer lokalen Umgebung mit echter `.env`
 * gegen die echte Produktionsdatenbank sprechen.
 *
 * Die Unit-Tests pruefen hier die Handler-/Payload-Logik mit einem kleinen
 * Kanal-Doppelgaenger. Der echte RPC-/Realtime-Weg wird separat durch
 * `npm run test:duel2g` mit zwei isolierten Browser-Kontexten getestet - ohne
 * zwei physische Handys, aber mit zwei echten Supabase-Clients.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ONLINE_DUEL_PRESENCE_GRACE_MS } from '@/config/onlineDuel';
import * as DebugSystem from '@/systems/DebugSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';

vi.mock('@/config/backend', () => ({
  BACKEND_URL: '',
  BACKEND_ANON_KEY: '',
  isBackendConfigured: false,
  LEADERBOARD_LIMIT: 10,
  PLAYER_NAME_MAX_LENGTH: 16,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  BACKEND_TIMEOUT_MS: 5000,
}));

describe('normalizeRoomCode', () => {
  it('schreibt gross und entfernt Leerzeichen', () => {
    expect(NetworkDuelSystem.normalizeRoomCode(' ab3d ef ')).toBe('AB3DEF');
  });

  it('bildet verwechselbare Zeichen auf ihre Zwillinge ab', () => {
    // Deckungsgleich mit dem Sync-Code-Alphabet: O->0, I/L->1.
    expect(NetworkDuelSystem.normalizeRoomCode('OIL123')).toBe('011123');
  });

  it('kappt auf die Duell-Code-Laenge', () => {
    expect(NetworkDuelSystem.normalizeRoomCode('ABCDEFGH')).toBe('ABCDEF');
  });
});

describe('roomCodeTtlMinutes', () => {
  it('liefert die konfigurierte Gueltigkeitsdauer', () => {
    expect(NetworkDuelSystem.roomCodeTtlMinutes()).toBeGreaterThan(0);
  });
});

describe('Netzfunktionen ohne konfigurierten Online-Dienst', () => {
  it('createRoom scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.createRoom('silberhain');
    expect(result.ok).toBe(false);
  });

  it('joinRoom scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.joinRoom('ABC123');
    expect(result.ok).toBe(false);
  });

  it('joinRoom lehnt zu kurze Codes ab, ohne den Online-Dienst zu pruefen', async () => {
    const result = await NetworkDuelSystem.joinRoom('AB');
    expect(result.ok).toBe(false);
  });

  it('markReady scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.markReady('ABC123', true);
    expect(result.ok).toBe(false);
  });

  it('setStartTime scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.setStartTime('ABC123');
    expect(result.ok).toBe(false);
  });

  it('getRoomStatus scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.getRoomStatus('ABC123');
    expect(result.ok).toBe(false);
  });

  it('measureClockOffset scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.measureClockOffset();
    expect(result.ok).toBe(false);
  });
});

describe('unsubscribeFromRoom', () => {
  it('tut ohne aktiven Kanal nichts, statt zu werfen', () => {
    expect(() => NetworkDuelSystem.unsubscribeFromRoom()).not.toThrow();
  });
});

describe('broadcastReady/broadcastStartTime ohne aktiven Kanal', () => {
  it('werfen nicht, wenn noch kein Kanal abonniert wurde', () => {
    expect(() => NetworkDuelSystem.broadcastReady()).not.toThrow();
    expect(() => NetworkDuelSystem.broadcastStartTime(Date.now())).not.toThrow();
  });
});

/**
 * Minimaler Kanal-Doppelgaenger.
 *
 * `subscribeToRoom()` nimmt den Supabase-Client als Parameter (statt ihn
 * selbst zu holen), genau deshalb laesst sich die Handler-Verwaltung ohne
 * echtes Realtime pruefen: der Doppelgaenger merkt sich die registrierten
 * `.on(...)`-Rueckrufe und ruft sie auf Kommando auf.
 */
function createFakeSupabase(): {
  client: unknown;
  fire: (event: string, payload: unknown) => void;
  firePresence: (event: 'join' | 'leave', key: string) => void;
  fireSync: (anwesend: Record<string, unknown>) => void;
  channelConfig: () => unknown;
  trackPayload: () => unknown;
} {
  const broadcastHandlers = new Map<string, (message: unknown) => void>();
  const presenceHandlers = new Map<string, (message: unknown) => void>();

  // Explizit typisiert, weil `on`/`subscribe` den Kanal selbst
  // zurueckgeben - ohne Annotation kann TypeScript den Typ nicht aus seiner
  // eigenen Initialisierung ableiten (TS7022).
  interface FakeChannel {
    on(type: string, filter: { event: string }, handler: (message: unknown) => void): FakeChannel;
    subscribe(callback?: (status: string, error?: Error) => void): FakeChannel;
    track(payload?: unknown): Promise<string>;
    send(): Promise<string>;
    unsubscribe(): Promise<string>;
    presenceState(): Record<string, unknown>;
  }

  // Wer laut Presence gerade im Kanal ist - vom Test steuerbar, damit sich
  // "Gegner sichtbar" und "niemand da" unterscheiden lassen.
  let presence: Record<string, unknown> = {};
  // Die beim Erzeugen uebergebene Kanalkonfiguration - `ack` ist die
  // Voraussetzung dafuer, dass Ablehnungen ueberhaupt sichtbar werden.
  let lastChannelConfig: unknown;
  let lastTrackPayload: unknown;

  const channel: FakeChannel = {
    on(type, filter, handler) {
      if (type === 'broadcast') broadcastHandlers.set(filter.event, handler);
      if (type === 'presence') presenceHandlers.set(filter.event, handler);
      return channel;
    },
    subscribe(callback) {
      // Den Statuslauf nachstellen: erst nach SUBSCRIBED ruft der echte
      // Kanal `track()` auf, und genau das soll pruefbar sein.
      callback?.('SUBSCRIBED');
      return channel;
    },
    track: (payload?: unknown) => {
      lastTrackPayload = payload;
      return Promise.resolve('ok');
    },
    presenceState: () => presence,
    send: () => Promise.resolve('ok'),
    unsubscribe: () => Promise.resolve('ok'),
  };

  return {
    client: {
      channel: (_topic: string, config?: unknown) => {
        lastChannelConfig = config;
        return channel;
      },
    },
    fire: (event, payload) => broadcastHandlers.get(event)?.({ payload }),
    firePresence: (event, key) => presenceHandlers.get(event)?.({ key }),
    fireSync: (anwesend: Record<string, unknown>) => {
      presence = anwesend;
      presenceHandlers.get('sync')?.({});
    },
    channelConfig: () => lastChannelConfig,
    trackPayload: () => lastTrackPayload,
  };
}

describe('updateHandlers', () => {
  beforeEach(() => {
    NetworkDuelSystem.unsubscribeFromRoom();
  });

  /**
   * Der Kern des Fehlers aus Testbericht v0.1.236: `GameScene` legte per
   * `updateHandlers()` nur `onOpponentDisconnected` nach und meldete damit
   * still alles ab, was die Lobby registriert hatte. Weil ein fehlender
   * optionaler Handler kein Typfehler ist, verschwand das lautlos.
   */
  it('behaelt Handler, die der neue Aufruf nicht nennt', () => {
    const fake = createFakeSupabase();
    const onOpponentReady = vi.fn();

    NetworkDuelSystem.subscribeToRoom(
      fake.client as Parameters<typeof NetworkDuelSystem.subscribeToRoom>[0],
      'ABC123',
      0,
      { onOpponentReady },
    );

    NetworkDuelSystem.updateHandlers({ onOpponentDisconnected: vi.fn() });
    fake.fire('ready', {});

    expect(onOpponentReady).toHaveBeenCalledTimes(1);
  });

  it('ersetzt einen Handler, den der neue Aufruf ausdruecklich nennt', () => {
    const fake = createFakeSupabase();
    const first = vi.fn();
    const second = vi.fn();

    NetworkDuelSystem.subscribeToRoom(
      fake.client as Parameters<typeof NetworkDuelSystem.subscribeToRoom>[0],
      'ABC123',
      0,
      { onOpponentReady: first },
    );

    NetworkDuelSystem.updateHandlers({ onOpponentReady: second });
    fake.fire('ready', {});

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  /**
   * Der zweite Teil desselben Fehlers: dieser Handler war deklariert und
   * wurde beim Eintreffen auch aufgerufen - nur hatte ihn nie jemand
   * gesetzt, sodass `?.` jedes Ergebnis schluckte.
   */
  it('reicht ein eingetroffenes Rundenergebnis an den Handler weiter', () => {
    const fake = createFakeSupabase();
    const onOpponentRoundResult = vi.fn();

    NetworkDuelSystem.subscribeToRoom(
      fake.client as Parameters<typeof NetworkDuelSystem.subscribeToRoom>[0],
      'ABC123',
      0,
      {},
    );

    NetworkDuelSystem.updateHandlers({ onOpponentRoundResult });
    fake.fire('round-result', {
      playerIndex: 1,
      score: 1485,
      bestCombo: 5,
      totalCollected: 120,
    });

    expect(onOpponentRoundResult).toHaveBeenCalledWith(1, {
      score: 1485,
      bestCombo: 5,
      totalCollected: 120,
    });
  });

  it('ignoriert ein Ergebnis mit unbrauchbarem Spielerindex', () => {
    const fake = createFakeSupabase();
    const onOpponentRoundResult = vi.fn();

    NetworkDuelSystem.subscribeToRoom(
      fake.client as Parameters<typeof NetworkDuelSystem.subscribeToRoom>[0],
      'ABC123',
      0,
      { onOpponentRoundResult },
    );

    fake.fire('round-result', { playerIndex: 7, score: 10 });

    expect(onOpponentRoundResult).not.toHaveBeenCalled();
  });

  it('meldet nach unsubscribeFromRoom alle Handler ab', () => {
    const fake = createFakeSupabase();
    const onOpponentReady = vi.fn();

    NetworkDuelSystem.subscribeToRoom(
      fake.client as Parameters<typeof NetworkDuelSystem.subscribeToRoom>[0],
      'ABC123',
      0,
      { onOpponentReady },
    );

    NetworkDuelSystem.unsubscribeFromRoom();
    fake.fire('ready', {});

    expect(onOpponentReady).not.toHaveBeenCalled();
  });
});

describe('submitRoundResult ohne konfigurierten Online-Dienst', () => {
  it('scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.submitRoundResult('ABC123', true, {
      score: 100,
      bestCombo: 3,
      totalCollected: 20,
    });
    expect(result.ok).toBe(false);
  });
});

describe('Live-Stand ueber den Kanal', () => {
  beforeEach(() => {
    NetworkDuelSystem.unsubscribeFromRoom();
  });

  function subscribeAs(
    localIndex: 0 | 1,
    handlers: Parameters<typeof NetworkDuelSystem.subscribeToRoom>[3],
  ) {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(
      fake.client as Parameters<typeof NetworkDuelSystem.subscribeToRoom>[0],
      'ABC123',
      localIndex,
      handlers,
    );
    return fake;
  }

  it('reicht den Stand des Gegners weiter', () => {
    const onOpponentLiveState = vi.fn();
    const fake = subscribeAs(0, { onOpponentLiveState });

    fake.fire('live', { playerIndex: 1, score: 1402, activity: 'playing' });

    expect(onOpponentLiveState).toHaveBeenCalledWith({ score: 1402, activity: 'playing' });
  });

  /**
   * Der eigene Broadcast kommt auf demselben Kanal zurueck. Ohne die
   * Index-Pruefung wuerde das Geraet den eigenen Stand als den des Gegners
   * anzeigen - beide saehen dann immer ein Unentschieden.
   */
  it('ignoriert den eigenen zurueckkommenden Stand', () => {
    const onOpponentLiveState = vi.fn();
    const fake = subscribeAs(0, { onOpponentLiveState });

    fake.fire('live', { playerIndex: 0, score: 999, activity: 'playing' });

    expect(onOpponentLiveState).not.toHaveBeenCalled();
  });

  it('nimmt alle vier gemeldeten Zustaende an', () => {
    const onOpponentLiveState = vi.fn();
    const fake = subscribeAs(1, { onOpponentLiveState });

    for (const activity of ['playing', 'away', 'left', 'finished']) {
      fake.fire('live', { playerIndex: 0, score: 10, activity });
    }

    expect(onOpponentLiveState).toHaveBeenCalledTimes(4);
  });

  it('verwirft eine Meldung mit unbekanntem Zustand', () => {
    const onOpponentLiveState = vi.fn();
    const fake = subscribeAs(0, { onOpponentLiveState });

    // 'gone' entsteht nur lokal aus dem Verstummen und darf nicht ueber den
    // Kanal kommen - wer weg ist, kann das nicht selbst melden.
    fake.fire('live', { playerIndex: 1, score: 10, activity: 'gone' });
    fake.fire('live', { playerIndex: 1, score: 10, activity: 'irgendwas' });

    expect(onOpponentLiveState).not.toHaveBeenCalled();
  });

  it('verwirft eine Meldung ohne brauchbare Punktzahl', () => {
    const onOpponentLiveState = vi.fn();
    const fake = subscribeAs(0, { onOpponentLiveState });

    fake.fire('live', { playerIndex: 1, score: 'viele', activity: 'playing' });

    expect(onOpponentLiveState).not.toHaveBeenCalled();
  });

  it('broadcastLiveState wirft ohne aktiven Kanal nicht', () => {
    NetworkDuelSystem.unsubscribeFromRoom();
    expect(() =>
      NetworkDuelSystem.broadcastLiveState(0, { score: 10, activity: 'playing' }),
    ).not.toThrow();
  });
});

/**
 * Der Sendepfad war bis v0.1.249 vollstaendig blind: `void
 * activeChannel?.send(...)` verwarf sowohl den fehlenden Kanal (`?.`) als auch
 * die Antwort (`void`). Als im Zwei-Geraete-Test kein einziger Zwischenstand
 * ankam, liess sich deshalb nicht entscheiden, ob gesendet oder nur nicht
 * empfangen wurde. Diese Tests halten fest, dass beide Faelle jetzt eine Spur
 * im Ringpuffer hinterlassen - die Grundlage jeder weiteren Ferndiagnose.
 */
describe('Sendepfad hinterlaesst eine Spur', () => {
  beforeEach(() => {
    NetworkDuelSystem.unsubscribeFromRoom();
    DebugSystem.clearLogBuffer();
  });

  it('meldet einen fehlenden Kanal, statt still nichts zu tun', () => {
    NetworkDuelSystem.broadcastLiveState(0, { score: 10, activity: 'playing' });

    const entry = DebugSystem.getProtectedLogBuffer().find(
      (item) => item.label === 'duel:send/live',
    );
    expect(entry?.detail).toContain('kein aktiver Kanal');
  });

  it('schweigt, solange der Kanal die Nachricht annimmt', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});
    DebugSystem.clearLogBuffer();

    NetworkDuelSystem.broadcastLiveState(0, { score: 10, activity: 'playing' });

    // Kein Eintrag im Erfolgsfall: der `live`-Takt feuert alle 400ms und
    // wuerde den Ringpuffer sonst in gut zwei Minuten ueberschreiben.
    expect(
      DebugSystem.getProtectedLogBuffer().filter((item) => item.label === 'duel:send/live'),
    ).toEqual([]);
  });

  it('meldet einen angekommenen Stand ohne registrierten Empfaenger', () => {
    // Genau die Falle, die beim Rundenergebnis schon einmal zuschlug
    // (v0.1.236): der Handler war deklariert, aber keine Scene hatte ihn
    // gesetzt - `?.` schluckte jede Meldung lautlos.
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    fake.fire('live', { playerIndex: 1, score: 42, activity: 'playing' });

    const entry = DebugSystem.getProtectedLogBuffer().find(
      (item) => item.label === 'duel:live-verworfen',
    );
    expect(entry?.detail).toContain('kein Empfaenger registriert');
  });

  it('meldet jeden Verwurfsgrund nur einmal', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    for (let i = 0; i < 5; i++) {
      fake.fire('live', { playerIndex: 1, score: 42, activity: 'playing' });
    }

    const entries = DebugSystem.getProtectedLogBuffer().filter(
      (item) => item.label === 'duel:live-verworfen',
    );
    expect(entries).toHaveLength(1);
  });
});

/**
 * Der Kern des Fixes vom 2026-08-25: ein Presence-`leave` ist beim
 * Szenenwechsel Lobby -> GameScene der Normalfall, kein Abbruch. Der Bericht
 * zeigte die Folge der fehlenden Karenz unmissverstaendlich - 5 ms nach
 * `run:started` stand "Verbindung weg", und der Gegnerstand blieb die ganze
 * Runde bei 0.
 */
describe('Presence mit Karenzfrist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    NetworkDuelSystem.unsubscribeFromRoom();
    DebugSystem.clearLogBuffer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('meldet keine Trennung, wenn der Gegner sofort zurueckkehrt', () => {
    const onOpponentDisconnected = vi.fn();
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {
      onOpponentDisconnected,
    });

    // Genau der Ablauf beim Szenenwechsel: leave, wenige Millisekunden
    // spaeter join desselben Schluessels.
    fake.firePresence('leave', '1');
    vi.advanceTimersByTime(5);
    fake.firePresence('join', '1');

    vi.advanceTimersByTime(ONLINE_DUEL_PRESENCE_GRACE_MS * 2);

    expect(onOpponentDisconnected).not.toHaveBeenCalled();
  });

  it('meldet die Trennung, wenn der Gegner wegbleibt', () => {
    const onOpponentDisconnected = vi.fn();
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {
      onOpponentDisconnected,
    });

    fake.firePresence('leave', '1');

    // Vor Ablauf der Frist noch nichts - sonst waere die Karenz wirkungslos.
    vi.advanceTimersByTime(ONLINE_DUEL_PRESENCE_GRACE_MS - 1);
    expect(onOpponentDisconnected).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(onOpponentDisconnected).toHaveBeenCalledTimes(1);
  });

  it('ignoriert das eigene leave', () => {
    const onOpponentDisconnected = vi.fn();
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {
      onOpponentDisconnected,
    });

    fake.firePresence('leave', '0');
    vi.advanceTimersByTime(ONLINE_DUEL_PRESENCE_GRACE_MS * 2);

    expect(onOpponentDisconnected).not.toHaveBeenCalled();
  });

  it('laesst keine Frist in einen neuen Kanal hineinlaufen', () => {
    const onOpponentDisconnected = vi.fn();
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {
      onOpponentDisconnected,
    });

    fake.firePresence('leave', '1');
    // Neuer Kanal, bevor die Frist ablaeuft - die alte Frist darf im neuen
    // Kanal keine Trennung melden, die es dort nie gab.
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'DEF456', 0, {
      onOpponentDisconnected,
    });

    vi.advanceTimersByTime(ONLINE_DUEL_PRESENCE_GRACE_MS * 2);

    expect(onOpponentDisconnected).not.toHaveBeenCalled();
  });

  it('protokolliert leave und join im geschuetzten Puffer', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    fake.firePresence('leave', '1');
    fake.firePresence('join', '1');

    const labels = DebugSystem.getProtectedLogBuffer().map((entry) => entry.label);
    expect(labels).toContain('duel:presence-leave');
    expect(labels).toContain('duel:presence-join');
  });
});

/**
 * Die drei Messungen aus v0.1.254. Sie beantworten die Frage, die nach dem
 * Presence-Fix offen blieb: der Bericht vom 2026-08-28 zeigte einen stehenden
 * Kanal (SUBSCRIBED nach `transport failure`), aber ueber die ganze Runde
 * kein einziges Presence-Ereignis und keinen Zwischenstand. Ob sich das
 * Geraet ueberhaupt wieder als anwesend meldete und ob der Gegner im Kanal
 * sichtbar war, liess sich nicht feststellen.
 */
describe('Presence- und Empfangsdiagnose', () => {
  beforeEach(() => {
    NetworkDuelSystem.unsubscribeFromRoom();
    DebugSystem.clearLogBuffer();
  });

  it('protokolliert das Ergebnis der eigenen Presence-Anmeldung', async () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    // `track()` liefert ein Promise - eine Mikrotask-Runde abwarten.
    await Promise.resolve();
    await Promise.resolve();

    const entry = DebugSystem.getProtectedLogBuffer().find(
      (item) => item.label === 'duel:presence-track',
    );
    expect(entry?.detail).toBe('ok');
  });

  it('meldet, wer laut Presence im Kanal ist', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    fake.fireSync({ '0': [], '1': [] });

    const entry = DebugSystem.getProtectedLogBuffer().find(
      (item) => item.label === 'duel:presence-sync',
    );
    expect(entry?.detail).toBe('anwesend: 0,1');
  });

  it('uebertraegt und liest die Spielernamen aus Presence', () => {
    const fake = createFakeSupabase();
    const onPresenceSync = vi.fn();
    NetworkDuelSystem.subscribeToRoom(
      fake.client as never,
      'ABC123',
      0,
      { onPresenceSync },
      'Alice',
    );

    fake.fireSync({
      '0': [{ playerName: 'Alice' }],
      '1': [{ playerName: 'Bob' }],
    });

    expect(fake.trackPayload()).toEqual({ online: true, playerName: 'Alice' });
    expect(onPresenceSync).toHaveBeenCalledWith(['Alice', 'Bob']);
  });

  it('unterscheidet einen leeren Kanal von einem besetzten', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    // Genau der Verdachtsfall: der Kanal steht, aber niemand ist angemeldet.
    fake.fireSync({});

    const entry = DebugSystem.getProtectedLogBuffer().find(
      (item) => item.label === 'duel:presence-sync',
    );
    expect(entry?.detail).toBe('niemand anwesend');
  });

  it('meldet denselben Presence-Stand nicht mehrfach', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    // `sync` feuert bei jedem Presence-Wechsel - ohne Vergleich stuende
    // derselbe Stand vielfach im Puffer.
    fake.fireSync({ '0': [], '1': [] });
    fake.fireSync({ '0': [], '1': [] });
    fake.fireSync({ '0': [], '1': [] });

    const entries = DebugSystem.getProtectedLogBuffer().filter(
      (item) => item.label === 'duel:presence-sync',
    );
    expect(entries).toHaveLength(1);
  });

  it('belegt einmalig, dass ein Stand des Gegners ankam', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {
      onOpponentLiveState: () => {},
    });

    fake.fire('live', { playerIndex: 1, score: 42, activity: 'playing' });
    fake.fire('live', { playerIndex: 1, score: 99, activity: 'playing' });

    const entries = DebugSystem.getProtectedLogBuffer().filter(
      (item) => item.label === 'duel:live-empfangen',
    );
    // Einmal, nicht im 400ms-Takt: der Beleg lautet "es kam etwas an", nicht
    // "wie viel".
    expect(entries).toHaveLength(1);
    expect(entries[0]?.detail).toContain('42');
  });

  it('schweigt, solange kein Stand des Gegners ankommt', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {
      onOpponentLiveState: () => {},
    });

    // Nur der eigene Stand kommt zurueck - das ist kein Empfang vom Gegner.
    fake.fire('live', { playerIndex: 0, score: 42, activity: 'playing' });

    expect(
      DebugSystem.getProtectedLogBuffer().filter((item) => item.label === 'duel:live-empfangen'),
    ).toEqual([]);
  });
});

/**
 * Die Kanalkonfiguration traegt drei Entscheidungen, die je einmal am Geraet
 * als falsch nachgewiesen wurden. Der Test haelt sie fest, damit keine davon
 * unbemerkt zurueckfaellt.
 */
describe('Kanalkonfiguration', () => {
  beforeEach(() => {
    NetworkDuelSystem.unsubscribeFromRoom();
  });

  it('wartet NICHT auf eine Zustellbestaetigung', () => {
    // `broadcast.ack` war in v0.1.255 kurz gesetzt, um stille
    // RLS-Ablehnungen sichtbar zu machen. Es hat seinen Zweck erfuellt (die
    // fehlende INSERT-Policy wurde gefunden), aendert aber das
    // Laufzeitverhalten: `send()` wartet dann auf den Server. Im
    // Lobby-Ablauf, der zum Rundenstart fuehren muss, brach die Kette
    // daraufhin ab - das Duell kam nicht mehr zustande (2026-08-28).
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    const config = fake.channelConfig() as { config?: { broadcast?: { ack?: boolean } } };
    expect(config.config?.broadcast?.ack).not.toBe(true);
  });

  it('bleibt ein privater Kanal mit eigenem Presence-Schluessel je Spieler', () => {
    // Beide Werte sind sicherheits- bzw. diagnoserelevant und wurden je
    // einmal am Geraet als fehlend nachgewiesen (2026-08-18): ohne `private`
    // greift die RLS-Pruefung nicht, mit gleichem Presence-Key fuer beide
    // Spieler laesst sich "wer ist weg" nicht mehr unterscheiden.
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 1, {});

    const config = fake.channelConfig() as {
      config?: { private?: boolean; presence?: { key?: string } };
    };
    expect(config.config?.private).toBe(true);
    expect(config.config?.presence?.key).toBe('1');
  });
});
