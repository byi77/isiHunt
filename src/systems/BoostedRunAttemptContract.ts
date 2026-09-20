import { transitionBoostedRun, type BoostedRunState } from '@/systems/BoostedRunState';

export interface AbandonBoostedRunRequest {
  readonly runId: string;
  readonly requestId: string;
}

export type AttemptEndResult =
  | { readonly ok: true; readonly state: BoostedRunState }
  | { readonly ok: false; readonly error: 'not_active' | 'wrong_run' };

/** Modelliert den serverseitigen Abbruchvertrag ohne Rueckerstattung. */
export function abandonBoostedRun(
  state: BoostedRunState,
  request: AbandonBoostedRunRequest,
): AttemptEndResult {
  if (state.runId !== request.runId) return { ok: false, error: 'wrong_run' };
  const next = transitionBoostedRun(state, 'abandoned');
  if (!next) return { ok: false, error: 'not_active' };
  return { ok: true, state: next };
}

export function canStartAfterAttempt(state: BoostedRunState | null): boolean {
  return state === null || state.status !== 'active';
}
