/**
 * Reine Rechnung zum Warnrand der Schlussphase - ohne Phaser, damit sie sich
 * ausserhalb des Browsers pruefen laesst.
 */

import { FINAL_SECONDS } from '@/config/effectVisuals';

/** Deckkraft des Rands bei gegebener Restzeit. */
export function finalSecondsAlpha(remainingMs: number, reducedMotion: boolean): number {
  const f = FINAL_SECONDS;
  if (remainingMs <= 0 || remainingMs > f.thresholdMs) return 0;
  if (reducedMotion) return f.baseAlpha;
  // Anteil der laufenden Sekunde, der schon vergangen ist: 0 genau beim
  // Sekundenwechsel (Schlag auf der Spitze), gegen 1 kurz vor dem naechsten.
  const sincePulse = 1 - (remainingMs % 1000) / 1000;
  const beat = Math.pow(1 - sincePulse, f.decayPower);
  return f.baseAlpha + f.pulseAlpha * beat;
}
