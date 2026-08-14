/** Offline-Outbox für Fortschrittsereignisse eines angemeldeten Profils. */

import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressEvent, ProgressionResult, RunStats } from '@/types';

const OUTBOX_KEY = 'isihunt.progress-events';
let flushPromise: Promise<void> | null = null;

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
export function enqueueRun(stats: RunStats, progression: ProgressionResult): void {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) return;

  const event: ProgressEvent = {
    eventId: createEventId(),
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
}

/** Überträgt wartende Runs in Reihenfolge; Fehler bleiben in der Outbox. */
async function flushPending(): Promise<void> {
  if (!AuthSystem.isSignedIn() || SaveSystem.isTestProfileActive()) return;

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

  const local = SaveSystem.load();
  if (!local.pendingDailyKey || local.pendingDailyCoins <= 0) return;
  const daily = await CloudSystem.claimDailyBonus(local.pendingDailyKey, local.pendingDailyScore);
  if (!daily.ok || !daily.value) return;

  SaveSystem.adoptProfileProgress(daily.value.data);
  SaveSystem.update((data) => {
    data.pendingDailyKey = null;
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
