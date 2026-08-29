/** Regressionstest fuer den Offline-/PWA-Start ohne Animation-Frames. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitForViewportToSettle } from '@/core/viewport';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('waitForViewportToSettle', () => {
  it('loest sich auch ohne requestAnimationFrame nach dem Sicherheitslimit', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    document.body.innerHTML = '<div id="game"></div>';

    let settled = false;
    const waiting = waitForViewportToSettle().then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1_199);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(settled).toBe(true);
  });
});
