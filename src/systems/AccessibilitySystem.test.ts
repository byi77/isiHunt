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

  it('reuses media queries and reads subsequent preference changes', () => {
    const motion = { matches: false };
    const query = vi.fn(() => motion);
    vi.stubGlobal('matchMedia', query);
    expect(prefersReducedMotion()).toBe(false);
    motion.matches = true;
    expect(prefersReducedMotion()).toBe(true);
    expect(motionDuration(420)).toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
    const replacement = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('matchMedia', replacement);
    expect(prefersReducedMotion()).toBe(false);
    expect(replacement).toHaveBeenCalledTimes(1);
  });
});
