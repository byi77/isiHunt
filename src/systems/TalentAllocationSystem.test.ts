import { describe, expect, it } from 'vitest';

import {
  changeTalentRank,
  normalizeTalentRanks,
  talentPointsSpent,
} from '@/systems/TalentAllocationSystem';

describe('TalentAllocationSystem', () => {
  it('vergibt und entfernt einzelne Ränge mit Plus und Minus', () => {
    const first = changeTalentRank({}, 'reach', 1, 10);
    const second = changeTalentRank(first!, 'reach', 1, 10);
    const removed = changeTalentRank(second!, 'reach', -1, 10);

    expect(second).toEqual({ reach: 2 });
    expect(removed).toEqual({ reach: 1 });
    expect(talentPointsSpent(removed!)).toBe(1);
  });

  it('begrenzt einen Build auf Budget und Maximalrang', () => {
    expect(changeTalentRank({ reach: 5 }, 'reach', 1, 10)).toBeNull();
    expect(changeTalentRank({ reach: 5, swiftness: 5 }, 'magnetism', 1, 10)).toBeNull();
    expect(normalizeTalentRanks({ reach: 5, swiftness: 5, magnetism: 4 }, 10)).toEqual({
      reach: 5,
      swiftness: 5,
    });
  });

  it('entfernt den letzten Rang aus dem sparsamen Rangobjekt', () => {
    expect(changeTalentRank({ reach: 1 }, 'reach', -1, 10)).toEqual({});
    expect(changeTalentRank({}, 'reach', -1, 10)).toBeNull();
  });
});
