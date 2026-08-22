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

import {
  PLAYER_ACCEL_RESPONSE,
  PLAYER_BASE_COLLECT_RADIUS,
  PLAYER_TRAIL_MIN_SPEED,
  SERIES_TRAIL_BASE_ALPHA,
  SERIES_TRAIL_BASE_FREQUENCY_MS,
  SERIES_TRAIL_BASE_LIFESPAN_MS,
  SERIES_TRAIL_BASE_SCALE,
  SERIES_TRAIL_CORE_MIN_ALPHA,
  SERIES_TRAIL_GLOW_ALPHA,
  SERIES_TRAIL_GLOW_WIDTH_MULTIPLIER,
  SERIES_TRAIL_IDLE_TICKS_PER_DROP,
  SERIES_TRAIL_LINE_WIDTH,
  SERIES_TRAIL_SAMPLE_MS,
  SERIES_TRAIL_SMOOTHING_DIVISIONS,
  TALENT_MAGNET_FIELD_ALPHA,
  TALENT_MAGNET_FIELD_WIDTH,
  TALENT_MAGNET_LINE_ALPHA,
  TALENT_MAGNET_LINE_START_OFFSET,
  TALENT_MAGNET_LINE_WIDTH,
  TALENT_MAGNET_MAX_LINES,
  TALENT_FOCUS_RING_ALPHA,
  TALENT_FOCUS_RING_WIDTH,
  TALENT_REACH_RING_ALPHA,
  TALENT_REACH_RING_WIDTH,
  TALENT_SPEED_STREAK_BASE_ALPHA,
  TALENT_SPEED_STREAK_BASE_LENGTH,
  TALENT_SPEED_STREAK_SPEED_LENGTH,
  TALENT_SPEED_STREAK_TALENT_ALPHA,
  TALENT_SPEED_STREAK_TALENT_LENGTH,
  TALENT_SPEED_STREAK_WIDTH,
} from '@/config/GameConfig';
import { talentMaxRank, type PlayerStats, type TalentId } from '@/config/talents';
import { Depth } from '@/ui/depth';
import { auraAssetForId, type Ego3DAsset } from '@/ui/egoAssets';
import {
  applyTintShift,
  SHIP_ANIMATIONS,
  stehendesBild,
  type AuraAnimation,
} from '@/ui/shipAnimations';
import { TextureKey } from '@/ui/textures';
import type { TextureKeyValue } from '@/ui/textures';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { ThreeDShipPreview } from '@/ui/threeDShipPreview';

/**
 * Wie lange der Fangimpuls den Schein behaelt, bevor die Aura ihn
 * zurueckbekommt. Entspricht der Dauer des Impuls-Tweens.
 */
const PULSE_HOLD_MS = 220;

/** Eine Stufe der Serien-Schleife, wie sie `SERIES_TRAIL_TIERS` beschreibt. */
export interface SeriesTrailTier {
  readonly minSeries: number;
  readonly lifespanMs: number;
  readonly color: number;
  readonly frequencyMs: number;
  readonly scale: number;
  readonly alpha: number;
  readonly points: number;
}

/** Minimaler Datensatz fuer die Magnet-Visualisierung. */
export interface TalentVisualTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly isCollected: boolean;
  readonly isExpired: boolean;
}

function talentRankRatio(stats: PlayerStats, id: TalentId): number {
  const maxRank = talentMaxRank(id) || 1;
  return Phaser.Math.Clamp(stats.talentRanks[id] / maxRank, 0, 1);
}

export class Player extends Phaser.GameObjects.Container {
  private readonly core: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly threeDPreview: ThreeDShipPreview | null = null;
  private readonly threeDPreviewDom: Phaser.GameObjects.DOMElement | null = null;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly velocity = new Phaser.Math.Vector2();
  private slowRemainingMs = 0;
  private slowFactor = 1;
  private inertiaFactor = 1;
  /** Weltfarbe - die Spur faellt darauf zurueck, wenn keine Serie laeuft. */
  private accentColor: number;
  private seriesTier: SeriesTrailTier | null = null;
  /** Weiche Aussenkontur; der Partikel-Emitter untermalt beide Linien nur. */
  private readonly trailGlowLine: Phaser.GameObjects.Graphics;
  /** Lesbare Kernspur mit klarer Kante. */
  private readonly trailLine: Phaser.GameObjects.Graphics;
  /** Sichtbarer Ring fuer das Reichweite-Talent. */
  private readonly reachRing: Phaser.GameObjects.Graphics;
  /** Feld und Verbindungslinien fuer das Magnetismus-Talent. */
  private readonly magnetField: Phaser.GameObjects.Graphics;
  /** Richtungsstreifen, die Geschwindigkeit und Flinkheit lesbar machen. */
  private readonly speedStreaks: Phaser.GameObjects.Graphics;
  /** Letzte Positionen, aelteste zuerst. Laenge steuert die Schleifenlaenge. */
  private trailPoints: { x: number; y: number }[] = [];
  private trailSampleMs = 0;
  private trailIdleTicks = 0;
  /** Die getragene Aura-Bewegung, oder `null` fuer keine. */
  private auraAnimation: AuraAnimation | null = null;
  /** Optionales externes Overlay-Asset der getragenen Aura. */
  private auraAssetId: string | undefined;
  /**
   * Laufzeit der Aura.
   *
   * Eigener Zaehler statt `scene.time.now`: Die Bewegung muss am `delta`
   * haengen (Regel 5), sonst laeuft sie im `--sim`-Playtest, der `update()`
   * selbst taktet, gegen die Wanduhr statt gegen die Spielzeit.
   */
  private auraMs = 0;
  /** Rumpffarbe ohne Aura - die Aura verschiebt immer von hier aus. */
  private readonly hullColor: number;
  /**
   * Grundskalierung des Rumpfs, wie der Ruhe-Tween sie gerade setzt.
   *
   * Die Aura multipliziert damit, statt `scale` direkt zu setzen: Sonst
   * ueberschriebe sie das sanfte Pulsieren aus dem Konstruktor, und ein Schiff
   * ohne Aura saehe lebendiger aus als eins mit.
   */
  private ruheScale = 1;
  /** Neigung aus der Bewegung, getrennt von der Drehung der Aura. */
  private neigung = 0;
  /**
   * Solange > 0, gehoert der Schein dem Fangimpuls, nicht der Aura.
   *
   * Ohne diese Sperre ueberschriebe `applyAura()` die Reliktfarbe aus
   * `pulse()` im naechsten Frame - der Fangimpuls waere unter einer
   * getragenen Aura unsichtbar, und gerade er ist das wichtigste Feedback
   * im Spiel.
   */
  private pulseRestMs = 0;
  /** Eigene Uhr fuer die sanfte Pulsation der Talent-Visuals. */
  private talentVisualMs = 0;
  /**
   * Ob die Aura laeuft. Vor dem Startpfiff steht sie.
   *
   * Der Ruhe-Tween ruft `applyAura()` per `onUpdate` und haengt an Phasers
   * Zeit, nicht an `GameScene.update()` - er laeuft also auch waehrend des
   * Countdowns, wo `move()` den Zaehler noch nicht fortschreibt. Ohne dieses
   * Flag zeichnete er die Figur die ganze Wartezeit ueber auf dem t=0-Frame:
   * bei der Prismaflut ein kraeftiges Rot statt der Weltfarbe.
   *
   * Ein blosses `auraMs === 0` als Bedingung reicht dafuer nicht - der Wert
   * ist auch im ersten echten Frame noch fast 0.
   */
  private auraLaeuft = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private stats: PlayerStats,
    accentColor: number,
    textureKey: TextureKeyValue = TextureKey.PlayerCore,
    /** Rumpffarbe. Standard weiss - siehe `shipHullTint()`. */
    hullColor: number = 0xffffff,
    /** Optionales 3D-Modell fuer die echte Jagd; 2D bleibt der Fallback. */
    threeDAsset: Ego3DAsset | undefined = undefined,
  ) {
    super(scene, x, y);
    this.accentColor = accentColor;

    this.aura = scene.add
      .image(0, 0, TextureKey.Glow)
      .setTint(accentColor)
      .setScale(2.1)
      .setAlpha(0.75);
    this.halo = scene.add.image(0, 0, TextureKey.PlayerHalo).setTint(accentColor).setAlpha(0.8);
    // Der Rumpf traegt die gekaufte Farbe, bei Weltfarbe bleibt er weiss.
    //
    // Bis 2026-08-20 stand hier fest `0xffffff` - aus der Zeit, als die Figur
    // immer weiss war und nur ihr Schein die Weltfarbe trug. Mit kaufbaren
    // Farben ergab das keinen Sinn: Wer Gold kauft, bekam ein weisses Schiff
    // mit goldenem Rand. Ihn pauschal mit `accentColor` zu faerben war aber
    // auch falsch - dann steht eine gruene Figur auf gruenem Grund. Die
    // Entscheidung faellt in `shipHullTint()`.
    this.core = scene.add.image(0, 0, textureKey).setTint(hullColor);
    this.hullColor = hullColor;

    this.add([this.aura, this.halo, this.core]);
    this.setDepth(Depth.Player);
    scene.add.existing(this);

    if (threeDAsset !== undefined) {
      const dom = scene.add
        .dom(x, y, 'canvas', { width: '132px', height: '132px' })
        .setDepth(Depth.Player + 1);
      // Phaser setzt DOMElement.pointerEvents standardmaessig auf `auto` und
      // wuerde damit die Touchflaeche ueber dem Spielfeld abfangen. Das 3D-
      // Overlay ist reine Darstellung und darf niemals die Jagdsteuerung
      // blockieren.
      dom.pointerEvents = 'none';
      this.threeDPreviewDom = dom;
      this.threeDPreview = new ThreeDShipPreview(
        dom.node as HTMLCanvasElement,
        132,
        132,
        (available) => {
          // Das Canvas wird von Phaser als DOMElement verwaltet. Die
          // CSS-Sichtbarkeit allein kann beim naechsten Render-Frame wieder
          // ueberschrieben werden; deshalb muss auch der Wrapper wechseln.
          dom.setVisible(available);
          this.core.setVisible(!available);
        },
      );
      this.threeDPreview.setModel(threeDAsset, hullColor);
    }

    // Spur: eigener Emitter im Weltkoordinatensystem, NICHT im Container.
    // Partikel im Container wuerden mit der Figur mitwandern - eine Spur muss
    // aber dort liegen bleiben, wo die Figur war.
    this.trail = scene.add.particles(0, 0, TextureKey.Glow, {
      lifespan: SERIES_TRAIL_BASE_LIFESPAN_MS,
      scale: { start: SERIES_TRAIL_BASE_SCALE, end: 0 },
      alpha: { start: SERIES_TRAIL_BASE_ALPHA, end: 0 },
      tint: accentColor,
      blendMode: 'ADD',
      frequency: SERIES_TRAIL_BASE_FREQUENCY_MS,
      quantity: 1,
      emitting: false,
    });
    this.trail.setDepth(Depth.Player - 1);

    // Eigenes Graphics-Objekt statt eines Containers-Kindes: Die Schleife
    // liegt im Weltkoordinatensystem, genau wie der Emitter.
    this.trailGlowLine = scene.add.graphics();
    this.trailGlowLine.setDepth(Depth.Player - 2);
    this.trailLine = scene.add.graphics();
    this.trailLine.setDepth(Depth.Player - 1);

    this.speedStreaks = scene.add.graphics().setDepth(Depth.Player - 3);
    this.reachRing = scene.add.graphics().setDepth(Depth.Player - 1);
    this.magnetField = scene.add.graphics().setDepth(Depth.Effects);

    this.syncHaloToRadius();

    // Sanftes Pulsieren - die Figur wirkt auch im Stillstand lebendig.
    //
    // Der Tween laeuft auf `ruheScale` und nicht mehr auf `this.core` direkt:
    // Eine Aura muss ihre eigene Skalierung daraufsetzen koennen, und zwei
    // Schreiber auf demselben `scale` bedeuten, dass der letzte gewinnt - je
    // nach Reihenfolge im Frame flackernd.
    this.ruheScale = 1;
    if (!prefersReducedMotion()) {
      this.ruheScale = 0.94;
      scene.tweens.add({
        targets: this,
        ruheScale: { from: 0.94, to: 1.06 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        onUpdate: () => this.applyAura(),
      });
    }
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

  /**
   * Zeichnet die Talentwirkung direkt im Spielfeld.
   *
   * Die Anzeige bleibt an die aufgeloesten Stats gekoppelt: Aendert sich die
   * Balance, aendert sich auch die Groesse und Staerke des Feedbacks ohne eine
   * zweite Wertetabelle. `targets` kommt nach dem Orb-Tick, damit die Linien
   * tatsaechlich dem aktuellen Sog folgen.
   */
  updateTalentVisuals(
    deltaMs: number,
    targets: readonly TalentVisualTarget[],
    comboTimerRatio = 0,
  ): void {
    this.talentVisualMs += Math.max(0, deltaMs);
    const pulse = prefersReducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(this.talentVisualMs / 180);

    this.reachRing.clear();
    const reachBoost = this.stats.collectRadius - PLAYER_BASE_COLLECT_RADIUS;
    const reachRatio = talentRankRatio(this.stats, 'reach');
    if (reachBoost > 0) {
      const radius = this.stats.collectRadius + 5 + pulse * (3 + reachRatio * 4);
      const ringWidth = TALENT_REACH_RING_WIDTH + reachRatio * 3;
      const ringAlpha = TALENT_REACH_RING_ALPHA + reachRatio * 0.16;
      this.reachRing.lineStyle(ringWidth, this.accentColor, ringAlpha);
      this.reachRing.strokeCircle(this.x, this.y, radius);
      this.reachRing.lineStyle(2 + reachRatio * 2, this.accentColor, ringAlpha * 0.55);
      this.reachRing.strokeCircle(this.x, this.y, radius - 8 - reachRatio * 3);
    }

    const focusRatio = talentRankRatio(this.stats, 'focus');
    if (focusRatio > 0 && comboTimerRatio > 0) {
      const focusRadius = this.stats.collectRadius + 16 + focusRatio * 12;
      this.reachRing.lineStyle(
        TALENT_FOCUS_RING_WIDTH + focusRatio * 3,
        0xffd479,
        TALENT_FOCUS_RING_ALPHA,
      );
      this.reachRing.arc(
        this.x,
        this.y,
        focusRadius,
        -Math.PI / 2,
        -Math.PI / 2 + Phaser.Math.Clamp(comboTimerRatio, 0, 1) * Math.PI * 2,
        false,
      );
    }

    this.magnetField.clear();
    if (this.stats.magnetRadius <= 0) return;

    const magnetRatio = talentRankRatio(this.stats, 'magnetism');
    const magnetRank = this.stats.talentRanks.magnetism;
    const fieldAlpha = TALENT_MAGNET_FIELD_ALPHA * (0.86 + pulse * 0.14) + magnetRatio * 0.16;
    this.magnetField.lineStyle(
      TALENT_MAGNET_FIELD_WIDTH + magnetRatio * 2,
      this.accentColor,
      fieldAlpha,
    );
    this.magnetField.strokeCircle(this.x, this.y, this.stats.magnetRadius);
    const fieldRings = Math.max(1, magnetRank);
    for (let ring = 1; ring <= fieldRings; ring += 1) {
      const ringRatio = ring / (fieldRings + 1);
      this.magnetField.lineStyle(2, this.accentColor, fieldAlpha * (0.3 + ringRatio * 0.22));
      this.magnetField.strokeCircle(
        this.x,
        this.y,
        this.stats.magnetRadius * (0.56 + ringRatio * 0.28),
      );
    }

    const candidates = targets
      .filter((target) => !target.isCollected && !target.isExpired)
      .map((target) => ({
        target,
        distance: Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y),
      }))
      .filter(({ distance }) => distance > 1 && distance < this.stats.magnetRadius)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, Math.min(TALENT_MAGNET_MAX_LINES, 2 + magnetRank));

    for (const { target, distance } of candidates) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const nx = dx / distance;
      const ny = dy / distance;
      const startOffset = Math.min(TALENT_MAGNET_LINE_START_OFFSET, distance * 0.25);
      const endOffset = Math.min(Math.max(8, target.radius * 0.65), distance * 0.2);
      const alpha = Phaser.Math.Clamp(
        (1 - distance / this.stats.magnetRadius) * TALENT_MAGNET_LINE_ALPHA,
        0.18,
        TALENT_MAGNET_LINE_ALPHA,
      );

      this.magnetField.lineStyle(TALENT_MAGNET_LINE_WIDTH, this.accentColor, alpha);
      this.magnetField.lineBetween(
        this.x + nx * startOffset,
        this.y + ny * startOffset,
        target.x - nx * endOffset,
        target.y - ny * endOffset,
      );

      // Kleiner Pfeilkopf am Schiff: die Richtung des Sogs ist sofort lesbar.
      const arrowX = this.x + nx * (startOffset + 6);
      const arrowY = this.y + ny * (startOffset + 6);
      const sideX = -ny * 7;
      const sideY = nx * 7;
      this.magnetField.lineBetween(
        arrowX,
        arrowY,
        arrowX + nx * 9 + sideX,
        arrowY + ny * 9 + sideY,
      );
      this.magnetField.lineBetween(
        arrowX,
        arrowY,
        arrowX + nx * 9 - sideX,
        arrowY + ny * 9 - sideY,
      );
    }
  }

  setWorldInertia(factor: number): void {
    this.inertiaFactor = Phaser.Math.Clamp(factor, 0.35, 1);
  }

  /** Haelt die optionale 3D-Darstellung auf der Phaser-Spielerposition. */
  updateThreeD(deltaMs: number): void {
    if (this.threeDPreview === null) return;
    this.threeDPreviewDom?.setPosition(this.x, this.y);
    this.threeDPreview.update(deltaMs);
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
    this.drawSpeedStreaks(speed);

    this.trackTrail(dtSec * 1000, speed);

    this.halo.rotation += dtSec * 1.2;
    // Leichte Neigung in Bewegungsrichtung - reine Spielgefuehl-Politur.
    //
    // Auf ein eigenes Feld statt direkt auf `core.rotation`: Die Aura addiert
    // ihre Drehung darauf, und wer beide auf dasselbe Attribut schreibt,
    // ueberschreibt den jeweils anderen.
    this.neigung = Phaser.Math.Linear(
      this.neigung,
      (this.velocity.x / this.stats.moveSpeed) * 0.4,
      1 - Math.exp(-8 * dtSec),
    );

    this.auraLaeuft = true;
    this.auraMs += dtSec * 1000;
    this.pulseRestMs = Math.max(0, this.pulseRestMs - dtSec * 1000);
    this.applyAura();
  }

  /**
   * Legt die getragene Aura an.
   *
   * `null` stellt den ruhigen Grundzustand her. Der Zaehler beginnt bei jedem
   * Wechsel neu, damit eine Bewegung immer an ihrem Anfang einsetzt - mitten
   * im Sog einer Singularitaet zu starten sieht wie ein Fehler aus.
   */
  setAura(animIndex: number | null, auraAssetId: string | undefined = undefined): void {
    this.auraAnimation = animIndex === null ? null : (SHIP_ANIMATIONS[animIndex] ?? null);
    this.auraAssetId = auraAssetId;
    this.auraMs = 0;
    // Erst der erste `move()` startet sie - siehe `auraLaeuft`. Die Aura
    // gehoert zum Spiel, nicht zum Warten davor.
    this.auraLaeuft = false;
    this.applyAura();
  }

  /**
   * Schreibt den aktuellen Augenblick der Aura auf den Rumpf.
   *
   * Wird aus zwei Richtungen gerufen: aus `move()` je Frame und aus dem
   * Ruhe-Tween, der `ruheScale` fortschreibt. Ohne den zweiten Aufruf bliebe
   * das Pulsieren stehen, sobald die Figur stillsteht und `move()` die Aura
   * zwar weiterzaehlt, der Tween aber dazwischen mehrfach feuert.
   */
  private applyAura(): void {
    // Bei reduziertem Bewegungswunsch die Aura einmal einfrieren statt sie
    // je Frame neu zu rechnen - siehe `stehendesBild()`.
    const frame =
      this.auraAnimation === null || !this.auraLaeuft
        ? null
        : prefersReducedMotion()
          ? stehendesBild(this.auraAnimation)
          : this.auraAnimation(this.auraMs);
    if (frame === null) {
      this.aura.setTexture(TextureKey.Glow).setScale(2.1 * this.ruheScale);
      this.core.setScale(this.ruheScale);
      this.core.rotation = this.neigung;
      this.core.setAlpha(1);
      this.core.setTint(this.hullColor);
      return;
    }

    this.core.setScale(this.ruheScale * frame.scaleX, this.ruheScale * frame.scaleY);
    this.core.rotation = this.neigung + frame.rotation;
    this.core.setAlpha(frame.alpha);
    this.core.setTint(applyTintShift(this.hullColor, frame.tint));

    const auraAsset = auraAssetForId(this.auraAssetId);
    if (auraAsset !== undefined) {
      const frameIndex =
        Math.floor(this.auraMs / auraAsset.frameDurationMs) % auraAsset.frameTextureKeys.length;
      const textureKey = auraAsset.frameTextureKeys[frameIndex] ?? auraAsset.frameTextureKeys[0];
      if (textureKey !== undefined) this.aura.setTexture(textureKey);
      this.aura.setScale(
        this.ruheScale * frame.scaleX * auraAsset.scaleMultiplier,
        this.ruheScale * frame.scaleY * auraAsset.scaleMultiplier,
      );
    } else {
      this.aura.setTexture(TextureKey.Glow).setScale(2.1 * this.ruheScale);
    }

    // Schein und Ring laufen mit, wenn die Aura den Farbton dreht.
    //
    // Ohne das truege eine Figur im vollen Farblauf weiterhin einen
    // goldenen Schein - das sieht nach halb fertigem Effekt aus, nicht nach
    // der teuersten Aura des Spiels. Bei den uebrigen Auren (`hue` nahe 0)
    // aendert die Rechnung praktisch nichts, deshalb braucht es hier keine
    // Fallunterscheidung.
    //
    // Zwei Faelle haben Vorrang vor der Aura: ein laufender Fangimpuls
    // (wichtigstes Feedback im Spiel) und eine laufende Serie, der die Spur
    // gehoert (siehe `setSeriesTrail`).
    if (this.seriesTier === null && this.pulseRestMs <= 0) {
      const scheinFarbe = applyTintShift(this.accentColor, frame.tint);
      this.aura.setTint(scheinFarbe);
      this.halo.setTint(scheinFarbe);
    }
  }

  /** Kurzer visueller Impuls beim Einsammeln. */
  pulse(color: number): void {
    // Fuer diese Zeit haelt der Impuls den Schein - siehe `pulseRestMs`.
    this.pulseRestMs = PULSE_HOLD_MS;
    if (prefersReducedMotion()) {
      this.aura.setTint(color).setScale(2.1).setAlpha(0.75);
      return;
    }
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
    this.accentColor = color;
    this.aura.setTint(color);
    this.halo.setTint(color);
    if (this.seriesTier === null) this.trail.setParticleTint(color);
  }

  /**
   * Setzt die Schleife auf die Stufe der laufenden Serie.
   *
   * Die sichtbare Laenge einer Partikelspur ergibt sich aus der Lebensdauer
   * ihrer Partikel - laenger lebende Partikel bleiben weiter hinten liegen.
   * Deshalb wird `lifespan` gesetzt und nicht etwa die Partikelzahl: Die
   * Dichte der Spur bleibt so gleich, nur ihr Nachlauf waechst.
   *
   * `null` stellt den ruhigen Grundzustand her (kurze Spur in der Weltfarbe).
   */
  setSeriesTrail(tier: SeriesTrailTier | null): void {
    // Ohne diesen Vergleich wuerde bei jedem Fang neu gesetzt - die Werte
    // wirken nur auf neu erzeugte Partikel, und ein Wechsel je Frame laesst
    // die Spur flackern.
    if (tier === null) {
      const hadSeries = this.seriesTier !== null;
      this.seriesTier = null;
      this.clearTrailPath();
      if (!hadSeries) return;
      this.applyTrail(
        SERIES_TRAIL_BASE_LIFESPAN_MS,
        this.accentColor,
        SERIES_TRAIL_BASE_FREQUENCY_MS,
        SERIES_TRAIL_BASE_SCALE,
        SERIES_TRAIL_BASE_ALPHA,
      );
      return;
    }

    if (this.seriesTier?.minSeries === tier.minSeries) return;

    this.seriesTier = tier;
    this.applyTrail(tier.lifespanMs, tier.color, tier.frequencyMs, tier.scale, tier.alpha);
  }

  /**
   * Setzt die Werte des Partikel-Nebels, der die Schleife untermalt.
   *
   * `setParticleTint` faerbt auch bereits fliegende Partikel um. Das ist hier
   * gewollt: Die Schleife soll beim Stufenwechsel sofort komplett die neue
   * Farbe tragen, nicht ueber eine Sekunde hinweg durchlaufen.
   */
  private applyTrail(
    lifespanMs: number,
    color: number,
    frequencyMs: number,
    scale: number,
    alpha: number,
  ): void {
    this.trail.lifespan = lifespanMs;
    this.trail.frequency = frequencyMs;
    this.trail.setParticleTint(color);
    this.trail.setParticleScale(scale, scale);
    this.trail.setParticleAlpha(alpha);
  }

  /**
   * Schreibt die aktuelle Position in die Schleife fort.
   *
   * In festen Zeitabstaenden abtasten statt in jedem Frame: Sonst haengt die
   * Schleifenlaenge an der Bildrate - bei 120 Hz waere sie halb so lang wie
   * bei 60 Hz, obwohl das Schiff denselben Weg zurueckgelegt hat (Regel 5).
   */
  private trackTrail(deltaMs: number, speed: number): void {
    if (this.seriesTier === null) {
      if (this.trailPoints.length > 0) this.clearTrailPath();
      return;
    }

    this.trailSampleMs += deltaMs;
    if (this.trailSampleMs >= SERIES_TRAIL_SAMPLE_MS) {
      this.trailSampleMs = 0;
      // Im Stillstand keinen neuen Punkt setzen - die Schleife wuerde sich
      // sonst zu einem Knoten unter dem Schiff zusammenziehen.
      if (speed > PLAYER_TRAIL_MIN_SPEED) {
        this.trailPoints.push({ x: this.x, y: this.y });
        this.trailIdleTicks = 0;
        while (this.trailPoints.length > this.seriesTier.points) this.trailPoints.shift();
      } else if (this.trailPoints.length > 0) {
        // Steht das Schiff, laeuft die Schleife hinten aus - aber traege.
        // Ein Punkt je Abtastung liess sie bei kurzen Stopps komplett
        // verschwinden (Stufe 1 hat nur 10 Punkte, das waren 260 ms). Beim
        // Spielen sind solche Stopps staendig, die Schleife flackerte dadurch.
        this.trailIdleTicks += 1;
        if (this.trailIdleTicks >= SERIES_TRAIL_IDLE_TICKS_PER_DROP) {
          this.trailIdleTicks = 0;
          this.trailPoints.shift();
        }
      }
    }

    this.drawSeriesTrail();
  }

  /**
   * Zeichnet die Schleife als durchgehende Linie entlang der letzten
   * Positionen.
   *
   * **Warum eine Linie und nicht nur Partikel.** Der erste Versuch setzte
   * allein auf den vorhandenen Partikel-Emitter mit `blendMode: 'ADD'` und der
   * weichen `Glow`-Textur. Technisch entstanden dabei ueber hundert Partikel,
   * aber sichtbar war nichts: Auf dem hellen Weltraumhintergrund wusch der
   * additive Modus jede Farbe zu einem diffusen Nebel aus, der sich nicht von
   * den Relikt-Auren unterscheiden liess. Eine Schleife braucht eine Kante -
   * und die liefert nur eine gezeichnete Linie.
   *
   * Der Partikel-Nebel bleibt als Untermalung erhalten; er gibt der Linie
   * ihren Schimmer.
   */
  private drawSeriesTrail(): void {
    this.trailGlowLine.clear();
    this.trailLine.clear();
    if (this.seriesTier === null || this.trailPoints.length < 2) return;

    const { color } = this.seriesTier;
    const punkte = this.trailPoints;

    // Von hinten nach vorn zeichnen: Das aelteste Segment ist am duennsten und
    // blassesten, direkt hinter dem Schiff ist die Schleife am kraeftigsten.
    for (let i = 1; i < punkte.length; i++) {
      const anteil = i / (punkte.length - 1);
      const vorher = punkte[i - 1]!;
      const jetzt = punkte[i]!;
      const naechstes = punkte[i + 1] ?? jetzt;
      // Die Mittelpunkte verhindern harte Knicke: Jeder Stützpunkt lenkt die
      // Kurve, wird aber nicht als Ecke sichtbar. Die Segmentbreite und das
      // Ausblenden bleiben trotzdem pro Abschnitt steuerbar.
      const start =
        i === 1
          ? vorher
          : {
              x: (vorher.x + jetzt.x) / 2,
              y: (vorher.y + jetzt.y) / 2,
            };
      const ziel =
        i === punkte.length - 1
          ? jetzt
          : {
              x: (jetzt.x + naechstes.x) / 2,
              y: (jetzt.y + naechstes.y) / 2,
            };

      // Nach hinten auslaufen, aber nicht ins Nichts: Die Kernlinie behaelt
      // eine Mindesttransparenz, waehrend die Aussenkontur weich auslaeuft.
      const verlauf = 0.25 + 0.75 * anteil;
      const coreAlpha = Math.max(SERIES_TRAIL_CORE_MIN_ALPHA, this.seriesTier.alpha * verlauf);
      const coreWidth = SERIES_TRAIL_LINE_WIDTH * this.seriesTier.scale * verlauf;

      // Zwei bewusst getrennte Linien sind auf hellen Welten robuster als
      // mehr additive Partikel: erst der breite, weiche Schimmer, dann die
      // schmale Kante, die die Bewegungsrichtung lesbar macht.
      this.trailGlowLine.lineStyle(
        coreWidth * SERIES_TRAIL_GLOW_WIDTH_MULTIPLIER,
        color,
        coreAlpha * SERIES_TRAIL_GLOW_ALPHA,
      );
      new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2(jetzt.x, jetzt.y),
        new Phaser.Math.Vector2(ziel.x, ziel.y),
      ).draw(this.trailGlowLine, SERIES_TRAIL_SMOOTHING_DIVISIONS);

      this.trailLine.lineStyle(coreWidth, color, coreAlpha);
      new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2(jetzt.x, jetzt.y),
        new Phaser.Math.Vector2(ziel.x, ziel.y),
      ).draw(this.trailLine, SERIES_TRAIL_SMOOTHING_DIVISIONS);
    }
  }

  /**
   * Der Emitter haengt nicht am Container und wird deshalb nicht automatisch
   * mit zerstoert - ohne dieses Override ueberlebt die Spur den Run.
   */
  override destroy(fromScene?: boolean): void {
    this.threeDPreview?.destroy();
    this.threeDPreviewDom?.destroy();
    this.trail.destroy();
    this.trailGlowLine.destroy();
    this.trailLine.destroy();
    this.reachRing.destroy();
    this.magnetField.destroy();
    this.speedStreaks.destroy();
    super.destroy(fromScene);
  }

  private clearTrailPath(): void {
    this.trailPoints = [];
    this.trailSampleMs = 0;
    this.trailIdleTicks = 0;
    this.trailGlowLine.clear();
    this.trailLine.clear();
  }

  /** Zeichnet drei klare Bewegungsstreifen statt nur eines diffusen Partikelschweifs. */
  private drawSpeedStreaks(speed: number): void {
    this.speedStreaks.clear();
    if (speed <= PLAYER_TRAIL_MIN_SPEED || this.velocity.lengthSq() <= 1) return;

    const direction = this.velocity.clone().normalize();
    const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);
    const speedRatio = Phaser.Math.Clamp(speed / this.stats.moveSpeed, 0, 1);
    const swiftnessRank = this.stats.talentRanks.swiftness;
    const talentRatio = talentRankRatio(this.stats, 'swiftness');
    const length =
      TALENT_SPEED_STREAK_BASE_LENGTH +
      speedRatio * TALENT_SPEED_STREAK_SPEED_LENGTH +
      talentRatio * TALENT_SPEED_STREAK_TALENT_LENGTH;
    const alpha =
      TALENT_SPEED_STREAK_BASE_ALPHA +
      speedRatio * 0.12 +
      talentRatio * TALENT_SPEED_STREAK_TALENT_ALPHA;
    const allOffsets = [-24, -12, 0, 12, 24];
    const streakCount = Math.min(allOffsets.length, 1 + swiftnessRank);
    const streakStart = Math.floor((allOffsets.length - streakCount) / 2);
    const offsets = allOffsets.slice(streakStart, streakStart + streakCount);

    for (const offset of offsets) {
      const sideRatio = offset === 0 ? 1 : 0.7;
      const start = 13 + Math.abs(offset) * 0.08;
      const end = start + length * sideRatio;
      this.speedStreaks.lineStyle(
        TALENT_SPEED_STREAK_WIDTH * sideRatio,
        this.accentColor,
        alpha * sideRatio,
      );
      this.speedStreaks.lineBetween(
        this.x - direction.x * start + perpendicular.x * offset,
        this.y - direction.y * start + perpendicular.y * offset,
        this.x - direction.x * end + perpendicular.x * offset * 1.35,
        this.y - direction.y * end + perpendicular.y * offset * 1.35,
      );
    }
  }

  /** Der Ring zeigt exakt den Sammelradius - wichtig fuer faires Feedback. */
  private syncHaloToRadius(): void {
    const haloTextureRadius = 54; // siehe createPlayerHalo()
    this.halo.setScale(this.stats.collectRadius / haloTextureRadius);
  }
}
