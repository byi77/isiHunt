import type Phaser from 'phaser';
import { ACHIEVEMENT_BY_ID } from '@/config/achievements';
import { RARITIES } from '@/config/rarities';
import { WORLDS } from '@/config/worlds';
import { createDefaultSave } from '@/systems/SaveSystem';
import type { ChallengeState, ProgressionResult, RunStats } from '@/types';
import { ResultView } from './ResultView';
import { challengeResultContent, soloResultContent } from './resultContent';
import { createSceneBackdrop } from './widgets';
import { installLayoutAudit } from './layoutAudit';

/** Dev-Vorschau ohne Speichern, Belohnungsvergabe oder Netzwerkzugriff. */
export function installResultPreview(scene: Phaser.Scene, mode: string): void {
  const world = WORLDS[0]!;
  const save = createDefaultSave();
  const multiple = mode === 'multiple';
  save.level = multiple ? 50 : mode === 'level' ? 6 : 1;
  save.coins = multiple ? 123456 : 127;
  const stats: RunStats = {
    worldId: world.id,
    score: multiple ? 123456789 : 12480,
    bestCombo: 28,
    bestMultiplier: 3,
    totalCollected: 42,
    missed: 2,
    xpGained: 680,
    collected: Object.fromEntries(RARITIES.map((r) => [r.id, 7])) as RunStats['collected'],
  };
  const progression: ProgressionResult = {
    levelsGained: multiple ? 49 : mode === 'level' ? 1 : 0,
    newLevel: save.level,
    talentPointsGained: multiple ? 49 : 1,
    coinsGained: 127,
    unlockedWorldIds: multiple ? WORLDS.slice(1, 5).map((w) => w.id) : [],
    unlockedAchievementIds: multiple ? Object.keys(ACHIEVEMENT_BY_ID).slice(0, 5) : [],
    isNewBestScore: mode === 'record' || multiple,
  };
  if (multiple) progression.coinsGained = 1500;
  const challenge = ['duel', 'daily', 'bot'].includes(mode);
  const state: ChallengeState = {
    seed: 'preview',
    worldId: world.id,
    kind: mode === 'daily' ? 'daily' : mode === 'bot' ? 'bot' : 'duel',
    rounds: Array.from({ length: mode === 'daily' ? 1 : mode === 'bot' ? 2 : 4 }, (_, index) => ({
      score: 123456789 - index * 100,
      totalCollected: 999,
      bestCombo: 99,
    })),
    dailyRewardCoins: 50,
    dailyRewardXp: 200,
    botVictoryReward: mode === 'bot' ? { coins: 40, xp: 100, localOnly: true } : undefined,
  };
  const content = challenge
    ? challengeResultContent(
        state,
        ['AlexandertheGreat123456789', 'Lichtjaegerin aus dem Nebel', 'Mira', 'Spieler vier'],
        0,
      )
    : soloResultContent(stats, progression, save);
  createSceneBackdrop(scene, world);
  installLayoutAudit(scene.game);
  new ResultView(scene, content, world.accent, [
    ...(mode === 'daily'
      ? []
      : [
          {
            label: challenge ? 'REMATCH' : 'NOCHMAL',
            run: () => {
              window.location.search = '?resultPreview=normal&layoutAudit';
            },
          },
        ]),
    {
      label: 'ZUM MENUE',
      run: () => {
        window.location.search = '?layoutAudit';
      },
    },
  ]);
}
