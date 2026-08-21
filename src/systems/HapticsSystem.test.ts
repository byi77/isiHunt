import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as SaveSystem from '@/systems/SaveSystem';
import * as HapticsSystem from '@/systems/HapticsSystem';

describe('HapticsSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    SaveSystem.reset();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  it('bleibt bei deaktivierter Einstellung still', () => {
    SaveSystem.update((data) => {
      data.hapticsEnabled = false;
    });
    const vibrate = navigator.vibrate as ReturnType<typeof vi.fn>;

    expect(HapticsSystem.vibrate(20)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('reicht aktivierte Muster an den Browser weiter', () => {
    const vibrate = navigator.vibrate as ReturnType<typeof vi.fn>;

    expect(HapticsSystem.vibrate([10, 20, 15])).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([10, 20, 15]);
  });

  it('schaltet unabhaengig vom Ton', () => {
    SaveSystem.update((data) => {
      data.soundEnabled = false;
    });

    HapticsSystem.setEnabled(false);
    expect(HapticsSystem.isEnabled()).toBe(false);
    HapticsSystem.setEnabled(true);
    expect(HapticsSystem.isEnabled()).toBe(true);
  });
});
