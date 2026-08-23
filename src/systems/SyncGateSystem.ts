/**
 * Entscheidet, **ob** ein Datenabgleich jetzt laufen darf - und mit welchem
 * sichtbaren Status.
 *
 * ## Warum das nicht in der MenuScene bleibt
 *
 * `MenuScene.synchronizeData()` traegt zwei verschiedene Dinge: den Ablauf
 * (Netzaufrufe, Szenenneustart, Phaser-Zustand) und die Frage, ob ueberhaupt
 * losgelaufen werden soll. Nur der Ablauf braucht Phaser. Die Entscheidung
 * ist eine reine Rechnung aus vier Eingaben - und war als Teil einer
 * 1 500-Zeilen-Scene durch keinen Test erreichbar, obwohl sie schon zweimal
 * falsch war: einmal liess ein Guard jeden Abgleich sofort abbrechen, einmal
 * fehlte die Drosselung und erzeugte rund 100 Backend-Aufrufe in zehn
 * Sekunden (Audit 2026-08-23).
 *
 * `SyncFlowSystem` macht dasselbe fuer den Sync-Bildschirm; dieses Modul
 * folgt demselben Muster.
 */

import { SYNC_MIN_INTERVAL_MS } from '@/config/backend';
import type { DataSyncStatus } from '@/systems/SyncStatusSystem';

export interface SyncGateInput {
  /** Laeuft bereits ein Abgleich? */
  busy: boolean;
  /** Ist ein Backend eingerichtet? */
  cloudAvailable: boolean;
  /** Laeuft der lokale Wartungs-Teststand? */
  testProfile: boolean;
  /** Meldet der Browser eine Verbindung? */
  online: boolean;
  /** Erzwungener Abgleich (Knopfdruck) - umgeht die Drosselung. */
  force: boolean;
  /** Zeitpunkt des letzten Starts, 0 = noch nie. */
  lastStartedAt: number;
  /** Jetzt-Zeitpunkt, als Parameter fuer testbare Zeitspruenge. */
  now: number;
}

export type SyncGateDecision =
  /** Losfahren. Der Aufrufer setzt `lastStartedAt` auf `now`. */
  | { run: true }
  /**
   * Nicht loslaufen. `status` ist gesetzt, wenn die Statusanzeige aktualisiert
   * werden soll - bei der Drosselung bleibt der bisherige Status bewusst
   * stehen, weil sich an der Lage nichts geaendert hat.
   */
  | {
      run: false;
      reason: 'busy' | 'local-only' | 'offline' | 'throttled';
      status?: DataSyncStatus;
    };

/**
 * Die Reihenfolge der Pruefungen ist Absicht:
 *
 * 1. `busy` zuerst - ein zweiter paralleler Lauf hilft nie.
 * 2. Dann die beiden statussetzenden Zweige. Sie sprechen kein Backend an und
 *    duerfen deshalb **nicht** gedrosselt werden: Wuerde die Sperre davor
 *    greifen, bliebe nach dem ersten Drosseln ein veralteter Status stehen.
 * 3. Erst danach die Drosselung, denn ab hier kostet jeder Durchlauf echte
 *    Netzaufrufe.
 */
export function decideSyncGate(input: SyncGateInput): SyncGateDecision {
  if (input.busy) return { run: false, reason: 'busy' };

  if (!input.cloudAvailable || input.testProfile) {
    return { run: false, reason: 'local-only', status: 'local-only' };
  }

  if (!input.online) {
    return { run: false, reason: 'offline', status: 'offline' };
  }

  const seit = input.now - input.lastStartedAt;
  if (!input.force && input.lastStartedAt > 0 && seit < SYNC_MIN_INTERVAL_MS) {
    return { run: false, reason: 'throttled' };
  }

  return { run: true };
}

/** Die Felder, an denen ein Spieler eine Uebernahme bemerken wuerde. */
export interface VisibleProgress {
  level: number;
  coins: number;
  bestScore: number;
  totalRuns: number;
}

/**
 * Hat sich durch eine Cloud-Uebernahme sichtbar etwas geaendert?
 *
 * **Warum das gefragt wird.** Nach einer Uebernahme startet das Menue neu,
 * damit Level, Muenzen und Welten den neuen Stand zeigen. Ohne diese Frage
 * genuegt eine falsch-positive "die Cloud ist weiter"-Antwort, um die Szene
 * endlos neu zu starten - genau das passierte nach der XP-Umstellung, als ein
 * unmigrierter Cloud-Stand dauerhaft als weiter galt.
 *
 * Ein erkannter Reset zaehlt immer als Aenderung: Er raeumt Besitz und Outbox
 * ab, auch wenn die vier Zahlen unten zufaellig gleich bleiben.
 *
 * Die Logik lag in `MenuScene.checkCloudSave()` und war dort - wie die ganze
 * Funktion - durch keinen Test erreichbar (Audit 2026-08-23).
 */
export function hasVisibleChange(
  vorher: VisibleProgress,
  nachher: VisibleProgress,
  resetErkannt: boolean,
): boolean {
  return (
    resetErkannt ||
    nachher.level !== vorher.level ||
    nachher.coins !== vorher.coins ||
    nachher.bestScore !== vorher.bestScore ||
    nachher.totalRuns !== vorher.totalRuns
  );
}
