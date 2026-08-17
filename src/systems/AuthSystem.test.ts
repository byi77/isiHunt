/**
 * Tests fuer die reinen, deterministischen Funktionen von AuthSystem sowie
 * die Fehlermeldungs-Uebersetzung readableAuthError() (nicht exportiert,
 * nur ueber signIn()/refresh() erreichbar).
 *
 * docs/AUDIT_2026-08-17.md Abschnitt 7.1/5.8.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as AuthSystem from '@/systems/AuthSystem';
import type * as AuthSystemModule from '@/systems/AuthSystem';

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

describe('signIn - readableAuthError()-Uebersetzung', () => {
  // readableAuthError() ist eine private Funktion, nur ueber signIn()
  // erreichbar. CloudSystem.getSupabaseClient() wird gemockt, um die
  // Supabase-Fehlermeldung kontrolliert zu erzeugen, ohne echten Netzzugriff.
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let SignInAuthSystem: typeof AuthSystemModule;

  beforeEach(async () => {
    signInWithPassword = vi.fn();
    vi.resetModules();
    vi.doMock('@/systems/CloudSystem', () => ({
      getSupabaseClient: () => ({ auth: { signInWithPassword } }),
      isAvailable: () => true,
    }));
    SignInAuthSystem = await import('@/systems/AuthSystem');
  });

  it('uebersetzt "email not confirmed" in einen Hinweis auf die Supabase-Einstellung', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email not confirmed' },
    });

    const result = await SignInAuthSystem.signIn('validalias', '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Confirm email');
    }
  });

  it('uebersetzt "invalid login credentials" in eine kindgerechte Meldung', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await SignInAuthSystem.signIn('validalias', '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Alias oder Zugang ist nicht korrekt.');
    }
  });

  it('uebersetzt eine ungueltige E-Mail-Adresse in einen Konfigurationshinweis', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email address "x@y" is invalid' },
    });

    const result = await SignInAuthSystem.signIn('validalias', '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Alias-Login im Backend ist noch nicht korrekt konfiguriert.');
    }
  });

  it('reicht eine unbekannte Fehlermeldung unveraendert durch', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Some unmapped backend error' },
    });

    const result = await SignInAuthSystem.signIn('validalias', '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Some unmapped backend error');
    }
  });

  it('faellt bei fehlender Session ohne Fehlermeldung auf den Fallback-Text zurueck', async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });

    const result = await SignInAuthSystem.signIn('validalias', '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Alias oder Zugang ungültig');
    }
  });
});
