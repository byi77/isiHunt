import type { RarityId } from '@/config/rarities';
import * as SaveSystem from '@/systems/SaveSystem';
import {
  FEEDBACK_POLICIES,
  feedbackKindForRarity,
  type FeedbackKind,
} from '@/systems/FeedbackSystem';

export type HapticPattern = number | number[];

function hapticsEnabled(): boolean {
  return SaveSystem.load().hapticsEnabled;
}

export function isEnabled(): boolean {
  return hapticsEnabled();
}

/** Gibt false zurueck, wenn Browser oder Einstellung keine Haptik erlauben. */
export function vibrate(pattern: HapticPattern): boolean {
  if (
    !hapticsEnabled() ||
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return false;
  }

  try {
    return navigator.vibrate(Array.isArray(pattern) ? [...pattern] : pattern);
  } catch {
    return false;
  }
}

export function playFeedback(kind: FeedbackKind): boolean {
  return vibrate(FEEDBACK_POLICIES[kind].hapticPattern);
}

export function playCollected(rarityId: RarityId): boolean {
  return playFeedback(feedbackKindForRarity(rarityId));
}

export function setEnabled(enabled: boolean): void {
  if (!enabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(0);
    } catch {
      // Fehlende oder blockierte Haptik darf den Einstellungswechsel nicht stoeren.
    }
  }
  SaveSystem.update((data) => {
    data.hapticsEnabled = enabled;
  });
  if (enabled) vibrate(8);
  else vibrate(0);
}
