import {
  AUDIO_BASE_PATH,
  COUNTDOWN_VOICE,
  MISSED_SOUND_RARITIES,
  SAMPLES,
  WORLD_SELECT_SEMITONES,
  type SampleId,
} from '@/config/audio';

import type { SoundEvent, SoundEventPayload, SoundModule, SoundModuleContext } from './SoundModule';

/** Ein abzuspielender Klang: welche Datei, wie weit hochgestimmt. */
export interface SampleCue {
  readonly id: SampleId;
  readonly semitones: number;
}

const COMBO_SAMPLES: readonly SampleId[] = ['combo-1', 'combo-2', 'combo-3', 'combo-4', 'combo-5'];

function isSampleId(id: string): id is SampleId {
  return Object.prototype.hasOwnProperty.call(SAMPLES, id);
}

/**
 * Ereignis -> Klaenge, ohne Wiedergabe. Reine Rechnung, damit die Zuordnung
 * testbar ist, ohne einen AudioContext nachzubauen.
 *
 * Eine leere Liste heisst "dieses Ereignis hat hier keinen Klang" - etwa ein
 * verpasstes graues Relikt oder Countdown-Stufe 5 im Online-Duell.
 */
export function resolveSamples(event: SoundEvent, payload: SoundEventPayload = {}): SampleCue[] {
  const cue = (id: SampleId, semitones = 0): SampleCue[] => [{ id, semitones }];

  switch (event) {
    case 'ui.click':
      return cue('ui-tap');
    case 'ui.back':
      return cue('ui-back');
    case 'ui.toggle':
      return cue(payload.toggleOn === false ? 'toggle-off' : 'toggle-on');
    case 'world.select': {
      const variant = Math.max(0, payload.spaceVariant ?? 0);
      const semitones =
        WORLD_SELECT_SEMITONES[Math.min(variant, WORLD_SELECT_SEMITONES.length - 1)] ?? 0;
      return [
        { id: 'world-whoosh', semitones: 0 },
        { id: 'world-bell', semitones },
      ];
    }
    case 'collect': {
      const id = `collect-${payload.rarityId ?? ''}`;
      return isSampleId(id) ? cue(id) : [];
    }
    case 'collect.missed':
      return MISSED_SOUND_RARITIES.includes(payload.rarityId ?? '') ? cue('missed') : [];
    case 'combo.tier': {
      const tier = payload.comboTier ?? 0;
      if (tier < 1) return [];
      return cue(COMBO_SAMPLES[Math.min(tier, COMBO_SAMPLES.length) - 1]!);
    }
    case 'countdown': {
      const id = COUNTDOWN_VOICE[payload.countdownStep ?? -1];
      return id ? cue(id) : [];
    }
    case 'run.end':
      return cue((payload.levelsGained ?? 0) > 0 ? 'run-end-levelup' : 'run-end');
    case 'run.pause':
      return cue('pause');
    case 'run.resume':
      return cue('resume');
    case 'obstacle.hit':
      return cue(payload.obstacleKind === 'penalty' ? 'obstacle-penalty' : 'obstacle-brake');
    case 'duel.opponent-left':
      return cue('opponent-left');
    case 'achievement':
      return cue('achievement');
  }
}

/**
 * Spielt die vorgerenderten Klaenge aus `public/assets/audio/`.
 *
 * Die Dateien werden erst geladen, wenn ein AudioContext existiert
 * (`preload()` nach dem ersten Entsperren). Fehlt ein Klang noch, liefert
 * `play()` false, und SoundSystem spielt den prozeduralen Fallback - ein
 * langsames Netz kann so nie einen Tipp oder den Spielstart blockieren.
 */
export class SampleBank implements SoundModule {
  readonly id = 'sample-bank';

  private context: SoundModuleContext | null = null;
  private readonly buffers = new Map<SampleId, AudioBuffer>();
  private readonly loading = new Map<SampleId, Promise<void>>();

  initialize(context: SoundModuleContext): void {
    this.context = context;
  }

  shutdown(): void {
    this.context = null;
    this.buffers.clear();
    this.loading.clear();
  }

  handles(_event: SoundEvent): boolean {
    return true;
  }

  preload(): void {
    const audioContext = this.context?.getAudioContext();
    if (!audioContext) return;
    for (const id of Object.keys(SAMPLES) as SampleId[]) this.load(audioContext, id);
  }

  play(event: SoundEvent, payload?: SoundEventPayload): boolean {
    if (this.context === null || !this.context.isEnabled()) return false;

    const audioContext = this.context.getAudioContext();
    if (audioContext === null || audioContext.state !== 'running') return false;

    const cues = resolveSamples(event, payload);
    if (cues.length === 0) return false;

    // Alles oder nichts: ein halb geladener Mehrschicht-Klang klingt kaputt,
    // dann lieber der vollstaendige Fallback.
    const missing = cues.filter((cue) => !this.buffers.has(cue.id));
    if (missing.length > 0) {
      for (const cue of missing) this.load(audioContext, cue.id);
      return false;
    }

    const output = this.context.getOutput() ?? audioContext.destination;
    try {
      for (const cue of cues) {
        const spec = SAMPLES[cue.id];
        const jitter = spec.pitchJitter ? (Math.random() * 2 - 1) * spec.pitchJitter : 0;
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        source.buffer = this.buffers.get(cue.id)!;
        source.playbackRate.value = 2 ** ((cue.semitones + jitter) / 12);
        gain.gain.value = spec.volume;
        source.connect(gain);
        gain.connect(output);
        source.start(audioContext.currentTime + (spec.delay ?? 0));
      }
      return true;
    } catch {
      return false;
    }
  }

  private load(audioContext: AudioContext, id: SampleId): void {
    if (this.buffers.has(id) || this.loading.has(id) || typeof fetch !== 'function') return;

    const attempt = fetch(`${AUDIO_BASE_PATH}${SAMPLES[id].file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Klang ${id} nicht geladen (${response.status})`);
        return response.arrayBuffer();
      })
      .then((data) => audioContext.decodeAudioData(data))
      .then((buffer) => {
        // Ein zwischenzeitliches shutdown() hat die Bank geleert - dann nicht
        // wieder befuellen, sonst haelt eine tote Instanz Puffer fest.
        if (this.context !== null) this.buffers.set(id, buffer);
      })
      .catch(() => undefined)
      .finally(() => {
        // Auch nach einem Fehler freigeben: ein spaeterer Versuch darf erneut
        // laden, falls es nur ein kurzer Netz- oder Safari-Fehler war.
        this.loading.delete(id);
      });
    this.loading.set(id, attempt);
  }
}
