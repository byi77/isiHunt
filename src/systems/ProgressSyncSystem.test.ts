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

import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type * as ProgressSyncSystemModule from '@/systems/ProgressSyncSystem';
import type * as SaveSystemModule from '@/systems/SaveSystem';
import type { ProgressEvent, ProgressionResult, RunStats } from '@/types';

let signedIn = false;

vi.mock('@/systems/AuthSystem', () => ({
  isSignedIn: () => signedIn,
}));

const submitProgressEvent = vi.fn();
const claimDailyBonus = vi.fn();

vi.mock('@/systems/CloudSystem', () => ({
  submitProgressEvent: (...args: unknown[]) => submitProgressEvent(...args),
  claimDailyBonus: (...args: unknown[]) => claimDailyBonus(...args),
}));

let SaveSystem: typeof SaveSystemModule;
let ProgressSyncSystem: typeof ProgressSyncSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  signedIn = false;
  submitProgressEvent.mockReset();
  claimDailyBonus.mockReset();
  vi.resetModules();
  SaveSystem = await import('@/systems/SaveSystem');
  ProgressSyncSystem = await import('@/systems/ProgressSyncSystem');
});

afterEach(() => {
  ProgressSyncSystem.cancelRetry();
  vi.useRealTimers();
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
function readOutbox(): ProgressEvent[] {
  const raw = window.localStorage.getItem('isihunt.progress-events');
  return raw ? (JSON.parse(raw) as ProgressEvent[]) : [];
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
    expect(ProgressSyncSystem.pendingCount()).toBe(1);
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
    expect(ProgressSyncSystem.pendingCount()).toBe(1);
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
    expect(ProgressSyncSystem.pendingCount()).toBe(1);
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

    expect(claimDailyBonus).toHaveBeenCalledWith('2026-08-17', 300, 'event-1');
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
