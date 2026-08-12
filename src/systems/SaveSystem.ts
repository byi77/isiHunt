/**
 * Persistenz ueber localStorage.
 *
 * Gekapselt hinter einer schmalen API, damit ein spaeterer Wechsel auf Cloud-
 * Saves (siehe docs/ROADMAP.md, M5) nur diese Datei anfasst. Alles Lesende
 * geht ueber `load()`, alles Schreibende ueber `save()`.
 */

import { SAVE_KEY, SAVE_VERSION } from '@/config/GameConfig';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type { SaveData } from '@/types';

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    xp: 0,
    talentPoints: 0,
    talents: {},
    bestScore: 0,
    bestCombo: 0,
    totalScore: 0,
    totalRuns: 0,
    collected: emptyRarityCounts(),
    unlockedAchievements: [],
    lastWorldId: DEFAULT_WORLD_ID,
  };
}

/**
 * Fuellt fehlende Felder aus dem Default auf. Schuetzt gegen halb geschriebene
 * oder aeltere Staende, ohne dass jede Feld-Ergaenzung eine Migration braucht.
 */
function reconcile(raw: Partial<SaveData>): SaveData {
  const base = createDefaultSave();
  return {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    collected: { ...base.collected, ...(raw.collected ?? {}) },
    talents: { ...base.talents, ...(raw.talents ?? {}) },
    unlockedAchievements: raw.unlockedAchievements ?? base.unlockedAchievements,
  };
}

/**
 * Migriert einen Spielstand auf SAVE_VERSION.
 * Neue Versionen hier ergaenzen - niemals alte Zweige loeschen.
 */
function migrate(raw: Partial<SaveData>): SaveData {
  // Version 1 ist die erste - es gibt (noch) nichts zu migrieren.
  return reconcile(raw);
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;

  try {
    const stored = window.localStorage.getItem(SAVE_KEY);
    cache = stored ? migrate(JSON.parse(stored) as Partial<SaveData>) : createDefaultSave();
  } catch (error) {
    // Privater Modus, volles Quota, kaputtes JSON: nie den Start blockieren.
    console.warn('[SaveSystem] Spielstand nicht lesbar, starte neu.', error);
    cache = createDefaultSave();
  }

  return cache;
}

export function save(data: SaveData): void {
  cache = data;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[SaveSystem] Spielstand nicht speicherbar.', error);
  }
}

/** Liest, veraendert und schreibt in einem Schritt. */
export function update(mutator: (data: SaveData) => void): SaveData {
  const data = structuredClone(load());
  mutator(data);
  save(data);
  return data;
}

/** Setzt den Spielstand zurueck (Debug-Taste / spaeter Einstellungsmenue). */
export function reset(): SaveData {
  const fresh = createDefaultSave();
  save(fresh);
  return fresh;
}
