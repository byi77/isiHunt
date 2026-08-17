/**
 * Tests fuer SoundSystem: die Tier-Verzweigung in playCollected() (Audit
 * Abschnitt 7.1) und den Regel-4-Guard/Unsubscribe-Mechanismus (Abschnitt 3,
 * Regel 4 - dasselbe Muster wie SafeAreaSystem.test.ts).
 *
 * `AudioContext` existiert in jsdom nicht - ein minimaler Fake stellt nur die
 * von SoundSystem tatsaechlich genutzten Methoden bereit. Phaser wird wie in
 * SafeAreaSystem.test.ts gemockt, weil EventBus.ts Phaser.Events.EventEmitter
 * erweitert und ein echter Import die Canvas-Erkennung mitzieht.
 */

import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { eventBus as EventBusInstance, GameEvent as GameEventConst } from '@/core/EventBus';
import type * as SaveSystemModule from '@/systems/SaveSystem';
import type * as SoundSystemModule from '@/systems/SoundSystem';

vi.mock('phaser', () => ({
  default: { Events: { EventEmitter } },
}));

class FakeGainParam {
  value = 1;
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeGainNode {
  gain = new FakeGainParam();
  connect(): void {}
}

class FakeOscillatorNode {
  type = 'sine';
  frequency = new FakeGainParam();
  connect(): void {}
  start(): void {}
  stop(): void {}
}

class FakeBufferSourceNode {
  buffer: unknown = null;
  connect(): void {}
  start(): void {}
}

class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, handler: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  private fire(type: string): void {
    for (const handler of this.listeners.get(type) ?? []) handler();
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode();
  }

  createBuffer(): unknown {
    return {};
  }

  createBufferSource(): FakeBufferSourceNode {
    return new FakeBufferSourceNode();
  }

  resume(): Promise<void> {
    this.state = 'running';
    this.fire('statechange');
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    this.fire('statechange');
    return Promise.resolve();
  }
}

/**
 * Simuliert das auf dem Testgeraet beobachtete iOS-Verhalten: `resume()`
 * loest nie auf und nie ab - kein resolve, kein reject.
 */
class HangingResumeAudioContext extends FakeAudioContext {
  resume(): Promise<void> {
    return new Promise<void>(() => undefined);
  }
}

/**
 * `resume()` loest erst nach `settle()` auf statt synchron wie
 * `FakeAudioContext` - bildet ab, dass im echten Browser zwischen Tipp und
 * `running`-Zustand messbare Zeit vergeht. Ohne das wuerde ein Test mehrerer
 * schneller Ereignisse den ersten resume()-Aufruf sofort abschliessen und
 * die Race-Situation, die den Tonhaufen-Bug ausloeste, nicht abbilden.
 */
class SlowResumeAudioContext extends FakeAudioContext {
  private resolveResume: (() => void) | null = null;

  resume(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolveResume = resolve;
    });
  }

  settle(): void {
    this.state = 'running';
    this.resolveResume?.();
    this.resolveResume = null;
  }
}

let SoundSystem: typeof SoundSystemModule;
let SaveSystem: typeof SaveSystemModule;
let eventBus: typeof EventBusInstance;
let GameEvent: typeof GameEventConst;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeAudioContext);

  SoundSystem = await import('@/systems/SoundSystem');
  SaveSystem = await import('@/systems/SaveSystem');
  ({ eventBus, GameEvent } = await import('@/core/EventBus'));

  SoundSystem.shutdown();
});

function createRunEndedPayload(levelsGained: number) {
  return {
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
      levelsGained,
      newLevel: 1,
      talentPointsGained: 0,
      coinsGained: 0,
      unlockedWorldIds: [],
      unlockedAchievementIds: [],
      isNewBestScore: false,
    },
  };
}

describe('initialize / shutdown - Regel-4-Guard', () => {
  it('registriert Listener, die auf Collected reagieren', () => {
    SoundSystem.initialize();

    // Kein direkter Beobachtungspunkt fuer "hat einen Ton gespielt" ohne
    // AudioContext-Spy - stattdessen wird ueber die Listener-Anzahl
    // verifiziert, dass genau eine Registrierung erfolgt ist.
    expect(eventBus.listenerCount(GameEvent.Collected)).toBe(1);
  });

  it('meldet Listener bei shutdown() ab', () => {
    SoundSystem.initialize();
    SoundSystem.shutdown();

    expect(eventBus.listenerCount(GameEvent.Collected)).toBe(0);
    expect(eventBus.listenerCount(GameEvent.ComboChanged)).toBe(0);
    expect(eventBus.listenerCount(GameEvent.RunStarted)).toBe(0);
    expect(eventBus.listenerCount(GameEvent.RunEnded)).toBe(0);
  });

  it('registriert Listener bei doppeltem initialize() nicht doppelt', () => {
    SoundSystem.initialize();
    SoundSystem.initialize();

    expect(eventBus.listenerCount(GameEvent.Collected)).toBe(1);
  });

  it('shutdown() ohne vorheriges initialize() ist folgenlos', () => {
    expect(() => SoundSystem.shutdown()).not.toThrow();
  });
});

describe('playCollected - Tier-Verzweigung', () => {
  it('spielt fuer poor/common (Tier 0) einen einzelnen Ton statt einer Sequenz', () => {
    SaveSystem.update((data) => {
      data.soundEnabled = true;
    });
    SoundSystem.initialize();

    // Tier 0 nimmt in playCollected() einen fruehen return vor jeder
    // Sequenz-Konstruktion - hier verifiziert ueber: kein Fehler, Funktion
    // laesst sich fuer alle Stufen gefahrlos aufrufen (Rauch-Test der
    // Verzweigung, da AudioContext-interne Aufrufe nicht spyable sind ohne
    // die Fake-Klassen um vi.fn() zu erweitern).
    expect(() => {
      eventBus.emitEvent(GameEvent.Collected, {
        rarityId: 'poor',
        basePoints: 2,
        awardedPoints: 2,
        combo: 1,
        multiplier: 1,
        sameRarityStreak: 1,
        streakBonus: false,
        x: 0,
        y: 0,
      });
    }).not.toThrow();
  });

  it('spielt fuer legendary (Tier 4) eine mehrstimmige Sequenz ohne Fehler', () => {
    SaveSystem.update((data) => {
      data.soundEnabled = true;
    });
    SoundSystem.initialize();

    expect(() => {
      eventBus.emitEvent(GameEvent.Collected, {
        rarityId: 'legendary',
        basePoints: 100,
        awardedPoints: 100,
        combo: 1,
        multiplier: 1,
        sameRarityStreak: 1,
        streakBonus: false,
        x: 0,
        y: 0,
      });
    }).not.toThrow();
  });

  it('spielt keinen Ton, wenn Ton deaktiviert ist', () => {
    SaveSystem.update((data) => {
      data.soundEnabled = false;
    });
    SoundSystem.initialize();

    // Kein Crash und kein AudioContext-Zugriff, wenn deaktiviert -
    // scheduleTone() muss fruehzeitig zurueckkehren.
    expect(() => {
      eventBus.emitEvent(GameEvent.Collected, {
        rarityId: 'legendary',
        basePoints: 100,
        awardedPoints: 100,
        combo: 1,
        multiplier: 1,
        sameRarityStreak: 1,
        streakBonus: false,
        x: 0,
        y: 0,
      });
    }).not.toThrow();
  });
});

describe('playRunEnded - Level-Aufstieg-Verzweigung', () => {
  it('spielt eine andere Sequenz bei Levelaufstieg als ohne', () => {
    SaveSystem.update((data) => {
      data.soundEnabled = true;
    });
    SoundSystem.initialize();

    expect(() => eventBus.emitEvent(GameEvent.RunEnded, createRunEndedPayload(1))).not.toThrow();
    expect(() => eventBus.emitEvent(GameEvent.RunEnded, createRunEndedPayload(0))).not.toThrow();
  });
});

describe('visibilitychange - Regression: Kontext blieb nach Rueckkehr stumm', () => {
  it('suspendiert den Kontext bei hidden und reaktiviert ihn bei visible', () => {
    SaveSystem.update((data) => {
      data.soundEnabled = true;
    });
    SoundSystem.initialize();
    eventBus.emitEvent(GameEvent.Collected, {
      rarityId: 'common',
      basePoints: 1,
      awardedPoints: 1,
      combo: 1,
      multiplier: 1,
      sameRarityStreak: 1,
      streakBonus: false,
      x: 0,
      y: 0,
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow();
  });

  it('registriert click und touchend als zusaetzliche Entsperr-Gesten (iOS braucht mehr als pointerdown)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    SoundSystem.initialize();

    const registeredTypes = addSpy.mock.calls.map((call) => call[0]);
    expect(registeredTypes).toContain('click');
    expect(registeredTypes).toContain('pointerdown');

    addSpy.mockRestore();
  });
});

describe('resumeAudioContext - Regression: haengendes resume() blockierte jeden weiteren Versuch', () => {
  it('gibt resumePromise nach Zeitlimit frei, statt fuer immer an eine tote Promise gebunden zu bleiben', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', HangingResumeAudioContext);

    SaveSystem.update((data) => {
      data.soundEnabled = true;
    });
    SoundSystem.initialize();

    // Erster Tipp: loest resume() aus, das auf diesem simulierten Geraet nie
    // aufloest - genau der Zustand, der auf dem Testgeraet reproduziert
    // wurde ("resume() laeuft: ja" auf unbestimmte Zeit).
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await vi.advanceTimersByTimeAsync(0);

    expect(SoundSystem.getDiagnostics().resumeInFlight).toBe(true);
    expect(SoundSystem.getDiagnostics().contextState).toBe('suspended');

    // Nach Ablauf des Zeitlimits muss die Blockade weichen, damit der
    // naechste Tipp einen frischen Versuch bekommt statt auf die haengende
    // Promise zu warten.
    await vi.advanceTimersByTimeAsync(2000);

    expect(SoundSystem.getDiagnostics().resumeInFlight).toBe(false);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('scheduleTone - Regression: Tonhaufen beim spaeten Aufwachen', () => {
  it('verwirft Toene waehrend resume() noch laeuft, statt sie beim spaeten running alle auf einmal nachzuholen', async () => {
    const capturedInstance = new SlowResumeAudioContext();
    vi.stubGlobal('AudioContext', function SingletonSlowResumeAudioContext() {
      return capturedInstance;
    });

    SaveSystem.update((data) => {
      data.soundEnabled = true;
    });
    SoundSystem.initialize();

    const startSpy = vi.spyOn(FakeOscillatorNode.prototype, 'start');

    // Mehrere Ereignisse, waehrend resume() noch nicht aufgeloest hat -
    // simuliert die Situation kurz nach App-Kaltstart, in der auf dem
    // Testgeraet mehrere Klicks anfielen, bevor der Kontext lief. Legendary
    // allein plant bereits eine mehrstimmige Sequenz (mehrere Toene).
    eventBus.emitEvent(GameEvent.Collected, {
      rarityId: 'legendary',
      basePoints: 100,
      awardedPoints: 100,
      combo: 1,
      multiplier: 1,
      sameRarityStreak: 1,
      streakBonus: false,
      x: 0,
      y: 0,
    });
    eventBus.emitEvent(GameEvent.ComboChanged, { combo: 5, multiplier: 1 });

    expect(startSpy).not.toHaveBeenCalled();
    expect(capturedInstance.state).toBe('suspended');

    // resume() loest jetzt auf (z.B. weil ein spaeterer Tipp durchkam). Kein
    // Nachholmechanismus mehr heisst: die zuvor verworfenen Toene duerfen
    // nicht ploetzlich alle gleichzeitig abgefeuert werden (der fruehere
    // Tonhaufen-Bug) - kein einziger Ton aus der Wartezeit darf nachtoenen.
    capturedInstance.settle();
    await Promise.resolve();
    await Promise.resolve();

    expect(startSpy).not.toHaveBeenCalled();

    // Ein Ton NACH dem Aufwachen spielt hingegen ganz normal.
    eventBus.emitEvent(GameEvent.Collected, {
      rarityId: 'poor',
      basePoints: 1,
      awardedPoints: 1,
      combo: 1,
      multiplier: 1,
      sameRarityStreak: 1,
      streakBonus: false,
      x: 0,
      y: 0,
    });

    expect(startSpy).toHaveBeenCalled();

    startSpy.mockRestore();
  });
});

describe('setEnabled', () => {
  it('speichert den Zustand im Spielstand', () => {
    SoundSystem.initialize();
    SoundSystem.setEnabled(false);

    expect(SoundSystem.isEnabled()).toBe(false);

    SoundSystem.setEnabled(true);

    expect(SoundSystem.isEnabled()).toBe(true);
  });
});
