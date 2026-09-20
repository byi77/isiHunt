import { describe, expect, it } from 'vitest';

import { calculateBoostedXp, validateBoostedRunFinishRequest } from './BoostedRunFinishContract';

describe('BoostedRunFinishContract', () => {
  const request = {
    runId: '550e8400-e29b-41d4-a716-446655440000',
    eventId: '550e8400-e29b-41d4-a716-446655440001',
    stats: {
      worldId: 'forest',
      mode: 'solo' as const,
      score: 100,
      bestCombo: 3,
      durationMs: 60000,
      collected: { common: 2 },
    },
  };

  it('validiert Identitaet und Grundstats', () => {
    expect(validateBoostedRunFinishRequest(request).ok).toBe(true);
    expect(validateBoostedRunFinishRequest({ ...request, eventId: 'bad' }).ok).toBe(false);
  });

  it('verwendet die gemeinsame XP-Rundung', () => {
    expect(calculateBoostedXp(3967, 2)).toBe(7934);
    expect(calculateBoostedXp(-1, 2)).toBe(0);
  });
});
