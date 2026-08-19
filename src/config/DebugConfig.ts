/**
 * Debug-Modus fuer Tester: Zugang ohne PIN, Report per Share-Sheet.
 *
 * Getrennt von den Wartungswerten in GameConfig.ts, weil dieser Bereich
 * keine Balancing-Zahlen enthaelt, sondern reine Werkzeug-Konstanten -
 * analog zur Trennung von challenge.ts und backend.ts.
 */

/** Anzahl Tipps auf das Logo, die den Debug-Modus umschalten. */
export const DEBUG_TOGGLE_TAP_COUNT = 10;

/** Zeitfenster, in dem alle Tipps liegen muessen - sonst zaehlt die Reihe neu. */
export const DEBUG_TOGGLE_TAP_WINDOW_MS = 4_000;

/**
 * Maximale Anzahl Eintraege im rollierenden Event-/Fehler-Ringpuffer.
 *
 * Erhoeht von urspruenglich 50 auf 200, dann auf 400: seit `withTimeout()` in
 * `CloudSystem.ts` jeden Backend-Aufruf automatisch mitschreibt (Erfolg UND
 * Fehlschlag, nicht nur console.warn/console.error), fallen deutlich mehr
 * Eintraege pro Menuebesuch an.
 *
 * **Die Reichweite haengt an der Ereignisrate, nicht an dieser Zahl allein.**
 * Der Audit vom 2026-08-19 hat nachgemessen: Solange `TimerChanged`
 * mitgeschrieben wurde (jeder Frame, ~60/s), reichte der Puffer waehrend
 * eines Runs nur 6,7 Sekunden zurueck - ein 90-Sekunden-Run ueberschrieb ihn
 * 13,5-mal. Seitdem ueberspringt `installDebugLogging()` in `main.ts` dieses
 * eine Ereignis; die uebrigen fallen im Bereich weniger Eintraege pro
 * Menuebesuch oder Backend-Aufruf an.
 *
 * Wer hier ein neues, haeufig feuerndes Ereignis anschliesst, rechnet die
 * Reichweite bitte neu nach: `400 / Ereignisse pro Sekunde`.
 */
export const DEBUG_LOG_BUFFER_SIZE = 400;

/** Eigener localStorage-Schluessel, getrennt vom Spielstand (SAVE_KEY). */
export const DEBUG_MODE_STORAGE_KEY = 'isihunt.debug-mode.v1';

/**
 * Spiegelt den Ringpuffer, damit ein Fehlerbericht einen App-Neustart
 * ueberlebt. Ohne das ist der Puffer weg, sobald jemand die App verlaesst,
 * um z. B. erst einen Screenshot zu pruefen, bevor er das Share-Sheet
 * oeffnet - genau der Moment, in dem ein Fehler dokumentiert werden soll.
 */
export const DEBUG_LOG_STORAGE_KEY = 'isihunt.debug-log.v1';
