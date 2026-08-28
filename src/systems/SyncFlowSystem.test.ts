import { describe, expect, it } from 'vitest';

import { SYNC_CODE_LENGTH } from '@/config/backend';
import {
  clearSyncPending,
  createSyncFlowState,
  decideRedeemResult,
  setSyncBusy,
  showSyncCode,
  showSyncComparison,
  showSyncStart,
  validateSyncCode,
} from '@/systems/SyncFlowSystem';

const remoteSave = {
  cloudId: 'cloud-1',
  accessToken: 'a'.repeat(64),
  save: {
    data: {} as never,
    level: 4,
    bestScore: 120,
    totalRuns: 3,
    updatedAt: '2026-08-21T00:00:00.000Z',
  },
};

describe('SyncFlowSystem', () => {
  it('validiert Codes nach derselben Normalisierung wie der Backend-Aufruf', () => {
    expect(validateSyncCode(' oil 123 ')).toEqual({ ok: true, code: '011123' });
    expect(validateSyncCode('A'.repeat(SYNC_CODE_LENGTH + 1))).toEqual({
      ok: true,
      code: 'A'.repeat(SYNC_CODE_LENGTH),
    });
    expect(validateSyncCode('A')).toEqual({
      ok: false,
      message: `Ein Code hat ${SYNC_CODE_LENGTH} Zeichen.`,
    });
  });

  it('modelliert den Ablauf ohne Scene- oder Phaser-Zustand', () => {
    let state = createSyncFlowState();
    expect(state).toEqual({ phase: 'start', busy: false, pending: null });

    state = setSyncBusy(state, true);
    expect(state.busy).toBe(true);
    state = showSyncCode(state);
    expect(state).toMatchObject({ phase: 'code', busy: false, pending: null });
    state = showSyncComparison(state, remoteSave);
    expect(state).toMatchObject({ phase: 'comparison', busy: false, pending: remoteSave });
    state = clearSyncPending(state);
    state = showSyncStart(state);
    expect(state).toEqual({ phase: 'start', busy: false, pending: null });
  });

  it('unterscheidet Fehler, abgelaufenen Code und Vergleichsstand', () => {
    expect(decideRedeemResult({ ok: false, error: 'offline' })).toEqual({
      kind: 'error',
      message: 'offline',
    });
    expect(decideRedeemResult({ ok: true, value: null })).toEqual({ kind: 'expired' });
    expect(decideRedeemResult({ ok: true, value: remoteSave })).toEqual({
      kind: 'comparison',
      pending: remoteSave,
    });
  });
});
