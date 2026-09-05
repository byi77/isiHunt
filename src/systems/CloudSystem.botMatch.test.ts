/**
 * Regressionstests zu AUDIT_2026-09-05_REAUDIT, Befund 4.
 *
 * Eigene Datei, weil hier der RPC selbst gesteuert werden muss:
 * `CloudSystem.test.ts` mockt das Backend als nicht eingerichtet, und
 * `CloudSystem.configured.test.ts` laesst jeden Aufruf am echten Netzfehler
 * scheitern. Fuer die Frage "wie oft wird `start_bot_match` versucht" braucht
 * es einen zaehlbaren Doppelgaenger.
 *
 * Aufbau wie dort: echter Client an einer `.invalid`-Adresse (RFC 2606, kann
 * per Definition nicht existieren), `getUser()` gespyt statt einer echten
 * Session, und `rpc()` durch einen Zaehler ersetzt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CloudSystemModule from '@/systems/CloudSystem';

vi.mock('@/config/backend', () => ({
  BACKEND_URL: 'https://nicht-erreichbar.invalid',
  BACKEND_ANON_KEY: 'test-schluessel-ohne-funktion',
  isBackendConfigured: true,
  LEADERBOARD_LIMIT: 10,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  PLAYER_NAME_MAX_LENGTH: 12,
  BACKEND_TIMEOUT_MS: 300,
  // Kurz genug, dass die Wiederholungen den Test nicht ausbremsen; die
  // Anzahl der Stufen ist das, worauf es hier ankommt.
  BOT_MATCH_START_RETRY_DELAYS_MS: [1, 1],
}));

let CloudSystem: typeof CloudSystemModule;
const rpc = vi.fn();

beforeEach(async () => {
  window.localStorage.clear();
  rpc.mockReset();
  vi.resetModules();
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Netzwerk nicht erreichbar (Test)')));
  CloudSystem = await import('@/systems/CloudSystem');

  const client = CloudSystem.getSupabaseClient()!;
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({
    data: { user: { id: 'test-nutzer' } },
    error: null,
  } as never);
  vi.spyOn(client, 'rpc').mockImplementation(((...args: unknown[]) => rpc(...args)) as never);
});

describe('AUDIT_2026-09-05_REAUDIT Befund 4: Bot-Duellstart', () => {
  it('holt nach einem einzelnen Funkloch trotzdem eine Match-ID', async () => {
    // Ohne Match-ID gibt es fuer den Sieg keine nachlieferbare Berechtigung:
    // die Praemie waere nur lokal gebucht und beim naechsten Profilabgleich
    // wieder fort. Ein einzelner Fehlversuch darf das nicht ausloesen.
    rpc
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue({ data: 'match-1', error: null });

    const result = await CloudSystem.startBotMatch();

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe('match-1');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('wiederholt auch eine SDK-Fehlerantwort, nicht nur eine Rejection', async () => {
    // Das PostgREST-SDK meldet Transportfehler als aufgeloeste Antwort mit
    // gesetztem `error` - derselbe Mechanismus wie in Befund 1.
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } })
      .mockResolvedValue({ data: 'match-2', error: null });

    const result = await CloudSystem.startBotMatch();

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('gibt erst nach allen Stufen auf', async () => {
    rpc.mockRejectedValue(new Error('Network request failed'));

    const result = await CloudSystem.startBotMatch();

    expect(result.ok).toBe(false);
    // Erstversuch plus zwei Wiederholungen.
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('wiederholt eine fachliche Ablehnung nicht', async () => {
    // 'Anmeldung erforderlich' faellt beim naechsten Versuch identisch aus.
    rpc.mockResolvedValue({ data: null, error: { message: 'Anmeldung erforderlich' } });

    const result = await CloudSystem.startBotMatch();

    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
