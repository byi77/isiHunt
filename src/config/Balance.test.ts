/** Regressionstests fuer die bewusst abgestufte Phase-5-Balance. */

import { describe, expect, it } from 'vitest';

import {
  COINS_PER_RUN,
  COMBO_TIERS,
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_LOGIN_BONUS_COINS,
  MAX_LEVEL,
  RARITY_IMPACT_MIN_POINTS,
  RARITY_RAYS_MIN_POINTS,
  SERIES_RAISING_MIN_RARITY_INDEX,
  TALENT_RESET_COST,
} from '@/config/GameConfig';
import {
  BALANCE,
  BALANCE_SNAPSHOT,
  EXPECTED_POINTS_PER_CATCH,
  EXPECTED_XP_PER_CATCH,
  TALENT_COSTS,
  totalXpForLevel,
  xpForLevel,
} from '@/config/balance';
import { RARITIES } from '@/config/rarities';
import {
  DEFAULT_SHIP_AURA,
  DEFAULT_SHIP_COLOR,
  DEFAULT_SHIP_SHAPE,
  getShipAura,
  getShipColor,
  getShipShape,
  SHIP_AURAS,
  SHIP_COLORS,
  SHIP_SHAPES,
  shipAuraIndex,
  shipHullTint,
  shipTint,
} from '@/config/shop';
import { talentCost } from '@/config/talents';
import {
  applyTintShift,
  AURA_FRAME_RUHE,
  SHIP_ANIMATIONS,
  stehendesBild,
  VOLLER_FARBKREIS_INDEX,
} from '@/ui/shipAnimations';
import { SHIP_DRAWINGS } from '@/ui/shipShapes';
import { WORLDS } from '@/config/worlds';

describe('Phase-5-Balance', () => {
  it('haelt Punkte und XP je Relikt in einer zentralen Tabelle', () => {
    const rarities = Object.values(BALANCE.rarities);
    expect(rarities.reduce((sum, rarity) => sum + rarity.weight, 0)).toBe(100);
    expect(rarities.every((rarity) => rarity.points > 0 && rarity.xp > 0)).toBe(true);
    expect(EXPECTED_POINTS_PER_CATCH).toBeGreaterThan(0);
    expect(EXPECTED_XP_PER_CATCH).toBeGreaterThan(0);
    for (const [id, values] of Object.entries(BALANCE.rarities)) {
      expect(RARITIES.find((rarity) => rarity.id === id)).toMatchObject(values);
    }
  });

  it('macht Seltenheit und Jackpot-Faenge fuer den Score sichtbar', () => {
    expect(Object.values(BALANCE.rarities).map((rarity) => rarity.points)).toEqual([
      3, 5, 10, 25, 75, 250,
    ]);

    const weightedScoreFromRarePlus = ['rare', 'epic', 'legendary'].reduce(
      (sum, id) =>
        sum +
        BALANCE.rarities[id as keyof typeof BALANCE.rarities].points *
          BALANCE.rarities[id as keyof typeof BALANCE.rarities].weight,
      0,
    );
    const weightedScore = Object.values(BALANCE.rarities).reduce(
      (sum, rarity) => sum + rarity.points * rarity.weight,
      0,
    );

    // Rare+ sollen die Jagd auf Farbe klar belohnen. Orange bleibt selten,
    // darf bei einer hohen Serie aber als echter Jackpot einschlagen.
    expect(weightedScoreFromRarePlus / weightedScore).toBeGreaterThan(0.7);
    expect(EXPECTED_POINTS_PER_CATCH).toBeCloseTo(15.045, 3);
    const coloredPoints = ['uncommon', 'rare', 'epic', 'legendary'].map(
      (id) => BALANCE.rarities[id as keyof typeof BALANCE.rarities].points,
    );
    expect(
      coloredPoints.every((points, index) => index === 0 || points > coloredPoints[index - 1]!),
    ).toBe(true);
    expect(RARITY_RAYS_MIN_POINTS).toBe(BALANCE.rarities.rare.points);
    expect(RARITY_IMPACT_MIN_POINTS).toBe(BALANCE.rarities.epic.points);
  });

  it('berechnet die Langzeitziele aus denselben Referenz-Runs', () => {
    expect(BALANCE_SNAPSHOT.runsToMaxLevel).toBeGreaterThan(200);
    expect(BALANCE_SNAPSHOT.runsToMaxLevel).toBeLessThan(600);
    expect(BALANCE_SNAPSHOT.runsToMaxTalents).toBeGreaterThan(200);
    expect(TALENT_COSTS).toEqual([250, 350, 500, 650, 850]);
  });

  it('verwendet fuer Levelanker dieselbe aktuelle XP-Kurve', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(4)).toBe(xpForLevel(1) + xpForLevel(2) + xpForLevel(3));
    expect(totalXpForLevel(MAX_LEVEL)).toBe(BALANCE_SNAPSHOT.xpToMaxLevel);
  });

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

  it('macht die hohe Serie fuer seltene Fange deutlich lohnender', () => {
    expect(COMBO_TIERS.map((tier) => tier.multiplier)).toEqual([1, 1.2, 1.5, 1.9, 2.4, 3.2]);
    const legendary = BALANCE.rarities.legendary.points;
    const highSeriesLegendary = legendary * COMBO_TIERS.at(-1)!.multiplier;

    // Orange bei Serie 16+ ist der bewusst gesetzte Jackpot-Moment.
    expect(highSeriesLegendary).toBe(800);
    expect(highSeriesLegendary / legendary).toBeGreaterThan(3);
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

describe('Laden: Auren', () => {
  // Eine Aura ist eine Rechnung, die 90 Sekunden lang je Frame laeuft. Ein
  // Vorzeichenfehler faellt beim Lesen nicht auf, im Spiel dagegen sofort -
  // als Figur, die verschwindet oder sich auf Bildschirmgroesse aufblaest.
  // Diese Tests halten die Grenzen fest, in denen sie spielbar bleibt.

  /** Vier Sekunden in Schritten von 10 ms - deckt jede Periode mehrfach ab. */
  const zeitpunkte = Array.from({ length: 400 }, (_, i) => i * 10);

  it('vergibt jede Aura-Id genau einmal', () => {
    const ids = SHIP_AURAS.map((aura) => aura.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hat fuer jeden animIndex eine Bewegung', () => {
    for (const aura of SHIP_AURAS) {
      if (aura.animIndex === null) continue;
      expect(SHIP_ANIMATIONS[aura.animIndex]).toBeTypeOf('function');
    }
  });

  it('nutzt jeden animIndex nur einmal', () => {
    const indizes = SHIP_AURAS.map((aura) => aura.animIndex).filter((i) => i !== null);
    expect(new Set(indizes).size).toBe(indizes.length);
  });

  it('laesst genau einen kostenlosen Eintrag, und das ist der Standard', () => {
    const gratis = SHIP_AURAS.filter((aura) => aura.cost === 0);
    expect(gratis).toHaveLength(1);
    expect(gratis[0]!.id).toBe(DEFAULT_SHIP_AURA);
    // Der Standard ist "keine Aura" - wer nichts gekauft hat, bewegt sich
    // nicht anders als vor diesem Update.
    expect(gratis[0]!.animIndex).toBeNull();
  });

  it('gibt jeder Aura einen Namen und eine Beschreibung', () => {
    for (const aura of SHIP_AURAS) {
      expect(aura.name.length).toBeGreaterThan(0);
      expect(aura.description.length).toBeGreaterThan(0);
    }
  });

  it('faellt bei unbekannter Id auf den Standard zurueck', () => {
    expect(getShipAura('gibtesnicht').id).toBe(DEFAULT_SHIP_AURA);
  });

  it('macht jede Aura teurer als die teuerste Form', () => {
    // Die Auren sind das Fernziel nach dem Laden, nicht daneben. Waere eine
    // billiger als eine Form, waere die Reihenfolge des Fortschritts kaputt.
    const teuersteForm = Math.max(...SHIP_SHAPES.map((shape) => shape.cost));
    for (const aura of SHIP_AURAS) {
      if (aura.cost === 0) continue;
      expect(aura.cost).toBeGreaterThan(teuersteForm);
    }
  });

  it('haelt die Figur jederzeit sichtbar', () => {
    // Wer sein Schiff im Gewuehl verliert, verliert die Runde. Keine Aura
    // darf es unter diese Schwellen druecken - auch nicht fuer einen Frame.
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      for (const t of zeitpunkte) {
        const frame = animation(t);
        expect(frame.alpha, `Aura ${index} bei ${t} ms`).toBeGreaterThanOrEqual(0.3);
        expect(frame.alpha).toBeLessThanOrEqual(1);
        // Der Kreisel darf sich schmal drehen, aber nie ganz verschwinden.
        expect(frame.scaleX, `Aura ${index} bei ${t} ms`).toBeGreaterThan(0.05);
        expect(frame.scaleY).toBeGreaterThan(0.05);
      }
    }
  });

  it('laesst die Figur nicht ueber das Spielfeld wachsen', () => {
    // Eine Figur, die auf das Doppelte anschwillt, deckt den Sammelradius ab
    // und macht das Feedback des Halos unlesbar.
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      for (const t of zeitpunkte) {
        const frame = animation(t);
        expect(frame.scaleX, `Aura ${index} bei ${t} ms`).toBeLessThanOrEqual(1.5);
        expect(frame.scaleY).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('haelt die Farbverschiebung in ihrem Wertebereich', () => {
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      // Die Prismaflut laeuft bewusst durch den ganzen Farbkreis - die
      // Begruendung steht bei ihrer Definition. Sie ist die **einzige**
      // Ausnahme; kommt eine zweite dazu, faellt der Test unten.
      if (index === VOLLER_FARBKREIS_INDEX) continue;
      for (const t of zeitpunkte) {
        const { tint } = animation(t);
        expect(tint.lightness, `Aura ${index} bei ${t} ms`).toBeGreaterThanOrEqual(-1);
        expect(tint.lightness).toBeLessThanOrEqual(1);
        // Ueber 60 Grad ist die getragene Farbe nicht mehr wiederzuerkennen -
        // und genau die hat der Spieler bezahlt.
        expect(Math.abs(tint.hue)).toBeLessThanOrEqual(60);
      }
    }
  });

  it('laesst genau eine Aura aus der 60-Grad-Regel ausbrechen', () => {
    // Der Waechter zur Ausnahme oben. Ohne ihn koennte jemand eine zweite
    // Aura durch den vollen Farbkreis schicken, indem er sie einfach in die
    // Ausnahmeliste einträgt - hier faellt auf, dass es zwei geworden sind.
    const ausbrecher = SHIP_ANIMATIONS.map((animation, index) => ({ index, animation })).filter(
      ({ animation }) => zeitpunkte.some((t) => Math.abs(animation(t).tint.hue) > 60),
    );
    expect(ausbrecher.map((a) => a.index)).toEqual([VOLLER_FARBKREIS_INDEX]);
  });

  it('rechnet jede Aura ohne NaN', () => {
    // Eine Division durch eine Periode oder eine negative Basis unter `pow`
    // liefert still NaN. Phaser zeichnet daraufhin gar nichts mehr - die
    // Figur verschwindet, ohne dass eine Ausnahme faellt.
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      for (const t of zeitpunkte) {
        const frame = animation(t);
        const werte = {
          scaleX: frame.scaleX,
          scaleY: frame.scaleY,
          rotation: frame.rotation,
          alpha: frame.alpha,
          lightness: frame.tint.lightness,
          hue: frame.tint.hue,
        };
        for (const [name, wert] of Object.entries(werte)) {
          expect(Number.isFinite(wert), `Aura ${index}, ${name} bei ${t} ms`).toBe(true);
        }
      }
    }
  });

  it('laeuft bei t = 0 ohne Sprung los', () => {
    // Die Vorschau setzt den Zaehler bei jedem Wechsel auf 0 zurueck. Waere
    // der Anfang ein Sprung, saehe jeder Wechsel wie ein Zeichenfehler aus.
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      const start = animation(0);
      const gleichDanach = animation(16);
      expect(Math.abs(start.scaleX - gleichDanach.scaleX), `Aura ${index}`).toBeLessThan(0.1);
      expect(Math.abs(start.alpha - gleichDanach.alpha)).toBeLessThan(0.1);
    }
  });
});

describe('Farbverschiebung der Auren', () => {
  it('laesst die Farbe ohne Verschiebung unveraendert', () => {
    expect(applyTintShift(0xffd479, AURA_FRAME_RUHE.tint)).toBe(0xffd479);
  });

  it('haelt den Farbton fest, wenn nur die Helligkeit wandert', () => {
    // Der Kern des Entwurfs: Gold bleibt Gold, auch wenn es pulsiert. Ohne
    // das waere die gekaufte Farbe unter der Aura unsichtbar - der Spieler
    // haette zwei Kategorien bezahlt und saehe nur eine.
    const gold = 0xffd479;
    const heller = applyTintShift(gold, { lightness: 0.4, hue: 0 });
    const dunkler = applyTintShift(gold, { lightness: -0.4, hue: 0 });

    const rot = (c: number): number => (c >> 16) & 0xff;
    const blau = (c: number): number => c & 0xff;

    // Gold hat mehr Rot als Blau. Diese Ordnung muss beide Verschiebungen
    // ueberleben - sonst ist es kein Gold mehr.
    expect(rot(heller)).toBeGreaterThan(blau(heller));
    expect(rot(dunkler)).toBeGreaterThan(blau(dunkler));
    // Und die Richtung muss stimmen.
    expect(blau(heller)).toBeGreaterThan(blau(gold));
    expect(rot(dunkler)).toBeLessThan(rot(gold));
  });

  it('bleibt in jedem Kanal innerhalb von 8 Bit', () => {
    // Ein Ueberlauf in einem Kanal faerbt die Figur schlagartig falsch -
    // sichtbar erst im Spiel, nicht beim Lesen.
    for (const farbe of [0x000000, 0xffffff, 0xffd479, 0x2f6df0, 0xff2f5e]) {
      for (const lightness of [-1, -0.5, 0, 0.5, 1]) {
        for (const hue of [-60, -20, 0, 20, 60]) {
          const ergebnis = applyTintShift(farbe, { lightness, hue });
          expect(ergebnis).toBeGreaterThanOrEqual(0);
          expect(ergebnis).toBeLessThanOrEqual(0xffffff);
          expect(Number.isInteger(ergebnis)).toBe(true);
        }
      }
    }
  });

  it('hebt die Saettigung an, senkt sie aber nie', () => {
    // Wer eine kraeftige Farbe gekauft hat, soll sie behalten - die Aura
    // darf sie leuchten lassen, nicht ausbleichen.
    const kraeftig = 0xff2f5e; // Rubin
    const mitAura = applyTintShift(kraeftig, { lightness: 0, hue: 0, saturation: 0.3 });
    expect(mitAura).toBe(kraeftig);
  });

  it('faerbt Weiss ueber die Saettigung der Aura', () => {
    // Regression zum Fund vom 2026-08-21: Weiss hat die Saettigung 0, ein
    // Farbtondreh allein aendert daran nichts. Ohne diesen Weg waere die
    // teuerste Aura des Spiels auf dem Standardschiff unsichtbar.
    const ohne = applyTintShift(0xffffff, { lightness: 0, hue: 200, saturation: 0 });
    const mit = applyTintShift(0xffffff, { lightness: 0, hue: 200, saturation: 0.85 });
    expect(ohne).toBe(0xffffff);
    expect(mit).not.toBe(0xffffff);
  });

  it('macht Schwarz nicht bunt', () => {
    // Schwarz hat keinen Farbton. Ein Dreh im Farbkreis darf daran nichts
    // aendern - sonst faerbte sich der Onyx-Rumpf unter der Aura ein.
    expect(applyTintShift(0x000000, { lightness: 0, hue: 45 })).toBe(0x000000);
  });
});

describe('Aura: nur tragen, was gekauft wurde', () => {
  it('traegt eine gekaufte Aura', () => {
    expect(shipAuraIndex({ shipAura: 'wingbeat', ownedShipAuras: ['none', 'wingbeat'] })).toBe(0);
  });

  it('verweigert eine ungekaufte Aura', () => {
    // Gegenstueck zu `shipTint()`: Ein manipulierter Spielstand soll keine
    // ungekaufte Aura zeigen koennen.
    expect(shipAuraIndex({ shipAura: 'singularity', ownedShipAuras: ['none'] })).toBeNull();
  });

  it('liefert null fuer den Standard', () => {
    expect(shipAuraIndex({ shipAura: 'none', ownedShipAuras: ['none'] })).toBeNull();
  });
});

describe('Prismaflut: die ultimative Aura', () => {
  const prismaflut = SHIP_ANIMATIONS[VOLLER_FARBKREIS_INDEX]!;
  const definition = SHIP_AURAS.find((aura) => aura.animIndex === VOLLER_FARBKREIS_INDEX)!;
  /** Ein voller Farbdurchlauf dauert 3,2 s - vier Sekunden decken ihn ab. */
  const zeitpunkte = Array.from({ length: 400 }, (_, i) => i * 10);

  it('ist im Laden eingetragen und die teuerste Aura', () => {
    expect(definition.id).toBe('prismasurge');
    const andere = SHIP_AURAS.filter((aura) => aura.id !== definition.id).map((a) => a.cost);
    expect(definition.cost).toBeGreaterThan(Math.max(...andere));
  });

  it('verlangt als einzige Aura ein Mindestlevel', () => {
    // Eine Stufenhuerde bei mehreren Auren waere eine zweite Waehrung neben
    // den Muenzen. Genau eine ist die Aussage; zwei waeren ein System.
    const mitHuerde = SHIP_AURAS.filter((aura) => aura.minLevel > 0);
    expect(mitHuerde).toHaveLength(1);
    expect(mitHuerde[0]!.id).toBe(definition.id);
  });

  it('haelt die Stufenhuerde unterhalb des Maximallevels', () => {
    // Eine Huerde auf Stufe 100 waere kein Fernziel, sondern ein Abschluss -
    // wer sie erreicht, hat nichts mehr, wofuer er sie tragen koennte.
    expect(definition.minLevel).toBeGreaterThan(0);
    expect(definition.minLevel).toBeLessThan(MAX_LEVEL);
  });

  it('laeuft durch den gesamten Farbkreis', () => {
    // Der Kaufgrund: ein echter Regenbogen, keine Schwankung um einen Ton.
    const toene = zeitpunkte.map((t) => prismaflut(t).tint.hue);
    expect(Math.min(...toene)).toBeLessThan(20);
    expect(Math.max(...toene)).toBeGreaterThan(340);
  });

  it('laeuft in eine Richtung statt hin und her', () => {
    // Eine Welle liefe vor und zurueck und saehe aus wie ein Farbfehler.
    // Ein Durchlauf liest sich als Regenbogen - er darf nur an der Naht
    // von 360 zurueck auf 0 springen.
    const toene = zeitpunkte.slice(0, 320).map((t) => prismaflut(t).tint.hue);
    let rueckschritte = 0;
    for (let i = 1; i < toene.length; i++) {
      if (toene[i]! < toene[i - 1]!) rueckschritte++;
    }
    // Bei 3,2 s Periode und 3,2 s Messfenster genau eine Naht.
    expect(rueckschritte).toBeLessThanOrEqual(1);
  });

  it('blitzt auf, ohne dauerhaft hell zu stehen', () => {
    // "Funkeln" heisst: meistens ruhig, gelegentlich hell. Stuende die
    // Helligkeit dauerhaft oben, waere es kein Blitzen, sondern Ueberstrahlen.
    const helligkeiten = zeitpunkte.map((t) => prismaflut(t).tint.lightness);
    const spitzen = helligkeiten.filter((l) => l > 0.4).length;
    expect(spitzen).toBeGreaterThan(0);
    expect(spitzen / helligkeiten.length).toBeLessThan(0.35);
  });

  it('bleibt jederzeit voll deckend', () => {
    // Anders als das Phantom: Diese Aura soll gesehen werden, nicht
    // verschwinden. Ein erster Entwurf liess sie pulsieren - auf hellen
    // Welten war die Figur dann in der Haelfte der Frames kaum auszumachen.
    for (const t of zeitpunkte) {
      expect(prismaflut(t).alpha).toBe(1);
    }
  });

  it('bleibt in denselben Groessengrenzen wie jede andere Aura', () => {
    // Prestige rechtfertigt keine Figur, die den Sammelradius ueberdeckt.
    for (const t of zeitpunkte) {
      const frame = prismaflut(t);
      expect(frame.scaleX, `bei ${t} ms`).toBeGreaterThan(0.05);
      expect(frame.scaleX).toBeLessThanOrEqual(1.5);
      expect(frame.scaleY).toBeGreaterThan(0.05);
      expect(frame.scaleY).toBeLessThanOrEqual(1.5);
    }
  });

  it('faerbt auch eine weisse Figur bunt', () => {
    // Der Rumpf ist bei Weltfarbe weiss (`shipHullTint`). Weiss hat keinen
    // Farbton - ohne die Saettigung aus der Aura bliebe die teuerste Aura
    // des Spiels auf dem Standardschiff komplett wirkungslos.
    const farben = zeitpunkte.slice(0, 80).map((t) => applyTintShift(0xffffff, prismaflut(t).tint));
    expect(new Set(farben).size).toBeGreaterThan(10);
  });
});

describe('Aura: Start und Ruhelage', () => {
  it('faengt bei t = 0 nicht schon mitten im Effekt an', () => {
    // Regression zum Fund vom 2026-08-21: Waehrend des Countdowns stand die
    // Figur auf dem t=0-Frame, weil der Ruhe-Tween `applyAura()` ruft, bevor
    // `move()` den Zaehler startet. Bei der Prismaflut war das ein kraeftiges
    // Rot statt der Weltfarbe, mehrere Sekunden lang.
    //
    // Behoben ist das ueber ein Laufflag im Player. Dieser Test haelt die
    // andere Haelfte fest: Der erste Frame darf keine starke Abweichung von
    // der Ruhelage sein - sonst springt die Figur beim Startpfiff sichtbar.
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      const start = animation(0);
      expect(Math.abs(start.scaleX - 1), `Aura ${index} scaleX`).toBeLessThan(0.35);
      expect(Math.abs(start.scaleY - 1), `Aura ${index} scaleY`).toBeLessThan(0.35);
      expect(Math.abs(start.rotation), `Aura ${index} rotation`).toBeLessThan(0.3);
    }
  });
});

describe('Aura bei reduziertem Bewegungswunsch', () => {
  it('steht still statt langsamer zu laufen', () => {
    // Ein verlangsamter Farbwechsel waere immer noch ein Farbwechsel - und
    // damit genau das, was `prefers-reduced-motion` ausschliessen soll.
    for (const animation of SHIP_ANIMATIONS) {
      const a = stehendesBild(animation);
      const b = stehendesBild(animation);
      expect(a).toEqual(b);
    }
  });

  it('nimmt jede Bewegung heraus', () => {
    for (const [index, animation] of SHIP_ANIMATIONS.entries()) {
      const frame = stehendesBild(animation);
      expect(frame.scaleX, `Aura ${index}`).toBe(1);
      expect(frame.scaleY).toBe(1);
      expect(frame.rotation).toBe(0);
      expect(frame.alpha).toBe(1);
    }
  });

  it('daempft die Helligkeit, behaelt aber den Farbton', () => {
    // Wer 25 000 Muenzen ausgegeben hat, soll seine Aura auch dann sehen -
    // sie darf nur nicht mehr zucken.
    const frame = stehendesBild(SHIP_ANIMATIONS[VOLLER_FARBKREIS_INDEX]!);
    expect(Math.abs(frame.tint.lightness)).toBeLessThanOrEqual(0.2);
    expect(frame.tint.hue).not.toBe(0);
  });
});
