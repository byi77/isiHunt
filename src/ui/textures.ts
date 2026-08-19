/**
 * Prozedurale Grundtexturen und zentrale Asset-Keys.
 *
 * Spielobjekte wie Glow, Strahlen und Raumschiffe werden weiterhin aus
 * Phaser-Graphics gerendert. Die echten Planetensprites und das Logo werden
 * im BootScene geladen; die Auswahl bleibt ueber diese Keys zentral.
 */

import Phaser from 'phaser';

import { getShipShape } from '@/config/shop';

export const TextureKey = {
  Orb: 'tex-orb',
  Glow: 'tex-glow',
  Spark: 'tex-spark',
  Shard: 'tex-shard',
  Rays: 'tex-rays',
  Ring: 'tex-ring',
  Vignette: 'tex-vignette',
  PlayerCore: 'tex-player-core',
  PlayerCoreIon: 'tex-player-core-ion',
  PlayerCoreComet: 'tex-player-core-comet',
  PlayerCoreRanger: 'tex-player-core-ranger',
  PlayerCorePulse: 'tex-player-core-pulse',
  PlayerCoreNova: 'tex-player-core-nova',
  PlayerCoreCrown: 'tex-player-core-crown',
  PlayerHalo: 'tex-player-halo',
  Pixel: 'tex-pixel',
  Logo: 'asset-isihunt-logo',
  PlanetSternenweide: 'asset-planet-sternenweide',
  PlanetEisring: 'asset-planet-eisring',
  PlanetGlutnebel: 'asset-planet-glutnebel',
  PlanetNullsektor: 'asset-planet-nullsektor',
  PlanetSonnenkrone: 'asset-planet-sonnenkrone',
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
  createPlayerCore(scene, TextureKey.PlayerCore, 0);
  createPlayerCore(scene, TextureKey.PlayerCoreIon, 1);
  createPlayerCore(scene, TextureKey.PlayerCoreComet, 2);
  createPlayerCore(scene, TextureKey.PlayerCoreRanger, 3);
  createPlayerCore(scene, TextureKey.PlayerCorePulse, 4);
  createPlayerCore(scene, TextureKey.PlayerCoreNova, 5);
  createPlayerCore(scene, TextureKey.PlayerCoreCrown, 6);
  createPlayerHalo(scene);
}

/**
 * Liefert die Textur zur gewaehlten Schiffsform.
 *
 * Frueher hing die Form am Charakterlevel (`playerTextureForLevel`). Sie
 * gehoert jetzt in den Laden - die Begruendung steht in `config/shop.ts`.
 */
export function playerTextureForShape(shapeId: string): TextureKeyValue {
  const nachIndex: readonly TextureKeyValue[] = [
    TextureKey.PlayerCore,
    TextureKey.PlayerCoreIon,
    TextureKey.PlayerCoreComet,
    TextureKey.PlayerCoreRanger,
    TextureKey.PlayerCorePulse,
    TextureKey.PlayerCoreNova,
    TextureKey.PlayerCoreCrown,
  ];
  return nachIndex[getShipShape(shapeId).skinIndex] ?? TextureKey.PlayerCore;
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
/**
 * Zeichnet eine Schiffsform.
 *
 * **Warum jede Form eine eigene Silhouette hat.** Bis 2026-08-20 teilten sich
 * alle sieben Varianten denselben Rumpf; unterschieden wurden sie nur durch
 * kleine angesetzte Bauteile - ein Fluegelpaar, ein Ring, ein Kreis. Der
 * Gedanke dahinter war, dass die Figur in der Bewegung wiedererkennbar bleibt.
 * In der Praxis war der Unterschied unsichtbar: Die Figur ist im Spiel klein,
 * getintet und in Bewegung, und ein Spieler auf Stufe 51 berichtete, nie einen
 * Wechsel bemerkt zu haben. Ein Ring, der hinter dem weissen Rumpf
 * verschwindet, ist keine Belohnung.
 *
 * Jede Form hat deshalb jetzt einen eigenen Umriss. Gemeinsam bleibt nur, was
 * die Lesbarkeit braucht: Spitze nach oben, Triebwerke unten, Breite rund 80
 * von 96 Pixeln.
 */
function createPlayerCore(scene: Phaser.Scene, key: string, skin: number): void {
  const size = 96;

  withGraphics(scene, key, size, size, (g) => {
    const c = size / 2;
    const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

    /** Zwei Lichtduesen am Heck - das einzige Bauteil, das jede Form teilt. */
    const triebwerke = (linkeX: number, rechteX: number, oben: number, unten: number) => {
      g.fillStyle(0xffffff, 0.8);
      g.fillTriangle(linkeX - 4, oben, linkeX + 4, oben, linkeX, unten);
      g.fillTriangle(rechteX - 4, oben, rechteX + 4, oben, rechteX, unten);
    };

    g.fillStyle(0xffffff, 1);

    if (skin === 0) {
      // PFEIL - der Klassiker: schlank, klare Spitze, gekerbtes Heck.
      g.fillPoints(
        [v(c, 8), v(64, 38), v(84, 78), v(60, 70), v(c, 88), v(36, 70), v(12, 78), v(32, 38)],
        true,
      );
      g.fillStyle(0xffffff, 0.62);
      g.fillTriangle(c, 18, 55, 48, 41, 48);
      triebwerke(35, 61, 76, 91);
      return;
    }

    if (skin === 1) {
      // DELTA - breites Dreieck ohne Einbuchtung, satter Flaeche.
      g.fillPoints([v(c, 6), v(88, 82), v(c, 66), v(8, 82)], true);
      g.fillStyle(0xffffff, 0.5);
      g.fillTriangle(c, 20, 66, 74, 30, 74);
      triebwerke(38, 58, 66, 84);
      return;
    }

    if (skin === 2) {
      // SICHEL - zwei weit ausgestellte Fluegel, schmaler Mittelrumpf.
      g.fillPoints(
        [v(c, 10), v(56, 44), v(92, 84), v(58, 72), v(c, 80), v(38, 72), v(4, 84), v(40, 44)],
        true,
      );
      g.fillStyle(0xffffff, 0.55);
      g.fillEllipse(c, 40, 18, 34);
      triebwerke(40, 56, 72, 90);
      return;
    }

    if (skin === 3) {
      // RING - Rumpf mit offenem Kreis, der ueber die Silhouette hinausragt.
      g.fillPoints([v(c, 14), v(60, 46), v(60, 76), v(36, 76), v(36, 46)], true);
      g.lineStyle(5, 0xffffff, 0.9);
      g.strokeCircle(c, 46, 30);
      g.fillStyle(0xffffff, 0.6);
      g.fillTriangle(c, 20, 54, 42, 42, 42);
      triebwerke(41, 55, 74, 92);
      return;
    }

    if (skin === 4) {
      // DOPPELRUMPF - zwei getrennte Haelften, durch eine Bruecke verbunden.
      g.fillPoints([v(30, 12), v(44, 44), v(44, 80), v(16, 80), v(16, 44)], true);
      g.fillPoints([v(66, 12), v(80, 44), v(80, 80), v(52, 80), v(52, 44)], true);
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(38, 48, 20, 12);
      triebwerke(30, 66, 78, 92);
      return;
    }

    if (skin === 5) {
      // STERN - sechs Zacken, radialsymmetrisch statt gerichtet.
      const zacken: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 12; i++) {
        const winkel = (Math.PI * 2 * i) / 12 - Math.PI / 2;
        const radius = i % 2 === 0 ? 42 : 17;
        zacken.push(v(c + Math.cos(winkel) * radius, c + Math.sin(winkel) * radius));
      }
      g.fillPoints(zacken, true);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(c, c, 12);
      return;
    }

    // KRONE - breite Basis mit drei Zinnen, die einzige Form mit flachem Kopf.
    g.fillPoints(
      [
        v(20, 34),
        v(30, 12),
        v(40, 34),
        v(c, 6),
        v(56, 34),
        v(66, 12),
        v(76, 34),
        v(82, 80),
        v(14, 80),
      ],
      true,
    );
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(28, 50, 40, 16);
    triebwerke(32, 64, 78, 92);
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
