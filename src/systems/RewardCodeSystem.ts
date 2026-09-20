/** Sichere Darstellung von Belohnungscodes; Einloesen bleibt serverseitig. */

const REWARD_CODE_LENGTH = 12;
const PENDING_REDEMPTION_PREFIX = 'isihunt.pending-reward-redemption.v1.';

export interface PendingRewardRedemption {
  readonly code: string;
  readonly requestId: string;
}

export function normalizeRewardCode(value: string): string | null {
  const normalized = value.replace(/[ -]/g, '');
  if (!/^\d{12}$/.test(normalized)) return null;
  return normalized;
}

export function formatRewardCode(value: string): string | null {
  const normalized = normalizeRewardCode(value);
  if (!normalized) return null;
  return normalized.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
}

export function rewardCodeLength(): number {
  return REWARD_CODE_LENGTH;
}

function pendingKey(profileId: string): string {
  return `${PENDING_REDEMPTION_PREFIX}${encodeURIComponent(profileId)}`;
}

function createRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Persistiert die Retry-ID vor dem Netzaufruf und niemals den formatierten Klartext in Logs. */
export function prepareRewardRedemption(
  profileId: string,
  code: string,
): PendingRewardRedemption | null {
  const normalized = normalizeRewardCode(code);
  if (!profileId || !normalized) return null;
  try {
    const raw = window.localStorage.getItem(pendingKey(profileId));
    if (raw) {
      const existing = JSON.parse(raw) as Partial<PendingRewardRedemption>;
      if (existing.code === normalized && typeof existing.requestId === 'string') {
        return { code: normalized, requestId: existing.requestId };
      }
    }
    const pending = { code: normalized, requestId: createRequestId() };
    window.localStorage.setItem(pendingKey(profileId), JSON.stringify(pending));
    return pending;
  } catch {
    // Ohne Storage darf kein unsicherer neuer Retry erzeugt werden.
    return null;
  }
}

export function clearPendingRewardRedemption(profileId: string, requestId: string): void {
  try {
    const raw = window.localStorage.getItem(pendingKey(profileId));
    if (!raw) return;
    const pending = JSON.parse(raw) as Partial<PendingRewardRedemption>;
    if (pending.requestId === requestId) window.localStorage.removeItem(pendingKey(profileId));
  } catch {
    // Ein abgelaufener lokaler Eintrag darf die erfolgreiche Serverbuchung nicht aendern.
  }
}
