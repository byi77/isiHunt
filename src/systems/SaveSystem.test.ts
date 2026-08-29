/**
 * Regressionstest fuer den Migrations-Persistenzfehler aus dem Audit
 * (docs/AUDIT_2026-08-17.md, Abschnitt 5.1): schlaegt das Schreiben des
 * migrierten Stands fehl, darf der bereits migrierte Stand nicht durch
 * `createDefaultSave()` ersetzt werden.
 *
 * `SaveSystem` haelt den Spielstand in einem Modul-Cache - vor jedem Test
 * wird das Modul neu geladen (`resetModules`), sonst traegt ein Test den
 * Stand des vorigen mit (siehe ProgressionSystem.test.ts).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SAVE_KEY, SAVE_VERSION } from '@/config/GameConfig';
import type * as SaveSystemModule from '@/systems/SaveSystem';
import type { SaveData } from '@/types';

let SaveSystem: typeof SaveSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  SaveSystem = await import('@/systems/SaveSystem');
});

describe('SaveSystem.load Migration', () => {
  it('behaelt den migrierten Stand, wenn das Persistieren fehlschlaegt', async () => {
    // Alter Stand (version 3) mit erkennbar echtem Fortschritt, damit ein
    // Rueckfall auf createDefaultSave() (level 1, coins 0) sichtbar waere.
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 3, level: 12, xp: 100, coins: 500, talentPoints: 3 }),
    );

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError (simuliert)');
    });

    const data = SaveSystem.load();

    // Level 12 unter der v6-Kurve wird durch die XP-Umstellung vom
    // 2026-08-19 zu Level 9. Entscheidend ist hier nicht die Zahl, sondern
    // dass der Stand NICHT auf createDefaultSave() (Level 1, 0 Coins)
    // zurueckfaellt, wenn nur das Schreiben scheitert.
    expect(data.level).toBe(9);
    expect(data.coins).toBeGreaterThan(0);

    setItemSpy.mockRestore();
  });

  it('persistiert den migrierten Stand normal, wenn setItem funktioniert', async () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 3, level: 5, xp: 0, coins: 100, talentPoints: 2 }),
    );

    const data = SaveSystem.load();
    const persisted = JSON.parse(window.localStorage.getItem(SAVE_KEY)!) as { version: number };

    expect(persisted.version).toBe(data.version);
  });

  /**
   * Regressionstest zum Audit 2026-08-19: Ein Stand aus der Zeit vor der
   * Versionierung hat gar kein `version`-Feld. `load()` las diese Luecke als
   * `SAVE_VERSION` (also "aktuell"), `migrate()` dagegen als 1 - der Stand
   * wurde migriert, die Migration aber nicht geschrieben.
   *
   * Die beiden vorhandenen Tests konnten das nicht sehen: Beide setzen
   * `version` explizit. Genau die Luecke, die der Fall beschreibt, war in
   * ihren Fixtures nie vorhanden.
   */
  it('persistiert die Migration auch, wenn der Stand gar kein version-Feld hat', async () => {
    // Kein `version`-Feld - wie ein Stand aus der Zeit vor SAVE_VERSION.
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ level: 5, xp: 0, coins: 0, talentPoints: 3 }),
    );

    const data = SaveSystem.load();
    const persisted = JSON.parse(window.localStorage.getItem(SAVE_KEY)!) as Partial<SaveData>;

    // Die Migration hat stattgefunden: Talentpunkte sind in Coins gewandelt
    // (v4) und die Level-Coins nachgetragen (v5).
    expect(data.talentPoints).toBe(0);
    expect(data.coins).toBeGreaterThan(0);

    // Und sie steht auf der Platte - sonst laeuft sie bei jedem Start erneut.
    expect(persisted.version).toBe(SAVE_VERSION);
    expect(persisted.coins).toBe(data.coins);
  });

  it('setzt den bisherigen Produktionsstand fuer die kostenlose Talentwirtschaft zurueck', async () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...SaveSystem.load(),
        version: SAVE_VERSION - 1,
        level: 30,
        xp: 100,
        talentPoints: 3,
        coins: 5000,
        talents: { reach: 4 },
        totalRuns: 80,
        playerName: 'Testprofil',
      }),
    );

    vi.resetModules();
    const migrated = (await import('@/systems/SaveSystem')).load();

    expect(migrated.level).toBe(1);
    expect(migrated.xp).toBe(0);
    expect(migrated.talentPoints).toBe(0);
    expect(migrated.coins).toBe(0);
    expect(migrated.talents).toEqual({});
    expect(migrated.totalRuns).toBe(0);
    expect(migrated.playerName).toBe('Testprofil');
    expect(migrated.version).toBe(SAVE_VERSION);
  });

  it('archiviert einen v8-Stand vor dem sicheren Wirtschaftsmigrations-Reset', async () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_VERSION - 1, level: 30, coins: 5000, totalRuns: 80 }),
    );

    const migrated = SaveSystem.load();
    const backup = JSON.parse(window.localStorage.getItem('isihunt.pre-v9-save-backup.v1')!) as {
      version: number;
      level: number;
    };

    expect(migrated.version).toBe(SAVE_VERSION);
    expect(SaveSystem.hasLegacySaveBackup()).toBe(true);
    expect(backup).toMatchObject({ version: SAVE_VERSION - 1, level: 30 });
  });

  it('bindet das Capability-Token an die Cloud-ID und haelt es aus SaveData heraus', () => {
    const cloudId = SaveSystem.ensureCloudId();
    const token = SaveSystem.ensureCloudAccessToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(SaveSystem.getCloudAccessToken()).toBe(token);
    expect(SaveSystem.load()).not.toHaveProperty('cloudAccessToken');

    SaveSystem.clearLocalProfile();
    expect(SaveSystem.getCloudAccessToken()).toBeNull();
    expect(SaveSystem.load().cloudId).toBeNull();
    expect(cloudId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('bewahrt einen offline geaenderten Namen bei einem spaeteren Remote-Pull', async () => {
    SaveSystem.setOfflinePlayerName('OfflineName');

    const adopted = SaveSystem.adoptProfileProgress({ level: 8, playerName: 'CloudName' });

    expect(adopted.playerName).toBe('OfflineName');
    expect(adopted.pendingPlayerName).toBe('OfflineName');
  });
});

/**
 * Audit 2026-08-23: Ein verschluckter Schreibfehler ist harmlos, solange
 * danach nichts passiert, was seinen Erfolg voraussetzt. Genau das war hier
 * aber der Fall - siehe die einzelnen Tests.
 */
describe('Fehlgeschlagenes Speichern', () => {
  /** Laesst NUR die Schluessel scheitern, die `treffer` enthalten. */
  function schreibfehlerFuer(treffer: string): void {
    const echt = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(((k: string, v: string) => {
      if (k.includes(treffer)) throw new DOMException('QuotaExceededError');
      echt(k, v);
    }) as never);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  }

  it('meldet den Fehlschlag, statt still einen Erfolg vorzutaeuschen', async () => {
    // Vorher gab `save()` nichts zurueck: Der Cache trug den neuen Stand,
    // jeder Aufrufer sah einen Erfolg, im Speicher stand nichts. Der Spieler
    // sammelte eine ganze Sitzung lang und fand beim Neustart alles geloescht.
    SaveSystem.load();
    schreibfehlerFuer(SAVE_KEY);

    const gelungen = SaveSystem.save({ ...SaveSystem.load(), coins: 9999 });
    vi.restoreAllMocks();

    expect(gelungen).toBe(false);
    expect(SaveSystem.lastSaveFailed()).toBe(true);
    const syncStatus = await import('@/systems/SyncStatusSystem');
    expect(syncStatus.hasLocalSaveFailure()).toBe(true);
    // Die laufende Sitzung bleibt spielbar - nur gilt sie nicht als gesichert.
    expect(SaveSystem.load().coins).toBe(9999);
  });

  it('meldet nach einem gelungenen Schreibvorgang wieder Erfolg', async () => {
    SaveSystem.load();
    schreibfehlerFuer(SAVE_KEY);
    SaveSystem.save({ ...SaveSystem.load(), coins: 1 });
    vi.restoreAllMocks();

    expect(SaveSystem.save({ ...SaveSystem.load(), coins: 2 })).toBe(true);
    expect(SaveSystem.lastSaveFailed()).toBe(false);
    const syncStatus = await import('@/systems/SyncStatusSystem');
    expect(syncStatus.hasLocalSaveFailure()).toBe(false);
  });

  it('legt KEIN Testprofil an, wenn das Backup nicht geschrieben werden kann', () => {
    // Der schwerste Fund des Audits: Die Funktion lief nach dem `catch`
    // weiter und ueberschrieb den echten Stand mit dem Testprofil - ohne
    // Backup. `disableTestProfile()` fand nichts zum Wiederherstellen, aus
    // Stufe 30 wurde Stufe 1. Der verschluckte Fehler machte damit aus einer
    // umkehrbaren Aktion eine unumkehrbare.
    SaveSystem.update((d) => {
      d.level = 30;
      d.coins = 5000;
      d.totalRuns = 120;
    });
    schreibfehlerFuer('test-profile');

    const ergebnis = SaveSystem.enableTestProfile();
    vi.restoreAllMocks();

    expect(ergebnis).toBeNull();
    // Entscheidend: Der echte Spielstand steht unveraendert da.
    const danach = SaveSystem.load();
    expect(danach.level).toBe(30);
    expect(danach.coins).toBe(5000);
    expect(danach.totalRuns).toBe(120);
    expect(SaveSystem.isTestProfileActive()).toBe(false);
  });

  it('ueberschreibt beim Abschalten nichts, wenn kein Backup vorliegt', () => {
    // Ein fehlendes Backup heisst nicht "der Spieler hatte nichts", sondern
    // "wir wissen nicht mehr, was er hatte". Ein leerer Stand als Antwort
    // darauf loescht genau das, was noch zu retten waere.
    SaveSystem.update((d) => {
      d.level = 30;
      d.coins = 5000;
    });

    expect(SaveSystem.disableTestProfile()).toBeNull();
    expect(SaveSystem.load().level).toBe(30);
    expect(SaveSystem.load().coins).toBe(5000);
  });

  it('stellt den Stand wieder her, wenn ein Backup vorliegt', () => {
    // Gegenprobe: Der Normalfall darf durch die Haertung nicht leiden.
    SaveSystem.update((d) => {
      d.level = 30;
      d.coins = 5000;
    });

    expect(SaveSystem.enableTestProfile()).not.toBeNull();
    expect(SaveSystem.load().coins).toBe(99_999);

    const wieder = SaveSystem.disableTestProfile();
    expect(wieder?.level).toBe(30);
    expect(wieder?.coins).toBe(5000);
    expect(SaveSystem.isTestProfileActive()).toBe(false);
  });
});

/**
 * Audit 2026-08-23: `MenuScene` stellt den Reset ueber
 * `CloudSystem.isRemoteReset()` fest (sechs Kriterien, inklusive
 * Ladenbesitz) - und `adoptRemote()` leitete die Frage anschliessend erneut
 * her, mit schwaecheren Kriterien. Die bereits getroffene Entscheidung wurde
 * verworfen statt durchgereicht.
 */
describe('Reset-Entscheidung durchreichen', () => {
  const leererCloudStand: Partial<SaveData> = {
    level: 1,
    xp: 0,
    totalRuns: 0,
    coins: 0,
    bestScore: 0,
  };

  it('raeumt den Laden auch beim ZWEITEN Reset, wenn der Aufrufer ihn erkannt hat', () => {
    // Wer bereits einmal zurueckgesetzt wurde, steht selbst auf Stufe 1 ohne
    // Runs - die eigene Herleitung in `mergeShopOwnership` sieht darin
    // keinen "bespielten" Stand und liess die Kaeufe stehen.
    SaveSystem.update((d) => {
      d.level = 1;
      d.totalRuns = 0;
      d.ownedShipShapes = [...d.ownedShipShapes, 'eagle'];
      d.ownedShipAuras = [...d.ownedShipAuras, 'wingbeat'];
    });

    const nach = SaveSystem.adoptRemote(leererCloudStand, 'cloud-1', true);

    expect(nach.ownedShipShapes).not.toContain('eagle');
    expect(nach.ownedShipAuras).not.toContain('wingbeat');
  });

  it('behaelt ohne erkannten Reset das bisherige Verhalten', () => {
    // Gegenprobe: Der Standardwert `false` darf nichts veraendern. Ein
    // Neuling, der vor seiner ersten Anmeldung kauft, behaelt seinen Kauf.
    SaveSystem.update((d) => {
      d.level = 1;
      d.totalRuns = 0;
      d.ownedShipShapes = [...d.ownedShipShapes, 'eagle'];
    });

    const nach = SaveSystem.adoptRemote(leererCloudStand, 'cloud-1');

    expect(nach.ownedShipShapes).toContain('eagle');
  });

  it('raeumt weiterhin ohne Zutun des Aufrufers, wenn lokal Spielzeit steht', () => {
    // Die eigene Herleitung bleibt als Rueckfallebene erhalten - Aufrufer
    // ohne bessere Antwort verlieren nichts.
    SaveSystem.update((d) => {
      d.level = 30;
      d.totalRuns = 40;
      d.ownedShipShapes = [...d.ownedShipShapes, 'eagle'];
    });

    const nach = SaveSystem.adoptRemote(leererCloudStand, 'cloud-1');

    expect(nach.ownedShipShapes).not.toContain('eagle');
  });
});
