import Phaser from 'phaser';
import { PLANET_RENDER, worldVisual } from '@/config/worldVisuals';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { planetFrame } from './planetSurface';

function atlas(scene: Phaser.Scene, variant: number, frames: number, size: number): string {
  const key = `world-sphere-${variant}-${frames}-${size}`;
  if (scene.textures.exists(key)) return key;
  const columns = Math.min(frames, 8);
  const texture = scene.textures.createCanvas(
    key,
    size * columns,
    size * Math.ceil(frames / columns),
  )!;
  const context = texture.getContext();
  for (let frame = 0; frame < frames; frame++) {
    const data = context.createImageData(size, size);
    data.data.set(planetFrame(size, (frame / frames) * Math.PI * 2, worldVisual(variant)));
    const x = (frame % columns) * size;
    const y = Math.floor(frame / columns) * size;
    context.putImageData(data, x, y);
    texture.add(frame, 0, x, y, size, size);
  }
  texture.refresh();
  return key;
}

/** Diameter umfasst Ringe und Atmosphäre: keine nachträglich wachsende UI-Geometrie. */
export function createSpatialPlanet(
  scene: Phaser.Scene,
  x: number,
  y: number,
  diameter: number,
  variant: number,
  animated = true,
  resolution: number = PLANET_RENDER.resolution,
): Phaser.GameObjects.Container {
  const visual = worldVisual(variant);
  const lowMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const frames =
    animated && !prefersReducedMotion() && !(lowMemory && lowMemory <= 2)
      ? PLANET_RENDER.frames
      : 1;
  const key = atlas(scene, variant, frames, resolution);
  const root = scene.add.container(x, y).setSize(diameter, diameter);
  root.setData('layoutRole', 'worldPlanet');
  const ringed = ['ice', 'rift', 'gate', 'moons'].includes(visual.ring);
  const bodySize = diameter * (ringed ? 0.62 : 0.86);
  const atmosphere = scene.add.graphics();
  for (let band = 3; band > 0; band--) {
    atmosphere.lineStyle(diameter * 0.006 * band, visual.rim, 0.07);
    atmosphere.strokeCircle(0, 0, bodySize * 0.505);
  }
  root.add(atmosphere);
  const drawRing = (front: boolean): Phaser.GameObjects.Graphics => {
    const graphics = scene.add.graphics();
    const start = front ? 0 : Math.PI;
    const rings = visual.ring === 'gate' ? 3 : 2;
    for (let band = 0; band < rings; band++) {
      const radius = diameter * (0.44 + band * 0.02);
      graphics.lineStyle(
        diameter * (visual.ring === 'ice' ? 0.016 : 0.006),
        visual.rim,
        front ? 0.65 : 0.26,
      );
      graphics.beginPath();
      for (let i = 0; i <= 48; i++) {
        const angle = start + (i / 48) * Math.PI;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius * 0.28;
        const rx = px * Math.cos(visual.tilt) - py * Math.sin(visual.tilt);
        const ry = px * Math.sin(visual.tilt) + py * Math.cos(visual.tilt);
        if (i === 0) graphics.moveTo(rx, ry);
        else graphics.lineTo(rx, ry);
        if (visual.ring === 'ice' && i % 6 === 0) {
          graphics.fillStyle(visual.rim, front ? 0.7 : 0.35);
          graphics.fillTriangle(
            rx - diameter * 0.014,
            ry,
            rx,
            ry - diameter * 0.022,
            rx + diameter * 0.01,
            ry + diameter * 0.012,
          );
        }
      }
      graphics.strokePath();
    }
    return graphics;
  };
  if (ringed) root.add(drawRing(false));
  const sphere = scene.add.image(0, 0, key, 0).setDisplaySize(bodySize, bodySize);
  const next = scene.add
    .image(0, 0, key, frames > 1 ? 1 : 0)
    .setDisplaySize(bodySize, bodySize)
    .setAlpha(0);
  root.add([sphere, next]);
  if (ringed) root.add(drawRing(true));
  if (visual.ring === 'corona') {
    const corona = scene.add.graphics();
    corona.lineStyle(diameter * 0.008, visual.rim, 0.23);
    for (let ray = 0; ray < 24; ray++) {
      const angle = (ray * Math.PI) / 12;
      corona.lineBetween(
        Math.cos(angle) * diameter * 0.445,
        Math.sin(angle) * diameter * 0.445,
        Math.cos(angle) * diameter * 0.485,
        Math.sin(angle) * diameter * 0.485,
      );
    }
    root.add(corona);
  }
  if (visual.ring === 'moons') {
    root.add(
      scene.add
        .image(diameter * 0.36, -diameter * 0.25, key, 0)
        .setDisplaySize(diameter * 0.16, diameter * 0.16),
    );
    root.add(
      scene.add
        .image(-diameter * 0.35, diameter * 0.25, key, 0)
        .setDisplaySize(diameter * 0.11, diameter * 0.11),
    );
  }
  let elapsed = 0;
  const update = (_time: number, delta: number): void => {
    if (frames === 1 || prefersReducedMotion()) return;
    elapsed = (elapsed + Math.max(0, delta)) % PLANET_RENDER.rotationMs;
    const phase = (elapsed / PLANET_RENDER.rotationMs) * frames;
    sphere.setFrame(Math.floor(phase));
    next.setFrame((Math.floor(phase) + 1) % frames).setAlpha(phase % 1);
  };
  if (frames > 1) {
    scene.events.on(Phaser.Scenes.Events.UPDATE, update);
    root.once(Phaser.GameObjects.Events.DESTROY, () =>
      scene.events.off(Phaser.Scenes.Events.UPDATE, update),
    );
  }
  return root;
}
