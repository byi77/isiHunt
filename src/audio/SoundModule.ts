/**
 * Austauschvertrag fuer Audio-Provider.
 *
 * Die Spielereignisse bleiben stabil, waehrend die Wiedergabe dahinter
 * gewechselt werden kann: prozedural, aus Samples oder als Hybrid. Ein Modul
 * darf ein Ereignis ablehnen; dann faellt die Kette auf den naechsten Provider
 * zurueck. So bleibt ein fehlendes oder spaet ladendes Asset lautlos bzw.
 * prozedural spielbar und blockiert nie den Run.
 */

export type SoundEvent =
  | 'ui.click'
  | 'ui.back'
  | 'ui.toggle'
  | 'world.select'
  | 'collect'
  | 'collect.missed'
  | 'combo.tier'
  | 'countdown'
  | 'run.end'
  | 'run.pause'
  | 'run.resume'
  | 'obstacle.hit'
  | 'duel.opponent-left'
  | 'achievement';

export interface SoundEventPayload {
  readonly rarityId?: string;
  readonly spaceVariant?: number;
  /** 1-basierte Combo-Stufe (Index in COMBO_TIERS). */
  readonly comboTier?: number;
  readonly levelsGained?: number;
  readonly obstacleKind?: 'brake' | 'penalty';
  /** 3, 2, 1 - und 0 fuer "Los geht's!". */
  readonly countdownStep?: number;
  readonly toggleOn?: boolean;
}

export interface SoundModuleContext {
  readonly isEnabled: () => boolean;
  readonly getAudioContext: () => AudioContext | null;
  /**
   * Summenbus (Kompressor), an den jeder Provider anschliesst - nicht direkt
   * an `destination`, sonst uebersteuern gleichzeitige Klaenge.
   */
  readonly getOutput: () => AudioNode | null;
}

export interface SoundModule {
  readonly id: string;
  /** Wird einmal beim SoundSystem-Start aufgerufen. */
  initialize(context: SoundModuleContext): void;
  /** Gibt Ressourcen frei, wenn der Provider entfernt oder beendet wird. */
  shutdown(): void;
  /** Schneller Filter, damit ein Provider nur passende Ereignisse prueft. */
  handles(event: SoundEvent): boolean;
  /** true = abgespielt; false = naechster Provider darf uebernehmen. */
  play(event: SoundEvent, payload?: SoundEventPayload): boolean;
  /**
   * Laedt Assets vorab, sobald der AudioContext laeuft. Ohne das kaeme der
   * erste Countdown eines Runs nach Kaltstart stumm, weil die Stimme erst
   * beim ersten Abspielversuch geladen wuerde.
   */
  preload?(): void;
}

/** Priorisierte Kette fuer austauschbare Soundmodule. */
export class SoundModuleChain {
  private modules: SoundModule[] = [];
  private readonly priorities = new Map<string, number>();
  private context: SoundModuleContext | null = null;

  register(module: SoundModule, priority = 0): void {
    this.unregister(module.id);
    this.priorities.set(module.id, priority);
    this.modules.push(module);
    this.modules.sort(
      (a, b) => (this.priorities.get(b.id) ?? 0) - (this.priorities.get(a.id) ?? 0),
    );
    if (this.context !== null) module.initialize(this.context);
  }

  unregister(id: string): void {
    const existing = this.modules.find((module) => module.id === id);
    if (!existing) return;
    existing.shutdown();
    this.modules = this.modules.filter((module) => module.id !== id);
    this.priorities.delete(id);
  }

  initialize(context: SoundModuleContext): void {
    this.context = context;
    for (const module of this.modules) module.initialize(context);
  }

  shutdown(): void {
    for (const module of this.modules) module.shutdown();
    this.context = null;
  }

  play(event: SoundEvent, payload?: SoundEventPayload): boolean {
    for (const module of this.modules) {
      if (!module.handles(event)) continue;
      try {
        if (module.play(event, payload)) return true;
      } catch {
        // Ein defektes Austauschmodul darf den naechsten Fallback nicht
        // verhindern. Der Provider wird beim naechsten Ereignis erneut
        // versucht, damit ein temporaerer Browserfehler sich erholen kann.
      }
    }
    return false;
  }

  preload(): void {
    for (const module of this.modules) {
      try {
        module.preload?.();
      } catch {
        // Ein fehlgeschlagenes Vorladen ist kein Fehler: play() laedt spaeter nach.
      }
    }
  }

  ids(): readonly string[] {
    return this.modules.map((module) => module.id);
  }
}
