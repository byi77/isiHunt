/**
 * Auskuenfte ueber die Anzeigeumgebung des Browsers.
 *
 * Warum eine eigene Datei: Diese Abfragen sind reine Browser-Eigenheiten und
 * haben mit dem Spiel nichts zu tun. Gekapselt bleiben sie an einer Stelle
 * korrigierbar, wenn sich das Verhalten einer Plattform aendert.
 *
 * ## Die Ausgangslage
 *
 * Auf dem Handy nimmt die Adressleiste des Browsers dauerhaft Platz weg. Es
 * gibt zwei Wege, sie loszuwerden, und **welcher funktioniert, entscheidet die
 * Plattform**:
 *
 * | Plattform | Fullscreen-API | Zum Home-Bildschirm |
 * | --- | --- | --- |
 * | Android (Chrome) | ja | ja |
 * | Desktop | ja | teils |
 * | **iPhone (Safari)** | **nein** | ja |
 *
 * Apple gibt die Fullscreen-API auf dem iPhone nur fuer Videoelemente frei,
 * nicht fuer beliebige Elemente. Ein Vollbild-Knopf ist dort also wirkungslos -
 * deshalb wird er ausgeblendet und stattdessen der Weg ueber den
 * Home-Bildschirm empfohlen. Als installierte Web-App laeuft das Spiel dann
 * ohne jede Browserleiste.
 */

/**
 * Laeuft das Spiel als installierte App (vom Home-Bildschirm gestartet)?
 *
 * `display-mode: standalone` ist der Standardweg; `navigator.standalone` ist
 * Apples aelterer, nicht standardisierter Vorgaenger, den iOS weiterhin setzt.
 */
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;

  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone;
  return legacy === true;
}

/** Ist ein iPhone oder iPad im Spiel? Entscheidet, welchen Hinweis wir zeigen. */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS meldet sich seit Version 13 als Macintosh - der Touch-Test trennt
  // ein iPad von einem echten Mac.
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || isIpadOs;
}
