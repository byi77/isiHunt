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

function soundEnabled(): boolean {
  return SaveSystem.load().soundEnabled;
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;

  const AudioContextConstructor =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    audioContext = new AudioContextConstructor();
    return audioContext;
  } catch {
    return null;
  }
}

function unlock(): void {
  if (!soundEnabled()) return;

  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  if (context.state === 'running') {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  }
}

function scheduleTone(spec: ToneSpec): void {
  if (!soundEnabled()) return;

  const context = getAudioContext();
  if (!context) return;

  const play = (): void => {
    if (!soundEnabled()) return;

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
  };

  if (context.state === 'running') {
    play();
    return;
  }

  void context
    .resume()
    .then(play)
    .catch(() => undefined);
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
  const isRare = rarityId === 'rare' || rarityId === 'epic' || rarityId === 'legendary';

  playSequence([
    { frequency, duration: 0.09, type: isRare ? 'triangle' : 'sine', volume: 0.04 },
    ...(isRare
      ? [{ frequency: frequency * 1.5, duration: 0.13, delay: 0.06, type: 'sine' as const }]
      : []),
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
  window.addEventListener('keydown', unlock, true);
}

export function isEnabled(): boolean {
  return soundEnabled();
}

export function setEnabled(enabled: boolean): void {
  SaveSystem.update((data) => {
    data.soundEnabled = enabled;
  });

  if (!enabled && audioContext?.state === 'running') {
    void audioContext.suspend().catch(() => undefined);
  }
}
