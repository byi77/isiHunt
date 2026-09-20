import { isRewardRequestId } from '@/config/rewardCodes';
import { normalizeRewardCode } from '@/systems/RewardCodeSystem';
import type { RewardGrant } from '@/systems/RewardPackageSystem';

export interface RewardRedemptionRequest {
  readonly code: string;
  readonly requestId: string;
}

export interface RewardRedemptionReceipt {
  readonly redemptionId: string;
  readonly requestId: string;
  readonly packageVersion: number;
  readonly grants: readonly RewardGrant[];
}

export type RewardRedemptionValidation =
  | { readonly ok: true; readonly value: { readonly code: string; readonly requestId: string } }
  | { readonly ok: false; readonly error: 'invalid_code' | 'invalid_request_id' };

/** Clientseitige Formpruefung; Auth, Accountbindung und atomare Buchung bleiben serverseitig. */
export function validateRewardRedemptionRequest(
  input: RewardRedemptionRequest,
): RewardRedemptionValidation {
  const code = normalizeRewardCode(input.code);
  if (!code) return { ok: false, error: 'invalid_code' };
  if (!isRewardRequestId(input.requestId)) return { ok: false, error: 'invalid_request_id' };
  return { ok: true, value: { code, requestId: input.requestId.toLowerCase() } };
}
