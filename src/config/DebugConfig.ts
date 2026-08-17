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

/** Maximale Anzahl Eintraege im rollierenden Event-/Fehler-Ringpuffer. */
export const DEBUG_LOG_BUFFER_SIZE = 50;

/** Eigener localStorage-Schluessel, getrennt vom Spielstand (SAVE_KEY). */
export const DEBUG_MODE_STORAGE_KEY = 'isihunt.debug-mode.v1';
