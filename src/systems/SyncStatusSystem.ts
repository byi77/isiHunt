/**
 * Sichtbarer Zustand des Datenabgleichs.
 *
 * Der Status bleibt bewusst im Speicher statt im Spielstand: Er beschreibt
 * den aktuellen Verbindungsversuch, nicht einen Teil des Spielfortschritts.
 */

export type DataSyncStatus = 'up-to-date' | 'syncing' | 'offline' | 'pending' | 'local-only';

let currentStatus: DataSyncStatus = 'pending';

export function setDataSyncStatus(status: DataSyncStatus): void {
  currentStatus = status;
}

export function getDataSyncStatus(): DataSyncStatus {
  return currentStatus;
}

/** Kurze, profilgeeignete Erklärung ohne technische Begriffe. */
export function dataSyncStatusLabel(status = currentStatus): string {
  switch (status) {
    case 'up-to-date':
      return 'DATENSYNC: DATEN SIND AKTUELL';
    case 'syncing':
      return 'DATENSYNC: WIRD ABGEGLICHEN';
    case 'offline':
      return 'DATENSYNC: NOCH NICHT AKTUELL (OFFLINE)';
    case 'local-only':
      return 'DATENSYNC: NUR LOKAL GESPEICHERT';
    case 'pending':
      return 'DATENSYNC: NOCH NICHT AKTUELL';
  }
}
