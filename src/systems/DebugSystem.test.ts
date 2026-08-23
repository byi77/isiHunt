/**
 * Tests fuer den Phaser-freien Kern von DebugSystem: Ringpuffer, Toggle-
 * Persistenz und Tap-Zaehler. Screenshot/Share-Sheet sind nur am echten
 * Geraet pruefbar (jsdom rendert keinen echten Canvas-Inhalt, `navigator.share`
 * existiert dort nicht) und bleiben deshalb ungetestet.
 *
 * `SoundSystem` importiert `EventBus`, das `Phaser.Events.EventEmitter`
 * erweitert - Phaser wird deshalb wie in SoundSystem.test.ts gemockt, sonst
 * zieht der Import die Canvas-Erkennung mit (CLAUDE.md, "Wiederkehrende Fallen").
 */

import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEBUG_LOG_BUFFER_SIZE,
  DEBUG_LOG_STORAGE_KEY,
  DEBUG_MODE_STORAGE_KEY,
  DEBUG_PROTECTED_BUFFER_SIZE,
  DEBUG_TOGGLE_TAP_COUNT,
} from '@/config/DebugConfig';
import type * as DebugSystemModule from '@/systems/DebugSystem';

vi.mock('phaser', () => ({
  default: { Events: { EventEmitter } },
}));

let DebugSystem: typeof DebugSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  DebugSystem = await import('@/systems/DebugSystem');
});

describe('DebugSystem Ringpuffer', () => {
  it('haelt Eintraege in Einfuegereihenfolge', () => {
    DebugSystem.pushLogEntry({ timestamp: 1, kind: 'event', label: 'a', detail: '' });
    DebugSystem.pushLogEntry({ timestamp: 2, kind: 'error', label: 'b', detail: '' });

    const buffer = DebugSystem.getLogBuffer();
    expect(buffer.map((e) => e.label)).toEqual(['a', 'b']);
  });

  it('verwirft den aeltesten Eintrag bei Ueberlauf', () => {
    const overflowCount = DEBUG_LOG_BUFFER_SIZE + 10;
    for (let i = 0; i < overflowCount; i++) {
      DebugSystem.pushLogEntry({ timestamp: i, kind: 'event', label: `e${i}`, detail: '' });
    }

    const buffer = DebugSystem.getLogBuffer();
    expect(buffer.length).toBe(DEBUG_LOG_BUFFER_SIZE);
    expect(buffer[0]?.label).toBe('e10');
    expect(buffer[buffer.length - 1]?.label).toBe(`e${overflowCount - 1}`);
  });
});

describe('DebugSystem.installConsoleCapture', () => {
  it('schreibt console.warn zusaetzlich in den Ringpuffer', () => {
    const original = console.warn;
    try {
      const spy = vi.fn();
      console.warn = spy;
      DebugSystem.installConsoleCapture();

      console.warn('[SaveSystem] Testprofil nicht aktivierbar.', new Error('Quota'));

      expect(spy).toHaveBeenCalledOnce();
      const buffer = DebugSystem.getLogBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0]?.label).toBe('console.warn');
      expect(buffer[0]?.detail).toContain('[SaveSystem] Testprofil nicht aktivierbar.');
    } finally {
      console.warn = original;
    }
  });

  it('schreibt console.error zusaetzlich in den Ringpuffer', () => {
    const original = console.error;
    try {
      const spy = vi.fn();
      console.error = spy;
      DebugSystem.installConsoleCapture();

      console.error('etwas ging schief');

      expect(spy).toHaveBeenCalledOnce();
      const buffer = DebugSystem.getLogBuffer();
      expect(buffer[0]?.label).toBe('console.error');
    } finally {
      console.error = original;
    }
  });

  it('haengt sich bei mehrfachem Aufruf nicht doppelt ein', () => {
    const original = console.warn;
    try {
      const spy = vi.fn();
      console.warn = spy;
      DebugSystem.installConsoleCapture();
      DebugSystem.installConsoleCapture();

      console.warn('einmal');

      expect(DebugSystem.getLogBuffer().length).toBe(1);
    } finally {
      console.warn = original;
    }
  });
});

describe('DebugSystem.logAppStart', () => {
  it('schreibt Version, Startweg und Netzwerkstatus als ersten Eintrag', () => {
    DebugSystem.logAppStart({ standalone: true, ios: true });

    const buffer = DebugSystem.getLogBuffer();
    expect(buffer.length).toBe(1);
    expect(buffer[0]?.label).toBe('app:start');
    expect(buffer[0]?.detail).toContain('standalone=true');
    expect(buffer[0]?.detail).toContain('ios=true');
  });
});

describe('DebugSystem Debug-Modus-Persistenz', () => {
  it('ist standardmaessig aus', () => {
    expect(DebugSystem.isDebugModeActive()).toBe(false);
  });

  it('schaltet nach der Tap-Schwelle um und speichert den Zustand', () => {
    let result: boolean | null = null;
    for (let i = 0; i < DEBUG_TOGGLE_TAP_COUNT; i++) {
      result = DebugSystem.registerLogoTap(1000 + i);
    }

    expect(result).toBe(true);
    expect(DebugSystem.isDebugModeActive()).toBe(true);
    expect(window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY)).toBe('1');
  });

  it('gibt vor Erreichen der Schwelle null zurueck', () => {
    const result = DebugSystem.registerLogoTap(1000);
    expect(result).toBeNull();
    expect(DebugSystem.isDebugModeActive()).toBe(false);
  });

  it('setzt den Zaehler zurueck, wenn das Zeitfenster ueberschritten wird', () => {
    // Nur 9 von 10 noetigen Tipps registrieren, damit die Schwelle noch nicht faellt.
    for (let i = 0; i < DEBUG_TOGGLE_TAP_COUNT - 1; i++) {
      DebugSystem.registerLogoTap(0 + i);
    }
    // Weit ausserhalb des Zeitfensters: die 9 alten Tipps zaehlen nicht mehr mit.
    const result = DebugSystem.registerLogoTap(1_000_000);

    expect(result).toBeNull();
    expect(DebugSystem.isDebugModeActive()).toBe(false);
  });

  it('schaltet bei erneutem Erreichen der Schwelle wieder aus', () => {
    for (let i = 0; i < DEBUG_TOGGLE_TAP_COUNT; i++) DebugSystem.registerLogoTap(1000 + i);
    expect(DebugSystem.isDebugModeActive()).toBe(true);

    let result: boolean | null = null;
    for (let i = 0; i < DEBUG_TOGGLE_TAP_COUNT; i++) result = DebugSystem.registerLogoTap(5000 + i);

    expect(result).toBe(false);
    expect(DebugSystem.isDebugModeActive()).toBe(false);
    expect(window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY)).toBeNull();
  });
});

describe('Persistenz ueber einen App-Neustart', () => {
  // Beobachtet 2026-08-18: ein Fehlerbericht ging verloren, weil der
  // Ringpuffer rein In-Memory war - App beenden vor dem Teilen loeschte ihn.
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schreibt den Puffer gedrosselt in localStorage, nicht synchron bei jedem Eintrag', async () => {
    vi.useFakeTimers();
    DebugSystem.pushLogEntry({ timestamp: 1, kind: 'event', label: 'a', detail: '' });

    expect(window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY)).toBeNull();

    await vi.advanceTimersByTimeAsync(500);

    const stored = window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual([{ timestamp: 1, kind: 'event', label: 'a', detail: '' }]);
  });

  it('schreibt sofort beim Verstecken der Seite (App-Wechsel), ohne auf den Drossel-Timer zu warten', () => {
    DebugSystem.pushLogEntry({ timestamp: 1, kind: 'event', label: 'a', detail: '' });

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    const stored = window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveLength(1);
  });

  it('stellt einen zuvor gespeicherten Puffer beim naechsten Modul-Start wieder her', async () => {
    window.localStorage.setItem(
      DEBUG_LOG_STORAGE_KEY,
      JSON.stringify([{ timestamp: 1, kind: 'event', label: 'restored', detail: '' }]),
    );
    vi.resetModules();
    const reloaded: typeof DebugSystemModule = await import('@/systems/DebugSystem');

    expect(reloaded.getLogBuffer().map((e) => e.label)).toEqual(['restored']);
  });

  it('ignoriert kaputte gespeicherte Daten und startet leer, statt zu werfen', async () => {
    window.localStorage.setItem(DEBUG_LOG_STORAGE_KEY, '{nicht valides json');
    vi.resetModules();
    const reloaded: typeof DebugSystemModule = await import('@/systems/DebugSystem');

    expect(reloaded.getLogBuffer()).toEqual([]);
  });

  it('clearLogBuffer leert sowohl den Speicher als auch localStorage', () => {
    DebugSystem.pushLogEntry({ timestamp: 1, kind: 'event', label: 'a', detail: '' });
    DebugSystem.clearLogBuffer();

    expect(DebugSystem.getLogBuffer()).toEqual([]);
    expect(window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY)).toBeNull();
  });
});

describe('DebugSystem.buildReport', () => {
  it('enthaelt Geraet-, Layout-, Ton- und Verlaufsabschnitte', async () => {
    const canvas = document.createElement('canvas');
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'event',
      label: 'run:started',
      detail: 'worldId=eisring',
    });

    const report = await DebugSystem.buildReport(canvas, ['Menu']);

    expect(report).toContain('isiHunt Debug-Report');
    expect(report).toContain('GERÄT / BROWSER');
    expect(report).toContain('LAYOUT');
    expect(report).toContain('TON-DIAGNOSE');
    expect(report).toContain('VERLAUF');
    expect(report).toContain('run:started');
    expect(report).toContain('Menu');
  });

  it('zeigt einen Platzhalter, wenn der Ringpuffer leer ist', async () => {
    const canvas = document.createElement('canvas');
    const report = await DebugSystem.buildReport(canvas, []);
    expect(report).toContain('(keine Eintraege)');
  });

  /**
   * Der Screenshot-Abschnitt ist selbst ein Diagnosewerkzeug: er beantwortet
   * die Frage "warum ist das Bild schwarz?" im Bericht statt in einer
   * Fehlersuche. Diese Tests halten fest, dass er den Kanal ueberhaupt
   * befragt - und dass er dabei nicht wirft, wenn WebGL fehlt.
   */
  it('meldet, ob der Screenshot Inhalt tragen kann', async () => {
    const canvas = document.createElement('canvas');
    const report = await DebugSystem.buildReport(canvas, []);
    expect(report).toContain('SCREENSHOT');
    expect(report).toContain('Bild moeglich');
  });

  it('nennt einen freigegebenen Zeichenpuffer als Grund fuer ein schwarzes Bild', async () => {
    const canvas = document.createElement('canvas');
    // Ein WebGL-Kontext, der `preserveDrawingBuffer: false` meldet - genau die
    // Lage auf dem Geraet vor v0.1.250.
    vi.spyOn(canvas, 'getContext').mockReturnValue({
      getContextAttributes: () => ({ preserveDrawingBuffer: false }),
    } as unknown as RenderingContext);

    const report = await DebugSystem.buildReport(canvas, []);

    expect(report).toContain('NEIN');
    expect(report).toContain('App neu starten');
  });

  it('meldet einen erhaltenen Zeichenpuffer als brauchbar', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue({
      getContextAttributes: () => ({ preserveDrawingBuffer: true }),
    } as unknown as RenderingContext);

    const report = await DebugSystem.buildReport(canvas, []);

    expect(report).toContain('Bild moeglich    ja');
    // Gezielt gegen die Warnzeile pruefen, nicht gegen das blosse Wort:
    // "NEIN" steht auch in anderen Abschnitten des Berichts.
    expect(report).not.toContain('Screenshot bleibt schwarz');
  });
});

/**
 * Der geschuetzte Puffer existiert aus genau einem Grund: seltene, fuer die
 * Diagnose tragende Ereignisse duerfen nicht von haeufigen verdraengt werden.
 * Der Geraetebericht vom 2026-08-23 zeigte den Fehlerfall - 148 Relikte in
 * einer Runde erzeugen 444 Eintraege gegen 400 Pufferplaetze, und die eigens
 * eingebaute Kanaldiagnose war am Rundenende restlos ueberschrieben.
 */
describe('DebugSystem geschuetzter Puffer', () => {
  beforeEach(() => {
    DebugSystem.clearLogBuffer();
  });

  it('ueberlebt eine ganze Runde voller Sammelereignisse', () => {
    DebugSystem.pushProtectedLogEntry({
      timestamp: Date.now(),
      kind: 'event',
      label: 'duel:kanalstatus',
      detail: 'SUBSCRIBED',
    });

    // Eine Runde mit 148 Relikten erzeugt drei Eintraege pro Fang - mehr als
    // der Hauptpuffer fasst. Genau die Menge aus dem Geraetebericht.
    for (let i = 0; i < 148 * 3; i++) {
      DebugSystem.pushLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'run:collected',
        detail: '',
      });
    }

    // Der Hauptpuffer hat den Anfang laengst verloren ...
    expect(DebugSystem.getLogBuffer().length).toBeLessThan(148 * 3);
    // ... der geschuetzte traegt den Kanalstatus weiterhin.
    const entry = DebugSystem.getProtectedLogBuffer().find(
      (item) => item.label === 'duel:kanalstatus',
    );
    expect(entry?.detail).toBe('SUBSCRIBED');
  });

  it('haelt auch selbst die Ringpuffer-Grenze ein', () => {
    for (let i = 0; i < DEBUG_PROTECTED_BUFFER_SIZE + 20; i++) {
      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: `eintrag-${i}`,
        detail: '',
      });
    }

    // Der Schutz ist kein unbegrenztes Wachstum: auch dieser Puffer wird
    // vollstaendig nach localStorage serialisiert.
    expect(DebugSystem.getProtectedLogBuffer()).toHaveLength(DEBUG_PROTECTED_BUFFER_SIZE);
  });

  it('nennt beide Puffer getrennt im Bericht', async () => {
    DebugSystem.pushProtectedLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: 'duel:send/live',
      detail: 'kein aktiver Kanal',
    });

    const report = await DebugSystem.buildReport(document.createElement('canvas'), []);

    expect(report).toContain('WICHTIGE EREIGNISSE');
    expect(report).toContain('duel:send/live');
    expect(report).toContain('VERLAUF');
  });
});
