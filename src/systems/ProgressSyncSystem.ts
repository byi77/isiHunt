/** Offline-Outbox für Fortschrittsereignisse eines angemeldeten Profils. */

import { SYNC_RETRY_DELAYS_MS } from '@/config/backend';
import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressEvent, ProgressionResult, RunStats } from '@/types';

const OUTBOX_KEY = 'isihunt.progress-events';
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

function readOutbox(): ProgressEvent[] {
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressEvent[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(events: ProgressEvent[]): void {
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn('[ProgressSyncSystem] Outbox nicht speicherbar.', error);
  }
}

/** Legt einen Run lokal ab, bevor der Netzwerkversuch startet. */
export function enqueueRun(stats: RunStats, progression: ProgressionResult): string | null {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) return null;

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
    createdAt: new Date().toISOString(),
  };

  writeOutbox([...readOutbox(), event]);
  return eventId;
}

/** Überträgt wartende Runs in Reihenfolge; Fehler bleiben in der Outbox. */
async function flushPending(): Promise<void> {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) {
    cancelRetry();
    return;
  }

  const pending = readOutbox();
  const remaining: ProgressEvent[] = [];

  for (const event of pending) {
    const result = await CloudSystem.submitProgressEvent(event);
    if (!result.ok) {
      remaining.push(event);
      remaining.push(...pending.slice(pending.indexOf(event) + 1));
      break;
    }
  }

  writeOutbox(remaining);

  if (remaining.length > 0) {
    scheduleRetry();
    // Der Tagesbonus darf erst abgeholt werden, wenn wirklich alle Laufereignisse
    // synchronisiert wurden. Sonst koennen XP/Coins/Level steigen, obwohl die
    // zugehoerige Spielzeit noch nicht im Profil steht.
    return;
  }
  cancelRetry();

  const local = SaveSystem.load();
  if (!local.pendingDailyKey || !local.pendingDailyEventId || local.pendingDailyCoins <= 0) return;

  const daily = await CloudSystem.claimDailyBonus(
    local.pendingDailyKey,
    local.pendingDailyScore,
    local.pendingDailyEventId,
  );
  if (!daily.ok || !daily.value) return;

  SaveSystem.adoptProfileProgress(daily.value.data);
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

export function pendingCount(): number {
  return readOutbox().length;
}

/** Ob neben dem sichtbaren Spielstand noch lokale Daten zum Upload warten. */
export function hasPendingData(): boolean {
  const local = SaveSystem.load();
  return pendingCount() > 0 || (Boolean(local.pendingDailyKey) && local.pendingDailyCoins > 0);
}
