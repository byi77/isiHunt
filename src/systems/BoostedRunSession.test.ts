import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearFinish,
  clearStart,
  prepareStart,
  readPendingFinish,
  readPendingStart,
  savePendingFinish,
} from './BoostedRunSession';

const run = {
  runId: '550e8400-e29b-41d4-a716-446655440000',
  status: 'active' as const,
  startedAt: '2026-09-21T07:00:00.000Z',
  expiresAt: '2026-09-21T07:04:00.000Z',
  factor: 2,
  remainingApplications: 4,
};

describe('BoostedRunSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and clears the idempotent start request', () => {
    const pending = prepareStart('world-1');
    expect(readPendingStart('world-1')).toEqual(pending);
    expect(readPendingStart('world-2')).toBeNull();
    clearStart();
    expect(readPendingStart('world-1')).toBeNull();
  });

  it('persists a finish before the network request and validates its run id', () => {
    expect(
      savePendingFinish({
        run,
        input: {
          runId: run.runId,
          score: 100,
          bestCombo: 4,
          durationMs: 60000,
          collected: { common: 2 },
          achievementIds: [],
        },
      }),
    ).toBe(true);
    expect(readPendingFinish()?.input.score).toBe(100);
    clearFinish();
    expect(readPendingFinish()).toBeNull();
  });
});
