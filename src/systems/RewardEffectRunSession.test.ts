import { beforeEach, expect, it, vi } from 'vitest';
import * as Session from './RewardEffectRunSession';

beforeEach(() => window.localStorage.clear());
it('reuses one persisted request after a lost response and until game consumption', async () => {
  const ids: string[] = [];
  const request = vi.fn(async (id: string) => {
    ids.push(id);
    return ids.length === 1
      ? { ok: false as const, error: 'timeout' }
      : { ok: true as const, value: { speed: 1.3 } };
  });
  expect((await Session.start('a', 'silberhain', request)).ok).toBe(false);
  expect((await Session.start('a', 'silberhain', request)).ok).toBe(true);
  await Session.start('a', 'silberhain', request);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  Session.consume('a', 'silberhain', { speed: 1.3 });
  await Session.start('a', 'silberhain', request);
  expect(ids[2]).not.toBe(ids[0]);
});
it('coalesces simultaneous taps before transport resolves', async () => {
  let resolve!: (value: { ok: true; value: { magnetism: number } }) => void;
  const request = vi.fn(
    () =>
      new Promise<{ ok: true; value: { magnetism: number } }>((done) => {
        resolve = done;
      }),
  );
  const first = Session.start('a', 'silberhain', request);
  const second = Session.start('a', 'silberhain', request);
  resolve({ ok: true, value: { magnetism: 1.3 } });
  expect(await second).toEqual(await first);
  expect(request).toHaveBeenCalledTimes(1);
});
it('isolates accounts and rejects a world switch with an unresolved request', async () => {
  await Session.start('a', 'silberhain', async () => ({ ok: false, error: 'offline' }));
  const request = vi.fn(async () => ({ ok: true as const, value: null }));
  expect((await Session.start('a', 'glutmark', request)).ok).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect((await Session.start('b', 'glutmark', request)).ok).toBe(true);
});
it('does not consume rights when a stable request cannot be persisted', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  const request = vi.fn(async () => ({ ok: true as const, value: null }));
  expect((await Session.start('a', 'silberhain', request)).ok).toBe(false);
  expect(request).not.toHaveBeenCalled();
  storage.mockRestore();
});

it('does not reuse a consumed effect and fails closed if consumption cannot be persisted', async () => {
  await Session.start('a', 'silberhain', async () => ({ ok: true, value: { speed: 1.3 } }));
  const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(Session.consume('a', 'silberhain', { speed: 1.3 })).toBe(false);
  spy.mockRestore();
  expect(Session.consume('a', 'silberhain', { speed: 1.3 })).toBe(true);
  expect(Session.consume('a', 'silberhain', { speed: 1.3 })).toBe(false);
});

it('rejects malformed stored requests and empty or array effect records before transport', async () => {
  for (const pending of [
    { worldId: 'silberhain', requestId: '-'.repeat(36) },
    { worldId: 'silberhain', requestId: '11111111-1111-4111-8111-111111111111', effects: {} },
    { worldId: 'silberhain', requestId: '11111111-1111-4111-8111-111111111111', effects: [] },
  ]) {
    window.localStorage.setItem('isihunt.effect-start.v1.a', JSON.stringify(pending));
    const request = vi.fn(async () => ({ ok: true as const, value: null }));
    expect((await Session.start('a', 'silberhain', request)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  }
});
