/**
 * Tests fuer die reinen Funktionen und die "wirft nie"-Garantie von CloudSystem.
 *
 * docs/AUDIT_2026-08-17.md Abschnitt 5.2: CloudSystem hatte keine einzige
 * Testdatei, obwohl der Modulkommentar explizit verspricht, dass keine
 * Funktion wirft.
 *
 * WICHTIG: `@/config/backend` wird hier fest auf "nicht konfiguriert" gemockt.
 * Ohne diesen Mock wuerde `isBackendConfigured` in einer lokalen Umgebung mit
 * `.env` (echte Supabase-Zugangsdaten fuer isiHunt-Produktion) auf `true`
 * stehen - dann wuerden die Netzfunktionen unten tatsaechlich gegen die
 * *echte* Produktionsdatenbank schreiben (Score-Eintraege, Sync-Codes). Der
 * Mock macht das Verhalten unabhaengig davon, ob lokal eine `.env` liegt, und
 * verhindert Seiteneffekte auf ein Live-System.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type * as CloudSystemModule from '@/systems/CloudSystem';
import type { SaveData } from '@/types';

vi.mock('@/config/backend', () => ({
  BACKEND_URL: '',
  BACKEND_ANON_KEY: '',
  isBackendConfigured: false,
  LEADERBOARD_LIMIT: 10,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  PLAYER_NAME_MAX_LENGTH: 12,
  BACKEND_TIMEOUT_MS: 5000,
}));

let CloudSystem: typeof CloudSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  CloudSystem = await import('@/systems/CloudSystem');
});

function createSave(overrides: Partial<SaveData> = {}): SaveData {
  return {
    version: 6,
    level: 1,
    xp: 0,
    talentPoints: 0,
    coins: 0,
    talents: {},
    bestScore: 0,
    bestScoreRecordedAt: null,
    bestCombo: 0,
    totalScore: 0,
    totalRuns: 0,
    totalPlayTimeMs: 0,
    totalCoinsEarned: 0,
    coinsSpent: 0,
    lastLoginBonusKey: null,
    lastDailyKey: null,
    dailyBestScore: 0,
    totalDailyRuns: 0,
    pendingDailyKey: null,
    pendingDailyEventId: null,
    pendingDailyCoins: 0,
    pendingDailyScore: 0,
    collected: emptyRarityCounts(),
    unlockedAchievements: [],
    lastWorldId: DEFAULT_WORLD_ID,
    soundEnabled: true,
    playerName: '',
    cloudId: null,
    ...overrides,
  };
}

function createRemoteSave(
  save: SaveData,
  overrides: Partial<Parameters<typeof CloudSystem.isRemoteAhead>[1]> = {},
) {
  return {
    data: save,
    level: save.level,
    bestScore: save.bestScore,
    totalRuns: save.totalRuns,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('isRemoteAhead / isLocalAhead', () => {
  it('erkennt einen weiter fortgeschrittenen Cloud-Stand am Level', () => {
    const local = createSave({ level: 5 });
    const remote = createRemoteSave(createSave({ level: 10 }));

    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(true);
    expect(CloudSystem.isLocalAhead(local, remote)).toBe(false);
  });

  it('erkennt einen weiter fortgeschrittenen lokalen Stand am Bestwert', () => {
    const local = createSave({ level: 5, bestScore: 900 });
    const remote = createRemoteSave(createSave({ level: 5, bestScore: 100 }));

    expect(CloudSystem.isLocalAhead(local, remote)).toBe(true);
    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(false);
  });

  it('haelt gleiche Staende fuer keine Seite fuer voraus', () => {
    const save = createSave({ level: 5, bestScore: 100, totalRuns: 3, totalScore: 500, coins: 20 });
    const remote = createRemoteSave(save);

    expect(CloudSystem.isRemoteAhead(save, remote)).toBe(false);
    expect(CloudSystem.isLocalAhead(save, remote)).toBe(false);
  });

  it('vergleicht auch Coins aus dem verschachtelten remote.data-Objekt', () => {
    const local = createSave({ coins: 50 });
    const remoteSave = createSave({ coins: 500 });
    const remote = createRemoteSave(remoteSave, {
      level: local.level,
      bestScore: local.bestScore,
      totalRuns: local.totalRuns,
    });

    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(true);
  });

  it('erkennt einen Talentkauf auf einem anderen Geraet ohne Level-/Score-Aenderung', () => {
    const local = createSave({ coins: 50, talents: {} });
    const remoteSave = createSave({ coins: 50, talents: { swiftness: 1 } });
    const remote = createRemoteSave(remoteSave, {
      level: local.level,
      bestScore: local.bestScore,
      totalRuns: local.totalRuns,
    });

    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(true);
    expect(CloudSystem.isLocalAhead(local, remote)).toBe(false);
  });

  it('erkennt einen neu freigeschalteten Erfolg auf einem anderen Geraet', () => {
    const local = createSave({ unlockedAchievements: [] });
    const remoteSave = createSave({ unlockedAchievements: ['first-run'] });
    const remote = createRemoteSave(remoteSave, {
      level: local.level,
      bestScore: local.bestScore,
      totalRuns: local.totalRuns,
    });

    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(true);
  });
});

describe('sanitizePlayerName', () => {
  it('entfernt alles ausser Buchstaben und Zahlen', () => {
    expect(CloudSystem.sanitizePlayerName('Ma x_2000!')).toBe('Max2000');
  });

  it('kuerzt auf die konfigurierte Maximallaenge', () => {
    const long = 'a'.repeat(30);
    expect(CloudSystem.sanitizePlayerName(long).length).toBeLessThanOrEqual(12);
  });

  it('liefert einen leeren String fuer reine Sonderzeichen', () => {
    expect(CloudSystem.sanitizePlayerName('***---!!!')).toBe('');
  });
});

describe('normalizeSyncCode', () => {
  it('bildet verwechselbare Buchstaben auf ihre Zwillinge ab', () => {
    expect(CloudSystem.normalizeSyncCode('oil')).toBe('011');
  });

  it('entfernt Leerzeichen und macht Grossbuchstaben daraus', () => {
    expect(CloudSystem.normalizeSyncCode(' ab 12 ')).toBe('AB12');
  });

  it('kuerzt auf die konfigurierte Code-Laenge', () => {
    expect(CloudSystem.normalizeSyncCode('ABCDEFGH')).toHaveLength(6);
  });
});

describe('"wirft nie" - Netzfunktionen ohne konfiguriertes Backend', () => {
  it('fetchLeaderboard liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.fetchLeaderboard()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('submitScore liefert ein Fehlerergebnis statt zu werfen', async () => {
    const result = await CloudSystem.submitScore(
      'player-1',
      'Max',
      DEFAULT_WORLD_ID,
      5,
      100,
      3,
      90_000,
      {},
      new Date().toISOString(),
    );
    expect(result.ok).toBe(false);
  });

  it('submitScoreSafely wirft nie und merkt den Score fuer spaeter vor', async () => {
    const result = await CloudSystem.submitScoreSafely(
      'player-1',
      'Max',
      DEFAULT_WORLD_ID,
      5,
      100,
      3,
      90_000,
      {},
      new Date().toISOString(),
    );

    expect(result.ok).toBe(false);
    expect(CloudSystem.hasPendingLeaderboardScore()).toBe(true);
  });

  it('ueberschreibt einen vorgemerkten Score nicht mit einem niedrigeren derselben playerId', async () => {
    // docs/AUDIT_2026-08-17.md Abschnitt 5.8: savePendingLeaderboardScore()
    // verwirft einen neuen Score nur, wenn playerId UND score-Vergleich beide
    // zutreffen - hier der Fall, der den Guard tatsaechlich greifen laesst.
    await CloudSystem.submitScoreSafely(
      'player-1',
      'Max',
      DEFAULT_WORLD_ID,
      5,
      500,
      3,
      90_000,
      {},
      new Date().toISOString(),
    );
    await CloudSystem.submitScoreSafely(
      'player-1',
      'Max',
      DEFAULT_WORLD_ID,
      5,
      100,
      3,
      90_000,
      {},
      new Date().toISOString(),
    );

    const persisted = JSON.parse(
      window.localStorage.getItem('isihunt.pending-leaderboard-score.v1')!,
    ) as { score: number };
    expect(persisted.score).toBe(500);
  });

  it('uebernimmt einen Score einer anderen playerId immer, auch wenn er niedriger ist', async () => {
    // Der Guard prueft explizit nur bei GLEICHER playerId auf niedrigeren
    // Score - bei einem Profilwechsel auf demselben Geraet (andere playerId)
    // wird der neue Score immer uebernommen, selbst wenn er niedriger ist.
    // Das ist beabsichtigtes Verhalten (anderer Spieler), aber bisher
    // unverifiziert.
    await CloudSystem.submitScoreSafely(
      'player-1',
      'Max',
      DEFAULT_WORLD_ID,
      5,
      500,
      3,
      90_000,
      {},
      new Date().toISOString(),
    );
    await CloudSystem.submitScoreSafely(
      'player-2',
      'Emre',
      DEFAULT_WORLD_ID,
      5,
      50,
      3,
      90_000,
      {},
      new Date().toISOString(),
    );

    const persisted = JSON.parse(
      window.localStorage.getItem('isihunt.pending-leaderboard-score.v1')!,
    ) as { score: number; playerId: string };
    expect(persisted.playerId).toBe('player-2');
    expect(persisted.score).toBe(50);
  });

  it('pushSave liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.pushSave()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('syncSaveSafely liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.syncSaveSafely()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('fetchProfileProgress liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.fetchProfileProgress()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('claimDailyBonus liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.claimDailyBonus('2026-08-17', 100, 'event-1')).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('createSyncCode liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.createSyncCode()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('redeemSyncCode liefert ein Fehlerergebnis statt zu werfen', async () => {
    await expect(CloudSystem.redeemSyncCode('ABC123')).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('isPlayerNameAvailable faellt ohne Backend auf "verfuegbar" zurueck statt zu werfen', async () => {
    // Bewusst anders als die uebrigen Funktionen: ohne Server-Pruefmoeglichkeit
    // blockiert diese Funktion das lokale Formular nicht (CloudSystem.ts:482).
    await expect(CloudSystem.isPlayerNameAvailable('Max')).resolves.toEqual({
      ok: true,
      value: true,
    });
  });

  it('isAvailable meldet konsistent, dass kein Dienst eingerichtet ist', () => {
    expect(CloudSystem.isAvailable()).toBe(false);
  });

  it('getSupabaseClient liefert null statt einen kaputten Client zu erzeugen', () => {
    expect(CloudSystem.getSupabaseClient()).toBeNull();
  });
});
