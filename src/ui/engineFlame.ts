import Phaser from 'phaser';
import { ENGINE_FLAME as F } from '@/config/engineFlame';
import { TextureKey } from './textures';
import { AtmosphereTexture, createAtmosphereTextures } from './worldAtmosphere';

const FLAME_KEY = 'engine-flame';
const DIAMOND_KEY = 'engine-diamond';

/**
 * Tropfenfoermige Flamme, weiss, Duese oben. Die Breite schrumpft zum Ende hin
 * und die Deckkraft faellt - so entsteht die Spitze ohne harte Kante.
 */
function createFlameTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FLAME_KEY)) {
    const width = 32;
    const height = 128;
    const texture = scene.textures.createCanvas(FLAME_KEY, width, height)!;
    const ctx = texture.getContext();
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const half = (width / 2) * Math.pow(1 - t, 0.55) * Math.min(1, 0.55 + t * 4);
      const alpha = Math.pow(1 - t, 0.8);
      const g = ctx.createLinearGradient(width / 2 - half, 0, width / 2 + half, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(width / 2 - half, y, half * 2, 1);
    }
    texture.refresh();
  }
  if (!scene.textures.exists(DIAMOND_KEY)) {
    const texture = scene.textures.createCanvas(DIAMOND_KEY, 16, 16)!;
    const ctx = texture.getContext();
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(13, 8);
    ctx.lineTo(8, 16);
    ctx.lineTo(3, 8);
    ctx.closePath();
    ctx.fill();
    texture.refresh();
  }
}

function mixWhite(color: number, share: number): number {
  const c = Phaser.Display.Color.IntegerToRGB(color);
  return Phaser.Display.Color.GetColor(
    Math.round(c.r + (255 - c.r) * share),
    Math.round(c.g + (255 - c.g) * share),
    Math.round(c.b + (255 - c.b) * share),
  );
}

const lerp = (range: { idle: number; full: number }, t: number): number =>
  range.idle + (range.full - range.idle) * t;

/**
 * Mehrschichtige Triebwerksflamme im Spieler-Container.
 *
 * Alle Teile sitzen an der Duese und drehen mit dem Rumpf. Das Flackern ist
 * eine Summe unharmonischer Sinuswellen statt Zufall: gleichmaessig ueber die
 * Zeit, ohne Ruckler bei schwankender Bildrate, und am `delta` getaktet.
 */
export class EngineFlame {
  /** In dieser Reihenfolge in den Container legen: hinten nach vorne. */
  readonly parts: Phaser.GameObjects.Image[];
  private readonly heat: Phaser.GameObjects.Image;
  private readonly outer: Phaser.GameObjects.Image;
  private readonly inner: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private readonly diamonds: Phaser.GameObjects.Image[] = [];
  private time = 0;
  private boost = 0;
  private lastThrust = 0;

  constructor(scene: Phaser.Scene) {
    createFlameTextures(scene);
    createAtmosphereTextures(scene);
    const additive = (img: Phaser.GameObjects.Image): Phaser.GameObjects.Image =>
      img.setBlendMode(Phaser.BlendModes.ADD);
    this.heat = additive(scene.add.image(0, 0, TextureKey.Glow));
    this.outer = additive(scene.add.image(0, 0, FLAME_KEY).setOrigin(0.5, 0.04));
    this.inner = additive(scene.add.image(0, 0, FLAME_KEY).setOrigin(0.5, 0.04));
    for (let i = 0; i < F.diamondCount; i++) {
      this.diamonds.push(additive(scene.add.image(0, 0, DIAMOND_KEY).setAlpha(0)));
    }
    this.core = additive(scene.add.image(0, 0, AtmosphereTexture.Soft).setTint(0xf8fdff));
    this.parts = [this.heat, this.outer, this.inner, ...this.diamonds, this.core];
    this.setColor(F.defaultColor);
  }

  setColor(color: number): void {
    this.heat.setTint(color);
    this.outer.setTint(color);
    this.inner.setTint(mixWhite(color, F.innerWhite));
    for (const diamond of this.diamonds) diamond.setTint(mixWhite(color, 0.8));
  }

  /**
   * @param thrust Schubanteil 0..1
   * @param still reduzierte Bewegung: ruhige Flamme ohne Flackern und Stoss
   * @param alpha Deckkraft des Rumpfs - die Flamme verschwindet mit ihm
   */
  update(
    deltaMs: number,
    x: number,
    y: number,
    rotation: number,
    scale: number,
    thrust: number,
    alpha: number,
    still: boolean,
  ): void {
    const dt = still ? 0 : Math.max(0, deltaMs) / 1000;
    this.time += dt;
    // Nachbrenner: ein Schubanstieg schiesst ueber und klingt dann ab.
    const rise = Math.max(0, thrust - this.lastThrust);
    this.lastThrust = thrust;
    if (!still) {
      this.boost = Math.min(
        F.boostMax,
        this.boost * Math.exp(-dt / F.boostDecay) + rise * F.boostGain,
      );
    }
    const t = this.time * F.flickerHz * Math.PI * 2;
    const wave = still
      ? 0
      : (Math.sin(t) * 0.5 + Math.sin(t * 1.73 + 1.1) * 0.3 + Math.sin(t * 3.1 + 2.3) * 0.2) *
        F.flicker;
    const stretch = (1 + wave + this.boost) * scale;
    const widen = (1 - wave * 0.5 + this.boost * 0.3) * scale;

    const place = (img: Phaser.GameObjects.Image): Phaser.GameObjects.Image =>
      img.setPosition(x, y).setRotation(rotation);

    const heatSize = lerp(F.heatSize, thrust) * (1 + this.boost * 0.5) * scale;
    place(this.heat)
      .setDisplaySize(heatSize, heatSize * 1.3)
      .setAlpha(alpha * lerp(F.heatAlpha, thrust));
    place(this.outer)
      .setDisplaySize(lerp(F.outerWidth, thrust) * widen, lerp(F.outerLength, thrust) * stretch)
      .setAlpha(alpha * (0.7 + thrust * 0.25));
    place(this.inner)
      .setDisplaySize(lerp(F.innerWidth, thrust) * widen, lerp(F.innerLength, thrust) * stretch)
      .setAlpha(alpha * 0.95);
    place(this.core)
      .setDisplaySize(F.coreSize * scale, F.coreSize * 1.3 * scale)
      .setAlpha(alpha);

    // Schockdiamanten: helle Knoten in der Aussenflamme, nur bei viel Schub.
    const diamondStrength = Phaser.Math.Clamp(
      (thrust - F.diamondThrust) / (1 - F.diamondThrust),
      0,
      1,
    );
    const length = lerp(F.outerLength, thrust) * stretch;
    const sin = Math.sin(rotation);
    const cos = Math.cos(rotation);
    for (const [i, diamond] of this.diamonds.entries()) {
      const along = length * (0.22 + i * 0.17) + (still ? 0 : Math.sin(t * 0.5 + i) * 2);
      const size = F.diamondSize * scale * (1 - i * 0.2);
      diamond
        .setPosition(x - sin * along, y + cos * along)
        .setRotation(rotation)
        .setDisplaySize(size, size * 1.4)
        .setAlpha(alpha * diamondStrength * (0.9 - i * 0.2));
    }
  }
}
