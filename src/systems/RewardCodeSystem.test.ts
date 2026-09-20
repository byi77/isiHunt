import { describe, expect, it } from 'vitest';

import {
  clearPendingRewardRedemption,
  formatRewardCode,
  normalizeRewardCode,
  prepareRewardRedemption,
  rewardCodeLength,
} from './RewardCodeSystem';

describe('RewardCodeSystem', () => {
  it('normalisiert nur erlaubte Leerzeichen und Bindestriche', () => {
    expect(normalizeRewardCode('1234- 5678-9012')).toBe('123456789012');
    expect(formatRewardCode('123456789012')).toBe('1234-5678-9012');
  });

  it('erhält führende Nullen und wandelt nicht in eine Zahl um', () => {
    expect(formatRewardCode('0000 0000 0012')).toBe('0000-0000-0012');
  });

  it('weist falsche Länge und andere Zeichen zurück', () => {
    expect(rewardCodeLength()).toBe(12);
    expect(normalizeRewardCode('12345678901')).toBeNull();
    expect(normalizeRewardCode('12345678901A')).toBeNull();
    expect(normalizeRewardCode('1234_5678_9012')).toBeNull();
  });

  it('behält die Request-ID für denselben Wiederholungsversuch', () => {
    const first = prepareRewardRedemption('profile-a', '0000-0000-0012');
    const retry = prepareRewardRedemption('profile-a', '000000000012');
    expect(first).not.toBeNull();
    expect(retry).toEqual(first);
    clearPendingRewardRedemption('profile-a', first!.requestId);
    expect(prepareRewardRedemption('profile-a', '000000000012')?.requestId).not.toBe(
      first!.requestId,
    );
  });
});
