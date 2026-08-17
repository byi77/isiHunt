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

// Auf iOS bleibt der allererste `resume()`-Aufruf nach einem Kaltstart
// manchmal dauerhaft in der Warteschleife haengen - kein resolve, kein
// reject (beobachtet und reproduziert auf dem Testgeraet: Diagnose zeigte
// "resume() laeuft: ja" auf unbestimmte Zeit, obwohl der Kontext danach
// ueber einen zeitversetzten zweiten Tipp doch noch aufwachte). Ohne
// Zeitlimit wuerde `if (resumePromise) return resumePromise;` in
// resumeAudioContext() jeden weiteren Tipp fuer immer an dieselbe tote
// Promise binden, statt einen frischen Versuch zu starten.
const RESUME_TIMEOUT_MS = 1200;

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

  const attempt = context
    .resume()
    .then(() => context.state === 'running')
    .catch(() => {
      if (context.state === 'closed') audioContext = null;
      return false;
    });

  // Haengt `attempt` laenger als das Zeitlimit, gibt der Timeout `false`
  // zurueck und setzt `resumePromise` frei - der naechste Tipp bekommt dann
  // einen frischen `resume()`-Versuch statt auf dieselbe tote Promise zu
  // warten. `attempt` selbst laeuft im Hintergrund weiter; loest sie doch
  // noch auf, erkennt der `statechange`-Listener auf dem Kontext das.
  const timeout = new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(false), RESUME_TIMEOUT_MS);
  });

  resumePromise = Promise.race([attempt, timeout]);
  resumePromise.finally(() => {
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

// Als benannte, modulweite Referenzen statt Inline-Arrow-Functions - nur so
// ist die Funktionsreferenz bei `offEvent` dieselbe wie bei `onEvent`
// (CODE_STYLE.md 1.4, dasselbe Muster wie GameScene/HudScene).
const onCollected: (payload: { rarityId: RarityId }) => void = ({ rarityId }) =>
  playCollected(rarityId);
const onComboChanged: (payload: { combo: number }) => void = ({ combo }) => playComboTier(combo);
const onRunStarted = (): void => playRunStarted();
const onRunEnded: (payload: { progression: { levelsGained: number } }) => void = ({
  progression,
}) => playRunEnded(progression.levelsGained);
const onVisibilityChange = (): void => {
  if (document.visibilityState === 'hidden') {
    // Keine alten Fang-Töne nach dem Zurückkehren aus App-Wechsel oder
    // Sperrbildschirm nachspielen. iOS unterbricht dort den AudioContext.
    pendingTones.length = 0;
    if (audioContext?.state === 'running') {
      void audioContext.suspend().catch(() => undefined);
    }
    return;
  }

  // Auf Android/Desktop reicht `resume()` ohne Nutzergeste - dort soll der
  // Kontext direkt bei Rueckkehr wieder laufen, statt auf den naechsten Tipp
  // zu warten. iOS lehnt das hier ab; dort greift `unlock()` beim naechsten
  // pointerdown/click.
  unlock();
};

function registerEventListeners(): void {
  eventBus.onEvent(GameEvent.Collected, onCollected);
  eventBus.onEvent(GameEvent.ComboChanged, onComboChanged);
  eventBus.onEvent(GameEvent.RunStarted, onRunStarted);
  eventBus.onEvent(GameEvent.RunEnded, onRunEnded);
}

function unregisterEventListeners(): void {
  eventBus.offEvent(GameEvent.Collected, onCollected);
  eventBus.offEvent(GameEvent.ComboChanged, onComboChanged);
  eventBus.offEvent(GameEvent.RunStarted, onRunStarted);
  eventBus.offEvent(GameEvent.RunEnded, onRunEnded);
}

/**
 * Meldet die EventBus-Listener ab und entfernt die globalen DOM-Listener.
 *
 * `SoundSystem` ist kein Scene-Objekt und hat deshalb keinen SHUTDOWN-Handler
 * im Sinne von CODE_STYLE.md 1.4 - `initialize()` ruft diese Funktion selbst
 * auf, falls sie aus einem vorherigen Aufruf noch aussteht, damit Listener
 * nie doppelt registriert werden koennen.
 */
export function shutdown(): void {
  if (!initialized) return;
  initialized = false;

  unregisterEventListeners();
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('click', unlock, true);
  window.removeEventListener('touchstart', unlock, true);
  window.removeEventListener('touchend', unlock, true);
  window.removeEventListener('keydown', unlock, true);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

/** Einmalig beim App-Start aufrufen. Die Listener bleiben ueber Scenes hinweg. */
export function initialize(): void {
  if (initialized) shutdown();
  initialized = true;

  registerEventListeners();
  window.addEventListener('pointerdown', unlock, true);
  // `click` feuert erst nach einem vollstaendigen Tap-Zyklus und zaehlt auf
  // iOS Safari zuverlaessiger als `pointerdown` allein als echte
  // Nutzergeste fuer `resume()` (docs/ARCHITECTURE.md 10 - Tonwiedergabe).
  window.addEventListener('click', unlock, true);
  // Fallback für ältere Touch-WebViews ohne Pointer Events.
  if (!window.PointerEvent) {
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('touchend', unlock, true);
  }
  window.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

export interface SoundDiagnostics {
  readonly hasAudioContextApi: boolean;
  readonly contextExists: boolean;
  readonly contextState: string;
  readonly sampleRate: number | null;
  readonly baseLatency: number | null;
  readonly pendingTones: number;
  readonly resumeInFlight: boolean;
  readonly soundEnabled: boolean;
}

/**
 * Momentaufnahme des internen Zustands fuer den Wartungsbildschirm.
 *
 * Ohne Mac/Safari-Devtools ist der `AudioContext.state` auf dem Handy sonst
 * nicht einsehbar - genau diese Blindheit hat mehrere frühere Fixversuche zu
 * Rateversuchen gemacht statt zu geprueften Aenderungen (No-Guess-Vertrag,
 * CODE_STYLE.md Regel 8).
 */
export function getDiagnostics(): SoundDiagnostics {
  const AudioContextConstructor =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;

  return {
    hasAudioContextApi: !!AudioContextConstructor,
    contextExists: audioContext !== null,
    contextState: audioContext?.state ?? 'kein Kontext',
    sampleRate: audioContext?.sampleRate ?? null,
    baseLatency: audioContext?.baseLatency ?? null,
    pendingTones: pendingTones.length,
    resumeInFlight: resumePromise !== null,
    soundEnabled: soundEnabled(),
  };
}

/** Testton fuer den Wartungsbildschirm - unabhaengig von SaveSystem.soundEnabled. */
export function playDiagnosticTone(): void {
  const context = getAudioContext();
  if (!context) return;

  primeAudioContext(context);
  void resumeAudioContext().then(() => {
    playTone(context, { frequency: 660, duration: 0.15, type: 'triangle', volume: 0.08 });
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
