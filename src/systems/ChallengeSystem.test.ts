/**
 * Tests fuer den Duell-Modus (zwei Spieler, ein Geraet).
 *
 * Das System ist ein Modul-Singleton. `clear()` in `beforeEach` reicht als
 * Ruecksetzung - anders als beim SaveSystem gibt es hier keinen Cache neben
 * dem Zustand, den ein Neuladen des Moduls erfordern wuerde.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { CHALLENGE_PLAYER_COUNT, challengePlayerLabel } from '@/config/challenge';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID, WORLDS } from '@/config/worlds';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import type { RunStats } from '@/types';

beforeEach(() => {
  ChallengeSystem.clear();
});

/** Ein beendeter Durchgang; nur `score` ist fuer den Vergleich entscheidend. */
function createRun(score: number, overrides: Partial<RunStats> = {}): RunStats {
  return {
    worldId: DEFAULT_WORLD_ID,
    score,
    bestCombo: 0,
    bestMultiplier: 1,
    collected: emptyRarityCounts(),
    totalCollected: 0,
    missed: 0,
    xpGained: 0,
    ...overrides,
  };
}

/** Spielt ein vollstaendiges Duell mit den angegebenen Punktzahlen durch. */
function playRounds(...scores: number[]): void {
  ChallengeSystem.start(DEFAULT_WORLD_ID);
  for (const score of scores) ChallengeSystem.submitRound(createRun(score));
}

describe('start und clear', () => {
  it('legt ein Duell ohne gespielte Runden an', () => {
    const state = ChallengeSystem.start(DEFAULT_WORLD_ID);

    expect(state.worldId).toBe(DEFAULT_WORLD_ID);
    expect(state.rounds).toHaveLength(0);
    expect(state.seed).not.toBe('');
  });

  it('gibt den Zustand frei', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    ChallengeSystem.clear();

    expect(ChallengeSystem.getState()).toBeNull();
  });

  it('liefert vor dem Start keinen Zustand', () => {
    expect(ChallengeSystem.getState()).toBeNull();
  });

  it('vergibt fuer jedes Duell einen eigenen Seed', () => {
    const first = ChallengeSystem.start(DEFAULT_WORLD_ID).seed;
    const second = ChallengeSystem.start(DEFAULT_WORLD_ID).seed;

    // Fairness-Regel 1: beide Spieler EINES Duells teilen den Seed, zwei
    // aufeinanderfolgende Duelle duerfen ihn nicht teilen.
    expect(second).not.toBe(first);
  });

  it('verwirft die Runden des vorigen Duells beim Neustart', () => {
    playRounds(100);
    const state = ChallengeSystem.start(DEFAULT_WORLD_ID);

    expect(state.rounds).toHaveLength(0);
  });
});

describe('rematch', () => {
  it('behaelt die Welt und wechselt den Seed', () => {
    const other = WORLDS.find((w) => w.id !== DEFAULT_WORLD_ID) ?? WORLDS[0]!;
    const first = ChallengeSystem.start(other.id);
    const firstSeed = first.seed;

    ChallengeSystem.submitRound(createRun(100));
    const second = ChallengeSystem.rematch();

    expect(second.worldId).toBe(other.id);
    expect(second.seed).not.toBe(firstSeed);
    expect(second.rounds).toHaveLength(0);
  });

  it('stuerzt nicht ab, wenn nie ein Duell lief', () => {
    const state = ChallengeSystem.rematch();

    expect(state.rounds).toHaveLength(0);
  });
});

describe('Rundenablauf', () => {
  it('nennt vor dem Start Spieler 1 als naechsten', () => {
    expect(ChallengeSystem.currentPlayerIndex()).toBe(0);
  });

  it('rueckt mit jedem eingetragenen Durchgang einen Spieler weiter', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    expect(ChallengeSystem.currentPlayerIndex()).toBe(0);

    ChallengeSystem.submitRound(createRun(100));
    expect(ChallengeSystem.currentPlayerIndex()).toBe(1);
  });

  it('uebernimmt Punkte, Combo und Fangzahl des Durchgangs', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    ChallengeSystem.submitRound(createRun(420, { bestCombo: 17, totalCollected: 33 }));

    const round = ChallengeSystem.getState()?.rounds[0];
    expect(round).toEqual({ score: 420, bestCombo: 17, totalCollected: 33 });
  });

  it('ignoriert Durchgaenge ohne laufendes Duell', () => {
    ChallengeSystem.submitRound(createRun(100));

    expect(ChallengeSystem.getState()).toBeNull();
  });

  it('nimmt nach dem letzten Spieler keine weiteren Durchgaenge an', () => {
    playRounds(...Array<number>(CHALLENGE_PLAYER_COUNT).fill(100));
    ChallengeSystem.submitRound(createRun(999));

    expect(ChallengeSystem.getState()?.rounds).toHaveLength(CHALLENGE_PLAYER_COUNT);
  });

  it('gilt erst als beendet, wenn alle Spieler gespielt haben', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);

    for (let played = 1; played < CHALLENGE_PLAYER_COUNT; played++) {
      ChallengeSystem.submitRound(createRun(100));
      expect(ChallengeSystem.isComplete()).toBe(false);
    }

    ChallengeSystem.submitRound(createRun(100));
    expect(ChallengeSystem.isComplete()).toBe(true);
  });

  it('ist ohne laufendes Duell nicht beendet', () => {
    expect(ChallengeSystem.isComplete()).toBe(false);
  });
});

describe('scoreToBeat', () => {
  it('gibt dem ersten Spieler keine Vorgabe', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);

    expect(ChallengeSystem.scoreToBeat()).toBeNull();
  });

  it('zeigt dem naechsten Spieler die hoechste bisherige Punktzahl', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    ChallengeSystem.submitRound(createRun(250));

    expect(ChallengeSystem.scoreToBeat()).toBe(250);
  });

  it('liefert ohne laufendes Duell nichts', () => {
    expect(ChallengeSystem.scoreToBeat()).toBeNull();
  });
});

describe('winnerIndex', () => {
  it('kuert niemanden, solange das Duell laeuft', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    ChallengeSystem.submitRound(createRun(500));

    expect(ChallengeSystem.winnerIndex()).toBeNull();
  });

  it('kuert den Spieler mit der hoechsten Punktzahl', () => {
    playRounds(100, 300);
    expect(ChallengeSystem.winnerIndex()).toBe(1);

    playRounds(300, 100);
    expect(ChallengeSystem.winnerIndex()).toBe(0);
  });

  it('meldet bei Gleichstand keinen Sieger', () => {
    playRounds(200, 200);

    expect(ChallengeSystem.winnerIndex()).toBeNull();
  });

  it('meldet auch bei einem Duell ohne Punkte einen Gleichstand', () => {
    playRounds(0, 0);

    expect(ChallengeSystem.winnerIndex()).toBeNull();
  });
});

describe('challengePlayerLabel', () => {
  it('benennt jeden regulaeren Spieler', () => {
    for (let index = 0; index < CHALLENGE_PLAYER_COUNT; index++) {
      expect(challengePlayerLabel(index)).toBe(`Spieler ${index + 1}`);
    }
  });

  it('faellt fuer unbekannte Indizes auf einen erzeugten Namen zurueck', () => {
    expect(challengePlayerLabel(CHALLENGE_PLAYER_COUNT + 5)).toBe(
      `Spieler ${CHALLENGE_PLAYER_COUNT + 6}`,
    );
  });
});
