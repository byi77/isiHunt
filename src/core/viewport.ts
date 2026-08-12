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
  /**
   * Canvas neu vermessen - und den Umrechnungsfaktor gleich mit.
   *
   * ## Die Falle
   *
   * `updateBounds()` allein reicht **nicht**. Es schreibt zwar die neue
   * Canvas-Position und -Groesse nach `canvasBounds`, laesst aber
   * `displayScale` unberuehrt. Genau dieser Faktor rechnet einen Tipp in
   * Spielkoordinaten um:
   *
   * ```
   * spielX = (seitenX - canvasBounds.left) * displayScale.x
   * ```
   *
   * `displayScale` wird ausschliesslich in `refresh()` neu gebildet, als
   * `baseSize / canvasBounds`. Wer nur `updateBounds()` aufruft, erneuert also
   * die eine Haelfte der Rechnung und laesst die andere veralten - das Ergebnis
   * ist schlechter als gar nichts zu tun, weil beide Werte dann aus
   * verschiedenen Momenten stammen.
   *
   * Auf dem iPhone passiert das staendig: Safari aendert die Canvas-Groesse
   * beim Ein- und Ausklappen der Adressleiste, meldet das aber ueber
   * `visualViewport`-Ereignisse, nicht ueber ein `resize` am Fenster. Der Tipp
   * landete dadurch neben dem, was man sieht - und zwar um so weiter, je
   * groesser der Unterschied zwischen altem und neuem Zustand war.
   *
   * ## Warum das die volle `refresh()` sein muss
   *
   * Nachmessen allein genuegt auch dann nicht, wenn man `displayScale` von Hand
   * nachzieht. `refresh()` ruft **zuerst** `updateScale()` auf, und das setzt
   * die CSS-Groesse des Canvas sowie seine Zentrierung neu. Erst danach misst
   * `updateBounds()`.
   *
   * Wer nur misst, misst den Canvas in seiner **alten** Groesse - Safari hat den
   * sichtbaren Bereich laengst geaendert. Ist die gemessene Breite zu gross,
   * wird jeder Tipp zu klein skaliert: Der Fehler ist am linken Rand null und
   * waechst nach rechts. Genau das war zuletzt zu sehen ("links und Mitte geht,
   * rechts nicht").
   *
   * `refresh()` ist teurer und feuert ein `RESIZE`-Ereignis. Deshalb wird es
   * nur aufgerufen, wenn sich die Masse tatsaechlich geaendert haben - das ist
   * beim Tippen fast nie der Fall, und der Vergleich kostet ein
   * `getBoundingClientRect()`.
   */
  const remeasure = (): void => {
    const scale = game.scale;
    const rect = scale.canvas.getBoundingClientRect();
    const bounds = scale.canvasBounds;

    // Nur wenn sich wirklich etwas verschoben oder veraendert hat. Ohne diese
    // Bremse liefe bei jedem Tipp eine volle Neuberechnung samt RESIZE-Ereignis.
    //
    // `canvasBounds` rechnet den Seiten-Scrollversatz mit ein, das frische
    // Rechteck nicht - beim Vergleich muss er deshalb wieder drauf.
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;

    const unveraendert =
      Math.abs(rect.width - bounds.width) < 0.5 &&
      Math.abs(rect.height - bounds.height) < 0.5 &&
      Math.abs(rect.left + scrollX - bounds.left) < 0.5 &&
      Math.abs(rect.top + scrollY - bounds.top) < 0.5;

    if (unveraendert) return;

    scale.refresh();
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
