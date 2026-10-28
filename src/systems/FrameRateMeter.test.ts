import { describe, expect, it } from 'vitest';
import { FrameRateMeter } from '@/systems/FrameRateMeter';

function feed(meter: FrameRateMeter, deltas: readonly number[]) {
  let last = null;
  for (const delta of deltas) last = meter.sample(delta) ?? last;
  return last;
}

describe('FrameRateMeter', () => {
  it('meldet erst, wenn ein Fenster voll ist', () => {
    const meter = new FrameRateMeter();
    expect(meter.sample(500)).toBeNull();
    expect(meter.sample(500)).not.toBeNull();
  });

  it('erkennt 120 Bilder pro Sekunde ohne Ruckler', () => {
    const reading = feed(new FrameRateMeter(), Array(120).fill(1000 / 120));
    expect(reading).toEqual({ fps: 120, worstMs: 8, hitchShare: 0 });
  });

  it('zaehlt einzelne lange Frames als Ruckler, auch bei hoher Rate', () => {
    const deltas = [...Array(101).fill(8.33), ...Array(10).fill(16.67)];
    const reading = feed(new FrameRateMeter(), deltas)!;
    expect(reading.worstMs).toBe(17);
    expect(reading.hitchShare).toBeCloseTo(10 / 111);
  });

  it('ignoriert ungueltige Deltas', () => {
    const meter = new FrameRateMeter();
    expect(meter.sample(Number.NaN)).toBeNull();
    expect(meter.sample(0)).toBeNull();
    expect(meter.sample(-5)).toBeNull();
  });
});
