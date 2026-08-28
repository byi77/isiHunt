import { describe, expect, it } from 'vitest';

import { COMBO_GRACE_MS, PLAYER_BASE_COLLECT_RADIUS, RUN_DURATION_MS } from '@/config/GameConfig';
import { BALANCE } from '@/config/balance';
import { TALENTS, resolveStats } from '@/config/talents';
import { RARITIES } from '@/config/rarities';
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

    expect(max.collectRadius).toBeCloseTo(72.25);
    expect(max.moveSpeed).toBeCloseTo(782.75);
    expect(max.magnetRadius).toBe(180);
    expect(max.magnetPullSpeed).toBeCloseTo(687.75);
    expect(max.runDurationMs - basis.runDurationMs).toBeCloseTo(12_750);
    expect(max.comboGraceMs - basis.comboGraceMs).toBeCloseTo(425);
    expect(max.rarityPromotionChance).toBeCloseTo(0.0975);
    expect(max.xpMultiplier).toBeCloseTo(1.2625);
    expect(max.scoreMultiplier).toBeCloseTo(1.2625);
    expect(max.seriesMultiplierBonus).toBeCloseTo(0.1625);
    expect(max.obstacleResistance).toBeCloseTo(0.26);
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

  it('skaliert jeden Rang monoton und haelt die Wirkung im Machtbudget', () => {
    const metric = (id: (typeof TALENTS)[number]['id'], stats: ReturnType<typeof resolveStats>) => {
      switch (id) {
        case 'reach':
          return stats.collectRadius;
        case 'swiftness':
          return stats.moveSpeed;
        case 'magnetism':
          return stats.magnetRadius + stats.magnetPullSpeed;
        case 'endurance':
          return stats.runDurationMs;
        case 'focus':
          return stats.comboGraceMs;
        case 'prospector':
          return stats.rarityPromotionChance;
        case 'insight':
          return stats.xpMultiplier;
        case 'fortune':
          return stats.scoreMultiplier;
        case 'resonance':
          return stats.seriesMultiplierBonus;
        case 'shield':
          return stats.obstacleResistance;
      }
    };

    for (const talent of TALENTS) {
      let previous = metric(talent.id, resolveStats({}));
      for (let rank = 1; rank <= talent.maxRank; rank += 1) {
        const current = metric(talent.id, resolveStats({ [talent.id]: rank }));
        expect(current, `${talent.id} Rang ${rank}`).toBeGreaterThan(previous);
        previous = current;
      }
    }

    const averageRelicRadius =
      RARITIES.reduce((sum, rarity) => sum + rarity.radius * rarity.weight, 0) / 100;
    const baseCatchRadius = resolveStats({}).collectRadius + averageRelicRadius;
    const maxCatchRadius = resolveStats({ reach: 5 }).collectRadius + averageRelicRadius;
    const catchAreaRatio = (maxCatchRadius / baseCatchRadius) ** 2;

    // Reichweite wird als zweidimensionale Fangflaeche bewertet, nicht nur als
    // sichtbarer Radius. R5 bleibt dadurch stark, aber deutlich unter einer
    // Verdopplung der theoretischen Fangflaeche.
    expect(catchAreaRatio).toBeLessThan(1.8);
    expect(resolveStats({ magnetism: 4 }).magnetRadius).toBeLessThanOrEqual(
      4 * PLAYER_BASE_COLLECT_RADIUS,
    );
    expect(resolveStats({ endurance: 4 }).runDurationMs / RUN_DURATION_MS).toBeLessThan(1.15);
    expect(resolveStats({ focus: 4 }).comboGraceMs / COMBO_GRACE_MS).toBeLessThan(1.5);
  });

  it('belohnt den letzten Rang als Capstone, ohne Magnetreichweite aufzublasen', () => {
    const capstoneMultiplier = BALANCE.talents.capstoneRankMultiplier;
    const reachBefore = resolveStats({ reach: 4 }).collectRadius - PLAYER_BASE_COLLECT_RADIUS;
    const reachFinal =
      resolveStats({ reach: 5 }).collectRadius - resolveStats({ reach: 4 }).collectRadius;
    const enduranceBefore = resolveStats({ endurance: 3 }).runDurationMs - RUN_DURATION_MS;
    const enduranceFinal =
      resolveStats({ endurance: 4 }).runDurationMs - resolveStats({ endurance: 3 }).runDurationMs;
    const focusBefore = resolveStats({ focus: 3 }).comboGraceMs - COMBO_GRACE_MS;
    const focusFinal =
      resolveStats({ focus: 4 }).comboGraceMs - resolveStats({ focus: 3 }).comboGraceMs;

    expect(reachFinal).toBeCloseTo((reachBefore / 4) * capstoneMultiplier);
    expect(enduranceFinal).toBeCloseTo((enduranceBefore / 3) * capstoneMultiplier);
    expect(focusFinal).toBeCloseTo((focusBefore / 3) * capstoneMultiplier);
    expect(resolveStats({ magnetism: 4 }).magnetRadius).toBe(180);
    expect(resolveStats({ magnetism: 4 }).magnetPullSpeed).toBeCloseTo(687.75);
    expect(resolveStats({ fortune: 5 }).scoreMultiplier).toBeCloseTo(1.2625);
    expect(resolveStats({ insight: 5 }).xpMultiplier).toBeCloseTo(1.2625);
  });
});
