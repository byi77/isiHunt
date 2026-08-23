/**
 * Tests fuer die Zeitkonstanten des Netzwerk-Duells.
 *
 * Warum diese Zahlen einen eigenen Test bekommen: der Ausfall vom 2026-08-23
 * (Bericht v0.1.246) entstand nicht aus fehlerhafter Logik, sondern aus einer
 * einzigen falsch bemessenen Konstante - `ONLINE_DUEL_READY_TIMEOUT_MS` stand
 * auf 10 Sekunden und damit auf der Groessenordnung eines Netzwerk-Roundtrips,
 * obwohl an dieser Stelle ein Mensch einen sechsstelligen Code weitergibt und
 * abtippt. Typecheck, Lint und alle bestehenden Tests waren dabei gruen: eine
 * Zahl ist erst falsch, wenn man sie zu etwas anderem ins Verhaeltnis setzt.
 *
 * Genau dieses Verhaeltnis pruefen die Tests hier. Sie halten keine
 * Einzelwerte fest (das waere nur eine zweite Kopie derselben Zahl), sondern
 * die Beziehungen, aus denen sich die Werte begruenden.
 */

import { describe, expect, it } from 'vitest';

import {
  DUEL_ROOM_CODE_TTL_MINUTES,
  ONLINE_DUEL_GUEST_START_TIMEOUT_MS,
  ONLINE_DUEL_LIVE_STALE_MS,
  ONLINE_DUEL_READY_TIMEOUT_MS,
  ONLINE_DUEL_RESULT_POLL_INTERVAL_MS,
  ONLINE_DUEL_SCORE_BROADCAST_INTERVAL_MS,
  ONLINE_DUEL_START_POLL_INTERVAL_MS,
} from '@/config/onlineDuel';

/**
 * Untergrenze fuer ein Zeitlimit, das auf eine menschliche Handlung wartet.
 *
 * Code ablesen, dem Freund zeigen oder vorlesen, sechs Zeichen auf einer
 * Handytastatur tippen, den Knopf treffen: im belegten Fall dauerte das 56
 * Sekunden, und das war ein normaler, kein langsamer Durchlauf. Eine Minute
 * ist die Grenze, unterhalb derer ein solcher Timeout nachweislich
 * funktionierende Duelle zerreisst - nicht der empfohlene Wert.
 */
const MENSCHLICHE_HANDLUNGSDAUER_MS = 60_000;

describe('Zeitlimits warten auf Menschen, nicht auf Pakete', () => {
  it('gibt dem Gastgeber mehr als eine Minute fuer die Code-Weitergabe', () => {
    expect(ONLINE_DUEL_READY_TIMEOUT_MS).toBeGreaterThanOrEqual(MENSCHLICHE_HANDLUNGSDAUER_MS);
  });

  it('gibt dem Gast dieselbe Zeit wie dem Gastgeber', () => {
    // Beide warten auf dasselbe Ereignis - dass der andere seine Lobby
    // erreicht. Zwei verschiedene Zahlen waeren zwei Begruendungen, und die
    // zweite gibt es nicht.
    expect(ONLINE_DUEL_GUEST_START_TIMEOUT_MS).toBe(ONLINE_DUEL_READY_TIMEOUT_MS);
  });

  it('wartet nie laenger, als der Raum-Code ueberhaupt gilt', () => {
    // Jenseits der TTL ist der Raum weg; weiter zu warten koennte nur noch
    // scheitern. Diese Grenze macht aus "grosszuegig" ein begrenztes
    // Versprechen statt eines offenen.
    const ttlMs = DUEL_ROOM_CODE_TTL_MINUTES * 60_000;
    expect(ONLINE_DUEL_READY_TIMEOUT_MS).toBeLessThanOrEqual(ttlMs);
    expect(ONLINE_DUEL_GUEST_START_TIMEOUT_MS).toBeLessThanOrEqual(ttlMs);
  });
});

describe('Takte bleiben deutlich unter den Zeitlimits, die sie bedienen', () => {
  it('fragt vielfach nach der Startzeit, bevor das Warten aufgegeben wird', () => {
    // Ein Takt, der nur ein- oder zweimal in sein Zeitlimit passt, macht das
    // Ergebnis vom Zufall einer einzelnen Anfrage abhaengig.
    const abfragen = ONLINE_DUEL_READY_TIMEOUT_MS / ONLINE_DUEL_START_POLL_INTERVAL_MS;
    expect(abfragen).toBeGreaterThanOrEqual(10);
  });

  it('haelt den Ergebnis-Takt langsamer als den Start-Takt', () => {
    // Auf die Startzeit wartet man Sekunden, auf das Ergebnis des Gegners bis
    // zu einer vollen Rundenlaenge - derselbe Takt waere dort Verschwendung.
    expect(ONLINE_DUEL_RESULT_POLL_INTERVAL_MS).toBeGreaterThan(ONLINE_DUEL_START_POLL_INTERVAL_MS);
  });

  it('erklaert die Verbindung erst nach mehreren ausgebliebenen Staenden fuer weg', () => {
    // Mobilfunk laesst einzelne Nachrichten ausfallen. Das Doppelte des
    // Sendetakts wuerde bei jedem Funkloch "Verbindung weg" blinken.
    const verpasste = ONLINE_DUEL_LIVE_STALE_MS / ONLINE_DUEL_SCORE_BROADCAST_INTERVAL_MS;
    expect(verpasste).toBeGreaterThanOrEqual(4);
  });
});
