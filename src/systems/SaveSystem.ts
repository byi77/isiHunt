/**
 * Persistenz ueber localStorage.
 *
 * Gekapselt hinter einer schmalen API, damit der lokale Offline-Stand und der
 * spaetere Cloud-Abgleich getrennt bleiben. Alles Lesende geht ueber `load()`,
 * alles Schreibende ueber `save()`.
 */

import {
  COINS_PER_EXTRA_TALENT_POINT,
  COINS_PER_LEVEL,
  MAX_LEVEL,
  RUN_DURATION_MS,
  SAVE_KEY,
  SAVE_VERSION,
  xpForLevel,
} from '@/config/GameConfig';
import { emptyRarityCounts, RARITY_IDS } from '@/config/rarities';
import {
  DEFAULT_SHIP_AURA,
  DEFAULT_SHIP_COLOR,
  DEFAULT_SHIP_SHAPE,
  shapesEarnedByLegacyLevel,
} from '@/config/shop';
import { TALENTS } from '@/config/talents';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type { SaveData } from '@/types';

const TEST_PROFILE_KEY = 'isihunt.admin-test-profile.v1';
const TEST_PROFILE_BACKUP_KEY = 'isihunt.admin-test-profile-backup.v1';
const CLOUD_ACCESS_TOKEN_KEY = 'isihunt.cloud-access-token.v1';
const LEGACY_SAVE_BACKUP_KEY = 'isihunt.pre-v9-save-backup.v1';
/**
 * PIN vor dem lokalen Wartungsbereich.
 *
 * **Das ist keine Zugriffskontrolle, sondern eine Verwechslungsbremse.** Die
 * Zahl steht im ausgelieferten Bundle und ist dort von jedem lesbar, der die
 * JS-Datei oeffnet - ein Geheimnis im Client-Code ist keins. Sie verhindert
 * das versehentliche Hineinstolpern nach der Versions-Geste, nicht den
 * absichtlichen Zugriff.
 *
 * Tragbar ist das, weil dahinter nichts Gefaehrliches liegt: Der Bereich
 * zeigt Diagnose, prueft auf Updates und erzwingt ein Neuladen. Der
 * Spielstand-Reset ist ueber `AdminScene.RESET_ENABLED` abgeschaltet, das
 * lokale Testprofil aus dem Menue entfernt.
 *
 * Die echte Absicherung liegt serverseitig: `admin_reset_user()` und
 * `admin_boost_user()` pruefen `is_admin` in der Datenbank (siehe
 * `supabase/phase_2_7_admin_tools.sql`). Fremde Profile sind ueber diesen
 * Weg nicht erreichbar.
 *
 * **Wer hier eine Aktion mit echter Wirkung ergaenzt, muss sie serverseitig
 * absichern** - diese PIN traegt sie nicht (Audit 2026-08-23).
 */
export const MAINTENANCE_PIN = '180870';

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
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
    newCosmeticIds: [],
    lastPurchasedCosmetic: null,
    soundEnabled: true,
    hapticsEnabled: true,
    playerName: '',
    pendingPlayerName: null,
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  const safeFallback = Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
  return Number.isFinite(number) ? Math.max(0, number) : safeFallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return Math.floor(nonNegativeNumber(value, fallback));
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStringOr(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' || value === null ? value : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
}

const COSMETIC_CATEGORIES = ['shapes', 'colors', 'auras'] as const;

function cosmeticPurchaseOr(
  value: unknown,
  fallback: SaveData['lastPurchasedCosmetic'],
): SaveData['lastPurchasedCosmetic'] {
  const entry = asRecord(value);
  return COSMETIC_CATEGORIES.includes(entry.category as (typeof COSMETIC_CATEGORIES)[number]) &&
    typeof entry.id === 'string'
    ? {
        category: entry.category as (typeof COSMETIC_CATEGORIES)[number],
        id: entry.id,
      }
    : (fallback ?? null);
}

/**
 * Fuellt fehlende Felder aus dem Default auf. Schuetzt gegen halb geschriebene
 * oder aeltere Staende, ohne dass jede Feld-Ergaenzung eine Migration braucht.
 */
function reconcile(raw: Partial<SaveData>): SaveData {
  const base = createDefaultSave();
  const source = asRecord(raw);
  const rawRuns = nonNegativeInteger(source.totalRuns, base.totalRuns);
  const ownedShipShapes = [
    ...new Set([DEFAULT_SHIP_SHAPE, ...stringArray(source.ownedShipShapes, base.ownedShipShapes)]),
  ];
  const ownedShipColors = [
    ...new Set([DEFAULT_SHIP_COLOR, ...stringArray(source.ownedShipColors, base.ownedShipColors)]),
  ];
  const ownedShipAuras = [
    ...new Set([DEFAULT_SHIP_AURA, ...stringArray(source.ownedShipAuras, base.ownedShipAuras)]),
  ];
  const collected = emptyRarityCounts();
  const rawCollected = asRecord(source.collected);
  for (const rarityId of RARITY_IDS) {
    collected[rarityId] = nonNegativeInteger(rawCollected[rarityId], 0);
  }
  const talents = { ...base.talents };
  const rawTalents = asRecord(source.talents);
  for (const talent of TALENTS) {
    const rank = rawTalents[talent.id];
    if (typeof rank === 'number' && Number.isFinite(rank)) {
      talents[talent.id] = Math.min(talent.maxRank, Math.max(0, Math.floor(rank)));
    }
  }
  const selectedShape = stringOr(source.shipShape, base.shipShape);
  const selectedColor = stringOr(source.shipColor, base.shipColor);
  const selectedAura = stringOr(source.shipAura, base.shipAura);
  return {
    ...base,
    version: SAVE_VERSION,
    level: Math.max(1, Math.min(MAX_LEVEL, nonNegativeInteger(source.level, base.level))),
    xp: nonNegativeInteger(source.xp, base.xp),
    talentPoints: nonNegativeInteger(source.talentPoints, base.talentPoints),
    coins: nonNegativeInteger(source.coins, base.coins),
    talents,
    bestScore: nonNegativeInteger(source.bestScore, base.bestScore),
    bestCombo: nonNegativeInteger(source.bestCombo, base.bestCombo),
    totalScore: nonNegativeInteger(source.totalScore, base.totalScore),
    totalRuns: rawRuns,
    totalPlayTimeMs: nonNegativeNumber(source.totalPlayTimeMs, rawRuns * RUN_DURATION_MS),
    totalCoinsEarned: nonNegativeInteger(source.totalCoinsEarned, base.totalCoinsEarned),
    coinsSpent: nonNegativeInteger(source.coinsSpent, base.coinsSpent),
    lastLoginBonusKey: nullableStringOr(source.lastLoginBonusKey, base.lastLoginBonusKey),
    lastDailyKey: nullableStringOr(source.lastDailyKey, base.lastDailyKey),
    dailyBestScore: nonNegativeInteger(source.dailyBestScore, base.dailyBestScore),
    totalDailyRuns: nonNegativeInteger(source.totalDailyRuns, base.totalDailyRuns),
    pendingDailyKey: nullableStringOr(source.pendingDailyKey, base.pendingDailyKey),
    pendingDailyEventId: nullableStringOr(source.pendingDailyEventId, base.pendingDailyEventId),
    pendingDailyCoins: nonNegativeInteger(source.pendingDailyCoins, base.pendingDailyCoins),
    pendingDailyScore: nonNegativeInteger(source.pendingDailyScore, base.pendingDailyScore),
    bestScoreRecordedAt:
      typeof source.bestScoreRecordedAt === 'string' &&
      Number.isFinite(Date.parse(source.bestScoreRecordedAt))
        ? new Date(source.bestScoreRecordedAt).toISOString()
        : base.bestScoreRecordedAt,
    collected,
    unlockedAchievements: stringArray(source.unlockedAchievements, base.unlockedAchievements),
    lastWorldId: stringOr(source.lastWorldId, base.lastWorldId),
    // Der Pfeil und die Weltfarbe gehoeren immer dazu - sonst stuende ein
    // Spieler ohne Schiff da, wenn eine Liste beschaedigt ankommt.
    ownedShipShapes,
    ownedShipColors,
    ownedShipAuras,
    shipShape: ownedShipShapes.includes(selectedShape) ? selectedShape : DEFAULT_SHIP_SHAPE,
    shipColor: ownedShipColors.includes(selectedColor) ? selectedColor : DEFAULT_SHIP_COLOR,
    shipAura: ownedShipAuras.includes(selectedAura) ? selectedAura : DEFAULT_SHIP_AURA,
    newCosmeticIds: stringArray(source.newCosmeticIds, base.newCosmeticIds ?? []),
    lastPurchasedCosmetic: cosmeticPurchaseOr(
      source.lastPurchasedCosmetic,
      base.lastPurchasedCosmetic,
    ),
    soundEnabled:
      typeof source.soundEnabled === 'boolean' ? source.soundEnabled : base.soundEnabled,
    hapticsEnabled:
      typeof source.hapticsEnabled === 'boolean' ? source.hapticsEnabled : base.hapticsEnabled,
    playerName: stringOr(source.playerName, base.playerName),
    pendingPlayerName: nullableStringOr(source.pendingPlayerName, base.pendingPlayerName ?? null),
    cloudId: nullableStringOr(source.cloudId, base.cloudId),
  };
}

function legacyXpForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.45));
}

/** Die historischen XP-Kurven bleiben fuer alte Migrationsdaten eingefroren. */
function xpForLevelV6(level: number): number {
  return level >= MAX_LEVEL ? 0 : Math.floor(750 * Math.sqrt(level) + 8 * Math.pow(level, 1.25));
}

function redistributeXp(
  save: SaveData,
  alteKurve: (level: number) => number,
  neueKurve: (level: number) => number,
): void {
  let gesamtXp = save.xp;
  for (let level = 1; level < save.level; level++) gesamtXp += alteKurve(level);

  let level = 1;
  let rest = gesamtXp;
  while (level < MAX_LEVEL && rest >= neueKurve(level)) {
    rest -= neueKurve(level);
    level += 1;
  }

  save.level = level;
  save.xp = level >= MAX_LEVEL ? 0 : rest;
}

/**
 * Version eines eingelesenen Standes.
 *
 * Fehlt das Feld, stammt der Stand aus der Zeit vor der Versionierung - das
 * ist Version 1, nicht die aktuelle. `load()` und `migrate()` lasen dieselbe
 * Luecke zeitweise verschieden (`?? 1` gegen `?? SAVE_VERSION`); ein Stand
 * ohne Feld wurde dadurch zwar migriert, die Migration aber nicht
 * geschrieben (Audit 2026-08-19). Beide Stellen fragen jetzt hier.
 */
function versionOf(raw: Partial<SaveData>): number {
  const version = asRecord(raw).version;
  return typeof version === 'number' && Number.isFinite(version) ? Math.floor(version) : 1;
}

/**
 * Startet bestehende Teststaende fuer die neue Talentpunkt-Wirtschaft sauber
 * neu. Profilidentitaet und lokale Einstellungen bleiben erhalten; Fortschritt,
 * Besitz und Wirtschaft werden auf den frischen Spielstand gesetzt.
 */
function resetForTalentPointEconomy(save: SaveData): SaveData {
  const fresh = createDefaultSave();
  return {
    ...fresh,
    playerName: save.playerName,
    pendingPlayerName: save.pendingPlayerName,
    cloudId: save.cloudId,
    soundEnabled: save.soundEnabled,
    hapticsEnabled: save.hapticsEnabled,
  };
}

/** Uebersetzt die alte XP-Kurve in die neue, ohne Fortschritt zu verschenken. */
function migrate(raw: Partial<SaveData>): SaveData {
  const save = reconcile(raw);
  const rawVersion = versionOf(raw);
  if (rawVersion >= SAVE_VERSION) {
    if (save.level >= MAX_LEVEL) save.xp = 0;
    return save;
  }

  // Die bisherige Fassung nutzte Coins fuer Talente. Da die vorhandenen
  // Profile ausdruecklich nur Testdaten sind, gibt es keine Umrechnung: Alle
  // alten Fortschrittsstaende beginnen mit der neuen kostenlosen Wirtschaft.
  if (rawVersion === SAVE_VERSION - 1) return resetForTalentPointEconomy(save);

  // Version 1 hatte noch die alte XP-Kurve. Version 2 bekam bereits die
  // aktuelle Kurve; Version 3 fuegt nur das Coins-Feld hinzu.
  if (rawVersion < 2) {
    // Gegen die damals aktuelle Kurve rechnen (xpForLevelV6), nicht gegen die
    // heutige - sonst laeuft ein v1-Stand durch zwei Umrechnungen.
    redistributeXp(save, legacyXpForLevel, xpForLevelV6);
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
  if (rawVersion < 7) {
    // Neue XP-Kurve (2026-08-19): Die gesamte gesammelte XP wird auf sie
    // umgelegt. Das kann das Level senken - die neue Kurve verlangt in den
    // fruehen Stufen mehr XP als die alte, und wer schon oben ist, hat diese
    // Differenz nie bezahlt. Bewusst so entschieden: Die Kurve soll fuer alle
    // dieselbe sein, auch rueckwirkend.
    redistributeXp(save, xpForLevelV6, xpForLevel);
  }
  if (rawVersion < 8) {
    // Die Schiffsformen haengen nicht mehr am Level, sondern werden im Laden
    // gekauft. Wer eine Form ueber sein Level bereits freigeschaltet hatte,
    // behaelt sie - das Update soll niemandem etwas wegnehmen.
    //
    // Wichtig: gegen das Level VOR der XP-Umstellung pruefen waere falsch,
    // denn `save.level` ist an dieser Stelle bereits neu eingeordnet. Genau
    // das ist gewollt: Massgeblich ist, was der Spieler jetzt sieht.
    save.ownedShipShapes = [
      ...new Set([...save.ownedShipShapes, ...shapesEarnedByLegacyLevel(save.level)]),
    ];
  }
  if (save.level >= MAX_LEVEL) save.xp = 0;
  return save;
}

/**
 * Bringt einen fremden Spielstand auf die aktuelle Fassung, ohne ihn zu
 * speichern - fuer Vergleiche zwischen lokalem und Cloud-Stand.
 *
 * **Warum das noetig ist.** Ein Cloud-Stand, der vor einer Migration
 * hochgeladen wurde, traegt noch die alten Werte. Wird er ungefiltert mit dem
 * bereits migrierten lokalen Stand verglichen, wirkt er faelschlich "weiter".
 * Genau das erzeugte nach der XP-Umstellung (SAVE_VERSION 7) eine
 * Endlosschleife: Der Server lieferte Level 20, lokal stand nach der
 * Migration 14, also galt der Remote-Stand als voraus. `adoptRemote()`
 * migrierte ihn beim Uebernehmen wieder auf 14 - und beim naechsten Vergleich
 * begann alles von vorn, samt Scene-Neustart und Sync-Popup.
 */
export function normalizeForComparison(raw: Partial<SaveData>): SaveData {
  return migrate(raw);
}

let cache: SaveData | null = null;
let saveFailed = false;

export function load(): SaveData {
  if (cache) return cache;

  try {
    const stored = window.localStorage.getItem(SAVE_KEY);
    const raw = stored ? (JSON.parse(stored) as Partial<SaveData>) : null;
    const rawVersion = raw ? versionOf(raw) : SAVE_VERSION;
    // v8 wird in Phase 2.23 absichtlich auf die neue Talentwirtschaft gesetzt.
    // Vor dem Reset muss der lokale Rohstand aber mindestens einmal separat
    // archiviert sein. Sonst kann ein voller/private localStorage den alten
    // Stand unwiederbringlich machen (Audit Punkt 6).
    const legacyBackupReady = rawVersion !== SAVE_VERSION - 1 || !raw || backupLegacySave(raw);
    cache = raw
      ? rawVersion === SAVE_VERSION - 1 && !legacyBackupReady
        ? reconcile(raw)
        : migrate(raw)
      : createDefaultSave();

    // Migrationen müssen sofort persistiert werden. Sonst würde ein alter
    // Spielstand nach jedem Browser-/App-Neustart erneut Talentpunkte und
    // Level-Coins umwandeln und die Währung vervielfachen. Eigener
    // try/catch: schlägt nur das Schreiben fehl (Quota, privater Modus),
    // bleibt der bereits migrierte Stand im Speicher gültig - der äußere
    // catch würde ihn sonst faelschlich durch einen leeren Stand ersetzen.
    if (raw && rawVersion < SAVE_VERSION && legacyBackupReady) {
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.warn(
          '[SaveSystem] Migration nicht persistierbar, Stand bleibt im Speicher.',
          error,
        );
      }
    }
  } catch (error) {
    // Privater Modus, volles Quota, kaputtes JSON: nie den Start blockieren.
    console.warn('[SaveSystem] Spielstand nicht lesbar, starte neu.', error);
    cache = createDefaultSave();
  }

  return cache;
}

/**
 * Schreibt den Spielstand und meldet, **ob** das gelungen ist.
 *
 * Der Rueckgabewert ist keine Formsache. Vorher verschluckte diese Funktion
 * den Fehlschlag (volles Quota, privater Modus) still: Der Modul-Cache trug
 * den neuen Stand, jeder Aufrufer sah einen Erfolg, im Speicher stand nichts.
 * Der Spieler sammelte eine ganze Sitzung lang Muenzen und Level und fand
 * beim naechsten Start alles davon geloescht - die einzige Spur war ein
 * `console.warn`, das auf einem Handy niemand sieht (Audit 2026-08-23).
 *
 * Der Cache wird trotzdem gesetzt: Die laufende Sitzung soll weiterspielbar
 * bleiben. Nur darf das niemand mehr mit "ist gespeichert" verwechseln.
 */
export function save(data: SaveData): boolean {
  cache = data;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    saveFailed = false;
    return true;
  } catch (error) {
    console.warn('[SaveSystem] Spielstand nicht speicherbar.', error);
    saveFailed = true;
    return false;
  }
}

/**
 * Ob der letzte Schreibversuch fehlschlug.
 *
 * Bewusst im Speicher statt im Spielstand: Ein Stand, der sich nicht
 * schreiben laesst, kann diese Information auch nicht mitschreiben.
 */
export function lastSaveFailed(): boolean {
  return saveFailed;
}

/**
 * Liest, veraendert und schreibt in einem Schritt.
 *
 * Ob der Schreibvorgang gelang, beantwortet `lastSaveFailed()` - der
 * Rueckgabewert bleibt der neue Stand, damit die Aufrufer unveraendert
 * weiterarbeiten koennen.
 */
export function update(mutator: (data: SaveData) => void): SaveData {
  const data = structuredClone(load());
  mutator(data);
  save(data);
  return data;
}

/** Merkt einen Kauf fuer die Shop-Uebersicht als neu und zuletzt gekauft. */
export function recordCosmeticPurchase(
  category: 'shapes' | 'colors' | 'auras',
  id: string,
): SaveData {
  return update((data) => {
    const key = `${category}:${id}`;
    data.newCosmeticIds = [...new Set([...(data.newCosmeticIds ?? []), key])];
    data.lastPurchasedCosmetic = { category, id };
  });
}

/** Entfernt die Neu-Markierung des besuchten Shop-Reiters. */
export function markCosmeticsSeen(category: 'shapes' | 'colors' | 'auras'): SaveData {
  const prefix = `${category}:`;
  return update((data) => {
    data.newCosmeticIds = (data.newCosmeticIds ?? []).filter((key) => !key.startsWith(prefix));
  });
}

/** Setzt den Spielstand zurueck (Debug-Taste / spaeter Einstellungsmenue). */
export function reset(): SaveData {
  const fresh = createDefaultSave();
  clearCloudAccessToken();
  save(fresh);
  return fresh;
}

/**
 * Entfernt den auf diesem Gerät zwischengespeicherten Profilstand nach einer
 * Abmeldung. Der Cloud-Stand bleibt unverändert und wird beim nächsten Login
 * wieder geladen. Geräteeinstellungen wie der Ton bleiben erhalten.
 */
export function clearLocalProfile(): SaveData {
  const current = load();
  const fresh = createDefaultSave();
  fresh.soundEnabled = current.soundEnabled;
  fresh.hapticsEnabled = current.hapticsEnabled;
  clearCloudAccessToken();
  save(fresh);
  return fresh;
}

interface StoredCloudAccessToken {
  cloudId: string;
  token: string;
}

function isCloudAccessToken(value: unknown): value is StoredCloudAccessToken {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredCloudAccessToken>;
  return (
    typeof candidate.cloudId === 'string' &&
    candidate.cloudId.length > 0 &&
    typeof candidate.token === 'string' &&
    /^[a-f0-9]{64}$/i.test(candidate.token)
  );
}

/** Liest das lokale Save-Capability-Token nur fuer die aktuelle Cloud-ID. */
export function getCloudAccessToken(): string | null {
  const cloudId = load().cloudId;
  if (!cloudId) return null;

  try {
    const raw = window.localStorage.getItem(CLOUD_ACCESS_TOKEN_KEY);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    return isCloudAccessToken(stored) && stored.cloudId === cloudId ? stored.token : null;
  } catch {
    return null;
  }
}

/** Speichert ein vom Server ausgestelltes Token, ohne es im Spielstand abzulegen. */
export function setCloudAccessToken(token: string, cloudId = load().cloudId): boolean {
  if (!cloudId || !/^[a-f0-9]{64}$/i.test(token)) return false;
  try {
    window.localStorage.setItem(CLOUD_ACCESS_TOKEN_KEY, JSON.stringify({ cloudId, token }));
    return true;
  } catch (error) {
    console.warn('[SaveSystem] Cloud-Zugriffstoken nicht speicherbar.', error);
    return false;
  }
}

/** Erzeugt das langlebige Token fuer einen neuen oder bereits bekannten Gast-Save. */
export function ensureCloudAccessToken(): string {
  const existing = getCloudAccessToken();
  if (existing) return existing;

  const cloudId = ensureCloudId();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  setCloudAccessToken(token, cloudId);
  return token;
}

/** Entfernt das lokale Capability-Token beim Profilwechsel oder Reset. */
export function clearCloudAccessToken(): void {
  try {
    window.localStorage.removeItem(CLOUD_ACCESS_TOKEN_KEY);
  } catch {
    // Privater Modus / blockierter Speicher: Der aktuelle Stand bleibt nutzbar.
  }
}

/** Zeigt an, ob ein alter v8-Stand vor dem sicheren Reset gesichert wurde. */
export function hasLegacySaveBackup(): boolean {
  try {
    return window.localStorage.getItem(LEGACY_SAVE_BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}

function backupLegacySave(raw: Partial<SaveData>): boolean {
  try {
    if (window.localStorage.getItem(LEGACY_SAVE_BACKUP_KEY)) return true;
    window.localStorage.setItem(LEGACY_SAVE_BACKUP_KEY, JSON.stringify(raw));
    return true;
  } catch (error) {
    console.warn(
      '[SaveSystem] v8-Stand nicht sicher archiviert; Wirtschaftsmigration wird verschoben.',
      error,
    );
    return false;
  }
}

/** True, wenn der lokale Wartungs-Teststand aktiv ist. */
export function isTestProfileActive(): boolean {
  try {
    return window.localStorage.getItem(TEST_PROFILE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Aktiviert einen lokalen Teststand, ohne den normalen Spielstand zu verlieren.
 *
 * `null`, wenn das Backup nicht geschrieben werden konnte.
 *
 * **Warum das abbrechen muss.** Vorher lief die Funktion nach einem
 * fehlgeschlagenen Backup weiter und ueberschrieb den echten Spielstand mit
 * dem Testprofil. Das Backup fehlte dann aber - `disableTestProfile()` fand
 * nichts zum Wiederherstellen und lieferte einen leeren Stand. Aus Stufe 30
 * mit 5 000 Muenzen wurde Stufe 1, unwiederbringlich.
 *
 * Der verschluckte Fehler machte damit aus einer umkehrbaren Aktion eine
 * unumkehrbare. Ohne Backup gibt es kein Testprofil (Audit 2026-08-23).
 */
export function enableTestProfile(): SaveData | null {
  if (isTestProfileActive()) return load();

  const original = structuredClone(load());
  try {
    window.localStorage.setItem(TEST_PROFILE_BACKUP_KEY, JSON.stringify(original));
    window.localStorage.setItem(TEST_PROFILE_KEY, '1');
  } catch (error) {
    console.warn(
      '[SaveSystem] Testprofil nicht aktivierbar - Spielstand bleibt unberuehrt.',
      error,
    );
    // Halbfertigen Zustand aufraeumen: Wenn nur der zweite Schluessel
    // scheiterte, stuende sonst ein Backup ohne Marker im Speicher.
    try {
      window.localStorage.removeItem(TEST_PROFILE_BACKUP_KEY);
      window.localStorage.removeItem(TEST_PROFILE_KEY);
    } catch {
      // Wenn schon das Aufraeumen scheitert, ist der Speicher ohnehin dicht.
    }
    return null;
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

/**
 * Deaktiviert den lokalen Teststand und stellt den vorherigen Stand wieder her.
 *
 * `null`, wenn kein Backup gefunden wurde.
 *
 * **Warum das nicht auf den Standardstand zurueckfaellt.** Ein fehlendes
 * Backup heisst nicht "der Spieler hatte nichts", sondern "wir wissen nicht
 * mehr, was er hatte". Ein leerer Stand als Antwort darauf loescht genau das,
 * was noch zu retten waere. Lieber im Testprofil stehen bleiben und das
 * melden, als den echten Stand endgueltig ueberschreiben (Audit 2026-08-23).
 */
export function disableTestProfile(): SaveData | null {
  let backup: Partial<SaveData> | null = null;
  try {
    const raw = window.localStorage.getItem(TEST_PROFILE_BACKUP_KEY);
    backup = raw ? (JSON.parse(raw) as Partial<SaveData>) : null;
  } catch (error) {
    console.warn('[SaveSystem] Testprofil-Backup nicht lesbar.', error);
    return null;
  }

  if (!backup) return null;

  const restored = migrate(backup);
  // Erst schreiben, dann die Marker entfernen: Scheitert das Schreiben,
  // bleibt das Testprofil aktiv und das Backup erhalten - ein zweiter
  // Versuch ist dann noch moeglich.
  if (!save(restored)) return null;

  try {
    window.localStorage.removeItem(TEST_PROFILE_KEY);
    window.localStorage.removeItem(TEST_PROFILE_BACKUP_KEY);
  } catch (error) {
    console.warn('[SaveSystem] Testprofil-Marker nicht entfernbar.', error);
  }
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
    data.pendingPlayerName = null;
  });
}

/** Speichert einen Namen offline, ohne den Serverstand als bestaetigt auszugeben. */
export function setOfflinePlayerName(name: string): void {
  update((data) => {
    data.playerName = name;
    data.pendingPlayerName = name;
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
/**
 * Vereinigt gekaufte Formen und Farben aus beiden Staenden.
 *
 * **Warum das noetig ist.** Ein uebernommener Cloud-Stand ersetzt den lokalen
 * vollstaendig. Kennt er die Shop-Felder nicht - weil er vor diesem Update
 * hochgeladen wurde -, fuellt `reconcile()` sie mit den Standardwerten, und
 * alles Gekaufte ist weg. Genau das passierte: Ein Kauf war im Menue kurz zu
 * sehen und sprang beim naechsten Profil-Abgleich auf den Pfeil zurueck.
 *
 * Besitz wird deshalb nie ersetzt, sondern zusammengelegt. Wer auf zwei
 * Geraeten kauft, hat am Ende beides - die Muenzen sind ohnehin schon
 * abgebucht, und etwas wegzunehmen waere der schlimmere Fehler.
 *
 * Das **Getragene** kommt dagegen vom Cloud-Stand, sofern er es kennt und
 * besitzt: So sieht die Figur auf beiden Geraeten gleich aus.
 */
function hasExplicitShopSelection(remote: Partial<SaveData>): boolean {
  const source = asRecord(remote);
  return ['shipShape', 'shipColor', 'shipAura'].some((key) => typeof source[key] === 'string');
}

function mergeShopOwnership(
  lokal: SaveData,
  uebernommen: SaveData,
  remoteSelectionKnown = false,
  resetErkannt = false,
): SaveData {
  // Ein zurueckgesetztes Profil raeumt auch den Laden aus.
  //
  // `admin_reset_user()` setzt serverseitig alles auf Anfang, auch die
  // Ladenkaeufe. Ohne diese Ausnahme wuerde die Vereinigung unten sie wieder
  // hereinholen - der zurueckgesetzte Spieler stuende bei Stufe 1 mit 0
  // Muenzen da und truege weiterhin den Sternenkreuzer fuer 1 100.
  //
  // Erkannt wird der Reset an einem leeren Cloud-Stand, waehrend lokal noch
  // Spielzeit steht: Nur dann wurde tatsaechlich etwas geloescht.
  //
  // Ein erster Anlauf pruefte allein den Cloud-Stand (Stufe 1, keine Runs).
  // Das traf aber auch ein **frisch angelegtes** Profil - ein Neuling, der
  // vor seiner ersten Anmeldung im Laden kaufte, haette den Kauf verloren.
  // Der lokale Stand muss deshalb Spuren zeigen, die der ferne nicht hat.
  // Die eigene Herleitung ist nur die Rueckfallebene fuer Aufrufer, die
  // keine Antwort mitbringen. Sie ist bewusst schwaecher als
  // `CloudSystem.isRemoteReset()`: Ihr fehlt der Ladenbesitz im Signal, und
  // sie erkennt deshalb den zweiten Reset eines Spielers nicht, der bereits
  // auf Stufe 1 ohne Runs steht. Wo die bessere Antwort vorliegt, gewinnt
  // sie (Audit 2026-08-23).
  const fernLeer = uebernommen.level === 1 && uebernommen.xp === 0 && uebernommen.totalRuns === 0;
  const lokalBespielt = lokal.totalRuns > 0 || lokal.level > 1;
  const wasReset = resetErkannt || (fernLeer && lokalBespielt);

  if (wasReset) {
    return {
      ...uebernommen,
      ownedShipShapes: [DEFAULT_SHIP_SHAPE],
      ownedShipColors: [DEFAULT_SHIP_COLOR],
      ownedShipAuras: [DEFAULT_SHIP_AURA],
      shipShape: DEFAULT_SHIP_SHAPE,
      shipColor: DEFAULT_SHIP_COLOR,
      shipAura: DEFAULT_SHIP_AURA,
      newCosmeticIds: [],
      lastPurchasedCosmetic: null,
    };
  }

  const ownedShipShapes = [...new Set([...lokal.ownedShipShapes, ...uebernommen.ownedShipShapes])];
  const ownedShipColors = [...new Set([...lokal.ownedShipColors, ...uebernommen.ownedShipColors])];
  const ownedShipAuras = [...new Set([...lokal.ownedShipAuras, ...uebernommen.ownedShipAuras])];

  return {
    ...uebernommen,
    // Besitz zusammenlegen: Wer auf zwei Geraeten kauft, hat am Ende beides.
    // Die Muenzen sind ohnehin auf beiden Seiten abgebucht, und etwas
    // wegzunehmen waere der schlimmere Fehler.
    ownedShipShapes,
    ownedShipColors,
    ownedShipAuras,
    // Kaufhinweise bleiben lokal erhalten; die eigentliche Cloud-Synchronisation
    // dieser Metadaten ist bewusst Teil von P2-08, nicht dieses UI-Schritts.
    newCosmeticIds: [
      ...new Set([...(lokal.newCosmeticIds ?? []), ...(uebernommen.newCosmeticIds ?? [])]),
    ],
    lastPurchasedCosmetic: lokal.lastPurchasedCosmetic ?? uebernommen.lastPurchasedCosmetic ?? null,

    // Auth-Profilstaende enthalten die serverseitig gespeicherte letzte
    // Auswahl. Fehlt das Feld bei einem alten anonymen Stand, bleibt die
    // lokale Auswahl erhalten, damit ein veralteter Cloud-Stand keinen Kauf
    // zuruecksetzt. Sobald der Cloud-Stand den lokalen Gegenstand kennt, darf
    // seine serverseitige Auswahl auf beide Geraete uebernommen werden.
    shipShape:
      remoteSelectionKnown &&
      uebernommen.ownedShipShapes.includes(lokal.shipShape) &&
      ownedShipShapes.includes(uebernommen.shipShape)
        ? uebernommen.shipShape
        : lokal.shipShape,
    shipColor:
      remoteSelectionKnown &&
      uebernommen.ownedShipColors.includes(lokal.shipColor) &&
      ownedShipColors.includes(uebernommen.shipColor)
        ? uebernommen.shipColor
        : lokal.shipColor,
    shipAura:
      remoteSelectionKnown &&
      uebernommen.ownedShipAuras.includes(lokal.shipAura) &&
      ownedShipAuras.includes(uebernommen.shipAura)
        ? uebernommen.shipAura
        : lokal.shipAura,
  };
}

/**
 * @param resetErkannt Hat der Aufrufer bereits einen serverseitigen Reset
 *   festgestellt? `CloudSystem.isRemoteReset()` beantwortet dieselbe Frage
 *   mit deutlich mehr Kriterien - unter anderem dem Ladenbesitz, den die
 *   Notloesung hier unten nicht kennt. Wo diese Antwort vorliegt, muss sie
 *   durchgereicht statt neu hergeleitet werden: Sonst raeumt der zweite
 *   Reset eines Spielers, der bereits auf Stufe 1 ohne Runs steht, den Laden
 *   nicht mehr aus (Audit 2026-08-23).
 */
export function adoptRemote(
  remote: Partial<SaveData>,
  cloudId: string,
  resetErkannt = false,
  accessToken?: string,
): SaveData {
  const lokal = load();
  const merged = preservePendingIdentity(
    lokal,
    mergeShopOwnership(lokal, migrate(remote), hasExplicitShopSelection(remote), resetErkannt),
  );
  merged.cloudId = cloudId;
  if (accessToken) setCloudAccessToken(accessToken, cloudId);
  save(merged);
  return merged;
}

/** Übernimmt den gemeinsamen Auth-Profilstand und bewahrt die lokale Sync-ID. */
export function adoptProfileProgress(remote: Partial<SaveData>): SaveData {
  const lokal = load();
  const merged = preservePendingIdentity(
    lokal,
    mergeShopOwnership(lokal, migrate(remote), hasExplicitShopSelection(remote)),
  );
  merged.cloudId = lokal.cloudId;
  save(merged);
  return merged;
}

/** Ein nicht bestaetigter Offline-Name darf kein Remote-Pull verlieren. */
function preservePendingIdentity(lokal: SaveData, merged: SaveData): SaveData {
  if (!lokal.pendingPlayerName) return merged;
  return {
    ...merged,
    playerName: lokal.playerName,
    pendingPlayerName: lokal.pendingPlayerName,
  };
}
