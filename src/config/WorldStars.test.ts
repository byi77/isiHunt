/** Sterne je Welt: Bedingungen, Erfolgs-IDs und Deckung aller Welten. */

import { describe, expect, it } from 'vitest';

import { ACHIEVEMENT_BY_ID, ACHIEVEMENTS } from '@/config/achievements';
import { emptyRarityCounts } from '@/config/rarities';
import { WORLDS } from '@/config/worlds';
import {
  STARS_PER_WORLD,
  WORLD_STARS,
  earnsWorldStar,
  getWorldStars,
  parseWorldStarAchievementId,
  worldStarAchievementId,
  worldStarCount,
  worldStarLabel,
} from '@/config/worldStars';
import type { RunStats } from '@/types';

function createRun(worldId: string, overrides: Partial<RunStats> = {}): RunStats {
  return {
    worldId,
    score: 0,
    bestCombo: 0,
    bestMultiplier: 1,
    collected: emptyRarityCounts(),
    totalCollected: 0,
    missed: 0,
    xpGained: 0,
    ...overrides,
  };
}

describe('Deckung', () => {
  it('jede Welt hat genau einen Sterneintrag', () => {
    expect(WORLD_STARS.map((def) => def.worldId).sort()).toEqual(WORLDS.map((w) => w.id).sort());
  });

  it('die zweite Punkteschwelle liegt ueber der ersten', () => {
    for (const def of WORLD_STARS) {
      expect(def.scores[1], def.worldId).toBeGreaterThan(def.scores[0]);
    }
  });

  it('Kurznamen sind eindeutig und reines ASCII', () => {
    const slugs = WORLD_STARS.map((def) => def.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+$/);
  });

  it('jeder Stern ist ein Erfolg mit steigendem Rang', () => {
    for (const def of WORLD_STARS) {
      for (let star = 1; star <= STARS_PER_WORLD; star++) {
        const achievement = ACHIEVEMENT_BY_ID[worldStarAchievementId(def, star)];
        expect(achievement, `${def.slug} ${star}`).toBeDefined();
        expect(achievement!.rank).toBe(star + def.rankOffset);
      }
    }
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('earnsWorldStar', () => {
  const eisring = getWorldStars('frostzinne')!;

  it('vergibt die Punktesterne ab der Schwelle', () => {
    const knapp = createRun('frostzinne', { score: eisring.scores[0] - 1 });
    const genau = createRun('frostzinne', { score: eisring.scores[0] });
    expect(earnsWorldStar(eisring, 1, knapp)).toBe(false);
    expect(earnsWorldStar(eisring, 1, genau)).toBe(true);
    expect(earnsWorldStar(eisring, 2, genau)).toBe(false);
  });

  it('zaehlt nur in der eigenen Welt', () => {
    const fremd = createRun('silberhain', { score: eisring.scores[1] });
    expect(earnsWorldStar(eisring, 1, fremd)).toBe(false);
  });

  it('zaehlt keine Endlos-Runde', () => {
    const endlos = createRun('frostzinne', { score: eisring.scores[1], endlessRound: 3 });
    expect(earnsWorldStar(eisring, 1, endlos)).toBe(false);
  });

  it('der dritte Stern ist der Weltauftrag', () => {
    expect(eisring.goal.metric).toBe('combo');
    const knapp = createRun('frostzinne', { bestCombo: eisring.goal.target - 1 });
    const genau = createRun('frostzinne', { bestCombo: eisring.goal.target });
    expect(earnsWorldStar(eisring, 3, knapp)).toBe(false);
    expect(earnsWorldStar(eisring, 3, genau)).toBe(true);
  });

  it('der Punkteauftrag zaehlt ohne Abschlusspraemie', () => {
    const horizont = getWorldStars('horizonttor')!;
    expect(horizont.goal.metric).toBe('score');
    const mitPraemie = createRun('horizonttor', {
      score: horizont.goal.target,
      bonus: { entries: [], score: 1, xp: 0, capped: false },
    });
    expect(earnsWorldStar(horizont, 3, mitPraemie)).toBe(false);
  });
});

describe('parseWorldStarAchievementId', () => {
  it('findet Welt und Stern aus der Erfolgs-ID zurueck', () => {
    for (const def of WORLD_STARS) {
      const parsed = parseWorldStarAchievementId(worldStarAchievementId(def, 2));
      expect(parsed?.def.worldId).toBe(def.worldId);
      expect(parsed?.star).toBe(2);
    }
    expect(parseWorldStarAchievementId('star_unbekannt_1')).toBeNull();
    expect(parseWorldStarAchievementId('score_1000')).toBeNull();
  });
});

describe('Anzeige', () => {
  it('zaehlt freigeschaltete Sterne je Welt', () => {
    const def = getWorldStars('glutmark')!;
    const unlocked = [worldStarAchievementId(def, 1), worldStarAchievementId(def, 3), 'first_hunt'];
    expect(worldStarCount(unlocked, 'glutmark')).toBe(2);
    expect(worldStarCount(unlocked, 'silberhain')).toBe(0);
  });

  it('zeichnet volle und leere Sterne', () => {
    expect(worldStarLabel(0)).toBe('☆☆☆');
    expect(worldStarLabel(2)).toBe('★★☆');
    expect(worldStarLabel(5)).toBe('★★★');
  });
});
