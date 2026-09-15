import type { WorldVisual } from '@/config/worldVisuals';

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Periodisch in der Länge: Die Rotation hat auch am Atlasende keine Naht. */
function terrain(longitude: number, latitude: number, type: WorldVisual['surface']): number {
  const a = Math.sin(longitude * 3 + Math.sin(latitude * 5));
  const b = Math.cos(longitude * 7 - latitude * 9);
  const c = Math.sin(longitude * 13 + latitude * 17);
  switch (type) {
    case 'land':
      return clamp((a + b * 0.45 + c * 0.15) * 1.1 + 0.35);
    case 'ice':
      return clamp(0.7 + a * 0.15 + b * 0.1 - Math.pow(Math.abs(c), 16) * 0.4);
    case 'gas':
      return 0.5 + Math.sin(latitude * 25 + a * 0.7 + b * 0.2) * 0.28 + c * 0.08;
    case 'void':
      return 0.08 + Math.pow(Math.max(0, Math.sin(longitude * 2 + latitude * 8)), 26) * 0.5;
    case 'sun':
      return 0.65 + a * b * 0.22 + c * 0.12;
    case 'moon':
      return 0.48 + a * 0.08 + b * 0.08 - Math.pow(Math.max(0, c * b), 4) * 0.4;
    case 'crystal':
      return Math.round((0.5 + a * 0.2 + b * 0.2) * 5) / 5;
    case 'storm':
      return 0.48 + Math.sin(latitude * 20 + a * 3 + b) * 0.27 + c * 0.05;
    case 'core':
      return 0.7 + Math.sin(longitude * 10 + latitude * 16) * b * 0.28;
    case 'gate':
      return 0.22 + Math.pow(Math.max(0, b), 12) * 0.35 + a * 0.1;
  }
}

/** Kugelprojektion mit fester Lichtquelle; nur die Oberfläche rotiert. */
export function planetFrame(size: number, phase: number, visual: WorldVisual): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const dark = [visual.dark >> 16, (visual.dark >> 8) & 255, visual.dark & 255];
  const light = [visual.light >> 16, (visual.light >> 8) & 255, visual.light & 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size - 0.5) * 2;
      const ny = ((y + 0.5) / size - 0.5) * 2;
      const distance = nx * nx + ny * ny;
      if (distance >= 1) continue;
      const nz = Math.sqrt(1 - distance);
      const sample = terrain(Math.atan2(nx, nz) + phase, Math.asin(ny), visual.surface);
      const diffuse = Math.max(0, -nx * 0.55 - ny * 0.55 + nz * 0.63);
      const illumination = 0.1 + diffuse * 0.9;
      const rim = Math.pow(1 - nz, 4) * (0.15 + diffuse * 0.25);
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const base = dark[channel]! + (light[channel]! - dark[channel]!) * sample;
        pixels[index + channel] = base * illumination + light[channel]! * rim;
      }
      pixels[index + 3] = clamp((1 - Math.sqrt(distance)) * size) * 255;
    }
  }
  return pixels;
}
