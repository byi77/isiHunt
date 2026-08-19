/**
 * Die Zeichnungen aller Fluggestalten.
 *
 * ## Warum eine eigene Datei
 *
 * Bis 2026-08-20 standen sieben Varianten als `if`-Kette in `textures.ts`.
 * Bei dreissig und mehr Formen waere das unlesbar geworden - und `textures.ts`
 * hat eine andere Aufgabe: Sie verwaltet Keys und Grundtexturen, nicht das
 * Aussehen einzelner Figuren.
 *
 * ## Warum prozedural und nicht als Bilddatei
 *
 * Alle Grafiken des Spiels werden weiss gezeichnet und zur Laufzeit getintet
 * (CLAUDE.md, "Texturen sind weiss"). Ein prozedurales Schiff kostet keine
 * Ladezeit, skaliert verlustfrei und laesst sich in jeder Farbe tragen. Bei
 * hundert Formen waere eine Sprite-Sammlung ein spuerbarer Download.
 *
 * ## Was eine gute Form ausmacht
 *
 * Die Figur ist im Spiel klein, einfarbig und in Bewegung. Was zaehlt, ist
 * die **Silhouette** - Binnenzeichnung geht unter. Eine frueherer Satz von
 * sieben "Formen" teilte sich denselben Rumpf und unterschied sich nur durch
 * angesetzte Kleinteile; ein Spieler auf Stufe 51 bemerkte nie einen Wechsel.
 * Jede Form hier hat deshalb einen eigenen Umriss.
 *
 * ## Zu den Vorbildern
 *
 * Die Science-Fiction-Formen bilden **Typen** ab, keine bestehenden Entwuerfe:
 * ein Jaeger mit vier gespreizten Fluegeln, ein Abfangjaeger mit Kanzel
 * zwischen zwei Flaechen. Solche Silhouetten gehoeren zum Genre-Vokabular.
 * Konkrete geschuetzte Designs werden bewusst nicht nachgebaut - das Spiel
 * liegt oeffentlich.
 */

import type Phaser from 'phaser';

/** Kantenlaenge jeder Figurentextur. */
export const SHIP_TEXTURE_SIZE = 96;

type G = Phaser.GameObjects.Graphics;

const S = SHIP_TEXTURE_SIZE;
/** Mitte der Zeichenflaeche - fast jede Form ist dazu symmetrisch. */
const C = S / 2;

/**
 * Ein Punkt fuer `fillPoints`.
 *
 * Bewusst ein einfaches Objekt statt `new Phaser.Math.Vector2()`: Ein
 * Wert-Import von Phaser zieht dessen Canvas-Erkennung mit und laesst diese
 * Datei ausserhalb eines Browsers gar nicht erst laden - dieselbe Falle, an
 * der schon `ScoreSystem` haengengeblieben ist (CLAUDE.md, Regel 6). Die
 * Balance-Tests importieren `SHIP_DRAWINGS`, laufen aber in Node.
 * `fillPoints` liest ohnehin nur `.x` und `.y`.
 */
const v = (x: number, y: number): { x: number; y: number } => ({ x, y });

/** Vollflaechig, in der Grundhelligkeit. */
function voll(g: G, punkte: [number, number][]): void {
  g.fillStyle(0xffffff, 1);
  g.fillPoints(
    punkte.map(([x, y]) => v(x, y)),
    true,
  );
}

/** Abgesetzte Flaeche - Kanzel, Kabine, Kopf. */
function akzent(g: G, punkte: [number, number][], alpha = 0.55): void {
  g.fillStyle(0xffffff, alpha);
  g.fillPoints(
    punkte.map(([x, y]) => v(x, y)),
    true,
  );
}

/** Spiegelt eine Punktliste an der Mittelachse - halbiert den Schreibaufwand. */
function gespiegelt(punkte: [number, number][]): [number, number][] {
  return punkte.map(([x, y]) => [S - x, y]);
}

/** Zwei Lichtduesen am Heck. */
function duesen(g: G, linkeX: number, rechteX: number, oben: number, unten: number): void {
  g.fillStyle(0xffffff, 0.85);
  g.fillTriangle(linkeX - 4, oben, linkeX + 4, oben, linkeX, unten);
  g.fillTriangle(rechteX - 4, oben, rechteX + 4, oben, rechteX, unten);
}

/** Sternform mit `zacken` Spitzen. */
function stern(g: G, mx: number, my: number, aussen: number, innen: number, zacken: number): void {
  const punkte: { x: number; y: number }[] = [];
  for (let i = 0; i < zacken * 2; i++) {
    const winkel = (Math.PI * 2 * i) / (zacken * 2) - Math.PI / 2;
    const r = i % 2 === 0 ? aussen : innen;
    punkte.push(v(mx + Math.cos(winkel) * r, my + Math.sin(winkel) * r));
  }
  g.fillStyle(0xffffff, 1);
  g.fillPoints(punkte, true);
}

/**
 * Eine Figur in Flughaltung: Kopf, Rumpf, Arme, Beine.
 *
 * `armeVorn` unterscheidet die klassische Superheldenpose (ein Arm oder beide
 * nach vorn gestreckt) vom Astronauten mit angelegten Armen.
 */
function figur(g: G, armeVorn: boolean, helm: boolean): void {
  // Kopf
  g.fillStyle(0xffffff, 1);
  g.fillCircle(C, 20, helm ? 13 : 10);
  if (helm) {
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, 19, 8);
    g.fillStyle(0xffffff, 1);
  }

  // Rumpf
  voll(g, [
    [C - 11, 32],
    [C + 11, 32],
    [C + 8, 62],
    [C - 8, 62],
  ]);

  if (armeVorn) {
    // Beide Arme nach vorn UND nach aussen - eine schmale, senkrechte Pose
    // ginge in der Silhouette unter, weil sie sich vom Rumpf nicht abhebt.
    const arm: [number, number][] = [
      [C - 10, 36],
      [C - 3, 33],
      [C - 20, 4],
      [C - 28, 9],
    ];
    voll(g, arm);
    voll(g, gespiegelt(arm));
  } else {
    // Arme seitlich angelegt.
    voll(g, [
      [C - 11, 34],
      [C - 20, 44],
      [C - 17, 52],
      [C - 9, 44],
    ]);
    voll(
      g,
      gespiegelt([
        [C - 11, 34],
        [C - 20, 44],
        [C - 17, 52],
        [C - 9, 44],
      ]),
    );
  }

  // Beine, leicht gespreizt nach hinten
  voll(g, [
    [C - 8, 60],
    [C - 2, 60],
    [C - 4, 88],
    [C - 11, 86],
  ]);
  voll(
    g,
    gespiegelt([
      [C - 8, 60],
      [C - 2, 60],
      [C - 4, 88],
      [C - 11, 86],
    ]),
  );
}

/** Ein Vogel mit ausgebreiteten Schwingen. `spitz` steuert die Fluegelform. */
function vogel(g: G, spitz: boolean, schwanzGabel: boolean): void {
  // Koerper
  voll(g, [
    [C, 14],
    [C + 7, 34],
    [C + 5, 72],
    [C - 5, 72],
    [C - 7, 34],
  ]);

  const fluegel: [number, number][] = spitz
    ? [
        [C - 6, 36],
        [4, 26],
        [10, 48],
        [C - 5, 52],
      ]
    : [
        [C - 6, 34],
        [8, 40],
        [6, 52],
        [C - 5, 54],
      ];
  voll(g, fluegel);
  voll(g, gespiegelt(fluegel));

  if (schwanzGabel) {
    voll(g, [
      [C - 5, 68],
      [C + 5, 68],
      [C + 10, 92],
      [C, 78],
      [C - 10, 92],
    ]);
  } else {
    voll(g, [
      [C - 5, 68],
      [C + 5, 68],
      [C + 6, 90],
      [C - 6, 90],
    ]);
  }
}

/** Ein Rotorkreuz mit `arme` Auslegern - die Grundform jeder Drohne. */
function drohne(g: G, arme: number, rotorRadius: number): void {
  g.fillStyle(0xffffff, 1);
  g.fillCircle(C, C, 13);

  for (let i = 0; i < arme; i++) {
    const winkel = (Math.PI * 2 * i) / arme - Math.PI / 2 + Math.PI / arme;
    const ax = C + Math.cos(winkel) * 30;
    const ay = C + Math.sin(winkel) * 30;
    g.lineStyle(6, 0xffffff, 1);
    g.lineBetween(C, C, ax, ay);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(ax, ay, rotorRadius);
    g.lineStyle(2.5, 0xffffff, 0.9);
    g.strokeCircle(ax, ay, rotorRadius);
    g.fillStyle(0xffffff, 1);
  }
}

/**
 * Alle Zeichnungen, in derselben Reihenfolge wie `SHIP_SHAPES`.
 *
 * Der Index ist der Vertrag zwischen Konfiguration und Zeichnung. Neue Formen
 * werden **hinten** angehaengt, damit gekaufte Formen ihre Zuordnung behalten.
 */
export const SHIP_DRAWINGS: readonly ((g: G) => void)[] = [
  // ---- Raumjäger --------------------------------------------------------
  /** 0 Pfeil - der Klassiker: schlank, klare Spitze, gekerbtes Heck. */
  (g) => {
    voll(g, [
      [C, 8],
      [64, 38],
      [84, 78],
      [60, 70],
      [C, 88],
      [36, 70],
      [12, 78],
      [32, 38],
    ]);
    akzent(g, [
      [C, 18],
      [55, 48],
      [41, 48],
    ]);
    duesen(g, 35, 61, 76, 91);
  },
  /** 1 Delta - breites Dreieck, satte Flaeche. */
  (g) => {
    voll(g, [
      [C, 6],
      [88, 82],
      [C, 66],
      [8, 82],
    ]);
    akzent(g, [
      [C, 20],
      [66, 74],
      [30, 74],
    ]);
    duesen(g, 38, 58, 66, 84);
  },
  /** 2 Sichel - weit ausgestellte Spitzen, schmale Mitte. */
  (g) => {
    voll(g, [
      [C, 10],
      [56, 44],
      [92, 84],
      [58, 72],
      [C, 80],
      [38, 72],
      [4, 84],
      [40, 44],
    ]);
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(C, 40, 18, 34);
    duesen(g, 40, 56, 72, 90);
  },
  /** 3 Ring - offener Kreis um den Rumpf. */
  (g) => {
    voll(g, [
      [C, 14],
      [60, 46],
      [60, 76],
      [36, 76],
      [36, 46],
    ]);
    g.lineStyle(5, 0xffffff, 0.9);
    g.strokeCircle(C, 46, 30);
    akzent(g, [
      [C, 20],
      [54, 42],
      [42, 42],
    ]);
    duesen(g, 41, 55, 74, 92);
  },
  /** 4 Doppelrumpf - zwei Haelften, eine Bruecke. */
  (g) => {
    voll(g, [
      [30, 12],
      [44, 44],
      [44, 80],
      [16, 80],
      [16, 44],
    ]);
    voll(g, [
      [66, 12],
      [80, 44],
      [80, 80],
      [52, 80],
      [52, 44],
    ]);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(38, 48, 20, 12);
    duesen(g, 30, 66, 78, 92);
  },
  /** 5 Stern - sechs Zacken, radialsymmetrisch. */
  (g) => {
    stern(g, C, C, 42, 17, 6);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(C, C, 12);
  },
  /** 6 Krone - breite Basis mit drei Zinnen. */
  (g) => {
    voll(g, [
      [20, 34],
      [30, 12],
      [40, 34],
      [C, 6],
      [56, 34],
      [66, 12],
      [76, 34],
      [82, 80],
      [14, 80],
    ]);
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(28, 50, 40, 16);
    duesen(g, 32, 64, 78, 92);
  },
  /** 7 Vierfluegler - X-foermig gespreizte Tragflaechen um einen Spindelrumpf. */
  (g) => {
    const fluegel: [number, number][] = [
      [C - 5, 40],
      [6, 14],
      [12, 24],
      [C - 4, 50],
    ];
    voll(g, fluegel);
    voll(g, gespiegelt(fluegel));
    const unten: [number, number][] = [
      [C - 4, 54],
      [12, 76],
      [6, 86],
      [C - 5, 62],
    ];
    voll(g, unten);
    voll(g, gespiegelt(unten));
    voll(g, [
      [C, 10],
      [C + 6, 40],
      [C + 5, 84],
      [C - 5, 84],
      [C - 6, 40],
    ]);
    akzent(g, [
      [C, 22],
      [C + 4, 38],
      [C - 4, 38],
    ]);
  },
  /** 8 Kanzeljaeger - Kugelkanzel zwischen zwei senkrechten Flaechen. */
  (g) => {
    voll(g, [
      [6, 10],
      [26, 26],
      [26, 70],
      [6, 86],
    ]);
    voll(g, [
      [90, 10],
      [70, 26],
      [70, 70],
      [90, 86],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 17);
    g.fillRect(26, 44, 44, 8);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, C, 10);
  },
  /** 9 Keilkreuzer - langer Keil, breites Heck. */
  (g) => {
    voll(g, [
      [C, 6],
      [78, 82],
      [18, 82],
    ]);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(34, 60, 28, 14);
    duesen(g, 32, 64, 80, 92);
  },
  /** 10 Scheibenfrachter - runde Scheibe mit vorstehender Kanzel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 54, 76, 54);
    voll(g, [
      [C - 10, 30],
      [C + 10, 30],
      [C + 6, 8],
      [C - 6, 8],
    ]);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(C, 54, 34, 24);
  },
  /** 11 Sonde - Kugel mit drei Auslegern, ohne Vorne und Hinten. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 20);
    for (let i = 0; i < 3; i++) {
      const w = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      g.lineStyle(7, 0xffffff, 0.9);
      g.lineBetween(C, C, C + Math.cos(w) * 40, C + Math.sin(w) * 40);
    }
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C, C, 11);
  },
  /** 12 Trichter - weit geoeffneter Einlass, schmales Heck. */
  (g) => {
    voll(g, [
      [10, 12],
      [86, 12],
      [62, 60],
      [62, 88],
      [34, 88],
      [34, 60],
    ]);
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(30, 20, 36, 12);
  },

  // ---- Flugzeuge --------------------------------------------------------
  /** 13 Duesenjet - Pfeilfluegel, Leitwerk, spitze Nase. */
  (g) => {
    voll(g, [
      [C, 6],
      [C + 5, 34],
      [C + 5, 76],
      [C - 5, 76],
      [C - 5, 34],
    ]);
    const fl: [number, number][] = [
      [C - 5, 40],
      [8, 62],
      [8, 70],
      [C - 5, 58],
    ];
    voll(g, fl);
    voll(g, gespiegelt(fl));
    const leit: [number, number][] = [
      [C - 4, 72],
      [22, 86],
      [22, 90],
      [C - 4, 84],
    ];
    voll(g, leit);
    voll(g, gespiegelt(leit));
    akzent(g, [
      [C, 16],
      [C + 4, 32],
      [C - 4, 32],
    ]);
  },
  /** 14 Propellermaschine - gerade Tragflaeche, runder Rumpf, Luftschraube. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 52, 20, 68);
    voll(g, [
      [4, 44],
      [92, 44],
      [92, 56],
      [4, 56],
    ]);
    voll(g, [
      [30, 80],
      [66, 80],
      [66, 88],
      [30, 88],
    ]);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(C - 26, 10, 52, 5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 12, 6);
  },
  /** 15 Doppeldecker - zwei uebereinanderliegende Tragflaechen mit Streben. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 54, 18, 64);
    voll(g, [
      [8, 34],
      [88, 34],
      [88, 44],
      [8, 44],
    ]);
    voll(g, [
      [12, 60],
      [84, 60],
      [84, 70],
      [12, 70],
    ]);
    g.lineStyle(3, 0xffffff, 0.8);
    g.lineBetween(24, 44, 24, 60);
    g.lineBetween(72, 44, 72, 60);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 16, 6);
  },
  /** 16 Nurfluegler - reine Flaeche ohne abgesetzten Rumpf. */
  (g) => {
    voll(g, [
      [C, 14],
      [92, 74],
      [66, 68],
      [C, 86],
      [30, 68],
      [4, 74],
    ]);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(C, 40, 20, 22);
  },
  /** 17 Rakete - schlanker Zylinder mit drei Finnen. */
  (g) => {
    voll(g, [
      [C, 4],
      [C + 11, 30],
      [C + 11, 74],
      [C - 11, 74],
      [C - 11, 30],
    ]);
    const finne: [number, number][] = [
      [C - 11, 58],
      [22, 88],
      [C - 11, 78],
    ];
    voll(g, finne);
    voll(g, gespiegelt(finne));
    voll(g, [
      [C - 5, 74],
      [C + 5, 74],
      [C + 4, 90],
      [C - 4, 90],
    ]);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, 34, 8);
  },
  /** 18 Gleitschirm - breite Kappe mit Leinen und Last. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.arc(C, 46, 40, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(2.5, 0xffffff, 0.85);
    g.lineBetween(14, 46, C - 5, 76);
    g.lineBetween(C, 46, C, 76);
    g.lineBetween(82, 46, C + 5, 76);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 82, 9);
  },

  // ---- Fliegende Figuren ------------------------------------------------
  /** 19 Held - beide Arme nach vorn gestreckt. */
  (g) => figur(g, true, false),
  /** 20 Astronaut - Helm, Arme angelegt. */
  (g) => figur(g, false, true),
  /** 21 Umhangflieger - Figur mit weit wehendem Umhang. */
  (g) => {
    voll(g, [
      [C - 26, 30],
      [C + 26, 30],
      [C + 16, 92],
      [C, 76],
      [C - 16, 92],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 20, 10);
    akzent(
      g,
      [
        [C - 9, 32],
        [C + 9, 32],
        [C + 6, 64],
        [C - 6, 64],
      ],
      0.75,
    );
  },
  /** 22 Fluegelwesen - Figur mit zwei grossen Schwingen. */
  (g) => {
    const schwinge: [number, number][] = [
      [C - 8, 34],
      [4, 18],
      [10, 46],
      [C - 7, 58],
    ];
    voll(g, schwinge);
    voll(g, gespiegelt(schwinge));
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 22, 9);
    voll(g, [
      [C - 8, 32],
      [C + 8, 32],
      [C + 6, 88],
      [C - 6, 88],
    ]);
  },
  /**
   * 23 Duesenrucksack - kompakte Figur zwischen zwei grossen Schubtanks.
   *
   * Bewusst nicht "Astronaut plus Kaesten": Die Tanks bestimmen hier die
   * Silhouette, nicht die Figur. Sonst waere die Form von Nummer 20 kaum zu
   * unterscheiden.
   */
  (g) => {
    // Zwei breite Tanks links und rechts, nach unten in Duesen auslaufend.
    const tank: [number, number][] = [
      [C - 30, 26],
      [C - 14, 30],
      [C - 14, 66],
      [C - 30, 72],
    ];
    voll(g, tank);
    voll(g, gespiegelt(tank));
    duesen(g, C - 22, C + 22, 70, 92);

    // Kompakte Figur dazwischen.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 24, 11);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, 23, 7);
    voll(g, [
      [C - 9, 36],
      [C + 9, 36],
      [C + 7, 70],
      [C - 7, 70],
    ]);
  },

  // ---- Fliegende Tiere --------------------------------------------------
  /** 24 Adler - breite Schwingen, gefaechelter Schwanz. */
  (g) => vogel(g, false, false),
  /** 25 Schwalbe - spitze Schwingen, gegabelter Schwanz. */
  (g) => vogel(g, true, true),
  /** 26 Fledermaus - gezackte Haeute zwischen den Fingern. */
  (g) => {
    const haut: [number, number][] = [
      [C - 6, 32],
      [8, 24],
      [16, 44],
      [6, 48],
      [18, 60],
      [C - 5, 60],
    ];
    voll(g, haut);
    voll(g, gespiegelt(haut));
    voll(g, [
      [C, 18],
      [C + 7, 34],
      [C + 5, 74],
      [C - 5, 74],
      [C - 7, 34],
    ]);
    voll(g, [
      [C - 8, 20],
      [C - 4, 8],
      [C - 1, 20],
    ]);
    voll(
      g,
      gespiegelt([
        [C - 8, 20],
        [C - 4, 8],
        [C - 1, 20],
      ]),
    );
  },
  /** 27 Libelle - vier schmale Fluegel, langer Hinterleib. */
  (g) => {
    const fl1: [number, number][] = [
      [C - 4, 34],
      [4, 24],
      [6, 32],
      [C - 4, 42],
    ];
    const fl2: [number, number][] = [
      [C - 4, 46],
      [6, 54],
      [4, 62],
      [C - 4, 54],
    ];
    akzent(g, fl1, 0.75);
    akzent(g, gespiegelt(fl1), 0.75);
    akzent(g, fl2, 0.75);
    akzent(g, gespiegelt(fl2), 0.75);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 24, 9);
    voll(g, [
      [C - 4, 32],
      [C + 4, 32],
      [C + 3, 90],
      [C - 3, 90],
    ]);
  },

  // ---- Drohnen ----------------------------------------------------------
  /** 28 Quadrokopter - vier Rotoren im Kreuz. */
  (g) => drohne(g, 4, 13),
  /** 29 Hexakopter - sechs Rotoren, dichteres Muster. */
  (g) => drohne(g, 6, 10),
];
