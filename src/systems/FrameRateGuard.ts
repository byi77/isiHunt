import { FRAME_GUARD } from '@/config/effectQuality';

/**
 * Erkennt, ob ein Geraet die aktuelle Effektstufe dauerhaft nicht schafft.
 *
 * Reine Rechnung ohne Phaser: `GameScene` fuettert je Frame das `delta` ein,
 * der Waechter antwortet einmal mit `true`, wenn mehrere Messfenster in Folge
 * einen zu hohen Median hatten. Danach schweigt er fuer den Rest des Runs -
 * das Herabstufen wirkt erst in der naechsten Szene, und zweimal in einem Run
 * wuerde eine Stufe ueberspringen, die das Geraet vielleicht schafft.
 */
export class FrameRateGuard {
  private elapsed = 0;
  private window: number[] = [];
  private windowMs = 0;
  private slowInRow = 0;
  private fired = false;

  constructor(private readonly limits: typeof FRAME_GUARD = FRAME_GUARD) {}

  /** @returns `true` genau einmal, sobald herabgestuft werden sollte. */
  sample(deltaMs: number): boolean {
    if (this.fired || !(deltaMs > 0) || deltaMs > this.limits.ignoreFrameMs) return false;
    this.elapsed += deltaMs;
    if (this.elapsed <= this.limits.warmupMs) return false;
    this.window.push(deltaMs);
    this.windowMs += deltaMs;
    if (this.windowMs < this.limits.windowMs) return false;

    const slow = median(this.window) > this.limits.slowFrameMs;
    this.window = [];
    this.windowMs = 0;
    this.slowInRow = slow ? this.slowInRow + 1 : 0;
    if (this.slowInRow < this.limits.slowWindows) return false;
    this.fired = true;
    return true;
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}
