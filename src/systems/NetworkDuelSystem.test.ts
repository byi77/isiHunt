/**
 * Tests fuer NetworkDuelSystem.
 *
 * WICHTIG: `@/config/backend` wird fest auf "nicht konfiguriert" gemockt,
 * exakt aus demselben Grund wie in `CloudSystem.test.ts` - ohne diesen Mock
 * wuerde `getSupabaseClient()` in einer lokalen Umgebung mit echter `.env`
 * gegen die echte Produktionsdatenbank sprechen.
 *
 * Getestet wird hier bewusst nur, was ohne echten Realtime-/RPC-Zugriff
 * pruefbar ist: reine Funktionen (Code-Normalisierung) und der "kein
 * Online-Dienst eingerichtet"-Fruehausstieg, den jede Netzfunktion hat, wenn
 * `getSupabaseClient()` `null` liefert. Echtes RPC-/Realtime-Verhalten
 * braucht einen echten Zwei-Geraete-Test (siehe TODO.md-Planungsnotiz).
 */

import { describe, expect, it, vi } from 'vitest';

import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';

vi.mock('@/config/backend', () => ({
  BACKEND_URL: '',
  BACKEND_ANON_KEY: '',
  isBackendConfigured: false,
  LEADERBOARD_LIMIT: 10,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  PLAYER_NAME_MAX_LENGTH: 12,
  BACKEND_TIMEOUT_MS: 5000,
}));

describe('normalizeRoomCode', () => {
  it('schreibt gross und entfernt Leerzeichen', () => {
    expect(NetworkDuelSystem.normalizeRoomCode(' ab3d ef ')).toBe('AB3DEF');
  });

  it('bildet verwechselbare Zeichen auf ihre Zwillinge ab', () => {
    // Deckungsgleich mit dem Sync-Code-Alphabet: O->0, I/L->1.
    expect(NetworkDuelSystem.normalizeRoomCode('OIL123')).toBe('011123');
  });

  it('kappt auf die Duell-Code-Laenge', () => {
    expect(NetworkDuelSystem.normalizeRoomCode('ABCDEFGH')).toBe('ABCDEF');
  });
});

describe('roomCodeTtlMinutes', () => {
  it('liefert die konfigurierte Gueltigkeitsdauer', () => {
    expect(NetworkDuelSystem.roomCodeTtlMinutes()).toBeGreaterThan(0);
  });
});

describe('Netzfunktionen ohne konfigurierten Online-Dienst', () => {
  it('createRoom scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.createRoom('silberhain');
    expect(result.ok).toBe(false);
  });

  it('joinRoom scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.joinRoom('ABC123');
    expect(result.ok).toBe(false);
  });

  it('joinRoom lehnt zu kurze Codes ab, ohne den Online-Dienst zu pruefen', async () => {
    const result = await NetworkDuelSystem.joinRoom('AB');
    expect(result.ok).toBe(false);
  });

  it('markReady scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.markReady('ABC123', true);
    expect(result.ok).toBe(false);
  });

  it('setStartTime scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.setStartTime('ABC123');
    expect(result.ok).toBe(false);
  });

  it('getRoomStatus scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.getRoomStatus('ABC123');
    expect(result.ok).toBe(false);
  });

  it('measureClockOffset scheitert freundlich statt zu werfen', async () => {
    const result = await NetworkDuelSystem.measureClockOffset();
    expect(result.ok).toBe(false);
  });
});

describe('unsubscribeFromRoom', () => {
  it('tut ohne aktiven Kanal nichts, statt zu werfen', () => {
    expect(() => NetworkDuelSystem.unsubscribeFromRoom()).not.toThrow();
  });
});

describe('broadcastReady/broadcastStartTime ohne aktiven Kanal', () => {
  it('werfen nicht, wenn noch kein Kanal abonniert wurde', () => {
    expect(() => NetworkDuelSystem.broadcastReady()).not.toThrow();
    expect(() => NetworkDuelSystem.broadcastStartTime(Date.now())).not.toThrow();
  });
});
