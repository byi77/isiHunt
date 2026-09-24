import { ACHIEVEMENT_BY_ID } from '@/config/achievements';
import { RARITIES } from '@/config/rarities';
import { getWorld } from '@/config/worlds';
import { shipTint } from '@/config/shop';
import { accessibleRarityLabel } from '@/systems/AccessibilitySystem';
import { achievementCategory } from '@/systems/AchievementProgressSystem';
import { getLevelUpRewardSummary } from '@/systems/LevelUpPresentationSystem';
import { getNextGoal } from '@/systems/NextGoalSystem';
import { getLevelProgress } from '@/systems/ProgressionSystem';
import type { ChallengeState, ProgressionResult, RunStats, SaveData } from '@/types';
import type { ResultContent, ResultSection } from './ResultView';

/** Nur Darstellung des bereits verbuchten Runs; keine erneute Vergabe von Belohnungen. */
export function soloResultContent(
  stats: RunStats,
  progression: ProgressionResult,
  save: SaveData,
): ResultContent {
  const level = getLevelProgress(save);
  const reward = getLevelUpRewardSummary(save, progression);
  const goal = getNextGoal(save);
  const sections: ResultSection[] = [
    {
      title: `+${stats.xpGained.toLocaleString('de-DE')} XP · +${progression.coinsGained.toLocaleString('de-DE')} Coins`,
      lines: [
        `Kontostand: ${save.coins.toLocaleString('de-DE')} Coins`,
        level.xpNeeded === 0
          ? 'Maximales Level erreicht'
          : `${level.xpInLevel} / ${level.xpNeeded} XP bis zum naechsten Level`,
      ],
      progress: level.ratio,
      highlight: true,
    },
  ];
  if (reward.isLevelUp)
    sections.push({
      title: `LEVEL-UP · Stufe ${reward.level}`,
      lines: [
        `${reward.levelsGained} ${reward.levelsGained === 1 ? 'Stufe' : 'Stufen'} aufgestiegen`,
        `${reward.levelCoins} Level-Coins in der Gesamtsumme enthalten`,
        `+${progression.talentPointsGained} ${progression.talentPointsGained === 1 ? 'Talentpunkt' : 'Talentpunkte'}`,
      ],
      highlight: true,
    });
  for (const worldId of progression.unlockedWorldIds) {
    const world = getWorld(worldId);
    sections.push({
      title: 'NEUE WELT',
      lines: [world.name],
      highlight: true,
      visual: { kind: 'world', spaceVariant: world.spaceVariant, accent: world.accent },
    });
  }
  for (const aura of reward.availableAuraNames)
    sections.push({
      title: 'NEUE OPTIK IM SHOP',
      lines: [aura, 'Jetzt zum Kauf verfuegbar'],
      highlight: true,
      visual: { kind: 'aura' },
    });
  for (const id of progression.unlockedAchievementIds) {
    const achievement = ACHIEVEMENT_BY_ID[id];
    if (achievement)
      sections.push({
        title: 'ERFOLG FREIGESCHALTET',
        lines: [achievement.name, `${achievement.coinReward} Coins in der Gesamtsumme enthalten`],
        highlight: true,
        visual: {
          kind: 'achievement',
          category: achievementCategory(achievement),
          rank: achievement.rank,
        },
      });
  }
  // Die Praemien stehen direkt unter dem XP-Block: Sie erklaeren die Zahl,
  // die der Kopf gerade hochgezaehlt hat, und gehoeren deshalb nach oben -
  // nicht hinter das naechste Ziel, wo man sie wegwischen muesste.
  const bonus = stats.bonus;
  if (bonus && bonus.entries.length > 0)
    sections.push({
      title: `ABSCHLUSSPRAEMIE · +${bonus.score.toLocaleString('de-DE')} Punkte · +${bonus.xp.toLocaleString('de-DE')} XP`,
      lines: [
        ...bonus.entries.map(
          (entry) =>
            `${entry.label} (${entry.detail}): +${entry.score.toLocaleString('de-DE')} Punkte · +${entry.xp.toLocaleString('de-DE')} XP`,
        ),
        ...(bonus.capped ? ['Obergrenze erreicht - die Summe ist gedeckelt.'] : []),
      ],
      highlight: true,
    });
  sections.push({ title: 'NAECHSTES ZIEL', lines: [goal.title, goal.detail] });
  sections.push({
    title: 'AUSBEUTE',
    lines: RARITIES.map(
      (rarity) =>
        `${accessibleRarityLabel(rarity.id, rarity.label)}: ${stats.collected[rarity.id]}`,
    ),
  });
  return {
    title: 'RUN BEENDET',
    score: stats.score.toLocaleString('de-DE'),
    heroShip: { shapeId: save.shipShape, tint: shipTint(save, getWorld(stats.worldId).accent) },
    badge: progression.isNewBestScore ? 'NEUER BESTWERT' : undefined,
    subtitle: `Level ${level.level} · ${stats.totalCollected} Relikte · beste Kette ${stats.bestCombo} · max x${stats.bestMultiplier}`,
    sections,
    scoreRoll:
      bonus && bonus.score > 0
        ? {
            from: stats.score - bonus.score,
            to: stats.score,
            steps: bonus.entries.map((entry) => ({ label: entry.label, score: entry.score })),
          }
        : undefined,
  };
}

export function challengeResultContent(
  state: ChallengeState,
  labels: string[],
  winnerIndex: number | null,
): ResultContent {
  const daily = state.kind === 'daily';
  const winner = daily ? null : winnerIndex;
  const sections: ResultSection[] = state.rounds.map((round, index) => ({
    title: `${winner === index ? 'SIEG - ' : ''}${labels[index] ?? `Spieler ${index + 1}`}`,
    lines: [
      `${round.score.toLocaleString('de-DE')} Punkte`,
      `${round.totalCollected} ${round.totalCollected === 1 ? 'Relikt' : 'Relikte'} - beste Kette ${round.bestCombo}`,
    ],
    highlight: winner === index,
  }));
  if (daily)
    sections.unshift({
      title: 'TAGESBONUS',
      highlight: true,
      lines: [`+${state.dailyRewardCoins ?? 0} Coins`, `+${state.dailyRewardXp ?? 0} XP`],
    });
  const reward = state.botVictoryReward;
  if (reward)
    sections.unshift({
      title: 'BOT BESIEGT',
      highlight: !reward.localOnly,
      lines: [
        `+${reward.coins} Coins - +${reward.xp} XP`,
        ...(reward.localOnly ? ['Nur auf diesem Geraet - nicht im Konto gesichert.'] : []),
      ],
    });
  const scores = state.rounds.map((round) => round.score);
  if (scores.length > 1)
    sections.push({
      title: 'PUNKTEABSTAND',
      lines: [`${(Math.max(...scores) - Math.min(...scores)).toLocaleString('de-DE')} Punkte`],
    });
  return {
    title: daily ? 'TAGESLAUF BEENDET' : 'DUELL BEENDET',
    score: daily ? (scores[0] ?? 0).toLocaleString('de-DE') : 'Ergebnis',
    badge: daily
      ? 'GESCHAFFT'
      : winner === null
        ? 'UNENTSCHIEDEN'
        : `${labels[winner] ?? `Spieler ${winner + 1}`} gewinnt`,
    subtitle: daily
      ? 'Morgen wartet der naechste Lauf auf dich.'
      : 'Bereit fuer die naechste Runde?',
    sections,
  };
}
