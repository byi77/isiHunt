import {
  REWARD_CODE_MAX_BOOST_APPLICATIONS,
  REWARD_CODE_MAX_COINS,
  REWARD_CODE_MAX_LEVEL,
  REWARD_CODE_XP_FACTORS,
  type RewardCodeXpFactor,
} from '@/config/rewardCodes';

export type RewardGrant =
  | { readonly type: 'coins'; readonly amount: number }
  | {
      readonly type: 'cosmetic_grant';
      readonly cosmeticType: 'ship_shape' | 'ship_color' | 'ship_aura';
      readonly cosmeticId: string;
    }
  | { readonly type: 'minimum_level'; readonly level: number }
  | {
      readonly type: 'xp_run_boost';
      readonly factor: RewardCodeXpFactor;
      readonly applications: number;
    };

export interface RewardPackage {
  readonly version: number;
  readonly grants: readonly RewardGrant[];
}

export type RewardPackageValidation =
  | { readonly ok: true; readonly value: RewardPackage }
  | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isXpFactor(value: unknown): value is RewardCodeXpFactor {
  return (REWARD_CODE_XP_FACTORS as readonly number[]).includes(value as number);
}

/** Whitelist-Validator: Belohnungspakete duerfen keine freien Save-Patches enthalten. */
export function validateRewardPackage(input: unknown): RewardPackageValidation {
  if (
    !isRecord(input) ||
    typeof input.version !== 'number' ||
    !Number.isInteger(input.version) ||
    input.version < 1
  ) {
    return { ok: false, error: 'invalid_package_version' };
  }
  const version = input.version;
  if (!Array.isArray(input.grants) || input.grants.length === 0 || input.grants.length > 8) {
    return { ok: false, error: 'invalid_grants' };
  }

  const grants: RewardGrant[] = [];
  for (const rawGrant of input.grants) {
    if (!isRecord(rawGrant) || typeof rawGrant.type !== 'string') {
      return { ok: false, error: 'invalid_grant' };
    }
    if (rawGrant.type === 'coins') {
      const amount = rawGrant.amount;
      if (
        typeof amount !== 'number' ||
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > REWARD_CODE_MAX_COINS
      ) {
        return { ok: false, error: 'invalid_coin_grant' };
      }
      grants.push({ type: 'coins', amount });
      continue;
    }
    if (rawGrant.type === 'minimum_level') {
      const level = rawGrant.level;
      if (
        typeof level !== 'number' ||
        !Number.isInteger(level) ||
        level < 1 ||
        level > REWARD_CODE_MAX_LEVEL
      ) {
        return { ok: false, error: 'invalid_level_grant' };
      }
      grants.push({ type: 'minimum_level', level });
      continue;
    }
    if (rawGrant.type === 'xp_run_boost') {
      const factor = rawGrant.factor;
      const applications = rawGrant.applications;
      if (
        !isXpFactor(factor) ||
        typeof applications !== 'number' ||
        !Number.isInteger(applications) ||
        applications < 1 ||
        applications > REWARD_CODE_MAX_BOOST_APPLICATIONS
      ) {
        return { ok: false, error: 'invalid_boost_grant' };
      }
      grants.push({ type: 'xp_run_boost', factor, applications });
      continue;
    }
    if (rawGrant.type === 'cosmetic_grant') {
      const cosmeticType = rawGrant.cosmeticType;
      const cosmeticId = rawGrant.cosmeticId;
      if (
        !['ship_shape', 'ship_color', 'ship_aura'].includes(String(cosmeticType)) ||
        typeof cosmeticId !== 'string' ||
        !/^[a-z0-9_-]{1,64}$/.test(cosmeticId)
      ) {
        return { ok: false, error: 'invalid_cosmetic_grant' };
      }
      grants.push({
        type: 'cosmetic_grant',
        cosmeticType: cosmeticType as 'ship_shape' | 'ship_color' | 'ship_aura',
        cosmeticId,
      });
      continue;
    }
    return { ok: false, error: 'unknown_grant_type' };
  }
  return { ok: true, value: { version, grants } };
}
