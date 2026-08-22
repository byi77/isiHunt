import { describe, expect, it } from 'vitest';

import { resolveStats } from '@/config/talents';

describe('Talentwirkung', () => {
  it('macht alle maximalen Ränge deutlich stärker als die Grundwerte', () => {
    const basis = resolveStats({});
    const max = resolveStats({
      reach: 5,
      swiftness: 5,
      magnetism: 4,
      endurance: 4,
      focus: 4,
      insight: 5,
      fortune: 5,
    });

    expect(max.collectRadius).toBe(106);
    expect(max.moveSpeed).toBe(868);
    expect(max.magnetRadius).toBe(300);
    expect(max.magnetPullSpeed).toBe(1008);
    expect(max.runDurationMs - basis.runDurationMs).toBe(24_000);
    expect(max.comboGraceMs - basis.comboGraceMs).toBe(1_200);
    expect(max.xpMultiplier).toBe(1.5);
    expect(max.scoreMultiplier).toBe(1.5);
  });

  it('laesst Magnetismus bereits am Rand deutlich einsetzen', () => {
    const stats = resolveStats({ magnetism: 4 });
    const influence = Math.pow(1 - 250 / stats.magnetRadius, 0.7);
    const pullSpeed = influence * stats.magnetPullSpeed;

    expect(pullSpeed).toBeGreaterThan(200);
  });
});
