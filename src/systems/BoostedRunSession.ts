import type { BoostedRunFinishInput, BoostedRunStart } from '@/systems/CloudSystem';

const START_KEY = 'isihunt.boosted-run-start.v1';
const FINISH_KEY = 'isihunt.boosted-run-finish.v1';

export interface PendingBoostedStart {
  readonly worldId: string;
  readonly requestId: string;
}

export interface PendingBoostedFinish {
  readonly run: BoostedRunStart;
  readonly input: BoostedRunFinishInput;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function prepareStart(worldId: string): PendingBoostedStart {
  const pending = { worldId, requestId: crypto.randomUUID() };
  write(START_KEY, pending);
  return pending;
}

export function readPendingStart(worldId: string): PendingBoostedStart | null {
  const value = read<PendingBoostedStart>(START_KEY);
  return value && value.worldId === worldId && isUuid(value.requestId) ? value : null;
}

export function clearStart(): void {
  try {
    window.localStorage.removeItem(START_KEY);
  } catch {
    // Ein gesperrter Speicher darf den Serverstart nicht blockieren.
  }
}

export function savePendingFinish(value: PendingBoostedFinish): boolean {
  return write(FINISH_KEY, value);
}

export function readPendingFinish(): PendingBoostedFinish | null {
  const value = read<PendingBoostedFinish>(FINISH_KEY);
  if (!value || !value.run || !value.input) return null;
  if (!isUuid(value.run.runId) || !isUuid(value.input.runId)) return null;
  if (value.run.runId !== value.input.runId) return null;
  return value;
}

export function clearFinish(): void {
  try {
    window.localStorage.removeItem(FINISH_KEY);
  } catch {
    // Siehe clearStart.
  }
}
