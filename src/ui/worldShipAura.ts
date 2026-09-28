import Phaser from 'phaser';
import {
  SHIP_AURA_LIMITS as L,
  worldShipAura,
  type WorldShipAuraDef,
} from '@/config/worldShipAura';
import { worldAtmosphere, type AtmosphereMotif } from '@/config/worldAtmosphere';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { Depth } from './depth';
import { TextureKey } from './textures';
import { AtmosphereTexture as Tex, createAtmosphereTextures } from './worldAtmosphere';

/**
 * Weltaura um das Schiff und Weltspur dahinter.
 *
 * `back` und `front` haengen im Spieler-Container und wandern mit dem Schiff;
 * Elemente auf einer Umlaufbahn wechseln zwischen beiden, damit sie hinter
 * und vor dem Rumpf vorbeiziehen. Die Spur liegt dagegen im Weltkoordinaten-
 * system - sie muss dort bleiben, wo das Schiff war.
 *
 * Wie die Kulisse haengt alles am uebergebenen `delta`; neu gezeichnet werden
 * nur die Blitzboegen der Sturmgrenze, und das hoechstens alle `arcMs`.
 */

interface Orbiter {
  img: Phaser.GameObjects.Image;
  inFront: boolean;
  seed: number;
}

interface WakeMote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  spin: number;
  size: number;
}

export class WorldShipAura {
  readonly back: Phaser.GameObjects.Container;
  readonly front: Phaser.GameObjects.Container;
  private readonly wakeLayer: Phaser.GameObjects.Container;
  private readonly def: WorldShipAuraDef;
  private readonly motif: AtmosphereMotif;
  private readonly orbiters: Orbiter[] = [];
  private readonly spinners: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly wake: WakeMote[] = [];
  private arcs?: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private arcRestMs = 0;
  private spawnDebt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    variant: number,
  ) {
    createAtmosphereTextures(scene);
    this.def = worldShipAura(variant);
    this.motif = worldAtmosphere(variant).motif;
    this.back = scene.add.container(0, 0).setName('world-ship-aura-back');
    this.front = scene.add.container(0, 0).setName('world-ship-aura-front');
    this.wakeLayer = scene.add
      .container(0, 0)
      .setDepth(Depth.Player - 2)
      .setName('world-ship-wake');
    this.build();
    this.update(0, 0, 0, 0, 0, 0);
  }

  /** Farbe der Triebwerksflamme in dieser Welt. */
  get engineColor(): number {
    return this.def.engine;
  }

  private image(key: string, tint: number, front = false): Phaser.GameObjects.Image {
    const img = this.scene.add.image(0, 0, key).setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
    (front ? this.front : this.back).add(img);
    return img;
  }

  private build(): void {
    const { def } = this;
    const r = def.orbitRadius;
    const orbiterTexture: Partial<Record<AtmosphereMotif, string>> = {
      pollen: Tex.Soft,
      snow: Tex.Flake,
      embers: Tex.Soft,
      void: Tex.Soft,
      orbits: Tex.Moon,
      shards: Tex.Diamond,
    };
    const key = orbiterTexture[this.motif];
    if (key !== undefined) {
      for (let i = 0; i < def.orbiters; i++) {
        const img = this.image(key, i % 3 === 2 ? def.secondary : def.primary);
        if (this.motif === 'orbits') img.setBlendMode(Phaser.BlendModes.NORMAL);
        this.orbiters.push({ img, inFront: false, seed: i / Math.max(def.orbiters, 1) });
      }
    }
    switch (this.motif) {
      case 'void': {
        // Dunkler Hof unter violettem Rand - das Schiff sitzt in einem Loch.
        const hole = this.image(Tex.SoftRing, def.secondary).setBlendMode(Phaser.BlendModes.NORMAL);
        hole.setDisplaySize(r * 2.5, r * 2.5).setAlpha(0.8);
        const rim = this.image(Tex.SoftRing, def.primary).setDisplaySize(r * 2.2, r * 2.2);
        rim.setAlpha(def.alpha * 0.6);
        this.rings.push(rim);
        break;
      }
      case 'corona': {
        const crown = this.image(Tex.Corona, def.primary).setDisplaySize(r * 2.8, r * 2.8);
        crown.setAlpha(def.alpha);
        const inner = this.image(Tex.Corona, def.secondary).setDisplaySize(r * 2, r * 2);
        inner.setAlpha(def.alpha * 0.7);
        this.spinners.push(
          { img: crown, speed: def.orbitSpeed },
          { img: inner, speed: -def.orbitSpeed * 1.7 },
        );
        break;
      }
      case 'warp': {
        const gate = this.image(Tex.Gate, def.primary).setDisplaySize(r * 2.2, r * 2.2);
        gate.setAlpha(def.alpha);
        const inner = this.image(Tex.Gate, def.secondary).setDisplaySize(r * 1.55, r * 1.55);
        inner.setAlpha(def.alpha * 0.6);
        this.spinners.push(
          { img: gate, speed: def.orbitSpeed },
          { img: inner, speed: -def.orbitSpeed * 2.2 },
        );
        break;
      }
      case 'pulse': {
        this.image(TextureKey.Glow, def.secondary).setScale(1.3).setAlpha(0.8);
        for (let i = 0; i < def.orbiters; i++) {
          this.rings.push(this.image(Tex.SoftRing, def.primary).setAlpha(0));
        }
        break;
      }
      case 'storm':
        this.arcs = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        this.front.add(this.arcs);
        break;
      default:
        break;
    }
  }

  /**
   * @param deltaMs vergangene Zeit
   * @param x Schiffsposition in Weltkoordinaten
   * @param vx Geschwindigkeit in Spielpixeln je Sekunde
   * @param thrust Tempoanteil 0..1
   * @param exhaustX Duese relativ zum Schiff
   */
  update(
    deltaMs: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    thrust: number,
    exhaustX = 0,
    exhaustY = 0,
  ): void {
    const still = prefersReducedMotion();
    const dt = still ? 0 : Math.max(0, deltaMs) / 1000;
    this.elapsed += dt;
    this.stepOrbiters();
    for (const spinner of this.spinners) spinner.img.rotation += spinner.speed * dt;
    this.stepRings();
    this.stepArcs(still ? 0 : deltaMs);
    if (!still && thrust >= L.wakeMinThrust) {
      this.spawnDebt += this.def.wakeRate * thrust * dt;
      while (this.spawnDebt >= 1) {
        this.spawnDebt -= 1;
        this.spawnWake(x + exhaustX, y + exhaustY, vx, vy);
      }
    }
    this.stepWake(dt, x, y);
  }

  private stepOrbiters(): void {
    const { def, elapsed: t } = this;
    const r = def.orbitRadius;
    for (const [i, orbiter] of this.orbiters.entries()) {
      const img = orbiter.img;
      const base = orbiter.seed * Math.PI * 2;
      switch (this.motif) {
        case 'embers': {
          // Glutzungen: jede steigt von ihrem Platz am Rumpf auf und verlischt.
          const cycle = (t * 1.6 + orbiter.seed) % 1;
          const angle = base + Math.sin(t * 2 + i) * 0.2;
          img
            .setPosition(Math.cos(angle) * r * 0.75, Math.sin(angle) * r * 0.6 - cycle * 34)
            .setScale(0.8 * (1 - cycle * 0.6), 1.2 * (1 - cycle * 0.4))
            .setAlpha(def.alpha * Math.sin(Math.PI * cycle));
          this.setSide(orbiter, Math.sin(angle) > 0.2);
          break;
        }
        case 'void': {
          // Spiralsog: Abstand schrumpft, Drehung wird schneller.
          const cycle = (t * 0.7 + orbiter.seed) % 1;
          const radius = r * (1 - cycle * 0.75);
          const angle = base + t * def.orbitSpeed - cycle * 3;
          img
            .setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius)
            .setScale(0.35 * (1 - cycle * 0.5))
            .setAlpha(def.alpha * Math.sin(Math.PI * cycle));
          break;
        }
        case 'orbits': {
          const angle = base + t * def.orbitSpeed * (i === 0 ? 1 : 0.7);
          const radius = r * (i === 0 ? 1 : 0.78);
          const depth = Math.sin(angle);
          const px = Math.cos(angle) * radius;
          const py = depth * radius * 0.35;
          const tilt = -0.35;
          img
            .setPosition(
              px * Math.cos(tilt) - py * Math.sin(tilt),
              px * Math.sin(tilt) + py * Math.cos(tilt),
            )
            .setScale((i === 0 ? 0.62 : 0.46) * (0.85 + depth * 0.15))
            .setAlpha(def.alpha * (0.55 + 0.45 * (depth * 0.5 + 0.5)));
          this.setSide(orbiter, depth > 0);
          break;
        }
        default: {
          // Pollen, Kristalle, Splitter: gekippte Umlaufbahn mit Tiefe.
          const flatten = this.motif === 'shards' ? 0.7 : this.motif === 'snow' ? 0.42 : 0.55;
          const angle = base + t * def.orbitSpeed;
          const bob = this.motif === 'pollen' ? Math.sin(t * 2.2 + i * 2) * 6 : 0;
          const depth = Math.sin(angle);
          img.setPosition(Math.cos(angle) * r, depth * r * flatten + bob);
          if (this.motif === 'snow') img.setScale(0.55 + depth * 0.1).setRotation(t * 1.4 + i);
          else if (this.motif === 'shards') {
            img.setScale(0.9, 0.8).setRotation(Math.atan2(depth * flatten, Math.cos(angle)));
          } else img.setScale(0.75 + 0.15 * Math.sin(t * 3 + i));
          img.setAlpha(def.alpha * (0.5 + 0.5 * (depth * 0.5 + 0.5)));
          this.setSide(orbiter, depth > 0);
          break;
        }
      }
    }
  }

  /** Haengt ein Element vor oder hinter den Rumpf, nur beim Seitenwechsel. */
  private setSide(orbiter: Orbiter, inFront: boolean): void {
    if (orbiter.inFront === inFront) return;
    orbiter.inFront = inFront;
    (inFront ? this.back : this.front).remove(orbiter.img);
    (inFront ? this.front : this.back).add(orbiter.img);
  }

  private stepRings(): void {
    if (this.motif === 'void') {
      const rim = this.rings[0];
      rim?.setAlpha(this.def.alpha * (0.45 + 0.2 * Math.sin(this.elapsed * 3)));
      return;
    }
    if (this.motif !== 'pulse') return;
    const period = L.pulseMs / 1000;
    const r = this.def.orbitRadius;
    for (const [i, ring] of this.rings.entries()) {
      const cycle = (this.elapsed / period + i / this.rings.length) % 1;
      const size = r * (0.8 + cycle * 1.4) * 2;
      ring
        .setDisplaySize(size, size)
        .setAlpha(this.def.alpha * (1 - cycle) * Math.min(1, cycle * 6));
    }
  }

  private stepArcs(deltaMs: number): void {
    const arcs = this.arcs;
    if (arcs === undefined) return;
    this.arcRestMs -= deltaMs;
    if (this.arcRestMs > 0) return;
    this.arcRestMs = L.arcMs;
    arcs.clear();
    const { def } = this;
    const r = def.orbitRadius;
    for (let arc = 0; arc < def.orbiters; arc++) {
      // Nicht jeder Bogen zuckt jedes Mal - ein Dauerleuchten wirkt nicht elektrisch.
      if (Math.random() < 0.35) continue;
      const start = Math.random() * Math.PI * 2;
      const span = 0.6 + Math.random() * 0.8;
      const points: Phaser.Math.Vector2[] = [];
      for (let step = 0; step <= 5; step++) {
        const angle = start + (span * step) / 5;
        const radius = r * (0.8 + Math.random() * 0.35);
        points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
      }
      arcs.lineStyle(6, def.primary, 0.22);
      arcs.strokePoints(points);
      arcs.lineStyle(2, def.secondary, def.alpha);
      arcs.strokePoints(points);
    }
  }

  private spawnWake(x: number, y: number, vx: number, vy: number): void {
    let mote = this.wake.find((m) => m.age >= m.life);
    if (mote === undefined) {
      if (this.wake.length >= L.wakeMax) return;
      const img = this.scene.add.image(0, 0, Tex.Soft).setBlendMode(Phaser.BlendModes.ADD);
      this.wakeLayer.add(img);
      mote = { img, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, spin: 0, size: 1 };
      this.wake.push(mote);
    }
    const { def } = this;
    const jitter = (spread: number): number => (Math.random() - 0.5) * spread;
    const speed = Math.hypot(vx, vy) || 1;
    mote.x = x + jitter(10);
    mote.y = y + jitter(10);
    mote.age = 0;
    mote.life = def.wakeLife * (0.7 + Math.random() * 0.6);
    mote.spin = jitter(4);
    mote.vx = jitter(30);
    mote.vy = jitter(30);
    mote.size = 0.2 + Math.random() * 0.2;
    let key: string = Tex.Soft;
    let additive = true;
    switch (this.motif) {
      case 'pollen':
        mote.vy -= 14;
        break;
      case 'snow':
        key = Tex.Flake;
        mote.vy = 26 + Math.random() * 20;
        mote.size = 0.3 + Math.random() * 0.25;
        break;
      case 'embers':
        mote.vy = -60 - Math.random() * 50;
        mote.size = 0.16 + Math.random() * 0.16;
        break;
      case 'void':
        mote.size = 0.26;
        break;
      case 'corona':
        mote.vx = jitter(90);
        mote.vy = jitter(90);
        mote.size = 0.14 + Math.random() * 0.14;
        break;
      case 'orbits':
        key = Tex.Rock;
        additive = false;
        mote.size = 0.3 + Math.random() * 0.4;
        break;
      case 'shards':
      case 'warp':
      case 'storm':
        key = this.motif === 'shards' ? Tex.Diamond : Tex.Streak;
        if (this.motif === 'storm') {
          const angle = Math.random() * Math.PI * 2;
          mote.vx = Math.cos(angle) * 220;
          mote.vy = Math.sin(angle) * 220;
        } else {
          // Gegen die Fahrtrichtung, damit die Streifen hinter dem Schiff liegen.
          mote.vx = (-vx / speed) * 160 + jitter(40);
          mote.vy = (-vy / speed) * 160 + jitter(40);
        }
        mote.size = this.motif === 'warp' ? 0.7 : 0.45;
        break;
      case 'pulse':
        mote.vx *= 0.3;
        mote.vy *= 0.3;
        break;
    }
    mote.img
      .setTexture(key)
      .setTint(Math.random() < 0.35 ? def.secondary : def.primary)
      .setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setRotation(Math.atan2(mote.vy, mote.vx))
      .setVisible(true);
  }

  private stepWake(dt: number, shipX: number, shipY: number): void {
    const { def } = this;
    for (const mote of this.wake) {
      if (mote.age >= mote.life) continue;
      mote.age += dt;
      const t = Math.min(1, mote.age / mote.life);
      if (this.motif === 'void') {
        // Der Sog holt die Teilchen zum Schiff zurueck.
        mote.vx += (shipX - mote.x) * 3 * dt;
        mote.vy += (shipY - mote.y) * 3 * dt;
      } else if (this.motif === 'embers') {
        mote.vx += Math.sin(mote.age * 9 + mote.spin) * 60 * dt;
      }
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      const img = mote.img.setPosition(mote.x, mote.y);
      switch (this.motif) {
        case 'snow':
        case 'orbits':
          img.rotation += mote.spin * dt;
          img.setScale(mote.size);
          break;
        case 'shards':
        case 'warp':
        case 'storm':
          img.setScale(mote.size * (1 + t), 0.5);
          break;
        case 'pulse':
          img.setScale(mote.size * (1 + t * 2));
          break;
        default:
          img.setScale(mote.size * (1 - t * 0.4));
      }
      const flicker = this.motif === 'embers' ? 0.6 + 0.4 * Math.sin(mote.age * 20) : 1;
      img.setAlpha(def.alpha * (1 - t) * flicker);
      if (mote.age >= mote.life) img.setVisible(false);
    }
  }

  destroy(): void {
    this.wakeLayer.destroy();
    this.back.destroy();
    this.front.destroy();
  }
}
