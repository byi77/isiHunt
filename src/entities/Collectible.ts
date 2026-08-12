/**
 * Ein einsammelbares Relikt.
 *
 * Lebenszyklus: spawn (Skalierung von 0) -> driften -> in den letzten
 * `FADE_OUT_MS` verblassen -> `isExpired` wird true -> GameScene raeumt auf.
 * Das Objekt entfernt sich NICHT selbst, damit die Scene den Miss zaehlen kann.
 */

import Phaser from 'phaser';

import { RARITY_RAYS_MIN_POINTS } from '@/config/GameConfig';
import type { RarityDef } from '@/config/rarities';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';

/** Zeitfenster am Lebensende, in dem das Relikt sichtbar verblasst. */
const FADE_OUT_MS = 700;

export class Collectible extends Phaser.GameObjects.Container {
  readonly rarity: RarityDef;
  readonly radius: number;

  private readonly orb: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly rays: Phaser.GameObjects.Image | null;
  private readonly velocity: Phaser.Math.Vector2;

  private ageMs = 0;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, rarity: RarityDef) {
    super(scene, x, y);

    this.rarity = rarity;
    this.radius = rarity.radius;

    const orbTextureRadius = 30; // siehe createOrb()
    const scale = rarity.radius / orbTextureRadius;

    this.glow = scene.add
      .image(0, 0, TextureKey.Glow)
      .setTint(rarity.color)
      .setScale(scale * 1.5)
      .setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Strahlenkranz nur ab "selten": Bekaeme ihn jedes Relikt, wuerde er
    // aufhoeren, Seltenheit zu bedeuten.
    this.rays =
      rarity.points >= RARITY_RAYS_MIN_POINTS
        ? scene.add
            .image(0, 0, TextureKey.Rays)
            .setTint(rarity.color)
            .setScale(scale * 0.75)
            .setAlpha(0.45)
            .setBlendMode(Phaser.BlendModes.ADD)
        : null;

    this.orb = scene.add.image(0, 0, TextureKey.Orb).setTint(rarity.color).setScale(scale);

    this.add(this.rays ? [this.rays, this.glow, this.orb] : [this.glow, this.orb]);
    this.setDepth(Depth.Collectible);
    scene.add.existing(this);

    // Zufaellige Driftrichtung mit der seltenheitsabhaengigen Geschwindigkeit.
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.velocity = new Phaser.Math.Vector2(
      Math.cos(angle) * rarity.driftSpeed,
      Math.sin(angle) * rarity.driftSpeed,
    );

    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
    });

    // Seltene Relikte pulsieren staerker - sie sollen ins Auge springen.
    if (rarity.points >= RARITY_RAYS_MIN_POINTS) {
      scene.tweens.add({
        targets: this.glow,
        alpha: { from: 0.55, to: 1 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  get isExpired(): boolean {
    return !this.collected && this.ageMs >= this.rarity.lifetimeMs;
  }

  /**
   * Bewegt das Relikt und laesst es altern.
   *
   * @param magnetSource Position der Figur, wenn das Magnetismus-Talent aktiv
   *   ist - das Relikt driftet dann leicht in ihre Richtung.
   */
  tick(
    dtSec: number,
    deltaMs: number,
    bounds: Phaser.Geom.Rectangle,
    magnetSource: Phaser.Math.Vector2 | null,
    magnetRadius: number,
  ): void {
    if (this.collected) return;

    this.ageMs += deltaMs;

    if (magnetSource && magnetRadius > 0) {
      const dx = magnetSource.x - this.x;
      const dy = magnetSource.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 1 && distance < magnetRadius) {
        // Sog waechst je naeher die Figur ist.
        const pull = (1 - distance / magnetRadius) * 420;
        this.x += (dx / distance) * pull * dtSec;
        this.y += (dy / distance) * pull * dtSec;
      }
    }

    this.x += this.velocity.x * dtSec;
    this.y += this.velocity.y * dtSec;

    // An den Spielfeldraendern abprallen statt verschwinden.
    if (this.x < bounds.left || this.x > bounds.right) {
      this.velocity.x *= -1;
      this.x = Phaser.Math.Clamp(this.x, bounds.left, bounds.right);
    }
    if (this.y < bounds.top || this.y > bounds.bottom) {
      this.velocity.y *= -1;
      this.y = Phaser.Math.Clamp(this.y, bounds.top, bounds.bottom);
    }

    this.orb.rotation += dtSec * 0.8;
    // Gegenlaeufig zum Relikt - die Bewegung bleibt dadurch lesbar, statt sich
    // zu einer einzigen drehenden Scheibe zu vermischen.
    if (this.rays) this.rays.rotation -= dtSec * 0.35;

    const remaining = this.rarity.lifetimeMs - this.ageMs;
    if (remaining <= FADE_OUT_MS) {
      const ratio = Phaser.Math.Clamp(remaining / FADE_OUT_MS, 0, 1);
      this.setAlpha(ratio);
      // Zusaetzliches Blinken, damit das Ablaufen nicht nur ueber Alpha laeuft.
      this.setScale(0.75 + ratio * 0.25);
    }
  }

  /** Markiert das Relikt als eingesammelt und spielt die Einzugs-Animation. */
  collect(onDone: () => void): void {
    if (this.collected) return;
    this.collected = true;

    this.scene.tweens.add({
      targets: this,
      scale: 1.6,
      alpha: 0,
      duration: 160,
      ease: 'Quad.Out',
      onComplete: onDone,
    });
  }

  get isCollected(): boolean {
    return this.collected;
  }
}
