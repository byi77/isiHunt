export type BoostedRunStatus = 'active' | 'settled' | 'abandoned' | 'expired';
export type BoostedRunTerminalStatus = Exclude<BoostedRunStatus, 'active'>;

export interface BoostedRunState {
  readonly runId: string;
  readonly requestId: string;
  readonly status: BoostedRunStatus;
  readonly applicationConsumed: true;
  readonly startedAt: string;
  readonly expiresAt: string;
}

export function createBoostedRunState(
  input: Omit<BoostedRunState, 'status' | 'applicationConsumed'>,
): BoostedRunState {
  return { ...input, status: 'active', applicationConsumed: true };
}

/** Nur active darf beendet werden; wiederholte gleiche Abschlussmeldungen sind idempotent. */
export function transitionBoostedRun(
  state: BoostedRunState,
  nextStatus: BoostedRunTerminalStatus,
): BoostedRunState | null {
  if (state.status === nextStatus) return state;
  if (state.status !== 'active') return null;
  return { ...state, status: nextStatus };
}

export function canStartGame(state: BoostedRunState): boolean {
  return state.status === 'active' && state.applicationConsumed;
}
