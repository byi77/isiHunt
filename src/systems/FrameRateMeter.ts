/**
 * Bildrate fuer die Anzeige im Run - gemessen auf dem Geraet, das spielt.
 *
 * Desktop-Messungen trennten die Effektkosten nicht: Auf einer RTX 5080 lagen
 * alle Stufen bei 1,3 bis 1,7 ms Renderzeit, in SwiftShader ausserhalb des
 * messbaren Abschnitts (Messung 28.10.2026). Was auf einem iPhone ruckelt,
 * zeigt nur das iPhone selbst.
 *
 * Reine Rechnung ohne Phaser: `HudScene` fuettert je Frame `rawDelta` ein und
 * zeigt das Ergebnis, sobald ein Fenster voll ist.
 */

import { FRAME_RATE_METER } from '@/config/effectQuality';

export interface FrameRateReading {
  /** Bilder pro Sekunde im letzten Fenster, gerundet. */
  fps: number;
  /** Laengster Frame im Fenster in Millisekunden, gerundet. */
  worstMs: number;
  /**
   * Anteil der Frames, die mehr als 1,5-mal so lang wie der Median dauerten.
   * Das ist, was man als Ruckeln sieht - auch bei hoher Durchschnittsrate.
   */
  hitchShare: number;
}

export class FrameRateMeter {
  private deltas: number[] = [];
  private elapsed = 0;

  constructor(private readonly limits: typeof FRAME_RATE_METER = FRAME_RATE_METER) {}

  /** @returns eine Messung, sobald ein Fenster voll ist, sonst `null`. */
  sample(deltaMs: number): FrameRateReading | null {
    if (!Number.isFinite(deltaMs) || !(deltaMs > 0)) return null;
    this.deltas.push(deltaMs);
    this.elapsed += deltaMs;
    if (this.elapsed < this.limits.windowMs) return null;
    const reading = summarize(this.deltas, this.elapsed, this.limits.hitchFactor);
    this.deltas = [];
    this.elapsed = 0;
    return reading;
  }
}

function summarize(
  deltas: readonly number[],
  elapsed: number,
  hitchFactor: number,
): FrameRateReading {
  const sorted = [...deltas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const hitches = deltas.filter((delta) => delta > median * hitchFactor).length;
  return {
    fps: Math.round((deltas.length * 1000) / elapsed),
    worstMs: Math.round(sorted[sorted.length - 1]!),
    hitchShare: hitches / deltas.length,
  };
}
