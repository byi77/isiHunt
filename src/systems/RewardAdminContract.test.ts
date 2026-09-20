import { describe, expect, it } from 'vitest';

import { validateRewardCampaignDraft } from './RewardAdminContract';

describe('RewardAdminContract', () => {
  const draft = {
    name: 'Launch',
    description: 'Starter package',
    package: { version: 1, grants: [{ type: 'coins', amount: 100 }] },
    startsAt: '2026-09-20T00:00:00Z',
    endsAt: '2026-10-20T00:00:00Z',
    globalLimit: 100,
    accountLimit: 1,
  };

  it('validiert Entwurf und Paket gemeinsam', () => {
    expect(validateRewardCampaignDraft(draft).ok).toBe(true);
    expect(
      validateRewardCampaignDraft({
        ...draft,
        package: { version: 1, grants: [{ type: 'save_patch' }] },
      }).ok,
    ).toBe(false);
  });
});
