/**
 * Tests fuer die reinen, deterministischen Funktionen von AuthSystem.
 *
 * docs/AUDIT_2026-08-17.md Abschnitt 7.1 nennt isValidAlias(), isValidPin()
 * und readableAuthError() als testbare Kandidaten ohne Netzwerkabhaengigkeit.
 * readableAuthError() ist nicht exportiert und wird nur innerhalb von
 * signIn()/refresh() aufgerufen, die einen echten Supabase-Client-Mock
 * brauchen wuerden - das bleibt bewusst ausserhalb dieses Tests. Getestet
 * werden die drei oeffentlichen, reinen Funktionen.
 */

import { describe, expect, it } from 'vitest';

import * as AuthSystem from '@/systems/AuthSystem';

describe('normalizeAlias', () => {
  it('trimmt und macht Kleinbuchstaben daraus', () => {
    expect(AuthSystem.normalizeAlias('  Max_2000  ')).toBe('max_2000');
  });
});

describe('isValidAlias', () => {
  it('akzeptiert Kleinbuchstaben, Ziffern, Bindestrich und Unterstrich', () => {
    expect(AuthSystem.isValidAlias('max_2000-x')).toBe(true);
  });

  it('lehnt zu kurze Aliase ab', () => {
    const short = 'a'.repeat(AuthSystem.ALIAS_MIN_LENGTH - 1);
    expect(AuthSystem.isValidAlias(short)).toBe(false);
  });

  it('akzeptiert die Mindestlaenge', () => {
    const min = 'a'.repeat(AuthSystem.ALIAS_MIN_LENGTH);
    expect(AuthSystem.isValidAlias(min)).toBe(true);
  });

  it('lehnt zu lange Aliase ab', () => {
    const long = 'a'.repeat(AuthSystem.ALIAS_MAX_LENGTH + 1);
    expect(AuthSystem.isValidAlias(long)).toBe(false);
  });

  it('akzeptiert die Maximallaenge', () => {
    const max = 'a'.repeat(AuthSystem.ALIAS_MAX_LENGTH);
    expect(AuthSystem.isValidAlias(max)).toBe(true);
  });

  it('lehnt Grossbuchstaben ab (normalizeAlias muss vorher laufen)', () => {
    expect(AuthSystem.isValidAlias('Max2000')).toBe(false);
  });

  it('lehnt Sonderzeichen und Leerzeichen ab', () => {
    expect(AuthSystem.isValidAlias('max 2000!')).toBe(false);
  });

  it('lehnt einen leeren String ab', () => {
    expect(AuthSystem.isValidAlias('')).toBe(false);
  });
});

describe('isValidPin', () => {
  it('akzeptiert genau sechs Ziffern', () => {
    expect(AuthSystem.isValidPin('123456')).toBe(true);
  });

  it('lehnt weniger als sechs Ziffern ab', () => {
    expect(AuthSystem.isValidPin('12345')).toBe(false);
  });

  it('lehnt mehr als sechs Ziffern ab', () => {
    expect(AuthSystem.isValidPin('1234567')).toBe(false);
  });

  it('lehnt nicht-numerische Zeichen ab', () => {
    expect(AuthSystem.isValidPin('12345a')).toBe(false);
  });

  it('lehnt einen leeren String ab', () => {
    expect(AuthSystem.isValidPin('')).toBe(false);
  });
});
