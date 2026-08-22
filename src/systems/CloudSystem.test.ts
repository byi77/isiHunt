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
import { DEFAULT_SHIP_AURA, DEFAULT_SHIP_COLOR, DEFAULT_SHIP_SHAPE } from '@/config/shop';
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
    ownedShipShapes: [DEFAULT_SHIP_SHAPE],
    ownedShipColors: [DEFAULT_SHIP_COLOR],
    ownedShipAuras: [DEFAULT_SHIP_AURA],
    shipShape: DEFAULT_SHIP_SHAPE,
    shipColor: DEFAULT_SHIP_COLOR,
    shipAura: DEFAULT_SHIP_AURA,
    soundEnabled: true,
    hapticsEnabled: true,
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
  it('schreibt klein und entfernt alles ausser a-z, 0-9, - und _', () => {
    expect(CloudSystem.sanitizePlayerName('Ma x_2000!')).toBe('max_2000');
  });

  it('behaelt Bindestrich und Unterstrich - dieselbe Regel wie der Login-Alias', () => {
    expect(CloudSystem.sanitizePlayerName('Emre-K_1')).toBe('emre-k_1');
  });

  it('kuerzt auf die konfigurierte Maximallaenge', () => {
    const long = 'a'.repeat(30);
    expect(CloudSystem.sanitizePlayerName(long).length).toBeLessThanOrEqual(16);
  });

  it('liefert einen leeren String fuer reine Sonderzeichen', () => {
    expect(CloudSystem.sanitizePlayerName('***!!!')).toBe('');
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

  it('merkt Kosmetik fuer den Offline-Sync vor und kann sie verwerfen', () => {
    const save = createSave({
      ownedShipShapes: [DEFAULT_SHIP_SHAPE, 'star'],
      shipShape: 'star',
    });

    CloudSystem.queueCosmeticSync(save);
    expect(CloudSystem.hasPendingCosmeticSync()).toBe(true);

    CloudSystem.clearPendingCosmeticSync();
    expect(CloudSystem.hasPendingCosmeticSync()).toBe(false);
  });

  it('laesst Kosmetik bei fehlendem Backend vorgemerkt', async () => {
    CloudSystem.queueCosmeticSync(
      createSave({ ownedShipColors: [DEFAULT_SHIP_COLOR, 'gold'], shipColor: 'gold' }),
    );

    await expect(CloudSystem.flushPendingCosmetics()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect(CloudSystem.hasPendingCosmeticSync()).toBe(true);
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

  it('normalizeRemoteSave uebernimmt gueltige Werte unveraendert', async () => {
    // Gegenprobe zur NaN-Haertung (Audit 2026-08-23): Die Absicherung darf
    // gute Werte nicht verbiegen - sonst faellt der Regelfall der Reparatur
    // zum Opfer.
    const gut = CloudSystem.normalizeRemoteSave({
      data: { level: 30 },
      level: 30,
      best_score: 5000,
      total_runs: 42,
      updated_at: '2026-08-23T00:00:00.000Z',
    });

    expect(gut).toMatchObject({ level: 30, bestScore: 5000, totalRuns: 42 });
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

describe('Vergleich mit einem Cloud-Stand aelterer Fassung', () => {
  // Regression zur Sync-Endlosschleife nach SAVE_VERSION 7 (2026-08-19):
  // Der Server liefert Staende, die vor der XP-Umstellung hochgeladen wurden.
  // Ohne Angleichung gilt so ein Stand faelschlich als "weiter", wird
  // uebernommen, dabei migriert (Level sinkt) - und beim naechsten Vergleich
  // beginnt alles von vorn. Sichtbar als Sync-Popup, das nie verschwindet.

  function remoteV6(level: number): {
    data: SaveData;
    level: number;
    bestScore: number;
    totalRuns: number;
    updatedAt: string;
  } {
    const data = createSave({ level, version: 6 });
    return {
      data,
      level,
      bestScore: data.bestScore,
      totalRuns: data.totalRuns,
      updatedAt: new Date().toISOString(),
    };
  }

  it('haelt einen v6-Stand nicht fuer voraus, wenn er migriert gleichauf liegt', async () => {
    const SaveSystem = await import('@/systems/SaveSystem');
    // Was der Server hat: Level 20, noch unter der alten Kurve.
    const remote = remoteV6(20);
    // Was lokal daraus wird, sobald migriert: dasselbe, nur eingeordnet.
    const local = SaveSystem.normalizeForComparison(remote.data);

    expect(local.level).toBeLessThan(20);
    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(false);
    expect(CloudSystem.isLocalAhead(local, remote)).toBe(false);
  });

  it('erkennt einen wirklich weiter fortgeschrittenen v6-Stand weiterhin', async () => {
    const SaveSystem = await import('@/systems/SaveSystem');
    const remote = remoteV6(40);
    const local = SaveSystem.normalizeForComparison(createSave({ level: 5, version: 6 }));

    expect(CloudSystem.isRemoteAhead(local, remote)).toBe(true);
  });

  it('erkennt einen lokal weiteren Stand weiterhin', async () => {
    const SaveSystem = await import('@/systems/SaveSystem');
    const remote = remoteV6(5);
    const local = SaveSystem.normalizeForComparison(createSave({ level: 40, version: 6 }));

    expect(CloudSystem.isLocalAhead(local, remote)).toBe(true);
  });
});

describe('Muenzen: Ausgeben ist kein Rueckschritt', () => {
  // Regression zum Fund vom 2026-08-20: Ein Kauf im Laden bucht Muenzen
  // lokal ab. Verglich `isRemoteAhead()` nur den Kontostand, galt der
  // Cloud-Stand danach als weiter, wurde uebernommen - und machte den Kauf
  // rueckgaengig. Die gekaufte Figur blitzte im Menue kurz auf und sprang
  // auf den Standard zurueck.

  const alsRemote = (save: SaveData) => ({
    data: save,
    level: save.level,
    bestScore: save.bestScore,
    totalRuns: save.totalRuns,
    updatedAt: new Date().toISOString(),
  });

  it('haelt einen Kauf nicht fuer einen Rueckschritt', () => {
    const vorKauf = createSave({ coins: 1000, coinsSpent: 0, level: 10 });
    const nachKauf = createSave({ coins: 500, coinsSpent: 500, level: 10 });

    expect(CloudSystem.isRemoteAhead(nachKauf, alsRemote(vorKauf))).toBe(false);
    expect(CloudSystem.isLocalAhead(nachKauf, alsRemote(vorKauf))).toBe(false);
  });

  it('erkennt echt dazuverdiente Muenzen weiterhin', () => {
    const lokal = createSave({ coins: 500, coinsSpent: 500, level: 10 });
    const reicher = createSave({ coins: 900, coinsSpent: 500, level: 10 });

    expect(CloudSystem.isRemoteAhead(lokal, alsRemote(reicher))).toBe(true);
  });

  it('erkennt lokal dazuverdiente Muenzen weiterhin', () => {
    const lokal = createSave({ coins: 900, coinsSpent: 500, level: 10 });
    const aermer = createSave({ coins: 500, coinsSpent: 500, level: 10 });

    expect(CloudSystem.isLocalAhead(lokal, alsRemote(aermer))).toBe(true);
  });
});

describe('Wartungs-Reset erkennen', () => {
  // Ein zurueckgesetztes Profil ist nie "weiter" - `isRemoteAhead()` meldet
  // dort `false`. Ohne eigene Erkennung passierte nach einem Reset gar
  // nichts: Der lokale Stand blieb stehen, und der naechste Lauf lud die
  // alten Werte samt Ladenkaeufen wieder hoch.

  const alsRemote = (save: SaveData) => ({
    data: save,
    level: save.level,
    bestScore: save.bestScore,
    totalRuns: save.totalRuns,
    updatedAt: new Date().toISOString(),
  });

  it('erkennt einen geleerten Cloud-Stand bei bespieltem lokalem Stand', () => {
    const lokal = createSave({ level: 30, totalRuns: 40, bestScore: 5000, coins: 500 });
    const leer = createSave({ level: 1, xp: 0, totalRuns: 0, bestScore: 0, coins: 0 });

    expect(CloudSystem.isRemoteReset(lokal, alsRemote(leer))).toBe(true);
    // Der normale Vergleich sieht darin keinen Fortschritt - genau deshalb
    // braucht es die eigene Frage.
    expect(CloudSystem.isRemoteAhead(lokal, alsRemote(leer))).toBe(false);
  });

  it('haelt ein frisches Profil nicht fuer einen Reset', () => {
    // Wer noch nie gespielt hat, hat auch nichts zu verlieren. Ohne diese
    // Unterscheidung verloere ein Neuling seine ersten Kaeufe.
    const neuling = createSave({ level: 1, xp: 0, totalRuns: 0, bestScore: 0 });
    const leer = createSave({ level: 1, xp: 0, totalRuns: 0, bestScore: 0 });

    expect(CloudSystem.isRemoteReset(neuling, alsRemote(leer))).toBe(false);
  });

  it('erkennt den Reset auch, wenn beide Seiten auf Stufe 1 stehen', () => {
    // Der Fall aus dem Debug-Report vom 2026-08-20: Nach einem frueheren
    // Reset steht auch lokal Stufe 1 ohne Runs - offen sind nur noch die
    // Ladenkaeufe. Ein Signal, das Spielzeit verlangt, greift dort nicht.
    const lokal = createSave({
      level: 1,
      totalRuns: 0,
      bestScore: 0,
      ownedShipShapes: ['arrow', 'star', 'eagle'],
      ownedShipColors: ['world', 'gold'],
    });
    const leer = createSave({ level: 1, totalRuns: 0, bestScore: 0 });

    expect(CloudSystem.isRemoteReset(lokal, alsRemote(leer))).toBe(true);
  });

  it('erkennt den Reset auch bei ausschliesslich gekauften Auren', () => {
    // Audit 2026-08-23: Die Auren kamen als dritte Besitzkategorie dazu und
    // fehlten im Reset-Signal - geprueft wurden nur Formen und Farben. Wer
    // ausschliesslich eine Aura gekauft hatte, loeste deshalb kein Signal
    // aus, und der Reset blieb wirkungslos. Neun der zehn Auren stehen ohne
    // Mindestlevel im Laden, der Fall ist also schon auf Stufe 1 erreichbar.
    const lokal = createSave({
      level: 1,
      totalRuns: 0,
      bestScore: 0,
      ownedShipAuras: [DEFAULT_SHIP_AURA, 'wingbeat'],
    });
    const leer = createSave({ level: 1, totalRuns: 0, bestScore: 0 });

    expect(CloudSystem.isRemoteReset(lokal, alsRemote(leer))).toBe(true);
  });

  it('laesst sich vom taeglichen Login-Bonus nicht taeuschen', () => {
    // `claim_daily_login_bonus()` schreibt direkt nach jedem Abgleich +25
    // Muenzen. Ein Signal ueber `coins === 0` haelt deshalb keine zwei
    // Sekunden - im Report war der Reset genau einen Sync lang sichtbar.
    const lokal = createSave({ level: 30, totalRuns: 40, bestScore: 5000 });
    const nachBonus = createSave({
      level: 1,
      xp: 0,
      totalRuns: 0,
      bestScore: 0,
      coins: 25,
      totalCoinsEarned: 25,
    });

    expect(CloudSystem.isRemoteReset(lokal, alsRemote(nachBonus))).toBe(true);
  });

  it('haelt einen normalen Rueckstand nicht fuer einen Reset', () => {
    // Ein zweites Geraet, das nur weniger weit ist, darf nichts loeschen.
    const lokal = createSave({ level: 30, totalRuns: 40, bestScore: 5000 });
    const hinterher = createSave({ level: 12, totalRuns: 8, bestScore: 900 });

    expect(CloudSystem.isRemoteReset(lokal, alsRemote(hinterher))).toBe(false);
  });
});
