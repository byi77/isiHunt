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
  ComboWindowChanged: 'combo:window-changed',
  TimerChanged: 'timer:changed',
  Collected: 'run:collected',
  Missed: 'run:missed',
  ObstacleHit: 'run:obstacle-hit',
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
  /**
   * Ein anderer Netzwerk-Duell-Spieler hat waehrend des laufenden Runs die
   * Verbindung verloren (Realtime-Presence-"leave"). Der lokale Run laeuft
   * trotzdem regulaer weiter.
   */
  OpponentDisconnected: 'duel:opponent-disconnected',
  /**
   * Zwischenstand eines anderen Netzwerk-Duell-Spielers waehrend des Runs.
   *
   * Geht ueber den EventBus statt direkt vom Kanal ins HUD, weil `systems/`
   * Phaser nicht kennt (Regel 6) und das HUD keine Netzwerkverbindung kennen
   * soll (ADR-0003, dieselbe Trennung wie beim Pause-Knopf). `GameScene`
   * uebersetzt: sie hoert am Kanal und sendet hier weiter.
   */
  OpponentLiveState: 'duel:opponent-live',
  /** Anzeigename des Netzwerk-Duell-Gegners ist bekannt oder hat sich geaendert. */
  OpponentNameChanged: 'duel:opponent-name',
} as const;

export interface GameEventPayloads {
  [GameEvent.ScoreChanged]: { score: number };
  [GameEvent.ComboChanged]: {
    combo: number;
    multiplier: number;
    /** Tempobonus der Serie als Faktor - 1 heisst keiner. Siehe SERIES_AGILITY_TIERS. */
    speedFactor: number;
  };
  /**
   * Der Rest des Serienfensters, jeden Frame.
   *
   * Eigenes Ereignis statt eines Felds an `ComboChanged`: Das Fenster laeuft
   * kontinuierlich leer, die Serie aendert sich nur beim Fang. Beides in ein
   * Ereignis zu legen hiesse, `ComboChanged` 60-mal je Sekunde zu feuern -
   * und jeder Empfaenger muesste die unveraenderte Serie erneut verarbeiten.
   */
  [GameEvent.ComboWindowChanged]: {
    /** 1 = gerade gefangen, 0 = Fenster zu. */
    ratio: number;
    /** Die Serie, die gerade auf dem Spiel steht. */
    combo: number;
  };
  [GameEvent.TimerChanged]: { remainingMs: number; totalMs: number };
  [GameEvent.Collected]: {
    rarityId: RarityId;
    basePoints: number;
    awardedPoints: number;
    combo: number;
    multiplier: number;
    sameRarityStreak: number;
    streakBonus: boolean;
    /**
     * XP aus diesem Fang, oder `undefined` ohne Einsicht-Talent.
     *
     * Das HUD summiert sie fuer die laufende Anzeige. Es rechnet sie
     * ausdruecklich nicht selbst aus - die Regel, wie viel ein Fang bringt,
     * gehoert in die Systeme (Regel 3), das HUD stellt nur dar.
     */
    xpGained?: number;
    /**
     * Der Fang war ein Gluecktreffer. Das HUD wirft darauf seinen
     * Schriftzug - reine Darstellung, die Punkte stecken schon in
     * `awardedPoints`.
     */
    crit: boolean;
    x: number;
    y: number;
  };
  [GameEvent.Missed]: { rarityId: RarityId };
  [GameEvent.ObstacleHit]: { kind: 'brake' | 'penalty' };
  [GameEvent.RunStarted]: { worldId: string; durationMs: number };
  [GameEvent.RunEnded]: { stats: RunStats; progression: ProgressionResult };
  /**
   * `reason` unterscheidet den Knopfdruck vom Geraeteereignis (Anruf,
   * Bildschirmsperre, App-Wechsel). Das HUD zeigt dafuer einen anderen Text:
   * Wer selbst pausiert hat, weiss warum - wer aus einem Anruf zurueckkommt,
   * nicht.
   */
  [GameEvent.RunPaused]: { reason: 'manual' | 'interrupted' };
  [GameEvent.RunResumed]: undefined;
  [GameEvent.PauseRequested]: undefined;
  [GameEvent.AbortRequested]: undefined;
  [GameEvent.OpponentDisconnected]: { playerIndex: number };
  /**
   * `activity` beschreibt, was der Gegner gerade tut - `away` heisst
   * "schaut nicht hin", nicht "angehalten": im Duell laeuft die Simulation
   * beim Pausieren weiter. `gone` entsteht lokal, wenn der Stand ausbleibt
   * (`ONLINE_DUEL_LIVE_STALE_MS`), und kommt nie ueber den Kanal - wer weg
   * ist, kann das nicht mehr selbst melden.
   */
  [GameEvent.OpponentLiveState]: {
    score: number;
    activity: 'playing' | 'away' | 'left' | 'finished' | 'gone';
    playerIndex: number;
  };
  [GameEvent.OpponentNameChanged]: { name: string; playerIndex?: number };
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
