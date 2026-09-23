import { describe, expect, it, vi } from 'vitest';

// Phaser selbst laedt ausserhalb des Browsers nicht; geprueft wird nur die
// Erkennung, der Einbau in `updateText` im Browser (siehe Playtest).
vi.mock('phaser', () => ({ default: {} }));

import { hasAstralCharacter } from './letterSpacingGuard';

describe('Erkennung zerbrechlicher Zeichen', () => {
  it('erkennt Emojis ausserhalb der Grundebene', () => {
    expect(hasAstralCharacter('💥 HINDERNISSE')).toBe(true);
    expect(hasAstralCharacter('🎁 BELOHNUNG')).toBe(true);
  });

  it('laesst Umlaute und Zeichen der Grundebene unberuehrt', () => {
    expect(hasAstralCharacter('TÄGLICHER BONUS')).toBe(false);
    expect(hasAstralCharacter('⚡ BESONDERHEIT')).toBe(false);
    expect(hasAstralCharacter('RANG 1 · +20')).toBe(false);
  });
});
