/**
 * Tests fuer NetworkDuelSystem.
 *
 * WICHTIG: `@/config/backend` wird fest auf "nicht konfiguriert" gemockt,
 * exakt aus demselben Grund wie in `CloudSystem.test.ts` - ohne diesen Mock
 * wuerde `getSupabaseClient()` in einer lokalen Umgebung mit echter `.env`
 * gegen die echte Produktionsdatenbank sprechen.
 *
 * Getestet wird hier bewusst nur, was ohne echten Realtime-/RPC-Zugriff
 * pruefbar ist: reine Funktionen (Code-Normalisierung) und der "kein
 * Online-Dienst eingerichtet"-Fruehausstieg, den jede Netzfunktion hat, wenn
 * `getSupabaseClient()` `null` liefert. Echtes RPC-/Realtime-Verhalten
 * braucht einen echten Zwei-Geraete-Test (siehe TODO.md-Planungsnotiz).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as DebugSystem from '@/systems/DebugSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';

vi.mock('@/config/backend', () => ({
  BACKEND_URL: '',
  BACKEND_ANON_KEY: '',
  isBackendConfigured: false,
  LEADERBOARD_LIMIT: 10,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  PLAYER_NAME_MAX_LENGTH: 12,
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
} {
  const broadcastHandlers = new Map<string, (message: unknown) => void>();

  // Explizit typisiert, weil `on`/`subscribe` den Kanal selbst
  // zurueckgeben - ohne Annotation kann TypeScript den Typ nicht aus seiner
  // eigenen Initialisierung ableiten (TS7022).
  interface FakeChannel {
    on(type: string, filter: { event: string }, handler: (message: unknown) => void): FakeChannel;
    subscribe(): FakeChannel;
    track(): Promise<string>;
    send(): Promise<string>;
    unsubscribe(): Promise<string>;
  }

  const channel: FakeChannel = {
    on(type, filter, handler) {
      if (type === 'broadcast') broadcastHandlers.set(filter.event, handler);
      return channel;
    },
    subscribe() {
      return channel;
    },
    track: () => Promise.resolve('ok'),
    send: () => Promise.resolve('ok'),
    unsubscribe: () => Promise.resolve('ok'),
  };

  return {
    client: { channel: () => channel },
    fire: (event, payload) => broadcastHandlers.get(event)?.({ payload }),
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

    const entry = DebugSystem.getLogBuffer().find((item) => item.label === 'duel:send/live');
    expect(entry?.detail).toContain('kein aktiver Kanal');
  });

  it('schweigt, solange der Kanal die Nachricht annimmt', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});
    DebugSystem.clearLogBuffer();

    NetworkDuelSystem.broadcastLiveState(0, { score: 10, activity: 'playing' });

    // Kein Eintrag im Erfolgsfall: der `live`-Takt feuert alle 400ms und
    // wuerde den Ringpuffer sonst in gut zwei Minuten ueberschreiben.
    expect(DebugSystem.getLogBuffer().filter((item) => item.label === 'duel:send/live')).toEqual(
      [],
    );
  });

  it('meldet einen angekommenen Stand ohne registrierten Empfaenger', () => {
    // Genau die Falle, die beim Rundenergebnis schon einmal zuschlug
    // (v0.1.236): der Handler war deklariert, aber keine Scene hatte ihn
    // gesetzt - `?.` schluckte jede Meldung lautlos.
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    fake.fire('live', { playerIndex: 1, score: 42, activity: 'playing' });

    const entry = DebugSystem.getLogBuffer().find((item) => item.label === 'duel:live-verworfen');
    expect(entry?.detail).toContain('kein Empfaenger registriert');
  });

  it('meldet jeden Verwurfsgrund nur einmal', () => {
    const fake = createFakeSupabase();
    NetworkDuelSystem.subscribeToRoom(fake.client as never, 'ABC123', 0, {});

    for (let i = 0; i < 5; i++) {
      fake.fire('live', { playerIndex: 1, score: 42, activity: 'playing' });
    }

    const entries = DebugSystem.getLogBuffer().filter(
      (item) => item.label === 'duel:live-verworfen',
    );
    expect(entries).toHaveLength(1);
  });
});
