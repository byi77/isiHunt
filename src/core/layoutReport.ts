/**
 * Misst, wie das Spiel tatsaechlich auf dem Bildschirm liegt.
 *
 * ## Warum das noetig ist
 *
 * Ein Browser-Simulator kann iPhone-Groessen nachstellen, aber **keine
 * sicheren Raender** (`safe-area-inset-*`) - die entstehen erst durch echte
 * Notch-Hardware. Genau diese Werte entscheiden aber, ob der Zurueck-Knopf
 * unter der Dynamic Island verschwindet.
 *
 * Damit ist die Lage wie bei den Trefferflaechen: Was nicht auf dem Geraet
 * gemessen wird, bleibt Vermutung. Dieses Modul liefert die Zahlen dorthin, wo
 * man sie ablesen kann - in den Wartungsbildschirm (docs/CODE_STYLE.md 1.8).
 *
 * ## Wie die sicheren Raender gelesen werden
 *
 * `env(safe-area-inset-*)` ist aus JavaScript nicht direkt abfragbar. In
 * `index.html` stehen deshalb zwei 1-Pixel-Marken genau auf diesen Grenzen;
 * ihre Position verraet die Werte.
 */

export interface LayoutReport {
  /** Sichtbare Seitenhoehe in CSS-Pixeln. */
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  /** Sicherer Rand oben - unter Notch oder Dynamic Island. */
  readonly safeTop: number;
  /** Sicherer Rand unten - Home-Indicator. */
  readonly safeBottom: number;
  /** Leerer Streifen ueber dem Canvas. */
  readonly barTop: number;
  /** Leerer Streifen unter dem Canvas. */
  readonly barBottom: number;
  readonly canvasTop: number;
  readonly canvasHeight: number;
  /** Umrechnung Spiel- zu CSS-Pixeln. */
  readonly scale: number;
  /** Ragt der obere Rand des Spielfelds unter die Notch? */
  readonly clippedByNotch: boolean;
}

function probeOffset(id: string, fromBottom: boolean): number {
  const element = document.getElementById(id);
  if (!element) return 0;

  const box = element.getBoundingClientRect();
  return fromBottom ? window.innerHeight - box.bottom : box.top;
}

export function measureLayout(canvas: HTMLCanvasElement): LayoutReport {
  const rect = canvas.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  const safeTop = probeOffset('safe-top', false);
  const safeBottom = probeOffset('safe-bottom', true);

  return {
    viewportHeight,
    viewportWidth: window.innerWidth,
    safeTop,
    safeBottom,
    barTop: rect.top,
    barBottom: viewportHeight - rect.bottom,
    canvasTop: rect.top,
    canvasHeight: rect.height,
    scale: rect.height / 1280,
    // Der obere Spielfeldrand liegt bei Spiel-y 0. Beginnt der Canvas ueber der
    // sicheren Grenze, ist alles darueber verdeckt.
    clippedByNotch: rect.top < safeTop,
  };
}

/**
 * Wo liegt ein DOM-Element in Spielkoordinaten?
 *
 * Phaser positioniert `scene.add.dom(...)` ueber einen eigenen Container, der
 * unabhaengig vom Canvas skaliert und verschoben wird. Ob beide
 * uebereinstimmen, laesst sich nur messen - genau das hat beim Code-Feld im
 * Spielstand-Bildschirm gefehlt, das trotz nachgerechneter 74 px Abstand auf
 * dem Knopf darunter lag.
 *
 * @returns Ober- und Unterkante in Spiel-Pixeln, oder `null`, wenn es das
 *          Element nicht gibt.
 */
export function measureDomElement(
  element: HTMLElement,
  canvas: HTMLCanvasElement,
): { top: number; bottom: number } | null {
  const box = element.getBoundingClientRect();
  if (box.height === 0) return null;

  const canvasBox = canvas.getBoundingClientRect();
  const scale = canvasBox.height / 1280;
  if (scale === 0) return null;

  return {
    top: (box.top - canvasBox.top) / scale,
    bottom: (box.bottom - canvasBox.top) / scale,
  };
}

/** Kurzfassung fuer die Anzeige - eine Zeile je Wert, ohne Deutung. */
export function formatLayout(report: LayoutReport): string {
  const n = (value: number): string => value.toFixed(0);

  return [
    `Fenster    ${n(report.viewportWidth)} x ${n(report.viewportHeight)}`,
    `Sicher     oben ${n(report.safeTop)}  unten ${n(report.safeBottom)}`,
    `Balken     oben ${n(report.barTop)}  unten ${n(report.barBottom)}`,
    `Spielfeld  ab ${n(report.canvasTop)}, ${n(report.canvasHeight)} hoch`,
    `Massstab   ${report.scale.toFixed(3)}`,
    report.clippedByNotch ? 'ACHTUNG: oberer Rand liegt unter der Notch' : 'Oberer Rand frei',
  ].join('\n');
}
