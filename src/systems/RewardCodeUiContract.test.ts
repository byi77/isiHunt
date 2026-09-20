import { describe, expect, it } from 'vitest';

import {
  beginRewardCodeSubmit,
  finishRewardCodeSubmit,
  updateRewardCodeInput,
} from './RewardCodeUiContract';

describe('RewardCodeUiContract', () => {
  it('formatiert die Eingabe und erkennt einen sendefertigen Code', () => {
    const state = updateRewardCodeInput('000000000012');
    expect(state.displayValue).toBe('0000-0000-0012');
    expect(state.state).toBe('ready');
  });

  it('verhindert Mehrfachsubmit und behält die Request-ID', () => {
    const ready = updateRewardCodeInput('000000000012');
    const submitting = beginRewardCodeSubmit(ready, 'request-1');
    expect(beginRewardCodeSubmit(submitting, 'request-2')).toBe(submitting);
    expect(finishRewardCodeSubmit(submitting, false, 'temporarily unavailable')).toEqual({
      ...submitting,
      state: 'error',
      message: 'temporarily unavailable',
    });
  });
});
