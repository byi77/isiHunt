/**
 * Prozedurales Audio-Feedback fuer isiHunt.
 *
 * Es werden keine Dateien geladen: kurze Oszillator-Toene sind sofort da,
 * klein im Bundle und lassen sich je Ereignis gezielt stimmen. iOS gibt den
 * AudioContext erst nach einer Nutzergeste frei; `initialize()` wartet deshalb
 * auf den ersten Tipp und entsperrt ihn dann automatisch.
 */

import { COMBO_TIERS } from '@/config/GameConfig';
import { eventBus, GameEvent } from '@/core/EventBus';
import type { RarityId } from '@/config/rarities';
import * as SaveSystem from '@/systems/SaveSystem';

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface ToneSpec {
  readonly frequency: number;
  readonly duration: number;
  readonly delay?: number;
  readonly type?: OscillatorType;
  readonly volume?: number;
}

let audioContext: AudioContext | null = null;
let initialized = false;
let resumePromise: Promise<boolean> | null = null;
const pendingTones: ToneSpec[] = [];
const MAX_PENDING_TONES = 12;

function soundEnabled(): boolean {
  return SaveSystem.load().soundEnabled;
}

function getAudioContext(): AudioContext | null {
  if (audioContext?.state === 'closed') {
    audioContext = null;
  }
  if (audioContext) return audioContext;

  const AudioContextConstructor =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    audioContext = new AudioContextConstructor();
    audioContext.addEventListener('statechange', () => {
      if (audioContext?.state === 'running') flushPendingTones(audioContext);
    });
    return audioContext;
  } catch {
    return null;
  }
}

function primeAudioContext(context: AudioContext): void {
  // iOS akzeptiert `resume()` allein nicht in jedem PWA-Zustand. Ein lautloser
  // Ein-Frame-Buffer innerhalb derselben Nutzergeste entsperrt den Ausgang
  // zusaetzlich und kostet praktisch keine Laufzeit.
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(0);
  } catch {
    // Ein blockierter oder bereits geschlossener Kontext bleibt lautlos.
  }
}

function resumeAudioContext(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return Promise.resolve(false);
  if (context.state === 'running') return Promise.resolve(true);
  if (context.state === 'closed') {
    audioContext = null;
    return Promise.resolve(false);
  }
  if (resumePromise) return resumePromise;

  // Manche Safari-Versionen brauchen den lautlosen Puffer direkt vor dem
  // resume()-Aufruf. Beides passiert innerhalb derselben Nutzergeste.
  primeAudioContext(context);
  resumePromise = context
    .resume()
    .then(() => context.state === 'running')
    .catch(() => {
      if (context.state === 'closed') audioContext = null;
      return false;
    })
    .finally(() => {
      resumePromise = null;
    });
  return resumePromise;
}

function playTone(context: AudioContext, spec: ToneSpec): void {
  try {
    const start = context.currentTime + (spec.delay ?? 0);
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const volume = spec.volume ?? 0.045;

    oscillator.type = spec.type ?? 'sine';
    oscillator.frequency.setValueAtTime(spec.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + spec.duration + 0.02);
  } catch {
    // Audio darf das Spiel niemals unterbrechen. Der naechste Tipp versucht
    // automatisch erneut, den Kontext zu aktivieren.
    if ((context as AudioContext).state === 'closed') audioContext = null;
  }
}

function flushPendingTones(context: AudioContext): void {
  if (!soundEnabled() || context.state !== 'running' || pendingTones.length === 0) return;

  const tones = pendingTones.splice(0, pendingTones.length);
  for (const tone of tones) playTone(context, tone);
}

function unlock(): void {
  if (!soundEnabled()) return;

  const context = getAudioContext();
  if (!context) return;

  void resumeAudioContext().then((ready) => {
    if (ready) flushPendingTones(context);
  });
}

function scheduleTone(spec: ToneSpec): void {
  if (!soundEnabled()) return;

  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'running') {
    playTone(context, spec);
    return;
  }

  if (pendingTones.length >= MAX_PENDING_TONES) pendingTones.shift();
  pendingTones.push(spec);
  // Nach einem App-Wechsel ist der Ton häufig selbst die erste Aktion nach
  // dem Zurückkehren. Deshalb jetzt direkt wieder aktivieren; lehnt iOS den
  // Versuch außerhalb einer Geste ab, bleibt der Ton bis zum nächsten Tipp
  // in der Queue und `unlock` versucht es erneut.
  void resumeAudioContext().then((ready) => {
    if (ready) flushPendingTones(context);
  });
}

function playSequence(specs: readonly ToneSpec[]): void {
  for (const spec of specs) scheduleTone(spec);
}

const RARITY_FREQUENCIES: Readonly<Record<RarityId, number>> = {
  poor: 280,
  common: 340,
  uncommon: 430,
  rare: 540,
  epic: 680,
  legendary: 860,
};

export function playUiClick(): void {
  scheduleTone({ frequency: 520, duration: 0.045, type: 'triangle', volume: 0.035 });
}

function playCollected(rarityId: RarityId): void {
  const frequency = RARITY_FREQUENCIES[rarityId];
  const epicTier =
    rarityId === 'legendary'
      ? 4
      : rarityId === 'epic'
        ? 3
        : rarityId === 'rare'
          ? 2
          : rarityId === 'uncommon'
            ? 1
            : 0;

  if (epicTier === 0) {
    scheduleTone({ frequency, duration: 0.09, type: 'sine', volume: 0.04 });
    return;
  }

  // Farbige Planeten bekommen einen musikalischen Klang statt eines einzelnen
  // Piepsers: Koerper unten, Quinte in der Mitte und ein heller Oberton. Je
  // seltener der Planet, desto laenger und groesser wird die kleine Fanfare.
  const root = frequency * (epicTier === 1 ? 0.82 : 0.7);
  const duration = 0.11 + epicTier * 0.025;
  const volume = 0.034 + epicTier * 0.004;
  const notes: ToneSpec[] = [
    { frequency: root, duration: duration + 0.1, type: 'sawtooth', volume: 0.018 },
    { frequency, duration, type: 'triangle', volume },
    {
      frequency: frequency * 1.5,
      duration: duration + 0.04,
      delay: 0.045,
      type: 'sine',
      volume: 0.032,
    },
  ];

  if (epicTier >= 2) {
    notes.push({
      frequency: frequency * 2,
      duration: duration + 0.08,
      delay: 0.1,
      type: 'triangle',
      volume: 0.028 + epicTier * 0.004,
    });
  }

  if (epicTier >= 3) {
    notes.push({
      frequency: frequency * 2.5,
      duration: 0.2,
      delay: 0.17,
      type: 'sine',
      volume: 0.025 + epicTier * 0.004,
    });
  }

  if (epicTier === 4) {
    notes.push(
      { frequency: frequency * 3, duration: 0.24, delay: 0.23, type: 'triangle', volume: 0.035 },
      { frequency: root * 0.5, duration: 0.3, type: 'sine', volume: 0.022 },
    );
  }

  playSequence(notes);
}

/** Kurzer, klarer Schritt beim Wechsel der Welt im Wheel-Carousel. */
export function playWorldSelect(spaceVariant: number): void {
  const root = 300 + Math.max(0, spaceVariant) * 42;
  playSequence([
    { frequency: root, duration: 0.055, type: 'triangle', volume: 0.026 },
    { frequency: root * 1.5, duration: 0.1, delay: 0.045, type: 'sine', volume: 0.032 },
  ]);
}

function playComboTier(combo: number): void {
  if (!COMBO_TIERS.some((tier) => tier.minCombo === combo) || combo === 0) return;

  const frequency = 620 + combo * 3;
  playSequence([
    { frequency, duration: 0.08, type: 'square', volume: 0.03 },
    { frequency: frequency * 1.25, duration: 0.12, delay: 0.07, type: 'triangle' },
  ]);
}

function playRunStarted(): void {
  playSequence([
    { frequency: 440, duration: 0.08, type: 'triangle', volume: 0.035 },
    { frequency: 660, duration: 0.14, delay: 0.08, type: 'triangle', volume: 0.04 },
  ]);
}

function playRunEnded(levelsGained: number): void {
  if (levelsGained > 0) {
    playSequence([
      { frequency: 523, duration: 0.1, type: 'triangle', volume: 0.04 },
      { frequency: 659, duration: 0.1, delay: 0.09, type: 'triangle', volume: 0.04 },
      { frequency: 784, duration: 0.2, delay: 0.18, type: 'triangle', volume: 0.05 },
    ]);
    return;
  }

  playSequence([
    { frequency: 392, duration: 0.1, type: 'sine', volume: 0.03 },
    { frequency: 330, duration: 0.16, delay: 0.1, type: 'sine', volume: 0.03 },
  ]);
}

function registerEventListeners(): void {
  eventBus.onEvent(GameEvent.Collected, ({ rarityId }) => playCollected(rarityId));
  eventBus.onEvent(GameEvent.ComboChanged, ({ combo }) => playComboTier(combo));
  eventBus.onEvent(GameEvent.RunStarted, () => playRunStarted());
  eventBus.onEvent(GameEvent.RunEnded, ({ progression }) => playRunEnded(progression.levelsGained));
}

/** Einmalig beim App-Start aufrufen. Die Listener bleiben ueber Scenes hinweg. */
export function initialize(): void {
  if (initialized) return;
  initialized = true;

  registerEventListeners();
  window.addEventListener('pointerdown', unlock, true);
  // Fallback für ältere Touch-WebViews ohne Pointer Events.
  if (!window.PointerEvent) window.addEventListener('touchstart', unlock, true);
  window.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    // Keine alten Fang-Töne nach dem Zurückkehren aus App-Wechsel oder
    // Sperrbildschirm nachspielen. iOS unterbricht dort den AudioContext.
    pendingTones.length = 0;
    if (audioContext?.state === 'running') {
      void audioContext.suspend().catch(() => undefined);
    }
  });
}

export function isEnabled(): boolean {
  return soundEnabled();
}

export function setEnabled(enabled: boolean): void {
  SaveSystem.update((data) => {
    data.soundEnabled = enabled;
  });

  if (!enabled) {
    pendingTones.length = 0;
    if (audioContext?.state === 'running') {
      void audioContext.suspend().catch(() => undefined);
    }
  } else if (enabled) {
    unlock();
    // Der Web-Audio-Ausgang folgt der iPhone-Hardwarelautstärke. Ein kurzer
    // Bestätigungston macht das Einschalten unmittelbar hörbar.
    scheduleTone({ frequency: 660, duration: 0.09, type: 'triangle', volume: 0.05 });
  }
}
