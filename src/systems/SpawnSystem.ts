/**
 * Steuert, wann und wo Relikte auftauchen.
 *
 * Zwei Regeln machen den Run spielbar statt zufaellig:
 * 1. Ramping - gegen Ende des Runs spawnt es dichter (Endspurt-Gefuehl).
 * 2. Mindestabstand zur Figur - nichts erscheint direkt unter dem Finger,
 *    sonst waeren seltene Relikte reines Glueck statt Reaktion.
 *
 * ## Warum der Zufall hier streng getaktet ist
 *
 * Im Duell spielen beide Spieler denselben Seed und muessen dieselbe Abfolge
 * von Relikten sehen. Das gelingt nur, wenn der Zufallsgenerator **unabhaengig
 * vom Spielverlauf** verbraucht wird. Zwei Fallen waren dabei zu umgehen:
 *
 * - **Volles Feld darf den Takt nicht anhalten.** Frueher blockierte ein volles
 *   Spielfeld den Timer. Wer langsamer einsammelte, verschob damit den ganzen
 *   restlichen Spawn-Plan - zwei Spieler haetten unterschiedliche Runden
 *   gespielt. Jetzt laeuft der Takt weiter und ein faelliger Spawn faellt bei
 *   vollem Feld einfach aus.
 * - **Die Positionssuche darf nicht frueh abbrechen.** Ein `break`, sobald ein
 *   Kandidat weit genug weg ist, verbraucht je nach Figurposition
 *   unterschiedlich viele Zufallszahlen - danach laufen die Generatoren beider
 *   Spieler auseinander. Es werden deshalb immer alle Kandidaten gezogen.
 *
 * Ergebnis: Zu jeder Spielsekunde faellt bei beiden Spielern dieselbe
 * Seltenheit an derselben Stelle an. Unterschiedlich ist nur, was sie daraus
 * machen.
 */

import Phaser from 'phaser';

import {
  MAX_ACTIVE_COLLECTIBLES,
  SPAWN_INTERVAL_JITTER_MAX,
  SPAWN_INTERVAL_JITTER_MIN,
  SPAWN_INTERVAL_MS,
  SPAWN_MIN_DISTANCE_TO_PLAYER,
  SPAWN_POSITION_CANDIDATES,
  SPAWN_RAMP_FACTOR,
  WORLD_LIFETIME_SCALE_FLOOR,
  WORLD_LIFETIME_SCALE_PER_DIFFICULTY,
  WORLD_OBSTACLE_BASE_CHANCE,
  WORLD_OBSTACLE_END_CHANCE,
  WORLD_OBSTACLE_MAX_CHANCE,
  WORLD_DRIFT_MULTIPLIER,
  WORLD_RARE_LIFETIME_SCALE,
  WORLD_RARE_PROMOTION_CHANCE,
  WORLD_SHORT_LIFETIME_SCALE,
} from '@/config/GameConfig';
import { RARITIES, rollRarity } from '@/config/rarities';
import type { RarityDef } from '@/config/rarities';

export type WorldModifier = 'none' | 'inertia' | 'short_lived' | 'blink' | 'rare_bonus';
export type ObstacleMode = 'none' | 'brake' | 'penalty';

export interface SpawnRequest {
  x: number;
  y: number;
  kind: 'collectible' | 'obstacle';
  rarity: RarityDef;
  lifetimeScale?: number;
  driftMultiplier?: number;
  blinking?: boolean;
  obstacleMode?: Exclude<ObstacleMode, 'none'>;
  /**
   * Driftrichtung in Radiant, aus dem geteilten Generator gezogen.
   *
   * Frueher zog `Collectible` sie selbst aus `Phaser.Math.FloatBetween`, das
   * intern `Math.random()` verwendet und den Raum-Seed nicht kennt - im Duell
   * trieben dieselben Relikte dadurch in verschiedene Richtungen
   * (AUDIT_2026-09-05, Befund 9).
   */
  driftAngle: number;
}

/** Hinderniswahrscheinlichkeit aus Welt, Schwierigkeit und Run-Fortschritt. */
export function phase5ObstacleChance(
  obstacleMode: ObstacleMode,
  difficultyScale: number,
  runProgress: number,
): number {
  if (obstacleMode === 'none') return 0;
  const progress = Math.min(1, Math.max(0, runProgress));
  const baseChance =
    WORLD_OBSTACLE_BASE_CHANCE +
    (WORLD_OBSTACLE_END_CHANCE - WORLD_OBSTACLE_BASE_CHANCE) * progress;
  return Math.min(WORLD_OBSTACLE_MAX_CHANCE, baseChance * difficultyScale);
}

/** Sichtfenster-Skalierung der Phase-5-Schwierigkeit vor Welt-Sonderregeln. */
export function phase5LifetimeScale(difficultyScale: number): number {
  return Math.max(
    WORLD_LIFETIME_SCALE_FLOOR,
    1 - (difficultyScale - 1) * WORLD_LIFETIME_SCALE_PER_DIFFICULTY,
  );
}

export class SpawnSystem {
  private timerMs = 0;

  constructor(
    private readonly rng: Phaser.Math.RandomDataGenerator,
    private readonly bounds: Phaser.Geom.Rectangle,
    private readonly modifier: WorldModifier = 'none',
    private readonly obstacleMode: ObstacleMode = 'none',
    private readonly difficultyScale = 1,
    /**
     * Duelle brauchen wirklich dieselben Positionen. Im Solo-Modus wird ein
     * Spawn vom Spieler ferngehalten; im Duell darf die Position dagegen nicht
     * vom Bewegungsverlauf des vorherigen Spielers abhängen.
     */
    private readonly synchronizedPositions = false,
    /** Zusatzchance aus dem Spürsinn-Talent; im Duell bleibt sie 0. */
    private readonly rarityPromotionChance = 0,
  ) {}

  /**
   * @param runProgress 0 bei Start, 1 am Ende des Runs.
   * @returns Ein Spawn oder null, wenn gerade keiner faellig ist oder das Feld
   *   voll war. Der Zufallsgenerator wird in beiden Faellen gleich verbraucht.
   */
  update(
    deltaMs: number,
    runProgress: number,
    activeCount: number,
    playerX: number,
    playerY: number,
  ): SpawnRequest | null {
    this.timerMs -= deltaMs;
    if (this.timerMs > 0) return null;

    const ramp = Phaser.Math.Linear(1, SPAWN_RAMP_FACTOR, Phaser.Math.Clamp(runProgress, 0, 1));
    // Streuung, damit das Spawn-Muster nicht metronomisch wirkt.
    //
    // `+=` statt `=`: Der Timer steht hier auf einem negativen Rest - dem
    // Teil des Frames, der ueber die Faelligkeit hinausging. Wurde er
    // verworfen, hing die Anzahl der Spawns pro Run an der Bildrate, weil
    // grosse Deltas mehr Zeit wegwarfen als kleine (AUDIT_2026-09-05,
    // Befund 8). Der Rest wird deshalb auf das neue Intervall angerechnet.
    this.timerMs +=
      SPAWN_INTERVAL_MS *
      ramp *
      this.rng.realInRange(SPAWN_INTERVAL_JITTER_MIN, SPAWN_INTERVAL_JITTER_MAX);

    // Bewusst VOR der Kapazitaetspruefung: der Verbrauch muss gleich bleiben,
    // auch wenn der Spawn gleich verworfen wird.
    const position = this.findPosition(playerX, playerY);
    const rarity = this.rollWorldRarity();

    // Immer gezogen, auch fuer Hindernisse, die nicht driften: der Verbrauch
    // muss unabhaengig vom Ausgang gleich bleiben.
    const driftAngle = this.rng.realInRange(0, Math.PI * 2);

    // Der Zufallsverbrauch ist immer gleich, auch wenn das Feld voll ist.
    // Hindernisse erscheinen anfangs selten und werden gegen Ende etwas
    // wahrscheinlicher, damit die Welt erst lesbar bleibt und dann Druck macht.
    const obstacleRoll = this.rng.frac();
    const scaledObstacleChance = phase5ObstacleChance(
      this.obstacleMode,
      this.difficultyScale,
      runProgress,
    );

    // Im Duell darf ein langsamerer erster Spieler den Spawn-Plan nicht durch
    // ein volles Feld veraendern. Abgelaufene Objekte werden weiterhin normal
    // entfernt; die hoehere temporaere Anzahl ist fuer 90 Sekunden begrenzt.
    if (activeCount >= MAX_ACTIVE_COLLECTIBLES && !this.synchronizedPositions) return null;

    if (obstacleRoll < scaledObstacleChance) {
      return {
        x: position.x,
        y: position.y,
        kind: 'obstacle',
        rarity,
        driftAngle,
        obstacleMode: this.obstacleMode === 'none' ? undefined : this.obstacleMode,
      };
    }

    const worldLifetimeScale = phase5LifetimeScale(this.difficultyScale);
    return {
      x: position.x,
      y: position.y,
      kind: 'collectible',
      rarity,
      driftAngle,
      lifetimeScale:
        (this.modifier === 'rare_bonus'
          ? WORLD_RARE_LIFETIME_SCALE
          : this.modifier === 'short_lived'
            ? WORLD_SHORT_LIFETIME_SCALE
            : 1) * worldLifetimeScale,
      driftMultiplier: this.modifier === 'inertia' ? WORLD_DRIFT_MULTIPLIER : 1,
      blinking: this.modifier === 'blink',
    };
  }

  /** Erzwingt einen Spawn - fuer Debug-Tasten und spaetere Ereignisse. */
  forceSpawn(rarity: RarityDef, playerX: number, playerY: number): SpawnRequest {
    const position = this.findPosition(playerX, playerY);
    return {
      x: position.x,
      y: position.y,
      kind: 'collectible',
      rarity,
      driftAngle: this.rng.realInRange(0, Math.PI * 2),
    };
  }

  private rollWorldRarity(): RarityDef {
    const rarity = rollRarity(this.rng);
    const promotionChance = Math.min(
      1,
      (this.modifier === 'rare_bonus' ? WORLD_RARE_PROMOTION_CHANCE : 0) +
        Math.max(0, this.rarityPromotionChance),
    );
    // Die Zufallszahl wird IMMER gezogen, auch bei Chance 0. Sonst
    // verschiebt schon ein einzelner Spuersinn-Rang den gesamten weiteren
    // Zufallsverbrauch: der naechste Spawn laege an anderen Koordinaten und
    // die beiden Duellanten spielten verschiedene Runden
    // (AUDIT_2026-09-05, Befund 9).
    const promotionRoll = this.rng.frac();
    if (promotionChance <= 0 || promotionRoll >= promotionChance) return rarity;

    // Weltbonus und Spürsinn fördern jeweils nur um eine Stufe. So bleibt die
    // sichtbare Staffelung erhalten und ein Talent erzeugt keine direkte
    // Legendary-Garantie.
    const promoted: Record<string, string> = {
      poor: 'common',
      common: 'uncommon',
      uncommon: 'rare',
      rare: 'epic',
      epic: 'legendary',
    };
    const promotedId = promoted[rarity.id];
    if (!promotedId) return rarity;

    // rollRarity kennt die Tabelle bereits; die ID wird hier nur über den
    // bekannten Ergebniswert gesucht, damit keine zweite Balancing-Tabelle
    // entsteht.
    return rollRarityFromId(promotedId) ?? rarity;
  }

  /**
   * Zieht eine feste Anzahl Kandidaten und nimmt den ersten mit genug Abstand
   * zur Figur; sonst den letzten - lieber ein naher Spawn als ein Frame, in dem
   * nichts erscheint.
   *
   * Alle Kandidaten werden gezogen, auch wenn der erste schon passt. Siehe
   * Klassenkommentar: ein frueher Abbruch macht den Verbrauch des
   * Zufallsgenerators von der Figurposition abhaengig und zerstoert die
   * Vergleichbarkeit zweier Duell-Durchgaenge.
   */
  private findPosition(playerX: number, playerY: number): { x: number; y: number } {
    let chosen: { x: number; y: number } | null = null;
    let last = { x: this.bounds.centerX, y: this.bounds.centerY };
    const referenceX = this.synchronizedPositions ? this.bounds.centerX : playerX;
    const referenceY = this.synchronizedPositions ? this.bounds.centerY : playerY;

    for (let attempt = 0; attempt < SPAWN_POSITION_CANDIDATES; attempt++) {
      const candidate = {
        x: this.rng.between(this.bounds.left, this.bounds.right),
        y: this.rng.between(this.bounds.top, this.bounds.bottom),
      };
      last = candidate;

      if (
        !chosen &&
        Math.hypot(candidate.x - referenceX, candidate.y - referenceY) >=
          SPAWN_MIN_DISTANCE_TO_PLAYER
      ) {
        chosen = candidate;
      }
    }

    return chosen ?? last;
  }

  reset(): void {
    this.timerMs = 0;
  }
}

function rollRarityFromId(id: string): RarityDef | null {
  return RARITIES.find((rarity) => rarity.id === id) ?? null;
}
