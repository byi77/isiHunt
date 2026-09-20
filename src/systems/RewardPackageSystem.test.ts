import { describe, expect, it } from 'vitest';

import { validateRewardPackage } from './RewardPackageSystem';

describe('RewardPackageSystem', () => {
  it('akzeptiert nur whitelisted Grants', () => {
    const result = validateRewardPackage({
      version: 1,
      grants: [
        { type: 'coins', amount: 500 },
        { type: 'cosmetic_grant', cosmeticType: 'ship_color', cosmeticId: 'sunset' },
        { type: 'xp_run_boost', factor: 1.5, applications: 2 },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('weist freie Save-Patches und ungueltige Mengen zurueck', () => {
    expect(
      validateRewardPackage({
        version: 1,
        grants: [{ type: 'save_patch', path: 'coins', value: 999999 }],
      }).ok,
    ).toBe(false);
    expect(
      validateRewardPackage({ version: 1, grants: [{ type: 'coins', amount: 100001 }] }).ok,
    ).toBe(false);
  });
});
