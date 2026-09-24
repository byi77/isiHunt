/** Gemeinsame, selbst gezeichnete Monoline-Icons fuer Phaser und DOM. */
import type Phaser from 'phaser';

type Circle = { kind: 'circle'; x: number; y: number; radius: number };
type Line = { kind: 'line'; points: readonly number[] };
type Rect = { kind: 'rect'; x: number; y: number; width: number; height: number };
type Stroke = Circle | Line | Rect;

export type UiIcon = 'back' | 'world' | 'time' | 'coins' | 'xp' | 'rank' | 'shop' | 'profile';

const ICONS: Record<UiIcon, readonly Stroke[]> = {
  back: [
    { kind: 'line', points: [16, 4, 8, 12, 16, 20] },
    { kind: 'line', points: [8, 12, 21, 12] },
  ],
  world: [
    { kind: 'circle', x: 12, y: 12, radius: 8 },
    { kind: 'line', points: [3, 12, 21, 12] },
    { kind: 'line', points: [12, 4, 8, 12, 12, 20] },
  ],
  time: [
    { kind: 'circle', x: 12, y: 12, radius: 9 },
    { kind: 'line', points: [12, 6, 12, 12, 16, 14] },
  ],
  coins: [
    { kind: 'circle', x: 12, y: 12, radius: 9 },
    { kind: 'circle', x: 12, y: 12, radius: 5 },
    { kind: 'line', points: [12, 8, 12, 16] },
  ],
  xp: [
    {
      kind: 'line',
      points: [
        12, 2, 14.7, 9.3, 22, 9.3, 16, 14, 18.2, 22, 12, 17.3, 5.8, 22, 8, 14, 2, 9.3, 9.3, 9.3, 12,
        2,
      ],
    },
  ],
  rank: [
    { kind: 'line', points: [4, 18, 8, 13, 12, 18, 16, 13, 20, 18] },
    { kind: 'line', points: [7, 9, 12, 4, 17, 9] },
  ],
  shop: [
    { kind: 'rect', x: 4, y: 9, width: 16, height: 12 },
    { kind: 'line', points: [4, 9, 7, 4, 17, 4, 20, 9] },
    { kind: 'line', points: [9, 13, 9, 17, 15, 17, 15, 13] },
  ],
  profile: [
    { kind: 'circle', x: 12, y: 8, radius: 4 },
    { kind: 'line', points: [4, 21, 4, 18, 8, 14, 16, 14, 20, 18, 20, 21] },
  ],
};

/** Zentriert gezeichnetes Phaser-Icon. Es nimmt selbst keine Eingaben an. */
export function createSceneIcon(
  scene: Phaser.Scene,
  name: UiIcon,
  x: number,
  y: number,
  size: number,
  color: number,
): Phaser.GameObjects.Graphics {
  const icon = scene.add.graphics({ x: x - size / 2, y: y - size / 2 });
  const scale = size / 24;
  icon.lineStyle(2 * scale, color, 1);
  for (const stroke of ICONS[name]) {
    if (stroke.kind === 'circle') {
      icon.strokeCircle(stroke.x * scale, stroke.y * scale, stroke.radius * scale);
    } else if (stroke.kind === 'rect') {
      icon.strokeRect(
        stroke.x * scale,
        stroke.y * scale,
        stroke.width * scale,
        stroke.height * scale,
      );
    } else {
      icon.strokePoints(
        Array.from({ length: stroke.points.length / 2 }, (_, index) => ({
          x: stroke.points[index * 2]! * scale,
          y: stroke.points[index * 2 + 1]! * scale,
        })),
      );
    }
  }
  return icon;
}

/** Dieselben Pfade als DOM-SVG fuer den Hangar. Farbe kommt von currentColor. */
export function createDomIcon(name: UiIcon): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const stroke of ICONS[name]) {
    const element = document.createElementNS(
      ns,
      stroke.kind === 'circle' ? 'circle' : stroke.kind === 'rect' ? 'rect' : 'polyline',
    );
    if (stroke.kind === 'circle') {
      element.setAttribute('cx', String(stroke.x));
      element.setAttribute('cy', String(stroke.y));
      element.setAttribute('r', String(stroke.radius));
    } else if (stroke.kind === 'rect') {
      element.setAttribute('x', String(stroke.x));
      element.setAttribute('y', String(stroke.y));
      element.setAttribute('width', String(stroke.width));
      element.setAttribute('height', String(stroke.height));
    } else {
      element.setAttribute(
        'points',
        Array.from(
          { length: stroke.points.length / 2 },
          (_, index) => `${stroke.points[index * 2]},${stroke.points[index * 2 + 1]}`,
        ).join(' '),
      );
    }
    svg.append(element);
  }
  return svg;
}
