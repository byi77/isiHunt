import type Phaser from 'phaser';
import { COLLECTION_VISUALS as V } from '@/config/collectionVisuals';
import { RARITY_IDS, type RarityDef } from '@/config/rarities';
import { prefersReducedMotion, rarityMarker } from '@/systems/AccessibilitySystem';
import {
  boxesOverlap,
  collectionLabelBox,
  collectionPoint,
  type EffectBox,
  type Point,
} from './collectionMotion';
import { Depth } from './depth';
import { Palette, textStyle } from './theme';

interface Capture {
  origin: Point;
  color: number;
  rank: number;
  age: number;
  reduced: boolean;
  label: Phaser.GameObjects.Text;
  box: EffectBox | null;
}

/** One graphics layer and at most eight labels; no emitter/tween per catch. */
export class CollectionEffects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly clip: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.Display.Masks.GeometryMask;
  private captures: Capture[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: () => Point,
    private readonly bounds: () => EffectBox,
    private readonly reducedMotion: () => boolean = prefersReducedMotion,
  ) {
    // Live targets and hazards always draw over the decoration.
    this.graphics = scene.add.graphics().setDepth(Depth.Collectible - 1);
    this.clip = scene.add.graphics().setVisible(false);
    this.mask = this.clip.createGeometryMask();
    this.graphics.setMask(this.mask);
  }

  add(
    origin: Point,
    rarity: RarityDef,
    points: number,
    bonusMultiplier?: number,
    xp?: number,
  ): void {
    if (this.captures.length >= V.maxActive) this.captures.shift()!.label.destroy();
    const unit = 720 / Math.max(1, this.scene.game.canvas.getBoundingClientRect().width);
    const rank = RARITY_IDS.indexOf(rarity.id);
    const lines = [
      `${rarityMarker(rarity.id)} +${points.toLocaleString('de-DE')}${rank >= 4 ? ` · ${rarity.label}` : ''}`,
    ];
    if (bonusMultiplier !== undefined)
      lines.push(
        `×${bonusMultiplier.toLocaleString('de-DE', { maximumFractionDigits: 2 })} SERIENBONUS`,
      );
    if (xp !== undefined) lines.push(`+${xp} XP`);
    const label = this.scene.add
      .text(
        0,
        0,
        lines.join('\n'),
        textStyle(Math.round(12 * unit), Palette.ink, {
          stroke: '#101820',
          strokeThickness: 3 * unit,
          align: 'center',
        }),
      )
      .setDepth(Depth.FloatingScore)
      .setWordWrapWidth(170 * unit);
    const capture: Capture = {
      origin: { ...origin },
      color: rarity.color,
      rank,
      age: 0,
      reduced: this.reducedMotion(),
      label,
      box: null,
    };
    this.captures.push(capture);
    this.update(0);
  }

  update(deltaMs: number): void {
    if (this.captures.length === 0) return;
    const bounds = this.bounds();
    const target = this.target();
    this.graphics.clear();
    this.clip
      .clear()
      .fillStyle(0xffffff)
      .fillRect(
        bounds.left,
        bounds.top,
        Math.max(0, bounds.right - bounds.left),
        Math.max(0, bounds.bottom - bounds.top),
      );
    const occupied: EffectBox[] = [
      { left: target.x - 58, right: target.x + 58, top: target.y - 58, bottom: target.y + 58 },
    ];
    this.captures = this.captures.filter((capture) => {
      capture.age += Math.max(0, deltaMs);
      if (capture.age >= V.lifetimeMs) {
        capture.label.destroy();
        return false;
      }
      // OS changes take effect for already active captures too.
      capture.reduced ||= this.reducedMotion();
      this.draw(capture, target);
      const previous = capture.box;
      const inside =
        previous &&
        previous.left >= bounds.left &&
        previous.right <= bounds.right &&
        previous.top >= bounds.top &&
        previous.bottom <= bounds.bottom;
      const box = inside
        ? previous
        : collectionLabelBox(
            capture.origin,
            capture.label.width + 8,
            capture.label.height + 8,
            bounds,
            occupied,
          );
      capture.box = box;
      capture.label.setVisible(box !== null && !occupied.some((other) => boxesOverlap(box, other)));
      if (box) {
        capture.label.setPosition(box.left + 4, box.top + 4);
        capture.label.setAlpha(
          capture.reduced ? 1 : Math.min(1, (V.lifetimeMs - capture.age) / 180),
        );
        occupied.push(box);
      }
      return true;
    });
  }

  private draw(c: Capture, target: Point): void {
    const g = this.graphics;
    if (c.reduced) {
      g.lineStyle(2, c.color, 0.7);
      g.strokeEllipse(c.origin.x, c.origin.y, 30 + c.rank * 4, 16 + c.rank * 2);
      return;
    }
    const ringT = Math.min(1, c.age / V.ringMs);
    if (ringT < 1) {
      g.lineStyle(2, c.color, (1 - ringT) * 0.75);
      const radius = 12 + (24 + c.rank * 5) * (1 - (1 - ringT) ** 3);
      for (let ring = 0; ring < (c.rank >= 4 ? 2 : 1); ring++) {
        g.beginPath();
        for (let step = 0; step <= 48; step++) {
          const angle = (step / 48) * Math.PI * 2;
          const x = Math.cos(angle) * (radius + ring * 8);
          const y = Math.sin(angle) * (radius + ring * 8) * 0.42;
          const px = c.origin.x + x * 0.94 + y * 0.34;
          const py = c.origin.y - x * 0.34 + y * 0.94;
          if (step === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
    }
    const t = Math.min(1, c.age / (V.baseFlightMs + c.rank * V.flightStepMs));
    if (t >= 1) return;
    for (let i = 0; i < V.baseShards + c.rank; i++) {
      const angle = i * 2.4;
      const start = { x: c.origin.x + Math.cos(angle) * 8, y: c.origin.y + Math.sin(angle) * 8 };
      const bend = (i % 2 ? -1 : 1) * Math.min(V.maxBend, 16 + i * 6);
      const p = collectionPoint(start, target, t, bend);
      const tail = collectionPoint(start, target, Math.max(0, t - 0.12), bend);
      g.lineStyle(2 + c.rank * 0.2, c.color, (1 - t) * 0.9);
      g.lineBetween(tail.x, tail.y, p.x, p.y);
      g.fillStyle(0xffffff, (1 - t) * 0.9);
      g.fillCircle(p.x, p.y, 2 + c.rank * 0.25);
    }
  }

  destroy(): void {
    for (const capture of this.captures) capture.label.destroy();
    this.captures = [];
    this.graphics.clearMask();
    this.mask.destroy();
    this.clip.destroy();
    this.graphics.destroy();
  }
}
