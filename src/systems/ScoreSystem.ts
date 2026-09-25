/**
 * Punkte, Combo und Multiplikator eines laufenden Runs.
 *
 * Serien-Regel, zwei Stufen:
 *
 * 1. **Halten.** Jeder zeitnahe Fang setzt das Zeitfenster neu. Laeuft es ab,
 *    faellt die Serie auf 0. Verpasste Relikte brechen sie NICHT, kosten aber
 *    Zeit und machen den Zerfall dadurch zur echten Gefahr.
 * 2. **Steigern.** Ein farbiges Relikt (ungewoehnlich und seltener) steigert
 *    die Serie um eine Stufe, ein weisses oder graues um ein Fuenftel
 *    (`SERIES_HOLD_CATCHES_PER_STEP`). Bis 2026-09-25 hielten weisse sie nur.
 *
 * Aus der Trennung entsteht die Taktik: Ist kein farbiges Relikt in
 * Reichweite, bevor das Fenster ablaeuft, rettet ein weisses die Kette - man
 * bezahlt mit einer Stufe, die stehen bleibt. Vorher steigerte jeder Fang die
 * Serie und das Fenster war doppelt so lang; sie riss praktisch nie, und es
 * gab nie etwas zu entscheiden.
 */

import { BASE_CRIT_CHANCE, CRIT_MULTIPLIER } from '@/config/balance';
import {
  COMBO_MULTIPLIER_PER_EXTRA_SERIES,
  COMBO_TIERS,
  PLAYER_ACCEL_RESPONSE,
  SERIES_AGILITY_TIERS,
  SERIES_HOLD_CATCHES_PER_STEP,
  SERIES_RESCUE_GRACE_MULTIPLIER,
  SERIES_RESCUE_MIN_COMBO,
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
  /** Weisse Faenge auf dem Weg zur naechsten Stufe, 0 bis `SERIES_HOLD_CATCHES_PER_STEP - 1`. */
  holdProgress: number;
  /** Der Fang war weiss und hat die Serie um einen Bruchteil gesteigert. */
  holdStep: boolean;
  /** Anzahl zeitnah gefangener Relikte in Folge. */
  sameRarityStreak: number;
  /** Wahr, sobald die Kette erstmals einen sichtbaren Punktebonus gibt. */
  streakBonus: boolean;
  /** Der Fang war ein Gluecktreffer und hat das Dreifache gebracht. */
  crit: boolean;
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

  // Die letzte sichtbare Stufe ist kein Cap: Wer die Serie weiter haelt,
  // bekommt pro weiterem farbigen Fang einen kleinen zusaetzlichen Schub.
  // So bleibt Serie 16 der grosse Jackpot-Moment, ohne dass eine lange
  // perfekte Kette danach mathematisch stehen bleibt.
  const lastTier = COMBO_TIERS[COMBO_TIERS.length - 1];
  if (lastTier && combo > lastTier.minCombo) {
    result += (combo - lastTier.minCombo) * COMBO_MULTIPLIER_PER_EXTRA_SERIES;
  }
  return result;
}

/** Serienbonus aus der Balance plus Resonanz-Talent. */
export function multiplierForComboWithTalent(combo: number, seriesMultiplierBonus = 0): number {
  const baseMultiplier = multiplierForCombo(combo);
  return baseMultiplier + (baseMultiplier > 1 ? Math.max(0, seriesMultiplierBonus) : 0);
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

/** Die Serie so, wie das HUD sie zeigt: jede weisse Teilstufe als Nachkomma. */
export function seriesDisplayValue(combo: number, holdProgress: number): number {
  return combo + holdProgress / SERIES_HOLD_CATCHES_PER_STEP;
}

/** Tempo- und Reaktionsbonus, den eine laufende Serie gerade traegt. */
export interface SeriesAgility {
  /** Faktor auf `moveSpeed` - 1 heisst unveraendert. */
  readonly speedFactor: number;
  /** Reaktionsschaerfe der Bewegung, Grundwert `PLAYER_ACCEL_RESPONSE`. */
  readonly accelResponse: number;
}

const KEINE_BEWEGLICHKEIT: SeriesAgility = {
  speedFactor: 1,
  accelResponse: PLAYER_ACCEL_RESPONSE,
};

/**
 * Welchen Beweglichkeitsbonus traegt diese Serie?
 *
 * Reine Funktion ohne Phaser (Regel 6), damit die Stufung testbar bleibt -
 * die Bewegung selbst ist es mangels Canvas nicht. Begruendung der Werte bei
 * `SERIES_AGILITY_TIERS`.
 */
export function agilityForSeries(series: number): SeriesAgility {
  let treffer = KEINE_BEWEGLICHKEIT;
  for (const tier of SERIES_AGILITY_TIERS) {
    if (series >= tier.minCombo) {
      treffer = { speedFactor: 1 + tier.speedBonus, accelResponse: tier.accelResponse };
    }
  }
  return treffer;
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
  /** Weisse Faenge seit der letzten Stufe - siehe `SERIES_HOLD_CATCHES_PER_STEP`. */
  private holdProgress = 0;
  private bestCombo = 0;
  private bestMultiplier = 1;
  private comboTimerMs = 0;
  private comboWindowDurationMs = 0;
  private missed = 0;
  private xpGained = 0;
  private crits = 0;
  private collected: Record<RarityId, number> = emptyRarityCounts();
  private readonly shieldTotalMs: number;

  constructor(
    private readonly comboGraceMs: number,
    private readonly scoreMultiplier: number,
    private readonly xpMultiplier: number,
    private readonly seriesMultiplierBonus = 0,
    /**
     * Wahrscheinlichkeit eines Gluecktreffers, 0 bis 1. Kommt fertig aus
     * `resolveStats` - Grundchance und Talent sind dort schon summiert.
     */
    private readonly critChance = BASE_CRIT_CHANCE,
    /**
     * Der Wuerfel. Injizierbar, damit Tests den Zufall festlegen koennen -
     * ohne das waere ein Gluecktreffer nur statistisch pruefbar, und ein
     * Vorzeichenfehler fiele erst im Spiel auf.
     */
    private readonly roll: () => number = Math.random,
    private rescueUsed = false,
    /** Serie aus der Endlos-Vorrunde; sie startet mit offenem Fenster. */
    initialCombo = 0,
    /** Solange er laeuft, steht das Fenster still und die Serie kann nicht reissen. */
    private shieldMs = 0,
    initialHoldProgress = 0,
  ) {
    if (initialCombo > 0) {
      this.combo = initialCombo;
      this.holdProgress = Math.max(
        0,
        Math.min(SERIES_HOLD_CATCHES_PER_STEP - 1, Math.floor(initialHoldProgress)),
      );
      this.bestCombo = initialCombo;
      this.comboTimerMs = comboGraceMs;
      this.comboWindowDurationMs = comboGraceMs;
      this.bestMultiplier = multiplierForComboWithTalent(initialCombo, seriesMultiplierBonus);
    } else {
      // Ohne Serie gibt es nichts zu schuetzen - sonst zeigte das HUD einen
      // Schutz, der nichts bewirkt.
      this.shieldMs = 0;
    }
    this.shieldTotalMs = this.shieldMs;
  }

  /** Muss jeden Frame aufgerufen werden, damit die Serie zerfallen kann. */
  update(deltaMs: number): { comboReset: boolean; comboRevived: boolean } {
    // Der Schutz friert das Fenster ein, statt es nur aufzufuellen: So bleibt
    // nach seinem Ende genau das Fenster, das ein frischer Fang auch gaebe.
    if (this.shieldMs > 0) {
      this.shieldMs = Math.max(0, this.shieldMs - deltaMs);
      return { comboReset: false, comboRevived: false };
    }
    // Am Timer entlang pruefen, nicht an der Serie: Ein weisser Fang haelt das
    // Fenster offen, auch wenn die Serie dabei auf 0 stehen bleibt. Ein
    // `combo === 0`-Guard wuerde diesen Zustand nie ablaufen lassen.
    if (this.comboTimerMs <= 0) return { comboReset: false, comboRevived: false };

    this.comboTimerMs -= deltaMs;
    if (this.comboTimerMs > 0) return { comboReset: false, comboRevived: false };

    if (this.rescueReady) {
      this.rescueUsed = true;
      this.comboTimerMs = this.comboGraceMs * SERIES_RESCUE_GRACE_MULTIPLIER;
      this.comboWindowDurationMs = this.comboTimerMs;
      return { comboReset: false, comboRevived: true };
    }

    const hatteSerie = this.combo > 0 || this.holdProgress > 0;
    this.combo = 0;
    this.holdProgress = 0;
    this.comboTimerMs = 0;
    this.comboWindowDurationMs = 0;
    // Nur melden, wenn tatsaechlich eine Serie zerfiel - sonst feuerte jedes
    // auslaufende Weiss-Fenster ein ComboChanged auf 0, das nichts aendert.
    return { comboReset: hatteSerie, comboRevived: false };
  }

  registerCollect(rarity: RarityDef): CollectOutcome {
    const previousMultiplier = multiplierForComboWithTalent(this.combo, this.seriesMultiplierBonus);

    // Jeder Fang haelt die Serie am Leben - aber nur ein farbiger steigert
    // sie. Genau daraus entsteht die taktische Wahl: Wer nichts Farbiges in
    // Reichweite hat, nimmt ein weisses und rettet die Kette, ohne
    // aufzusteigen. Begruendung bei SERIES_RAISING_MIN_RARITY_INDEX.
    const raisesSeries = raritySteigertSerie(rarity.id);
    let holdCompletedStep = false;
    if (raisesSeries) {
      this.combo += 1;
    } else {
      this.holdProgress += 1;
      if (this.holdProgress >= SERIES_HOLD_CATCHES_PER_STEP) {
        this.holdProgress = 0;
        this.combo += 1;
        holdCompletedStep = true;
      }
    }

    this.comboTimerMs = this.comboGraceMs;
    this.comboWindowDurationMs = this.comboGraceMs;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.collected[rarity.id] += 1;

    const multiplier = multiplierForComboWithTalent(this.combo, this.seriesMultiplierBonus);
    this.bestMultiplier = Math.max(this.bestMultiplier, multiplier);

    const streakBonus = multiplier > 1;

    // Der Gluecktreffer wird ZULETZT angewandt, auf den bereits fertigen
    // Wert. Damit vervielfacht er alles, was der Fang wert war - Seltenheit,
    // Serie, Weltbonus -, und nicht nur den Grundwert. Genau das macht ihn zu
    // einem Ereignis: In einer hohen Serie ist er ein Ausschlag, den man
    // sieht, nicht ein stiller Aufschlag von ein paar Punkten.
    //
    // Er steigert die Serie nicht und wird von ihr nicht beeinflusst. Die
    // Serie misst Koennen; wer sie halten will, soll das mit der Hand tun und
    // nicht mit dem Wuerfel (vgl. ADR-0027).
    // Die Chance traegt jede Figur, auch ohne Talent (`BASE_CRIT_CHANCE`).
    // Der Guard bleibt trotzdem stehen: Tests setzen sie bewusst auf 0, um
    // einen Lauf ohne jeden Ausreisser rechnen zu koennen.
    const crit = this.critChance > 0 && this.roll() < this.critChance;
    const awardedPoints = Math.round(
      rarity.points * multiplier * this.scoreMultiplier * (crit ? CRIT_MULTIPLIER : 1),
    );
    const xp = Math.round(rarity.xp * this.xpMultiplier);

    this.score += awardedPoints;
    this.xpGained += xp;
    if (crit) this.crits += 1;

    return {
      awardedPoints,
      xpGained: xp,
      combo: this.combo,
      multiplier,
      comboIncreased: raisesSeries || holdCompletedStep,
      multiplierIncreased: multiplier > previousMultiplier,
      holdProgress: this.holdProgress,
      holdStep: !raisesSeries,
      sameRarityStreak: this.combo,
      streakBonus,
      crit,
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
    return Math.min(Math.max(this.comboTimerMs / this.comboWindowDurationMs, 0), 1);
  }

  /** Restanteil des Serienschutzes, 1 = gerade begonnen, 0 = keiner. */
  get shieldRatio(): number {
    return this.shieldTotalMs > 0 ? this.shieldMs / this.shieldTotalMs : 0;
  }

  get currentScore(): number {
    return this.score;
  }

  get currentCombo(): number {
    return this.combo;
  }

  /** Weisse Faenge auf dem Weg zur naechsten Stufe. */
  get currentHoldProgress(): number {
    return this.holdProgress;
  }

  get rescueReady(): boolean {
    return this.combo >= SERIES_RESCUE_MIN_COMBO && !this.rescueUsed;
  }

  get currentMultiplier(): number {
    return multiplierForComboWithTalent(this.combo, this.seriesMultiplierBonus);
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
