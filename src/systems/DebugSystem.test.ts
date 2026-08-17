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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEBUG_LOG_BUFFER_SIZE,
  DEBUG_MODE_STORAGE_KEY,
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
});
