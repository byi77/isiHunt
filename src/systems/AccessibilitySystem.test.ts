import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  accessibleRarityLabel,
  ensureTouchTarget,
  motionDuration,
  prefersHighContrast,
  prefersReducedMotion,
} from '@/systems/AccessibilitySystem';

describe('AccessibilitySystem', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('erkennt reduced motion und setzt Effekte auf sofort', () => {
    expect(prefersReducedMotion()).toBe(true);
    expect(motionDuration(420)).toBe(0);
  });

  it('stellt kontrastreiche Systeme ueber die Media Query bereit', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('contrast') }));
    expect(prefersHighContrast()).toBe(true);
  });

  it('garantiert mindestens 44 px Bedienflaeche', () => {
    expect(ensureTouchTarget(20, 80)).toEqual({ width: 44, height: 80 });
  });

  it('macht Seltenheit auch ohne Farbe lesbar', () => {
    expect(accessibleRarityLabel('legendary', 'Legendär')).toBe('★ Legendär');
  });
});
