/**
 * Ein einfaches, gut lesbares Hindernis der spaeteren Welten.
 *
 * Hindernisse sind absichtlich keine Physikobjekte: Ein Kreis-Distanztest ist
 * auf dem Handy billiger, deterministisch und passt zum bestehenden Sammel-
 * system. Fruehe Welten bremsen nur, spaetere ziehen Zeit ab.
 */

import Phaser from 'phaser';

import { Depth } from '@/ui/depth';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';

export type ObstacleKind = 'brake' | 'penalty';

export class Obstacle extends Phaser.GameObjects.Container {
  readonly radius = 34;
  readonly kind: ObstacleKind;
  private ageMs = 0;
  private hitCooldownMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: ObstacleKind, accent: number) {
    super(scene, x, y);
    this.kind = kind;

    const glow = scene.add.image(0, 0, 'tex-glow').setTint(accent).setScale(2.2).setAlpha(0.32);
    const ring = scene.add.graphics();
    ring.lineStyle(4, accent, 0.9);
    ring.strokeCircle(0, 0, this.radius);
    ring.lineStyle(2, 0xffffff, 0.4);
    ring.strokeCircle(0, 0, this.radius - 9);

    const spikes = scene.add.graphics();
    spikes.fillStyle(kind === 'penalty' ? 0xa855f7 : 0x38bdf8, 0.78);
    spikes.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const outer = this.radius + 10;
      const inner = this.radius - 4;
      const first = new Phaser.Math.Vector2(Math.cos(angle) * outer, Math.sin(angle) * outer);
      const second = new Phaser.Math.Vector2(
        Math.cos(angle + 0.16) * inner,
        Math.sin(angle + 0.16) * inner,
      );
      const third = new Phaser.Math.Vector2(
        Math.cos(angle - 0.16) * inner,
        Math.sin(angle - 0.16) * inner,
      );
      spikes.moveTo(first.x, first.y);
      spikes.lineTo(second.x, second.y);
      spikes.lineTo(third.x, third.y);
      spikes.closePath();
    }
    spikes.fillPath();

    this.add([glow, spikes, ring]);
    this.setDepth(Depth.Obstacle);
    scene.add.existing(this);

    if (!prefersReducedMotion()) {
      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.5 },
        scale: { from: 2, to: 2.35 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      scene.tweens.add({
        targets: this,
        scale: { from: 0.4, to: 1 },
        duration: 220,
        ease: 'Back.Out',
      });
    }
  }

  tick(deltaMs: number, bounds: Phaser.Geom.Rectangle): void {
    this.ageMs += deltaMs;
    this.hitCooldownMs = Math.max(0, this.hitCooldownMs - deltaMs);
    this.rotation += deltaMs * 0.00035;

    if (this.x < bounds.left || this.x > bounds.right)
      this.x = Phaser.Math.Clamp(this.x, bounds.left, bounds.right);
    if (this.y < bounds.top || this.y > bounds.bottom)
      this.y = Phaser.Math.Clamp(this.y, bounds.top, bounds.bottom);
  }

  canHit(): boolean {
    return this.hitCooldownMs <= 0;
  }

  markHit(): void {
    this.hitCooldownMs = 950;
  }
}
