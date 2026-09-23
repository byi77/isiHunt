/**
 * Ein einsammelbares Relikt.
 *
 * Lebenszyklus: spawn (Skalierung von 0) -> driften -> in den letzten
 * `FADE_OUT_MS` verblassen -> `isExpired` wird true -> GameScene raeumt auf.
 * Das Objekt entfernt sich NICHT selbst, damit die Scene den Miss zaehlen kann.
 */

import Phaser from 'phaser';

import { GLOW_FX, RELIC_LIFETIME_ARC } from '@/config/effectVisuals';
import {
  MAGNET_PULL_SPEED,
  RARITY_IMPACT_MIN_POINTS,
  RARITY_RAYS_MIN_POINTS,
  TALENT_MAGNET_ORB_ALPHA,
  TALENT_MAGNET_ORB_STREAK_LENGTH,
  TALENT_MAGNET_ORB_STREAK_WIDTH,
} from '@/config/GameConfig';
import { RARITY_IDS, type RarityDef } from '@/config/rarities';
import { Depth } from '@/ui/depth';
import { applyGlow, playRareArrival } from '@/ui/effectsFx';
import { TextureKey } from '@/ui/textures';
import type { TextureKeyValue } from '@/ui/textures';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';

/** Zeitfenster am Lebensende, in dem das Relikt sichtbar verblasst. */
const FADE_OUT_MS = 700;

export interface CollectibleOptions {
  lifetimeScale?: number;
  driftMultiplier?: number;
  blinking?: boolean;
  /**
   * Driftrichtung in Radiant. Kommt aus dem geteilten Zufallsgenerator des
   * `SpawnSystem`, damit beide Duellanten dieselbe Bewegung sehen
   * (AUDIT_2026-09-05, Befund 9).
   */
  driftAngle?: number;
}

export class Collectible extends Phaser.GameObjects.Container {
  readonly rarity: RarityDef;
  readonly radius: number;

  private readonly orb: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly rays: Phaser.GameObjects.Image | null;
  /** Sichtbares Sog-Feedback direkt am Relikt. */
  private readonly magnetVisual: Phaser.GameObjects.Graphics;
  /** Restzeit als Bogen - wer mehrere Relikte sieht, weiss, welches eilt. */
  private readonly lifetimeArc: Phaser.GameObjects.Graphics;
  /** Zuletzt gezeichneter Restanteil; neu gezeichnet wird nur bei Aenderung. */
  private drawnLifetimeRatio = -1;
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

    // Glow und Strahlen bleiben auf der alten Reliktgroesse, damit die
    // Seltenheitsfarbe auch bei den echten Oberflaechen klar lesbar bleibt.
    const effectScale = rarity.radius / 30;

    this.glow = scene.add
      .image(0, 0, TextureKey.Glow)
      .setTint(rarity.color)
      .setScale(effectScale * 1.25)
      .setAlpha(0.65)
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

    // Zielgroesse statt Skalierungsfaktor: der Durchmesser folgt damit dem
    // Sammelradius und nicht der Aufloesung der Texturdatei. Ein Wechsel der
    // Bildgroesse (512 -> 256) veraendert das Spielgefuehl dadurch nicht.
    this.orb = scene.add
      .image(0, 0, planetTexture)
      .setDisplaySize(rarity.radius * 2, rarity.radius * 2);
    this.magnetVisual = scene.add.graphics().setDepth(Depth.Effects);
    this.magnetVisual.setVisible(false);

    this.add(this.rays ? [this.rays, this.glow, this.orb] : [this.glow, this.orb]);
    // Licht bleibt links oben, waehrend die Oberflaeche darunter rotiert.
    const lighting = scene.add
      .image(0, 0, TextureKey.RelicLight)
      .setDisplaySize(this.radius * 2, this.radius * 2);
    const contour = scene.add.graphics();
    contour.lineStyle(2, rarity.color, 0.95);
    contour.strokeCircle(0, 0, this.radius + 1.5);
    contour.lineStyle(1.5, 0xf0f7ff, 0.72);
    contour.beginPath();
    contour.arc(0, 0, this.radius - 1, Math.PI * 1.05, Math.PI * 1.58);
    contour.strokePath();
    // Anzahl statt Farbe allein: sechs feste Rangmarken fuer sechs Seltenheiten.
    const rank = RARITY_IDS.indexOf(rarity.id);
    for (let i = 0; i <= rank; i++) {
      const angle = Math.PI / 2 + (i - rank / 2) * 0.19;
      const x = Math.cos(angle) * (this.radius + 7);
      const y = Math.sin(angle) * (this.radius + 7);
      contour.fillStyle(rarity.color, 0.95);
      contour.fillCircle(x, y, rank >= 4 ? 2 : 1.5);
    }
    this.lifetimeArc = scene.add.graphics();
    this.add([lighting, contour, this.lifetimeArc]);
    this.setDepth(Depth.Collectible);
    scene.add.existing(this);
    this.drawLifetimeArc(1);

    // Seltenes spueren: Nur ab episch leuchtet der Planet selbst und reisst
    // beim Erscheinen einen Lichtspalt auf - dieselbe Schwelle wie Kamera-
    // Ruckler und doppelte Splitter beim Fang.
    if (rarity.points >= RARITY_IMPACT_MIN_POINTS) {
      applyGlow(this.orb, rarity.color, GLOW_FX.relicOuter, GLOW_FX.relicInner);
      playRareArrival(scene, x, y, rarity.color);
    }

    // Driftrichtung mit der seltenheitsabhaengigen Geschwindigkeit. Der Winkel
    // kommt vom Aufrufer; der Rueckfall auf `FloatBetween` gilt nur fuer
    // Aufrufe ohne Spawn-Plan (Debug-Tasten).
    const angle = options.driftAngle ?? Phaser.Math.FloatBetween(0, Math.PI * 2);
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
    if (!prefersReducedMotion()) {
      this.orb.rotation += dtSec * (0.25 + magnetInfluence * 2);
      if (this.rays) {
        this.rays.rotation -= dtSec * 0.22;
        this.glow.setAlpha(0.65 + Math.sin(this.ageMs / 280) * 0.12);
      }
    } else {
      this.glow.setAlpha(0.65);
    }
    // Gegenlaeufig zum Relikt - die Bewegung bleibt dadurch lesbar, statt sich
    // zu einer einzigen drehenden Scheibe zu vermischen.

    const remaining = this.lifetimeMs - this.ageMs;
    const lifetimeRatio = Phaser.Math.Clamp(remaining / this.lifetimeMs, 0, 1);
    if (Math.abs(lifetimeRatio - this.drawnLifetimeRatio) >= RELIC_LIFETIME_ARC.redrawStep) {
      this.drawLifetimeArc(lifetimeRatio);
    }
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

  /**
   * Restzeitbogen: beginnt oben und leert sich im Uhrzeigersinn.
   *
   * Vorher war der Ablauf erst in den letzten 700 ms zu sehen - zu spaet, um
   * noch umzusteuern. Der Bogen gilt auch bei reduzierter Bewegung, denn er
   * ist Spielinformation, keine Zierde; er aendert sich langsam und springt nie.
   */
  private drawLifetimeArc(ratio: number): void {
    const a = RELIC_LIFETIME_ARC;
    this.drawnLifetimeRatio = ratio;
    this.lifetimeArc.clear();
    if (ratio <= 0) return;
    const urgent = ratio <= a.urgentRatio;
    this.lifetimeArc.lineStyle(
      urgent ? a.urgentWidth : a.width,
      this.rarity.color,
      urgent ? a.urgentAlpha : a.alpha,
    );
    // Die Luecke waechst wie ein Uhrzeiger von zwoelf Uhr aus.
    const top = -Math.PI / 2;
    const full = Math.PI * 2;
    this.lifetimeArc.beginPath();
    this.lifetimeArc.arc(0, 0, this.radius + a.gap, top + (1 - ratio) * full, top + full, false);
    this.lifetimeArc.strokePath();
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
