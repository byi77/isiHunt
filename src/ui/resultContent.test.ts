import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_BY_ID } from '@/config/achievements';
import { RARITIES } from '@/config/rarities';
import { WORLDS } from '@/config/worlds';
import { createDefaultSave } from '@/systems/SaveSystem';
import type { ChallengeState, ProgressionResult, RunStats } from '@/types';
import { challengeResultContent, soloResultContent } from './resultContent';

describe('Ergebnisdarstellung', () => {
  it('behaelt alle gleichzeitigen Freischaltungen und vergibt keine Belohnung erneut', () => {
    const save = createDefaultSave();
    save.level = 50;
    save.coins = 1500;
    const stats: RunStats = {
      worldId: WORLDS[0]!.id,
      score: 123456789,
      totalCollected: 42,
      bestCombo: 28,
      bestMultiplier: 3,
      xpGained: 680,
      missed: 0,
      collected: Object.fromEntries(RARITIES.map((r) => [r.id, 7])) as RunStats['collected'],
    };
    const progression: ProgressionResult = {
      levelsGained: 49,
      newLevel: 50,
      talentPointsGained: 49,
      coinsGained: 1500,
      isNewBestScore: true,
      unlockedWorldIds: WORLDS.slice(1, 5).map((w) => w.id),
      unlockedAchievementIds: Object.keys(ACHIEVEMENT_BY_ID).slice(0, 5),
    };
    const before = structuredClone({ save, stats, progression });
    const content = soloResultContent(stats, progression, save);
    const labels = content.sections.flatMap((section) => section.lines);
    for (const id of progression.unlockedWorldIds)
      expect(labels).toContain(WORLDS.find((w) => w.id === id)!.name);
    for (const id of progression.unlockedAchievementIds)
      expect(labels).toContain(ACHIEVEMENT_BY_ID[id]!.name);
    expect(labels).toContain('Prismaflut');
    expect(labels).toContain('Jetzt zum Kauf verfuegbar');
    expect(content.sections[0]!.title).toContain('+1.500 Coins');
    expect(content.badge).toBe('NEUER BESTWERT');
    expect(content.score).toBe('123.456.789');
    expect({ save, stats, progression }).toEqual(before);
  });

  it('gibt jeder Freischaltung ein Bild und laesst gewoehnliche Karten ohne', () => {
    const save = createDefaultSave();
    save.level = 50;
    const stats: RunStats = {
      worldId: WORLDS[0]!.id,
      score: 1000,
      totalCollected: 3,
      bestCombo: 2,
      bestMultiplier: 1,
      xpGained: 10,
      missed: 0,
      collected: Object.fromEntries(RARITIES.map((r) => [r.id, 0])) as RunStats['collected'],
    };
    const world = WORLDS[2]!;
    const achievementId = Object.keys(ACHIEVEMENT_BY_ID)[0]!;
    const content = soloResultContent(
      stats,
      {
        levelsGained: 49,
        newLevel: 50,
        talentPointsGained: 49,
        coinsGained: 0,
        isNewBestScore: false,
        unlockedWorldIds: [world.id],
        unlockedAchievementIds: [achievementId],
      },
      save,
    );
    const byTitle = (title: string) => content.sections.filter((s) => s.title === title);

    expect(byTitle('NEUE WELT')[0]!.visual).toEqual({
      kind: 'world',
      spaceVariant: world.spaceVariant,
      accent: world.accent,
    });
    expect(byTitle('ERFOLG FREIGESCHALTET')[0]!.visual).toMatchObject({
      kind: 'achievement',
      rank: ACHIEVEMENT_BY_ID[achievementId]!.rank,
    });
    for (const aura of byTitle('NEUE OPTIK IM SHOP')) expect(aura.visual).toEqual({ kind: 'aura' });
    expect(byTitle('AUSBEUTE')[0]!.visual).toBeUndefined();
    expect(byTitle('NAECHSTES ZIEL')[0]!.visual).toBeUndefined();
  });

  it('haelt die lokale Bot-Praemie erkennbar und ordnet vier Ergebnisse ihren Namen zu', () => {
    const labels = ['AlexandertheGreat123456789', 'Mira', 'Nebeljaeger', 'Vier'];
    const state: ChallengeState = {
      seed: 'test',
      worldId: WORLDS[0]!.id,
      kind: 'bot',
      rounds: labels.map((_, index) => ({ score: 400 - index, bestCombo: 1, totalCollected: 1 })),
      botVictoryReward: { coins: 40, xp: 100, localOnly: true },
    };
    const content = challengeResultContent(state, labels, 0);
    expect(content.sections[0]!.highlight).toBe(false);
    expect(content.sections[0]!.lines).toContain(
      'Nur auf diesem Geraet - nicht im Konto gesichert.',
    );
    labels.forEach((name, index) => {
      expect(content.sections[index + 1]!.title).toContain(name);
      expect(content.sections[index + 1]!.lines[0]).toBe(`${400 - index} Punkte`);
    });
    expect(
      challengeResultContent(
        {
          ...state,
          kind: 'daily',
          botVictoryReward: undefined,
          dailyRewardCoins: 50,
          dailyRewardXp: 200,
          rounds: state.rounds.slice(0, 1),
        },
        labels,
        null,
      ).sections[0]!.lines,
    ).toEqual(['+50 Coins', '+200 XP']);
  });
});
