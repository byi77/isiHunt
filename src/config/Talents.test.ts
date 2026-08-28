import { describe, expect, it } from 'vitest';

import { TALENTS, resolveStats } from '@/config/talents';
import { createDefaultSave } from '@/systems/SaveSystem';

describe('Talentwirkung', () => {
  it('enthält genau zehn separat kaufbare Talente', () => {
    expect(TALENTS).toHaveLength(10);
    expect(new Set(TALENTS.map((talent) => talent.id)).size).toBe(10);
  });

  it('macht alle maximalen Ränge nützlich, ohne einzelne Werte zu sprengen', () => {
    const basis = resolveStats({});
    const max = resolveStats({
      reach: 5,
      swiftness: 5,
      magnetism: 4,
      endurance: 4,
      focus: 4,
      prospector: 3,
      insight: 5,
      fortune: 5,
      resonance: 3,
      shield: 3,
    });

    expect(max.collectRadius).toBe(86);
    expect(max.moveSpeed).toBe(775);
    expect(max.magnetRadius).toBe(260);
    expect(max.magnetPullSpeed).toBe(756);
    expect(max.runDurationMs - basis.runDurationMs).toBe(16_000);
    expect(max.comboGraceMs - basis.comboGraceMs).toBe(600);
    expect(max.rarityPromotionChance).toBeCloseTo(0.09);
    expect(max.xpMultiplier).toBe(1.25);
    expect(max.scoreMultiplier).toBe(1.25);
    expect(max.seriesMultiplierBonus).toBeCloseTo(0.15);
    expect(max.obstacleResistance).toBeCloseTo(0.24);
  });

  it('startet mit Rang 0 und aktiviert keine Talentwirkung', () => {
    const save = createDefaultSave();
    const stats = resolveStats(save.talents);

    expect(save.talents).toEqual({});
    expect(Object.values(stats.talentRanks).every((rank) => rank === 0)).toBe(true);
    expect(stats.rarityPromotionChance).toBe(0);
    expect(stats.seriesMultiplierBonus).toBe(0);
    expect(stats.obstacleResistance).toBe(0);
  });

  it('laesst Magnetismus bereits am Rand deutlich einsetzen', () => {
    const stats = resolveStats({ magnetism: 4 });
    const distance = stats.magnetRadius * 0.65;
    const influence = Math.pow(1 - distance / stats.magnetRadius, 0.7);
    const pullSpeed = influence * stats.magnetPullSpeed;

    expect(pullSpeed).toBeGreaterThan(200);
  });
});
