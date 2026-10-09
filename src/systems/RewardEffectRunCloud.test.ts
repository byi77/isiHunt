import { beforeEach, expect, it, vi } from 'vitest';
import * as CloudSystem from './CloudSystem';

const { invoke, getUser } = vi.hoisted(() => ({ invoke: vi.fn(), getUser: vi.fn() }));
vi.mock('@/systems/BackendTransport', () => ({
  getSupabaseClient: () => ({ auth: { getUser }, functions: { invoke } }),
  isAvailable: () => true,
  withTimeout: async (operation: PromiseLike<unknown>) => ({ ok: true, value: await operation }),
}));

beforeEach(() => {
  window.localStorage.clear();
  invoke.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ error: null, data: { user: { id: 'verified-account' } } });
});
it('retains a failed transport request instead of silently starting without its paid effect', async () => {
  invoke.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  expect((await CloudSystem.startRewardEffectRun('silberhain')).ok).toBe(false);
  const first = invoke.mock.calls[0]![1].body.requestId;
  invoke.mockResolvedValueOnce({ error: null, data: { ok: true, effects: { speed: 1.3 } } });
  expect(await CloudSystem.startRewardEffectRun('silberhain')).toEqual({
    ok: true,
    value: { speed: 1.3 },
  });
  expect(invoke.mock.calls[1]![1].body.requestId).toBe(first);
});
it('accepts only the explicit terminal no-rights response as a run without effects', async () => {
  invoke.mockResolvedValue({
    data: null,
    error: {
      message: 'HTTP 400',
      context: new Response(JSON.stringify({ ok: false, code: 'unavailable', retryable: false }), {
        status: 400,
      }),
    },
  });
  expect(await CloudSystem.startRewardEffectRun('silberhain')).toEqual({ ok: true, value: null });
  expect(window.localStorage.length).toBe(0);
});
it('rejects undocumented effects and unconfirmed backend responses', async () => {
  invoke.mockResolvedValueOnce({ error: null, data: { ok: true, effects: { speed: 2 } } });
  expect((await CloudSystem.startRewardEffectRun('silberhain')).ok).toBe(false);
  invoke.mockResolvedValueOnce({ error: null, data: {} });
  expect((await CloudSystem.startRewardEffectRun('silberhain')).ok).toBe(false);
});
it('does not consume effects when there is no authenticated user', async () => {
  getUser.mockResolvedValue({ error: null, data: { user: null } });
  expect(await CloudSystem.startRewardEffectRun('silberhain')).toEqual({ ok: true, value: null });
  expect(invoke).not.toHaveBeenCalled();
});
