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

import { SAVE_KEY } from '@/config/GameConfig';
import type * as SaveSystemModule from '@/systems/SaveSystem';

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

    expect(data.level).toBe(12);
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
});
