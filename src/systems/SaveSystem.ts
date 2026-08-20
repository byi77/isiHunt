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
import { DEFAULT_SHIP_COLOR, DEFAULT_SHIP_SHAPE, shapesEarnedByLegacyLevel } from '@/config/shop';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type { SaveData } from '@/types';

const TEST_PROFILE_KEY = 'isihunt.admin-test-profile.v1';
const TEST_PROFILE_BACKUP_KEY = 'isihunt.admin-test-profile-backup.v1';
/**
 * PIN für den ausschließlich lokalen Wartungs-Teststand.
 *
 * Das ist keine Adminberechtigung: Der Stand bleibt offline, schaltet keine
 * Serverfunktion frei und wird nicht in Bestenliste oder Profil-Sync übertragen.
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
    shipShape: DEFAULT_SHIP_SHAPE,
    shipColor: DEFAULT_SHIP_COLOR,
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
    lastLoginBonusKey: raw.lastLoginBonusKey ?? base.lastLoginBonusKey,
    lastDailyKey: raw.lastDailyKey ?? base.lastDailyKey,
    dailyBestScore: Math.max(0, raw.dailyBestScore ?? base.dailyBestScore),
    totalDailyRuns: Math.max(0, raw.totalDailyRuns ?? base.totalDailyRuns),
    pendingDailyKey: raw.pendingDailyKey ?? base.pendingDailyKey,
    pendingDailyEventId: raw.pendingDailyEventId ?? base.pendingDailyEventId,
    pendingDailyCoins: Math.max(0, raw.pendingDailyCoins ?? base.pendingDailyCoins),
    pendingDailyScore: Math.max(0, raw.pendingDailyScore ?? base.pendingDailyScore),
    soundEnabled: raw.soundEnabled ?? base.soundEnabled,
    bestScoreRecordedAt:
      typeof raw.bestScoreRecordedAt === 'string' &&
      Number.isFinite(Date.parse(raw.bestScoreRecordedAt))
        ? new Date(raw.bestScoreRecordedAt).toISOString()
        : base.bestScoreRecordedAt,
    collected: { ...base.collected, ...(raw.collected ?? {}) },
    talents: { ...base.talents, ...(raw.talents ?? {}) },
    unlockedAchievements: raw.unlockedAchievements ?? base.unlockedAchievements,
    // Der Pfeil und die Weltfarbe gehoeren immer dazu - sonst stuende ein
    // Spieler ohne Schiff da, wenn eine Liste beschaedigt ankommt.
    ownedShipShapes: [
      ...new Set([DEFAULT_SHIP_SHAPE, ...(raw.ownedShipShapes ?? base.ownedShipShapes)]),
    ],
    ownedShipColors: [
      ...new Set([DEFAULT_SHIP_COLOR, ...(raw.ownedShipColors ?? base.ownedShipColors)]),
    ],
    shipShape: raw.shipShape ?? base.shipShape,
    shipColor: raw.shipColor ?? base.shipColor,
  };
}

function legacyXpForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.45));
}

/**
 * Die XP-Kurve der Versionen 2 bis 6, eingefroren.
 *
 * Migrationen muessen mit der Kurve rechnen, die zum jeweiligen Stand gehoert
 * - nicht mit der aktuellen. Wuerde hier `xpForLevel` stehen, verschoebe sich
 * das Ergebnis jeder alten Migration bei jeder kuenftigen Balance-Aenderung,
 * und ein v1-Stand liefe durch beide Umrechnungen hintereinander.
 */
function xpForLevelV6(level: number): number {
  return level >= MAX_LEVEL ? 0 : Math.floor(750 * Math.sqrt(level) + 8 * Math.pow(level, 1.25));
}

/**
 * Verteilt die gesamte gesammelte XP auf eine neue Kurve.
 *
 * `alteKurve` liefert den Bedarf je Stufe im alten System, `neueKurve` den im
 * neuen. Aus Level und Rest-XP wird die Gesamtsumme rekonstruiert und von
 * Stufe 1 an neu verteilt.
 */
function verteileXpNeu(
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
  return raw.version ?? 1;
}

/** Uebersetzt die alte XP-Kurve in die neue, ohne Fortschritt zu verschenken. */
function migrate(raw: Partial<SaveData>): SaveData {
  const save = reconcile(raw);
  const rawVersion = versionOf(raw);
  if (rawVersion >= SAVE_VERSION) return save;

  // Version 1 hatte noch die alte XP-Kurve. Version 2 bekam bereits die
  // aktuelle Kurve; Version 3 fuegt nur das Coins-Feld hinzu.
  if (rawVersion < 2) {
    // Gegen die damals aktuelle Kurve rechnen (xpForLevelV6), nicht gegen die
    // heutige - sonst laeuft ein v1-Stand durch zwei Umrechnungen.
    verteileXpNeu(save, legacyXpForLevel, xpForLevelV6);
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
    verteileXpNeu(save, xpForLevelV6, xpForLevel);
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

export function load(): SaveData {
  if (cache) return cache;

  try {
    const stored = window.localStorage.getItem(SAVE_KEY);
    const raw = stored ? (JSON.parse(stored) as Partial<SaveData>) : null;
    const rawVersion = raw ? versionOf(raw) : SAVE_VERSION;
    cache = raw ? migrate(raw) : createDefaultSave();

    // Migrationen müssen sofort persistiert werden. Sonst würde ein alter
    // Spielstand nach jedem Browser-/App-Neustart erneut Talentpunkte und
    // Level-Coins umwandeln und die Währung vervielfachen. Eigener
    // try/catch: schlägt nur das Schreiben fehl (Quota, privater Modus),
    // bleibt der bereits migrierte Stand im Speicher gültig - der äußere
    // catch würde ihn sonst faelschlich durch einen leeren Stand ersetzen.
    if (raw && rawVersion < SAVE_VERSION) {
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

/**
 * Entfernt den auf diesem Gerät zwischengespeicherten Profilstand nach einer
 * Abmeldung. Der Cloud-Stand bleibt unverändert und wird beim nächsten Login
 * wieder geladen. Geräteeinstellungen wie der Ton bleiben erhalten.
 */
export function clearLocalProfile(): SaveData {
  const fresh = createDefaultSave();
  fresh.soundEnabled = load().soundEnabled;
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
function vereinigeShopBesitz(lokal: SaveData, uebernommen: SaveData): SaveData {
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
  const fernLeer = uebernommen.level === 1 && uebernommen.xp === 0 && uebernommen.totalRuns === 0;
  const lokalBespielt = lokal.totalRuns > 0 || lokal.level > 1;
  const zurueckgesetzt = fernLeer && lokalBespielt;

  if (zurueckgesetzt) {
    return {
      ...uebernommen,
      ownedShipShapes: [DEFAULT_SHIP_SHAPE],
      ownedShipColors: [DEFAULT_SHIP_COLOR],
      shipShape: DEFAULT_SHIP_SHAPE,
      shipColor: DEFAULT_SHIP_COLOR,
    };
  }

  return {
    ...uebernommen,
    // Besitz zusammenlegen: Wer auf zwei Geraeten kauft, hat am Ende beides.
    // Die Muenzen sind ohnehin auf beiden Seiten abgebucht, und etwas
    // wegzunehmen waere der schlimmere Fehler.
    ownedShipShapes: [...new Set([...lokal.ownedShipShapes, ...uebernommen.ownedShipShapes])],
    ownedShipColors: [...new Set([...lokal.ownedShipColors, ...uebernommen.ownedShipColors])],

    // Das Getragene bleibt **immer** lokal.
    //
    // Ein erster Anlauf liess den Cloud-Stand entscheiden, sofern er die
    // Felder kannte - damit sollte die Figur auf zwei Geraeten gleich
    // aussehen. In der Praxis brach das den Kauf: Der Server pflegt in
    // `profile_progress` eine eigene `data`-Kopie und schreibt sie bei jedem
    // Lauf fort (`submit_progress_event`). Der Client kann dort nichts
    // hineinschreiben - `initialize_profile_progress` greift nur beim
    // allerersten Mal (`on conflict do nothing`). Der Cloud-Stand kennt die
    // Auswahl also nie und setzte sie bei jedem Abgleich auf den Pfeil
    // zurueck: Nach dem Kauf im Menue kurz sichtbar, nach der ersten Jagd
    // wieder weg.
    //
    // Die getragene Figur ist Geraete-Einstellung, kein Fortschritt - wie der
    // Ton. Sobald es eine Server-Funktion gibt, die sie mitfuehrt, kann das
    // hier wieder aufgemacht werden.
    shipShape: lokal.shipShape,
    shipColor: lokal.shipColor,
  };
}

export function adoptRemote(remote: Partial<SaveData>, cloudId: string): SaveData {
  const merged = vereinigeShopBesitz(load(), migrate(remote));
  merged.cloudId = cloudId;
  save(merged);
  return merged;
}

/** Übernimmt den gemeinsamen Auth-Profilstand und bewahrt die lokale Sync-ID. */
export function adoptProfileProgress(remote: Partial<SaveData>): SaveData {
  const lokal = load();
  const merged = vereinigeShopBesitz(lokal, migrate(remote));
  merged.cloudId = lokal.cloudId;
  save(merged);
  return merged;
}
