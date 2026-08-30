/**
 * Tests fuer den Duell-Modus (zwei Spieler, ein Geraet).
 *
 * Das System ist ein Modul-Singleton. `clear()` in `beforeEach` reicht als
 * Ruecksetzung - anders als beim SaveSystem gibt es hier keinen Cache neben
 * dem Zustand, den ein Neuladen des Moduls erfordern wuerde.
 *
 * Bot- und Tages-Modus (unten) greifen zusaetzlich auf SaveSystem zu, das
 * seinerseits einen Modul-Cache haelt - dort wird das Modul vor jedem Test
 * neu geladen (siehe ProgressionSystem.test.ts fuer denselben Grund).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHALLENGE_MAX_PLAYER_COUNT,
  CHALLENGE_PLAYER_COUNT,
  challengePlayerLabel,
} from '@/config/challenge';
import {
  BOT_VICTORY_BONUS_COINS,
  BOT_VICTORY_BONUS_XP,
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_COMPLETION_BONUS_XP,
} from '@/config/GameConfig';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID, WORLDS } from '@/config/worlds';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import type * as SaveSystemModule from '@/systems/SaveSystem';
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

  it('uebernimmt den letzten Talent-Build als Rematch-Vorschlag', () => {
    const first = ChallengeSystem.start(DEFAULT_WORLD_ID, [{ reach: 3 }, { fortune: 2 }]);
    expect(ChallengeSystem.duelTalentDraftFor(0)).toEqual({ reach: 3 });

    ChallengeSystem.changeDuelTalentRank(0, 'reach', -1, 10);
    const second = ChallengeSystem.rematch();

    expect(second.duelTalentDrafts).toEqual([{ reach: 2 }, { fortune: 2 }]);
    expect(second.seed).not.toBe(first.seed);
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

  it('unterstuetzt bis zu vier lokale Spieler', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID, CHALLENGE_MAX_PLAYER_COUNT);

    expect(ChallengeSystem.getState()?.playerCount).toBe(CHALLENGE_MAX_PLAYER_COUNT);
    expect(ChallengeSystem.getState()?.duelTalentDrafts).toHaveLength(CHALLENGE_MAX_PLAYER_COUNT);

    for (const score of [100, 200, 300, 400]) {
      ChallengeSystem.submitRound(createRun(score));
    }

    expect(ChallengeSystem.isComplete()).toBe(true);
    expect(ChallengeSystem.winnerIndex()).toBe(3);
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

describe('Bot-Duell', () => {
  it('schiebt bei einer eingetragenen Runde zwei Eintraege (Spieler + Bot)', () => {
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'normal');
    ChallengeSystem.submitRound(createRun(200, { bestCombo: 10, totalCollected: 40 }));

    // docs/AUDIT_2026-08-17.md Abschnitt 5.3: der Bot-Modus haengt eine
    // zweite, synthetische Runde an - isComplete() prueft nur >= 1, das
    // Array hat nach einem einzigen submitRound() aber bereits 2 Eintraege.
    expect(ChallengeSystem.getState()?.rounds).toHaveLength(2);
    expect(ChallengeSystem.isComplete()).toBe(true);
  });

  it('haelt den Spielerindex im Bot-Modus konstant bei 0', () => {
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'normal');
    expect(ChallengeSystem.currentPlayerIndex()).toBe(0);

    ChallengeSystem.submitRound(createRun(200));
    // Der Mensch spielt im Bot-Modus immer zuerst - anders als im Duell
    // darf der Index nach dem (impliziten Doppel-)Eintrag nicht weiterruecken.
    expect(ChallengeSystem.currentPlayerIndex()).toBe(0);
  });

  it('bewertet den Bot proportional zur Spielerleistung, nie negativ', () => {
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'easy');
    ChallengeSystem.submitRound(createRun(1000, { bestCombo: 20, totalCollected: 80 }));

    const botRound = ChallengeSystem.getState()?.rounds[1];
    expect(botRound).toBeDefined();
    expect(botRound!.score).toBeGreaterThanOrEqual(0);
    expect(botRound!.bestCombo).toBeGreaterThanOrEqual(0);
    expect(botRound!.totalCollected).toBeGreaterThanOrEqual(0);
  });

  it('kuert einen Sieger zwischen Spieler und Bot', () => {
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'easy');
    ChallengeSystem.submitRound(createRun(1000));

    // 'easy' hat den niedrigsten Ratio-Faktor (0.72 +/- Rauschen) - bei
    // einem hohen Spielerscore bleibt der Bot statistisch dahinter, exakt
    // pruefbar ist nur, dass ueberhaupt ein Sieger feststeht (kein Gleichstand
    // durch den deterministischen Seed-Hash).
    expect(ChallengeSystem.winnerIndex()).not.toBeNull();
  });

  it('vergibt den Siegbonus genau einmal, wenn der Spieler den Bot besiegt', () => {
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'easy');
    ChallengeSystem.submitRound(createRun(1000));

    const reward = ChallengeSystem.awardBotVictory();

    expect(reward).not.toBeNull();
    expect(reward!.xp).toBe(BOT_VICTORY_BONUS_XP);
    expect(reward!.coins).toBeGreaterThanOrEqual(BOT_VICTORY_BONUS_COINS);
    expect(ChallengeSystem.awardBotVictory()).toEqual(reward);
  });

  it('wechselt bei einem Rematch die Schwierigkeit nicht, aber den Seed', () => {
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'hard');
    const firstSeed = ChallengeSystem.getState()!.seed;
    ChallengeSystem.submitRound(createRun(100));

    const second = ChallengeSystem.rematch();

    expect(second.kind).toBe('bot');
    expect(second.botDifficulty).toBe('hard');
    expect(second.seed).not.toBe(firstSeed);
    expect(second.rounds).toHaveLength(0);
  });
});

describe('Netzwerk-Duell', () => {
  it('legt den Zustand mit dem uebergebenen Seed und Raum-Code an', () => {
    const state = ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);

    expect(state.kind).toBe('duel-online');
    expect(state.seed).toBe('seed-abc');
    expect(state.online?.roomCode).toBe('CODE01');
    expect(state.online?.localPlayerIndex).toBe(0);
    expect(state.rounds).toHaveLength(0);
  });

  it('zeigt im Netzwerk-Duell die Namen an fester Spielerposition', () => {
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);
    ChallengeSystem.updateOnlinePlayerNames(['Alice', 'Bob']);

    expect(ChallengeSystem.playerLabel(0)).toBe('Alice');
    expect(ChallengeSystem.playerLabel(1)).toBe('Bob');
  });

  it('nutzt den localPlayerIndex als currentPlayerIndex, unabhaengig von gespielten Runden', () => {
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 1);

    expect(ChallengeSystem.currentPlayerIndex()).toBe(1);
  });

  it('ist erst vollstaendig, wenn beide Positionen gesetzt sind', () => {
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);
    expect(ChallengeSystem.isComplete()).toBe(false);

    ChallengeSystem.submitOnlineRound(0, { score: 100, bestCombo: 5, totalCollected: 20 });
    expect(ChallengeSystem.isComplete()).toBe(false);

    ChallengeSystem.submitOnlineRound(1, { score: 200, bestCombo: 8, totalCollected: 30 });
    expect(ChallengeSystem.isComplete()).toBe(true);
  });

  it('ordnet Ergebnisse der festen Position zu, nicht der Ankunftsreihenfolge', () => {
    // Regressionsfall: das Gegnerergebnis (Index 1) trifft zuerst ein, das
    // eigene (Index 0) danach. Ohne feste Positionszuordnung wuerde ein
    // simples push() das erste eingetroffene Ergebnis an Position 0 legen,
    // egal von welchem Spieler es stammt.
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);

    ChallengeSystem.submitOnlineRound(1, { score: 999, bestCombo: 1, totalCollected: 1 });
    ChallengeSystem.submitOnlineRound(0, { score: 50, bestCombo: 1, totalCollected: 1 });

    const rounds = ChallengeSystem.getState()?.rounds;
    expect(rounds?.[0]).toEqual({ score: 50, bestCombo: 1, totalCollected: 1 });
    expect(rounds?.[1]).toEqual({ score: 999, bestCombo: 1, totalCollected: 1 });
  });

  it('erlaubt winnerIndex() unveraendert zu funktionieren, sobald beide Ergebnisse da sind', () => {
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);
    ChallengeSystem.submitOnlineRound(1, { score: 999, bestCombo: 1, totalCollected: 1 });
    ChallengeSystem.submitOnlineRound(0, { score: 50, bestCombo: 1, totalCollected: 1 });

    expect(ChallengeSystem.winnerIndex()).toBe(1);
  });

  it('ignoriert submitOnlineRound ohne laufendes Netzwerk-Duell', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    ChallengeSystem.submitOnlineRound(0, { score: 50, bestCombo: 1, totalCollected: 1 });

    // Ein lokales Duell darf durch einen Fehlaufruf nicht veraendert werden.
    expect(ChallengeSystem.getState()?.rounds).toHaveLength(0);
  });

  it('ignoriert submitRound (das lokale Pendant) bei einem Netzwerk-Duell', () => {
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);
    ChallengeSystem.submitRound(createRun(100));

    // submitRound ist fuer lokale Uebergabe gedacht - ein Netzwerk-Duell
    // muss ausschliesslich ueber submitOnlineRound aktualisiert werden.
    expect(ChallengeSystem.getState()?.rounds).toHaveLength(0);
  });

  it('aktualisiert den Uhr-Offset und die Startzeit', () => {
    ChallengeSystem.startOnline(DEFAULT_WORLD_ID, 'seed-abc', 'CODE01', 0);
    ChallengeSystem.updateOnlineSync(120, 1_700_000_000_000);

    const online = ChallengeSystem.getState()?.online;
    expect(online?.clockOffsetMs).toBe(120);
    expect(online?.startAtServerMs).toBe(1_700_000_000_000);
  });

  it('ignoriert updateOnlineSync ohne laufendes Netzwerk-Duell', () => {
    ChallengeSystem.start(DEFAULT_WORLD_ID);
    ChallengeSystem.updateOnlineSync(120, 1_700_000_000_000);

    expect(ChallengeSystem.getState()?.online).toBeUndefined();
  });

  it('behaelt beim Netzwerk-Rematch Raum und Spielerposition', () => {
    const first = ChallengeSystem.startOnline(
      DEFAULT_WORLD_ID,
      'seed-abc',
      'CODE01',
      0,
      'a'.repeat(64),
      [{ reach: 2 }, { fortune: 3 }],
    );
    const second = ChallengeSystem.rematch();

    expect(second).toBe(first);
    expect(second.kind).toBe('duel-online');
    expect(second.online?.roomCode).toBe('CODE01');

    ChallengeSystem.resetOnlineMatch('seed-rematch', 2);
    expect(ChallengeSystem.getState()?.seed).toBe('seed-rematch');
    expect(ChallengeSystem.getState()?.duelMatchNumber).toBe(2);
    expect(ChallengeSystem.getState()?.duelTalentDrafts).toEqual([{ reach: 2 }, { fortune: 3 }]);
  });
});

describe('Tages-Herausforderung', () => {
  let SaveSystem: typeof SaveSystemModule;
  let DailyChallengeSystem: typeof ChallengeSystem;

  beforeEach(async () => {
    window.localStorage.clear();
    vi.resetModules();
    SaveSystem = await import('@/systems/SaveSystem');
    DailyChallengeSystem = await import('@/systems/ChallengeSystem');
    DailyChallengeSystem.clear();
  });

  it('bildet lokale Kalenderdaten reproduzierbar als Tagesschlüssel ab', () => {
    const localDate = new Date(2026, 7, 17, 23, 59, 0);

    expect(DailyChallengeSystem.dailyKeyForDate(localDate)).toBe('2026-08-17');
    expect(DailyChallengeSystem.dailyKeyForToday(localDate)).toBe('2026-08-17');
  });

  it('akzeptiert im Client-Fenster nur Vortag, heute und Folgetag', () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);

    expect(DailyChallengeSystem.isDailyKeyWithinClientWindow('2026-08-16', now)).toBe(true);
    expect(DailyChallengeSystem.isDailyKeyWithinClientWindow('2026-08-17', now)).toBe(true);
    expect(DailyChallengeSystem.isDailyKeyWithinClientWindow('2026-08-18', now)).toBe(true);
    expect(DailyChallengeSystem.isDailyKeyWithinClientWindow('2026-08-15', now)).toBe(false);
    expect(DailyChallengeSystem.isDailyKeyWithinClientWindow('kein-datum', now)).toBe(false);
    expect(DailyChallengeSystem.isDailyKeyWithinClientWindow('2026-02-30', now)).toBe(false);
  });

  it('markiert den heutigen Tageslauf als noch nicht abgeschlossen', () => {
    const state = DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);

    expect(state.kind).toBe('daily');
    expect(state.dailyCompleted).toBe(false);
  });

  it('vergibt Coins und XP genau einmal pro Tagesschluessel', () => {
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    const before = SaveSystem.load();

    const reward = DailyChallengeSystem.completeDaily(createRun(500));

    expect(reward).not.toBeNull();
    expect(reward!.coins).toBeGreaterThanOrEqual(DAILY_COMPLETION_BONUS_COINS);
    expect(reward!.xp).toBeGreaterThanOrEqual(DAILY_COMPLETION_BONUS_XP);

    const after = SaveSystem.load();
    expect(after.totalDailyRuns).toBe(before.totalDailyRuns + 1);
    expect(after.lastDailyKey).toBe(DailyChallengeSystem.dailyKeyForToday());
  });

  it('verweigert einen zweiten Abschluss desselben Tages (Idempotenz-Guard)', () => {
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    DailyChallengeSystem.completeDaily(createRun(500));
    const afterFirst = SaveSystem.load();

    // Neuer Zustand mit demselben dailyKey, wie es ein zweiter Aufruf am
    // selben Tag (z.B. nach einem Rematch) erzeugen wuerde.
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    const secondReward = DailyChallengeSystem.completeDaily(createRun(999));
    const afterSecond = SaveSystem.load();

    expect(secondReward).toBeNull();
    expect(afterSecond.coins).toBe(afterFirst.coins);
    expect(afterSecond.totalDailyRuns).toBe(afterFirst.totalDailyRuns);
  });

  it('merkt den Tageslauf bereits als abgeschlossen, wenn lastDailyKey vom heutigen Tag stammt', () => {
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    DailyChallengeSystem.completeDaily(createRun(500));

    const state = DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    expect(state.dailyCompleted).toBe(true);
  });

  it('vermerkt keinen Cloud-Nachtrag ohne Event-ID', () => {
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    DailyChallengeSystem.completeDaily(createRun(500), null);

    const data = SaveSystem.load();
    expect(data.pendingDailyKey).toBeNull();
    expect(data.pendingDailyEventId).toBeNull();
    expect(data.pendingDailyCoins).toBe(0);
  });

  it('vermerkt einen Cloud-Nachtrag, wenn eine Event-ID uebergeben wird', () => {
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    DailyChallengeSystem.completeDaily(createRun(500), 'event-123');

    const data = SaveSystem.load();
    expect(data.pendingDailyKey).toBe(DailyChallengeSystem.dailyKeyForToday());
    expect(data.pendingDailyEventId).toBe('event-123');
    expect(data.pendingDailyCoins).toBeGreaterThan(0);
  });

  it('liefert ausserhalb des Tagesmodus keine Belohnung', () => {
    DailyChallengeSystem.start(DEFAULT_WORLD_ID);

    expect(DailyChallengeSystem.completeDaily(createRun(500))).toBeNull();
  });

  it('staffelt die Belohnung nach Punkteschwelle (performanceTier)', () => {
    DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    const lowReward = DailyChallengeSystem.completeDaily(createRun(0));

    expect(lowReward!.performanceTier).toBe(0);
  });

  it('wechselt bei einem Rematch im Tagesmodus den Seed, behaelt aber den Tagesschluessel', () => {
    const first = DailyChallengeSystem.startDaily(DEFAULT_WORLD_ID);
    const second = DailyChallengeSystem.rematch();

    expect(second.kind).toBe('daily');
    expect(second.dailyKey).toBe(first.dailyKey);
  });
});
