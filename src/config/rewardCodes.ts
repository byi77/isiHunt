/** Sicherheitsvertrag fuer serverseitige Belohnungscodes.
 *
 * Diese Werte sind nur Client-Konstanten fuer UI und Vorpruefung. Die
 * verbindliche Ratebegrenzung, HMAC-Pruefung und Einloeselogik liegen im
 * authentifizierten Server-Handler.
 */

export const REWARD_CODE_ATTEMPT_LIMIT_PER_MINUTE = 5;
export const REWARD_CODE_ATTEMPT_LIMIT_PER_HOUR = 20;
export const REWARD_CODE_MAX_COINS = 100_000;
export const REWARD_CODE_MAX_LEVEL = 100;
export const REWARD_CODE_MAX_BOOST_APPLICATIONS = 10;

export const REWARD_CODE_XP_FACTORS = [1.25, 1.3, 1.5, 2] as const;
export type RewardCodeXpFactor = (typeof REWARD_CODE_XP_FACTORS)[number];

export type RewardCodeFailureCode =
  'invalid_request' | 'unavailable' | 'already_redeemed' | 'rate_limited' | 'conflict';

export interface RewardCodeError {
  readonly code: RewardCodeFailureCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
}

export function isRewardRequestId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Redaction fuer Logs und Diagnoseausgaben; der vollstaendige Code darf nie geloggt werden. */
export function redactRewardCode(value: string): string {
  const normalized = value.replace(/[ -]/g, '');
  return normalized.length >= 4 ? `••••-••••-${normalized.slice(-4)}` : '••••';
}
