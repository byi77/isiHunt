import { describe, expect, it } from 'vitest';

import { canStartGame, createBoostedRunState, transitionBoostedRun } from './BoostedRunState';

describe('BoostedRunState', () => {
  const active = createBoostedRunState({
    runId: 'run-1',
    requestId: 'request-1',
    startedAt: '2026-09-20T10:00:00Z',
    expiresAt: '2026-09-20T10:02:00Z',
  });

  it('startet nur nach bestaetigtem Verbrauch aktiv', () => {
    expect(active.status).toBe('active');
    expect(active.applicationConsumed).toBe(true);
    expect(canStartGame(active)).toBe(true);
  });

  it('erlaubt genau active zu terminal und wiederholt denselben Abschluss idempotent', () => {
    const settled = transitionBoostedRun(active, 'settled');
    expect(settled?.status).toBe('settled');
    expect(settled && transitionBoostedRun(settled, 'settled')).toBe(settled);
    expect(settled && transitionBoostedRun(settled, 'abandoned')).toBeNull();
  });
});
