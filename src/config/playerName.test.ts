import { describe, expect, it } from 'vitest';

import { isValidPlayerName, sanitizePlayerName } from '@/config/playerName';

describe('sanitizePlayerName', () => {
  it('entfernt Sonderzeichen, schreibt den ersten Buchstaben gross und behaelt vier Zahlen', () => {
    expect(sanitizePlayerName('max_12!b34c5')).toBe('Max12b34c');
  });

  it('entfernt jede Zahl nach der vierten', () => {
    expect(sanitizePlayerName('12345abc')).toBe('1234abc');
  });

  it('laesst einen Namen mit Ziffer am Anfang unveraendert grossgeschrieben', () => {
    expect(sanitizePlayerName('2max')).toBe('2max');
  });

  it('liefert bei keinem erlaubten Zeichen einen leeren Namen', () => {
    expect(sanitizePlayerName('***!!!')).toBe('');
  });
});

describe('isValidPlayerName', () => {
  it('akzeptiert nur ASCII-Buchstaben/Zahlen und hoechstens vier Zahlen', () => {
    expect(isValidPlayerName('Max1234')).toBe(true);
    expect(isValidPlayerName('Max12345')).toBe(false);
    expect(isValidPlayerName('Max_1')).toBe(false);
  });
});
