/**
 * Prozedural erzeugte Texturen.
 *
 * Bewusste Entscheidung fuer v0.1: Das Spiel laedt KEINE Bilddateien. Alle
 * Grafiken werden beim Start aus Phaser-Graphics gerendert. Vorteile:
 * - Sofort lauffaehig, kein Asset-Pipeline-Setup, keine Ladezeit.
 * - Alles wird weiss gezeichnet und zur Laufzeit getintet -> eine Textur
 *   bedient alle sechs Seltenheiten und alle fuenf Welten.
 * Ersetzt werden diese Platzhalter spaeter durch echte Assets, ohne dass sich
 * Spielcode aendert (gleiche Texture-Keys). Siehe docs/ART_STYLE.md.
 */

import Phaser from 'phaser';

export const TextureKey = {
  Orb: 'tex-orb',
  Glow: 'tex-glow',
  Spark: 'tex-spark',
  Shard: 'tex-shard',
  Rays: 'tex-rays',
  Ring: 'tex-ring',
  Vignette: 'tex-vignette',
  PlayerCore: 'tex-player-core',
  PlayerHalo: 'tex-player-halo',
  Pixel: 'tex-pixel',
} as const;

export type TextureKeyValue = (typeof TextureKey)[keyof typeof TextureKey];

/** Erzeugt alle Texturen. Idempotent - vorhandene Keys werden uebersprungen. */
export function createTextures(scene: Phaser.Scene): void {
  createPixel(scene);
  createOrb(scene);
  createGlow(scene);
  createSpark(scene);
  createShard(scene);
  createRays(scene);
  createRing(scene);
  createVignette(scene);
  createPlayerCore(scene);
  createPlayerHalo(scene);
}

function withGraphics(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

/** 1x1 weiss - Basis fuer Balken, Trenner und Vollflaechen. */
function createPixel(scene: Phaser.Scene): void {
  withGraphics(scene, TextureKey.Pixel, 1, 1, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
  });
}

/**
 * Der Relikt-Koerper: ein geschliffener Edelstein statt einer flachen Kugel.
 *
 * Aufbau von aussen nach innen: weicher Hof, Facettenring (acht Segmente mit
 * wechselnder Helligkeit), Kernflaeche, Glanzpunkt. Die Facetten sind der
 * Grund, warum sich das Relikt beim Drehen lebendig anfuehlt - eine glatte
 * Kugel sieht rotiert identisch aus.
 */
function createOrb(scene: Phaser.Scene): void {
  const size = 64;
  const c = size / 2;
  const facets = 8;

  withGraphics(scene, TextureKey.Orb, size, size, (g) => {
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(c, c, 31);

    // Facettenkranz: jedes zweite Segment heller - ergibt den Schliff-Eindruck.
    for (let i = 0; i < facets; i++) {
      const from = (Math.PI * 2 * i) / facets;
      const to = (Math.PI * 2 * (i + 1)) / facets;

      g.fillStyle(0xffffff, i % 2 === 0 ? 0.85 : 0.55);
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, 28, from, to, false);
      g.closePath();
      g.fillPath();
    }

    g.fillStyle(0xffffff, 1);
    g.fillCircle(c, c, 17);

    // Glanzpunkt oben links - verankert die Lichtquelle im ganzen Spiel.
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(c - 7, c - 8, 5.5);

    g.lineStyle(2.5, 0xffffff, 0.9);
    g.strokeCircle(c, c, 29.5);
  });
}

/**
 * Weicher Lichtschein. Phaser-Graphics kann keine Farbverlaeufe fuellen, also
 * werden konzentrische Kreise mit niedriger Alpha uebereinandergelegt - die
 * Ueberlagerung ergibt einen sauberen radialen Abfall.
 */
function createGlow(scene: Phaser.Scene): void {
  const size = 128;
  const r = size / 2;

  withGraphics(scene, TextureKey.Glow, size, size, (g) => {
    for (let i = r; i > 0; i--) {
      const t = 1 - i / r; // 0 am Rand, 1 in der Mitte
      g.fillStyle(0xffffff, 0.012 + 0.05 * t * t);
      g.fillCircle(r, r, i);
    }
  });
}

/** Rundes Partikel fuer Schwebestaub im Hintergrund. */
function createSpark(scene: Phaser.Scene): void {
  withGraphics(scene, TextureKey.Spark, 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
  });
}

/**
 * Vierzackiger Funke fuer Einsammel-Explosionen.
 *
 * Warum nicht der runde `Spark`: Runde Partikel lesen sich als Rauch, spitze
 * als Splitter. Ein zerspringendes Relikt soll splittern.
 */
function createShard(scene: Phaser.Scene): void {
  const size = 24;
  const c = size / 2;

  withGraphics(scene, TextureKey.Shard, size, size, (g) => {
    const points: Phaser.Math.Vector2[] = [];
    const spikes = 4;

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? 11 : 2.6;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      points.push(
        new Phaser.Math.Vector2(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius),
      );
    }

    g.fillStyle(0xffffff, 1);
    g.fillPoints(points, true);
  });
}

/**
 * Strahlenkranz hinter seltenen Relikten. Rotiert langsam und macht schon aus
 * dem Augenwinkel klar: da liegt etwas Wertvolles.
 */
function createRays(scene: Phaser.Scene): void {
  const size = 160;
  const c = size / 2;
  const spokes = 12;

  withGraphics(scene, TextureKey.Rays, size, size, (g) => {
    for (let i = 0; i < spokes; i++) {
      const angle = (Math.PI * 2 * i) / spokes;
      const half = 0.055; // halbe Strahlbreite im Bogenmass

      g.fillStyle(0xffffff, i % 2 === 0 ? 0.5 : 0.26);
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, 76, angle - half, angle + half, false);
      g.closePath();
      g.fillPath();
    }
  });
}

/**
 * Duenner Ring fuer die Schockwelle beim Fang. Wird zur Laufzeit skaliert und
 * ausgeblendet - deshalb hier nur die Grundform.
 */
function createRing(scene: Phaser.Scene): void {
  const size = 128;
  const c = size / 2;

  withGraphics(scene, TextureKey.Ring, size, size, (g) => {
    g.lineStyle(6, 0xffffff, 1);
    g.strokeCircle(c, c, 56);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(c, c, 48);
  });
}

/**
 * Radiale Abdunklung der Bildschirmraender.
 *
 * Gezeichnet als Ringe von aussen nach innen mit kubisch abfallender Deckkraft:
 * Graphics kann keine radialen Verlaeufe fuellen, aber viele duenne Ringe
 * ergeben denselben Eindruck. Die Textur wird spaeter auf Bildschirmgroesse
 * gezogen - deshalb reichen 256 px.
 */
function createVignette(scene: Phaser.Scene): void {
  const size = 256;
  const c = size / 2;

  withGraphics(scene, TextureKey.Vignette, size, size, (g) => {
    for (let r = c; r > c * 0.45; r -= 1) {
      const t = (r - c * 0.45) / (c - c * 0.45); // 0 innen, 1 aussen
      g.lineStyle(2, 0x000000, 0.02 * t * t);
      g.strokeCircle(c, c, r);
    }
  });
}

/** Die Spielfigur: ein vierzackiger Lichtstern ("isi" = Licht). */
function createPlayerCore(scene: Phaser.Scene): void {
  const size = 96;
  const c = size / 2;

  withGraphics(scene, TextureKey.PlayerCore, size, size, (g) => {
    const points: Phaser.Math.Vector2[] = [];
    const spikes = 4;
    const outer = 44;
    const inner = 15;

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      points.push(
        new Phaser.Math.Vector2(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius),
      );
    }

    g.fillStyle(0xffffff, 1);
    g.fillPoints(points, true);

    // Zweiter, gedrehter Stern in halber Groesse - gibt der Figur Tiefe.
    const innerPoints: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? 24 : 9;
      const angle = (Math.PI / spikes) * i - Math.PI / 2 + Math.PI / spikes;
      innerPoints.push(
        new Phaser.Math.Vector2(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius),
      );
    }

    g.fillStyle(0xffffff, 0.7);
    g.fillPoints(innerPoints, true);

    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(c, c, 12);
  });
}

/** Rotierender Ring um die Figur - macht den Sammelradius sichtbar. */
function createPlayerHalo(scene: Phaser.Scene): void {
  const size = 128;
  const c = size / 2;

  withGraphics(scene, TextureKey.PlayerHalo, size, size, (g) => {
    g.lineStyle(3, 0xffffff, 0.55);
    g.strokeCircle(c, c, 54);

    // Vier Segmente auf dem Ring - erzeugt beim Drehen einen Bewegungseindruck.
    g.lineStyle(7, 0xffffff, 0.9);
    for (let i = 0; i < 4; i++) {
      const start = (Math.PI / 2) * i;
      g.beginPath();
      g.arc(c, c, 54, start, start + 0.42, false);
      g.strokePath();
    }

    // Kleine Marker zwischen den Segmenten - feinere Ablesbarkeit der Drehung.
    g.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      g.fillCircle(c + Math.cos(angle) * 54, c + Math.sin(angle) * 54, 3.5);
    }
  });
}
