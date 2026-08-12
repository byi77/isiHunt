/**
 * Typisierter Event-Bus zwischen Scenes.
 *
 * Warum: GameScene (Simulation) und HudScene (Darstellung) laufen parallel und
 * duerfen sich nicht gegenseitig kennen. Statt `scene.get('Hud').setScore(...)`
 * feuert GameScene ein Event, HudScene hoert darauf. Das haelt die Simulation
 * frei von UI-Wissen und macht beide Seiten einzeln austauschbar.
 *
 * REGEL: Nur Daten ueber den Bus schicken, niemals GameObjects oder Scenes.
 */

import Phaser from 'phaser';

import type { RarityId } from '@/config/rarities';
import type { ProgressionResult, RunStats } from '@/types';

/** Alle Event-Namen an einer Stelle - keine String-Literale im Code verstreuen. */
export const GameEvent = {
  ScoreChanged: 'score:changed',
  ComboChanged: 'combo:changed',
  TimerChanged: 'timer:changed',
  Collected: 'run:collected',
  Missed: 'run:missed',
  RunStarted: 'run:started',
  RunEnded: 'run:ended',
  RunPaused: 'run:paused',
  RunResumed: 'run:resumed',
  /**
   * Bitte um Pause bzw. Fortsetzen - gesendet vom HUD, ausgefuehrt von der
   * GameScene. Die Trennung ist Absicht: Das HUD traegt den Knopf, kennt die
   * Simulation aber nicht (ADR-0003). `RunPaused`/`RunResumed` melden danach,
   * was tatsaechlich passiert ist.
   */
  PauseRequested: 'run:pause-requested',
  /** Bitte, den Run abzubrechen. Ebenfalls vom HUD ausgeloest. */
  AbortRequested: 'run:abort-requested',
} as const;

export interface GameEventPayloads {
  [GameEvent.ScoreChanged]: { score: number };
  [GameEvent.ComboChanged]: { combo: number; multiplier: number };
  [GameEvent.TimerChanged]: { remainingMs: number; totalMs: number };
  [GameEvent.Collected]: {
    rarityId: RarityId;
    basePoints: number;
    awardedPoints: number;
    combo: number;
    multiplier: number;
    x: number;
    y: number;
  };
  [GameEvent.Missed]: { rarityId: RarityId };
  [GameEvent.RunStarted]: { worldId: string; durationMs: number };
  [GameEvent.RunEnded]: { stats: RunStats; progression: ProgressionResult };
  [GameEvent.RunPaused]: undefined;
  [GameEvent.RunResumed]: undefined;
  [GameEvent.PauseRequested]: undefined;
  [GameEvent.AbortRequested]: undefined;
}

type EventName = keyof GameEventPayloads;

class TypedEventBus extends Phaser.Events.EventEmitter {
  emitEvent<K extends EventName>(event: K, payload: GameEventPayloads[K]): void {
    this.emit(event, payload);
  }

  onEvent<K extends EventName>(
    event: K,
    handler: (payload: GameEventPayloads[K]) => void,
    context?: unknown,
  ): this {
    return this.on(event, handler, context);
  }

  offEvent<K extends EventName>(
    event: K,
    handler?: (payload: GameEventPayloads[K]) => void,
    context?: unknown,
  ): this {
    return this.off(event, handler, context);
  }
}

/**
 * Singleton. Bewusst ein Modul-Singleton und kein Scene-Registry-Eintrag:
 * der Bus ueberlebt Scene-Wechsel, was fuer Run-uebergreifende Events noetig ist.
 *
 * ACHTUNG: Jede Scene, die `onEvent` benutzt, MUSS in ihrem `shutdown`-Handler
 * wieder abmelden - sonst laufen Listener nach einem Scene-Restart doppelt.
 */
export const eventBus = new TypedEventBus();
