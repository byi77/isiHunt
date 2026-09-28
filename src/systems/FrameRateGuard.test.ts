import { describe, expect, it } from 'vitest';

import { FRAME_GUARD } from '@/config/effectQuality';
import { FrameRateGuard } from '@/systems/FrameRateGuard';

/** Fuettert `ms` Spielzeit in Frames der Laenge `frame` und meldet, ob der Waechter anschlug. */
function run(guard: FrameRateGuard, ms: number, frame: number): boolean {
  let fired = false;
  for (let t = 0; t < ms; t += frame) fired = guard.sample(frame) || fired;
  return fired;
}

const measuredMs = FRAME_GUARD.windowMs * FRAME_GUARD.slowWindows;

describe('FrameRateGuard', () => {
  it('bleibt bei 60 fps still', () => {
    expect(run(new FrameRateGuard(), 90_000, 1000 / 60)).toBe(false);
  });

  it('schlaegt bei anhaltend 30 fps genau einmal an', () => {
    const guard = new FrameRateGuard();
    expect(run(guard, FRAME_GUARD.warmupMs + measuredMs + 200, 1000 / 30)).toBe(true);
    expect(run(guard, 60_000, 1000 / 30)).toBe(false);
  });

  it('wertet die Aufwaermzeit nicht', () => {
    const guard = new FrameRateGuard();
    expect(run(guard, FRAME_GUARD.warmupMs, 100)).toBe(false);
    expect(run(guard, 60_000, 1000 / 60)).toBe(false);
  });

  it('laesst sich von einzelnen Haengern nicht ausloesen', () => {
    // Jeder zehnte Frame 120 ms: der Mittelwert steigt stark, der Median nicht.
    const guard = new FrameRateGuard();
    let fired = false;
    for (let i = 0; i < 6000; i++) fired = guard.sample(i % 10 === 0 ? 120 : 1000 / 60) || fired;
    expect(fired).toBe(false);
  });

  it('ignoriert riesige Deltas aus verdeckten Tabs', () => {
    const guard = new FrameRateGuard();
    for (let i = 0; i < 200; i++) guard.sample(5000);
    expect(run(guard, 60_000, 1000 / 60)).toBe(false);
  });

  it('verlangt langsame Fenster in Folge, nicht nur einzelne', () => {
    // Abwechselnd ein langsames und ein schnelles Fenster.
    const guard = new FrameRateGuard();
    run(guard, FRAME_GUARD.warmupMs + 50, 1000 / 60);
    let fired = false;
    for (let i = 0; i < 8; i++) {
      fired = run(guard, FRAME_GUARD.windowMs, i % 2 === 0 ? 1000 / 30 : 1000 / 60) || fired;
    }
    expect(fired).toBe(false);
  });
});
