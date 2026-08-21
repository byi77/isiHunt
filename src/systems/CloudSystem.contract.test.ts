import { describe, expect, it } from 'vitest';

import {
  normalizeAdminDashboard,
  normalizeProfileProgress,
  normalizeRemoteSave,
} from '@/systems/CloudSystem';

describe('Cloud-System: RPC-Vertraege', () => {
  it('verwirft fehlende oder nicht objektartige Spielstaende', () => {
    expect(normalizeRemoteSave(null)).toBeNull();
    expect(normalizeRemoteSave([])).toBeNull();
    expect(normalizeRemoteSave({ data: null })).toBeNull();
    expect(normalizeRemoteSave({ data: [] })).toBeNull();
  });

  it('normalisiert einen Spielstand und schuetzt vor NaN/Infinity', () => {
    const result = normalizeRemoteSave({
      data: { version: 8, level: 4 },
      level: '7',
      best_score: 'Infinity',
      total_runs: -3,
      updated_at: 123,
    });

    expect(result).toEqual({
      data: { version: 8, level: 4 },
      level: 7,
      bestScore: 0,
      totalRuns: 0,
      updatedAt: '',
    });
  });

  it('akzeptiert die von Supabase gelieferte Ein-Zeilen-Arrayform', () => {
    expect(
      normalizeProfileProgress([
        {
          data: { version: 8, level: 3 },
          total_xp: '1200',
          updated_at: '2026-08-21T10:00:00.000Z',
        },
      ]),
    ).toMatchObject({ totalXp: 1200, updatedAt: '2026-08-21T10:00:00.000Z' });
  });

  it('liefert fuer kaputte Profilantworten null statt falscher Progression', () => {
    expect(normalizeProfileProgress({ data: { level: 3 }, total_xp: 'NaN' })).toEqual({
      data: { level: 3 },
      totalXp: 0,
      updatedAt: '',
    });
    expect(normalizeProfileProgress({ total_xp: 100 })).toBeNull();
  });

  it('filtert unbrauchbare Adminzeilen und normalisiert Kennzahlen', () => {
    const result = normalizeAdminDashboard({
      profileCount: '9',
      totalXp: 'Infinity',
      users: [
        null,
        { playerName: 'Ada', level: '4', totalRuns: 'NaN', currentCoins: -5 },
        'kaputt',
      ],
    });

    expect(result).toMatchObject({ profileCount: 9, totalXp: 0 });
    expect(result?.users).toEqual([
      expect.objectContaining({
        playerName: 'Ada',
        level: 4,
        totalRuns: 0,
        currentCoins: 0,
      }),
    ]);
  });

  it('verwirft eine vollstaendig unerwartete Adminantwort', () => {
    expect(normalizeAdminDashboard('server kaputt')).toBeNull();
    expect(normalizeAdminDashboard([])).toBeNull();
  });
});
