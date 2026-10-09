import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BACKEND_URL,
  BACKEND_ANON_KEY,
  BACKEND_TIMEOUT_MS,
  isBackendConfigured,
} from '@/config/backend';
import * as DebugSystem from '@/systems/DebugSystem';

export type CloudResult<T> = { ok: true; value: T } | { ok: false; error: string };

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isBackendConfigured) return null;

  client ??= createClient(BACKEND_URL, BACKEND_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
}

export function isAvailable(): boolean {
  return isBackendConfigured;
}

/** Shares bounded waits and scrubbed RPC diagnostics across cloud and duel calls. */
export async function withTimeout<T>(
  operation: PromiseLike<T>,
  label: string,
  scope = 'cloud',
): Promise<CloudResult<T>> {
  const startedAt = Date.now();
  const requestCorrelationId = `${scope}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let timeoutId: number | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error('Zeitüberschreitung')),
        BACKEND_TIMEOUT_MS,
      );
    });

    const value = await Promise.race([operation, timeout]);
    DebugSystem.markServerContact();
    DebugSystem.logRpcResponse(label, value, requestCorrelationId);
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'event',
      label: `${scope}:${label}`,
      detail: `ok ${Date.now() - startedAt}ms correlation=${requestCorrelationId}`,
    });
    return { ok: true, value };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: `${scope}:${label}`,
      detail: `fehlgeschlagen ${Date.now() - startedAt}ms correlation=${requestCorrelationId}: ${reason}`,
    });
    console.warn(`[CloudSystem] ${label} fehlgeschlagen:`, error);
    return { ok: false, error: `${label}: ${reason}` };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}
