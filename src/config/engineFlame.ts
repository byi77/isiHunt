/**
 * Triebwerksflamme des Schiffs - nur Darstellung.
 *
 * Vorher war die Flamme ein gestreckter, weicher Fleck, der mit dem Tempo
 * laenger wurde. Sie las sich als Licht, nicht als Schub. Die Flamme hat jetzt
 * Schichten wie ein echtes Triebwerk: Hitzeschein, Aussenflamme in der
 * Weltfarbe, weissheisse Innenflamme, Duesenkern und bei voller Fahrt
 * Schockdiamanten. Beim Anfahren schiesst sie kurz ueber (Nachbrenner).
 *
 * Laengen und Breiten in Spielpixeln, bezogen auf die Grundgroesse des Rumpfs.
 */
export const ENGINE_FLAME = {
  /** Farbe ausserhalb einer Welt (Menue-Vorschauen, vor `setWorldStyle`). */
  defaultColor: 0x8edcff,
  /** Anteil Weiss in der Innenflamme - heisser als die Aussenflamme. */
  innerWhite: 0.6,

  outerWidth: { idle: 22, full: 36 },
  outerLength: { idle: 54, full: 110 },
  innerWidth: { idle: 11, full: 17 },
  innerLength: { idle: 30, full: 64 },
  heatSize: { idle: 44, full: 84 },
  heatAlpha: { idle: 0.28, full: 0.5 },
  coreSize: 14,

  /** Relative Schwankung von Laenge und Breite durch das Flackern. */
  flicker: 0.14,
  /** Grundfrequenz des Flackerns in Hertz. */
  flickerHz: 11,

  /** Ab diesem Schubanteil erscheinen Schockdiamanten. */
  diamondThrust: 0.55,
  diamondCount: 3,
  diamondSize: 10,

  /** Wie stark ein Schubanstieg die Flamme ueberschiessen laesst (Laengenfaktor). */
  boostGain: 0.9,
  /** Abklingzeit des Nachbrenners in Sekunden. */
  boostDecay: 0.35,
  /** Hoechstes Ueberschiessen als Laengenfaktor. */
  boostMax: 0.7,
} as const;
