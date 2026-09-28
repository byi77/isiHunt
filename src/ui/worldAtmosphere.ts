import Phaser from 'phaser';
import {
  ATMOSPHERE_TIMING as T,
  worldAtmosphere,
  type AtmosphereMotif,
  type WorldAtmosphereDef,
} from '@/config/worldAtmosphere';
import type { WorldDef } from '@/config/worlds';
import { TextureKey } from './textures';

/**
 * Bewegte Weltstimmung hinter dem Spielfeld.
 *
 * Jede Welt bekommt ein eigenes Motiv (Pollen, Schnee, Glut, Riss, Krone,
 * Monde, Splitter, Sturm, Lichtwellen, Sprung). Alle Texturen entstehen einmal
 * je Sitzung auf einem Canvas und sind weiss - gefaerbt wird per Tint, wie
 * beim Rest des Spiels. Pro Frame werden nur Positionen, Drehung und Deckkraft
 * vorhandener Bilder gesetzt; nur der Sturm zeichnet bei einem Blitz neu.
 *
 * Die Bewegung haengt allein am uebergebenen `delta`, damit `--sim` und
 * reduzierte Bewegung dieselbe Szene ohne Sonderweg bedienen.
 */

export const AtmosphereTexture = {
  Soft: 'atmo-soft',
  Flake: 'atmo-flake',
  Streak: 'atmo-streak',
  Ribbon: 'atmo-ribbon',
  Aurora: 'atmo-aurora',
  Corona: 'atmo-corona',
  SoftRing: 'atmo-soft-ring',
  Gate: 'atmo-gate',
  Rift: 'atmo-rift',
  Moon: 'atmo-moon',
  Rock: 'atmo-rock',
  Diamond: 'atmo-diamond',
} as const;
const Key = AtmosphereTexture;

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  phase: number;
  size: number;
  spin: number;
  /** Wartezeit vor dem naechsten Auftritt - haelt schnelle Motive licht. */
  wait: number;
}

/** Reproduzierbarer Zufall, damit jede Welt bei jedem Start gleich beginnt. */
function seeded(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, width, height)!;
  draw(texture.getContext());
  texture.refresh();
  return key;
}

/** Blendet die Enden einer Textur weich aus, damit keine Kante im Bild steht. */
function fadeEdges(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const fade = ctx.createLinearGradient(0, 0, width, 0);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(0.2, 'rgba(255,255,255,1)');
  fade.addColorStop(0.8, 'rgba(255,255,255,1)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

/** Legt alle Kulissen-Texturen an; mehrfacher Aufruf ist billig. */
export function createAtmosphereTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, Key.Soft, 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });

  canvasTexture(scene, Key.Flake, 32, 32, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.translate(16, 16);
    for (let arm = 0; arm < 6; arm++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -13);
      ctx.moveTo(0, -7);
      ctx.lineTo(-4, -11);
      ctx.moveTo(0, -7);
      ctx.lineTo(4, -11);
      ctx.stroke();
      ctx.rotate(Math.PI / 3);
    }
  });

  // Kopf rechts: Nach der Flugrichtung gedreht fuehrt die helle Spitze.
  canvasTexture(scene, Key.Streak, 128, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 1, 128, 6);
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 3, 128, 2);
  });

  canvasTexture(scene, Key.Ribbon, 256, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 64);
    fadeEdges(ctx, 256, 64);
  });

  // Vorhang aus senkrechten Lichtfaeden entlang einer Wellenlinie.
  canvasTexture(scene, Key.Aurora, 256, 128, (ctx) => {
    for (let x = 0; x < 256; x++) {
      const t = (x / 256) * Math.PI * 2;
      const base = 96 + Math.sin(t * 2) * 14 + Math.sin(t * 5 + 1) * 6;
      const length = 46 + Math.sin(t * 3 + 0.5) * 22;
      const strength = 0.35 + 0.65 * Math.pow(Math.sin(x * 0.11) * 0.5 + 0.5, 2);
      const g = ctx.createLinearGradient(0, base - length, 0, base + 4);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.85, `rgba(255,255,255,${strength * 0.8})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, base - length, 1, length + 4);
    }
    fadeEdges(ctx, 256, 128);
  });

  canvasTexture(scene, Key.Corona, 512, 512, (ctx) => {
    const rand = seeded(41);
    ctx.translate(256, 256);
    for (let ray = 0; ray < 22; ray++) {
      const angle = (ray / 22) * Math.PI * 2 + rand() * 0.1;
      const half = 0.03 + rand() * 0.05;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 256, angle - half, angle + half);
      ctx.closePath();
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fall = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    fall.addColorStop(0, 'rgba(255,255,255,1)');
    fall.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    fall.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fall;
    ctx.fillRect(0, 0, 512, 512);
  });

  canvasTexture(scene, Key.SoftRing, 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.78, 'rgba(255,255,255,0)');
    g.addColorStop(0.92, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });

  canvasTexture(scene, Key.Gate, 512, 512, (ctx) => {
    ctx.translate(256, 256);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 236, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.setLineDash([22, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, 212, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let tick = 0; tick < 48; tick++) {
      const angle = (tick / 48) * Math.PI * 2;
      const inner = tick % 4 === 0 ? 244 : 240;
      ctx.lineWidth = tick % 4 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * 254, Math.sin(angle) * 254);
      ctx.stroke();
    }
    ctx.lineWidth = 8;
    for (let arc = 0; arc < 3; arc++) {
      const start = (arc / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, 186, start, start + 0.9);
      ctx.stroke();
    }
  });

  canvasTexture(scene, Key.Rift, 128, 512, (ctx) => {
    const rand = seeded(7);
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(64, 24);
    for (let y = 24; y <= 488; y += 26) {
      const spread = Math.sin((y / 512) * Math.PI) * 26;
      ctx.lineTo(64 + (rand() - 0.5) * spread * 2, y);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Licht von links oben; die Kugel bleibt weiss, damit der Tint die Farbe gibt.
  canvasTexture(scene, Key.Moon, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(22, 20, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0.18)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (const [cx, cy, r] of [
      [40, 24, 6],
      [24, 40, 4],
      [42, 44, 3],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Schlanker Splitter, Spitze nach rechts - wie Streak nach der Richtung gedreht.
  canvasTexture(scene, Key.Diamond, 40, 14, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 40, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(24, 1);
    ctx.lineTo(40, 7);
    ctx.lineTo(24, 13);
    ctx.closePath();
    ctx.fill();
  });

  canvasTexture(scene, Key.Rock, 24, 24, (ctx) => {
    const rand = seeded(19);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let corner = 0; corner < 7; corner++) {
      const angle = (corner / 7) * Math.PI * 2;
      const radius = 7 + rand() * 4;
      const x = 12 + Math.cos(angle) * radius;
      const y = 12 + Math.sin(angle) * radius;
      if (corner === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });
}

const MOTE_TEXTURE: Record<AtmosphereMotif, string> = {
  pollen: Key.Soft,
  snow: Key.Flake,
  embers: Key.Soft,
  void: Key.Soft,
  corona: Key.Soft,
  orbits: Key.Rock,
  shards: Key.Streak,
  storm: Key.Streak,
  pulse: Key.Soft,
  warp: Key.Streak,
};

/** Weiche Ein- und Ausblendung ueber die Lebenszeit, 0 bis 1. */
function envelope(age: number, life: number): number {
  return Math.sin(Math.PI * Phaser.Math.Clamp(age / life, 0, 1));
}

export class WorldAtmosphere {
  /** Flaechen hinter dem Kulissenplaneten. */
  readonly back: Phaser.GameObjects.Container;
  /** Teilchen vor dem Kulissenplaneten, weiterhin hinter allen Spielobjekten. */
  readonly front: Phaser.GameObjects.Container;
  private readonly def: WorldAtmosphereDef;
  private readonly rand: () => number;
  private readonly motes: Mote[] = [];
  /** Langsame Flaechen, die atmen oder sich drehen. */
  private readonly layers: {
    img: Phaser.GameObjects.Image;
    alpha: number;
    spin: number;
    driftX: number;
    baseX: number;
    phase: number;
  }[] = [];
  private readonly rings: { img: Phaser.GameObjects.Image; age: number }[] = [];
  private readonly blinkers: { img: Phaser.GameObjects.Image; offset: number }[] = [];
  private bolt?: Phaser.GameObjects.Graphics;
  private flash?: Phaser.GameObjects.Rectangle;
  private glint?: Phaser.GameObjects.Image;
  private elapsed = 0;
  private nextEvent = 0;
  private eventAge = Number.POSITIVE_INFINITY;
  private readonly focusX: number;
  private readonly focusY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
    world: WorldDef,
  ) {
    createAtmosphereTextures(scene);
    this.def = worldAtmosphere(world.spaceVariant);
    this.rand = seeded(world.spaceVariant + 1);
    this.back = scene.add.container(0, 0).setName('world-atmosphere-back');
    this.front = scene.add.container(0, 0).setName('world-atmosphere-front');
    // Fluchtpunkt bzw. Zentrum der Motive: stets abseits der Spielfeldmitte.
    const planetRight = world.spaceVariant % 2 === 0;
    const focus: Record<AtmosphereMotif, [number, number]> = {
      pollen: [0.5, 0.5],
      snow: [0.5, 0.5],
      embers: [0.5, 1],
      void: [planetRight ? 0.12 : 0.88, 0.26],
      corona: [0.5, -0.1],
      orbits: [planetRight ? 0.97 : 0.03, 0.73],
      shards: [0.5, 0.5],
      storm: [0.5, 0.5],
      pulse: [0.5, 1.08],
      warp: [0.5, 0.2],
    };
    const [fx, fy] = focus[this.def.motif];
    this.focusX = width * fx;
    this.focusY = height * fy;
    this.buildLayers();
    const count = Math.min(this.def.particles, T.maxParticles);
    for (let i = 0; i < count; i++) this.addMote(i, count);
    this.nextEvent = this.eventDelay();
    this.update(0);
  }

  private addLayer(
    key: string,
    x: number,
    y: number,
    displayWidth: number,
    displayHeight: number,
    tint: number,
    alpha: number,
    options: { spin?: number; driftX?: number; blend?: boolean; front?: boolean } = {},
  ): Phaser.GameObjects.Image {
    const img = this.scene.add
      .image(x, y, key)
      .setDisplaySize(displayWidth, displayHeight)
      .setTint(tint)
      .setAlpha(alpha);
    if (options.blend !== false) img.setBlendMode(Phaser.BlendModes.ADD);
    (options.front ? this.front : this.back).add(img);
    this.layers.push({
      img,
      alpha,
      spin: options.spin ?? 0,
      driftX: options.driftX ?? 0,
      baseX: x,
      phase: this.rand() * Math.PI * 2,
    });
    return img;
  }

  private buildLayers(): void {
    const { width: w, height: h, def } = this;
    switch (def.motif) {
      case 'pollen':
        this.addLayer(Key.Aurora, w * 0.5, h * 0.16, w * 1.7, h * 0.3, def.primary, 0.3, {
          driftX: w * 0.12,
        });
        this.addLayer(Key.Aurora, w * 0.5, h * 0.3, w * 1.5, h * 0.22, 0x5eead4, 0.18, {
          driftX: -w * 0.1,
        }).setFlipX(true);
        break;
      case 'snow':
        this.addLayer(Key.Ribbon, w * 0.5, h * 0.12, w * 1.6, h * 0.18, def.secondary, 0.14, {
          driftX: w * 0.06,
        });
        this.glint = this.scene.add
          .image(0, 0, TextureKey.Shard)
          .setTint(0xffffff)
          .setAlpha(0)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.front.add(this.glint);
        break;
      case 'embers':
        for (let band = 0; band < 3; band++) {
          this.addLayer(
            Key.Ribbon,
            w * 0.5,
            h * (0.55 + band * 0.18),
            w * 1.8,
            h * 0.14,
            band === 1 ? 0xdc2626 : def.primary,
            0.12,
            { driftX: w * (band % 2 === 0 ? 0.08 : -0.08) },
          );
        }
        break;
      case 'void': {
        const riftX = this.focusX;
        this.addLayer(Key.Rift, riftX, h * 0.3, w * 0.34, h * 0.5, def.secondary, 0.85, {
          blend: false,
        });
        this.addLayer(Key.Rift, riftX, h * 0.3, w * 0.2, h * 0.5, def.primary, 0.55);
        for (let i = 0; i < 9; i++) {
          const star = this.scene.add
            .image(this.rand() * w, this.rand() * h, Key.Soft)
            .setScale(0.35 + this.rand() * 0.25)
            .setTint(0xf5f3ff)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.back.add(star);
          this.blinkers.push({ img: star, offset: this.rand() * T.voidBlinkMs * 4 });
        }
        break;
      }
      case 'corona':
        this.addLayer(Key.Corona, this.focusX, this.focusY, w * 1.9, w * 1.9, def.primary, 0.24, {
          spin: T.spinPerSecond,
        });
        this.addLayer(Key.Corona, this.focusX, this.focusY, w * 1.4, w * 1.4, def.secondary, 0.2, {
          spin: -T.spinPerSecond * 1.6,
        });
        this.addLayer(
          TextureKey.Glow,
          this.focusX,
          this.focusY,
          w * 1.2,
          w * 0.9,
          def.primary,
          0.9,
        );
        break;
      case 'orbits':
        // Die Umlaufbahnen selbst als feine Ellipsen - Massstab fuer die Monde.
        {
          const paths = this.scene.add.graphics();
          paths.lineStyle(1.5, def.primary, 0.12);
          for (let orbit = 0; orbit < 3; orbit++) {
            paths.strokeEllipse(
              this.focusX,
              this.focusY,
              w * (0.7 + orbit * 0.3),
              h * (0.1 + orbit * 0.05),
            );
          }
          this.back.add(paths);
        }
        break;
      case 'shards':
        this.addLayer(Key.Ribbon, w * 0.5, h * 0.2, w * 1.6, h * 0.08, def.secondary, 0.1, {
          driftX: w * 0.05,
        }).setRotation(-0.5);
        this.addLayer(Key.Ribbon, w * 0.5, h * 0.8, w * 1.6, h * 0.08, def.primary, 0.12, {
          driftX: -w * 0.05,
        }).setRotation(-0.5);
        break;
      case 'storm':
        this.addLayer(Key.Ribbon, w * 0.5, h * 0.08, w * 2, h * 0.2, 0x581c87, 0.5, {
          driftX: w * 0.15,
          blend: false,
        });
        this.addLayer(Key.Ribbon, w * 0.5, h * 0.94, w * 2, h * 0.16, 0x3b0764, 0.45, {
          driftX: -w * 0.12,
          blend: false,
        });
        this.bolt = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        this.flash = this.scene.add
          .rectangle(0, 0, w, h, def.primary, 1)
          .setOrigin(0)
          .setAlpha(0)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.back.add([this.flash, this.bolt]);
        break;
      case 'pulse':
        this.addLayer(
          TextureKey.Glow,
          this.focusX,
          this.focusY,
          w * 1.6,
          h * 0.5,
          def.primary,
          0.9,
        );
        for (let i = 0; i < 3; i++) {
          const ring = this.scene.add
            .image(this.focusX, this.focusY, Key.SoftRing)
            .setTint(def.primary)
            .setAlpha(0)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.back.add(ring);
          this.rings.push({ img: ring, age: (i * T.pulseMs) % (T.pulseMs * 3) });
        }
        break;
      case 'warp':
        this.addLayer(Key.Gate, this.focusX, this.focusY, w * 0.92, w * 0.92, def.primary, 0.13, {
          spin: T.spinPerSecond,
        });
        this.addLayer(Key.Gate, this.focusX, this.focusY, w * 0.6, w * 0.6, def.secondary, 0.09, {
          spin: -T.spinPerSecond * 2,
        });
        this.addLayer(
          TextureKey.Glow,
          this.focusX,
          this.focusY,
          w * 0.7,
          w * 0.7,
          def.secondary,
          0.5,
        );
        break;
    }
  }

  private addMote(index: number, count: number): void {
    const img = this.scene.add.image(0, 0, MOTE_TEXTURE[this.def.motif]);
    const additive = this.def.motif !== 'orbits';
    if (additive) img.setBlendMode(Phaser.BlendModes.ADD);
    this.front.add(img);
    const mote: Mote = {
      img,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      phase: this.rand() * Math.PI * 2,
      size: 1,
      spin: 0,
      wait: 0,
    };
    this.motes.push(mote);
    if (this.def.motif === 'orbits' && index < 3) {
      img.setTexture(Key.Moon);
      mote.size = 0.9 - index * 0.25;
      mote.phase = (index / 3) * Math.PI * 2;
      mote.spin = index;
      return;
    }
    this.spawn(mote, true);
    // Verteilt die Startzeiten, sonst tauchen alle Teilchen im Gleichtakt auf.
    mote.age = (index / count) * mote.life;
  }

  private tint(mote: Mote, share: number): void {
    mote.img.setTint(this.rand() < share ? this.def.secondary : this.def.primary);
  }

  private spawn(mote: Mote, initial: boolean): void {
    const { width: w, height: h, def, rand } = this;
    const speed = def.speed * (0.6 + rand() * 0.8);
    mote.age = 0;
    mote.wait = 0;
    switch (def.motif) {
      case 'pollen':
        mote.x = rand() * w;
        mote.y = initial ? rand() * h : h + 20;
        mote.vx = 0;
        mote.vy = -speed;
        mote.life = (h + 40) / speed;
        mote.size = 0.25 + rand() * 0.4;
        this.tint(mote, 0.3);
        break;
      case 'snow': {
        const depth = rand();
        mote.x = rand() * w;
        mote.y = initial ? rand() * h : -20;
        mote.vx = 8;
        mote.vy = def.speed * (0.5 + depth);
        mote.life = (h + 40) / mote.vy;
        mote.size = 0.35 + depth * 0.55;
        mote.spin = (rand() - 0.5) * 1.2;
        this.tint(mote, 0.35);
        break;
      }
      case 'embers':
        mote.x = rand() * w;
        mote.y = initial ? rand() * h : h + 10;
        mote.vx = (rand() - 0.5) * 20;
        mote.vy = -speed;
        mote.life = (h * (0.5 + rand() * 0.6)) / speed;
        mote.size = 0.22 + rand() * 0.3;
        this.tint(mote, 0.4);
        break;
      case 'void': {
        // Polarkoordinaten um den Riss: x = Winkel, y = Abstand.
        mote.x = rand() * Math.PI * 2;
        mote.y = h * (0.2 + rand() * 0.35);
        mote.vy = -speed;
        mote.life = mote.y / speed;
        mote.size = 0.32 + rand() * 0.3;
        this.tint(mote, 0);
        break;
      }
      case 'corona':
        mote.x = rand() * w;
        mote.y = initial ? rand() * h : -10;
        mote.vx = 0;
        mote.vy = speed;
        mote.life = (h + 20) / speed;
        mote.size = 0.18 + rand() * 0.28;
        this.tint(mote, 0.5);
        break;
      case 'orbits': {
        const fromLeft = rand() < 0.5;
        mote.x = fromLeft ? -20 : w + 20;
        mote.y = h * (0.1 + rand() * 0.8);
        mote.vx = (fromLeft ? 1 : -1) * speed;
        mote.vy = (rand() - 0.5) * speed;
        mote.life = (w + 60) / speed;
        mote.size = 0.3 + rand() * 0.5;
        mote.spin = (rand() - 0.5) * 1.6;
        mote.img.setTint(rand() < 0.5 ? def.secondary : def.primary);
        if (initial) {
          mote.x = rand() * w;
        }
        break;
      }
      case 'shards': {
        const angle = Math.PI * 0.2 + rand() * 0.25;
        mote.vx = Math.cos(angle) * speed;
        mote.vy = Math.sin(angle) * speed;
        mote.x = -80 + rand() * w * 0.6 - w * 0.3;
        mote.y = -80 - rand() * h * 0.3;
        mote.life = (h * 1.6) / speed;
        mote.wait = initial ? 0 : rand() * 2.6;
        mote.size = 0.8 + rand() * 1.4;
        this.tint(mote, 0.3);
        break;
      }
      case 'storm': {
        mote.vx = speed;
        mote.vy = speed * 0.12;
        mote.x = -140;
        mote.y = rand() * h;
        mote.life = (w + 280) / speed;
        mote.wait = initial ? rand() * 2 : rand() * 1.2;
        mote.size = 1 + rand() * 1.6;
        this.tint(mote, 0.5);
        break;
      }
      case 'pulse': {
        // Staub stroemt vom Rand zum Kern und beschleunigt dabei.
        const side = rand();
        mote.x = side < 0.5 ? (side < 0.25 ? -10 : w + 10) : rand() * w;
        mote.y = side < 0.5 ? rand() * h * 0.8 : -10;
        mote.life = 3 + rand() * 3;
        mote.size = 0.24 + rand() * 0.26;
        this.tint(mote, 0.5);
        break;
      }
      case 'warp':
        mote.x = rand() * Math.PI * 2;
        mote.y = w * (0.12 + rand() * 0.1);
        mote.vy = speed;
        mote.life = 4;
        mote.size = 0.4 + rand() * 0.6;
        this.tint(mote, 0.4);
        if (initial) mote.y += rand() * h * 0.6;
        break;
    }
  }

  private eventDelay(): number {
    const jitter = this.rand();
    switch (this.def.motif) {
      case 'storm':
        return T.lightningMinMs + jitter * T.lightningJitterMs;
      case 'snow':
        return T.glintMs * (0.6 + jitter * 0.8);
      default:
        return Number.POSITIVE_INFINITY;
    }
  }

  update(delta: number): void {
    const dt = delta / 1000;
    this.elapsed += delta;
    const breath = (this.elapsed / T.breathMs) * Math.PI * 2;
    for (const layer of this.layers) {
      layer.img.setAlpha(layer.alpha * (0.72 + 0.28 * Math.sin(breath + layer.phase)));
      if (layer.spin) layer.img.rotation += layer.spin * dt;
      if (layer.driftX)
        layer.img.x = layer.baseX + Math.sin(breath * 0.5 + layer.phase) * layer.driftX;
    }
    for (const mote of this.motes) this.step(mote, dt);
    this.stepRings(delta);
    this.stepBlinkers();
    this.stepEvent(delta);
  }

  private step(mote: Mote, dt: number): void {
    const { def, width: w, height: h } = this;
    if (mote.wait > 0) {
      mote.wait -= dt;
      mote.img.setAlpha(0);
      return;
    }
    mote.age += dt;
    const fade = envelope(mote.age, mote.life);
    const img = mote.img;
    switch (def.motif) {
      case 'pollen':
      case 'corona': {
        mote.y += mote.vy * dt;
        const sway = Math.sin(mote.age * 0.9 + mote.phase) * 14;
        img.setPosition(mote.x + sway, mote.y).setScale(mote.size);
        const twinkle = 0.7 + 0.3 * Math.sin(mote.age * 3 + mote.phase);
        img.setAlpha(def.alpha * fade * twinkle);
        break;
      }
      case 'snow':
        mote.x += (mote.vx + Math.sin(mote.age * 1.3 + mote.phase) * 16) * dt;
        mote.y += mote.vy * dt;
        img.setPosition(mote.x, mote.y).setScale(mote.size);
        img.rotation += mote.spin * dt;
        img.setAlpha(def.alpha * Math.min(1, fade * 3) * (0.5 + mote.size * 0.5));
        break;
      case 'embers': {
        mote.x += (mote.vx + Math.sin(mote.age * 2.2 + mote.phase) * 26) * dt;
        mote.y += mote.vy * dt;
        img.setPosition(mote.x, mote.y).setScale(mote.size * (0.7 + fade * 0.5));
        const flicker = 0.55 + 0.45 * Math.sin(mote.age * 14 + mote.phase * 3);
        img.setAlpha(def.alpha * fade * flicker);
        break;
      }
      case 'void': {
        // Je naeher am Riss, desto schneller die Drehung - wie in einem Strudel.
        mote.y += mote.vy * dt * (1 + (h * 0.1) / Math.max(mote.y, 10));
        mote.x += dt * (60 / Math.max(mote.y, 20));
        img.setPosition(
          this.focusX + Math.cos(mote.x) * mote.y * 0.8,
          this.focusY + Math.sin(mote.x) * mote.y,
        );
        img.setScale(mote.size * Math.min(1, mote.y / (h * 0.1)));
        img.setAlpha(def.alpha * fade);
        if (mote.y < 6) mote.age = mote.life;
        break;
      }
      case 'orbits':
        if (mote.img.texture.key === Key.Moon) {
          this.stepMoon(mote, dt);
          return;
        }
        // Truemmer werden von der Schmiede angezogen und biegen ab.
        mote.vy += ((this.focusY - mote.y) / h) * 14 * dt;
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        img.setPosition(mote.x, mote.y).setScale(mote.size);
        img.rotation += mote.spin * dt;
        img.setAlpha(def.alpha * 0.6 * Math.min(1, fade * 4));
        break;
      case 'shards':
      case 'storm':
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        img
          .setPosition(mote.x, mote.y)
          .setRotation(Math.atan2(mote.vy, mote.vx))
          .setScale(mote.size, def.motif === 'shards' ? 0.7 : 0.5);
        img.setAlpha(def.alpha * Math.min(1, fade * 3));
        break;
      case 'pulse': {
        const dx = this.focusX - mote.x;
        const dy = this.focusY - mote.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const pull = def.speed * (0.4 + mote.age / mote.life);
        mote.x += (dx / distance) * pull * dt;
        mote.y += (dy / distance) * pull * dt;
        img.setPosition(mote.x, mote.y).setScale(mote.size);
        img.setAlpha(def.alpha * fade);
        break;
      }
      case 'warp': {
        // Streifen werden nach aussen schneller und laenger - Sprung durchs Tor.
        mote.y += mote.vy * dt * (0.3 + mote.y / (w * 0.35));
        const x = this.focusX + Math.cos(mote.x) * mote.y;
        const y = this.focusY + Math.sin(mote.x) * mote.y;
        img
          .setPosition(x, y)
          .setRotation(mote.x)
          .setScale(Math.min(2.4, mote.y / (w * 0.4)) * mote.size, 0.5);
        img.setAlpha(def.alpha * Math.min(1, (mote.y - w * 0.12) / (w * 0.2)));
        if (x < -150 || x > w + 150 || y < -150 || y > h + 150) mote.age = mote.life;
        else mote.age = Math.min(mote.age, mote.life * 0.5);
        break;
      }
    }
    if (mote.age >= mote.life) this.spawn(mote, false);
  }

  private stepMoon(mote: Mote, dt: number): void {
    const { width: w, height: h, def } = this;
    const orbit = mote.spin;
    mote.phase += dt * (0.22 - orbit * 0.05);
    const rx = w * (0.35 + orbit * 0.15);
    const ry = h * (0.05 + orbit * 0.025);
    const depth = Math.sin(mote.phase);
    mote.img
      .setPosition(this.focusX + Math.cos(mote.phase) * rx, this.focusY + depth * ry)
      .setScale(mote.size * (0.85 + depth * 0.15))
      .setTint(def.primary)
      // Hinter dem Planeten gedaempft, davor voll - so liest sich die Umlaufbahn.
      .setAlpha(def.alpha * (0.45 + 0.55 * (depth * 0.5 + 0.5)));
  }

  private stepRings(delta: number): void {
    const maxRadius = this.height * 0.95;
    for (const ring of this.rings) {
      ring.age = (ring.age + delta) % (T.pulseMs * this.rings.length);
      const t = ring.age / (T.pulseMs * this.rings.length);
      ring.img.setDisplaySize(maxRadius * 2 * t, maxRadius * 2 * t * 0.8);
      ring.img.setAlpha(this.def.alpha * Math.sin(Math.PI * t) * (1 - t * 0.6));
    }
  }

  private stepBlinkers(): void {
    const cycle = T.voidBlinkMs * 4;
    for (const star of this.blinkers) {
      const t = ((this.elapsed + star.offset) % cycle) / cycle;
      // Drei Viertel sichtbar, dann faellt der Stern kurz aus der Sicht.
      const visible =
        t < 0.72 ? 1 : t < 0.78 ? (0.78 - t) / 0.06 : t > 0.94 ? (t - 0.94) / 0.06 : 0;
      star.img.setAlpha(0.6 * visible);
    }
  }

  private stepEvent(delta: number): void {
    if (this.nextEvent === Number.POSITIVE_INFINITY) return;
    this.nextEvent -= delta;
    this.eventAge += delta;
    if (this.nextEvent <= 0) {
      this.nextEvent = this.eventDelay();
      this.eventAge = 0;
      if (this.def.motif === 'storm') this.drawBolt();
      else this.placeGlint();
    }
    if (this.def.motif === 'storm') this.fadeBolt();
    else this.fadeGlint();
  }

  private drawBolt(): void {
    const { width: w, height: h, rand, def } = this;
    const bolt = this.bolt!;
    bolt.clear();
    const left = rand() < 0.5;
    let x = w * (left ? 0.04 + rand() * 0.18 : 0.78 + rand() * 0.18);
    let y = -10;
    const end = h * (0.22 + rand() * 0.2);
    const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x, y)];
    while (y < end) {
      y += 24 + rand() * 30;
      x += (rand() - 0.5) * 60;
      points.push(new Phaser.Math.Vector2(x, y));
    }
    bolt.lineStyle(12, def.primary, 0.18);
    bolt.strokePoints(points);
    bolt.lineStyle(3, def.secondary, 0.9);
    bolt.strokePoints(points);
    // Ein Seitenast - ein gerader Blitz wirkt wie ein Strich.
    const fork = points[Math.floor(points.length / 2)]!;
    bolt.lineStyle(2, def.secondary, 0.6);
    bolt.strokePoints([
      fork,
      new Phaser.Math.Vector2(fork.x + (left ? 40 : -40), fork.y + 36),
      new Phaser.Math.Vector2(fork.x + (left ? 58 : -58), fork.y + 80),
    ]);
  }

  private fadeBolt(): void {
    const t = this.eventAge / T.lightningMs;
    // Doppelter Schlag: hell, kurz dunkel, noch einmal schwaecher.
    const strength = t >= 1 ? 0 : t < 0.2 ? 1 : t < 0.35 ? 0.25 : 0.7 * (1 - t);
    this.bolt!.setAlpha(strength);
    this.flash!.setAlpha(strength * T.lightningFlashAlpha);
  }

  private placeGlint(): void {
    const { width: w, height: h, rand } = this;
    const edge = rand() < 0.5 ? rand() * w * 0.2 : w * (0.8 + rand() * 0.2);
    this.glint!.setPosition(edge, h * (0.1 + rand() * 0.8));
  }

  private fadeGlint(): void {
    const t = this.eventAge / (T.glintMs * 0.35);
    const strength = t >= 1 ? 0 : Math.sin(Math.PI * t);
    this.glint!.setAlpha(strength * 0.7)
      .setScale(0.6 + strength * 0.9)
      .setRotation(t * 0.8);
  }
}
