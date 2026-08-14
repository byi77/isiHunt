/** Freiwillige Anmeldung für ein geräteübergreifendes isiHunt-Profil. */

import type { Session, User } from '@supabase/supabase-js';

import { BACKEND_TIMEOUT_MS, BACKEND_URL } from '@/config/backend';
import * as CloudSystem from '@/systems/CloudSystem';
import type { CloudResult } from '@/systems/CloudSystem';

let session: Session | null = null;
let initialized = false;
let unsubscribe: (() => void) | null = null;

/**
 * Supabase kennt beim Passwortlogin E-Mail oder Telefonnummer, aber keinen
 * freien Benutzernamen. Der Alias bleibt deshalb die sichtbare Identität und
 * wird intern auf eine nicht zustellbare Auth-ID abgebildet.
 */
export const ALIAS_MIN_LENGTH = 3;
export const ALIAS_MAX_LENGTH = 16;
/** Supabase weist reservierte Testdomains wie `.invalid` als E-Mail zurück. */
const INTERNAL_AUTH_FALLBACK_DOMAIN = 'example.com';

export function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidAlias(value: string): boolean {
  return (
    value.length >= ALIAS_MIN_LENGTH &&
    value.length <= ALIAS_MAX_LENGTH &&
    /^[a-z0-9_-]+$/.test(value)
  );
}

function aliasToAuthEmail(alias: string): string {
  let domain = INTERNAL_AUTH_FALLBACK_DOMAIN;
  try {
    domain = new URL(BACKEND_URL).hostname || domain;
  } catch {
    // Ohne gültige Backend-URL greift vorher ohnehin die Konfigurationsprüfung.
  }
  return `${normalizeAlias(alias)}@${domain}`;
}

function client() {
  return CloudSystem.getSupabaseClient();
}

async function request<T>(operation: PromiseLike<T>, label: string): Promise<CloudResult<T>> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Zeitüberschreitung')), BACKEND_TIMEOUT_MS);
    });
    return { ok: true, value: await Promise.race([operation, timeout]) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return { ok: false, error: `${label}: ${reason}` };
  }
}

/** Startet die Sitzungspflege einmalig vor dem Phaser-Start. */
export function initialize(): void {
  if (initialized || !client()) return;
  initialized = true;

  const supabase = client();
  if (!supabase) return;

  void supabase.auth.getSession().then(({ data }) => {
    session = data.session;
  });

  const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
  });
  unsubscribe = () => subscription.data.subscription.unsubscribe();
}

export function isConfigured(): boolean {
  return CloudSystem.isAvailable();
}

export function isSignedIn(): boolean {
  return session !== null;
}

export function currentUser(): User | null {
  return session?.user ?? null;
}

export function currentUserId(): string | null {
  return session?.user.id ?? null;
}

export function currentAlias(): string | null {
  const metadataAlias = session?.user.user_metadata?.alias;
  if (typeof metadataAlias === 'string' && metadataAlias.length > 0) {
    return metadataAlias;
  }

  const internalEmail = session?.user.email;
  return internalEmail?.split('@')[0] ?? null;
}

export async function refresh(): Promise<CloudResult<Session | null>> {
  const supabase = client();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await request(supabase.auth.getSession(), 'Sitzung laden');
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  session = result.value.data.session;
  return { ok: true, value: session };
}

export async function signUp(
  alias: string,
  password: string,
): Promise<CloudResult<Session | null>> {
  const supabase = client();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const normalizedAlias = normalizeAlias(alias);
  if (!isValidAlias(normalizedAlias)) {
    return {
      ok: false,
      error: `Alias: ${ALIAS_MIN_LENGTH}-${ALIAS_MAX_LENGTH} Zeichen, nur a-z, 0-9, - und _`,
    };
  }

  const result = await request(
    supabase.auth.signUp({
      email: aliasToAuthEmail(normalizedAlias),
      password,
      options: { data: { alias: normalizedAlias } },
    }),
    'Profil anlegen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  session = result.value.data.session;
  return { ok: true, value: session };
}

export async function signIn(alias: string, password: string): Promise<CloudResult<Session>> {
  const supabase = client();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const normalizedAlias = normalizeAlias(alias);
  if (!isValidAlias(normalizedAlias)) {
    return {
      ok: false,
      error: `Alias: ${ALIAS_MIN_LENGTH}-${ALIAS_MAX_LENGTH} Zeichen, nur a-z, 0-9, - und _`,
    };
  }

  const result = await request(
    supabase.auth.signInWithPassword({
      email: aliasToAuthEmail(normalizedAlias),
      password,
    }),
    'Anmelden',
  );
  if (!result.ok) return result;
  if (result.value.error || !result.value.data.session) {
    return { ok: false, error: result.value.error?.message ?? 'Alias oder Passwort ungültig' };
  }

  session = result.value.data.session;
  return { ok: true, value: session };
}

export async function signOut(): Promise<CloudResult<true>> {
  const supabase = client();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await request(supabase.auth.signOut(), 'Abmelden');
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  session = null;
  return { ok: true, value: true };
}

export function dispose(): void {
  unsubscribe?.();
  unsubscribe = null;
  initialized = false;
  session = null;
}
