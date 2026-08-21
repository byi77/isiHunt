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
} from '@/config/GameConfig';
import type { PlayerStats } from '@/config/talents';
import { Depth } from '@/ui/depth';
import {
  applyTintShift,
  SHIP_ANIMATIONS,
  stehendesBild,
  type AuraAnimation,
} from '@/ui/shipAnimations';
import { TextureKey } from '@/ui/textures';
import type { TextureKeyValue } from '@/ui/textures';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';

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

export class Player extends Phaser.GameObjects.Container {
  private readonly core: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly aura: Phaser.GameObjects.Image;
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
  /** Letzte Positionen, aelteste zuerst. Laenge steuert die Schleifenlaenge. */
  private trailPoints: { x: number; y: number }[] = [];
  private trailSampleMs = 0;
  private trailIdleTicks = 0;
  /** Die getragene Aura-Bewegung, oder `null` fuer keine. */
  private auraAnimation: AuraAnimation | null = null;
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
  setAura(animIndex: number | null): void {
    this.auraAnimation = animIndex === null ? null : (SHIP_ANIMATIONS[animIndex] ?? null);
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
      this.trailGlowLine.beginPath();
      this.trailGlowLine.moveTo(vorher.x, vorher.y);
      this.trailGlowLine.lineTo(jetzt.x, jetzt.y);
      this.trailGlowLine.strokePath();

      this.trailLine.lineStyle(coreWidth, color, coreAlpha);
      this.trailLine.beginPath();
      this.trailLine.moveTo(vorher.x, vorher.y);
      this.trailLine.lineTo(jetzt.x, jetzt.y);
      this.trailLine.strokePath();
    }
  }

  /**
   * Der Emitter haengt nicht am Container und wird deshalb nicht automatisch
   * mit zerstoert - ohne dieses Override ueberlebt die Spur den Run.
   */
  override destroy(fromScene?: boolean): void {
    this.trail.destroy();
    this.trailGlowLine.destroy();
    this.trailLine.destroy();
    super.destroy(fromScene);
  }

  private clearTrailPath(): void {
    this.trailPoints = [];
    this.trailSampleMs = 0;
    this.trailIdleTicks = 0;
    this.trailGlowLine.clear();
    this.trailLine.clear();
  }

  /** Der Ring zeigt exakt den Sammelradius - wichtig fuer faires Feedback. */
  private syncHaloToRadius(): void {
    const haloTextureRadius = 54; // siehe createPlayerHalo()
    this.halo.setScale(this.stats.collectRadius / haloTextureRadius);
  }
}
