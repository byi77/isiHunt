/**
 * Die Spielfigur.
 *
 * Bewegung ohne Physik-Engine: Position wird manuell integriert und die
 * Geschwindigkeit exponentiell an die Zielgeschwindigkeit angenaehert. Das
 * ergibt ein leichtes Nachziehen, ohne sich schwammig anzufuehlen - und haelt
 * das Spiel frei von Arcade-Physics-Konfiguration, die wir sonst nirgends
 * braeuchten (Kollision ist ein simpler Distanztest, siehe GameScene).
 */

import Phaser from 'phaser';

import { PLAYER_ACCEL_RESPONSE, PLAYER_TRAIL_MIN_SPEED } from '@/config/GameConfig';
import type { PlayerStats } from '@/config/talents';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import type { TextureKeyValue } from '@/ui/textures';

export class Player extends Phaser.GameObjects.Container {
  private readonly core: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly velocity = new Phaser.Math.Vector2();
  private slowRemainingMs = 0;
  private slowFactor = 1;
  private inertiaFactor = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private stats: PlayerStats,
    accentColor: number,
    textureKey: TextureKeyValue = TextureKey.PlayerCore,
  ) {
    super(scene, x, y);

    this.aura = scene.add
      .image(0, 0, TextureKey.Glow)
      .setTint(accentColor)
      .setScale(2.1)
      .setAlpha(0.75);
    this.halo = scene.add.image(0, 0, TextureKey.PlayerHalo).setTint(accentColor).setAlpha(0.8);
    this.core = scene.add.image(0, 0, textureKey).setTint(0xffffff);

    this.add([this.aura, this.halo, this.core]);
    this.setDepth(Depth.Player);
    scene.add.existing(this);

    // Spur: eigener Emitter im Weltkoordinatensystem, NICHT im Container.
    // Partikel im Container wuerden mit der Figur mitwandern - eine Spur muss
    // aber dort liegen bleiben, wo die Figur war.
    this.trail = scene.add.particles(0, 0, TextureKey.Glow, {
      lifespan: 420,
      scale: { start: 0.42, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: accentColor,
      blendMode: 'ADD',
      frequency: 34,
      quantity: 1,
      emitting: false,
    });
    this.trail.setDepth(Depth.Player - 1);

    this.syncHaloToRadius();

    // Sanftes Pulsieren - die Figur wirkt auch im Stillstand lebendig.
    scene.tweens.add({
      targets: this.core,
      scale: { from: 0.94, to: 1.06 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  get collectRadius(): number {
    return this.stats.collectRadius;
  }

  get magnetRadius(): number {
    return this.stats.magnetRadius;
  }

  setStats(stats: PlayerStats): void {
    this.stats = stats;
    this.syncHaloToRadius();
  }

  setWorldInertia(factor: number): void {
    this.inertiaFactor = Phaser.Math.Clamp(factor, 0.35, 1);
  }

  applySlow(durationMs: number, factor = 0.55): void {
    this.slowRemainingMs = Math.max(this.slowRemainingMs, durationMs);
    this.slowFactor = Math.min(this.slowFactor, Phaser.Math.Clamp(factor, 0.3, 1));
  }

  /**
   * @param dtSec Vergangene Zeit in Sekunden.
   * @param direction Bewegungsrichtung, Laenge 0..1 (0 = Stillstand).
   * @param bounds Spielfeldgrenzen, in denen die Figur bleiben muss.
   */
  move(dtSec: number, direction: Phaser.Math.Vector2, bounds: Phaser.Geom.Rectangle): void {
    this.slowRemainingMs = Math.max(0, this.slowRemainingMs - dtSec * 1000);
    if (this.slowRemainingMs === 0) this.slowFactor = 1;
    const desiredSpeed = this.stats.moveSpeed * this.slowFactor;
    const desiredX = direction.x * desiredSpeed;
    const desiredY = direction.y * desiredSpeed;

    // Exponentielle Annaeherung ist frameratenunabhaengig - anders als ein
    // fester Lerp-Faktor, der bei 120 Hz doppelt so schnell reagieren wuerde.
    const t = 1 - Math.exp(-PLAYER_ACCEL_RESPONSE * this.inertiaFactor * dtSec);
    this.velocity.x += (desiredX - this.velocity.x) * t;
    this.velocity.y += (desiredY - this.velocity.y) * t;

    this.x = Phaser.Math.Clamp(this.x + this.velocity.x * dtSec, bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + this.velocity.y * dtSec, bounds.top, bounds.bottom);

    // Spur nur bei echter Bewegung - im Stillstand wuerde sie sich zu einem
    // Fleck unter der Figur aufstauen.
    const speed = this.velocity.length();
    this.trail.setPosition(this.x, this.y);
    this.trail.emitting = speed > PLAYER_TRAIL_MIN_SPEED;

    this.halo.rotation += dtSec * 1.2;
    // Leichte Neigung in Bewegungsrichtung - reine Spielgefuehl-Politur.
    this.core.rotation = Phaser.Math.Linear(
      this.core.rotation,
      (this.velocity.x / this.stats.moveSpeed) * 0.4,
      1 - Math.exp(-8 * dtSec),
    );
  }

  /** Kurzer visueller Impuls beim Einsammeln. */
  pulse(color: number): void {
    this.scene.tweens.add({
      targets: this.aura,
      scale: { from: 2.6, to: 2.1 },
      alpha: { from: 1, to: 0.75 },
      duration: 220,
      ease: 'Quad.Out',
    });
    this.aura.setTint(color);
  }

  setAccent(color: number): void {
    this.aura.setTint(color);
    this.halo.setTint(color);
    this.trail.setParticleTint(color);
  }

  /**
   * Der Emitter haengt nicht am Container und wird deshalb nicht automatisch
   * mit zerstoert - ohne dieses Override ueberlebt die Spur den Run.
   */
  override destroy(fromScene?: boolean): void {
    this.trail.destroy();
    super.destroy(fromScene);
  }

  /** Der Ring zeigt exakt den Sammelradius - wichtig fuer faires Feedback. */
  private syncHaloToRadius(): void {
    const haloTextureRadius = 54; // siehe createPlayerHalo()
    this.halo.setScale(this.stats.collectRadius / haloTextureRadius);
  }
}
