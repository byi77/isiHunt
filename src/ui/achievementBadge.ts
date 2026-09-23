/**
 * Abzeichen fuer Erfolge: Medaille mit Kategorie-Emblem und Rangmarken.
 *
 * Vorher trug jeder Erfolg denselben Pokal - vierzig Karten, ein Bild. Jetzt
 * sagt das Emblem, worum es geht (Kette, Sammlung, Punkte ...), und die
 * Marken am unteren Rand zeigen den Rang. Beides ist Form, nicht Farbe: Ein
 * gesperrter Erfolg ist grau, bleibt aber an Emblem und Rang erkennbar.
 *
 * Reine Vektorzeichnung, damit das Abzeichen in jeder Groesse scharf bleibt -
 * es erscheint in der Erfolgsliste und gross im Ergebnisbildschirm.
 */

import type Phaser from 'phaser';

import type { AchievementCategory } from '@/systems/AchievementProgressSystem';
import { Palette } from '@/ui/theme';

type Point = { x: number; y: number };

function polygon(g: Phaser.GameObjects.Graphics, points: Point[]): void {
  g.fillPoints(points, true);
}

function starPoints(
  spikes: number,
  outer: number,
  inner: number,
  rotation = -Math.PI / 2,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / spikes;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return points;
}

/** Zeichnet das Kategorie-Emblem um (0,0) in der Groesse `e`. */
function drawEmblem(
  g: Phaser.GameObjects.Graphics,
  category: AchievementCategory,
  e: number,
  color: number,
  line: number,
): void {
  g.fillStyle(color, 1);
  g.lineStyle(line, color, 1);
  switch (category) {
    case 'combo':
      // Blitz: eine Kette, die nicht abreisst.
      polygon(g, [
        { x: e * 0.15, y: -e },
        { x: -e * 0.55, y: e * 0.12 },
        { x: -e * 0.05, y: e * 0.12 },
        { x: -e * 0.2, y: e },
        { x: e * 0.55, y: -e * 0.18 },
        { x: e * 0.05, y: -e * 0.18 },
      ]);
      break;
    case 'collection':
      // Geschliffener Stein mit Tafel und Facettenlinien.
      polygon(g, [
        { x: -e * 0.8, y: -e * 0.3 },
        { x: -e * 0.45, y: -e * 0.75 },
        { x: e * 0.45, y: -e * 0.75 },
        { x: e * 0.8, y: -e * 0.3 },
        { x: 0, y: e * 0.9 },
      ]);
      g.lineStyle(Math.max(1, line * 0.6), Palette.medalCore, 0.7);
      g.lineBetween(-e * 0.8, -e * 0.3, e * 0.8, -e * 0.3);
      g.lineBetween(-e * 0.2, -e * 0.3, 0, e * 0.9);
      g.lineBetween(e * 0.2, -e * 0.3, 0, e * 0.9);
      break;
    case 'score':
      polygon(g, starPoints(5, e, e * 0.42));
      break;
    case 'worlds':
      g.fillCircle(0, 0, e * 0.55);
      g.strokeEllipse(0, 0, e * 2, e * 0.7);
      break;
    case 'playtime':
      g.strokeCircle(0, 0, e * 0.85);
      g.lineBetween(0, 0, 0, -e * 0.6);
      g.lineBetween(0, 0, e * 0.45, e * 0.2);
      g.fillCircle(0, 0, line * 0.8);
      break;
    case 'talents': {
      // Sechseckiger Knoten mit drei Aesten - der Talentbaum.
      const nodes: Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        nodes.push({ x: Math.cos(angle) * e * 0.38, y: Math.sin(angle) * e * 0.38 });
      }
      polygon(g, nodes);
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        const x = Math.cos(angle) * e * 0.95;
        const y = Math.sin(angle) * e * 0.95;
        g.lineBetween(0, 0, x, y);
        g.fillCircle(x, y, e * 0.17);
      }
      break;
    }
    case 'daily':
      g.fillCircle(0, 0, e * 0.42);
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        g.lineBetween(
          Math.cos(angle) * e * 0.62,
          Math.sin(angle) * e * 0.62,
          Math.cos(angle) * e * 0.95,
          Math.sin(angle) * e * 0.95,
        );
      }
      break;
    case 'special':
      // Der vierzackige Stern aus Logo und App-Icon.
      polygon(g, starPoints(4, e, e * 0.3));
      break;
  }
}

/**
 * Baut ein Abzeichen als Container um (x, y).
 *
 * @param radius Aussenradius der Medaille in Spielpixeln.
 */
export function createAchievementBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  category: AchievementCategory,
  rank: number,
  unlocked: boolean,
  radius = 24,
): Phaser.GameObjects.Container {
  const primary = unlocked ? Palette.medalPrimary : Palette.medalLocked;
  const shade = unlocked ? Palette.medalShade : Palette.medalLockedShade;
  const light = unlocked ? Palette.medalLight : Palette.medalLockedLight;
  const alpha = unlocked ? 1 : 0.78;
  const r = radius;

  const badge = scene.add.container(x, y);
  const g = scene.add.graphics();

  // Schatten unter der Medaille - sie liegt auf der Karte, statt zu schweben.
  g.fillStyle(Palette.medalShadow, 0.34);
  g.fillEllipse(0, r * 0.95, r * 1.5, r * 0.28);

  // Rand mit fester Beleuchtung von links oben, wie Relikte und Schiffe.
  g.fillStyle(primary, alpha);
  g.fillCircle(0, 0, r);
  g.lineStyle(Math.max(1.5, r * 0.08), light, unlocked ? 0.9 : 0.5);
  g.beginPath();
  g.arc(0, 0, r * 0.93, Math.PI * 1.02, Math.PI * 1.6, false);
  g.strokePath();
  g.lineStyle(Math.max(1.5, r * 0.08), shade, unlocked ? 0.9 : 0.6);
  g.beginPath();
  g.arc(0, 0, r * 0.93, Math.PI * 0.05, Math.PI * 0.6, false);
  g.strokePath();

  g.fillStyle(Palette.medalCore, 0.92);
  g.fillCircle(0, 0, r * 0.74);

  drawEmblem(g, category, r * 0.44, light, Math.max(2, r * 0.09));

  // Rangmarken im unteren Rand: Anzahl statt Farbe, wie bei den Relikten.
  const pips = Math.max(1, Math.min(7, Math.round(rank)));
  const step = 0.26;
  g.fillStyle(Palette.medalCore, 0.95);
  for (let i = 0; i < pips; i++) {
    const angle = Math.PI / 2 + (i - (pips - 1) / 2) * step;
    g.fillCircle(Math.cos(angle) * r * 0.87, Math.sin(angle) * r * 0.87, Math.max(1.5, r * 0.07));
  }

  badge.add(g);
  return badge;
}
