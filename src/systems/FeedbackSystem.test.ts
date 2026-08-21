import { describe, expect, it } from 'vitest';

import {
  acceptFeedback,
  createFeedbackGate,
  feedbackKindForRarity,
} from '@/systems/FeedbackSystem';

describe('FeedbackSystem', () => {
  it('ordnet normale, seltene und legendaere Treffer hierarchisch', () => {
    expect(feedbackKindForRarity('common')).toBe('collect-common');
    expect(feedbackKindForRarity('epic')).toBe('collect-rare');
    expect(feedbackKindForRarity('legendary')).toBe('legendary');
  });

  it('laesst ein legendaeres Ereignis durch und unterdrueckt den Tonhaufen danach', () => {
    const gate = createFeedbackGate();
    expect(acceptFeedback(gate, 'legendary', 1000)).toBe(true);
    expect(acceptFeedback(gate, 'collect-common', 1050)).toBe(false);
    expect(acceptFeedback(gate, 'combo', 1050)).toBe(false);
    expect(acceptFeedback(gate, 'collect-common', 1400)).toBe(true);
  });

  it('begrenzt identische UI-Impulse, ohne spaetere Ereignisse zu verlieren', () => {
    const gate = createFeedbackGate();
    expect(acceptFeedback(gate, 'ui', 0)).toBe(true);
    expect(acceptFeedback(gate, 'ui', 20)).toBe(false);
    expect(acceptFeedback(gate, 'ui', 50)).toBe(true);
  });
});
