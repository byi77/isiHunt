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

/**
 * Groesse des geschuetzten Puffers fuer seltene, diagnostisch tragende
 * Ereignisse (`DebugSystem.pushProtectedLogEntry`).
 *
 * **Warum es ihn ueberhaupt gibt.** Der Hauptpuffer oben ist nach
 * Ereignisrate bemessen und wird von haeufigen Ereignissen dominiert: ein
 * Fang erzeugt drei Eintraege (`run:collected`, `score:changed`,
 * `combo:changed`), und der Geraetebericht vom 2026-08-23 zaehlte 148
 * Relikte in einer einzigen Runde - 444 Eintraege gegen 400 Pufferplaetze.
 * Alles vom Rundenstart war am Rundenende weg, einschliesslich der eigens
 * fuer die Fehlersuche eingebauten Kanal- und Sendeprotokollierung.
 *
 * **Warum klein.** Was hier hineingehoert, tritt pro Runde einstellig auf:
 * Kanalwechsel, Sendefehlschlaege, einmalige Verwurfsgruende. 60 Plaetze
 * decken mehrere komplette Duelle ab. Groesser waere teuer ohne Nutzen - der
 * Puffer wird wie der Hauptpuffer vollstaendig nach `localStorage`
 * serialisiert.
 *
 * **Was hier NICHT hineingehoert:** alles, was im Takt feuert. Die Trennung
 * verlaeuft entlang der Ereignisrate, nicht entlang der Wichtigkeit - sonst
 * wandert nach und nach alles hierher und das Problem beginnt von vorn.
 */
export const DEBUG_PROTECTED_BUFFER_SIZE = 60;

/** Eigener Speicherschluessel, damit beide Puffer getrennt ueberleben. */
export const DEBUG_PROTECTED_STORAGE_KEY = 'isihunt.debug-log-protected.v1';
