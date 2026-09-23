/**
 * Ein einfaches, gut lesbares Hindernis der spaeteren Welten.
 *
 * Hindernisse sind absichtlich keine Physikobjekte: Ein Kreis-Distanztest ist
 * auf dem Handy billiger, deterministisch und passt zum bestehenden Sammel-
 * system. Fruehe Welten bremsen nur, spaetere ziehen Zeit ab.
 *
 * Gezeichnet als Schatten, nicht als Licht: Laut Leitbild kann man einsammeln,
 * was leuchtet. Ein Hindernis mit additivem Schein und lila Zacken las sich
 * deshalb wie ein episches Relikt (ART_STYLE 1 und 2.1).
 */

import Phaser from 'phaser';

import { OBSTACLE_VISUALS } from '@/config/effectVisuals';
import { WORLD_OBSTACLE_HIT_COOLDOWN_MS } from '@/config/GameConfig';
import { Depth } from '@/ui/depth';
import { Palette } from '@/ui/theme';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';

export type ObstacleKind = 'brake' | 'penalty';

export function obstacleColor(kind: ObstacleKind): number {
  return kind === 'penalty' ? Palette.obstaclePenaltyHex : Palette.obstacleBrakeHex;
}

export class Obstacle extends Phaser.GameObjects.Container {
  readonly radius = 34;
  readonly kind: ObstacleKind;
  private readonly outline: Phaser.GameObjects.Graphics;
  private readonly symbol: Phaser.GameObjects.Graphics;
  private ageMs = 0;
  private hitCooldownMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: ObstacleKind) {
    super(scene, x, y);
    this.kind = kind;
    const color = obstacleColor(kind);
    const v = OBSTACLE_VISUALS;

    const spikePoints: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < v.spikeCount; index += 1) {
      const angle = (index / v.spikeCount) * Math.PI * 2;
      const outer = this.radius + v.spikeReach;
      const inner = this.radius - v.spikeInset;
      spikePoints.push(
        new Phaser.Math.Vector2(
          Math.cos(angle - v.spikeHalfWidth) * inner,
          Math.sin(angle - v.spikeHalfWidth) * inner,
        ),
        new Phaser.Math.Vector2(Math.cos(angle) * outer, Math.sin(angle) * outer),
        new Phaser.Math.Vector2(
          Math.cos(angle + v.spikeHalfWidth) * inner,
          Math.sin(angle + v.spikeHalfWidth) * inner,
        ),
      );
    }

    const body = scene.add.graphics();
    body.fillStyle(Palette.obstacleBody, v.bodyAlpha);
    body.fillPoints(spikePoints, true);
    body.fillCircle(0, 0, this.radius - v.spikeInset);

    // Die Kontur ist das einzige Farbige am Hindernis - sie warnt, sie
    // leuchtet nicht. Normal gemischt, nie additiv.
    this.outline = scene.add.graphics();
    this.outline.lineStyle(v.outlineWidth, color, 1);
    this.outline.strokePoints(spikePoints, true, true);

    // Zweites Formmerkmal: gestrichelter Innenring. Relikte haben eine
    // geschlossene Kontur, Hindernisse eine unterbrochene.
    const dashes = scene.add.graphics();
    dashes.lineStyle(2, color, 0.7);
    const dashRadius = this.radius - v.dashInset;
    for (let index = 0; index < v.dashCount; index += 1) {
      const start = (index / v.dashCount) * Math.PI * 2;
      dashes.beginPath();
      dashes.arc(0, 0, dashRadius, start, start + Math.PI / v.dashCount, false);
      dashes.strokePath();
    }

    const symbol = scene.add.graphics();
    this.symbol = symbol;
    symbol.lineStyle(3, color, 0.95);
    const s = v.symbolSize;
    if (kind === 'penalty') {
      // Sanduhr: kostet Zeit.
      symbol.beginPath();
      symbol.moveTo(-s * 0.7, -s);
      symbol.lineTo(s * 0.7, -s);
      symbol.lineTo(-s * 0.7, s);
      symbol.lineTo(s * 0.7, s);
      symbol.closePath();
      symbol.strokePath();
    } else {
      // Doppelter Winkel gegen die Flugrichtung: bremst.
      for (const offset of [-s * 0.45, s * 0.45]) {
        symbol.beginPath();
        symbol.moveTo(offset + s * 0.4, -s * 0.7);
        symbol.lineTo(offset - s * 0.4, 0);
        symbol.lineTo(offset + s * 0.4, s * 0.7);
        symbol.strokePath();
      }
    }

    this.add([body, dashes, this.outline, symbol]);
    this.setDepth(Depth.Obstacle);
    scene.add.existing(this);

    if (!prefersReducedMotion()) {
      scene.tweens.add({
        targets: this,
        scale: { from: v.spawnFromScale, to: 1 },
        duration: v.spawnMs,
        ease: 'Back.Out',
      });
    }
  }

  tick(deltaMs: number, bounds: Phaser.Geom.Rectangle): void {
    this.ageMs += deltaMs;
    this.hitCooldownMs = Math.max(0, this.hitCooldownMs - deltaMs);
    // Der Zackenkranz dreht sich, das Symbol dreht gegen und bleibt dadurch
    // aufrecht lesbar.
    if (!prefersReducedMotion()) {
      const v = OBSTACLE_VISUALS;
      this.rotation += deltaMs * v.spinPerMs;
      const wave = (Math.sin((this.ageMs / v.pulseMs) * Math.PI * 2) + 1) / 2;
      this.outline.setAlpha(v.outlineAlphaMin + (v.outlineAlphaMax - v.outlineAlphaMin) * wave);
      this.symbol.setRotation(-this.rotation);
    }

    if (this.x < bounds.left || this.x > bounds.right)
      this.x = Phaser.Math.Clamp(this.x, bounds.left, bounds.right);
    if (this.y < bounds.top || this.y > bounds.bottom)
      this.y = Phaser.Math.Clamp(this.y, bounds.top, bounds.bottom);
  }

  canHit(): boolean {
    return this.hitCooldownMs <= 0;
  }

  markHit(): void {
    this.hitCooldownMs = WORLD_OBSTACLE_HIT_COOLDOWN_MS;
  }
}
