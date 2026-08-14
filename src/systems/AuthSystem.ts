/** Freiwillige Anmeldung für ein geräteübergreifendes isiHunt-Profil. */

import type { Session, User } from '@supabase/supabase-js';

import { BACKEND_TIMEOUT_MS } from '@/config/backend';
import * as CloudSystem from '@/systems/CloudSystem';
import type { CloudResult } from '@/systems/CloudSystem';

let session: Session | null = null;
let initialized = false;
let unsubscribe: (() => void) | null = null;

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

export function currentEmail(): string | null {
  return session?.user.email ?? null;
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
  email: string,
  password: string,
): Promise<CloudResult<Session | null>> {
  const supabase = client();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await request(
    supabase.auth.signUp({ email: email.trim(), password }),
    'Profil anlegen',
  );
  if (!result.ok) return result;
  if (result.value.error) return { ok: false, error: result.value.error.message };

  session = result.value.data.session;
  return { ok: true, value: session };
}

export async function signIn(email: string, password: string): Promise<CloudResult<Session>> {
  const supabase = client();
  if (!supabase) return { ok: false, error: 'Kein Online-Dienst eingerichtet' };

  const result = await request(
    supabase.auth.signInWithPassword({ email: email.trim(), password }),
    'Anmelden',
  );
  if (!result.ok) return result;
  if (result.value.error || !result.value.data.session) {
    return { ok: false, error: result.value.error?.message ?? 'E-Mail noch nicht bestätigt' };
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
