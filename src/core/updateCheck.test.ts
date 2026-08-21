/** Regressionstests fuer den cache-sicheren Versionscheck. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_VERSION } from '@/config/GameConfig';
import { checkForUpdate } from '@/core/updateCheck';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('updateCheck', () => {
  it('meldet eine neuere Version mit Cache-Buster', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '9.9.9' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkForUpdate()).resolves.toEqual({
      available: '9.9.9',
      running: APP_VERSION,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^version\.json\?_=[0-9]+$/),
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    );
  });

  it('ignoriert gleiche, fehlerhafte und nicht erfolgreiche Antworten', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: APP_VERSION }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: 123 }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ version: '9.9.9' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkForUpdate()).resolves.toBeNull();
    await expect(checkForUpdate()).resolves.toBeNull();
    await expect(checkForUpdate()).resolves.toBeNull();
  });

  it('behandelt Netzwerkfehler als unbekannten Update-Stand', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(checkForUpdate()).resolves.toBeNull();
  });
});
