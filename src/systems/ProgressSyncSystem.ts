/** Offline-Outbox für Fortschrittsereignisse eines angemeldeten Profils. */

import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import type { ProgressEvent, ProgressionResult, RunStats } from '@/types';

const OUTBOX_KEY = 'isihunt.progress-events';

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
  if (!AuthSystem.isSignedIn()) return;

  const event: ProgressEvent = {
    eventId: createEventId(),
    worldId: stats.worldId,
    score: stats.score,
    bestCombo: stats.bestCombo,
    xpGained: stats.xpGained,
    coinsGained: progression.coinsGained,
    talentPointsGained: progression.talentPointsGained,
    collected: stats.collected,
    unlockedAchievementIds: progression.unlockedAchievementIds,
    createdAt: new Date().toISOString(),
  };

  writeOutbox([...readOutbox(), event]);
}

/** Überträgt wartende Runs in Reihenfolge; Fehler bleiben in der Outbox. */
export async function flush(): Promise<void> {
  if (!AuthSystem.isSignedIn()) return;

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
}

export function pendingCount(): number {
  return readOutbox().length;
}
