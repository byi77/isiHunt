import { describe, expect, it } from 'vitest';

import { validateRewardRedemptionRequest } from './RewardRedemptionContract';

describe('RewardRedemptionContract', () => {
  it('normalisiert Code und Request-ID', () => {
    const result = validateRewardRedemptionRequest({
      code: '0000-0000-0012',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual({
      ok: true,
      value: { code: '000000000012', requestId: '550e8400-e29b-41d4-a716-446655440000' },
    });
  });

  it('weist fehlende UUID oder Codeform zurueck', () => {
    expect(validateRewardRedemptionRequest({ code: '1234', requestId: 'x' }).ok).toBe(false);
  });
});
