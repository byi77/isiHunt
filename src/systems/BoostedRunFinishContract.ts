import type { BoostedRunState } from '@/systems/BoostedRunState';

export interface BoostedRunFinishStats {
  readonly worldId: string;
  readonly mode: 'solo' | 'daily';
  readonly score: number;
  readonly bestCombo: number;
  readonly durationMs: number;
  readonly collected: Readonly<Record<string, number>>;
}

export interface BoostedRunFinishRequest {
  readonly runId: string;
  readonly eventId: string;
  readonly stats: BoostedRunFinishStats;
}

export type BoostedRunFinishValidation =
  | { readonly ok: true; readonly value: BoostedRunFinishRequest }
  | { readonly ok: false; readonly error: 'invalid_identity' | 'invalid_stats' };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isFiniteInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

/** Formvertrag; die verbindliche Plausibilitaet und XP-Berechnung bleibt serverseitig. */
export function validateBoostedRunFinishRequest(
  input: BoostedRunFinishRequest,
): BoostedRunFinishValidation {
  if (!isUuid(input.runId) || !isUuid(input.eventId))
    return { ok: false, error: 'invalid_identity' };
  const stats = input.stats;
  if (
    !stats ||
    (stats.mode !== 'solo' && stats.mode !== 'daily') ||
    typeof stats.worldId !== 'string' ||
    stats.worldId.length === 0
  ) {
    return { ok: false, error: 'invalid_stats' };
  }
  if (
    !isFiniteInteger(stats.score, 0, 2_000_000_000) ||
    !isFiniteInteger(stats.bestCombo, 0, 100_000) ||
    !isFiniteInteger(stats.durationMs, 1, 120_000)
  ) {
    return { ok: false, error: 'invalid_stats' };
  }
  if (
    typeof stats.collected !== 'object' ||
    stats.collected === null ||
    Array.isArray(stats.collected)
  ) {
    return { ok: false, error: 'invalid_stats' };
  }
  return { ok: true, value: input };
}

/** Gemeinsame Rundung fuer die Anzeige/Vertragsdokumentation; Server bleibt autoritativ. */
export function calculateBoostedXp(baseXp: number, factor: number): number {
  if (!Number.isFinite(baseXp) || baseXp < 0 || !Number.isFinite(factor) || factor < 1) return 0;
  return Math.round(baseXp * factor);
}

export function canFinishBoostedRun(
  state: BoostedRunState,
  nowMs: number,
  expiresAtMs: number,
): boolean {
  return state.status === 'active' && Number.isFinite(nowMs) && nowMs <= expiresAtMs;
}
