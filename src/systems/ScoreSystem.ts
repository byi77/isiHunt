/**
 * Punkte, Combo und Multiplikator eines laufenden Runs.
 *
 * Combo-Regel: Jeder Fang erhoeht die Combo um 1 und startet das Zeitfenster
 * neu. Faengst du innerhalb des Fensters nichts, faellt die Combo auf 0.
 * Verpasste Relikte brechen die Combo NICHT - belohnt wird durchgehender Flow,
 * nicht fehlerfreies Spiel. Das haelt kurze Runs entspannt und macht lange
 * Ketten trotzdem zu einer echten Leistung.
 */

import { COMBO_TIERS } from '@/config/GameConfig';
import { emptyRarityCounts } from '@/config/rarities';
import type { RarityDef, RarityId } from '@/config/rarities';
import type { RunStats } from '@/types';

export interface CollectOutcome {
  awardedPoints: number;
  xpGained: number;
  combo: number;
  multiplier: number;
  comboIncreased: boolean;
  multiplierIncreased: boolean;
}

export function multiplierForCombo(combo: number): number {
  let result = 1;
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.minCombo) result = tier.multiplier;
  }
  return result;
}

export class ScoreSystem {
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private bestMultiplier = 1;
  private comboTimerMs = 0;
  private missed = 0;
  private xpGained = 0;
  private collected: Record<RarityId, number> = emptyRarityCounts();

  constructor(
    private readonly comboGraceMs: number,
    private readonly scoreMultiplier: number,
    private readonly xpMultiplier: number,
  ) {}

  /** Muss jeden Frame aufgerufen werden, damit die Combo zerfallen kann. */
  update(deltaMs: number): { comboReset: boolean } {
    if (this.combo === 0) return { comboReset: false };

    this.comboTimerMs -= deltaMs;
    if (this.comboTimerMs > 0) return { comboReset: false };

    this.combo = 0;
    this.comboTimerMs = 0;
    return { comboReset: true };
  }

  registerCollect(rarity: RarityDef): CollectOutcome {
    const previousMultiplier = multiplierForCombo(this.combo);

    this.combo += 1;
    this.comboTimerMs = this.comboGraceMs;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.collected[rarity.id] += 1;

    const multiplier = multiplierForCombo(this.combo);
    this.bestMultiplier = Math.max(this.bestMultiplier, multiplier);

    const awardedPoints = Math.round(rarity.points * multiplier * this.scoreMultiplier);
    const xp = Math.round(rarity.xp * this.xpMultiplier);

    this.score += awardedPoints;
    this.xpGained += xp;

    return {
      awardedPoints,
      xpGained: xp,
      combo: this.combo,
      multiplier,
      comboIncreased: true,
      multiplierIncreased: multiplier > previousMultiplier,
    };
  }

  registerMiss(): void {
    this.missed += 1;
  }

  /** Anteil des verbleibenden Combo-Fensters (1 = gerade gefangen, 0 = gleich weg). */
  get comboTimerRatio(): number {
    if (this.combo === 0) return 0;
    // Bewusst ohne Phaser.Math.Clamp: der Import zog die komplette Engine samt
    // Canvas-Erkennung herein und machte die Datei ausserhalb des Browsers
    // unbenutzbar. Siehe Regel 6 in CLAUDE.md - systems/ kennt Phaser nicht.
    return Math.min(Math.max(this.comboTimerMs / this.comboGraceMs, 0), 1);
  }

  get currentScore(): number {
    return this.score;
  }

  get currentCombo(): number {
    return this.combo;
  }

  get currentMultiplier(): number {
    return multiplierForCombo(this.combo);
  }

  toRunStats(worldId: string): RunStats {
    const totalCollected = Object.values(this.collected).reduce((a, b) => a + b, 0);
    return {
      worldId,
      score: this.score,
      bestCombo: this.bestCombo,
      bestMultiplier: this.bestMultiplier,
      collected: { ...this.collected },
      totalCollected,
      missed: this.missed,
      xpGained: this.xpGained,
    };
  }
}
