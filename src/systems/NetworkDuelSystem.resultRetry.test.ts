/**
 * Regressionstests zu AUDIT_2026-09-05, Befund 4.
 *
 * Eigene Datei statt Ergaenzung in `NetworkDuelSystem.test.ts`: die dortige
 * Suite mockt `@/config/backend` bewusst auf "nicht konfiguriert", damit kein
 * Test versehentlich gegen die echte Produktionsdatenbank spricht. Hier wird
 * dagegen ein Supabase-Doppelgaenger gebraucht, der Fehlversuche zaehlt.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';

const rpc = vi.fn();

vi.mock('@/systems/CloudSystem', () => ({
  getSupabaseClient: () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

vi.mock('@/config/backend', () => ({
  BACKEND_URL: 'https://test.invalid',
  BACKEND_ANON_KEY: 'test-key',
  isBackendConfigured: true,
  LEADERBOARD_LIMIT: 10,
  PLAYER_NAME_MAX_LENGTH: 16,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  BACKEND_TIMEOUT_MS: 5000,
  // Kurz genug, dass die Wiederholungen den Test nicht ausbremsen; die
  // Anzahl der Stufen ist das, worauf es hier ankommt.
  DUEL_RESULT_RETRY_DELAYS_MS: [1, 1, 1],
}));

const round = { score: 100, bestCombo: 3, totalCollected: 20 };

beforeEach(() => {
  rpc.mockReset();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

/** Laesst die Wartezeiten zwischen den Versuchen sofort ablaufen. */
async function runWithTimers<T>(operation: Promise<T>): Promise<T> {
  const settled = operation;
  await vi.runAllTimersAsync();
  return settled;
}

describe('submitRoundResult - Wiederholung nach Transportfehler', () => {
  it('gibt nach einem einzelnen Funkloch trotzdem ab', async () => {
    // Ein Duellergebnis kann nicht wie ein Solo-Run nachreisen: die Rangliste
    // wertet das Match erst, wenn alle Teilnehmerergebnisse persistiert sind.
    rpc
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue({ data: true, error: null });

    const result = await runWithTimers(
      NetworkDuelSystem.submitRoundResult('ABC123', true, round, 'token'),
    );

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('gibt erst nach allen Stufen auf', async () => {
    rpc.mockRejectedValue(new Error('Network request failed'));

    const result = await runWithTimers(
      NetworkDuelSystem.submitRoundResult('ABC123', true, round, 'token'),
    );

    expect(result.ok).toBe(false);
    // Erstversuch plus drei Wiederholungen.
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it('wiederholt eine fachliche Ablehnung nicht', async () => {
    // "Ergebnis nicht plausibel" faellt beim naechsten Versuch identisch aus -
    // Wiederholen kostet nur Zeit und haelt den Spieler auf.
    rpc.mockResolvedValue({ data: null, error: { message: 'Ergebnis nicht plausibel' } });

    const result = await runWithTimers(
      NetworkDuelSystem.submitRoundResult('ABC123', true, round, 'token'),
    );

    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).toBeNull();
  });

  it('behaelt das Ergebnis, wenn das SDK ein Funkloch als Fehlerantwort meldet', async () => {
    // Das installierte PostgREST-SDK loest die Promise auf und legt den
    // Transportfehler in `error` - ein Funkloch kommt als
    // `TypeError: Failed to fetch` mit Status 0 an, nicht als Rejection.
    // Frueher galt jedes `error` als fachliche Ablehnung: nach genau einem
    // Aufruf war der Outbox-Eintrag geloescht und das Ergebnis fuer immer fort
    // (AUDIT_2026-09-05_REAUDIT, Befund 1).
    rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });

    const result = await runWithTimers(
      NetworkDuelSystem.submitRoundResult('ABC123', true, round, 'token'),
    );

    expect(result.ok).toBe(false);
    // Erstversuch plus drei Wiederholungen - nicht ein einziger Aufruf.
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).not.toBeNull();
  });

  it('gibt nach einem SDK-Funkloch beim naechsten Versuch trotzdem ab', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } })
      .mockResolvedValue({ data: true, error: null });

    const result = await runWithTimers(
      NetworkDuelSystem.submitRoundResult('ABC123', true, round, 'token'),
    );

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).toBeNull();
  });

  it('behaelt ein Ergebnis, dessen Raum den Start noch nicht committet hat', async () => {
    // Zeit-/Zustandsabhaengig: das Rundenende kann den Raumstart ueberholen.
    // Ein spaeterer Versuch geht durch, also darf der Eintrag nicht fallen.
    rpc.mockResolvedValue({ data: null, error: { message: 'Duell noch nicht gestartet' } });

    const result = await runWithTimers(
      NetworkDuelSystem.submitRoundResult('ABC123', true, round, 'token'),
    );

    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).not.toBeNull();
  });

  it('haelt einen SDK-Transportfehler auch in der Outbox-Nachlieferung fest', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    await runWithTimers(
      NetworkDuelSystem.submitRoundResult(
        'ABC123',
        true,
        { ...round, durationMs: 90_000 },
        '0123456789abcdef0123456789abcdef',
      ),
    );
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).not.toBeNull();

    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    await runWithTimers(NetworkDuelSystem.flushPendingRoundResults());

    // Der Eintrag muss den Neustart-Flush ueberleben, sonst hilft die Outbox
    // genau in dem Fall nicht, fuer den sie gebaut wurde.
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).not.toBeNull();
  });

  it('laedt ein nach App-Neustart offenes Ergebnis aus der Outbox nach', async () => {
    rpc.mockRejectedValue(new Error('Network request failed'));
    await runWithTimers(
      NetworkDuelSystem.submitRoundResult(
        'ABC123',
        true,
        { ...round, durationMs: 90_000 },
        '0123456789abcdef0123456789abcdef',
      ),
    );

    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).not.toBeNull();

    rpc.mockResolvedValue({ data: true, error: null });
    await NetworkDuelSystem.flushPendingRoundResults();

    expect(rpc).toHaveBeenCalledTimes(5);
    expect(window.localStorage.getItem('isihunt.duel-results.v1.anonymous')).toBeNull();
  });
});
