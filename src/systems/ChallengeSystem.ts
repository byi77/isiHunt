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

import { CHALLENGE_PLAYER_COUNT } from '@/config/challenge';
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

function dailyKey(): string {
  return new Date().toISOString().slice(0, 10);
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
  const ratios: Record<BotDifficulty, number> = { easy: 0.72, normal: 0.9, hard: 1.04 };
  const noise = ((hashSeed(`${seed}-${difficulty}`) % 13) - 6) / 100;
  const factor = ratios[difficulty] + noise;
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
  const key = dailyKey();
  state = { seed: dailySeed(worldId, key), worldId, rounds: [], kind: 'daily', dailyKey: key };
  return state;
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
