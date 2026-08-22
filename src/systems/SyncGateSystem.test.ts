/**
 * Tests fuer die Torwaechter-Entscheidung des Datenabgleichs.
 *
 * Die Logik lag bis zum Audit 2026-08-23 in `MenuScene.synchronizeData()` und
 * war dort durch keinen Test erreichbar - obwohl sie bereits zweimal falsch
 * war (ein Guard brach jeden Abgleich ab; eine fehlende Drosselung erzeugte
 * rund 100 Backend-Aufrufe in zehn Sekunden).
 */

import { describe, expect, it } from 'vitest';

import { SYNC_MIN_INTERVAL_MS } from '@/config/backend';
import { decideSyncGate } from '@/systems/SyncGateSystem';
import type { SyncGateInput } from '@/systems/SyncGateSystem';

/** Der Normalfall: alles bereit, nie zuvor abgeglichen. */
function eingabe(overrides: Partial<SyncGateInput> = {}): SyncGateInput {
  return {
    busy: false,
    cloudAvailable: true,
    testProfile: false,
    online: true,
    force: false,
    lastStartedAt: 0,
    now: 1_000_000,
    ...overrides,
  };
}

describe('decideSyncGate', () => {
  it('laesst den ersten Abgleich laufen', () => {
    expect(decideSyncGate(eingabe())).toEqual({ run: true });
  });

  it('blockt einen parallelen Lauf, ohne den Status zu aendern', () => {
    const d = decideSyncGate(eingabe({ busy: true }));
    expect(d).toEqual({ run: false, reason: 'busy' });
  });

  it('meldet "nur lokal" ohne eingerichtetes Backend', () => {
    expect(decideSyncGate(eingabe({ cloudAvailable: false }))).toEqual({
      run: false,
      reason: 'local-only',
      status: 'local-only',
    });
  });

  it('meldet "nur lokal" im Wartungs-Teststand', () => {
    // Der Teststand darf nichts hochladen - sonst landet er in der Bestenliste.
    expect(decideSyncGate(eingabe({ testProfile: true }))).toMatchObject({
      run: false,
      status: 'local-only',
    });
  });

  it('meldet "offline" ohne Verbindung', () => {
    expect(decideSyncGate(eingabe({ online: false }))).toEqual({
      run: false,
      reason: 'offline',
      status: 'offline',
    });
  });

  it('drosselt einen zweiten Lauf innerhalb der Mindestpause', () => {
    const d = decideSyncGate(eingabe({ lastStartedAt: 1_000_000 - (SYNC_MIN_INTERVAL_MS - 1) }));
    expect(d).toEqual({ run: false, reason: 'throttled' });
  });

  it('laesst nach Ablauf der Mindestpause wieder laufen', () => {
    expect(decideSyncGate(eingabe({ lastStartedAt: 1_000_000 - SYNC_MIN_INTERVAL_MS }))).toEqual({
      run: true,
    });
  });

  it('umgeht die Drosselung bei einem erzwungenen Abgleich', () => {
    // Ausdrueckliche Anlaesse: Netz kehrt zurueck, Nutzer entscheidet selbst.
    expect(decideSyncGate(eingabe({ force: true, lastStartedAt: 999_999 }))).toEqual({
      run: true,
    });
  });

  it('drosselt "force" NICHT weg, aber "busy" schon', () => {
    // Reihenfolge-Nachweis: `busy` steht vor `force`, weil ein zweiter
    // paralleler Lauf auch bei ausdruecklichem Anlass nicht hilft.
    expect(decideSyncGate(eingabe({ force: true, busy: true }))).toMatchObject({
      run: false,
      reason: 'busy',
    });
  });

  it('setzt den Status auch dann, wenn zuletzt gerade abgeglichen wurde', () => {
    // Der Grund fuer die Reihenfolge: Diese Zweige sprechen kein Backend an.
    // Laegen sie hinter der Drosselung, bliebe nach dem ersten Drosseln ein
    // veralteter Status stehen - der Nutzer saehe "aktuell", obwohl er
    // offline ist.
    const d = decideSyncGate(eingabe({ online: false, lastStartedAt: 999_999 }));
    expect(d).toMatchObject({ run: false, status: 'offline' });
  });
});
