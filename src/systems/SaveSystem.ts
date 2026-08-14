/**
 * Persistenz ueber localStorage.
 *
 * Gekapselt hinter einer schmalen API, damit der lokale Offline-Stand und der
 * spaetere Cloud-Abgleich getrennt bleiben. Alles Lesende geht ueber `load()`,
 * alles Schreibende ueber `save()`.
 */

import {
  COINS_PER_LEVEL,
  COINS_PER_EXTRA_TALENT_POINT,
  MAX_LEVEL,
  RUN_DURATION_MS,
  SAVE_KEY,
  SAVE_VERSION,
  xpForLevel,
} from '@/config/GameConfig';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type { SaveData } from '@/types';

const TEST_PROFILE_KEY = 'isihunt.admin-test-profile.v1';
const TEST_PROFILE_BACKUP_KEY = 'isihunt.admin-test-profile-backup.v1';
export const ADMIN_TEST_PIN = '739164';

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    xp: 0,
    talentPoints: 0,
    coins: 0,
    talents: {},
    bestScore: 0,
    bestCombo: 0,
    totalScore: 0,
    totalRuns: 0,
    totalPlayTimeMs: 0,
    totalCoinsEarned: 0,
    coinsSpent: 0,
    lastDailyKey: null,
    dailyBestScore: 0,
    totalDailyRuns: 0,
    pendingDailyKey: null,
    pendingDailyCoins: 0,
    pendingDailyScore: 0,
    collected: emptyRarityCounts(),
    unlockedAchievements: [],
    lastWorldId: DEFAULT_WORLD_ID,
    soundEnabled: true,
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
    coins: Math.max(0, raw.coins ?? base.coins),
    totalPlayTimeMs: Math.max(0, raw.totalPlayTimeMs ?? (raw.totalRuns ?? 0) * RUN_DURATION_MS),
    totalCoinsEarned: Math.max(0, raw.totalCoinsEarned ?? base.totalCoinsEarned),
    coinsSpent: Math.max(0, raw.coinsSpent ?? base.coinsSpent),
    lastDailyKey: raw.lastDailyKey ?? base.lastDailyKey,
    dailyBestScore: Math.max(0, raw.dailyBestScore ?? base.dailyBestScore),
    totalDailyRuns: Math.max(0, raw.totalDailyRuns ?? base.totalDailyRuns),
    pendingDailyKey: raw.pendingDailyKey ?? base.pendingDailyKey,
    pendingDailyCoins: Math.max(0, raw.pendingDailyCoins ?? base.pendingDailyCoins),
    pendingDailyScore: Math.max(0, raw.pendingDailyScore ?? base.pendingDailyScore),
    soundEnabled: raw.soundEnabled ?? base.soundEnabled,
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
  const rawVersion = raw.version ?? 1;
  if (rawVersion >= SAVE_VERSION) return save;

  // Version 1 hatte noch die alte XP-Kurve. Version 2 bekam bereits die
  // aktuelle Kurve; Version 3 fuegt nur das Coins-Feld hinzu.
  if (rawVersion < 2) {
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
  }
  if (rawVersion < 4) {
    // Talentpunkte waren vor Phase 4 eine separate Währung. Nichts verlieren:
    // vorhandene Punkte werden beim Wechsel in Coins umgewandelt.
    save.coins += save.talentPoints * COINS_PER_EXTRA_TALENT_POINT;
    save.talentPoints = 0;
  }
  if (rawVersion < 5) {
    // Beim Wechsel auf die reine Coin-Waehrung werden die bisher nicht
    // gutgeschriebenen Level-Coins einmalig nachgetragen.
    save.coins += Math.max(0, save.level - 1) * COINS_PER_LEVEL;
  }
  return save;
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;

  try {
    const stored = window.localStorage.getItem(SAVE_KEY);
    const raw = stored ? (JSON.parse(stored) as Partial<SaveData>) : null;
    const rawVersion = raw?.version ?? SAVE_VERSION;
    cache = raw ? migrate(raw) : createDefaultSave();

    // Migrationen müssen sofort persistiert werden. Sonst würde ein alter
    // Spielstand nach jedem Browser-/App-Neustart erneut Talentpunkte und
    // Level-Coins umwandeln und die Währung vervielfachen.
    if (raw && rawVersion < SAVE_VERSION) {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(cache));
    }
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

/** True, wenn der lokale Wartungs-Teststand aktiv ist. */
export function isTestProfileActive(): boolean {
  try {
    return window.localStorage.getItem(TEST_PROFILE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Aktiviert einen lokalen Teststand, ohne den normalen Spielstand zu verlieren. */
export function enableTestProfile(): SaveData {
  if (isTestProfileActive()) return load();

  const original = structuredClone(load());
  try {
    window.localStorage.setItem(TEST_PROFILE_BACKUP_KEY, JSON.stringify(original));
    window.localStorage.setItem(TEST_PROFILE_KEY, '1');
  } catch (error) {
    console.warn('[SaveSystem] Testprofil nicht aktivierbar.', error);
  }

  const testProfile = {
    ...original,
    level: MAX_LEVEL,
    xp: 0,
    talentPoints: 0,
    coins: 99_999,
    talents: {},
    totalCoinsEarned: Math.max(original.totalCoinsEarned, 99_999),
    pendingDailyKey: null,
    pendingDailyCoins: 0,
    pendingDailyScore: 0,
    cloudId: null,
  } satisfies SaveData;
  save(testProfile);
  return testProfile;
}

/** Deaktiviert den lokalen Teststand und stellt den vorherigen Stand wieder her. */
export function disableTestProfile(): SaveData {
  let backup: Partial<SaveData> | null = null;
  try {
    const raw = window.localStorage.getItem(TEST_PROFILE_BACKUP_KEY);
    backup = raw ? (JSON.parse(raw) as Partial<SaveData>) : null;
    window.localStorage.removeItem(TEST_PROFILE_KEY);
    window.localStorage.removeItem(TEST_PROFILE_BACKUP_KEY);
  } catch (error) {
    console.warn('[SaveSystem] Testprofil nicht deaktivierbar.', error);
  }

  const restored = backup ? migrate(backup) : createDefaultSave();
  save(restored);
  return restored;
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

/** Übernimmt den gemeinsamen Auth-Profilstand und bewahrt die lokale Sync-ID. */
export function adoptProfileProgress(remote: Partial<SaveData>): SaveData {
  const merged = migrate(remote);
  merged.cloudId = load().cloudId;
  save(merged);
  return merged;
}
