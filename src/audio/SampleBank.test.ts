import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { COMBO_TIERS } from '@/config/GameConfig';
import { COUNTDOWN_STEPS } from '@/config/GameConfig';
import { SAMPLES, WORLD_SELECT_SEMITONES } from '@/config/audio';
import { RARITIES } from '@/config/rarities';
import { resolveSamples, SampleBank } from '@/audio/SampleBank';

describe('SAMPLES - Dateien', () => {
  // Faengt die Drift zwischen scripts/render-sfx.mjs und der Config: ein
  // umbenannter oder vergessener Render faellt sonst erst auf dem Geraet als
  // stummer Klang auf, weil die SampleBank still auf den Fallback ausweicht.
  it.each(Object.entries(SAMPLES))('%s liegt in public/assets/audio', (_id, spec) => {
    // Vitest laeuft im Projektwurzelverzeichnis (wie jedes npm-Skript).
    expect(existsSync(join(process.cwd(), 'public', 'assets', 'audio', spec.file))).toBe(true);
  });
});

describe('resolveSamples', () => {
  it('hat fuer jede Seltenheit einen Fangklang', () => {
    for (const rarity of RARITIES) {
      expect(resolveSamples('collect', { rarityId: rarity.id })).toEqual([
        { id: `collect-${rarity.id}`, semitones: 0 },
      ]);
    }
  });

  it('spricht jede Countdown-Stufe und "Los geht\'s!"', () => {
    for (let step = COUNTDOWN_STEPS; step >= 0; step--) {
      expect(resolveSamples('countdown', { countdownStep: step })).toHaveLength(1);
    }
    expect(resolveSamples('countdown', { countdownStep: 0 })[0]!.id).toBe('voice-go');
  });

  it('schweigt bei Countdown-Stufen ohne Ansage (Online-Vorlauf > 3 s)', () => {
    expect(resolveSamples('countdown', { countdownStep: COUNTDOWN_STEPS + 2 })).toEqual([]);
  });

  it('hat fuer jede hoerbare Combo-Stufe einen Klang und begrenzt spaetere Stufen', () => {
    for (let tier = 1; tier < COMBO_TIERS.length; tier++) {
      expect(resolveSamples('combo.tier', { comboTier: tier })).toHaveLength(1);
    }
    expect(resolveSamples('combo.tier', { comboTier: 99 })[0]!.id).toBe('combo-5');
    expect(resolveSamples('combo.tier', { comboTier: 0 })).toEqual([]);
  });

  it('stimmt die Weltwechsel-Glocke je Welt hoch und begrenzt unbekannte Welten', () => {
    const bell = (variant: number) =>
      resolveSamples('world.select', { spaceVariant: variant }).find(
        (cue) => cue.id === 'world-bell',
      )!.semitones;
    expect(bell(0)).toBe(0);
    expect(bell(3)).toBe(WORLD_SELECT_SEMITONES[3]);
    expect(bell(999)).toBe(WORLD_SELECT_SEMITONES.at(-1));
  });

  it('macht nur seltene verpasste Relikte hoerbar', () => {
    expect(resolveSamples('collect.missed', { rarityId: 'common' })).toEqual([]);
    expect(resolveSamples('collect.missed', { rarityId: 'legendary' })).toHaveLength(1);
  });

  it('unterscheidet Run-Ende mit und ohne Levelaufstieg', () => {
    expect(resolveSamples('run.end', { levelsGained: 1 })[0]!.id).toBe('run-end-levelup');
    expect(resolveSamples('run.end', { levelsGained: 0 })[0]!.id).toBe('run-end');
  });
});

describe('SampleBank.play', () => {
  function runningContext() {
    return {
      state: 'running',
      currentTime: 0,
      destination: {},
      decodeAudioData: vi.fn(),
    } as unknown as AudioContext;
  }

  it('liefert false und laedt nach, solange der Klang fehlt - der Fallback spielt', () => {
    const fetchSpy = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchSpy);
    const bank = new SampleBank();
    const audioContext = runningContext();
    bank.initialize({
      isEnabled: () => true,
      getAudioContext: () => audioContext,
      getOutput: () => null,
    });

    expect(bank.play('ui.click')).toBe(false);
    expect(fetchSpy).toHaveBeenCalledOnce();
    // Ein zweiter Versuch waehrend des Ladens startet keinen doppelten Abruf.
    expect(bank.play('ui.click')).toBe(false);
    expect(fetchSpy).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('spielt nichts und laedt nichts, wenn der Ton aus ist', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const bank = new SampleBank();
    bank.initialize({
      isEnabled: () => false,
      getAudioContext: () => runningContext(),
      getOutput: () => null,
    });

    expect(bank.play('collect', { rarityId: 'legendary' })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
