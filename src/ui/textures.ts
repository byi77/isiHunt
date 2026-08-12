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

/** Der Relikt-Koerper: heller Kern mit abgesetztem Ring. */
function createOrb(scene: Phaser.Scene): void {
  const size = 64;
  const c = size / 2;

  withGraphics(scene, TextureKey.Orb, size, size, (g) => {
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(c, c, 31);

    g.fillStyle(0xffffff, 1);
    g.fillCircle(c, c, 24);

    // Glanzpunkt oben links - gibt der flachen Scheibe Volumen.
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(c - 7, c - 8, 6);

    g.lineStyle(2.5, 0xffffff, 0.85);
    g.strokeCircle(c, c, 30);
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

/** Kleines Partikel fuer Einsammel-Explosionen und Schwebestaub. */
function createSpark(scene: Phaser.Scene): void {
  withGraphics(scene, TextureKey.Spark, 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
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

    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(c, c, 13);
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
  });
}
