import { validateRewardPackage, type RewardPackage } from '@/systems/RewardPackageSystem';

export interface RewardCampaignDraft {
  readonly name: string;
  readonly description: string;
  readonly package: unknown;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly globalLimit: number;
  readonly accountLimit: number;
}

export type RewardCampaignDraftValidation =
  | {
      readonly ok: true;
      readonly value: Omit<RewardCampaignDraft, 'package'> & { readonly package: RewardPackage };
    }
  | {
      readonly ok: false;
      readonly error: 'invalid_text' | 'invalid_window' | 'invalid_limit' | 'invalid_package';
    };

/** Vorschau-/Entwurfspruefung; keine Adminautorisierung und keine Codegenerierung. */
export function validateRewardCampaignDraft(
  input: RewardCampaignDraft,
): RewardCampaignDraftValidation {
  if (
    input.name.trim().length < 1 ||
    input.name.trim().length > 120 ||
    input.description.length > 1000
  ) {
    return { ok: false, error: 'invalid_text' };
  }
  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    return { ok: false, error: 'invalid_window' };
  }
  if (
    !Number.isInteger(input.globalLimit) ||
    input.globalLimit < 1 ||
    input.globalLimit > 1_000_000 ||
    !Number.isInteger(input.accountLimit) ||
    input.accountLimit < 1 ||
    input.accountLimit > 100
  ) {
    return { ok: false, error: 'invalid_limit' };
  }
  const packageResult = validateRewardPackage(input.package);
  if (!packageResult.ok) return { ok: false, error: 'invalid_package' };
  return { ok: true, value: { ...input, package: packageResult.value } };
}
