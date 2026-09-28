import type Phaser from 'phaser';

export interface ClipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Rechteckiger Ausschnitt fuer einen Container oder eine Zeichenflaeche.
 *
 * Warum ein eigener Helfer statt einer Maske an jeder Stelle: Die
 * Maskentechnik haengt am Renderer. Unter Phaser 4 wirkt `GeometryMask` nur
 * noch im Canvas-Renderer und bricht unter WebGL still - Inhalt ragt dann aus
 * Listen heraus, ohne dass ein Fehler erscheint (Probelauf 2026-09-28,
 * ADR-0035). Mit einem Helfer gibt es genau eine Stelle, die das weiss, und
 * die Pixelprobe im Playtest (`screens`) prueft sie.
 *
 * Der Mask-Filter sitzt in der **externen** Liste: Er rechnet in
 * Kamerakoordinaten, passend zu einem festen Bildschirmausschnitt. Die interne
 * Liste wuerde die Maske an die Grenzen des Objekts binden, die sich beim
 * Scrollen verschieben. Die Form entsteht ausserhalb der Anzeigeliste, damit
 * sie nur in die Maskentextur gezeichnet wird, nicht ins Bild.
 *
 * Nur `import type`: `CollectionEffects` wird unter jsdom getestet, wo das
 * Laden von Phaser an der Canvas-Erkennung scheitert.
 */
export class ClipMask {
  private readonly shape: Phaser.GameObjects.Graphics;
  private readonly filter: Phaser.Filters.Mask;

  constructor(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Container | Phaser.GameObjects.Graphics,
  ) {
    this.shape = scene.make.graphics({ x: 0, y: 0 }, false);
    target.enableFilters();
    this.filter = target.filters!.external.addMask(this.shape);
  }

  /** Setzt den sichtbaren Ausschnitt in Weltkoordinaten. */
  set(rect: ClipRect): this {
    this.shape.clear().fillStyle(0xffffff).fillRect(rect.x, rect.y, rect.width, rect.height);
    this.filter.needsUpdate = true;
    return this;
  }

  destroy(): void {
    this.filter.destroy();
    this.shape.destroy();
  }
}
