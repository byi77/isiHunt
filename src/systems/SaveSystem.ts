/**
 * Persistenz ueber localStorage.
 *
 * Gekapselt hinter einer schmalen API, damit der lokale Offline-Stand und der
 * spaetere Cloud-Abgleich getrennt bleiben. Alles Lesende geht ueber `load()`,
 * alles Schreibende ueber `save()`.
 */

import { MAX_LEVEL, SAVE_KEY, SAVE_VERSION, xpForLevel } from '@/config/GameConfig';
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
    playerName: '',
    cloudId: null,
  };
}

/**
 * Erzeugt eine UUID v4.
 *
 * `crypto.randomUUID` gibt es nur in sicheren Kontexten. Beim Testen ueber die
 * Netzwerkadresse des Dev-Servers (http://192.168.x.x:5173) ist das nicht
 * gegeben - dort faellt die Funktion sonst mit "undefined is not a function"
 * aus. `getRandomValues` steht dagegen ueberall zur Verfuegung.
 */
function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Version 4 und Variante 1 nach RFC 4122 setzen.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
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
function legacyXpForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.45));
}

/** Uebersetzt die alte XP-Kurve in die neue, ohne Fortschritt zu verschenken. */
function migrate(raw: Partial<SaveData>): SaveData {
  const save = reconcile(raw);
  if ((raw.version ?? 1) >= SAVE_VERSION) return save;

  let totalXp = save.xp;
  for (let level = 1; level < save.level; level++) totalXp += legacyXpForLevel(level);

  let level = 1;
  let xp = totalXp;
  while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
  }

  save.level = level;
  save.xp = level >= MAX_LEVEL ? 0 : xp;
  return save;
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

// --- Online-Abgleich ---------------------------------------------------------

/**
 * Liefert die Cloud-Kennung und legt sie beim ersten Aufruf an.
 *
 * Bewusst traege: Wer nie spielt bzw. keinen automatischen Upload ausloest,
 * bekommt keine Kennung und hinterlaesst damit auch nichts im Online-Speicher.
 */
export function ensureCloudId(): string {
  const existing = load().cloudId;
  if (existing) return existing;

  const id = createUuid();
  update((data) => {
    data.cloudId = id;
  });
  return id;
}

export function setPlayerName(name: string): void {
  update((data) => {
    data.playerName = name;
  });
}

/**
 * Ersetzt den lokalen Spielstand durch einen heruntergeladenen.
 *
 * Der Aufrufer muss den Nutzer vorher entscheiden lassen - hier wird nichts
 * abgewogen, sondern ueberschrieben. `reconcile()` faengt dabei ab, dass ein
 * fremder Stand aus einer aelteren Fassung Felder vermissen laesst.
 *
 * Die Cloud-Kennung wird mit uebernommen: ab jetzt zeigen beide Geraete auf
 * denselben Eintrag, und der naechste Abgleich funktioniert in beide Richtungen.
 */
export function adoptRemote(remote: Partial<SaveData>, cloudId: string): SaveData {
  const merged = migrate(remote);
  merged.cloudId = cloudId;
  save(merged);
  return merged;
}
