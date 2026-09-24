/**
 * Klangdaten: welche Datei zu welchem Ereignis gehoert und wie laut sie ist.
 *
 * Die Dateien entstehen mit `node scripts/render-sfx.mjs` (Effekte) bzw.
 * `--voice` (Countdown-Stimme). Die Lautstaerken sind ein erster Stand vom
 * Schreibtisch und werden auf dem Geraet nachgestimmt - dafuer liegen sie hier
 * und nicht im Modul.
 */

export type SampleId =
  | 'ui-tap'
  | 'ui-back'
  | 'toggle-on'
  | 'toggle-off'
  | 'world-whoosh'
  | 'world-bell'
  | 'collect-poor'
  | 'collect-common'
  | 'collect-uncommon'
  | 'collect-rare'
  | 'collect-epic'
  | 'collect-legendary'
  | 'combo-1'
  | 'combo-2'
  | 'combo-3'
  | 'combo-4'
  | 'combo-5'
  | 'obstacle-brake'
  | 'obstacle-penalty'
  | 'run-end-levelup'
  | 'run-end'
  | 'missed'
  | 'pause'
  | 'resume'
  | 'opponent-left'
  | 'achievement'
  | 'voice-3'
  | 'voice-2'
  | 'voice-1'
  | 'voice-go';

export interface SampleSpec {
  readonly file: string;
  /** Lineare Verstaerkung vor dem Summenbus. */
  readonly volume: number;
  /**
   * Zufaellige Tonhoehen-Streuung in Halbtoenen (+-). Gegen den
   * Maschinengewehr-Effekt, wenn derselbe Klang schnell hintereinander faellt.
   */
  readonly pitchJitter?: number;
  /** Verzoegerung ab Ausloesung in Sekunden. */
  readonly delay?: number;
}

export const AUDIO_BASE_PATH = './assets/audio/';

export const SAMPLES: Readonly<Record<SampleId, SampleSpec>> = {
  'ui-tap': { file: 'sfx-ui-tap.wav', volume: 0.35 },
  'ui-back': { file: 'sfx-ui-back.wav', volume: 0.35 },
  'toggle-on': { file: 'sfx-toggle-on.wav', volume: 0.3 },
  'toggle-off': { file: 'sfx-toggle-off.wav', volume: 0.3 },
  'world-whoosh': { file: 'sfx-world-whoosh.wav', volume: 0.25 },
  'world-bell': { file: 'sfx-world-bell.wav', volume: 0.35 },
  'collect-poor': { file: 'sfx-collect-poor.wav', volume: 0.3, pitchJitter: 0.5 },
  'collect-common': { file: 'sfx-collect-common.wav', volume: 0.35, pitchJitter: 0.5 },
  'collect-uncommon': { file: 'sfx-collect-uncommon.wav', volume: 0.4 },
  'collect-rare': { file: 'sfx-collect-rare.wav', volume: 0.45 },
  'collect-epic': { file: 'sfx-collect-epic.wav', volume: 0.5 },
  'collect-legendary': { file: 'sfx-collect-legendary.wav', volume: 0.6 },
  'combo-1': { file: 'sfx-combo-1.wav', volume: 0.35 },
  'combo-2': { file: 'sfx-combo-2.wav', volume: 0.37 },
  'combo-3': { file: 'sfx-combo-3.wav', volume: 0.4 },
  'combo-4': { file: 'sfx-combo-4.wav', volume: 0.42 },
  'combo-5': { file: 'sfx-combo-5.wav', volume: 0.45 },
  'obstacle-brake': { file: 'sfx-obstacle-brake.wav', volume: 0.45 },
  'obstacle-penalty': { file: 'sfx-obstacle-penalty.wav', volume: 0.45 },
  'run-end-levelup': { file: 'sfx-run-end-levelup.wav', volume: 0.55 },
  'run-end': { file: 'sfx-run-end.wav', volume: 0.45 },
  missed: { file: 'sfx-missed.wav', volume: 0.2 },
  pause: { file: 'sfx-pause.wav', volume: 0.3 },
  resume: { file: 'sfx-resume.wav', volume: 0.3 },
  'opponent-left': { file: 'sfx-opponent-left.wav', volume: 0.35 },
  // Folgt auf den Run-Ende-Klang, statt ihn zu ueberdecken.
  achievement: { file: 'sfx-achievement.wav', volume: 0.45, delay: 1.2 },
  'voice-3': { file: 'voice-3.wav', volume: 0.8 },
  'voice-2': { file: 'voice-2.wav', volume: 0.8 },
  'voice-1': { file: 'voice-1.wav', volume: 0.8 },
  'voice-go': { file: 'voice-go.wav', volume: 0.85 },
};

/** Countdown-Stufe (3, 2, 1; 0 = "Los geht's!") -> Stimmclip. */
export const COUNTDOWN_VOICE: Readonly<Record<number, SampleId>> = {
  3: 'voice-3',
  2: 'voice-2',
  1: 'voice-1',
  0: 'voice-go',
};

/**
 * Halbtonversatz der Weltwechsel-Glocke je `spaceVariant` - C-Dur-Pentatonik,
 * damit jeder Wechsel zum vorigen passt. Varianten jenseits der Liste nehmen
 * den letzten Eintrag.
 */
export const WORLD_SELECT_SEMITONES: readonly number[] = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

/** Nur ab dieser Seltenheit ist ein verpasstes Relikt hoerbar - sonst nervt es. */
export const MISSED_SOUND_RARITIES: readonly string[] = ['rare', 'epic', 'legendary'];

/**
 * Summenbus: ein Kompressor faengt Spitzen ab, wenn Legendaer, Combo und
 * Stimme gleichzeitig fallen - vorher hing jeder Ton direkt am Ausgang.
 */
export const MASTER_VOLUME = 0.8;
export const MASTER_COMPRESSOR = {
  threshold: -14,
  knee: 12,
  ratio: 6,
  attack: 0.003,
  release: 0.2,
} as const;
