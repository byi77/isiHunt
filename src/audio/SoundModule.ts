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
  'ui.click' | 'world.select' | 'collect' | 'combo.tier' | 'run.start' | 'run.end' | 'obstacle.hit';

export interface SoundEventPayload {
  readonly rarityId?: string;
  readonly spaceVariant?: number;
  readonly combo?: number;
  readonly levelsGained?: number;
  readonly obstacleKind?: 'brake' | 'penalty';
}

export interface SoundModuleContext {
  readonly isEnabled: () => boolean;
  readonly getAudioContext: () => AudioContext | null;
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

  ids(): readonly string[] {
    return this.modules.map((module) => module.id);
  }
}
