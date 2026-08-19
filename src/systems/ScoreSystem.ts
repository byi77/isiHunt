/**
 * Punkte, Combo und Multiplikator eines laufenden Runs.
 *
 * Serien-Regel, zwei Stufen:
 *
 * 1. **Halten.** Jeder zeitnahe Fang setzt das Zeitfenster neu. Laeuft es ab,
 *    faellt die Serie auf 0. Verpasste Relikte brechen sie NICHT, kosten aber
 *    Zeit und machen den Zerfall dadurch zur echten Gefahr.
 * 2. **Steigern.** Erhoeht wird die Serie nur von farbigen Relikten
 *    (ungewoehnlich und seltener). Weisse halten sie am Leben, ohne sie zu
 *    steigern.
 *
 * Aus der Trennung entsteht die Taktik: Ist kein farbiges Relikt in
 * Reichweite, bevor das Fenster ablaeuft, rettet ein weisses die Kette - man
 * bezahlt mit einer Stufe, die stehen bleibt. Vorher steigerte jeder Fang die
 * Serie und das Fenster war doppelt so lang; sie riss praktisch nie, und es
 * gab nie etwas zu entscheiden.
 */

import {
  COMBO_TIERS,
  SERIES_RAISING_MIN_RARITY_INDEX,
  SERIES_TRAIL_TIERS,
} from '@/config/GameConfig';
import { emptyRarityCounts, RARITY_IDS } from '@/config/rarities';
import type { RarityDef, RarityId } from '@/config/rarities';
import type { RunStats } from '@/types';

export interface CollectOutcome {
  awardedPoints: number;
  xpGained: number;
  combo: number;
  multiplier: number;
  comboIncreased: boolean;
  multiplierIncreased: boolean;
  /** Anzahl zeitnah gefangener Relikte in Folge. */
  sameRarityStreak: number;
  /** Wahr, sobald die Kette erstmals einen sichtbaren Punktebonus gibt. */
  streakBonus: boolean;
  /**
   * Der Fang hat die Serie gehalten, aber nicht gesteigert - ein weisses
   * Relikt als Rettung. Das HUD kann darauf eine eigene Rueckmeldung geben.
   */
  seriesHeldOnly: boolean;
}

export function multiplierForCombo(combo: number): number {
  let result = 1;
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.minCombo) result = tier.multiplier;
  }
  return result;
}

/**
 * Steigert ein Fang dieser Seltenheit die Serie, oder haelt er sie nur?
 *
 * Bewusst hier und nicht in `rarities.ts`: Die Seltenheitstabelle beschreibt,
 * was ein Relikt *ist* (Farbe, Punkte, Tempo). Ob es eine Serie steigert, ist
 * eine Regel des Punktesystems und gehoert deshalb hierher.
 */
export function raritySteigertSerie(id: RarityId): boolean {
  return RARITY_IDS.indexOf(id) >= SERIES_RAISING_MIN_RARITY_INDEX;
}

/**
 * Die Schleifen-Stufe fuer eine laufende Serie.
 *
 * `null`, solange die Serie unter der ersten Stufe liegt - dann bleibt die
 * Spur im ruhigen Grundzustand. Gibt die komplette Stufe zurueck, nicht nur
 * Laenge und Farbe: Dichte, Groesse und Deckkraft gehoeren dazu, sonst ist
 * die Schleife auf dem hellen Weltraumhintergrund kaum zu sehen.
 */
export function trailTierForSeries(series: number): (typeof SERIES_TRAIL_TIERS)[number] | null {
  let treffer: (typeof SERIES_TRAIL_TIERS)[number] | null = null;
  for (const tier of SERIES_TRAIL_TIERS) {
    if (series >= tier.minSeries) treffer = tier;
  }
  return treffer;
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

  /** Muss jeden Frame aufgerufen werden, damit die Serie zerfallen kann. */
  update(deltaMs: number): { comboReset: boolean } {
    // Am Timer entlang pruefen, nicht an der Serie: Ein weisser Fang haelt das
    // Fenster offen, auch wenn die Serie dabei auf 0 stehen bleibt. Ein
    // `combo === 0`-Guard wuerde diesen Zustand nie ablaufen lassen.
    if (this.comboTimerMs <= 0) return { comboReset: false };

    this.comboTimerMs -= deltaMs;
    if (this.comboTimerMs > 0) return { comboReset: false };

    const hatteSerie = this.combo > 0;
    this.combo = 0;
    this.comboTimerMs = 0;
    // Nur melden, wenn tatsaechlich eine Serie zerfiel - sonst feuerte jedes
    // auslaufende Weiss-Fenster ein ComboChanged auf 0, das nichts aendert.
    return { comboReset: hatteSerie };
  }

  registerCollect(rarity: RarityDef): CollectOutcome {
    const previousMultiplier = multiplierForCombo(this.combo);

    // Jeder Fang haelt die Serie am Leben - aber nur ein farbiger steigert
    // sie. Genau daraus entsteht die taktische Wahl: Wer nichts Farbiges in
    // Reichweite hat, nimmt ein weisses und rettet die Kette, ohne
    // aufzusteigen. Begruendung bei SERIES_RAISING_MIN_RARITY_INDEX.
    const raisesSeries = raritySteigertSerie(rarity.id);
    if (raisesSeries) this.combo += 1;

    this.comboTimerMs = this.comboGraceMs;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.collected[rarity.id] += 1;

    const multiplier = multiplierForCombo(this.combo);
    this.bestMultiplier = Math.max(this.bestMultiplier, multiplier);

    const streakBonus = multiplier > 1;
    const awardedPoints = Math.round(rarity.points * multiplier * this.scoreMultiplier);
    const xp = Math.round(rarity.xp * this.xpMultiplier);

    this.score += awardedPoints;
    this.xpGained += xp;

    return {
      awardedPoints,
      xpGained: xp,
      combo: this.combo,
      multiplier,
      comboIncreased: raisesSeries,
      multiplierIncreased: multiplier > previousMultiplier,
      sameRarityStreak: this.combo,
      streakBonus,
      /** Ein weisser Fang, der die Serie gerettet, aber nicht gesteigert hat. */
      seriesHeldOnly: !raisesSeries,
    };
  }

  registerMiss(): void {
    this.missed += 1;
  }

  /** Anteil des verbleibenden Combo-Fensters (1 = gerade gefangen, 0 = gleich weg). */
  get comboTimerRatio(): number {
    // Nicht `combo === 0` pruefen, sondern den Timer: Wer nur weisse Relikte
    // faengt, haelt ein laufendes Fenster bei Serie 0. Ohne diese
    // Unterscheidung zeigte die Anzeige dort 0, obwohl die Kette noch lebte -
    // und der Spieler saehe nicht, dass sein Rettungsfang gewirkt hat.
    if (this.comboTimerMs <= 0) return 0;
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
