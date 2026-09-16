import { describe, expect, it } from 'vitest';
import { shipExhaustOffset, shipFlightPose } from './shipFlight';

describe('ship flight presentation', () => {
  it('converges identically at 30, 60 and 120 Hz', () => {
    const poses = [30, 60, 120].map((hz) => {
      let pose = { bank: 0, pitch: 0 };
      for (let i = 0; i < hz; i++) pose = shipFlightPose(pose, 1, 0.7, 1 / hz);
      return pose;
    });
    for (const pose of poses) {
      expect(pose.bank).toBeCloseTo(poses[0]!.bank, 12);
      expect(pose.pitch).toBeCloseTo(poses[0]!.pitch, 12);
    }
  });

  it('bounds the silhouette at maximum series speed and long frame gaps', () => {
    const pose = shipFlightPose({ bank: 0, pitch: 0 }, 5, -50, 20);
    expect(pose.bank).toBeCloseTo(0.32);
    expect(pose.pitch).toBeCloseTo(-0.18);
  });

  it('reverses smoothly and returns to neutral after braking', () => {
    const start = { bank: 0.32, pitch: 0.18 };
    const reverse = shipFlightPose(start, -1, -1, 1 / 60);
    expect(reverse.bank).toBeGreaterThan(0);
    expect(reverse.bank).toBeLessThan(start.bank);
    const rest = shipFlightPose(reverse, 0, 0, 2);
    expect(rest.bank).toBeCloseTo(0, 5);
    expect(rest.pitch).toBeCloseTo(0, 5);
    expect(start).toEqual({ bank: 0.32, pitch: 0.18 });
  });

  it('holds on zero delta and disables decorative movement for reduced motion', () => {
    const pose = { bank: 0.2, pitch: 0.1 };
    expect(shipFlightPose(pose, -1, -1, 0)).toEqual(pose);
    expect(shipFlightPose(pose, 1, 1, 1, true)).toEqual({ bank: 0, pitch: 0 });
  });

  it('keeps exhaust anchored to the rotated and pitched tail', () => {
    expect(shipExhaustOffset(0, 1)).toEqual({ x: -0, y: 36 });
    const offset = shipExhaustOffset(Math.PI / 2, 0.9);
    expect(offset.x).toBeCloseTo(-32.4);
    expect(offset.y).toBeCloseTo(0);
  });
});
