import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUuid } from '@/systems/uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nutzt crypto.randomUUID, wo es existiert', () => {
    expect(createUuid()).toMatch(UUID_V4);
  });

  it('liefert ohne sicheren Kontext trotzdem eine UUID v4', () => {
    // Genau der Zustand auf dem iPhone ueber http://192.168.x.x: kein randomUUID.
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T): T =>
        real.getRandomValues(array as unknown as Uint8Array) as unknown as T,
    });
    const ids = new Set(Array.from({ length: 50 }, () => createUuid()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
