/**
 * Prozedurale Grundtexturen und zentrale Asset-Keys.
 *
 * Spielobjekte wie Glow, Strahlen und Raumschiffe werden weiterhin aus
 * Phaser-Graphics gerendert. Die echten Planetensprites und das Logo werden
 * im BootScene geladen; die Auswahl bleibt ueber diese Keys zentral.
 */

import Phaser from 'phaser';

import { getShipShape } from '@/config/shop';
import { EGO_ASSET_KEY, textureKeyForEgoShape } from '@/ui/egoAssets';
import { SHIP_DRAWINGS, SHIP_TEXTURE_SIZE } from '@/ui/shipShapes';

export const TextureKey = {
  Orb: 'tex-orb',
  Glow: 'tex-glow',
  Spark: 'tex-spark',
  Shard: 'tex-shard',
  Rays: 'tex-rays',
  Ring: 'tex-ring',
  Vignette: 'tex-vignette',
  /** Grundfigur - Rueckfall, wenn eine Form fehlt. */
  PlayerCore: 'tex-player-core',
  PlayerHalo: 'tex-player-halo',
  Pixel: 'tex-pixel',
  Logo: 'asset-isihunt-logo',
  PlanetSternenweide: 'asset-planet-sternenweide',
  PlanetEisring: 'asset-planet-eisring',
  PlanetGlutnebel: 'asset-planet-glutnebel',
  PlanetNullsektor: 'asset-planet-nullsektor',
  PlanetSonnenkrone: 'asset-planet-sonnenkrone',
  EgoCc0Scout: EGO_ASSET_KEY.cc0Scout,
  EgoCc0AuraFlame01: EGO_ASSET_KEY.cc0Flame[0],
  EgoCc0AuraFlame02: EGO_ASSET_KEY.cc0Flame[1],
  EgoCc0AuraFlame03: EGO_ASSET_KEY.cc0Flame[2],
  EgoCc0AuraFlame04: EGO_ASSET_KEY.cc0Flame[3],
  EgoCc0AuraFlame05: EGO_ASSET_KEY.cc0Flame[4],
  EgoCc0AuraFlame06: EGO_ASSET_KEY.cc0Flame[5],
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
  createShipTextures(scene);
  createPlayerHalo(scene);
}

/**
 * Texturschluessel einer Fluggestalt.
 *
 * Aus dem Index erzeugt statt einzeln aufgelistet: Bei dreissig und mehr
 * Formen waere eine Handliste eine Fehlerquelle ohne Nutzen.
 */
export function shipTextureKey(skinIndex: number): string {
  return `tex-ship-${skinIndex}`;
}

/** Legt fuer jede Zeichnung in `SHIP_DRAWINGS` eine Textur an. */
function createShipTextures(scene: Phaser.Scene): void {
  SHIP_DRAWINGS.forEach((zeichnen, index) => {
    withGraphics(scene, shipTextureKey(index), SHIP_TEXTURE_SIZE, SHIP_TEXTURE_SIZE, zeichnen);
  });
  // Rueckfall unter dem alten Namen - `TextureKey.PlayerCore` wird an einigen
  // Stellen direkt verwendet.
  withGraphics(scene, TextureKey.PlayerCore, SHIP_TEXTURE_SIZE, SHIP_TEXTURE_SIZE, (g) =>
    SHIP_DRAWINGS[0]?.(g),
  );
}

/**
 * Liefert die Textur zur gewaehlten Schiffsform.
 *
 * Frueher hing die Form am Charakterlevel (`playerTextureForLevel`). Sie
 * gehoert jetzt in den Laden - die Begruendung steht in `config/shop.ts`.
 */
export function playerTextureForShape(shapeId: string): TextureKeyValue {
  return (textureKeyForEgoShape(shapeId) ??
    shipTextureKey(getShipShape(shapeId).skinIndex)) as TextureKeyValue;
}

/** Liefert die echte Planetentextur fuer eine Raumzonen-Komposition. */
export function planetTextureForVariant(spaceVariant: number): TextureKeyValue {
  const planets: readonly TextureKeyValue[] = [
    TextureKey.PlanetSternenweide,
    TextureKey.PlanetEisring,
    TextureKey.PlanetGlutnebel,
    TextureKey.PlanetNullsektor,
    TextureKey.PlanetSonnenkrone,
  ];
  return planets[spaceVariant % planets.length] ?? TextureKey.PlanetSternenweide;
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

/** Planet als einsammelbares Relikt: Kontinente, Atmosphaerenrand und Orbit. */
function createOrb(scene: Phaser.Scene): void {
  const size = 64;
  const c = size / 2;

  withGraphics(scene, TextureKey.Orb, size, size, (g) => {
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(c, c, 31);
    g.fillStyle(0xffffff, 0.78);
    g.fillCircle(c, c, 26);

    // Abstrakte Kontinente bleiben tintbar und machen die Rotation lesbar.
    const continents: Phaser.Math.Vector2[][] = [
      [
        new Phaser.Math.Vector2(24, 20),
        new Phaser.Math.Vector2(34, 17),
        new Phaser.Math.Vector2(39, 25),
        new Phaser.Math.Vector2(31, 30),
        new Phaser.Math.Vector2(22, 27),
      ],
      [
        new Phaser.Math.Vector2(42, 36),
        new Phaser.Math.Vector2(50, 33),
        new Phaser.Math.Vector2(54, 43),
        new Phaser.Math.Vector2(45, 49),
        new Phaser.Math.Vector2(39, 44),
      ],
      [
        new Phaser.Math.Vector2(17, 40),
        new Phaser.Math.Vector2(27, 38),
        new Phaser.Math.Vector2(31, 48),
        new Phaser.Math.Vector2(22, 53),
        new Phaser.Math.Vector2(16, 49),
      ],
    ];

    g.fillStyle(0xffffff, 0.35);
    for (const continent of continents) g.fillPoints(continent, true);

    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(c - 8, c - 9, 4.5);
    g.lineStyle(2.5, 0xffffff, 0.95);
    g.strokeCircle(c, c, 27.5);
    g.lineStyle(1.5, 0xffffff, 0.55);
    g.strokeEllipse(c, c, 61, 19);
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

/** Die Spielfigur: ein kleines, nach oben ausgerichtetes Licht-Raumschiff. */

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
