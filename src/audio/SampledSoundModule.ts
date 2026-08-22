import type { SoundEvent, SoundEventPayload, SoundModule, SoundModuleContext } from './SoundModule';

/**
 * Kleines CC0-Sample fuer UI-Klicks.
 *
 * Das Sample wird erst nach dem ersten echten AudioContext erzeugt und
 * dekodiert. Bis dahin liefert `play()` false und SoundSystem spielt den
 * vorhandenen prozeduralen Fallback. Ein langsames Netz kann dadurch nie den
 * ersten Button-Tap oder den Spielstart blockieren.
 */
export class SampledSoundModule implements SoundModule {
  readonly id = 'cc0-samples';

  private context: SoundModuleContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;

  initialize(context: SoundModuleContext): void {
    this.context = context;
  }

  shutdown(): void {
    this.context = null;
    this.buffer = null;
    this.loading = null;
  }

  handles(event: SoundEvent): boolean {
    return event === 'ui.click';
  }

  play(event: SoundEvent, _payload?: SoundEventPayload): boolean {
    if (event !== 'ui.click' || this.context === null || !this.context.isEnabled()) return false;

    const audioContext = this.context.getAudioContext();
    if (audioContext === null || audioContext.state !== 'running') return false;

    if (this.buffer === null) {
      this.beginLoad(audioContext);
      return false;
    }

    try {
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = this.buffer;
      gain.gain.value = 0.055;
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start(audioContext.currentTime);
      return true;
    } catch {
      return false;
    }
  }

  private beginLoad(audioContext: AudioContext): void {
    if (this.loading !== null || typeof fetch !== 'function') return;

    this.loading = fetch('./assets/audio/cc0-ui-click.wav')
      .then((response) => {
        if (!response.ok)
          throw new Error(`Sample konnte nicht geladen werden (${response.status})`);
        return response.arrayBuffer();
      })
      .then((data) => audioContext.decodeAudioData(data))
      .then((buffer) => {
        this.buffer = buffer;
      })
      .catch(() => {
        // Der Fallback bleibt aktiv. Ein spaeterer Klick darf erneut laden,
        // falls der Fehler nur ein kurzzeitiger Netz-/Safari-Fehler war.
        this.loading = null;
      });
  }
}
