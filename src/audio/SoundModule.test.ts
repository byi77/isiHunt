import { describe, expect, it, vi } from 'vitest';

import { SoundModuleChain, type SoundModule } from '@/audio/SoundModule';

const context = {
  isEnabled: () => true,
  getAudioContext: () => null,
};

function module(id: string, result: boolean): SoundModule {
  return {
    id,
    initialize: vi.fn(),
    shutdown: vi.fn(),
    handles: (event) => event === 'ui.click',
    play: vi.fn(() => result),
  };
}

describe('SoundModuleChain', () => {
  it('nutzt den hoechsten Provider zuerst und faellt zurueck', () => {
    const chain = new SoundModuleChain();
    const fallback = module('procedural', true);
    const sample = module('sample', false);
    chain.register(fallback, 0);
    chain.register(sample, 100);
    chain.initialize(context);

    expect(chain.play('ui.click')).toBe(true);
    expect(sample.play).toHaveBeenCalledOnce();
    expect(fallback.play).toHaveBeenCalledOnce();
    expect(chain.ids()).toEqual(['sample', 'procedural']);
  });

  it('entfernt beim Austausch die alte Instanz sauber', () => {
    const chain = new SoundModuleChain();
    const first = module('sample', true);
    const replacement = module('sample', true);
    chain.register(first);
    chain.initialize(context);
    chain.register(replacement, 5);

    expect(first.shutdown).toHaveBeenCalledOnce();
    expect(replacement.initialize).toHaveBeenCalledOnce();
    expect(chain.ids()).toEqual(['sample']);
  });
});
