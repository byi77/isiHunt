/**
 * Gemeinsame Textformate fuer Zahlen und Zeiten.
 *
 * Warum eine eigene Datei: Spielzeit wurde an zwei Stellen unabhaengig
 * formatiert - im Profil als "2 Std. 30 Min.", in der Wartungsstatistik als
 * "2 h 30 min". Dieselbe Zahl in zwei Schreibweisen, und nur eine der beiden
 * Funktionen fing negative Eingaben ab (Audit 2026-08-23).
 *
 * Wer hier eine Schreibweise aendert, aendert sie ueberall - genau das ist
 * der Zweck.
 */

/**
 * Spielzeit in gut lesbarer Form.
 *
 * Sekunden erscheinen nur unterhalb einer Minute: Wer 40 Stunden gespielt
 * hat, will nicht auf die Sekunde genau wissen, wie viele.
 *
 * @param milliseconds Negative Werte gelten als 0 - ein kaputter Spielstand
 *   soll keine negative Spielzeit anzeigen.
 */
export function formatPlayTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  if (minutes > 0) return `${minutes} Min. ${seconds} Sek.`;
  return `${seconds} Sek.`;
}
