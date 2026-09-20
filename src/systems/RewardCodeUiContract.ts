import { formatRewardCode, normalizeRewardCode } from '@/systems/RewardCodeSystem';

export type RewardCodeInputState =
  'empty' | 'editing' | 'invalid' | 'ready' | 'submitting' | 'success' | 'error';

export interface RewardCodeUiState {
  readonly rawValue: string;
  readonly displayValue: string;
  readonly state: RewardCodeInputState;
  readonly requestId: string | null;
  readonly message: string | null;
}

export function updateRewardCodeInput(rawValue: string): RewardCodeUiState {
  const normalized = normalizeRewardCode(rawValue);
  const displayValue: string =
    normalized === null
      ? rawValue.replace(/[^0-9 -]/g, '').slice(0, 14)
      : (formatRewardCode(normalized) ?? '');
  const state: RewardCodeInputState =
    displayValue.length === 0 ? 'empty' : normalized ? 'ready' : 'editing';
  return { rawValue, displayValue, state, requestId: null, message: null };
}

export function beginRewardCodeSubmit(
  state: RewardCodeUiState,
  requestId: string,
): RewardCodeUiState {
  if (state.state !== 'ready' || state.requestId !== null) return state;
  return { ...state, state: 'submitting', requestId, message: null };
}

export function finishRewardCodeSubmit(
  state: RewardCodeUiState,
  success: boolean,
  message: string,
): RewardCodeUiState {
  if (state.state !== 'submitting') return state;
  return { ...state, state: success ? 'success' : 'error', message };
}
