/** Regressionstests fuer die bewusst abgestufte Phase-5-Balance. */

import { describe, expect, it } from 'vitest';

import {
  COINS_PER_RUN,
  COMBO_TIERS,
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_LOGIN_BONUS_COINS,
  SERIES_RAISING_MIN_RARITY_INDEX,
  TALENT_RESET_COST,
} from '@/config/GameConfig';
import { RARITIES } from '@/config/rarities';
import {
  DEFAULT_SHIP_COLOR,
  DEFAULT_SHIP_SHAPE,
  getShipColor,
  getShipShape,
  SHIP_COLORS,
  SHIP_SHAPES,
  shipHullTint,
  shipTint,
} from '@/config/shop';
import { talentCost } from '@/config/talents';
import { SHIP_DRAWINGS } from '@/ui/shipShapes';
import { WORLDS } from '@/config/worlds';

describe('Phase-5-Balance', () => {
  it('laesst die ersten drei Welten ohne Zeitverlust-Hindernisse', () => {
    expect(WORLDS.slice(0, 3).every((world) => world.obstacleMode !== 'penalty')).toBe(true);
  });

  it('steigert Herausforderung und Belohnung gemeinsam', () => {
    for (let index = 1; index < WORLDS.length; index += 1) {
      expect(WORLDS[index]!.difficultyScale).toBeGreaterThanOrEqual(
        WORLDS[index - 1]!.difficultyScale,
      );
      expect(WORLDS[index]!.scoreMultiplier).toBeGreaterThanOrEqual(
        WORLDS[index - 1]!.scoreMultiplier,
      );
      expect(WORLDS[index]!.xpMultiplier).toBeGreaterThanOrEqual(WORLDS[index - 1]!.xpMultiplier);
    }
  });

  /**
   * Die Pruefung oben laesst `>=` zu und war damit blind fuer den Fall, der
   * 2026-08-19 auffiel: Die Welten 2 bis 5 standen alle auf
   * `difficultyScale: 1` - fuenf aufeinander folgende Welten ohne jede
   * mechanische Steigerung, und `1 >= 1` ist wahr. Eine Welt darf sich von
   * ihrer Vorgaengerin nicht nur durch Farbe und Modifikator unterscheiden.
   */
  it('macht jede Welt spuerbar schwerer als ihre Vorgaengerin', () => {
    for (let index = 1; index < WORLDS.length; index += 1) {
      const vorher = WORLDS[index - 1]!;
      const jetzt = WORLDS[index]!;

      expect(
        jetzt.difficultyScale,
        `${jetzt.name} ist nicht schwerer als ${vorher.name}`,
      ).toBeGreaterThan(vorher.difficultyScale);
    }
  });

  /**
   * Die Erschwernis muss bezahlt werden. Ohne diese Pruefung koennte eine
   * Welt schwerer werden, ohne mehr Punkte zu geben - dann waehlt sie
   * niemand freiwillig.
   */
  it('bezahlt jede Erschwernis mit mehr Punkten und XP', () => {
    for (let index = 1; index < WORLDS.length; index += 1) {
      const vorher = WORLDS[index - 1]!;
      const jetzt = WORLDS[index]!;

      expect(jetzt.scoreMultiplier, `${jetzt.name} gibt nicht mehr Punkte`).toBeGreaterThan(
        vorher.scoreMultiplier,
      );
      expect(jetzt.xpMultiplier, `${jetzt.name} gibt nicht mehr XP`).toBeGreaterThan(
        vorher.xpMultiplier,
      );
    }
  });

  it('haelt die Coin-Ziele der aktuellen Economy fest', () => {
    expect(COINS_PER_RUN).toBe(20);
    expect(DAILY_LOGIN_BONUS_COINS).toBe(25);
    expect(DAILY_COMPLETION_BONUS_COINS).toBe(90);
    expect(talentCost(0)).toBe(250);
    expect(talentCost(1)).toBe(350);
    expect(TALENT_RESET_COST).toBe(100);
  });
});

describe('Serien-Multiplikator', () => {
  // Regression zum Befund vom 2026-08-19: Die Schwellen standen noch auf den
  // Werten des alten Systems, in dem jeder Fang die Serie steigerte. Seit nur
  // farbige Relikte steigern, waren vier der fuenf Stufen unerreichbar.

  /** Anteil der Relikte, die die Serie ueberhaupt steigern koennen. */
  const ANTEIL_FARBIG =
    RARITIES.filter((_, index) => index >= SERIES_RAISING_MIN_RARITY_INDEX).reduce(
      (summe, rarity) => summe + rarity.weight,
      0,
    ) / RARITIES.reduce((summe, rarity) => summe + rarity.weight, 0);

  it('steigt monoton in Schwelle und Multiplikator', () => {
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      expect(COMBO_TIERS[i]!.minCombo).toBeGreaterThan(COMBO_TIERS[i - 1]!.minCombo);
      expect(COMBO_TIERS[i]!.multiplier).toBeGreaterThan(COMBO_TIERS[i - 1]!.multiplier);
    }
  });

  it('haelt die unteren Stufen im normalen Spiel erreichbar', () => {
    // Gemessen reisst die Serie im Schnitt alle 17 Faenge. Die ersten beiden
    // Bonusstufen muessen innerhalb dieser Spanne liegen, sonst sieht ein
    // Spieler nie einen Multiplikator.
    const FAENGE_BIS_ABRISS = 17;
    for (const tier of COMBO_TIERS.slice(1, 3)) {
      const noetigeFaenge = tier.minCombo / ANTEIL_FARBIG;
      expect(noetigeFaenge).toBeLessThanOrEqual(FAENGE_BIS_ABRISS);
    }
  });

  it('belohnt die hoechste Stufe sichtbar staerker als die erste', () => {
    const erste = COMBO_TIERS[1]!.multiplier;
    const hoechste = COMBO_TIERS[COMBO_TIERS.length - 1]!.multiplier;
    // Ohne deutlichen Abstand lohnt es sich nicht, eine Serie zu halten.
    expect(hoechste / erste).toBeGreaterThan(1.8);
  });
});

describe('Laden: Formen und Farben', () => {
  // Bei dreissig Eintraegen faellt ein doppelter Schluessel oder ein
  // vergessener `skinIndex` beim Lesen nicht auf. Diese Tests halten die
  // Tabelle konsistent, ohne dass jemand sie durchzaehlen muss.

  it('vergibt jede Form-Id genau einmal', () => {
    const ids = SHIP_SHAPES.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('vergibt jede Farb-Id genau einmal', () => {
    const ids = SHIP_COLORS.map((color) => color.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hat fuer jeden skinIndex eine Zeichnung', () => {
    for (const shape of SHIP_SHAPES) {
      expect(SHIP_DRAWINGS[shape.skinIndex]).toBeTypeOf('function');
    }
  });

  it('nutzt jeden skinIndex nur einmal', () => {
    const indizes = SHIP_SHAPES.map((shape) => shape.skinIndex);
    expect(new Set(indizes).size).toBe(indizes.length);
  });

  it('laesst genau einen kostenlosen Einstieg je Kategorie', () => {
    // Ohne ein Schiff und eine Farbe kann man nicht spielen - aber mehr als
    // je einen Gratis-Eintrag soll es auch nicht geben.
    expect(SHIP_SHAPES.filter((shape) => shape.cost === 0)).toHaveLength(1);
    expect(SHIP_COLORS.filter((color) => color.cost === 0)).toHaveLength(1);
  });

  it('macht den kostenlosen Eintrag zum Standard', () => {
    expect(SHIP_SHAPES.find((shape) => shape.cost === 0)?.id).toBe(DEFAULT_SHIP_SHAPE);
    expect(SHIP_COLORS.find((color) => color.cost === 0)?.id).toBe(DEFAULT_SHIP_COLOR);
  });

  it('gibt jeder Form einen Namen und eine Beschreibung', () => {
    for (const shape of SHIP_SHAPES) {
      expect(shape.name.length).toBeGreaterThan(0);
      expect(shape.description.length).toBeGreaterThan(0);
    }
  });

  it('faellt bei unbekannter Id auf den Standard zurueck', () => {
    expect(getShipShape('gibtesnicht').id).toBe(DEFAULT_SHIP_SHAPE);
    expect(getShipColor('gibtesnicht').id).toBe(DEFAULT_SHIP_COLOR);
  });

  it('haelt die Preise in einer erreichbaren Spanne', () => {
    // Ein Run bringt rund 50 Muenzen. Die teuerste Form entspricht damit
    // etwa 52 Runden - ein Fernziel, aber kein endloser Grind.
    const teuerste = Math.max(...SHIP_SHAPES.map((shape) => shape.cost));
    expect(teuerste).toBeLessThanOrEqual(3_000);
  });
});

describe('Schiffsfarbe: Rumpf und Schein', () => {
  // Regression zum Fund vom 2026-08-20: Der Rumpf stand seit dem ersten
  // Commit fest auf Weiss. Aura und Halo trugen die Farbe, das Schiff selbst
  // nicht - wer Gold kaufte, bekam ein weisses Schiff mit goldenem Rand.

  const mitFarbe = (id: string) => ({ shipColor: id, ownedShipColors: ['world', id] });

  it('faerbt den Rumpf in der gekauften Farbe', () => {
    expect(shipHullTint(mitFarbe('gold'))).toBe(getShipColor('gold').color);
  });

  it('laesst den Rumpf bei Weltfarbe weiss', () => {
    // Ein grosser Teil des Spielfelds traegt die Weltfarbe. Eine gruene Figur
    // auf gruenem Grund ist im Gewuehl kaum auszumachen - genau das zeigte
    // der erste Versuch, den Rumpf pauschal mitzufaerben.
    expect(shipHullTint({ shipColor: 'world', ownedShipColors: ['world'] })).toBe(0xffffff);
  });

  it('faellt auf Weiss zurueck, wenn die Farbe nicht gekauft wurde', () => {
    // Ein manipulierter Spielstand soll keine ungekaufte Farbe zeigen.
    expect(shipHullTint({ shipColor: 'platinum', ownedShipColors: ['world'] })).toBe(0xffffff);
  });

  it('gibt Aura und Halo bei Weltfarbe die Weltfarbe', () => {
    const welt = 0x123456;
    expect(shipTint({ shipColor: 'world', ownedShipColors: ['world'] }, welt)).toBe(welt);
  });

  it('gibt Aura und Halo die gekaufte Farbe', () => {
    expect(shipTint(mitFarbe('ruby'), 0x123456)).toBe(getShipColor('ruby').color);
  });
});
