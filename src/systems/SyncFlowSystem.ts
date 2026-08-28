/**
 * Zustands- und Eingabeentscheidungen des Sync-Bildschirms.
 *
 * Die Darstellung bleibt in `SyncScene`; alles, was keinen Phaser-Kontext
 * braucht, liegt hier. Dadurch kann derselbe Ablauf in Unit- und Browser-Tests
 * gegen feste Ergebnisse geprüft werden, ohne eine Scene künstlich zu starten.
 */

import { SYNC_CODE_LENGTH } from '@/config/backend';
import * as CloudSystem from '@/systems/CloudSystem';
import type { RemoteSave } from '@/systems/CloudSystem';

export type SyncPhase = 'start' | 'code' | 'comparison';

export interface SyncPendingSave {
  cloudId: string;
  accessToken: string;
  save: RemoteSave;
}

export interface SyncFlowState {
  phase: SyncPhase;
  busy: boolean;
  pending: SyncPendingSave | null;
}

export type SyncCodeValidation = { ok: true; code: string } | { ok: false; message: string };

export type SyncRedeemDecision =
  | { kind: 'error'; message: string }
  | { kind: 'expired' }
  | { kind: 'comparison'; pending: SyncPendingSave };

export function createSyncFlowState(): SyncFlowState {
  return { phase: 'start', busy: false, pending: null };
}

export function setSyncBusy(state: SyncFlowState, busy: boolean): SyncFlowState {
  return { ...state, busy };
}

export function showSyncCode(state: SyncFlowState): SyncFlowState {
  return { ...state, phase: 'code', busy: false, pending: null };
}

export function showSyncStart(state: SyncFlowState): SyncFlowState {
  return { ...state, phase: 'start', busy: false, pending: null };
}

export function validateSyncCode(raw: string): SyncCodeValidation {
  const code = CloudSystem.normalizeSyncCode(raw);
  return code.length === SYNC_CODE_LENGTH
    ? { ok: true, code }
    : { ok: false, message: `Ein Code hat ${SYNC_CODE_LENGTH} Zeichen.` };
}

export function decideRedeemResult(
  result: CloudSystem.CloudResult<SyncPendingSave | null>,
): SyncRedeemDecision {
  if (!result.ok) return { kind: 'error', message: result.error };
  if (!result.value) return { kind: 'expired' };
  return { kind: 'comparison', pending: result.value };
}

export function showSyncComparison(state: SyncFlowState, pending: SyncPendingSave): SyncFlowState {
  return { ...state, phase: 'comparison', busy: false, pending };
}

export function clearSyncPending(state: SyncFlowState): SyncFlowState {
  return { ...state, pending: null };
}
