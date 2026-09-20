import type { RewardPackage, RewardGrant } from '@/systems/RewardPackageSystem';
import type { BoostedRunState } from '@/systems/BoostedRunState';

export interface BoostApplication {
  readonly applicationId: string;
  readonly factor: number;
  readonly remainingApplications: number;
  readonly sourcePackageVersion: number;
}

export interface BoostedRunContext {
  readonly run: BoostedRunState;
  readonly worldId: string;
  readonly mode: 'solo' | 'daily';
  readonly factor: number;
  readonly balanceVersion: number;
  readonly eventId: string;
}

export interface RewardRedemptionServerResponse {
  readonly redemptionId: string;
  readonly requestId: string;
  readonly packageVersion: number;
  readonly grants: readonly RewardGrant[];
  readonly profileRevision: number;
  readonly boosts: readonly BoostApplication[];
}

export interface RewardIntegrationSnapshot {
  readonly package: RewardPackage;
  readonly profileRevision: number;
  readonly activeBoosts: readonly BoostApplication[];
}

/** Gemeinsame Grenztypen fuer CloudSystem, Systeme und Szenen; kein Phaser-/UI-Zugriff. */
export type RewardServerFailure =
  | {
      readonly code: 'unauthorized' | 'conflict' | 'unavailable' | 'invalid_request';
      readonly retryable: boolean;
    }
  | { readonly code: 'rate_limited'; readonly retryable: true; readonly retryAfterSeconds: number };
