import { describe, expect, it } from 'vitest';

import { abandonBoostedRun, canStartAfterAttempt } from './BoostedRunAttemptContract';
import { createBoostedRunState } from './BoostedRunState';

describe('BoostedRunAttemptContract', () => {
  it('beendet nur die eigene aktive Lauf-ID und erstattet nichts', () => {
    const state = createBoostedRunState({
      runId: 'run-1',
      requestId: 'req-1',
      startedAt: 'a',
      expiresAt: 'b',
    });
    const result = abandonBoostedRun(state, { runId: 'run-1', requestId: 'req-2' });
    expect(result.ok && result.state.status).toBe('abandoned');
    expect(canStartAfterAttempt(result.ok ? result.state : null)).toBe(true);
  });
});
