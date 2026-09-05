/** Offline-Outbox für Fortschrittsereignisse eines angemeldeten Profils. */

import { SYNC_RETRY_DELAYS_MS } from '@/config/backend';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressEvent, ProgressionResult, RunStats } from '@/types';

const OUTBOX_KEY_PREFIX = 'isihunt.progress-events.v2.';
const LEGACY_OUTBOX_KEY = 'isihunt.progress-events';
const LEGACY_OUTBOX_QUARANTINE_KEY = 'isihunt.progress-events.unbound.v1';
const INVALID_OUTBOX_KEY_PREFIX = 'isihunt.progress-events.invalid.v1.';
const REJECTED_OUTBOX_KEY_PREFIX = 'isihunt.progress-events.rejected.v1.';
const BOT_VICTORY_KEY_PREFIX = 'isihunt.bot-victories.v1.';
/** Mehr als ein paar unbestaetigte Bot-Siege deuten auf einen Defekt hin. */
const BOT_VICTORY_MAX_PENDING = 16;
const OUTBOX_MAX_EVENTS = 64;
const OUTBOX_MAX_BYTES = 256 * 1024;
let flushPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

/**
 * Bricht eine laufende Wiederholungskette ab.
 *
 * Fuer Tests, damit kein Timer ueber das Testende hinaus haengen bleibt; im
 * Betrieb greift das automatisch nie, weil jeder erfolgreiche `flush()` selbst
 * ueber `clearRetry()` abbricht.
 */
export function cancelRetry(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  retryAttempt = 0;
}

/**
 * Plant einen automatischen Wiederholungsversuch nach `SYNC_RETRY_DELAYS_MS`.
 *
 * Ohne das haengt ein Offline-Run in der Outbox, bis zufaellig ein neues
 * `online`-Ereignis feuert oder die App neu startet (siehe Kommentar bei
 * `SYNC_RETRY_DELAYS_MS`). Ein bereits laufender Timer wird nicht doppelt
 * gesetzt - `flush()` selbst schuetzt schon vor parallelen Auftraegen.
 */
function scheduleRetry(): void {
  if (retryTimer !== null) return;
  const delay = SYNC_RETRY_DELAYS_MS[Math.min(retryAttempt, SYNC_RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

function createEventId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function accountOutboxKey(accountId: string): string {
  return `${OUTBOX_KEY_PREFIX}${accountId}`;
}

function invalidOutboxKey(accountId: string): string {
  return `${INVALID_OUTBOX_KEY_PREFIX}${accountId}`;
}

function rejectedOutboxKey(accountId: string): string {
  return `${REJECTED_OUTBOX_KEY_PREFIX}${accountId}`;
}

function botVictoryKey(accountId: string): string {
  return `${BOT_VICTORY_KEY_PREFIX}${accountId}`;
}

/**
 * Match-IDs gewonnener Bot-Duelle, die der Server noch nicht bestaetigt hat.
 *
 * Bewusst neben der Outbox und nicht in `SaveData`: ein Bot-Sieg ist kein
 * Laufereignis (er hat weder Score noch Welt) und braucht keine
 * Save-Migration. Die IDs sind der einzige Inhalt - die Betraege rechnet der
 * Server (AUDIT_2026-09-05, Befund 6).
 */
function readBotVictories(accountId: string): string[] {
  try {
    const raw = window.localStorage.getItem(botVictoryKey(accountId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is string => typeof id === 'string' && /^[0-9a-f-]{16,64}$/i.test(id),
    );
  } catch {
    return [];
  }
}

function writeBotVictories(accountId: string, matchIds: string[]): void {
  try {
    window.localStorage.setItem(botVictoryKey(accountId), JSON.stringify(matchIds));
  } catch {
    // Ein privater Browsermodus darf den Spielfluss nicht blockieren.
  }
}

/**
 * Merkt einen gewonnenen Bot-Kampf zum Hochladen vor.
 *
 * Gibt `false` zurueck, wenn nichts vorgemerkt wurde (nicht angemeldet,
 * Testprofil oder Warteschlange voll) - der lokale Spielstand bleibt dann die
 * einzige Quelle, wie vor dieser Aenderung.
 */
export function enqueueBotVictory(matchId: string): boolean {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) return false;
  const accountId = AuthSystem.currentUserId();
  if (!accountId) return false;

  const pending = readBotVictories(accountId);
  if (pending.includes(matchId)) return true;
  if (pending.length >= BOT_VICTORY_MAX_PENDING) {
    console.warn('[ProgressSyncSystem] Bot-Sieg wegen voller Warteschlange verworfen.');
    return false;
  }
  writeBotVictories(accountId, [...pending, matchId]);
  void flush();
  return true;
}

/**
 * Laedt vorgemerkte Bot-Siege hoch.
 *
 * Erst nach der Outbox: der Server ist die Quelle fuer Level und Coins, und
 * jeder bestaetigte Bonus ueberschreibt den lokalen Stand. Kaeme er vor den
 * Laufereignissen, waere der Zwischenstand kurzzeitig falsch.
 */
async function flushBotVictories(accountId: string): Promise<void> {
  for (const matchId of readBotVictories(accountId)) {
    if (!AuthSystem.isSignedIn() || AuthSystem.currentUserId() !== accountId) return;
    const result = await CloudSystem.claimBotVictoryBonus(matchId);
    if (AuthSystem.currentUserId() !== accountId) return;
    // Nur bei Erfolg austragen. Ein Netzfehler laesst die ID stehen; der
    // Server erkennt einen erneuten Aufruf ueber dieselbe Match-ID.
    if (!result.ok) return;
    writeBotVictories(
      accountId,
      readBotVictories(accountId).filter((id) => id !== matchId),
    );
    if (result.value) SaveSystem.adoptProfileProgress(result.value.data);
  }
}

/** Alte globale Events duerfen niemals still einem neuen Login gehoeren. */
function quarantineLegacyOutbox(): void {
  try {
    const legacy = window.localStorage.getItem(LEGACY_OUTBOX_KEY);
    if (legacy && !window.localStorage.getItem(LEGACY_OUTBOX_QUARANTINE_KEY)) {
      window.localStorage.setItem(LEGACY_OUTBOX_QUARANTINE_KEY, legacy);
    }
    if (legacy) window.localStorage.removeItem(LEGACY_OUTBOX_KEY);
  } catch {
    // Ein privater Browsermodus darf den Spielfluss nicht blockieren.
  }
}

function isFiniteInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isCollected(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 6) return false;
  return entries.every(
    ([key, count]) =>
      ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'].includes(key) &&
      isFiniteInteger(count, 0, 632),
  );
}

function isProgressEvent(value: unknown): value is ProgressEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<ProgressEvent>;
  const dailyKey = event.dailyKey;
  return (
    typeof event.eventId === 'string' &&
    /^[0-9a-f-]{16,64}$/i.test(event.eventId) &&
    typeof event.worldId === 'string' &&
    event.worldId.length >= 1 &&
    event.worldId.length <= 32 &&
    isFiniteInteger(event.score, 0, 10_000_000) &&
    isFiniteInteger(event.bestCombo, 0, 10_000) &&
    isFiniteInteger(event.xpGained, 0, 10_000_000) &&
    isFiniteInteger(event.durationMs, 0, 120_000) &&
    isFiniteInteger(event.coinsGained, 0, 10_000_000) &&
    isFiniteInteger(event.talentPointsGained, 0, 10_000) &&
    isCollected(event.collected) &&
    Array.isArray(event.unlockedAchievementIds) &&
    event.unlockedAchievementIds.length <= 64 &&
    event.unlockedAchievementIds.every(
      (id) => typeof id === 'string' && id.length > 0 && id.length <= 64,
    ) &&
    (dailyKey === null || dailyKey === undefined || /^\d{4}-\d{2}-\d{2}$/.test(dailyKey)) &&
    typeof event.createdAt === 'string' &&
    Number.isFinite(Date.parse(event.createdAt))
  );
}

function quarantineInvalidEvents(accountId: string, events: unknown[]): void {
  if (events.length === 0) return;
  try {
    window.localStorage.setItem(
      invalidOutboxKey(accountId),
      JSON.stringify(events).slice(0, OUTBOX_MAX_BYTES),
    );
  } catch {
    // Quarantene ist nur Diagnosehilfe und darf den Spielfluss nicht blockieren.
  }
}

/**
 * Fachliche Ablehnungen, die sich beim naechsten Versuch identisch
 * wiederholen. Nur diese duerfen ein Ereignis aus der Outbox nehmen.
 *
 * Bewusst kurz gehalten: beide Meldungen stammen woertlich aus
 * `submit_progress_event` (phase_2_28_integrity_hardening.sql, Zeilen 54 und
 * 63) und haengen allein am Inhalt des Ereignisses - erneutes Senden aendert
 * daran nichts.
 *
 * Nicht in dieser Liste steht 'Fortschrittslauf zu schnell eingereicht': der
 * Cooldown-Trigger aus phase_2_29 ist zeitabhaengig, ein spaeterer Versuch
 * geht durch. Ebenso wenig Netz- und Zeitfehler. Im Zweifel wird wiederholt,
 * nicht verworfen - ein faelschlich behaltener Run kostet einen Retry, ein
 * faelschlich verworfener kostet den Fortschritt.
 */
const PERMANENT_REJECTIONS = [
  'Ungueltiger Tageslauf',
  'Ereignis-ID bereits mit anderem Lauf-Typ verwendet',
] as const;

function isPermanentRejection(error: string): boolean {
  return PERMANENT_REJECTIONS.some((reason) => error.includes(reason));
}

/**
 * Legt dauerhaft abgelehnte Ereignisse beiseite, statt sie stumm zu loeschen.
 *
 * Sie sind fuer den Server wertlos, aber fuer die Fehlersuche wertvoll: ohne
 * diese Ablage waere nicht mehr nachvollziehbar, welcher Lauf verlorenging.
 */
function quarantineRejectedEvents(accountId: string, events: ProgressEvent[]): void {
  try {
    const previous: unknown = JSON.parse(
      window.localStorage.getItem(rejectedOutboxKey(accountId)) ?? '[]',
    );
    const merged = [...(Array.isArray(previous) ? previous : []), ...events].slice(
      -OUTBOX_MAX_EVENTS,
    );
    window.localStorage.setItem(
      rejectedOutboxKey(accountId),
      JSON.stringify(merged).slice(0, OUTBOX_MAX_BYTES),
    );
  } catch {
    // Quarantene ist nur Diagnosehilfe und darf den Spielfluss nicht blockieren.
  }
}

function readOutbox(accountId: string | null): ProgressEvent[] {
  quarantineLegacyOutbox();
  if (!accountId) return [];
  try {
    const raw = window.localStorage.getItem(accountOutboxKey(accountId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isProgressEvent);
    if (valid.length !== parsed.length) {
      quarantineInvalidEvents(
        accountId,
        parsed.filter((event) => !isProgressEvent(event)),
      );
      writeOutbox(accountId, valid);
    }
    return valid;
  } catch {
    return [];
  }
}

function writeOutbox(accountId: string, events: ProgressEvent[]): boolean {
  if (events.length > OUTBOX_MAX_EVENTS) {
    console.warn('[ProgressSyncSystem] Outbox-Limit erreicht.');
    return false;
  }
  try {
    const serialized = JSON.stringify(events);
    if (serialized.length > OUTBOX_MAX_BYTES) {
      console.warn('[ProgressSyncSystem] Outbox zu gross.');
      return false;
    }
    window.localStorage.setItem(accountOutboxKey(accountId), serialized);
    return true;
  } catch (error) {
    console.warn('[ProgressSyncSystem] Outbox nicht speicherbar.', error);
    return false;
  }
}

/** Legt einen Run lokal ab, bevor der Netzwerkversuch startet. */
export function enqueueRun(
  stats: RunStats,
  progression: ProgressionResult,
  dailyKey: string | null = null,
): string | null {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) return null;
  const accountId = AuthSystem.currentUserId();
  if (!accountId) return null;

  const eventId = createEventId();
  const event: ProgressEvent = {
    eventId,
    worldId: stats.worldId,
    score: stats.score,
    bestCombo: stats.bestCombo,
    xpGained: stats.xpGained,
    durationMs: stats.durationMs ?? 0,
    coinsGained: progression.coinsGained,
    talentPointsGained: progression.talentPointsGained,
    collected: stats.collected,
    unlockedAchievementIds: progression.unlockedAchievementIds,
    dailyKey,
    createdAt: new Date().toISOString(),
  };

  const pending = readOutbox(accountId);
  if (pending.length >= OUTBOX_MAX_EVENTS) {
    console.warn('[ProgressSyncSystem] Neuer Run wegen voller Outbox verworfen.');
    return null;
  }
  return writeOutbox(accountId, [...pending, event]) ? eventId : null;
}

/**
 * Entfernt erledigte Ereignisse aus dem *aktuellen* Stand der Outbox.
 *
 * Nicht aus dem Schnappschuss vom Schleifenbeginn: waehrend eines `await`
 * darf `enqueueRun` neue Runs anhaengen. Frueher wurde der alte Schnappschuss
 * zurueckgeschrieben und der dazwischen beendete Run verschwand ungesendet
 * (AUDIT_2026-09-05, Befund 3).
 */
function dropSettledEvents(accountId: string, settledIds: Set<string>): ProgressEvent[] {
  const current = readOutbox(accountId).filter((event) => !settledIds.has(event.eventId));
  writeOutbox(accountId, current);
  return current;
}

/** Überträgt wartende Runs in Reihenfolge; Fehler bleiben in der Outbox. */
async function flushPending(): Promise<void> {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) {
    cancelRetry();
    return;
  }

  const accountId = AuthSystem.currentUserId();
  if (!accountId) return;

  const pending = readOutbox(accountId);
  // Erledigt heisst: vom Server angenommen ODER dauerhaft abgelehnt. Beides
  // faellt aus der Outbox; nur ein voruebergehender Fehler haelt sie an.
  const settledIds = new Set<string>();
  const rejected: ProgressEvent[] = [];
  let blocked = false;

  for (const event of pending) {
    // Ein Sign-in-Wechsel waehrend eines await darf weder Events des alten
    // Kontos an das neue Konto senden noch dessen lokalen Stand uebernehmen.
    if (
      !AuthSystem.isSignedIn() ||
      AuthSystem.currentUserId() !== accountId ||
      SaveSystem.isTestProfileActive()
    ) {
      blocked = true;
      break;
    }
    const result = await CloudSystem.submitProgressEvent(event);
    if (AuthSystem.currentUserId() !== accountId) {
      blocked = true;
      break;
    }
    if (!result.ok) {
      // Ein Netzfehler betrifft alle folgenden Events genauso - abbrechen und
      // spaeter erneut versuchen. Eine dauerhafte fachliche Ablehnung dagegen
      // wiederholt sich bei jedem Versuch identisch: bliebe sie vorn in der
      // Outbox liegen, kaeme kein einziger spaeterer Run mehr durch
      // (AUDIT_2026-09-05, Befund 2). Sie wandert deshalb in die Quarantaene.
      if (!isPermanentRejection(result.error)) {
        blocked = true;
        break;
      }
      console.warn('[ProgressSyncSystem] Ereignis dauerhaft abgelehnt.', result.error);
      settledIds.add(event.eventId);
      rejected.push(event);
      continue;
    }
    settledIds.add(event.eventId);
    // Der Server ist die Quelle fuer XP, Coins, Level und validierte
    // Achievements. Der lokale Stand bleibt bis dahin nur UI-optimistisch;
    // nach jedem erfolgreichen Event wird die autoritative Antwort uebernommen.
    if (result.value) SaveSystem.adoptProfileProgress(result.value.data);
  }

  if (rejected.length > 0) quarantineRejectedEvents(accountId, rejected);
  const remaining = dropSettledEvents(accountId, settledIds);

  if (blocked) {
    if (remaining.length > 0) scheduleRetry();
    return;
  }

  // Waehrend der Schleife angehaengte Runs (`enqueueRun` darf das jederzeit)
  // stehen noch nicht im abgearbeiteten Schnappschuss. Sie gehen sofort
  // hinterher, statt bis zum naechsten Ausloeser zu warten - der Spieler ist
  // dann laengst im Menue und erwartet einen leeren Stapel.
  if (remaining.length > 0 && settledIds.size > 0) {
    const beforeRetry = remaining.length;
    await flushPending();
    // Nur wenn der Nachlauf etwas bewegt hat, ist hier schon alles erledigt;
    // sonst uebernimmt der reguelaere Retry weiter unten.
    if (readOutbox(accountId).length < beforeRetry) return;
  }

  if (remaining.length > 0) {
    scheduleRetry();
    // Der Tagesbonus darf erst abgeholt werden, wenn wirklich alle Laufereignisse
    // synchronisiert wurden. Sonst koennen XP/Coins/Level steigen, obwohl die
    // zugehoerige Spielzeit noch nicht im Profil steht.
    return;
  }
  cancelRetry();

  await flushBotVictories(accountId);
  if (!AuthSystem.isSignedIn() || AuthSystem.currentUserId() !== accountId) return;
  if (readBotVictories(accountId).length > 0) {
    scheduleRetry();
    return;
  }

  const local = SaveSystem.load();
  if (!AuthSystem.isSignedIn() || AuthSystem.currentUserId() !== accountId) return;
  if (!local.pendingDailyKey || !local.pendingDailyEventId || local.pendingDailyCoins <= 0) return;

  // Ein Tageslauf, dessen Tag zu weit zurueckliegt, wird vom Server dauerhaft
  // abgelehnt (`daily_key_is_plausible()`, Fenster von einem Tag). Ohne diese
  // Pruefung bliebe er fuer immer in `pendingDailyKey` stehen und loeste bei
  // jedem Abgleich einen aussichtslosen Aufruf aus. Er wird deshalb hier
  // verworfen - der Lauf selbst ist laengst als ProgressEvent gezaehlt, nur
  // der Bonus verfaellt.
  if (!ChallengeSystem.isDailyKeyWithinClientWindow(local.pendingDailyKey)) {
    clearPendingDaily();
    return;
  }

  const daily = await CloudSystem.claimDailyBonus(local.pendingDailyKey, local.pendingDailyEventId);
  if (AuthSystem.currentUserId() !== accountId) return;
  if (!daily.ok || !daily.value) return;

  SaveSystem.adoptProfileProgress(daily.value.data);
  clearPendingDaily();
}

function clearPendingDaily(): void {
  SaveSystem.update((data) => {
    data.pendingDailyKey = null;
    data.pendingDailyEventId = null;
    data.pendingDailyCoins = 0;
    data.pendingDailyScore = 0;
  });
}

/** Teilt einen laufenden Abgleich, damit Käufe nicht dazwischenlaufen. */
export function flush(): Promise<void> {
  flushPromise ??= flushPending().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

/**
 * Verwirft alle wartenden Laufereignisse.
 *
 * Nach einem Wartungs-Reset: Die Outbox enthaelt Laeufe, die der Server
 * gerade geloescht hat. Wuerden sie beim naechsten Abgleich hochgehen,
 * baute sich der Fortschritt sofort wieder auf und der Reset waere
 * wirkungslos.
 */
export function clearOutbox(): void {
  const accountId = AuthSystem.currentUserId();
  if (accountId) {
    writeOutbox(accountId, []);
    // Auch die Bot-Siege: der Server hat den Fortschritt gerade geloescht,
    // eine spaetere Gutschrift wuerde den Reset teilweise rueckgaengig machen.
    writeBotVictories(accountId, []);
  }
  cancelRetry();
}

export function pendingCount(): number {
  return readOutbox(AuthSystem.currentUserId()).length;
}

/** Ob neben dem sichtbaren Spielstand noch lokale Daten zum Upload warten. */
export function hasPendingData(): boolean {
  const local = SaveSystem.load();
  const accountId = AuthSystem.currentUserId();
  return (
    pendingCount() > 0 ||
    (Boolean(local.pendingDailyKey) && local.pendingDailyCoins > 0) ||
    (accountId !== null && readBotVictories(accountId).length > 0)
  );
}
