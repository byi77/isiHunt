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
 * Ein Kopf, wahlweise mit Helm, Haar oder Kopfschmuck.
 *
 * `schmuck` traegt die Unterscheidung: Bei kleiner Figur ist der Umriss des
 * Kopfes fast das Einzige, was uebrig bleibt - eine Krone oder zwei Zoepfe
 * lesen sich noch, ein Gesicht nicht mehr.
 */
function kopf(
  g: G,
  y: number,
  radius: number,
  schmuck: 'keiner' | 'helm' | 'haar' | 'krone' | 'zoepfe' | 'spitzhut' | 'maske',
): void {
  if (schmuck === 'haar' || schmuck === 'zoepfe') {
    // Haar zuerst, damit der Kopf darauf liegt.
    g.fillStyle(0xffffff, 0.75);
    g.fillEllipse(C, y + 4, radius * 2.6, radius * 2.4);
  }

  g.fillStyle(0xffffff, 1);
  g.fillCircle(C, y, radius);

  if (schmuck === 'helm') {
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, y - 1, radius * 0.62);
  }

  if (schmuck === 'maske') {
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(C - radius, y - 3, radius * 2, 6);
  }

  if (schmuck === 'krone') {
    voll(g, [
      [C - radius, y - radius + 2],
      [C - radius * 0.55, y - radius - 9],
      [C, y - radius + 1],
      [C + radius * 0.55, y - radius - 9],
      [C + radius, y - radius + 2],
    ]);
  }

  if (schmuck === 'spitzhut') {
    voll(g, [
      [C - radius - 2, y - radius + 3],
      [C, y - radius - 20],
      [C + radius + 2, y - radius + 3],
    ]);
  }

  if (schmuck === 'zoepfe') {
    const zopf: [number, number][] = [
      [C - radius - 2, y + 2],
      [C - radius - 9, y + 16],
      [C - radius - 3, y + 18],
      [C - radius + 2, y + 6],
    ];
    voll(g, zopf);
    voll(g, gespiegelt(zopf));
  }
}

/** Ein Rumpf: `rock` laeuft nach unten breit aus, sonst bleibt er schmal. */
function rumpf(g: G, oben: number, unten: number, breiteOben: number, rock: boolean): void {
  const breiteUnten = rock ? breiteOben * 2.6 : breiteOben * 0.8;
  voll(g, [
    [C - breiteOben, oben],
    [C + breiteOben, oben],
    [C + breiteUnten, unten],
    [C - breiteUnten, unten],
  ]);
}

/**
 * Arme in einer von vier Haltungen.
 *
 * Die Haltung ist bei kleiner Darstellung der wichtigste Unterschied zwischen
 * zwei Figuren - deutlicher als jedes Detail am Rumpf.
 */
function arme(
  g: G,
  schulter: number,
  haltung: 'vorn' | 'einer' | 'seitlich' | 'oben' | 'huefte',
): void {
  if (haltung === 'vorn') {
    const arm: [number, number][] = [
      [C - 10, schulter + 4],
      [C - 3, schulter + 1],
      [C - 20, schulter - 30],
      [C - 28, schulter - 25],
    ];
    voll(g, arm);
    voll(g, gespiegelt(arm));
    return;
  }

  if (haltung === 'einer') {
    // Ein Arm nach vorn, einer angelegt - die klassische Flugpose.
    voll(g, [
      [C - 10, schulter + 4],
      [C - 3, schulter + 1],
      [C - 18, schulter - 32],
      [C - 27, schulter - 27],
    ]);
    voll(
      g,
      gespiegelt([
        [C - 11, schulter + 2],
        [C - 20, schulter + 12],
        [C - 17, schulter + 20],
        [C - 9, schulter + 12],
      ]),
    );
    return;
  }

  if (haltung === 'oben') {
    const arm: [number, number][] = [
      [C - 10, schulter + 4],
      [C - 3, schulter + 2],
      [C - 8, schulter - 34],
      [C - 16, schulter - 32],
    ];
    voll(g, arm);
    voll(g, gespiegelt(arm));
    return;
  }

  if (haltung === 'huefte') {
    const arm: [number, number][] = [
      [C - 10, schulter + 2],
      [C - 24, schulter + 10],
      [C - 22, schulter + 18],
      [C - 9, schulter + 14],
    ];
    voll(g, arm);
    voll(g, gespiegelt(arm));
    return;
  }

  const arm: [number, number][] = [
    [C - 11, schulter + 2],
    [C - 22, schulter + 12],
    [C - 19, schulter + 20],
    [C - 9, schulter + 12],
  ];
  voll(g, arm);
  voll(g, gespiegelt(arm));
}

/** Zwei Beine, leicht gespreizt nach hinten. */
function beine(g: G, oben: number, unten: number): void {
  const bein: [number, number][] = [
    [C - 8, oben],
    [C - 2, oben],
    [C - 4, unten],
    [C - 11, unten - 2],
  ];
  voll(g, bein);
  voll(g, gespiegelt(bein));
}

/** Ein Umhang, der hinter der Figur weht. */
function umhang(g: G, oben: number, unten: number, breite: number): void {
  akzent(
    g,
    [
      [C - breite, oben],
      [C + breite, oben],
      [C + breite * 0.62, unten],
      [C, unten - 14],
      [C - breite * 0.62, unten],
    ],
    0.7,
  );
}

/**
 * Ein Fluegelpaar.
 *
 * `art` bestimmt die Kante: gefiedert laeuft in Stufen aus, Insektenfluegel
 * bleiben glatt und durchscheinend, Fledermaushaut ist gezackt.
 */
function fluegelpaar(g: G, y: number, spannweite: number, art: 'feder' | 'insekt' | 'haut'): void {
  if (art === 'insekt') {
    const oben: [number, number][] = [
      [C - 6, y - 2],
      [C - spannweite, y - 20],
      [C - spannweite + 6, y + 4],
      [C - 5, y + 8],
    ];
    const unten: [number, number][] = [
      [C - 6, y + 10],
      [C - spannweite + 10, y + 16],
      [C - spannweite + 14, y + 28],
      [C - 5, y + 20],
    ];
    akzent(g, oben, 0.75);
    akzent(g, gespiegelt(oben), 0.75);
    akzent(g, unten, 0.75);
    akzent(g, gespiegelt(unten), 0.75);
    return;
  }

  if (art === 'haut') {
    const haut: [number, number][] = [
      [C - 7, y - 4],
      [C - spannweite, y - 12],
      [C - spannweite + 9, y + 8],
      [C - spannweite + 2, y + 12],
      [C - spannweite + 16, y + 24],
      [C - 6, y + 22],
    ];
    voll(g, haut);
    voll(g, gespiegelt(haut));
    return;
  }

  const feder: [number, number][] = [
    [C - 7, y - 6],
    [C - spannweite, y - 18],
    [C - spannweite + 8, y + 2],
    [C - spannweite + 3, y + 6],
    [C - spannweite + 15, y + 18],
    [C - 6, y + 16],
  ];
  voll(g, feder);
  voll(g, gespiegelt(feder));
}

/** Ein Stab mit Kopf - Zauberstab, Zepter, Dreizack. */
function stab(g: G, kopfArt: 'stern' | 'kugel' | 'zacken'): void {
  g.fillStyle(0xffffff, 1);
  g.fillRect(C + 22, 26, 5, 52);

  if (kopfArt === 'stern') {
    stern(g, C + 24, 18, 13, 5, 5);
    return;
  }
  if (kopfArt === 'kugel') {
    g.fillCircle(C + 24, 18, 10);
    return;
  }
  voll(g, [
    [C + 14, 22],
    [C + 17, 4],
    [C + 21, 20],
    [C + 24, 2],
    [C + 27, 20],
    [C + 31, 4],
    [C + 34, 22],
  ]);
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

  // ---- Helden und Heldinnen ---------------------------------------------
  // Was die Figuren unterscheidet, ist die Haltung und der Umriss - Umhang,
  // Rock, Fluegel, Kopfschmuck. Ein Gesicht waere bei dieser Groesse ohnehin
  // nicht zu erkennen.

  /** 30 Heldin - ein Arm vorgestreckt, Umhang im Wind. */
  (g) => {
    umhang(g, 32, 88, 26);
    kopf(g, 20, 10, 'haar');
    rumpf(g, 32, 62, 10, false);
    arme(g, 36, 'einer');
    beine(g, 60, 88);
  },
  /** 31 Maskenheld - Maske ueber den Augen, beide Faeuste vorn. */
  (g) => {
    kopf(g, 20, 11, 'maske');
    rumpf(g, 32, 62, 11, false);
    arme(g, 36, 'vorn');
    beine(g, 60, 88);
  },
  /** 32 Umhangheldin - weiter Umhang, Arme an der Huefte. */
  (g) => {
    umhang(g, 30, 92, 30);
    kopf(g, 20, 10, 'zoepfe');
    rumpf(g, 32, 64, 10, false);
    arme(g, 36, 'huefte');
    beine(g, 62, 88);
  },
  /**
   * 33 Kraftheld - massiger Oberkoerper, Arme nach oben.
   *
   * Der Rumpf laeuft nach unten schmal zu (Dreieck-Silhouette): Mit einem
   * geraden Rumpf war er vom Maskenhelden kaum zu unterscheiden.
   */
  (g) => {
    kopf(g, 20, 12, 'keiner');
    voll(g, [
      [C - 24, 34],
      [C + 24, 34],
      [C + 11, 68],
      [C - 11, 68],
    ]);
    arme(g, 38, 'oben');
    beine(g, 66, 92);
  },
  /** 34 Sternenheldin - Umhang und ein Stern ueber der erhobenen Hand. */
  (g) => {
    umhang(g, 32, 88, 24);
    kopf(g, 22, 10, 'haar');
    rumpf(g, 34, 62, 10, false);
    arme(g, 38, 'einer');
    beine(g, 60, 88);
    stern(g, C - 26, 12, 11, 4, 5);
  },
  /** 35 Panzerheld - breite Schultern, Helm, Arme seitlich. */
  (g) => {
    kopf(g, 20, 13, 'helm');
    voll(g, [
      [C - 22, 32],
      [C + 22, 32],
      [C + 16, 66],
      [C - 16, 66],
    ]);
    arme(g, 38, 'seitlich');
    beine(g, 64, 90);
  },

  // ---- Maerchen und Magie -----------------------------------------------

  /** 36 Prinzessin - Krone und weiter Rock. */
  (g) => {
    kopf(g, 20, 10, 'krone');
    rumpf(g, 32, 84, 10, true);
    arme(g, 36, 'seitlich');
  },
  /** 37 Fee - Insektenfluegel, Zauberstab, kurzer Rock. */
  (g) => {
    fluegelpaar(g, 34, 34, 'insekt');
    kopf(g, 20, 9, 'haar');
    rumpf(g, 30, 62, 8, true);
    arme(g, 34, 'einer');
    beine(g, 60, 84);
  },
  /** 38 Zauberin - Spitzhut und langer Umhang. */
  (g) => {
    umhang(g, 34, 92, 28);
    kopf(g, 24, 10, 'spitzhut');
    rumpf(g, 36, 82, 10, true);
    stab(g, 'stern');
  },
  /** 39 Koenigin - Krone, weiter Rock, Zepter. */
  (g) => {
    kopf(g, 22, 11, 'krone');
    rumpf(g, 34, 86, 12, true);
    arme(g, 38, 'seitlich');
    stab(g, 'kugel');
  },
  /**
   * 40 Fluegelfee - Federfluegel, Arme nach oben.
   *
   * Spannweite bewusst kleiner als beim Drachen: Mit 38 verschluckten die
   * Fluegel den Koerper, und die Form las sich als Ahornblatt statt als Figur.
   */
  (g) => {
    // Fluegel klein und hoch angesetzt: Bei 30 Spannweite verschluckten sie
    // Rumpf und Rock, und die Form las sich als Blatt statt als Figur.
    fluegelpaar(g, 26, 22, 'feder');
    kopf(g, 22, 10, 'zoepfe');
    rumpf(g, 34, 84, 11, true);
    arme(g, 38, 'oben');
  },
  /** 41 Nachtfee - Fledermausfluegel und Spitzhut. */
  (g) => {
    // Fluegel hoch an den Schultern statt auf Rumpfhoehe: Weiter unten
    // verschmolzen sie mit dem Koerper zu einer Blattform, und die Nachtfee
    // war von der Fluegelfee nicht zu unterscheiden.
    fluegelpaar(g, 24, 34, 'haut');
    kopf(g, 20, 9, 'spitzhut');
    rumpf(g, 42, 70, 9, false);
    beine(g, 68, 92);
  },
  /** 42 Meerjungfrau - Flosse statt Beinen. */
  (g) => {
    kopf(g, 20, 10, 'haar');
    rumpf(g, 32, 58, 10, false);
    arme(g, 36, 'seitlich');
    voll(g, [
      [C - 8, 56],
      [C + 8, 56],
      [C + 5, 76],
      [C - 5, 76],
    ]);
    voll(g, [
      [C - 5, 74],
      [C + 5, 74],
      [C + 22, 92],
      [C, 82],
      [C - 22, 92],
    ]);
  },
  /** 43 Ritter - Helm mit Federbusch, Schwert erhoben. */
  (g) => {
    kopf(g, 22, 12, 'helm');
    voll(g, [
      [C - 4, 12],
      [C + 4, 12],
      [C + 2, 0],
      [C - 2, 0],
    ]);
    rumpf(g, 34, 66, 12, false);
    arme(g, 38, 'einer');
    beine(g, 64, 90);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C + 24, 10, 4, 44);
  },
  /**
   * 44 Drache - Hautfluegel, Rueckenzacken, langer Schwanz.
   *
   * Die Zacken sind der Unterschied zum Einhorn: Ohne sie waren beide nur
   * "Fluegel mit einem Klumpen dazwischen" und im Vergleichsbild nicht
   * auseinanderzuhalten.
   */
  (g) => {
    fluegelpaar(g, 42, 38, 'haut');
    // Schmaler Rumpf ueber die ganze Hoehe.
    voll(g, [
      [C - 7, 26],
      [C + 7, 26],
      [C + 4, 78],
      [C - 4, 78],
    ]);
    // Kopf mit Schnauze nach vorn.
    voll(g, [
      [C - 9, 28],
      [C + 9, 28],
      [C + 13, 12],
      [C - 2, 4],
      [C - 11, 16],
    ]);
    // Rueckenzacken.
    for (const y of [34, 46, 58]) {
      voll(g, [
        [C - 7, y],
        [C - 16, y + 3],
        [C - 7, y + 9],
      ]);
      voll(
        g,
        gespiegelt([
          [C - 7, y],
          [C - 16, y + 3],
          [C - 7, y + 9],
        ]),
      );
    }
    // Schwanz, nach hinten auslaufend.
    voll(g, [
      [C - 4, 76],
      [C + 4, 76],
      [C + 8, 94],
      [C - 8, 94],
    ]);
  },
  /**
   * 45 Einhorn - Federfluegel, Horn, breiter Pferdeleib.
   *
   * Bewusst breit und quer statt aufrecht: So unterscheidet sich der Umriss
   * vom Drachen, der schmal und lang ist.
   */
  (g) => {
    fluegelpaar(g, 46, 34, 'feder');
    // Breiter Leib.
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 56, 46, 30);
    // Hals nach vorn oben.
    voll(g, [
      [C - 8, 48],
      [C + 4, 44],
      [C + 10, 20],
      [C - 2, 18],
    ]);
    kopf(g, 16, 9, 'keiner');
    // Horn.
    voll(g, [
      [C + 1, 10],
      [C + 6, 10],
      [C + 10, -4],
    ]);
    // Vier Beine.
    for (const x of [C - 16, C - 5, C + 6, C + 17]) {
      g.fillRect(x - 3, 68, 6, 22);
    }
  },

  // ---- Weitere Raumfahrzeuge --------------------------------------------

  /** 46 Sichelmond - schmale Mondsichel, offene Seite nach hinten. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.arc(C, C, 40, Math.PI * 0.75, Math.PI * 2.25, false);
    g.arc(C + 16, C, 34, Math.PI * 2.25, Math.PI * 0.75, true);
    g.closePath();
    g.fillPath();
  },
  /**
   * 47 Manta - sehr flacher, weit ausladender Gleitkoerper.
   *
   * Flacher als die Pfeilspitze (58) und ohne deren tiefe Heckkerbe: Mit
   * gleicher Hoehe waren beide im Vergleichsbild kaum zu trennen.
   */
  (g) => {
    voll(g, [
      [C, 34],
      [94, 52],
      [C + 20, 62],
      [C, 66],
      [C - 20, 62],
      [2, 52],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 2, 64, 4, 30);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C, 46, 8);
  },
  /** 48 Speer - extrem schlank, lange Spitze. */
  (g) => {
    voll(g, [
      [C, 2],
      [C + 7, 52],
      [C + 4, 90],
      [C - 4, 90],
      [C - 7, 52],
    ]);
    akzent(g, [
      [C - 18, 62],
      [C + 18, 62],
      [C + 12, 74],
      [C - 12, 74],
    ]);
  },
  /** 49 Kaefer - runder Panzer mit Fuehlern. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 56, 60, 62);
    voll(g, [
      [C - 3, 26],
      [C - 16, 6],
      [C - 12, 4],
      [C, 22],
    ]);
    voll(
      g,
      gespiegelt([
        [C - 3, 26],
        [C - 16, 6],
        [C - 12, 4],
        [C, 22],
      ]),
    );
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(C - 2, 30, 4, 52);
  },
  /**
   * 50 Anker - Ring oben, breit ausladende Arme unten.
   *
   * Der Querbalken ist weg: Mit ihm las sich die Form als Flugzeug mit
   * Tragflaechen. Die Arme sind dafuer deutlich groesser und tragen die
   * Silhouette allein.
   */
  (g) => {
    g.lineStyle(8, 0xffffff, 1);
    g.strokeCircle(C, 16, 12);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 5, 26, 10, 46);
    const arm: [number, number][] = [
      [C - 5, 56],
      [C - 38, 66],
      [C - 34, 82],
      [C - 20, 74],
      [C - 5, 78],
    ];
    voll(g, arm);
    voll(g, gespiegelt(arm));
    const spitze: [number, number][] = [
      [C - 42, 58],
      [C - 30, 66],
      [C - 40, 72],
    ];
    voll(g, spitze);
    voll(g, gespiegelt(spitze));
  },
  /** 51 Zwilling - zwei Scheiben nebeneinander. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C - 22, 48, 38, 46);
    g.fillEllipse(C + 22, 48, 38, 46);
    g.fillRect(C - 10, 44, 20, 8);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C - 22, 48, 8);
    g.fillCircle(C + 22, 48, 8);
  },
  /** 52 Kamm - fuenf senkrechte Finger auf einer Basis. */
  (g) => {
    for (const x of [C - 28, C - 14, C, C + 14, C + 28]) {
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - 5, 12, 10, 46);
    }
    voll(g, [
      [C - 34, 56],
      [C + 34, 56],
      [C + 26, 84],
      [C - 26, 84],
    ]);
  },
  /** 53 Spirale - drei Arme aus der Mitte, gedreht. */
  (g) => {
    for (let i = 0; i < 3; i++) {
      const w = (Math.PI * 2 * i) / 3;
      const punkte: [number, number][] = [];
      for (let t = 0; t <= 6; t++) {
        const winkel = w + t * 0.34;
        const r = 8 + t * 6;
        punkte.push([C + Math.cos(winkel) * r, C + Math.sin(winkel) * r]);
      }
      for (let t = 6; t >= 0; t--) {
        const winkel = w + t * 0.34 + 0.3;
        const r = 8 + t * 6;
        punkte.push([C + Math.cos(winkel) * r, C + Math.sin(winkel) * r]);
      }
      voll(g, punkte);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 11);
  },
  /** 54 Wuerfel - Quadrat mit abgesetzten Ecken. */
  (g) => {
    voll(g, [
      [C - 20, 18],
      [C + 20, 18],
      [C + 34, 32],
      [C + 34, 64],
      [C + 20, 78],
      [C - 20, 78],
      [C - 34, 64],
      [C - 34, 32],
    ]);
    akzent(g, [
      [C - 12, 34],
      [C + 12, 34],
      [C + 12, 58],
      [C - 12, 58],
    ]);
  },
  /**
   * 55 Greifklaue - drei nach innen gebogene Finger an einem kurzen Schaft.
   *
   * Vorher standen die Finger fast senkrecht und die Form las sich als
   * Buendel. Jetzt biegen sie sich sichtbar zueinander - das macht sie als
   * Klaue lesbar.
   */
  (g) => {
    const finger: [number, number][] = [
      [C - 6, 62],
      [C - 34, 34],
      [C - 26, 12],
      [C - 16, 24],
      [C - 12, 50],
      [C - 4, 58],
    ];
    voll(g, finger);
    voll(g, gespiegelt(finger));
    voll(g, [
      [C - 7, 58],
      [C - 5, 10],
      [C + 5, 10],
      [C + 7, 58],
    ]);
    voll(g, [
      [C - 11, 58],
      [C + 11, 58],
      [C + 8, 92],
      [C - 8, 92],
    ]);
  },
  /** 56 Segel - dreieckiges Segel an einem Mast. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 3, 8, 6, 76);
    voll(g, [
      [C + 3, 12],
      [C + 40, 58],
      [C + 3, 70],
    ]);
    akzent(g, [
      [C - 3, 20],
      [C - 26, 56],
      [C - 3, 64],
    ]);
    voll(g, [
      [C - 20, 82],
      [C + 20, 82],
      [C + 12, 92],
      [C - 12, 92],
    ]);
  },
  /** 57 Torus - dicker Ring ohne Rumpf. */
  (g) => {
    g.lineStyle(18, 0xffffff, 1);
    g.strokeCircle(C, C, 32);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, C, 12);
  },
  /** 58 Pfeilspitze - flach und breit, tiefe Kerbe. */
  (g) => {
    voll(g, [
      [C, 10],
      [92, 76],
      [C + 20, 66],
      [C, 90],
      [C - 20, 66],
      [4, 76],
    ]);
  },
  /** 59 Turm - schmal und hoch, gestufte Absaetze. */
  (g) => {
    voll(g, [
      [C - 8, 6],
      [C + 8, 6],
      [C + 8, 30],
      [C + 16, 30],
      [C + 16, 56],
      [C + 26, 56],
      [C + 26, 88],
      [C - 26, 88],
      [C - 26, 56],
      [C - 16, 56],
      [C - 16, 30],
      [C - 8, 30],
    ]);
  },

  // ---- Weitere Flugzeuge ------------------------------------------------

  /** 60 Wasserflugzeug - Schwimmer unter den Tragflaechen. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 46, 18, 60);
    voll(g, [
      [8, 40],
      [88, 40],
      [88, 50],
      [8, 50],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C - 24, 76, 14, 30);
    g.fillEllipse(C + 24, 76, 14, 30);
    g.fillRect(C - 26, 54, 4, 14);
    g.fillRect(C + 22, 54, 4, 14);
  },
  /** 61 Hubschrauber - Rotor quer ueber der Kabine, Heckausleger. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C - 6, 50, 44, 34);
    voll(g, [
      [C + 12, 44],
      [C + 40, 48],
      [C + 40, 54],
      [C + 12, 56],
    ]);
    voll(g, [
      [C + 34, 34],
      [C + 42, 34],
      [C + 42, 62],
      [C + 34, 62],
    ]);
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(C - 40, 20, 80, 6);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 8, 24, 5, 12);
    g.fillRect(C - 22, 72, 34, 5);
  },
  /** 62 Deltaflieger - Haengegleiter mit Pilot darunter. */
  (g) => {
    voll(g, [
      [C, 14],
      [92, 58],
      [C, 46],
      [4, 58],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 2, 44, 4, 20);
    g.fillCircle(C, 70, 9);
    voll(g, [
      [C - 7, 78],
      [C + 7, 78],
      [C + 4, 92],
      [C - 4, 92],
    ]);
  },
  /** 63 Zeppelin - langer Ballon mit Gondel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 44, 46, 70);
    voll(g, [
      [C - 14, 74],
      [C + 14, 74],
      [C + 10, 88],
      [C - 10, 88],
    ]);
    voll(g, [
      [C - 6, 8],
      [C + 6, 8],
      [C + 16, 20],
      [C - 16, 20],
    ]);
  },
  /** 64 Heissluftballon - runder Ballon, Korb an Seilen. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 38, 62, 66);
    voll(g, [
      [C - 14, 62],
      [C + 14, 62],
      [C + 8, 72],
      [C - 8, 72],
    ]);
    g.lineStyle(2.5, 0xffffff, 0.85);
    g.lineBetween(C - 8, 70, C - 12, 84);
    g.lineBetween(C + 8, 70, C + 12, 84);
    voll(g, [
      [C - 14, 82],
      [C + 14, 82],
      [C + 11, 94],
      [C - 11, 94],
    ]);
  },
  /** 65 Papierflieger - gefaltete Kanten, sichtbarer Mittelknick. */
  (g) => {
    voll(g, [
      [C, 6],
      [C + 34, 84],
      [C, 66],
    ]);
    akzent(
      g,
      [
        [C, 6],
        [C - 34, 84],
        [C, 66],
      ],
      0.72,
    );
    g.lineStyle(2, 0xffffff, 0.9);
    g.lineBetween(C, 6, C, 66);
  },

  // ---- Weitere Tiere ----------------------------------------------------

  /** 66 Schmetterling - vier runde Fluegel, schmaler Leib. */
  (g) => {
    const obenFl: [number, number][] = [
      [C - 4, 42],
      [C - 40, 14],
      [C - 34, 44],
      [C - 5, 50],
    ];
    const untenFl: [number, number][] = [
      [C - 4, 52],
      [C - 32, 60],
      [C - 26, 86],
      [C - 5, 64],
    ];
    voll(g, obenFl);
    voll(g, gespiegelt(obenFl));
    voll(g, untenFl);
    voll(g, gespiegelt(untenFl));
    voll(g, [
      [C - 4, 30],
      [C + 4, 30],
      [C + 3, 78],
      [C - 3, 78],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 26, 7);
  },
  /** 67 Eule - gedrungener Koerper, breiter Kopf, kurze Fluegel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 58, 48, 56);
    g.fillEllipse(C, 26, 44, 36);
    voll(g, [
      [C - 18, 12],
      [C - 8, 4],
      [C - 6, 16],
    ]);
    voll(
      g,
      gespiegelt([
        [C - 18, 12],
        [C - 8, 4],
        [C - 6, 16],
      ]),
    );
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C - 9, 26, 7);
    g.fillCircle(C + 9, 26, 7);
    const fl: [number, number][] = [
      [C - 20, 44],
      [C - 34, 56],
      [C - 26, 76],
      [C - 18, 66],
    ];
    voll(g, fl);
    voll(g, gespiegelt(fl));
  },
  /** 68 Kolibri - langer Schnabel, schwirrende Fluegel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 54, 22, 44);
    voll(g, [
      [C - 3, 36],
      [C + 3, 36],
      [C + 2, 4],
      [C - 2, 4],
    ]);
    const fl: [number, number][] = [
      [C - 8, 44],
      [C - 40, 34],
      [C - 38, 46],
      [C - 8, 54],
    ];
    akzent(g, fl, 0.7);
    akzent(g, gespiegelt(fl), 0.7);
    voll(g, [
      [C - 5, 72],
      [C + 5, 72],
      [C + 8, 92],
      [C - 8, 92],
    ]);
  },
  /** 69 Storch - langer Hals, lange Beine, schmale Fluegel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 50, 26, 34);
    voll(g, [
      [C - 4, 42],
      [C + 4, 42],
      [C + 6, 16],
      [C - 2, 14],
    ]);
    g.fillCircle(C + 3, 12, 7);
    voll(g, [
      [C + 8, 10],
      [C + 26, 14],
      [C + 8, 16],
    ]);
    const fl: [number, number][] = [
      [C - 8, 42],
      [C - 42, 48],
      [C - 38, 58],
      [C - 8, 58],
    ];
    voll(g, fl);
    voll(g, gespiegelt(fl));
    g.fillRect(C - 8, 64, 4, 28);
    g.fillRect(C + 4, 64, 4, 28);
  },
  /** 70 Rochen - flacher Koerper, langer duenner Schwanz. */
  (g) => {
    voll(g, [
      [C, 20],
      [88, 54],
      [C + 14, 62],
      [C, 68],
      [C - 14, 62],
      [8, 54],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 2, 66, 4, 28);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C - 10, 34, 5);
    g.fillCircle(C + 10, 34, 5);
  },
  /** 71 Qualle - runde Glocke mit haengenden Tentakeln. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.arc(C, 44, 34, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    for (const x of [C - 24, C - 12, C, C + 12, C + 24]) {
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(x - 3, 44, 6, 20 + ((x + 96) % 24));
    }
  },
  /** 72 Wespe - gestreifter Hinterleib, schmale Taille. */
  (g) => {
    const fl: [number, number][] = [
      [C - 5, 34],
      [C - 34, 24],
      [C - 30, 38],
      [C - 5, 44],
    ];
    akzent(g, fl, 0.7);
    akzent(g, gespiegelt(fl), 0.7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 24, 11);
    g.fillRect(C - 4, 32, 8, 12);
    g.fillEllipse(C, 62, 28, 40);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(C - 14, 54, 28, 5);
    g.fillRect(C - 14, 66, 28, 5);
    g.fillStyle(0xffffff, 1);
    voll(g, [
      [C - 3, 80],
      [C + 3, 80],
      [C, 94],
    ]);
  },

  // ---- Weitere Drohnen und Geraete --------------------------------------

  /** 73 Oktokopter - acht Rotoren, dichtes Muster. */
  (g) => drohne(g, 8, 8),
  /** 74 Tricopter - drei Rotoren, Y-Form. */
  (g) => drohne(g, 3, 15),
  /** 75 Satellit - Kern mit zwei rechteckigen Solarflaechen. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 14, 34, 28, 34);
    akzent(
      g,
      [
        [C - 46, 38],
        [C - 16, 40],
        [C - 16, 62],
        [C - 46, 64],
      ],
      0.7,
    );
    akzent(
      g,
      gespiegelt([
        [C - 46, 38],
        [C - 16, 40],
        [C - 16, 62],
        [C - 46, 64],
      ]),
      0.7,
    );
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 2, 14, 4, 22);
    g.fillCircle(C, 12, 7);
  },
  /** 76 Teleskop - langes Rohr auf einem Dreibein. */
  (g) => {
    voll(g, [
      [C - 12, 8],
      [C + 12, 8],
      [C + 8, 56],
      [C - 8, 56],
    ]);
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(C, 12, 22, 8);
    g.lineStyle(5, 0xffffff, 1);
    g.lineBetween(C, 54, C - 26, 90);
    g.lineBetween(C, 54, C + 26, 90);
    g.lineBetween(C, 54, C, 92);
  },
  /** 77 Kompass - Ring mit Nadel. */
  (g) => {
    g.lineStyle(9, 0xffffff, 1);
    g.strokeCircle(C, C, 36);
    voll(g, [
      [C, 16],
      [C + 9, C],
      [C, 80],
      [C - 9, C],
    ]);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, C, 7);
  },
  /** 78 Schluessel - Bart unten, runder Griff oben. */
  (g) => {
    g.lineStyle(9, 0xffffff, 1);
    g.strokeCircle(C, 24, 16);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 4, 38, 8, 50);
    g.fillRect(C, 68, 18, 7);
    g.fillRect(C, 80, 14, 7);
  },
  /** 79 Zahnrad - acht Zaehne um eine Nabe. */
  (g) => {
    stern(g, C, C, 42, 30, 8);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C, C, 13);
  },

  // ---- Weitere Helden und Gestalten -------------------------------------

  /** 80 Blitzheld - Zackenumriss statt glatter Kanten. */
  (g) => {
    kopf(g, 18, 10, 'maske');
    voll(g, [
      [C - 20, 30],
      [C + 20, 30],
      [C + 10, 48],
      [C + 22, 48],
      [C + 8, 74],
      [C - 8, 74],
      [C - 22, 48],
      [C - 10, 48],
    ]);
    arme(g, 34, 'einer');
    beine(g, 72, 92);
  },
  /**
   * 81 Schildheldin - Schild seitlich neben der Figur, nicht davor.
   *
   * Vor dem Koerper verdeckte er Rumpf und Arme, und die Form las sich als
   * Kreis mit Kopf. Seitlich bleibt die Figur erkennbar und der Schild
   * trotzdem als solcher lesbar.
   */
  (g) => {
    // Schild links, mit Rand.
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C - 30, 52, 34, 46);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(C - 30, 52, 18, 26);

    kopf(g, 20, 10, 'zoepfe');
    rumpf(g, 32, 64, 11, false);
    // Nur der rechte Arm - der linke haelt den Schild.
    voll(
      g,
      gespiegelt([
        [C - 11, 36],
        [C - 22, 46],
        [C - 19, 54],
        [C - 9, 46],
      ]),
    );
    beine(g, 62, 90);
  },
  /** 82 Bogenschuetzin - gespannter Bogen quer vor dem Koerper. */
  (g) => {
    kopf(g, 20, 10, 'zoepfe');
    rumpf(g, 32, 62, 10, false);
    beine(g, 60, 90);
    g.lineStyle(6, 0xffffff, 1);
    g.beginPath();
    g.arc(C + 6, 48, 30, Math.PI * 1.35, Math.PI * 0.65, false);
    g.strokePath();
    g.lineStyle(2.5, 0xffffff, 0.9);
    g.lineBetween(C - 14, 26, C - 14, 70);
  },
  /** 83 Speerkaempfer - langer Speer diagonal. */
  (g) => {
    kopf(g, 22, 11, 'helm');
    rumpf(g, 34, 64, 11, false);
    arme(g, 38, 'seitlich');
    beine(g, 62, 90);
    g.fillStyle(0xffffff, 1);
    g.save?.();
    g.fillRect(C + 20, 6, 5, 84);
    voll(g, [
      [C + 18, 12],
      [C + 27, 12],
      [C + 22, 0],
    ]);
  },
  /** 84 Roboter - eckiger Kopf, Antenne, kastiger Rumpf. */
  (g) => {
    voll(g, [
      [C - 13, 10],
      [C + 13, 10],
      [C + 13, 32],
      [C - 13, 32],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 1, 0, 3, 12);
    g.fillCircle(C, 0, 5);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(C - 8, 17, 16, 6);
    voll(g, [
      [C - 18, 36],
      [C + 18, 36],
      [C + 18, 68],
      [C - 18, 68],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 28, 40, 8, 26);
    g.fillRect(C + 20, 40, 8, 26);
    g.fillRect(C - 14, 70, 9, 22);
    g.fillRect(C + 5, 70, 9, 22);
  },
  /** 85 Geist - wehender Umriss ohne Beine. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.arc(C, 38, 26, Math.PI, 0, false);
    g.lineTo(C + 26, 76);
    g.lineTo(C + 16, 66);
    g.lineTo(C + 6, 80);
    g.lineTo(C - 6, 66);
    g.lineTo(C - 16, 80);
    g.lineTo(C - 26, 68);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(C - 9, 34, 6);
    g.fillCircle(C + 9, 34, 6);
  },
  /** 86 Kraken - runder Kopf mit acht Armen. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 34, 52, 44);
    for (let i = 0; i < 8; i++) {
      const x = C - 28 + i * 8;
      const laenge = 26 + ((i * 7) % 22);
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(x - 2, 52, 5, laenge);
    }
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(C - 11, 32, 7);
    g.fillCircle(C + 11, 32, 7);
  },
  /** 87 Schneeflocke - sechs verzweigte Arme. */
  (g) => {
    for (let i = 0; i < 6; i++) {
      const w = (Math.PI * i) / 3;
      const ex = C + Math.cos(w) * 42;
      const ey = C + Math.sin(w) * 42;
      g.lineStyle(6, 0xffffff, 1);
      g.lineBetween(C, C, ex, ey);
      // Seitenzweige.
      const mx = C + Math.cos(w) * 26;
      const my = C + Math.sin(w) * 26;
      g.lineStyle(4, 0xffffff, 1);
      g.lineBetween(mx, my, mx + Math.cos(w + 0.9) * 13, my + Math.sin(w + 0.9) * 13);
      g.lineBetween(mx, my, mx + Math.cos(w - 0.9) * 13, my + Math.sin(w - 0.9) * 13);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 9);
  },
  /** 88 Flamme - zuengelnder Umriss, unten breit. */
  (g) => {
    voll(g, [
      [C, 4],
      [C + 14, 30],
      [C + 10, 44],
      [C + 24, 62],
      [C + 18, 88],
      [C - 18, 88],
      [C - 24, 62],
      [C - 10, 44],
      [C - 14, 30],
    ]);
    akzent(g, [
      [C, 34],
      [C + 10, 60],
      [C, 84],
      [C - 10, 60],
    ]);
  },
  /** 89 Tropfen - runde Basis, spitz nach oben. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 62, 30);
    voll(g, [
      [C, 8],
      [C + 26, 62],
      [C - 26, 62],
    ]);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(C - 8, 58, 9);
  },

  // ---- Weitere Fahrzeuge und Formen -------------------------------------

  /** 90 Rennwagen - flach, breite Heckfluegel. */
  (g) => {
    voll(g, [
      [C - 8, 8],
      [C + 8, 8],
      [C + 12, 70],
      [C - 12, 70],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 34, 74, 68, 9);
    g.fillRect(C - 30, 30, 12, 22);
    g.fillRect(C + 18, 30, 12, 22);
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(C, 32, 18, 16);
  },
  /** 91 U-Boot - Zigarrenform mit Turm. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 52, 40, 76);
    voll(g, [
      [C - 10, 20],
      [C + 10, 20],
      [C + 8, 38],
      [C - 8, 38],
    ]);
    g.fillRect(C - 1, 8, 3, 14);
    voll(g, [
      [C - 26, 78],
      [C + 26, 78],
      [C + 16, 92],
      [C - 16, 92],
    ]);
  },
  /** 92 Kristall - facettierter Kegel. */
  (g) => {
    voll(g, [
      [C, 6],
      [C + 24, 40],
      [C + 16, 88],
      [C - 16, 88],
      [C - 24, 40],
    ]);
    akzent(g, [
      [C, 6],
      [C + 24, 40],
      [C + 4, 88],
      [C, 40],
    ]);
    g.lineStyle(2, 0xffffff, 0.8);
    g.lineBetween(C, 6, C, 88);
  },
  /** 93 Pyramide - Dreieck mit sichtbarer Seitenflaeche. */
  (g) => {
    voll(g, [
      [C, 10],
      [C + 40, 84],
      [C - 40, 84],
    ]);
    akzent(g, [
      [C, 10],
      [C + 40, 84],
      [C + 6, 84],
    ]);
  },
  /** 94 Herz - zwei Boegen oben, Spitze unten. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C - 17, 34, 20);
    g.fillCircle(C + 17, 34, 20);
    voll(g, [
      [C - 35, 40],
      [C + 35, 40],
      [C, 88],
    ]);
  },
  /** 95 Blume - fuenf runde Blueten um eine Mitte. */
  (g) => {
    for (let i = 0; i < 5; i++) {
      const w = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(C + Math.cos(w) * 24, C + Math.sin(w) * 24, 19);
    }
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C, C, 14);
  },
  /** 96 Sanduhr - zwei Dreiecke Spitze an Spitze. */
  (g) => {
    voll(g, [
      [C - 30, 8],
      [C + 30, 8],
      [C + 4, 48],
      [C - 4, 48],
    ]);
    voll(g, [
      [C - 4, 48],
      [C + 4, 48],
      [C + 30, 88],
      [C - 30, 88],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillRect(C - 34, 4, 68, 7);
    g.fillRect(C - 34, 85, 68, 7);
  },
  /**
   * 97 Auge - Mandelform mit Lidern, damit es kein blosser Rhombus ist.
   *
   * Ohne die geschwungenen Lidkanten war die Form von einer Raute nicht zu
   * unterscheiden.
   */
  (g) => {
    // Oberes und unteres Lid als flache Boegen.
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(6, C);
    g.lineTo(20, 30);
    g.lineTo(C, 18);
    g.lineTo(76, 30);
    g.lineTo(90, C);
    g.lineTo(76, 66);
    g.lineTo(C, 78);
    g.lineTo(20, 66);
    g.closePath();
    g.fillPath();

    // Iris und Pupille.
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(C, C, 18);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 9);
    // Wimpern aussen - machen die Leserichtung eindeutig.
    g.lineStyle(3, 0xffffff, 1);
    g.lineBetween(14, 32, 4, 22);
    g.lineBetween(82, 32, 92, 22);
  },
  /** 98 Krake der Tiefe - Spiralarme um eine Kugel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 20);
    for (let i = 0; i < 5; i++) {
      const w = (Math.PI * 2 * i) / 5;
      const punkte: [number, number][] = [];
      for (let t = 0; t <= 5; t++) {
        const winkel = w + t * 0.4;
        const r = 18 + t * 5;
        punkte.push([C + Math.cos(winkel) * r, C + Math.sin(winkel) * r]);
      }
      for (let t = 5; t >= 0; t--) {
        const winkel = w + t * 0.4 + 0.22;
        const r = 18 + t * 5;
        punkte.push([C + Math.cos(winkel) * r, C + Math.sin(winkel) * r]);
      }
      voll(g, punkte);
    }
  },
  /** 99 Portal - Ring mit gezacktem Inneren. */
  (g) => {
    g.lineStyle(10, 0xffffff, 1);
    g.strokeCircle(C, C, 38);
    stern(g, C, C, 26, 11, 7);
  },
  /**
   * 100 CC0-Surveyor - Fallback-Silhouette fuer den externen Sprite-Provider.
   *
   * Der Provider ersetzt diese Zeichnung im Spiel durch die erste Frame des
   * CC0-Sprite-Sheets. Die lokale Silhouette bleibt absichtlich vorhanden:
   * Balance-Tests, Offline-Preview und ein fehlendes Asset behalten damit
   * trotzdem eine gueltige Form.
   */
  (g) => {
    voll(g, [
      [C, 8],
      [C + 26, 34],
      [C + 20, 72],
      [C + 8, 86],
      [C, 72],
      [C - 8, 86],
      [C - 20, 72],
      [C - 26, 34],
    ]);
    akzent(g, [
      [C, 18],
      [C + 10, 44],
      [C, 64],
      [C - 10, 44],
    ]);
    duesen(g, C - 12, 62, C + 12, 91);
  },
];
