import type Phaser from 'phaser';

/**
 * Punktliste fuer `Graphics.fillPoints`/`strokePoints`.
 *
 * Phaser 4 typisiert beide Methoden auf `Vector2[]`, liest zur Laufzeit aber
 * nur `x` und `y` (`Graphics.js`, `fillPoints`/`strokePoints`). Die
 * Zeichenroutinen fuer Schiffe, Abzeichen und Weltkonturen bauen einfache
 * Punktobjekte; sie in `Vector2` umzukopieren kostete bei jedem Zeichnen
 * Speicher ohne Wirkung. Der Helfer macht die Annahme an genau einer Stelle
 * sichtbar statt an jedem Aufruf.
 */
export function asPoints(
  points: readonly { readonly x: number; readonly y: number }[],
): Phaser.Math.Vector2[] {
  return points as unknown as Phaser.Math.Vector2[];
}
