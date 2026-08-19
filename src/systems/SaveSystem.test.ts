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
});
