/**
 * Steuert, wann und wo Relikte auftauchen.
 *
 * Zwei Regeln machen den Run spielbar statt zufaellig:
 * 1. Ramping - gegen Ende des Runs spawnt es dichter (Endspurt-Gefuehl).
 * 2. Mindestabstand zur Figur - nichts erscheint direkt unter dem Finger,
 *    sonst waeren seltene Relikte reines Glueck statt Reaktion.
 */

import Phaser from 'phaser';

import {
  MAX_ACTIVE_COLLECTIBLES,
  SPAWN_INTERVAL_MS,
  SPAWN_MIN_DISTANCE_TO_PLAYER,
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
   * @returns Ein Spawn oder null, wenn gerade keiner faellig ist.
   */
  update(
    deltaMs: number,
    runProgress: number,
    activeCount: number,
    playerX: number,
    playerY: number,
  ): SpawnRequest | null {
    if (activeCount >= MAX_ACTIVE_COLLECTIBLES) return null;

    this.timerMs -= deltaMs;
    if (this.timerMs > 0) return null;

    const ramp = Phaser.Math.Linear(1, SPAWN_RAMP_FACTOR, Phaser.Math.Clamp(runProgress, 0, 1));
    // +-20% Streuung, damit das Spawn-Muster nicht metronomisch wirkt.
    this.timerMs = SPAWN_INTERVAL_MS * ramp * this.rng.realInRange(0.8, 1.2);

    const position = this.findPosition(playerX, playerY);
    return { x: position.x, y: position.y, rarity: rollRarity(this.rng) };
  }

  /** Erzwingt einen Spawn - fuer Debug-Tasten und spaetere Ereignisse. */
  forceSpawn(rarity: RarityDef, playerX: number, playerY: number): SpawnRequest {
    const position = this.findPosition(playerX, playerY);
    return { x: position.x, y: position.y, rarity };
  }

  /**
   * Sucht eine Position mit genug Abstand zur Figur. Nach einigen Versuchen
   * wird der letzte Kandidat genommen - lieber ein naher Spawn als ein Frame,
   * in dem nichts erscheint.
   */
  private findPosition(playerX: number, playerY: number): { x: number; y: number } {
    let x = 0;
    let y = 0;

    for (let attempt = 0; attempt < 12; attempt++) {
      x = this.rng.between(this.bounds.left, this.bounds.right);
      y = this.rng.between(this.bounds.top, this.bounds.bottom);

      if (Math.hypot(x - playerX, y - playerY) >= SPAWN_MIN_DISTANCE_TO_PLAYER) break;
    }

    return { x, y };
  }

  reset(): void {
    this.timerMs = 0;
  }
}
