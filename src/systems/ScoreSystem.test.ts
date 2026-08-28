/**
 * Tests fuer Punkte, Combo und Multiplikator.
 *
 * Die Tests lesen ihre Erwartungen aus `COMBO_TIERS` statt feste Zahlen zu
 * setzen: ein Balancing-Wechsel in der Config soll die Tests nicht rot faerben,
 * ein Bruch der Combo-REGEL dagegen schon.
 */

import { describe, expect, it } from 'vitest';

import {
  COMBO_GRACE_MS,
  COMBO_TIERS,
  SERIES_TRAIL_BASE_ALPHA,
  SERIES_TRAIL_BASE_FREQUENCY_MS,
  SERIES_TRAIL_BASE_LIFESPAN_MS,
  SERIES_TRAIL_BASE_SCALE,
  SERIES_TRAIL_CORE_MIN_ALPHA,
  SERIES_TRAIL_GLOW_ALPHA,
  SERIES_TRAIL_GLOW_WIDTH_MULTIPLIER,
  SERIES_TRAIL_TIERS,
} from '@/config/GameConfig';
import { RARITY_BY_ID } from '@/config/rarities';
import { resolveStats } from '@/config/talents';
import { WORLDS } from '@/config/worlds';
import {
  multiplierForCombo,
  multiplierForComboWithTalent,
  ScoreSystem,
  trailTierForSeries,
} from '@/systems/ScoreSystem';

const POOR = RARITY_BY_ID.poor;
const LEGENDARY = RARITY_BY_ID.legendary;
const RARE = RARITY_BY_ID.rare;
const UNCOMMON = RARITY_BY_ID.uncommon;
const COMMON = RARITY_BY_ID.common;

/** Ein System ohne Talent-Boni: Multiplikatoren neutral bei 1. */
function createSystem(scoreMultiplier = 1, xpMultiplier = 1): ScoreSystem {
  return new ScoreSystem(COMBO_GRACE_MS, scoreMultiplier, xpMultiplier);
}

describe('multiplierForCombo', () => {
  it('liefert fuer jede konfigurierte Stufe genau deren Multiplikator', () => {
    for (const tier of COMBO_TIERS) {
      expect(multiplierForCombo(tier.minCombo)).toBe(tier.multiplier);
    }
  });

  it('haelt den Multiplikator bis zur naechsten Stufe', () => {
    const [first, second] = COMBO_TIERS;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(multiplierForCombo(second!.minCombo - 1)).toBe(first!.multiplier);
  });

  it('steigt nie wieder ab', () => {
    let previous = 0;
    for (let combo = 0; combo <= 60; combo++) {
      const current = multiplierForCombo(combo);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('setzt Resonanz erst ab dem sichtbaren Serienbonus auf den Multiplikator', () => {
    expect(multiplierForComboWithTalent(1, 0.15)).toBe(1);
    expect(multiplierForComboWithTalent(2, 0.15)).toBeCloseTo(1.35);
    expect(multiplierForComboWithTalent(16, 0.15)).toBeCloseTo(3.35);
  });
});

describe('ScoreSystem - Fangen', () => {
  it('zaehlt Punkte mit dem Multiplikator der NEUEN Serie', () => {
    const system = createSystem();

    // Erster farbiger Fang: Serie 1, damit Multiplikator 1.
    const outcome = system.registerCollect(RARE!);

    expect(outcome.combo).toBe(1);
    expect(outcome.multiplier).toBe(1);
    expect(outcome.awardedPoints).toBe(RARE!.points);
    expect(system.currentScore).toBe(RARE!.points);
  });

  it('meldet einen Stufensprung nur in dem Fang, der ihn ausloest', () => {
    const system = createSystem();
    const tier = COMBO_TIERS[1];
    expect(tier).toBeDefined();

    const outcomes = Array.from({ length: tier!.minCombo }, () => system.registerCollect(RARE!));

    const jumpIndex = outcomes.findIndex((o) => o.multiplierIncreased);
    expect(outcomes[jumpIndex]?.combo).toBe(tier!.minCombo);
    // Genau ein Sprung bis hierher: der auf die zweite Stufe.
    expect(outcomes.filter((o) => o.multiplierIncreased)).toHaveLength(1);
  });

  it('wendet den Talent-Punktemultiplikator an und rundet kaufmaennisch', () => {
    const system = createSystem(1.5);

    expect(system.registerCollect(POOR!).awardedPoints).toBe(Math.round(POOR!.points * 1.5));
  });

  it('steigert die Serie ueber unterschiedliche farbige Seltenheiten hinweg', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.registerCollect(UNCOMMON!);
    const outcome = system.registerCollect(LEGENDARY!);
    expect(outcome.combo).toBe(3);
    expect(outcome.multiplier).toBe(multiplierForCombo(3));
    expect(outcome.xpGained).toBe(LEGENDARY!.xp);
  });

  it('belohnt Resonanz bei einer hohen Serie, ohne den ersten Fang zu veraendern', () => {
    const system = new ScoreSystem(COMBO_GRACE_MS, 1, 1, 0.15);
    expect(system.registerCollect(LEGENDARY!).awardedPoints).toBe(250);

    for (let i = 1; i < 15; i += 1) system.registerCollect(LEGENDARY!);

    const outcome = system.registerCollect(LEGENDARY!);
    expect(outcome.combo).toBe(16);
    expect(outcome.multiplier).toBe(3.35);
    expect(outcome.awardedPoints).toBe(Math.round(250 * 3.35));
  });
});

describe('ScoreSystem - Combo-Zerfall', () => {
  it('haelt die Combo, solange das Fenster laeuft', () => {
    const system = createSystem();
    system.registerCollect(RARE!);

    expect(system.update(COMBO_GRACE_MS - 1).comboReset).toBe(false);
    expect(system.currentCombo).toBe(1);
  });

  it('setzt die Combo zurueck, wenn das Fenster ablaeuft', () => {
    const system = createSystem();
    system.registerCollect(RARE!);

    expect(system.update(COMBO_GRACE_MS).comboReset).toBe(true);
    expect(system.currentCombo).toBe(0);
  });

  it('meldet den Zerfall nur einmal', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.update(COMBO_GRACE_MS);

    expect(system.update(COMBO_GRACE_MS).comboReset).toBe(false);
  });

  it('startet das Fenster bei jedem Fang neu', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.update(COMBO_GRACE_MS - 1);

    system.registerCollect(RARE!);

    expect(system.comboTimerRatio).toBe(1);
    expect(system.update(COMBO_GRACE_MS - 1).comboReset).toBe(false);
    expect(system.currentCombo).toBe(2);
  });

  it('bricht die Combo NICHT bei einem verpassten Relikt', () => {
    const system = createSystem();
    system.registerCollect(RARE!);

    system.registerMiss();

    // Die dokumentierte Kernregel: belohnt wird Flow, nicht Perfektion.
    expect(system.currentCombo).toBe(1);
  });

  it('haelt den Timer-Anteil zwischen 0 und 1', () => {
    const system = createSystem();
    expect(system.comboTimerRatio).toBe(0);

    system.registerCollect(RARE!);
    expect(system.comboTimerRatio).toBe(1);

    system.update(COMBO_GRACE_MS / 2);
    expect(system.comboTimerRatio).toBeCloseTo(0.5);
  });
});

describe('ScoreSystem - Flow-Kette', () => {
  it('verdoppelt ab dem dritten gleichen grünen oder selteneren Relikt die Punkte', () => {
    const system = createSystem();
    const tier = COMBO_TIERS[1]!;
    let outcome = system.registerCollect(RARE!);
    for (let index = 1; index < tier.minCombo; index += 1) {
      outcome = system.registerCollect(index % 2 === 0 ? RARE! : LEGENDARY!);
    }

    expect(outcome.sameRarityStreak).toBe(tier.minCombo);
    expect(outcome.multiplier).toBe(tier.multiplier);
    expect(outcome.streakBonus).toBe(true);
  });

  it('setzt die Serie bei einer anderen Seltenheit zurück', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.registerCollect(LEGENDARY!);
    system.update(COMBO_GRACE_MS);
    const restarted = system.registerCollect(RARE!);
    expect(restarted.sameRarityStreak).toBe(1);
    expect(restarted.multiplier).toBe(1);
  });
});

describe('ScoreSystem - Serie: halten vs. steigern', () => {
  it('steigert die Serie bei einem farbigen Fang', () => {
    const system = createSystem();
    expect(system.registerCollect(UNCOMMON!).combo).toBe(1);
    expect(system.registerCollect(RARE!).combo).toBe(2);
  });

  it('steigert die Serie NICHT bei einem weissen Fang', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.registerCollect(RARE!);

    const gerettet = system.registerCollect(POOR!);

    expect(gerettet.combo).toBe(2);
    expect(gerettet.comboIncreased).toBe(false);
    expect(gerettet.seriesHeldOnly).toBe(true);
  });

  it('haelt mit einem weissen Fang das Fenster offen', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.update(COMBO_GRACE_MS - 1);

    // Ohne diesen Rettungsfang waere die Serie im naechsten Frame weg.
    system.registerCollect(COMMON!);

    expect(system.update(COMBO_GRACE_MS - 1).comboReset).toBe(false);
    // Der weisse Fang hat gerettet, aber nicht gesteigert: Serie bleibt 1.
    expect(system.currentCombo).toBe(1);
  });

  it('laesst die Serie trotz weisser Faenge ablaufen, wenn das Fenster endet', () => {
    const system = createSystem();
    system.registerCollect(RARE!);
    system.registerCollect(POOR!);

    expect(system.update(COMBO_GRACE_MS).comboReset).toBe(true);
    expect(system.currentCombo).toBe(0);
  });

  it('zeigt ein laufendes Fenster auch bei Serie 0 - nur weisse Faenge', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    // Die Serie steht auf 0, das Fenster laeuft trotzdem. Zeigte die Anzeige
    // hier 0, saehe der Spieler nicht, dass sein Fang gewirkt hat.
    expect(system.currentCombo).toBe(0);
    expect(system.comboTimerRatio).toBe(1);
  });

  it('meldet keinen Zerfall, wenn nie eine Serie bestand', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    expect(system.update(COMBO_GRACE_MS).comboReset).toBe(false);
  });

  it('zaehlt weisse Faenge weiterhin fuer Punkte und Statistik', () => {
    const system = createSystem();
    const outcome = system.registerCollect(POOR!);

    expect(outcome.awardedPoints).toBe(POOR!.points);
    expect(system.toRunStats(WORLDS[0]!.id).collected.poor).toBe(1);
  });
});

describe('trailTierForSeries', () => {
  it('gibt ohne laufende Serie keine Schleife', () => {
    expect(trailTierForSeries(0)).toBeNull();
  });

  it('liefert fuer jede konfigurierte Stufe genau deren Werte', () => {
    for (const tier of SERIES_TRAIL_TIERS) {
      expect(trailTierForSeries(tier.minSeries)).toEqual(tier);
    }
  });

  it('ist ab der ersten Serie sichtbar', () => {
    // Bei Serie 1 muss bereits eine Stufe greifen: Ein Spieler soll sofort
    // sehen, dass seine Serie laeuft - nicht erst nach fuenf Faengen.
    expect(SERIES_TRAIL_TIERS[0]!.minSeries).toBe(1);
    expect(trailTierForSeries(1)).not.toBeNull();
  });

  it('hebt sich in jeder Stufe deutlich vom Grundzustand ab', () => {
    // Sichtbarkeit haengt an allen vier Werten, nicht nur an der Laenge.
    for (const tier of SERIES_TRAIL_TIERS) {
      expect(tier.lifespanMs).toBeGreaterThan(SERIES_TRAIL_BASE_LIFESPAN_MS);
      expect(tier.frequencyMs).toBeLessThan(SERIES_TRAIL_BASE_FREQUENCY_MS);
      expect(tier.scale).toBeGreaterThan(SERIES_TRAIL_BASE_SCALE);
      expect(tier.alpha).toBeGreaterThan(SERIES_TRAIL_BASE_ALPHA);
    }
  });

  it('steigert jede Stufe gegenueber ihrer Vorgaengerin', () => {
    for (let i = 1; i < SERIES_TRAIL_TIERS.length; i++) {
      const vorher = SERIES_TRAIL_TIERS[i - 1]!;
      const jetzt = SERIES_TRAIL_TIERS[i]!;
      expect(jetzt.minSeries).toBeGreaterThan(vorher.minSeries);
      expect(jetzt.lifespanMs).toBeGreaterThanOrEqual(vorher.lifespanMs);
      expect(jetzt.frequencyMs).toBeLessThanOrEqual(vorher.frequencyMs);
      expect(jetzt.scale).toBeGreaterThan(vorher.scale);
    }
  });

  it('haelt eine Stufe bis zur naechsten', () => {
    const [erste, zweite] = SERIES_TRAIL_TIERS;
    expect(trailTierForSeries(zweite!.minSeries - 1)?.color).toBe(erste!.color);
  });

  it('deckelt die Laenge, damit die Spur das Spielfeld nicht verdeckt', () => {
    const laengste = Math.max(...SERIES_TRAIL_TIERS.map((t) => t.lifespanMs));
    // Auch weit jenseits der hoechsten Stufe waechst die Laenge nicht weiter.
    expect(trailTierForSeries(500)?.lifespanMs).toBe(laengste);
  });

  it('haelt die Lesbarkeit der Kernspur vom weichen Glow getrennt', () => {
    expect(SERIES_TRAIL_GLOW_WIDTH_MULTIPLIER).toBeGreaterThan(1);
    expect(SERIES_TRAIL_GLOW_ALPHA).toBeGreaterThan(0);
    expect(SERIES_TRAIL_GLOW_ALPHA).toBeLessThan(0.5);
    expect(SERIES_TRAIL_CORE_MIN_ALPHA).toBeGreaterThan(0.25);
    expect(SERIES_TRAIL_CORE_MIN_ALPHA).toBeLessThanOrEqual(1);
  });
});

describe('ScoreSystem - Run-Statistik', () => {
  it('haelt den hoechsten erreichten Wert fest, nicht den letzten', () => {
    const system = createSystem();
    const tier = COMBO_TIERS[1];

    for (let i = 0; i < tier!.minCombo; i++) system.registerCollect(POOR!);
    const peakCombo = system.currentCombo;
    const peakMultiplier = system.currentMultiplier;

    // Combo verfallen lassen und neu anfangen.
    system.update(COMBO_GRACE_MS);
    system.registerCollect(POOR!);

    const stats = system.toRunStats('meadow');
    expect(stats.bestCombo).toBe(peakCombo);
    expect(stats.bestMultiplier).toBe(peakMultiplier);
  });

  it('zaehlt Faenge je Seltenheit und die Fehlversuche', () => {
    const system = createSystem();
    system.registerCollect(POOR!);
    system.registerCollect(POOR!);
    system.registerCollect(LEGENDARY!);
    system.registerMiss();

    const stats = system.toRunStats('meadow');
    expect(stats.collected.poor).toBe(2);
    expect(stats.collected.legendary).toBe(1);
    expect(stats.totalCollected).toBe(3);
    expect(stats.missed).toBe(1);
    expect(stats.worldId).toBe('meadow');
  });

  it('liefert eine Kopie der Zaehler, nicht den internen Zustand', () => {
    const system = createSystem();
    system.registerCollect(POOR!);

    const stats = system.toRunStats('meadow');
    stats.collected.poor = 999;

    expect(system.toRunStats('meadow').collected.poor).toBe(1);
  });
});

describe('ScoreSystem - Talent x Welt Multiplikator-Produkt', () => {
  // docs/AUDIT_2026-08-17.md Abschnitt 5.7: GameScene.ts konstruiert
  // ScoreSystem mit dem PRODUKT aus Talent- und Welt-Multiplikator
  // (this.stats.scoreMultiplier * this.world.scoreMultiplier), nicht mit
  // einem isolierten Skalarwert wie in den Tests oben. Dieser Block
  // reproduziert genau dieses Muster mit den echten Config-Werten.
  it('rundet konsistent, wenn Talent- und Welt-Multiplikator zusammen ein krummes Produkt ergeben', () => {
    const maxFortuneStats = resolveStats({ fortune: 5 });
    const highestWorld = WORLDS[WORLDS.length - 1]!;
    const combinedScoreMultiplier = maxFortuneStats.scoreMultiplier * highestWorld.scoreMultiplier;

    const system = new ScoreSystem(COMBO_GRACE_MS, combinedScoreMultiplier, 1);
    const outcome = system.registerCollect(RARE!);

    expect(outcome.awardedPoints).toBe(Math.round(RARE!.points * combinedScoreMultiplier));
  });

  it('haeuft ueber viele Faenge keinen sichtbaren Rundungsfehler gegenueber der Einzelrechnung an', () => {
    const maxInsightStats = resolveStats({ insight: 5 });
    const highestWorld = WORLDS[WORLDS.length - 1]!;
    const combinedXpMultiplier = maxInsightStats.xpMultiplier * highestWorld.xpMultiplier;

    const system = new ScoreSystem(COMBO_GRACE_MS, 1, combinedXpMultiplier);

    let expectedXp = 0;
    for (let i = 0; i < 50; i++) {
      const rarity = i % 2 === 0 ? RARE! : POOR!;
      system.registerCollect(rarity);
      expectedXp += Math.round(rarity.xp * combinedXpMultiplier);
    }

    expect(system.toRunStats('meadow').xpGained).toBe(expectedXp);
  });
});
