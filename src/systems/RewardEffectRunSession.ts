import type { CloudResult } from './BackendTransport';

export type RunEffects = Readonly<Partial<Record<'speed' | 'magnetism' | 'combo_grace', number>>>;
interface PendingStart {
  worldId: string;
  requestId: string;
  effects?: RunEffects;
}
const PREFIX = 'isihunt.effect-start.v1.';
const inFlight = new Map<
  string,
  { worldId: string; promise: Promise<CloudResult<RunEffects | null>> }
>();

function read(accountId: string): PendingStart | null {
  const raw = window.localStorage.getItem(PREFIX + accountId);
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingStart;
  if (
    typeof value.worldId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)
  )
    throw new Error('Unbekannter Bonusstart');
  if (
    value.effects !== undefined &&
    (!value.effects ||
      Array.isArray(value.effects) ||
      Object.keys(value.effects).length === 0 ||
      typeof value.effects !== 'object' ||
      Object.entries(value.effects).some(
        ([key, factor]) => !['speed', 'magnetism', 'combo_grace'].includes(key) || factor !== 1.3,
      ))
  )
    throw new Error('Unbekannte Bonuseffekte');
  return value;
}

export function start(
  accountId: string,
  worldId: string,
  request: (requestId: string) => Promise<CloudResult<RunEffects | null>>,
): Promise<CloudResult<RunEffects | null>> {
  const running = inFlight.get(accountId);
  if (running)
    return running.worldId === worldId
      ? running.promise
      : Promise.resolve({
          ok: false,
          error: `Bitte den ausstehenden Start in ${running.worldId} wiederholen.`,
        });
  const operation = (async (): Promise<CloudResult<RunEffects | null>> => {
    try {
      let pending = read(accountId);
      if (pending && pending.worldId !== worldId)
        return {
          ok: false,
          error: `Bitte den ausstehenden Start in ${pending.worldId} wiederholen.`,
        };
      if (pending?.effects) return { ok: true, value: pending.effects };
      pending ??= { worldId, requestId: crypto.randomUUID() };
      window.localStorage.setItem(PREFIX + accountId, JSON.stringify(pending));
      const result = await request(pending.requestId);
      if (!result.ok) return result;
      if (result.value)
        window.localStorage.setItem(
          PREFIX + accountId,
          JSON.stringify({ ...pending, effects: result.value }),
        );
      else window.localStorage.removeItem(PREFIX + accountId);
      return result;
    } catch {
      return {
        ok: false,
        error: 'Bonusstart konnte nicht gesichert werden. Bitte erneut versuchen.',
      };
    }
  })();
  inFlight.set(accountId, { worldId, promise: operation });
  void operation.finally(() => {
    if (inFlight.get(accountId)?.promise === operation) inFlight.delete(accountId);
  });
  return operation;
}

export function consume(
  accountId: string | null,
  worldId: string,
  effects: RunEffects | undefined,
): boolean {
  if (!effects) return true;
  if (!accountId) return false;
  try {
    const pending = read(accountId);
    if (pending?.worldId !== worldId || JSON.stringify(pending.effects) !== JSON.stringify(effects))
      return false;
    window.localStorage.removeItem(PREFIX + accountId);
    return window.localStorage.getItem(PREFIX + accountId) === null;
  } catch {
    return false;
  }
}
