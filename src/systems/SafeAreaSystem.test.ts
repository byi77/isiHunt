/**
 * Regressionstest fuer den Regel-4-Guard aus dem Audit
 * (docs/AUDIT_2026-08-17.md Abschnitt 3, Regel 4): `SafeAreaSystem` ist kein
 * Scene-Objekt und hat deshalb keinen SHUTDOWN-Handler. Statt das als
 * Ausnahme zu dokumentieren, meldet `initialize()` jetzt selbst zuerst ab
 * (`shutdown()`), falls es aus einem vorherigen Aufruf noch aktiv ist -
 * Listener duerfen dadurch nie doppelt registriert werden.
 */

import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// EventBus.ts erweitert Phaser.Events.EventEmitter nur fuer on/off/emit -
// ein echter Import von 'phaser' zieht hier die Canvas-Erkennung mit und
// bricht unter jsdom ab (CODE_STYLE.md 1.6, derselbe Fallstrick wie bei
// ScoreSystem). Node's EventEmitter hat dieselbe on/off/emit-Schnittstelle.
vi.mock('phaser', () => ({
  default: { Events: { EventEmitter } },
}));

const { eventBus, GameEvent } = await import('@/core/EventBus');
const SafeAreaSystem = await import('@/systems/SafeAreaSystem');

function ensureSafeAreaElement(): HTMLElement {
  let el = document.getElementById('safe-area-content');
  if (!el) {
    el = document.createElement('div');
    el.id = 'safe-area-content';
    document.body.appendChild(el);
  }
  el.textContent = '';
  return el;
}

beforeEach(() => {
  ensureSafeAreaElement();
  SafeAreaSystem.shutdown();
  vi.useRealTimers();
});

describe('initialize / shutdown', () => {
  it('registriert Listener, die auf RunStarted reagieren', () => {
    SafeAreaSystem.initialize();

    eventBus.emitEvent(GameEvent.RunStarted, { worldId: 'meadow', durationMs: 5000 });

    expect(document.getElementById('safe-area-content')?.textContent).toBe('5 SEKUNDEN');
  });

  it('meldet Listener bei shutdown() ab - kein Text-Update mehr danach', () => {
    SafeAreaSystem.initialize();
    SafeAreaSystem.shutdown();

    eventBus.emitEvent(GameEvent.RunStarted, { worldId: 'meadow', durationMs: 5000 });

    expect(document.getElementById('safe-area-content')?.textContent).toBe('');
  });

  it('registriert Listener bei doppeltem initialize() nicht doppelt', () => {
    SafeAreaSystem.initialize();
    SafeAreaSystem.initialize();

    const before = eventBus.listenerCount(GameEvent.RunStarted);
    expect(before).toBe(1);

    eventBus.emitEvent(GameEvent.RunEnded, {
      stats: {
        worldId: 'meadow',
        score: 0,
        bestCombo: 0,
        bestMultiplier: 1,
        collected: { poor: 0, common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
        totalCollected: 0,
        missed: 0,
        xpGained: 0,
      },
      progression: {
        levelsGained: 0,
        newLevel: 1,
        talentPointsGained: 0,
        coinsGained: 0,
        unlockedWorldIds: [],
        unlockedAchievementIds: [],
        isNewBestScore: false,
      },
    });

    // Waere der Listener zweimal registriert, wuerde derselbe Text-Aufruf
    // zweimal passieren - beobachtbar ist das nicht direkt, aber die
    // Listener-Anzahl selbst beweist die Abwesenheit der Dopplung bereits.
    expect(document.getElementById('safe-area-content')?.textContent).toBe('RUN BEENDET');
  });

  it('shutdown() ohne vorheriges initialize() ist folgenlos', () => {
    expect(() => SafeAreaSystem.shutdown()).not.toThrow();
  });
});
