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
import type { ChallengeState, RunStats } from '@/types';

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

/** Startet ein neues Duell in der angegebenen Welt. */
export function start(worldId: string): ChallengeState {
  state = { seed: createSeed(), worldId, rounds: [] };
  return state;
}

/** Neues Duell mit frischem Seed in derselben Welt. */
export function rematch(): ChallengeState {
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
  return state ? state.rounds.length : 0;
}

/** Traegt das Ergebnis des gerade beendeten Durchgangs ein. */
export function submitRound(stats: RunStats): void {
  if (!state || isComplete()) return;

  state.rounds.push({
    score: stats.score,
    bestCombo: stats.bestCombo,
    totalCollected: stats.totalCollected,
  });
}

export function isComplete(): boolean {
  return state !== null && state.rounds.length >= CHALLENGE_PLAYER_COUNT;
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
