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

function readOutbox(accountId: string | null): ProgressEvent[] {
  quarantineLegacyOutbox();
  if (!accountId) return [];
  try {
    const raw = window.localStorage.getItem(accountOutboxKey(accountId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressEvent[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(accountId: string, events: ProgressEvent[]): void {
  try {
    window.localStorage.setItem(accountOutboxKey(accountId), JSON.stringify(events));
  } catch (error) {
    console.warn('[ProgressSyncSystem] Outbox nicht speicherbar.', error);
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

  writeOutbox(accountId, [...readOutbox(accountId), event]);
  return eventId;
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
  const remaining: ProgressEvent[] = [];

  for (let index = 0; index < pending.length; index++) {
    const event = pending[index]!;
    // Ein Sign-in-Wechsel waehrend eines await darf weder Events des alten
    // Kontos an das neue Konto senden noch dessen lokalen Stand uebernehmen.
    if (
      !AuthSystem.isSignedIn() ||
      AuthSystem.currentUserId() !== accountId ||
      SaveSystem.isTestProfileActive()
    ) {
      writeOutbox(accountId, pending.slice(index));
      return;
    }
    const result = await CloudSystem.submitProgressEvent(event);
    if (AuthSystem.currentUserId() !== accountId) {
      writeOutbox(accountId, pending.slice(index));
      return;
    }
    if (!result.ok) {
      remaining.push(event);
      remaining.push(...pending.slice(index + 1));
      break;
    }
    // Der Server ist die Quelle fuer XP, Coins, Level und validierte
    // Achievements. Der lokale Stand bleibt bis dahin nur UI-optimistisch;
    // nach jedem erfolgreichen Event wird die autoritative Antwort uebernommen.
    if (result.value) SaveSystem.adoptProfileProgress(result.value.data);
  }

  writeOutbox(accountId, remaining);

  if (remaining.length > 0) {
    scheduleRetry();
    // Der Tagesbonus darf erst abgeholt werden, wenn wirklich alle Laufereignisse
    // synchronisiert wurden. Sonst koennen XP/Coins/Level steigen, obwohl die
    // zugehoerige Spielzeit noch nicht im Profil steht.
    return;
  }
  cancelRetry();

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
  if (accountId) writeOutbox(accountId, []);
  cancelRetry();
}

export function pendingCount(): number {
  return readOutbox(AuthSystem.currentUserId()).length;
}

/** Ob neben dem sichtbaren Spielstand noch lokale Daten zum Upload warten. */
export function hasPendingData(): boolean {
  const local = SaveSystem.load();
  return pendingCount() > 0 || (Boolean(local.pendingDailyKey) && local.pendingDailyCoins > 0);
}
