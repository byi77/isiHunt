/**
 * Haelt Phasers Vorstellung von der Canvas-Position aktuell.
 *
 * ## Das Problem
 *
 * Phaser rechnet jede Beruehrung von Bildschirm- in Spielkoordinaten um und
 * benutzt dafuer eine **zwischengespeicherte** Position des Canvas
 * (`scale.canvasBounds`). Aktualisiert wird sie nur bei Ereignissen, auf die
 * Phaser selbst hoert - im Wesentlichen `resize` und `scroll` am Fenster.
 *
 * Auf dem iPhone reicht das nicht. Safari klappt seine Adressleiste beim
 * Scrollen ein und aus. Dabei verschiebt sich der Canvas auf dem Bildschirm,
 * **ohne** dass ein `resize` am Fenster ausgeloest wird - die Aenderung meldet
 * ausschliesslich `window.visualViewport`.
 *
 * Die Folge ist ein Versatz zwischen Sichtbarem und Antippbarem: Phaser haelt
 * den Canvas fuer weiter oben, als er ist, rechnet jede Beruehrung dadurch zu
 * weit unten - und man muss oberhalb eines Knopfes tippen, damit er reagiert.
 *
 * ## Die Loesung
 *
 * Zwei Ebenen, weil die erste allein nie alle Faelle erwischt:
 *
 * 1. **Auf Viewport-Ereignisse hoeren**, die Phaser nicht kennt.
 * 2. **Vor jeder Beruehrung nachmessen.** Ein `getBoundingClientRect()` je
 *    Fingertipp ist unmessbar billig und macht die Umrechnung unabhaengig
 *    davon, ob wir wirklich jedes Ereignis abgefangen haben. Der Listener
 *    laeuft in der Capture-Phase und damit garantiert vor Phasers eigenem.
 */

import type Phaser from 'phaser';

export function keepCanvasBoundsFresh(game: Phaser.Game): void {
  // Nur die Canvas-Position neu vermessen - guenstig genug fuer jeden Tipp.
  const remeasure = (): void => {
    game.scale.updateBounds();
  };

  // Bei echten Groessenaenderungen muss zusaetzlich die Skalierung neu
  // gerechnet werden. Gebuendelt auf den naechsten Frame, weil iOS waehrend
  // einer Animation dutzende Ereignisse feuert.
  let pending = false;
  const rescale = (): void => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      game.scale.refresh();
    });
  };

  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener('resize', rescale);
    viewport.addEventListener('scroll', remeasure);
  }

  window.addEventListener('orientationchange', rescale);
  // Zurueck aus dem Seiten-Cache (iOS "Zurueck"-Geste): Masse koennen veraltet
  // sein, ohne dass ein Ereignis dazwischenlag.
  window.addEventListener('pageshow', rescale);

  // Letzte Absicherung: unmittelbar vor der Verarbeitung eines Tipps.
  window.addEventListener('pointerdown', remeasure, { capture: true, passive: true });
  window.addEventListener('touchstart', remeasure, { capture: true, passive: true });
}
