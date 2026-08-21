/** Gemeinsame Prioritaets- und Ueberlappungsregeln fuer Audio/Haptik. */

export type FeedbackKind =
  | 'ui'
  | 'collect-common'
  | 'collect-rare'
  | 'combo'
  | 'obstacle'
  | 'run-start'
  | 'run-end'
  | 'legendary';

export interface FeedbackPolicy {
  readonly priority: number;
  readonly cooldownMs: number;
  readonly hapticPattern: number | number[];
}

export const FEEDBACK_POLICIES: Readonly<Record<FeedbackKind, FeedbackPolicy>> = {
  ui: { priority: 1, cooldownMs: 45, hapticPattern: 6 },
  'collect-common': { priority: 2, cooldownMs: 55, hapticPattern: 8 },
  'collect-rare': { priority: 4, cooldownMs: 120, hapticPattern: [12, 18, 16] },
  combo: { priority: 5, cooldownMs: 160, hapticPattern: [10, 20, 18] },
  obstacle: { priority: 4, cooldownMs: 160, hapticPattern: [18, 24, 18] },
  'run-start': { priority: 6, cooldownMs: 250, hapticPattern: [12, 30, 22] },
  'run-end': { priority: 7, cooldownMs: 400, hapticPattern: [18, 35, 28] },
  legendary: { priority: 9, cooldownMs: 450, hapticPattern: [22, 35, 50] },
};

export interface FeedbackGateState {
  lastKind: FeedbackKind | null;
  lastAt: number;
}

export function createFeedbackGate(): FeedbackGateState {
  return { lastKind: null, lastAt: Number.NEGATIVE_INFINITY };
}

/** Hohe Ereignisse unterdruecken nur unmittelbar nachfolgende Kleinsignale. */
export function acceptFeedback(
  state: FeedbackGateState,
  kind: FeedbackKind,
  nowMs: number,
): boolean {
  const current = FEEDBACK_POLICIES[kind];
  const previous = state.lastKind ? FEEDBACK_POLICIES[state.lastKind] : null;
  const elapsed = nowMs - state.lastAt;
  const blockedByPriority = previous && previous.priority > current.priority && elapsed < 350;
  const blockedByCooldown = state.lastKind === kind && elapsed < current.cooldownMs;
  if (blockedByPriority || blockedByCooldown) return false;

  state.lastKind = kind;
  state.lastAt = nowMs;
  return true;
}

export function feedbackKindForRarity(
  rarityId: 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary',
): FeedbackKind {
  if (rarityId === 'legendary') return 'legendary';
  if (rarityId === 'rare' || rarityId === 'epic') return 'collect-rare';
  return 'collect-common';
}
