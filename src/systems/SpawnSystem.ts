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
  SPAWN_INTERVAL_MS,
  SPAWN_MIN_DISTANCE_TO_PLAYER,
  SPAWN_POSITION_CANDIDATES,
  SPAWN_RAMP_FACTOR,
} from '@/config/GameConfig';
import { rollRarity } from '@/config/rarities';
import type { RarityDef } from '@/config/rarities';

export interface SpawnRequest {
  x: number;
  y: number;
  rarity: RarityDef;
}

export class SpawnSystem {
  private timerMs = 0;

  constructor(
    private readonly rng: Phaser.Math.RandomDataGenerator,
    private readonly bounds: Phaser.Geom.Rectangle,
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
    // +-20% Streuung, damit das Spawn-Muster nicht metronomisch wirkt.
    this.timerMs = SPAWN_INTERVAL_MS * ramp * this.rng.realInRange(0.8, 1.2);

    // Bewusst VOR der Kapazitaetspruefung: der Verbrauch muss gleich bleiben,
    // auch wenn der Spawn gleich verworfen wird.
    const position = this.findPosition(playerX, playerY);
    const rarity = rollRarity(this.rng);

    if (activeCount >= MAX_ACTIVE_COLLECTIBLES) return null;

    return { x: position.x, y: position.y, rarity };
  }

  /** Erzwingt einen Spawn - fuer Debug-Tasten und spaetere Ereignisse. */
  forceSpawn(rarity: RarityDef, playerX: number, playerY: number): SpawnRequest {
    const position = this.findPosition(playerX, playerY);
    return { x: position.x, y: position.y, rarity };
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

    for (let attempt = 0; attempt < SPAWN_POSITION_CANDIDATES; attempt++) {
      const candidate = {
        x: this.rng.between(this.bounds.left, this.bounds.right),
        y: this.rng.between(this.bounds.top, this.bounds.bottom),
      };
      last = candidate;

      if (
        !chosen &&
        Math.hypot(candidate.x - playerX, candidate.y - playerY) >= SPAWN_MIN_DISTANCE_TO_PLAYER
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
