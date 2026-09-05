/**
 * Tests fuer die Offline-Outbox eines angemeldeten Profils.
 *
 * docs/AUDIT_2026-08-17.md Abschnitt 5.4: beide Guards
 * (enqueueRun/flushPending) waren komplett ungetestet - AuthSystem.isSignedIn
 * haengt an einem echten Supabase-Session-Flow, deshalb wird das Modul hier
 * gemockt. CloudSystem wird ebenfalls gemockt, damit kein Test gegen ein
 * echtes Backend spricht (siehe CloudSystem.test.ts fuer denselben Grund).
 *
 * `SaveSystem` haelt einen Modul-Cache - vor jedem Test wird neu geladen
 * (siehe ProgressionSystem.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOT_VICTORY_MAX_FAILED_ATTEMPTS } from '@/config/backend';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type * as ProgressSyncSystemModule from '@/systems/ProgressSyncSystem';
import type * as SaveSystemModule from '@/systems/SaveSystem';
import type { ProgressEvent, ProgressionResult, RunStats } from '@/types';

let signedIn = false;
let signedInUserId: string | null = 'user-1';

vi.mock('@/systems/AuthSystem', () => ({
  isSignedIn: () => signedIn,
  currentUserId: () => (signedIn ? signedInUserId : null),
}));

const submitProgressEvent = vi.fn();
const claimDailyBonus = vi.fn();
const claimBotVictoryBonus = vi.fn();

vi.mock('@/systems/CloudSystem', () => ({
  submitProgressEvent: (...args: unknown[]) => submitProgressEvent(...args),
  claimDailyBonus: (...args: unknown[]) => claimDailyBonus(...args),
  claimBotVictoryBonus: (...args: unknown[]) => claimBotVictoryBonus(...args),
}));

let SaveSystem: typeof SaveSystemModule;
let ProgressSyncSystem: typeof ProgressSyncSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  signedIn = false;
  signedInUserId = 'user-1';
  submitProgressEvent.mockReset();
  claimDailyBonus.mockReset();
  claimBotVictoryBonus.mockReset();

  // Feste Zeit: Der Tagesbonus verfaellt jetzt, wenn sein Schluessel mehr als
  // einen Tag vom heutigen abweicht (`DAILY_KEY_TOLERANCE_MS`). Ohne diese
  // Fixierung wuerden die Tests mit den fest eingetragenen Datums-Strings am
  // naechsten Tag von selbst rot - sie pruefen dann etwas anderes als gemeint.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));

  vi.resetModules();
  SaveSystem = await import('@/systems/SaveSystem');
  ProgressSyncSystem = await import('@/systems/ProgressSyncSystem');
});

afterEach(() => {
  ProgressSyncSystem.cancelRetry();
  vi.useRealTimers();
  // Ohne das vergiftet ein Storage-Spy aus einem fehlgeschlagenen Test alle
  // folgenden - die Ursache sieht dann wie ein echter Regressionsfehler aus.
  vi.restoreAllMocks();
});

function createRun(overrides: Partial<RunStats> = {}): RunStats {
  return {
    worldId: DEFAULT_WORLD_ID,
    score: 100,
    bestCombo: 5,
    bestMultiplier: 1,
    collected: emptyRarityCounts(),
    totalCollected: 10,
    missed: 0,
    xpGained: 50,
    ...overrides,
  };
}

/**
 * Liest die Outbox direkt aus dem localStorage.
 *
 * `pendingCount()` liefert nur die Anzahl - fuer die Reihenfolge nach einem
 * Teilfehlschlag braucht es die Ereignisse selbst.
 */
function readOutbox(accountId = signedInUserId): ProgressEvent[] {
  const eventPrefix = `isihunt.progress-events.v2.${accountId}.event.`;
  const events: Array<{ event: ProgressEvent; queuedAt: number }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(eventPrefix)) continue;
    const raw = JSON.parse(window.localStorage.getItem(key)!);
    events.push(raw);
  }
  if (events.length > 0) {
    return events.sort((left, right) => left.queuedAt - right.queuedAt).map((entry) => entry.event);
  }
  const legacy = window.localStorage.getItem(`isihunt.progress-events.v2.${accountId}`);
  return legacy ? (JSON.parse(legacy) as ProgressEvent[]) : [];
}

function createProgression(overrides: Partial<ProgressionResult> = {}): ProgressionResult {
  return {
    levelsGained: 0,
    newLevel: 1,
    talentPointsGained: 0,
    coinsGained: 20,
    unlockedWorldIds: [],
    unlockedAchievementIds: [],
    isNewBestScore: false,
    ...overrides,
  };
}

describe('enqueueRun', () => {
  it('legt ohne Anmeldung kein Ereignis an', () => {
    signedIn = false;

    const eventId = ProgressSyncSystem.enqueueRun(createRun(), createProgression());

    expect(eventId).toBeNull();
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
  });

  it('legt bei aktivem Testprofil kein Ereignis an, selbst wenn angemeldet', () => {
    signedIn = true;
    SaveSystem.enableTestProfile();

    const eventId = ProgressSyncSystem.enqueueRun(createRun(), createProgression());

    expect(eventId).toBeNull();
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
  });

  it('legt bei Anmeldung ohne Testprofil ein Ereignis an', () => {
    signedIn = true;

    const eventId = ProgressSyncSystem.enqueueRun(createRun(), createProgression());

    expect(eventId).not.toBeNull();
    expect(readOutbox()).toHaveLength(1);
  });
});

describe('flushPending (ueber flush())', () => {
  it('tut nichts ohne Anmeldung, auch mit wartenden Ereignissen', async () => {
    signedIn = true;
    ProgressSyncSystem.enqueueRun(createRun(), createProgression());
    signedIn = false;

    await ProgressSyncSystem.flush();

    expect(submitProgressEvent).not.toHaveBeenCalled();
    // Das Ereignis bleibt in der Outbox stehen statt verworfen zu werden.
    expect(readOutbox()).toHaveLength(1);
  });

  it('holt den Tagesbonus nicht ab, solange Laufereignisse noch ausstehen', async () => {
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-17';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 50;
      data.pendingDailyScore = 300;
    });
    ProgressSyncSystem.enqueueRun(createRun(), createProgression());
    submitProgressEvent.mockResolvedValue({ ok: false, error: 'Netzwerkfehler' });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).not.toHaveBeenCalled();
    expect(readOutbox()).toHaveLength(1);
  });

  it('holt den Tagesbonus ab, sobald die Outbox leer ist', async () => {
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-17';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 50;
      data.pendingDailyScore = 300;
    });
    claimDailyBonus.mockResolvedValue({
      ok: true,
      value: { data: SaveSystem.load() },
    });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).toHaveBeenCalledWith('2026-08-17', 'event-1');
    const data = SaveSystem.load();
    expect(data.pendingDailyKey).toBeNull();
    expect(data.pendingDailyEventId).toBeNull();
    expect(data.pendingDailyCoins).toBe(0);
  });

  it('ruehrt den Tagesbonus-Merker nicht an, wenn pendingDailyCoins 0 ist', async () => {
    // docs/AUDIT_2026-08-17.md Abschnitt 5.4: dieser Guard darf nicht
    // faelschlich greifen, wenn tatsaechlich noch ein Claim aussteht - hier
    // wird der Normalfall geprueft, dass ohne echten Pending-Bonus (Coins 0)
    // gar nicht erst versucht wird, ihn abzuholen.
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-17';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 0;
      data.pendingDailyScore = 0;
    });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).not.toHaveBeenCalled();
  });

  it('laesst pendingDaily-Felder unveraendert, wenn der Claim fehlschlaegt', async () => {
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-17';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 50;
      data.pendingDailyScore = 300;
    });
    claimDailyBonus.mockResolvedValue({ ok: false, error: 'Serverfehler' });

    await ProgressSyncSystem.flush();

    const data = SaveSystem.load();
    expect(data.pendingDailyKey).toBe('2026-08-17');
    expect(data.pendingDailyCoins).toBe(50);
  });

  it('holt einen Tagesbonus vom Vortag noch ab', async () => {
    // Ein Offline-Lauf von gestern, der erst heute hochgeladen wird, ist
    // legitim - er darf nicht am Fenster scheitern.
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-16';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 50;
      data.pendingDailyScore = 300;
    });
    claimDailyBonus.mockResolvedValue({ ok: true, value: { data: SaveSystem.load() } });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).toHaveBeenCalledWith('2026-08-16', 'event-1');
  });

  it('verwirft einen zu alten Tagesbonus, statt ihn ewig zu wiederholen', async () => {
    // Der Server lehnt einen Schluessel ausserhalb des Fensters dauerhaft ab
    // (`daily_key_is_plausible()`). Ohne lokalen Verfall bliebe er fuer immer
    // in `pendingDailyKey` stehen und loeste bei jedem Abgleich einen
    // aussichtslosen Aufruf aus.
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-01';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 50;
      data.pendingDailyScore = 300;
    });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).not.toHaveBeenCalled();
    const data = SaveSystem.load();
    expect(data.pendingDailyKey).toBeNull();
    expect(data.pendingDailyCoins).toBe(0);
  });

  it('verwirft einen unsinnigen Tagesschluessel', async () => {
    signedIn = true;
    SaveSystem.update((data) => {
      data.pendingDailyKey = 'kein-datum';
      data.pendingDailyEventId = 'event-1';
      data.pendingDailyCoins = 50;
      data.pendingDailyScore = 300;
    });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).not.toHaveBeenCalled();
    expect(SaveSystem.load().pendingDailyKey).toBeNull();
  });
});

/**
 * Teilfehlschlag mit mehreren Ereignissen - der Fall, fuer den die
 * `remaining`-Logik in `flushPending()` ueberhaupt existiert.
 *
 * Audit 2026-08-19: Jeder bestehende Test legte genau ein Ereignis an. Damit
 * lief die Schleife nie ueber mehr als einen Durchgang, und der Aufbau der
 * Restliste war komplett ungeprueft - obwohl er ueber `indexOf()` auf
 * Referenzidentitaet arbeitet und die Reihenfolge der Runs bewahren muss.
 */
describe('Teilfehlschlag mit mehreren Ereignissen', () => {
  it('behaelt ab dem gescheiterten Ereignis alle weiteren in Reihenfolge', async () => {
    signedIn = true;
    const first = ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression());
    const second = ProgressSyncSystem.enqueueRun(createRun({ score: 2 }), createProgression());
    const third = ProgressSyncSystem.enqueueRun(createRun({ score: 3 }), createProgression());

    // Das erste geht durch, das zweite scheitert - das dritte darf dann gar
    // nicht erst versucht werden, sonst kaeme es vor dem zweiten an.
    submitProgressEvent
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: 'Netzwerkfehler' })
      .mockResolvedValueOnce({ ok: true });

    await ProgressSyncSystem.flush();

    expect(submitProgressEvent).toHaveBeenCalledTimes(2);

    const outbox = readOutbox();
    // Nicht nur die Anzahl: Ein Fix, der einfach alles stehen laesst, haette
    // hier auch 2 - aber die falschen beiden.
    expect(outbox.map((event) => event.eventId)).toEqual([second, third]);
    expect(outbox.map((event) => event.score)).toEqual([2, 3]);
    expect(first).not.toBeNull();
  });

  it('leert die Outbox, wenn alle Ereignisse durchgehen', async () => {
    signedIn = true;
    ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression());
    ProgressSyncSystem.enqueueRun(createRun({ score: 2 }), createProgression());
    ProgressSyncSystem.enqueueRun(createRun({ score: 3 }), createProgression());
    submitProgressEvent.mockResolvedValue({ ok: true });

    await ProgressSyncSystem.flush();

    expect(submitProgressEvent).toHaveBeenCalledTimes(3);
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
  });

  it('haelt die Reihenfolge, wenn schon das erste Ereignis scheitert', async () => {
    signedIn = true;
    const first = ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression());
    const second = ProgressSyncSystem.enqueueRun(createRun({ score: 2 }), createProgression());
    submitProgressEvent.mockResolvedValue({ ok: false, error: 'Netzwerkfehler' });

    await ProgressSyncSystem.flush();

    // Nach dem ersten Fehlschlag wird abgebrochen, nicht weiterprobiert.
    expect(submitProgressEvent).toHaveBeenCalledTimes(1);
    expect(readOutbox().map((event) => event.eventId)).toEqual([first, second]);
  });
});

describe('automatischer Retry nach Fehlschlag', () => {
  // Beobachtet 2026-08-17: getUser() scheiterte kurz nach Netzwiederkehr am
  // Timeout, obwohl das Geraet Sekunden spaeter problemlos verband. Ohne
  // Wiederholung blieb der Offline-Run bis zum naechsten `online`-Ereignis
  // oder App-Neustart haengen (siehe TODO.md, Phase-2.6-Testbefund).
  it('versucht nach einem Fehlschlag automatisch erneut, ohne dass flush() erneut aufgerufen wird', async () => {
    vi.useFakeTimers();
    signedIn = true;
    ProgressSyncSystem.enqueueRun(createRun(), createProgression());
    submitProgressEvent.mockResolvedValueOnce({ ok: false, error: 'Zeitüberschreitung' });
    submitProgressEvent.mockResolvedValueOnce({ ok: true, value: null });

    await ProgressSyncSystem.flush();
    expect(submitProgressEvent).toHaveBeenCalledTimes(1);
    expect(ProgressSyncSystem.pendingCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);

    expect(submitProgressEvent).toHaveBeenCalledTimes(2);
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
  });

  it('bricht die Wiederholungskette ab, sobald der Nutzer sich abmeldet', async () => {
    vi.useFakeTimers();
    signedIn = true;
    ProgressSyncSystem.enqueueRun(createRun(), createProgression());
    submitProgressEvent.mockResolvedValue({ ok: false, error: 'Zeitüberschreitung' });

    await ProgressSyncSystem.flush();
    signedIn = false;

    await vi.advanceTimersByTimeAsync(5000);

    // Kein zweiter Versuch, weil isSignedIn() beim geplanten Retry bereits
    // false liefert - flushPending() bricht dann ueber cancelRetry() ab.
    expect(submitProgressEvent).toHaveBeenCalledTimes(1);
  });
});

describe('hasPendingData', () => {
  it('meldet ausstehende Daten sowohl fuer die Outbox als auch fuer den Tagesbonus', () => {
    signedIn = true;
    expect(ProgressSyncSystem.hasPendingData()).toBe(false);

    ProgressSyncSystem.enqueueRun(createRun(), createProgression());
    expect(ProgressSyncSystem.hasPendingData()).toBe(true);
  });

  it('zaehlt einen Tagesbonus ohne Coins nicht als ausstehend', () => {
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-17';
      data.pendingDailyCoins = 0;
    });

    expect(ProgressSyncSystem.hasPendingData()).toBe(false);
  });
});

describe('Account-Bindung', () => {
  it('trennt die Outboxes beim Kontowechsel', () => {
    signedIn = true;
    signedInUserId = 'user-a';
    const first = ProgressSyncSystem.enqueueRun(createRun({ score: 11 }), createProgression());

    signedInUserId = 'user-b';
    const second = ProgressSyncSystem.enqueueRun(createRun({ score: 22 }), createProgression());

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(readOutbox('user-a')).toHaveLength(1);
    expect(readOutbox('user-b')).toHaveLength(1);
    expect(ProgressSyncSystem.pendingCount()).toBe(1);
  });

  it('uebernimmt keine alte globale Outbox in ein Konto', () => {
    window.localStorage.setItem(
      'isihunt.progress-events',
      JSON.stringify([{ eventId: 'legacy', score: 999 }]),
    );
    signedIn = true;
    signedInUserId = 'user-new';

    expect(ProgressSyncSystem.pendingCount()).toBe(0);
    expect(window.localStorage.getItem('isihunt.progress-events.v2.user-new')).toBeNull();
    expect(window.localStorage.getItem('isihunt.progress-events.unbound.v1')).not.toBeNull();
  });
});

/*
 * Regressionstests zu AUDIT_2026-09-05.
 *
 * Alle drei Faelle waren vor dem Audit gruen abgedeckt - die Luecke war
 * nicht "kein Test", sondern "kein Test mit gleichzeitigen Ereignissen bzw.
 * mit einer dauerhaften Ablehnung".
 */
describe('AUDIT_2026-09-05 Befund 3: Nebenlaeufigkeit beim Upload', () => {
  it('behaelt einen waehrend des Uploads angehaengten Run', async () => {
    signedIn = true;
    ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression());

    // Der Upload von A bleibt offen, waehrend B in die Outbox kommt.
    let finishFirst!: (value: unknown) => void;
    submitProgressEvent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    submitProgressEvent.mockResolvedValue({ ok: true });

    const flushing = ProgressSyncSystem.flush();
    const second = ProgressSyncSystem.enqueueRun(createRun({ score: 2 }), createProgression());
    finishFirst({ ok: true });
    await flushing;

    // Frueher schrieb flushPending den Schnappschuss von vor dem await
    // zurueck - B verschwand ungesendet und ohne Spur.
    const seen = submitProgressEvent.mock.calls.map(([event]) => (event as ProgressEvent).eventId);
    expect(seen).toContain(second);
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
  });
});

describe('AUDIT_2026-09-05 Befund 2: dauerhaft abgelehnte Ereignisse', () => {
  it('blockiert spaetere Runs nicht hinter einem abgelaufenen Tageslauf', async () => {
    signedIn = true;
    ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression(), '2026-08-10');
    const solo = ProgressSyncSystem.enqueueRun(createRun({ score: 2 }), createProgression());

    // Genau die Meldung, die `submit_progress_event` fuer ein zu altes
    // Datum wirft (phase_2_28_integrity_hardening.sql).
    submitProgressEvent.mockImplementation((event: ProgressEvent) =>
      event.dailyKey
        ? Promise.resolve({ ok: false, error: 'Ungueltiger Tageslauf' })
        : Promise.resolve({ ok: true }),
    );

    await ProgressSyncSystem.flush();

    const seen = submitProgressEvent.mock.calls.map(([event]) => (event as ProgressEvent).eventId);
    expect(seen).toContain(solo);
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
    // Der abgelehnte Lauf ist nicht spurlos weg, sondern nachvollziehbar.
    expect(
      window.localStorage.getItem('isihunt.progress-events.rejected.v1.user-1'),
    ).not.toBeNull();
  });

  it('haelt einen voruebergehenden Fehler weiterhin in der Outbox', async () => {
    signedIn = true;
    const first = ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression());
    const second = ProgressSyncSystem.enqueueRun(createRun({ score: 2 }), createProgression());
    submitProgressEvent.mockResolvedValue({ ok: false, error: 'Zeitüberschreitung' });

    await ProgressSyncSystem.flush();

    // Gegenprobe zum Test darueber: ein Netzfehler darf NICHTS verwerfen.
    expect(submitProgressEvent).toHaveBeenCalledTimes(1);
    expect(readOutbox().map((event) => event.eventId)).toEqual([first, second]);
    expect(window.localStorage.getItem('isihunt.progress-events.rejected.v1.user-1')).toBeNull();
  });

  it('wiederholt einen Cooldown-Fehler, statt den Lauf zu verwerfen', async () => {
    signedIn = true;
    const only = ProgressSyncSystem.enqueueRun(createRun({ score: 1 }), createProgression());
    // Der Cooldown-Trigger aus phase_2_29 ist zeitabhaengig - ein spaeterer
    // Versuch geht durch. Er darf deshalb nicht als dauerhaft gelten.
    submitProgressEvent.mockResolvedValue({
      ok: false,
      error: 'Fortschrittslauf zu schnell eingereicht',
    });

    await ProgressSyncSystem.flush();

    expect(readOutbox().map((event) => event.eventId)).toEqual([only]);
  });
});

describe('AUDIT_2026-09-05 Befund 6: Bot-Siegpraemie', () => {
  it('meldet einen Bot-Sieg als ausstehende Daten und laedt ihn hoch', async () => {
    signedIn = true;
    claimBotVictoryBonus.mockResolvedValue({ ok: true, value: null });

    expect(ProgressSyncSystem.enqueueBotVictory('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(ProgressSyncSystem.hasPendingData()).toBe(true);

    await ProgressSyncSystem.flush();

    expect(claimBotVictoryBonus).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(ProgressSyncSystem.hasPendingData()).toBe(false);
  });

  it('behaelt den Bot-Sieg, wenn der Upload scheitert', async () => {
    signedIn = true;
    claimBotVictoryBonus.mockResolvedValue({ ok: false, error: 'Zeitüberschreitung' });

    ProgressSyncSystem.enqueueBotVictory('22222222-2222-4222-8222-222222222222');
    await ProgressSyncSystem.flush();

    expect(ProgressSyncSystem.hasPendingData()).toBe(true);
  });

  it('merkt ohne Anmeldung nichts vor', () => {
    signedIn = false;
    expect(ProgressSyncSystem.enqueueBotVictory('33333333-3333-4333-8333-333333333333')).toBe(
      false,
    );
  });
});

describe('AUDIT_2026-09-05_REAUDIT Befund 2: Outbox-Migration unter Schreibfehlern', () => {
  /**
   * Laesst ausschliesslich das Schreiben neuer Event-Schluessel scheitern.
   *
   * Genau dieser Fall trat bei vollem localStorage auf: das Original belegte
   * noch Platz, die zusaetzliche Kopie passte nicht mehr hinein.
   */
  function failWritesForEventKeys(): () => void {
    const original = window.localStorage.setItem.bind(window.localStorage);
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        if (key.includes('.event.')) throw new DOMException('voll', 'QuotaExceededError');
        original(key, value);
      });
    return () => spy.mockRestore();
  }

  it('behaelt das Original, wenn die Kopie in Einzelschluessel scheitert', () => {
    signedIn = true;
    const event: ProgressEvent = {
      eventId: '44444444-4444-4444-8444-444444444444',
      worldId: DEFAULT_WORLD_ID,
      score: 500,
      bestCombo: 7,
      xpGained: 60,
      durationMs: 90_000,
      coinsGained: 20,
      talentPointsGained: 0,
      collected: emptyRarityCounts(),
      unlockedAchievementIds: [],
      dailyKey: null,
      createdAt: '2026-08-17T11:00:00.000Z',
    };
    window.localStorage.setItem(
      `isihunt.progress-events.v2.${signedInUserId}`,
      JSON.stringify([event]),
    );

    const restoreWrites = failWritesForEventKeys();

    // Frueher loeschte die Migration hier das Array trotz fehlgeschlagener
    // Kopie - der Run fehlte danach in beiden Formaten.
    expect(ProgressSyncSystem.pendingCount()).toBe(1);

    // Ab hier darf wieder geschrieben werden: geprueft wird, dass der Run den
    // Fehlversuch ueberlebt hat und beim naechsten Zugriff nachgezogen wird.
    restoreWrites();
    expect(readOutbox()).toHaveLength(1);
    expect(readOutbox()[0]?.eventId).toBe(event.eventId);
  });

  it('raeumt den Originalschluessel weg, sobald die Kopie gelingt', () => {
    signedIn = true;
    const event: ProgressEvent = {
      eventId: '55555555-5555-4555-8555-555555555555',
      worldId: DEFAULT_WORLD_ID,
      score: 300,
      bestCombo: 4,
      xpGained: 40,
      durationMs: 90_000,
      coinsGained: 12,
      talentPointsGained: 0,
      collected: emptyRarityCounts(),
      unlockedAchievementIds: [],
      dailyKey: null,
      createdAt: '2026-08-17T11:30:00.000Z',
    };
    window.localStorage.setItem(
      `isihunt.progress-events.v2.${signedInUserId}`,
      JSON.stringify([event]),
    );

    expect(ProgressSyncSystem.pendingCount()).toBe(1);
    expect(window.localStorage.getItem(`isihunt.progress-events.v2.${signedInUserId}`)).toBeNull();
  });
});

describe('AUDIT_2026-09-05_REAUDIT Befund 3: dauerhaft abgelehnter Bot-Sieg', () => {
  it('blockiert mit einer permanenten Ablehnung nicht die folgenden Eintraege', async () => {
    signedIn = true;
    // Der Server raeumt offene Match-IDs auf, die aelter als einen Tag sind;
    // ein zweites Geraet desselben Kontos kann das ausloesen, waehrend das
    // erste seinen Sieg noch offline haelt.
    claimBotVictoryBonus.mockImplementation((matchId: string) =>
      matchId === '66666666-6666-4666-8666-666666666666'
        ? Promise.resolve({ ok: false, error: 'Bot-Duell nicht gestartet' })
        : Promise.resolve({ ok: true, value: null }),
    );

    // Beide Siege liegen vor dem ersten Netzversuch in der Warteschlange - so
    // sieht es nach einem Offline-Abend aus. `enqueueBotVictory()` startet
    // selbst schon einen Flush, deshalb wird er hier abgewartet, bevor der
    // zweite Eintrag dazukommt.
    ProgressSyncSystem.enqueueBotVictory('66666666-6666-4666-8666-666666666666');
    ProgressSyncSystem.enqueueBotVictory('77777777-7777-4777-8777-777777777777');
    await ProgressSyncSystem.flush();
    await ProgressSyncSystem.flush();

    // Frueher brach die Schleife bei der ersten Ablehnung ab: der zweite Sieg
    // wurde nie gesendet und `hasPendingData()` sperrte dauerhaft die Abmeldung.
    expect(claimBotVictoryBonus).toHaveBeenCalledWith('77777777-7777-4777-8777-777777777777');
    // Weder der abgelehnte noch der gebuchte Eintrag darf die Abmeldung sperren.
    expect(ProgressSyncSystem.hasPendingData()).toBe(false);
  });

  it('arbeitet in EINEM Durchlauf hinter der Ablehnung weiter', async () => {
    signedIn = true;
    // Direkt in den Speicher, damit kein `enqueueBotVictory()`-Flush
    // dazwischenfunkt: geprueft wird genau die Schleife in `flushBotVictories`.
    window.localStorage.setItem(
      `isihunt.bot-victories.v1.${signedInUserId}`,
      JSON.stringify([
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ]),
    );
    claimBotVictoryBonus.mockImplementation((matchId: string) =>
      matchId === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        ? Promise.resolve({ ok: false, error: 'Bot-Duell nicht gestartet' })
        : Promise.resolve({ ok: true, value: null }),
    );

    await ProgressSyncSystem.flush();

    expect(claimBotVictoryBonus).toHaveBeenCalledTimes(2);
    expect(claimBotVictoryBonus).toHaveBeenLastCalledWith('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(ProgressSyncSystem.hasPendingData()).toBe(false);
  });

  it('legt die dauerhafte Ablehnung sichtbar beiseite, statt sie zu loeschen', async () => {
    signedIn = true;
    claimBotVictoryBonus.mockResolvedValue({ ok: false, error: 'Bot-Duell nicht gestartet' });

    ProgressSyncSystem.enqueueBotVictory('88888888-8888-4888-8888-888888888888');
    await ProgressSyncSystem.flush();

    const quarantined: unknown = JSON.parse(
      window.localStorage.getItem(`isihunt.bot-victories.rejected.v1.${signedInUserId}`) ?? '[]',
    );
    expect(quarantined).toEqual(['88888888-8888-4888-8888-888888888888']);
  });

  it('wiederholt einen zeitabhaengigen Cooldown weiterhin', async () => {
    signedIn = true;
    // 'Bot-Duell noch nicht beendet' haengt an der Uhr, nicht am Inhalt - ein
    // spaeterer Versuch geht durch und darf die ID nicht kosten.
    claimBotVictoryBonus.mockResolvedValue({ ok: false, error: 'Bot-Duell noch nicht beendet' });

    ProgressSyncSystem.enqueueBotVictory('99999999-9999-4999-8999-999999999999');
    await ProgressSyncSystem.flush();

    expect(ProgressSyncSystem.hasPendingData()).toBe(true);
  });
});

describe('Bot-Siege: Aufgeben nach dauerhaft erfolglosen Anlaeufen', () => {
  const attemptsKey = () => `isihunt.bot-victories.attempts.v1.${signedInUserId}`;

  it('zaehlt nur Durchlaeufe ganz ohne Buchung als Fehlversuch', async () => {
    signedIn = true;
    window.localStorage.setItem(
      `isihunt.bot-victories.v1.${signedInUserId}`,
      JSON.stringify(['dddddddd-dddd-4ddd-8ddd-dddddddddddd']),
    );
    claimBotVictoryBonus.mockResolvedValue({ ok: false, error: 'Zeitüberschreitung' });

    await ProgressSyncSystem.flush();

    expect(window.localStorage.getItem(attemptsKey())).toBe('1');
  });

  it('setzt den Zaehler zurueck, sobald ein Sieg durchkommt', async () => {
    signedIn = true;
    window.localStorage.setItem(attemptsKey(), '17');
    window.localStorage.setItem(
      `isihunt.bot-victories.v1.${signedInUserId}`,
      JSON.stringify(['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']),
    );
    claimBotVictoryBonus.mockResolvedValue({ ok: true, value: null });

    await ProgressSyncSystem.flush();

    // Eine nachweislich funktionierende Verbindung darf den Zaehler nicht
    // weiter Richtung Aufgabe treiben.
    expect(window.localStorage.getItem(attemptsKey())).toBeNull();
  });

  it('gibt die Warteschlange nach der Obergrenze auf und quarantaeniert sie', async () => {
    signedIn = true;
    // Ein Sieg, dessen Claim IMMER voruebergehend scheitert (geloeschtes
    // Konto, defektes Profil), sperrte sonst dauerhaft die Abmeldung.
    window.localStorage.setItem(attemptsKey(), String(BOT_VICTORY_MAX_FAILED_ATTEMPTS));
    window.localStorage.setItem(
      `isihunt.bot-victories.v1.${signedInUserId}`,
      JSON.stringify(['ffffffff-ffff-4fff-8fff-ffffffffffff']),
    );
    claimBotVictoryBonus.mockResolvedValue({ ok: false, error: 'Zeitüberschreitung' });

    await ProgressSyncSystem.flush();

    expect(claimBotVictoryBonus).not.toHaveBeenCalled();
    expect(ProgressSyncSystem.hasPendingData()).toBe(false);
    // Aufgeben heisst beiseitelegen, nicht stumm loeschen.
    const quarantined: unknown = JSON.parse(
      window.localStorage.getItem(`isihunt.bot-victories.rejected.v1.${signedInUserId}`) ?? '[]',
    );
    expect(quarantined).toEqual(['ffffffff-ffff-4fff-8fff-ffffffffffff']);
  });
});

describe('AUDIT_2026-09-05_REAUDIT Befund 5: gesperrter localStorage', () => {
  it('wirft beim Zaehlen nicht, wenn der Speicher den Zugriff verweigert', () => {
    signedIn = true;
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('gesperrt', 'SecurityError');
    });

    // Frueher entkam die Exception bis in den Aufrufer und riss am Ende eines
    // Tageslaufs den Wechsel zum Ergebnisbildschirm mit.
    expect(() => ProgressSyncSystem.pendingCount()).not.toThrow();
    expect(ProgressSyncSystem.pendingCount()).toBe(0);
  });

  it('wirft beim Einreihen nicht, wenn der Speicher den Zugriff verweigert', () => {
    signedIn = true;
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('gesperrt', 'SecurityError');
    });

    expect(() => ProgressSyncSystem.enqueueRun(createRun(), createProgression())).not.toThrow();
  });
});

describe('AUDIT_2026-09-05_REAUDIT Befund 6: Retry fuer den Tagesbonus', () => {
  /** Legt einen aktuellen Tagesbonus ohne wartende Runs ab. */
  function queuePendingDaily(): void {
    SaveSystem.update((data) => {
      data.pendingDailyKey = '2026-08-17';
      data.pendingDailyEventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      data.pendingDailyCoins = 40;
      data.pendingDailyScore = 900;
    });
  }

  it('plant nach einem voruebergehenden Claim-Fehler einen neuen Versuch', async () => {
    signedIn = true;
    queuePendingDaily();
    claimDailyBonus.mockResolvedValueOnce({ ok: false, error: 'Zeitüberschreitung' });

    await ProgressSyncSystem.flush();
    expect(claimDailyBonus).toHaveBeenCalledTimes(1);
    expect(ProgressSyncSystem.hasPendingData()).toBe(true);

    // Ohne den Retry blieb der Bonus bis zum naechsten zufaelligen Ausloeser
    // liegen und verfiel nach Ablauf des Datumsfensters.
    claimDailyBonus.mockResolvedValue({ ok: true, value: { data: SaveSystem.load() } });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(claimDailyBonus.mock.calls.length).toBeGreaterThan(1);
    expect(SaveSystem.load().pendingDailyKey).toBeNull();
  });

  it('verwirft eine dauerhafte Ablehnung, statt ewig zu wiederholen', async () => {
    signedIn = true;
    queuePendingDaily();
    claimDailyBonus.mockResolvedValue({ ok: false, error: 'Ungueltiger Tageslauf' });

    await ProgressSyncSystem.flush();

    expect(claimDailyBonus).toHaveBeenCalledTimes(1);
    expect(SaveSystem.load().pendingDailyKey).toBeNull();
  });
});
