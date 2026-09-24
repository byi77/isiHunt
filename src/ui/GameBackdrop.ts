import Phaser from 'phaser';
import { PLAYFIELD_VISUALS as V } from '@/config/playfieldVisuals';
import type { WorldDef } from '@/config/worlds';
import { worldVisual } from '@/config/worldVisuals';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { Depth } from './depth';
import { createSpatialPlanet } from './spatialPlanet';
import { paintSafeAreaBackdrop } from './widgets';
import { createWorldEtching } from './worldEtching';

function hash(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** Einmal gerastert und je Welt geteilt; keine Wolkenberechnung pro Frame. */
function nebulaTexture(scene: Phaser.Scene, variant: number): string {
  const key = `playfield-nebula-${variant}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, V.textureWidth, V.textureHeight)!;
  const context = texture.getContext();
  const pixels = context.createImageData(V.textureWidth, V.textureHeight);
  const visual = worldVisual(variant);
  const tint = Phaser.Display.Color.IntegerToRGB(visual.dark);
  const light = Phaser.Display.Color.IntegerToRGB(visual.rim);
  for (let y = 0; y < V.textureHeight; y++) {
    for (let x = 0; x < V.textureWidth; x++) {
      const u = x / V.textureWidth;
      const v = y / V.textureHeight;
      let density = 0;
      let weight = 0.55;
      let frequency = 3;
      for (let octave = 0; octave < 5; octave++) {
        density += noise(u * frequency, v * frequency * 1.8, variant + octave) * weight;
        frequency *= 2;
        weight *= 0.48;
      }
      const side = variant % 2 === 0 ? u : 1 - u;
      const ridge = 0.18 + 0.32 * Math.sin(v * 4.5 + variant * 0.7);
      const band = Math.exp(-Math.pow((side - ridge) / 0.3, 2));
      // Dunkle Einschnitte statt additiver Wattebaeusche; die Mitte bleibt frei.
      const detail = Math.max(0, density - 0.27);
      const strength = Math.min(1, detail * 2.5) * band;
      const edge = Math.min(1, v * 8, (1 - v) * 8);
      const bright = Math.pow(detail, 2) * 0.7;
      const i = (y * V.textureWidth + x) * 4;
      pixels.data[i] = tint.r * 0.6 + light.r * bright;
      pixels.data[i + 1] = tint.g * 0.6 + light.g * bright;
      pixels.data[i + 2] = tint.b * 0.6 + light.b * bright;
      pixels.data[i + 3] = strength * edge * 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  texture.refresh();
  return key;
}

/** Eigene Run-Kulisse: alle Ebenen bleiben hinter Relikten und Hindernissen. */
export class GameBackdrop {
  private readonly root: Phaser.GameObjects.Container;
  private readonly stars: Phaser.GameObjects.Graphics[] = [];
  private readonly nebula: Phaser.GameObjects.Image;
  private elapsed = 0;
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
    world: WorldDef,
  ) {
    this.root = scene.add.container(0, 0).setDepth(Depth.Backdrop);
    this.root.setName('game-backdrop');
    const base = scene.add.graphics();
    base.fillGradientStyle(V.top, V.top, V.bottom, V.bottom, 1);
    base.fillRect(0, 0, width, height);
    this.root.add(base);
    paintSafeAreaBackdrop(V.top, V.bottom);

    this.nebula = scene.add
      .image(width / 2, height / 2, nebulaTexture(scene, world.spaceVariant))
      .setDisplaySize(width * 1.08, height * 1.06)
      .setAlpha(V.nebulaAlpha);
    this.root.add(this.nebula);

    for (let layer = 0; layer < V.starCounts.length; layer++) {
      const stars = scene.add.graphics();
      for (let i = 0; i < V.starCounts[layer]!; i++) {
        const x = hash(i, layer, world.spaceVariant) * (width + 48) - 24;
        const y = hash(layer, i + 19, world.spaceVariant) * (height + 48) - 24;
        const brightness = 0.45 + hash(i, 31, layer) * 0.55;
        stars.fillStyle(0xcbdce5, V.starAlpha[layer]! * brightness);
        stars.fillCircle(x, y, V.starRadius[layer]!);
        if (layer === 2 && i % 5 === 0) {
          stars.lineStyle(0.7, 0xcbdce5, 0.12);
          stars.lineBetween(x - 3, y, x + 3, y);
          stars.lineBetween(x, y - 3, x, y + 3);
        }
      }
      this.stars.push(stars);
      this.root.add(stars);
    }

    const planet = createSpatialPlanet(
      scene,
      width * (world.spaceVariant % 2 === 0 ? 0.97 : 0.03),
      height * 0.73,
      width * V.planetWidth,
      world.spaceVariant,
      false,
      V.planetResolution,
    ).setAlpha(V.planetAlpha);
    this.root.add(planet);
    this.root.add(createWorldEtching(scene, width, height, world.spaceVariant, world.accent));
  }

  update(delta: number, playerX: number, playerY: number): void {
    if (prefersReducedMotion()) {
      this.stars.forEach((layer) => layer.setPosition(0, 0));
      this.nebula.setPosition(this.width / 2, this.height / 2);
      this.offsetX = this.offsetY = 0;
      return;
    }
    const dt = Math.min(Math.max(delta, 0), V.maxDeltaMs);
    this.elapsed = (this.elapsed + dt) % V.driftPeriodMs;
    const follow = 1 - Math.exp((-V.followResponse * dt) / 1000);
    this.offsetX += ((playerX / this.width - 0.5) * 2 - this.offsetX) * follow;
    this.offsetY += ((playerY / this.height - 0.5) * 2 - this.offsetY) * follow;
    const phase = (this.elapsed / V.driftPeriodMs) * Math.PI * 2;
    this.stars.forEach((layer, i) => {
      const amount = V.parallax[i]!;
      layer.setPosition(
        -this.offsetX * amount + Math.sin(phase) * amount,
        -this.offsetY * amount + (Math.cos(phase) - 1) * amount * 0.5,
      );
    });
    this.nebula.setPosition(
      this.width / 2 - this.offsetX * 2 + Math.sin(phase) * 5,
      this.height / 2 - this.offsetY * 2,
    );
  }

  destroy(): void {
    this.root.destroy();
  }
}
