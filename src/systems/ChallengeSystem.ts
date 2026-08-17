/**
 * Zustand eines laufenden Duells.
 *
 * Reine Logik ohne Phaser und ohne Persistenz. Ein Duell lebt nur, solange die
 * Seite offen ist - bewusst: Es ist ein Spiel zu zweit an einem Geraet, kein
 * Fortschritt, der aufgehoben werden muesste. Nichts davon landet im
 * Spielstand (Begruendung in config/challenge.ts).
 *
 * Warum ein Modul-Singleton und kein Scene-Feld: Das Duell ueberspannt vier
 * Scene-Wechsel (Einfuehrung -> Runde 1 -> Uebergabe -> Runde 2 -> Ergebnis).
 * Scene-Zustand ueberlebt `scene.start()` nicht, dieser Zustand muss das aber.
 */

import {
  CHALLENGE_BOT_DIFFICULTY_RATIOS,
  CHALLENGE_BOT_NOISE_MODULO,
  CHALLENGE_BOT_NOISE_OFFSET,
  CHALLENGE_BOT_NOISE_SCALE,
  CHALLENGE_PLAYER_COUNT,
} from '@/config/challenge';
import {
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_COMPLETION_BONUS_XP,
  DAILY_SCORE_BONUS_COINS,
  DAILY_SCORE_BONUS_MAX_TIERS,
  DAILY_SCORE_BONUS_STEP,
  DAILY_SCORE_BONUS_XP,
} from '@/config/GameConfig';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import type { BotDifficulty, ChallengeKind, ChallengeState, RunStats } from '@/types';

let state: ChallengeState | null = null;

/**
 * Erzeugt einen Seed fuer die Relikt-Abfolge.
 *
 * Zeitanteil sorgt fuer Eindeutigkeit ueber Sitzungen, Zufallsanteil dafuer,
 * dass zwei schnell hintereinander gestartete Duelle nicht dieselbe Jagd
 * bekommen. Kryptografische Guete ist nicht noetig - der Seed ist kein
 * Geheimnis, sondern nur eine gemeinsame Ausgangslage.
 */
function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function dailyKeyForToday(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dailySeed(worldId: string, key: string): string {
  return `daily-${key}-${worldId}`;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function botRound(
  player: RunStats,
  seed: string,
  difficulty: BotDifficulty,
): ChallengeState['rounds'][number] {
  const noise =
    ((hashSeed(`${seed}-${difficulty}`) % CHALLENGE_BOT_NOISE_MODULO) -
      CHALLENGE_BOT_NOISE_OFFSET) /
    CHALLENGE_BOT_NOISE_SCALE;
  const factor = CHALLENGE_BOT_DIFFICULTY_RATIOS[difficulty] + noise;
  return {
    score: Math.max(0, Math.round(player.score * factor)),
    bestCombo: Math.max(0, Math.round(player.bestCombo * factor)),
    totalCollected: Math.max(0, Math.round(player.totalCollected * factor)),
  };
}

/** Startet ein neues Duell in der angegebenen Welt. */
export function start(worldId: string): ChallengeState {
  state = { seed: createSeed(), worldId, rounds: [], kind: 'duel' };
  return state;
}

export function startDaily(worldId: string): ChallengeState {
  const key = dailyKeyForToday();
  state = {
    seed: dailySeed(worldId, key),
    worldId,
    rounds: [],
    kind: 'daily',
    dailyKey: key,
    dailyCompleted: SaveSystem.load().lastDailyKey === key,
  };
  return state;
}

export interface DailyReward {
  coins: number;
  xp: number;
  performanceTier: number;
}

export function completeDaily(stats: RunStats, eventId: string | null = null): DailyReward | null {
  if (!state || state.kind !== 'daily' || !state.dailyKey) return null;
  const key = state.dailyKey;
  if (SaveSystem.load().lastDailyKey === key) {
    state.dailyCompleted = true;
    return null;
  }

  const performanceTier = Math.min(
    DAILY_SCORE_BONUS_MAX_TIERS,
    Math.floor(Math.max(0, stats.score) / DAILY_SCORE_BONUS_STEP),
  );
  const reward: DailyReward = {
    coins: DAILY_COMPLETION_BONUS_COINS + performanceTier * DAILY_SCORE_BONUS_COINS,
    xp: DAILY_COMPLETION_BONUS_XP + performanceTier * DAILY_SCORE_BONUS_XP,
    performanceTier,
  };
  const progression = ProgressionSystem.applyDailyBonus(reward.coins, reward.xp);
  SaveSystem.update((data) => {
    data.lastDailyKey = key;
    data.dailyBestScore = Math.max(data.dailyBestScore, stats.score);
    data.totalDailyRuns += 1;
    // Ohne angemeldetes Profil gibt es kein Cloud-Ereignis, an das der
    // serverseitige Bonus sicher gebunden werden kann. Der lokale Spielstand
    // enthaelt die Belohnung bereits; eine Cloud-Nachholung wird erst fuer
    // eingeloggte Runs mit Event-ID vorgemerkt.
    data.pendingDailyKey = eventId ? key : null;
    data.pendingDailyEventId = eventId;
    data.pendingDailyCoins = eventId ? progression.coinsGained : 0;
    data.pendingDailyScore = eventId ? stats.score : 0;
  });
  state.dailyCompleted = true;
  state.dailyRewardCoins = progression.coinsGained;
  state.dailyRewardXp = reward.xp;
  state.dailyPerformanceTier = reward.performanceTier;
  return reward;
}

export function startBot(worldId: string, difficulty: BotDifficulty = 'normal'): ChallengeState {
  state = { seed: createSeed(), worldId, rounds: [], kind: 'bot', botDifficulty: difficulty };
  return state;
}

/** Neues Duell mit frischem Seed in derselben Welt. */
export function rematch(): ChallengeState {
  if (state?.kind === 'daily') return startDaily(state.worldId);
  if (state?.kind === 'bot') return startBot(state.worldId, state.botDifficulty ?? 'normal');
  return start(state?.worldId ?? '');
}

export function getState(): ChallengeState | null {
  return state;
}

/** Beendet das Duell und gibt den Speicher frei. */
export function clear(): void {
  state = null;
}

/** Index des Spielers, der als naechstes dran ist (0-basiert). */
export function currentPlayerIndex(): number {
  return state?.kind === 'bot' ? 0 : state ? state.rounds.length : 0;
}

/** Traegt das Ergebnis des gerade beendeten Durchgangs ein. */
export function submitRound(stats: RunStats): void {
  if (!state || isComplete()) return;

  state.rounds.push({
    score: stats.score,
    bestCombo: stats.bestCombo,
    totalCollected: stats.totalCollected,
  });

  if (state.kind === 'bot') {
    state.rounds.push(botRound(stats, state.seed, state.botDifficulty ?? 'normal'));
  }
}

export function isComplete(): boolean {
  if (!state) return false;
  return state.rounds.length >= (state.kind === 'duel' ? CHALLENGE_PLAYER_COUNT : 1);
}

export function kind(): ChallengeKind {
  return state?.kind ?? 'duel';
}

export function playerLabel(index: number): string {
  if (state?.kind === 'bot' && index === 1) return 'Bot';
  if (state?.kind === 'daily') return 'Tageslauf';
  return index === 0 ? 'Spieler 1' : `Spieler ${index + 1}`;
}

/**
 * Punktzahl, die der aktuelle Spieler schlagen muss - `null`, wenn er der
 * erste ist. Das HUD zeigt sie waehrend des zweiten Durchgangs an.
 */
export function scoreToBeat(): number | null {
  if (!state || state.rounds.length === 0) return null;
  return Math.max(...state.rounds.map((round) => round.score));
}

/** Index des Siegers, oder `null` bei Gleichstand oder unfertigem Duell. */
export function winnerIndex(): number | null {
  if (!state || !isComplete()) return null;

  let bestIndex = 0;
  let tied = false;

  state.rounds.forEach((round, index) => {
    const best = state?.rounds[bestIndex];
    if (!best) return;

    if (round.score > best.score) {
      bestIndex = index;
      tied = false;
    } else if (index !== bestIndex && round.score === best.score) {
      tied = true;
    }
  });

  return tied ? null : bestIndex;
}
