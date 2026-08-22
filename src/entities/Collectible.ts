/**
 * Ein einsammelbares Relikt.
 *
 * Lebenszyklus: spawn (Skalierung von 0) -> driften -> in den letzten
 * `FADE_OUT_MS` verblassen -> `isExpired` wird true -> GameScene raeumt auf.
 * Das Objekt entfernt sich NICHT selbst, damit die Scene den Miss zaehlen kann.
 */

import Phaser from 'phaser';

import {
  MAGNET_PULL_SPEED,
  RARITY_RAYS_MIN_POINTS,
  TALENT_MAGNET_ORB_ALPHA,
  TALENT_MAGNET_ORB_STREAK_LENGTH,
  TALENT_MAGNET_ORB_STREAK_WIDTH,
} from '@/config/GameConfig';
import type { RarityDef } from '@/config/rarities';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import type { TextureKeyValue } from '@/ui/textures';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';

/** Zeitfenster am Lebensende, in dem das Relikt sichtbar verblasst. */
const FADE_OUT_MS = 700;

export interface CollectibleOptions {
  lifetimeScale?: number;
  driftMultiplier?: number;
  blinking?: boolean;
}

export class Collectible extends Phaser.GameObjects.Container {
  readonly rarity: RarityDef;
  readonly radius: number;

  private readonly orb: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly rays: Phaser.GameObjects.Image | null;
  /** Sichtbares Sog-Feedback direkt am Relikt. */
  private readonly magnetVisual: Phaser.GameObjects.Graphics;
  private readonly velocity: Phaser.Math.Vector2;
  private readonly lifetimeMs: number;
  private readonly blinking: boolean;

  private ageMs = 0;
  private magnetMs = 0;
  private collected = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rarity: RarityDef,
    planetTexture: TextureKeyValue,
    options: CollectibleOptions = {},
  ) {
    super(scene, x, y);

    this.rarity = rarity;
    this.radius = rarity.radius;
    this.lifetimeMs = rarity.lifetimeMs * (options.lifetimeScale ?? 1);
    this.blinking = options.blinking ?? false;
    const driftMultiplier = options.driftMultiplier ?? 1;

    // Die PNG-Planeten sind 512x512 und haben damit einen Radius von 256.
    // Glow und Strahlen bleiben auf der alten Reliktgroesse, damit die
    // Seltenheitsfarbe auch bei den echten Oberflaechen klar lesbar bleibt.
    const planetTextureRadius = 256;
    const planetScale = rarity.radius / planetTextureRadius;
    const effectScale = rarity.radius / 30;

    this.glow = scene.add
      .image(0, 0, TextureKey.Glow)
      .setTint(rarity.color)
      .setScale(effectScale * 1.5)
      .setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Strahlenkranz nur ab "selten": Bekaeme ihn jedes Relikt, wuerde er
    // aufhoeren, Seltenheit zu bedeuten.
    this.rays =
      rarity.points >= RARITY_RAYS_MIN_POINTS
        ? scene.add
            .image(0, 0, TextureKey.Rays)
            .setTint(rarity.color)
            .setScale(effectScale * 0.75)
            .setAlpha(0.45)
            .setBlendMode(Phaser.BlendModes.ADD)
        : null;

    this.orb = scene.add.image(0, 0, planetTexture).setScale(planetScale);
    this.magnetVisual = scene.add.graphics().setDepth(Depth.Effects);
    this.magnetVisual.setVisible(false);

    this.add(this.rays ? [this.rays, this.glow, this.orb] : [this.glow, this.orb]);
    this.setDepth(Depth.Collectible);
    scene.add.existing(this);

    // Zufaellige Driftrichtung mit der seltenheitsabhaengigen Geschwindigkeit.
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.velocity = new Phaser.Math.Vector2(
      Math.cos(angle) * rarity.driftSpeed * driftMultiplier,
      Math.sin(angle) * rarity.driftSpeed * driftMultiplier,
    );

    if (prefersReducedMotion()) {
      this.setScale(1);
    } else {
      this.setScale(0);
      scene.tweens.add({
        targets: this,
        scale: 1,
        duration: 220,
        ease: 'Back.Out',
      });
    }

    // Seltene Relikte pulsieren staerker - sie sollen ins Auge springen.
    if (rarity.points >= RARITY_RAYS_MIN_POINTS && !prefersReducedMotion()) {
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
    return !this.collected && this.ageMs >= this.lifetimeMs;
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
    magnetPullSpeed = MAGNET_PULL_SPEED,
  ): void {
    if (this.collected) return;

    this.ageMs += deltaMs;
    this.magnetMs += deltaMs;
    let magnetInfluence = 0;

    if (magnetSource && magnetRadius > 0) {
      const dx = magnetSource.x - this.x;
      const dy = magnetSource.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 1 && distance < magnetRadius) {
        // Der Sog soll schon am aeusseren Rand spuerbar einsetzen. Die
        // Kurve wird zur Figur hin staerker, ohne am Rand abrupt zu springen.
        magnetInfluence = Math.pow(1 - distance / magnetRadius, 0.7);
        const pull = magnetInfluence * magnetPullSpeed;
        this.x += (dx / distance) * pull * dtSec;
        this.y += (dy / distance) * pull * dtSec;
        this.drawMagnetVisual(dx / distance, dy / distance, distance, magnetInfluence);
      } else {
        this.magnetVisual.clear();
        this.magnetVisual.setVisible(false);
      }
    } else {
      this.magnetVisual.clear();
      this.magnetVisual.setVisible(false);
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

    // Ein beschleunigtes Drehen macht den Sog auch dann lesbar, wenn die
    // eigentliche Distanz pro Frame auf kleinen Displays kaum auffaellt.
    this.orb.rotation += dtSec * (0.8 + magnetInfluence * 3.2);
    // Gegenlaeufig zum Relikt - die Bewegung bleibt dadurch lesbar, statt sich
    // zu einer einzigen drehenden Scheibe zu vermischen.
    if (this.rays) this.rays.rotation -= dtSec * 0.35;

    const remaining = this.lifetimeMs - this.ageMs;
    if (remaining <= FADE_OUT_MS) {
      const ratio = Phaser.Math.Clamp(remaining / FADE_OUT_MS, 0, 1);
      this.setAlpha(ratio);
      // Zusaetzliches Blinken, damit das Ablaufen nicht nur ueber Alpha laeuft.
      this.setScale(0.75 + ratio * 0.25);
    } else if (this.blinking && !prefersReducedMotion()) {
      // Nullsektor macht Relikte kurz unsichtbar, aber nicht unberechenbar:
      // der Sammelradius bleibt unverändert und der Effekt ist rhythmisch.
      const blink = (this.ageMs % 720) / 720;
      this.setAlpha(blink > 0.62 && blink < 0.78 ? 0.12 : 1);
    }
  }

  /** Markiert das Relikt als eingesammelt und spielt die Einzugs-Animation. */
  collect(onDone: () => void): void {
    if (this.collected) return;
    this.collected = true;
    this.magnetVisual.clear();
    this.magnetVisual.setVisible(false);

    if (prefersReducedMotion()) {
      this.setAlpha(0);
      onDone();
      return;
    }

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

  /** Zeichnet Richtung, Boegen und Nachlauf des aktiven Magnet-Sogs. */
  private drawMagnetVisual(
    directionX: number,
    directionY: number,
    distance: number,
    influence: number,
  ): void {
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    const phase = this.magnetMs / 175;
    const alpha = TALENT_MAGNET_ORB_ALPHA * (0.62 + influence * 0.38) * this.alpha;
    const streakLength = 18 + influence * TALENT_MAGNET_ORB_STREAK_LENGTH;
    const startOffset = this.radius * 0.65 + 5;

    this.magnetVisual.clear();
    this.magnetVisual.setVisible(true);

    // Zwei gegenlaeufige Boegen pulsieren um das Relikt und zeigen den
    // Magnetzustand, ohne die farbliche Seltenheit des Orbs zu verdecken.
    this.magnetVisual.lineStyle(3, this.rarity.color, alpha * 0.8);
    const orbitRadius = this.radius + 10 + (Math.sin(phase) + 1) * 3;
    const pullAngle = Math.atan2(directionY, directionX);
    this.magnetVisual.arc(
      this.x,
      this.y,
      orbitRadius,
      pullAngle + phase,
      pullAngle + phase + 1.05,
      false,
    );
    this.magnetVisual.arc(
      this.x,
      this.y,
      orbitRadius + 6,
      pullAngle + Math.PI + phase,
      pullAngle + Math.PI + phase + 0.82,
      false,
    );

    // Nachlaufstreifen liegen bewusst hinter dem Relikt: Das Auge erkennt
    // dadurch sofort "wird nach vorn gezogen" statt nur "leuchtet".
    const streakOffsets = [-7, 0, 7];
    for (const offset of streakOffsets) {
      const sideRatio = offset === 0 ? 1 : 0.72;
      const start = startOffset + Math.abs(offset) * 0.1;
      const end = start + streakLength * sideRatio;
      this.magnetVisual.lineStyle(
        TALENT_MAGNET_ORB_STREAK_WIDTH * sideRatio,
        this.rarity.color,
        alpha * sideRatio,
      );
      this.magnetVisual.lineBetween(
        this.x - directionX * start + perpendicularX * offset,
        this.y - directionY * start + perpendicularY * offset,
        this.x - directionX * end + perpendicularX * offset * 1.35,
        this.y - directionY * end + perpendicularY * offset * 1.35,
      );
    }

    // Pfeilspitze in Zugrichtung direkt vor dem Relikt.
    const arrowX = this.x + directionX * (this.radius + 5);
    const arrowY = this.y + directionY * (this.radius + 5);
    const arrowSideX = perpendicularX * 7;
    const arrowSideY = perpendicularY * 7;
    this.magnetVisual.lineStyle(TALENT_MAGNET_ORB_STREAK_WIDTH, this.rarity.color, alpha);
    this.magnetVisual.lineBetween(
      arrowX,
      arrowY,
      arrowX - directionX * 12 + arrowSideX,
      arrowY - directionY * 12 + arrowSideY,
    );
    this.magnetVisual.lineBetween(
      arrowX,
      arrowY,
      arrowX - directionX * 12 - arrowSideX,
      arrowY - directionY * 12 - arrowSideY,
    );

    // Bei sehr kurzer Distanz werden die Streifen kuerzer, damit sie nicht
    // ueber das Schiff hinauslaufen und die Fanganimation verdecken.
    if (distance < this.radius * 2.5) this.magnetVisual.setAlpha(0.72);
    else this.magnetVisual.setAlpha(1);
  }

  override destroy(fromScene?: boolean): void {
    this.magnetVisual.destroy();
    super.destroy(fromScene);
  }
}
