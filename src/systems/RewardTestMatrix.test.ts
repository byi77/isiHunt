import { describe, expect, it } from 'vitest';

import { REWARD_TEST_MATRIX, rewardTestCasesForLayer } from './RewardTestMatrix';

describe('RewardTestMatrix', () => {
  it('enthaelt lokale und bewusst offene Testebenen', () => {
    expect(REWARD_TEST_MATRIX.some((testCase) => testCase.automatedNow)).toBe(true);
    expect(rewardTestCasesForLayer('concurrency').every((testCase) => !testCase.automatedNow)).toBe(
      true,
    );
    expect(rewardTestCasesForLayer('browser').length).toBeGreaterThan(0);
  });
});
