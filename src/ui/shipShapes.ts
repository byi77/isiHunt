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

/** Kantenlaenge jeder Figurentextur - das Koordinatensystem aller Zeichnungen. */
export const SHIP_TEXTURE_SIZE = 96;

/**
 * Die Textur selbst entsteht in dieser Vielfachen: Auf Handys mit
 * Pixelverhaeltnis 3 wird ein Schiff sonst hochgezogen und weich.
 * Anzeigestellen rechnen ueber `shipDisplayScale()` zurueck.
 */
export const SHIP_TEXTURE_RESOLUTION = 3;

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

  // Binnenzeichnung: Visier oder Haar, Guertel, Brustzeichen, Stiefel, Handschuhe.
  if (helm) {
    visier(g, C, 20, 13);
  } else {
    haarkappe(g, C, 20, 10);
    augen(g, C, 21, 10);
  }
  flaeche(
    g,
    [
      [C - 8.8, 54],
      [C + 8.8, 54],
      [C + 8.5, 58],
      [C - 8.5, 58],
    ],
    RUMPF_TIEF,
  );
  brustzeichen(g, C, 43);
  paar(
    g,
    [
      [C - 10.5, 80],
      [C - 3.4, 80],
      [C - 4, 88],
      [C - 11, 86],
    ],
    RUMPF_TIEF,
  );
  if (armeVorn) {
    paar(
      g,
      [
        [C - 16.6, 9.8],
        [C - 20, 4],
        [C - 28, 9],
        [C - 24.4, 14.4],
      ],
      RUMPF_TIEF,
    );
  }
}

/** Glasvisier eines Helms. */
function visier(g: G, mx: number, my: number, r: number): void {
  g.fillStyle(GLAS, 1);
  g.fillEllipse(mx, my + r * 0.05, r * 1.45, r * 1.05);
  g.lineStyle(1, 0xffffff, 0.85);
  g.strokeEllipse(mx, my + r * 0.05, r * 1.45, r * 1.05);
  g.fillStyle(GLAS_REFLEX, 0.75);
  g.fillEllipse(mx - r * 0.28, my - r * 0.2, r * 0.55, r * 0.28);
}

/** Obere Kopfhaelfte als Haar - der Kopf bekommt eine Oberseite. */
function haarkappe(g: G, mx: number, my: number, r: number): void {
  g.fillStyle(RUMPF_TIEF, 1);
  g.beginPath();
  g.arc(mx, my, r, Math.PI * 1.02, Math.PI * 1.98, false);
  g.closePath();
  g.fillPath();
}

/** Zwei Augenpunkte - auch klein das staerkste Signal fuer "Figur". */
function augen(g: G, mx: number, my: number, r: number): void {
  g.fillStyle(NAHT, 1);
  g.fillCircle(mx - r * 0.36, my, Math.max(0.9, r * 0.13));
  g.fillCircle(mx + r * 0.36, my, Math.max(0.9, r * 0.13));
}

/** Kleine Raute auf der Brust. */
function brustzeichen(g: G, mx: number, my: number): void {
  flaeche(
    g,
    [
      [mx, my - 4],
      [mx + 3.5, my],
      [mx, my + 4],
      [mx - 3.5, my],
    ],
    RUMPF_MITTEL,
  );
  g.lineStyle(0.8, NAHT, 0.6);
  g.strokePoints([v(mx, my - 4), v(mx + 3.5, my), v(mx, my + 4), v(mx - 3.5, my)], true);
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

  // Federn: drei Linien je Schwinge, zur Spitze hin auslaufend.
  const [wurzel, spitze, , hinten] = fluegel as [P, P, P, P];
  for (const t of [0.3, 0.55, 0.8]) {
    const von: P = [
      wurzel[0] + (hinten[0] - wurzel[0]) * t,
      wurzel[1] + (hinten[1] - wurzel[1]) * t,
    ];
    const bis: P = [
      spitze[0] + (hinten[0] - spitze[0]) * t * 0.6,
      spitze[1] + (hinten[1] - spitze[1]) * t * 0.6,
    ];
    nahtPaar(g, [von, bis], 0.55);
  }
  // Bauch heller abgesetzt, Schnabelspitze dunkel, zwei Augen.
  flaeche(
    g,
    [
      [C, 40],
      [C + 3.5, 50],
      [C + 3, 66],
      [C - 3, 66],
      [C - 3.5, 50],
    ],
    RUMPF_MITTEL,
  );
  flaeche(
    g,
    [
      [C, 14],
      [C + 2.5, 20],
      [C - 2.5, 20],
    ],
    RUMPF_TIEF,
  );
  augen(g, C, 25, 7);
  naht(g, [
    [C, 70],
    [C, 86],
  ]);
}

/** Ein Rotorkreuz mit `arme` Auslegern - die Grundform jeder Drohne. */
function drohne(g: G, arme: number, rotorRadius: number): void {
  for (let i = 0; i < arme; i++) {
    const winkel = (Math.PI * 2 * i) / arme - Math.PI / 2 + Math.PI / arme;
    const ax = C + Math.cos(winkel) * 30;
    const ay = C + Math.sin(winkel) * 30;
    g.lineStyle(6, 0xffffff, 1);
    g.lineBetween(C, C, ax, ay);
    g.lineStyle(1, NAHT, 0.6);
    g.lineBetween(C, C, ax, ay);
    // Rotor: durchscheinende Scheibe, zwei Blaetter, Motornabe.
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(ax, ay, rotorRadius);
    g.lineStyle(2.2, 0xffffff, 0.95);
    g.strokeCircle(ax, ay, rotorRadius);
    g.lineStyle(1.6, RUMPF_MITTEL, 0.9);
    const blatt = winkel + Math.PI / 5;
    g.lineBetween(
      ax - Math.cos(blatt) * rotorRadius * 0.85,
      ay - Math.sin(blatt) * rotorRadius * 0.85,
      ax + Math.cos(blatt) * rotorRadius * 0.85,
      ay + Math.sin(blatt) * rotorRadius * 0.85,
    );
    g.fillStyle(GEHAEUSE, 1);
    g.fillCircle(ax, ay, 3);
  }

  g.fillStyle(0xffffff, 1);
  g.fillCircle(C, C, 13);
  g.lineStyle(2.4, RUMPF_MITTEL, 1);
  g.strokeCircle(C, C, 10.5);
  // Kamerakuppel in der Mitte.
  kuppel(g, C, C, 6);
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
    // Haar zuerst, damit der Kopf darauf liegt. Deckend im tiefen Ton statt
    // halbdurchsichtig - so bleibt es beim Einfaerben als Haar lesbar.
    g.fillStyle(RUMPF_TIEF, 1);
    g.fillEllipse(C, y + 4, radius * 2.6, radius * 2.4);
  }

  g.fillStyle(0xffffff, 1);
  g.fillCircle(C, y, radius);

  if (schmuck === 'helm') {
    visier(g, C, y - 1, radius);
  } else if (schmuck === 'maske') {
    g.fillStyle(NAHT, 1);
    g.fillRect(C - radius, y - 3, radius * 2, 6);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(C - radius * 0.4, y, radius * 0.45, 2.4);
    g.fillEllipse(C + radius * 0.4, y, radius * 0.45, 2.4);
  } else {
    if (schmuck === 'haar' || schmuck === 'zoepfe') haarkappe(g, C, y, radius);
    augen(g, C, y + 1, radius);
  }

  if (schmuck === 'krone') {
    voll(g, [
      [C - radius, y - radius + 2],
      [C - radius * 0.55, y - radius - 9],
      [C, y - radius + 1],
      [C + radius * 0.55, y - radius - 9],
      [C + radius, y - radius + 2],
    ]);
    flaeche(
      g,
      [
        [C - radius, y - radius + 2],
        [C + radius, y - radius + 2],
        [C + radius * 0.95, y - radius - 0.5],
        [C - radius * 0.95, y - radius - 0.5],
      ],
      RUMPF_MITTEL,
    );
    fenster(
      g,
      [
        [C - radius * 0.55, y - radius - 4],
        [C + radius * 0.55, y - radius - 4],
      ],
      1.2,
    );
  }

  if (schmuck === 'spitzhut') {
    voll(g, [
      [C - radius - 2, y - radius + 3],
      [C, y - radius - 20],
      [C + radius + 2, y - radius + 3],
    ]);
    flaeche(
      g,
      [
        [C - radius - 2, y - radius + 3],
        [C + radius + 2, y - radius + 3],
        [C + radius * 0.8, y - radius - 1],
        [C - radius * 0.8, y - radius - 1],
      ],
      RUMPF_TIEF,
    );
  }

  if (schmuck === 'zoepfe') {
    const zopf: [number, number][] = [
      [C - radius - 2, y + 2],
      [C - radius - 9, y + 16],
      [C - radius - 3, y + 18],
      [C - radius + 2, y + 6],
    ];
    paar(g, zopf, RUMPF_TIEF);
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
  // Guertel dort, wo der Rumpf in Beine oder Rock uebergeht.
  const t = rock ? 0.28 : 0.78;
  const gy = oben + (unten - oben) * t;
  const halb = breiteOben + (breiteUnten - breiteOben) * t;
  flaeche(
    g,
    [
      [C - halb, gy - 2],
      [C + halb, gy - 2],
      [C + halb + (breiteUnten - breiteOben) * 0.05, gy + 2],
      [C - halb - (breiteUnten - breiteOben) * 0.05, gy + 2],
    ],
    RUMPF_TIEF,
  );
  brustzeichen(g, C, oben + (gy - oben) * 0.45);
  if (rock) {
    // Zwei Falten im Rock.
    nahtPaar(g, [
      [C - halb * 0.4, gy + 3],
      [C - breiteUnten * 0.45, unten - 1],
    ]);
  }
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
  // Stiefel: das untere Viertel im tiefen Ton.
  const t = 0.72;
  paar(
    g,
    [
      [C - 8 + (-11 + 8) * t, oben + (unten - 2 - oben) * t],
      [C - 2 + (-4 + 2) * t, oben + (unten - oben) * t],
      [C - 4, unten],
      [C - 11, unten - 2],
    ],
    RUMPF_TIEF,
  );
}

/** Ein Umhang, der hinter der Figur weht. */
function umhang(g: G, oben: number, unten: number, breite: number): void {
  // Deckend im tiefen Ton statt halbdurchsichtig: Der Umhang liegt hinter der
  // Figur und hebt sie dadurch ab, statt mit ihr zu verschwimmen.
  flaeche(
    g,
    [
      [C - breite, oben],
      [C + breite, oben],
      [C + breite * 0.62, unten],
      [C, unten - 14],
      [C - breite * 0.62, unten],
    ],
    RUMPF_TIEF,
  );
  nahtPaar(
    g,
    [
      [C - breite * 0.55, oben + 4],
      [C - breite * 0.45, unten - 6],
    ],
    0.6,
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
    // Adern: aus der Flaeche wird ein Insektenfluegel.
    nahtPaar(
      g,
      [
        [C - 6, y + 2],
        [C - spannweite + 4, y - 14],
      ],
      0.5,
    );
    nahtPaar(
      g,
      [
        [C - 6, y + 2],
        [C - spannweite + 5, y - 2],
      ],
      0.4,
    );
    nahtPaar(
      g,
      [
        [C - 6, y + 14],
        [C - spannweite + 12, y + 22],
      ],
      0.5,
    );
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
    // Fingerknochen der Flughaut, von der Wurzel zu jeder Zacke.
    for (const zacke of [haut[1], haut[3], haut[4]] as P[]) {
      nahtPaar(g, [[C - 7, y + 2], zacke], 0.6, 1);
    }
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
  // Schwungfedern: die Stufen der Kante laufen als Linien zur Wurzel.
  for (const stufe of [feder[2], feder[4]] as P[]) {
    nahtPaar(g, [[C - 7, y + 4], stufe], 0.55);
  }
  paar(
    g,
    [
      [C - 7, y - 6],
      [C - spannweite * 0.55, y - 12],
      [C - spannweite * 0.5, y - 6],
      [C - 7, y - 1],
    ],
    RUMPF_MITTEL,
  );
}

/** Ein Stab mit Kopf - Zauberstab, Zepter, Dreizack. */
function stab(g: G, kopfArt: 'stern' | 'kugel' | 'zacken'): void {
  g.fillStyle(0xffffff, 1);
  g.fillRect(C + 22, 26, 5, 52);
  g.fillStyle(RUMPF_TIEF, 1);
  g.fillRect(C + 22, 44, 5, 8);

  if (kopfArt === 'stern') {
    stern(g, C + 24, 18, 13, 5, 5);
    g.fillStyle(RUMPF_MITTEL, 1);
    g.fillCircle(C + 24, 18, 4);
    return;
  }
  if (kopfArt === 'kugel') {
    kuppel(g, C + 24, 18, 10);
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

// ---- Werkzeuge fuer Binnenzeichnung ----------------------------------------
//
// Seit 2026-09-24 tragen die Raumschiffe Paneele, Naehte, Glas und Triebwerke.
// Vorher waren es weisse Umrisse mit ein, zwei grauen Flecken - im Spiel las
// sich das wie ein Piktogramm, nicht wie ein Fahrzeug. Alle Toene sind Grau:
// Beim Einfaerben werden sie zu hellen und dunklen Stufen der Rumpffarbe, eine
// zweifarbige Lackierung entsteht dadurch von selbst.

/** Zweiter Rumpfton - abgesetzte Paneele, Fluegelflaechen. */
const RUMPF_MITTEL = 0xd4dae3;
/** Vertiefte Flaechen - Fluegelwurzeln, Schaechte, Klappen. */
const RUMPF_TIEF = 0x9aa5b4;
/** Naehte und Einlaesse. */
const NAHT = 0x4c5968;
/** Glas: dunkler Grund, heller Reflex. */
const GLAS = 0x1b2a3a;
const GLAS_REFLEX = 0xcfeeff;
/** Triebwerksgehaeuse. */
const GEHAEUSE = 0x3d4856;

type P = [number, number];

/** Flaeche in einem der Rumpftoene. */
function flaeche(g: G, punkte: P[], farbe: number, alpha = 1): void {
  g.fillStyle(farbe, alpha);
  g.fillPoints(
    punkte.map(([x, y]) => v(x, y)),
    true,
  );
}

/** Flaeche und ihr Spiegelbild. */
function paar(g: G, punkte: P[], farbe: number, alpha = 1): void {
  flaeche(g, punkte, farbe, alpha);
  flaeche(g, gespiegelt(punkte), farbe, alpha);
}

/** Feine Paneelnaht als Linienzug. */
function naht(g: G, punkte: P[], alpha = 0.7, breite = 0.8): void {
  g.lineStyle(breite, NAHT, alpha);
  g.beginPath();
  punkte.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.strokePath();
}

/** Naht und ihr Spiegelbild. */
function nahtPaar(g: G, punkte: P[], alpha = 0.7, breite = 0.8): void {
  naht(g, punkte, alpha, breite);
  naht(g, gespiegelt(punkte), alpha, breite);
}

/**
 * Tropfenfoermige Kanzel: dunkles Glas, Rahmen, Reflex oben links.
 * `mx/oben` ist die Spitze, `breite/hoehe` die Ausdehnung nach unten.
 */
function kanzel(g: G, mx: number, oben: number, breite: number, hoehe: number): void {
  const h = breite / 2;
  const glas: P[] = [
    [mx, oben],
    [mx + h * 0.75, oben + hoehe * 0.35],
    [mx + h, oben + hoehe * 0.7],
    [mx + h * 0.55, oben + hoehe],
    [mx - h * 0.55, oben + hoehe],
    [mx - h, oben + hoehe * 0.7],
    [mx - h * 0.75, oben + hoehe * 0.35],
  ];
  flaeche(g, glas, GLAS);
  g.lineStyle(1, 0xffffff, 0.9);
  g.strokePoints(
    glas.map(([x, y]) => v(x, y)),
    true,
  );
  // Rahmenstrebe quer durch die Kanzel.
  g.lineStyle(0.9, 0xffffff, 0.55);
  g.lineBetween(mx - h * 0.9, oben + hoehe * 0.62, mx + h * 0.9, oben + hoehe * 0.62);
  // Reflex: schmaler heller Streifen auf der Lichtseite.
  flaeche(
    g,
    [
      [mx - h * 0.15, oben + hoehe * 0.12],
      [mx - h * 0.55, oben + hoehe * 0.4],
      [mx - h * 0.7, oben + hoehe * 0.58],
      [mx - h * 0.4, oben + hoehe * 0.34],
    ],
    GLAS_REFLEX,
    0.75,
  );
}

/** Runde Glaskuppel mit Reflex. */
function kuppel(g: G, mx: number, my: number, r: number): void {
  g.fillStyle(GLAS, 1);
  g.fillCircle(mx, my, r);
  g.lineStyle(1, 0xffffff, 0.85);
  g.strokeCircle(mx, my, r);
  g.fillStyle(GLAS_REFLEX, 0.7);
  g.fillEllipse(mx - r * 0.35, my - r * 0.38, r * 0.7, r * 0.42);
}

/**
 * Triebwerk von oben: Gehaeuse, Duesenring, heller Kern am Heck.
 * `mx/oben` Mitte oben, `breite/hoehe` Gehaeuse.
 */
function triebwerk(g: G, mx: number, oben: number, breite: number, hoehe: number): void {
  g.fillStyle(GEHAEUSE, 1);
  g.fillRoundedRect(mx - breite / 2, oben, breite, hoehe, Math.min(breite, hoehe) * 0.3);
  g.fillStyle(RUMPF_MITTEL, 1);
  g.fillRect(mx - breite / 2 + 0.8, oben + hoehe * 0.22, breite - 1.6, 1.1);
  // Duese: dunkler Ring, heller Kern - der Schweif im Spiel setzt hier an.
  g.fillStyle(NAHT, 1);
  g.fillEllipse(mx, oben + hoehe, breite * 0.95, breite * 0.5);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(mx, oben + hoehe, breite * 0.55, breite * 0.28);
}

/** Kleine Fensterreihe (Frachter, Kreuzer). */
function fenster(g: G, punkte: P[], r = 1.3): void {
  g.fillStyle(GLAS, 1);
  for (const [x, y] of punkte) g.fillCircle(x, y, r);
  g.fillStyle(GLAS_REFLEX, 0.8);
  for (const [x, y] of punkte) g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4);
}

/**
 * Lack- und Wartungsmarkierungen fuer die kaufbaren Fluggeraete.
 *
 * Die Grundzeichnungen liefern bereits die Silhouette. Dieser zweite Durchlauf
 * gibt den Schiffen eine gemeinsame, technische Identitaet: Wartungslinien,
 * Fluegelstreifen und kleine Kennfelder, die auch nach dem Tinting sichtbar
 * bleiben. Figuren, Tiere und Drohnen behalten ihre eigene Bildsprache.
 */
export function drawShipLivery(g: G, index: number): void {
  if (index > 18) return;

  if (index === 5 || index === 11) {
    // Radialmarken der Sternen- und Sondenformen folgen deren Symmetrie.
    g.lineStyle(1.2, RUMPF_MITTEL, 0.85);
    const count = index === 5 ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const inner = index === 5 ? 19 : 15;
      const outer = index === 5 ? 31 : 27;
      g.lineBetween(
        C + Math.cos(angle) * inner,
        C + Math.sin(angle) * inner,
        C + Math.cos(angle) * outer,
        C + Math.sin(angle) * outer,
      );
    }
    g.lineStyle(0.8, NAHT, 0.9);
    g.strokeCircle(C, C, index === 5 ? 20 : 27);
    return;
  }

  if (index === 10) {
    // Frachter: kurze radiale Fugen machen die grosse Scheibe zur Huelle.
    g.lineStyle(0.9, NAHT, 0.72);
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      g.lineBetween(
        C + Math.cos(angle) * 24,
        54 + Math.sin(angle) * 15,
        C + Math.cos(angle) * 34,
        54 + Math.sin(angle) * 22,
      );
    }
    g.lineStyle(1.2, RUMPF_MITTEL, 0.85);
    g.strokeEllipse(C, 54, 50, 32);
    return;
  }

  if (index === 15) {
    // Doppeldecker: Markierungen gehoeren auf beide Tragflaechen, nicht in
    // den freien Spalt zwischen ihnen.
    for (const y of [36, 62]) {
      paar(
        g,
        [
          [C - 7, y],
          [C - 21, y],
          [C - 21, y + 4],
          [C - 8, y + 4],
        ],
        RUMPF_MITTEL,
        0.9,
      );
    }
    g.lineStyle(1, NAHT, 0.9);
    g.lineBetween(C - 5, 48, C - 5, 58);
    g.lineBetween(C + 5, 48, C + 5, 58);
    return;
  }

  if (index === 17) {
    // Raketenrumpf: zwei breite Wartungsbaender und ein schmaler Leitwerksstrich.
    g.fillStyle(RUMPF_MITTEL, 0.95);
    g.fillRect(C - 10, 47, 20, 2);
    g.fillRect(C - 10, 61, 20, 2);
    g.lineStyle(1, NAHT, 0.9);
    g.lineBetween(C - 7, 27, C - 7, 46);
    g.lineBetween(C + 7, 27, C + 7, 46);
    return;
  }

  if (index === 18) {
    // Gleitschirm: abgesetzte Segelbahnen folgen der Rundung der Kappe.
    paar(
      g,
      [
        [C - 4, 12],
        [C - 12, 15],
        [C - 24, 24],
        [C - 17, 28],
        [C - 6, 21],
      ],
      RUMPF_MITTEL,
      0.72,
    );
    g.lineStyle(1.1, NAHT, 0.82);
    g.lineBetween(C - 2, 13, C - 2, 42);
    g.lineBetween(C + 2, 13, C + 2, 42);
    return;
  }

  // Zwei gebrochene Fluegelstreifen statt eines durchgehenden Rennstreifens:
  // Die Kanzel und die Grundsilhouette bleiben dadurch der Blickfang.
  const span = index >= 13 ? 15 : 21;
  const yRoot = index === 14 || index === 15 ? 49 : 48;
  const yTip = index === 14 || index === 15 ? 53 : 62;
  const markings: P[] = [
    [C - 7, yRoot],
    [C - span, yTip - 4],
    [C - span + 2, yTip - 1],
    [C - 8, yRoot + 4],
  ];
  paar(g, markings, RUMPF_MITTEL, 0.82);
  nahtPaar(
    g,
    [
      [C - 10, yRoot + 7],
      [C - span + 3, yTip + 1],
    ],
    0.9,
    1,
  );

  // Wartungsluke und zwei kurze Kuehlschlitze hinter der Kanzel.
  const plate: P[] = [
    [C - 4, 50],
    [C + 4, 50],
    [C + 5, 61],
    [C - 5, 61],
  ];
  flaeche(g, plate, RUMPF_MITTEL, 0.88);
  g.lineStyle(0.8, NAHT, 0.92);
  g.lineBetween(C - 2.5, 53, C + 2.5, 53);
  g.lineBetween(C - 2.5, 56, C + 2.5, 56);
  g.lineBetween(C - 2.5, 59, C + 2.5, 59);

  if (index % 3 === 0 || index === 17) {
    // Kleine Kontrollpunkte an den Fluegelwurzeln, statt weiterer Flaechen.
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(C - span + 5, yTip - 2, 1.15);
    g.fillCircle(C + span - 5, yTip - 2, 1.15);
  } else {
    // Doppelte Kuehlschlitze geben den dunklen Fluechen Tiefe.
    nahtPaar(
      g,
      [
        [C - span + 4, yTip - 3],
        [C - span + 8, yTip - 1],
      ],
      0.92,
      1.2,
    );
    nahtPaar(
      g,
      [
        [C - span + 3, yTip],
        [C - span + 7, yTip + 2],
      ],
      0.72,
      0.9,
    );
  }
}

/**
 * Alle Zeichnungen, ueber den stabilen `skinIndex` aus `SHIP_SHAPES` adressiert.
 *
 * Der Index ist der Vertrag zwischen Konfiguration und Zeichnung. Die
 * Anzeigereihenfolge im Shop darf sich aendern; neue Zeichnungen werden
 * **hinten** angehaengt, damit gekaufte Formen ihre Zuordnung behalten.
 */
export const SHIP_DRAWINGS: readonly ((g: G) => void)[] = [
  // ---- Raumjäger --------------------------------------------------------
  /** 0 Pfeil - breiter Abfangjaeger mit gepanzertem Mittelrumpf und Zwillingsduesen. */
  (g) => {
    voll(g, [
      [C, 7],
      [58, 25],
      [68, 30],
      [87, 45],
      [90, 60],
      [69, 59],
      [62, 55],
      [58, 78],
      [54, 89],
      [42, 89],
      [38, 78],
      [34, 55],
      [27, 59],
      [6, 60],
      [9, 45],
      [28, 30],
      [38, 25],
    ]);
    // Dicke Tragfluegel mit abgesetzten Panzerplatten statt einer einzigen
    // Papierflieger-Flaeche.
    paar(
      g,
      [
        [38, 32],
        [29, 37],
        [13, 48],
        [13, 54],
        [33, 49],
      ],
      RUMPF_MITTEL,
    );
    paar(
      g,
      [
        [36, 48],
        [15, 54],
        [29, 54],
        [35, 59],
      ],
      RUMPF_TIEF,
    );
    nahtPaar(g, [
      [31, 39],
      [17, 48],
      [13, 55],
    ]);
    nahtPaar(g, [
      [32, 52],
      [20, 55],
    ]);
    nahtPaar(g, [
      [35, 35],
      [35, 60],
      [C, 76],
    ]);
    paar(
      g,
      [
        [39, 32],
        [43, 29],
        [43, 58],
        [39, 62],
      ],
      NAHT,
    );
    kanzel(g, C, 14, 14, 24);
    triebwerk(g, 29, 57, 8, 12);
    triebwerk(g, 67, 57, 8, 12);
    triebwerk(g, 40, 72, 7, 13);
    triebwerk(g, 56, 72, 7, 13);
  },
  /** 1 Delta - schwerer Mehrzweckjaeger mit abgeschnittenen Fluegelspitzen. */
  (g) => {
    voll(g, [
      [C, 6],
      [57, 26],
      [86, 36],
      [91, 50],
      [73, 57],
      [64, 55],
      [58, 82],
      [52, 88],
      [44, 88],
      [38, 82],
      [32, 55],
      [23, 57],
      [5, 50],
      [10, 36],
      [39, 26],
    ]);
    paar(
      g,
      [
        [38, 31],
        [31, 35],
        [13, 41],
        [10, 48],
        [31, 48],
      ],
      RUMPF_MITTEL,
    );
    paar(
      g,
      [
        [35, 48],
        [13, 47],
        [28, 53],
        [35, 56],
      ],
      RUMPF_TIEF,
    );
    nahtPaar(g, [
      [30, 38],
      [18, 42],
      [12, 48],
    ]);
    nahtPaar(g, [
      [35, 31],
      [35, 59],
      [C, 75],
    ]);
    flaeche(
      g,
      [
        [C, 6],
        [51, 13],
        [45, 13],
      ],
      RUMPF_TIEF,
    );
    kanzel(g, C, 14, 13, 24);
    triebwerk(g, 28, 45, 7, 11);
    triebwerk(g, 68, 45, 7, 11);
    triebwerk(g, 41, 69, 8, 12);
    triebwerk(g, 55, 69, 8, 12);
  },
  /** 2 Sichel - asymmetrischer Abfangjaeger mit gebogenen Tragarmen. */
  (g) => {
    voll(g, [
      [C, 8],
      [57, 29],
      [92, 72],
      [87, 84],
      [68, 74],
      [55, 61],
      [C, 69],
      [41, 61],
      [28, 74],
      [9, 84],
      [4, 72],
      [39, 29],
    ]);
    paar(
      g,
      [
        [39, 36],
        [31, 40],
        [12, 69],
        [20, 70],
        [37, 54],
      ],
      RUMPF_MITTEL,
    );
    paar(
      g,
      [
        [36, 51],
        [15, 74],
        [27, 72],
        [39, 60],
      ],
      RUMPF_TIEF,
    );
    nahtPaar(g, [
      [35, 40],
      [20, 65],
      [12, 71],
    ]);
    nahtPaar(g, [
      [40, 43],
      [40, 63],
    ]);
    kanzel(g, C, 16, 13, 25);
    triebwerk(g, 28, 65, 8, 12);
    triebwerk(g, 68, 65, 8, 12);
    triebwerk(g, 42, 65, 6, 11);
    triebwerk(g, 54, 65, 6, 11);
  },
  /** 3 Ring - offener Kreis um den Rumpf. */
  (g) => {
    g.lineStyle(5, 0xffffff, 1);
    g.strokeCircle(C, 46, 30);
    // Nut im Ring und vier dunklere Segmente - aus der Flaeche wird ein Bauteil.
    g.lineStyle(0.9, NAHT, 0.6);
    g.strokeCircle(C, 46, 30);
    g.lineStyle(5, RUMPF_TIEF, 1);
    for (let i = 0; i < 4; i++) {
      const start = (Math.PI / 2) * i + Math.PI / 4 - 0.18;
      g.beginPath();
      g.arc(C, 46, 30, start, start + 0.36, false);
      g.strokePath();
    }
    paar(
      g,
      [
        [19, 44],
        [37, 44],
        [37, 49],
        [19, 49],
      ],
      RUMPF_MITTEL,
    );
    voll(g, [
      [C, 14],
      [60, 46],
      [60, 76],
      [36, 76],
      [36, 46],
    ]);
    flaeche(
      g,
      [
        [40, 50],
        [56, 50],
        [56, 72],
        [40, 72],
      ],
      RUMPF_MITTEL,
    );
    nahtPaar(g, [
      [40, 60],
      [56, 60],
    ]);
    kanzel(g, C, 20, 10, 22);
    triebwerk(g, 42, 70, 6, 10);
    triebwerk(g, 54, 70, 6, 10);
  },
  /** 4 Doppelrumpf - zwei Haelften, eine Bruecke. */
  (g) => {
    const rumpf: P[] = [
      [30, 12],
      [44, 44],
      [44, 80],
      [16, 80],
      [16, 44],
    ];
    voll(g, rumpf);
    voll(g, gespiegelt(rumpf));
    paar(
      g,
      [
        [16, 50],
        [21, 50],
        [21, 78],
        [16, 78],
      ],
      RUMPF_TIEF,
    );
    paar(
      g,
      [
        [30, 16],
        [41, 42],
        [19, 42],
      ],
      RUMPF_MITTEL,
    );
    nahtPaar(g, [
      [16, 44],
      [44, 44],
    ]);
    fenster(g, [
      [31, 52],
      [31, 58],
      [31, 64],
      [65, 52],
      [65, 58],
      [65, 64],
    ]);
    flaeche(
      g,
      [
        [40, 47],
        [56, 47],
        [56, 61],
        [40, 61],
      ],
      RUMPF_MITTEL,
    );
    kuppel(g, C, 54, 5);
    triebwerk(g, 24, 72, 7, 10);
    triebwerk(g, 37, 72, 7, 10);
    triebwerk(g, 59, 72, 7, 10);
    triebwerk(g, 72, 72, 7, 10);
  },
  /** 5 Stern - sechs Zacken, radialsymmetrisch. */
  (g) => {
    stern(g, C, C, 42, 17, 6);
    // Jede Zacke in zwei Facetten: die rechte Haelfte liegt im Schatten.
    for (let i = 0; i < 6; i++) {
      const spitze = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const innen = spitze + Math.PI / 6;
      flaeche(
        g,
        [
          [C, C],
          [C + Math.cos(spitze) * 42, C + Math.sin(spitze) * 42],
          [C + Math.cos(innen) * 17, C + Math.sin(innen) * 17],
        ],
        RUMPF_MITTEL,
      );
    }
    g.fillStyle(RUMPF_TIEF, 1);
    g.fillCircle(C, C, 14);
    g.lineStyle(0.9, NAHT, 0.7);
    g.strokeCircle(C, C, 14);
    kuppel(g, C, C, 9);
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
    for (const [x, y] of [
      [30, 12],
      [C, 6],
      [66, 12],
    ] as P[]) {
      flaeche(
        g,
        [
          [x, y],
          [x + 3, y + 8],
          [x - 3, y + 8],
        ],
        RUMPF_TIEF,
      );
    }
    flaeche(
      g,
      [
        [18, 64],
        [78, 64],
        [79, 70],
        [17, 70],
      ],
      RUMPF_MITTEL,
    );
    nahtPaar(g, [
      [30, 36],
      [30, 64],
    ]);
    naht(g, [
      [C, 36],
      [C, 64],
    ]);
    fenster(g, [
      [26, 50],
      [34, 50],
      [42, 50],
      [54, 50],
      [62, 50],
      [70, 50],
    ]);
    triebwerk(g, 30, 72, 8, 10);
    triebwerk(g, C, 72, 8, 10);
    triebwerk(g, 66, 72, 8, 10);
  },
  /** 7 Vierfluegler - X-foermig gespreizte Tragflaechen um einen Spindelrumpf. */
  (g) => {
    const fluegel: P[] = [
      [C - 5, 40],
      [6, 14],
      [12, 24],
      [C - 4, 50],
    ];
    voll(g, fluegel);
    voll(g, gespiegelt(fluegel));
    const unten: P[] = [
      [C - 4, 54],
      [12, 76],
      [6, 86],
      [C - 5, 62],
    ];
    voll(g, unten);
    voll(g, gespiegelt(unten));
    paar(
      g,
      [
        [C - 5, 44],
        [9, 19],
        [12, 24],
        [C - 4, 50],
      ],
      RUMPF_MITTEL,
    );
    paar(
      g,
      [
        [C - 4, 54],
        [12, 76],
        [9, 81],
        [C - 5, 58],
      ],
      RUMPF_MITTEL,
    );
    // Laeufe an den Fluegelspitzen.
    g.lineStyle(2, GEHAEUSE, 1);
    g.lineBetween(7, 15, 3, 8);
    g.lineBetween(89, 15, 93, 8);
    g.lineBetween(7, 85, 4, 91);
    g.lineBetween(89, 85, 92, 91);
    voll(g, [
      [C, 10],
      [C + 6, 40],
      [C + 5, 84],
      [C - 5, 84],
      [C - 6, 40],
    ]);
    nahtPaar(g, [
      [C - 3, 42],
      [C - 3, 72],
    ]);
    kanzel(g, C, 20, 8, 19);
    triebwerk(g, C, 76, 8, 9);
  },
  /** 8 Kanzeljaeger - Kugelkanzel zwischen zwei senkrechten Flaechen. */
  (g) => {
    const flaecheLinks: P[] = [
      [6, 10],
      [26, 26],
      [26, 70],
      [6, 86],
    ];
    voll(g, flaecheLinks);
    voll(g, gespiegelt(flaecheLinks));
    paar(
      g,
      [
        [9, 17],
        [23, 29],
        [23, 67],
        [9, 79],
      ],
      RUMPF_MITTEL,
    );
    // Rippen strahlen vom Tragarm aus - die Flaeche wirkt gespannt statt leer.
    for (const ende of [
      [9, 17],
      [9, 34],
      [9, 48],
      [9, 62],
      [9, 79],
    ] as P[]) {
      nahtPaar(g, [[23, 48], ende], 0.65);
    }
    g.fillStyle(RUMPF_TIEF, 1);
    g.fillRect(24, 44, 48, 8);
    naht(g, [
      [24, 48],
      [72, 48],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 17);
    g.lineStyle(0.9, NAHT, 0.7);
    g.strokeCircle(C, C, 14.5);
    kuppel(g, C, C, 10);
    g.lineStyle(0.8, 0xffffff, 0.5);
    for (let i = 0; i < 4; i++) {
      const w = (Math.PI / 2) * i + Math.PI / 4;
      g.lineBetween(C, C, C + Math.cos(w) * 10, C + Math.sin(w) * 10);
    }
  },
  /** 9 Keilkreuzer - schwerer Kreuzer mit breiten Schultermodulen und Panzerbug. */
  (g) => {
    voll(g, [
      [C, 6],
      [57, 25],
      [70, 31],
      [86, 43],
      [91, 58],
      [70, 62],
      [63, 57],
      [58, 79],
      [54, 89],
      [42, 89],
      [38, 79],
      [33, 57],
      [26, 62],
      [5, 58],
      [10, 43],
      [26, 31],
      [39, 25],
    ]);
    paar(
      g,
      [
        [39, 32],
        [27, 37],
        [12, 47],
        [11, 53],
        [34, 48],
      ],
      RUMPF_MITTEL,
    );
    paar(
      g,
      [
        [36, 49],
        [13, 53],
        [27, 56],
        [36, 60],
      ],
      RUMPF_TIEF,
    );
    nahtPaar(g, [
      [31, 39],
      [17, 48],
      [13, 54],
    ]);
    naht(g, [
      [C, 11],
      [C, 73],
    ]);
    nahtPaar(g, [
      [37, 49],
      [32, 64],
    ]);
    flaeche(
      g,
      [
        [42, 48],
        [54, 48],
        [54, 66],
        [42, 66],
      ],
      0xffffff,
    );
    g.lineStyle(0.9, NAHT, 0.7);
    g.strokeRect(42, 48, 12, 18);
    fenster(g, [
      [44, 53],
      [C, 53],
      [52, 53],
    ]);
    flaeche(
      g,
      [
        [C - 16, 72],
        [C + 16, 72],
        [C + 12, 82],
        [C - 12, 82],
      ],
      NAHT,
    );
    triebwerk(g, 27, 69, 8, 11);
    triebwerk(g, 42, 74, 7, 12);
    triebwerk(g, 54, 74, 7, 12);
    triebwerk(g, 69, 69, 8, 11);
  },
  /** 10 Scheibenfrachter - runde Scheibe mit vorstehender Kanzel. */
  (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 54, 76, 54);
    g.fillStyle(RUMPF_MITTEL, 1);
    g.fillEllipse(C, 54, 60, 42);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 54, 44, 30);
    g.lineStyle(0.9, NAHT, 0.65);
    g.strokeEllipse(C, 54, 60, 42);
    const fensterRing: P[] = [];
    for (let i = 0; i < 12; i++) {
      const w = (Math.PI * 2 * i) / 12;
      fensterRing.push([C + Math.cos(w) * 34, 54 + Math.sin(w) * 23.5]);
    }
    fenster(g, fensterRing, 1.2);
    g.fillStyle(GLAS, 1);
    g.fillEllipse(C, 54, 22, 15);
    g.fillStyle(GLAS_REFLEX, 0.7);
    g.fillEllipse(C - 4, 50, 9, 4);
    voll(g, [
      [C - 10, 30],
      [C + 10, 30],
      [C + 6, 8],
      [C - 6, 8],
    ]);
    kanzel(g, C, 10, 8, 15);
  },
  /** 11 Sonde - Kugel mit drei Auslegern, ohne Vorne und Hinten. */
  (g) => {
    for (let i = 0; i < 3; i++) {
      const w = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      const ex = C + Math.cos(w) * 38;
      const ey = C + Math.sin(w) * 38;
      g.lineStyle(7, 0xffffff, 1);
      g.lineBetween(C, C, ex, ey);
      g.lineStyle(1, NAHT, 0.6);
      g.lineBetween(C, C, ex, ey);
      // Antennenschale am Ende jedes Auslegers.
      g.fillStyle(RUMPF_MITTEL, 1);
      g.fillCircle(ex, ey, 6);
      g.lineStyle(0.9, NAHT, 0.7);
      g.strokeCircle(ex, ey, 6);
      g.fillStyle(GEHAEUSE, 1);
      g.fillCircle(ex, ey, 2);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, C, 20);
    g.lineStyle(3, RUMPF_MITTEL, 1);
    g.strokeCircle(C, C, 16);
    kuppel(g, C, C, 10);
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
    flaeche(
      g,
      [
        [17, 15],
        [79, 15],
        [73, 27],
        [23, 27],
      ],
      GLAS,
    );
    g.lineStyle(1, 0xffffff, 0.45);
    for (let x = 24; x <= 72; x += 6) g.lineBetween(x, 16, x, 26);
    paar(
      g,
      [
        [26, 32],
        [40, 32],
        [40, 58],
        [36, 58],
      ],
      RUMPF_MITTEL,
    );
    flaeche(
      g,
      [
        [37, 62],
        [59, 62],
        [59, 80],
        [37, 80],
      ],
      RUMPF_MITTEL,
    );
    naht(g, [
      [37, 71],
      [59, 71],
    ]);
    triebwerk(g, C, 78, 12, 9);
  },

  // ---- Flugzeuge --------------------------------------------------------
  /** 13 Duesenjet - Pfeilfluegel, Leitwerk, spitze Nase. */
  (g) => {
    const fl: P[] = [
      [C - 5, 40],
      [8, 62],
      [8, 70],
      [C - 5, 58],
    ];
    voll(g, fl);
    voll(g, gespiegelt(fl));
    paar(
      g,
      [
        [C - 5, 54],
        [9, 67],
        [8, 70],
        [C - 5, 58],
      ],
      RUMPF_TIEF,
    );
    const leit: P[] = [
      [C - 4, 72],
      [22, 86],
      [22, 90],
      [C - 4, 84],
    ];
    voll(g, leit);
    voll(g, gespiegelt(leit));
    voll(g, [
      [C, 6],
      [C + 5, 34],
      [C + 5, 76],
      [C - 5, 76],
      [C - 5, 34],
    ]);
    nahtPaar(g, [
      [C - 3, 36],
      [C - 3, 74],
    ]);
    kanzel(g, C, 14, 6, 18);
    triebwerk(g, C, 76, 7, 8);
  },
  /** 14 Propellermaschine - gerade Tragflaeche, runder Rumpf, Luftschraube. */
  (g) => {
    voll(g, [
      [4, 44],
      [92, 44],
      [92, 56],
      [4, 56],
    ]);
    paar(
      g,
      [
        [8, 52],
        [38, 52],
        [38, 56],
        [8, 56],
      ],
      RUMPF_TIEF,
    );
    nahtPaar(g, [
      [22, 44],
      [22, 56],
    ]);
    voll(g, [
      [30, 80],
      [66, 80],
      [66, 88],
      [30, 88],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 52, 20, 68);
    nahtPaar(g, [
      [C - 5, 40],
      [C - 5, 78],
    ]);
    kanzel(g, C, 28, 9, 14);
    // Die drehende Luftschraube als halbdurchsichtige Scheibe.
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(C, 13, 54, 7);
    g.lineStyle(0.8, NAHT, 0.5);
    g.strokeEllipse(C, 13, 54, 7);
    g.fillStyle(GEHAEUSE, 1);
    g.fillCircle(C, 13, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(C - 1.5, 11.5, 1.6);
  },
  /** 15 Doppeldecker - zwei uebereinanderliegende Tragflaechen mit Streben. */
  (g) => {
    for (const oben of [34, 60]) {
      const einzug = oben === 34 ? 8 : 12;
      voll(g, [
        [einzug, oben],
        [S - einzug, oben],
        [S - einzug, oben + 10],
        [einzug, oben + 10],
      ]);
      g.lineStyle(0.8, NAHT, 0.55);
      for (let x = einzug + 8; x < S - einzug; x += 8) g.lineBetween(x, oben + 1, x, oben + 9);
    }
    g.lineStyle(3, RUMPF_TIEF, 1);
    g.lineBetween(24, 44, 24, 60);
    g.lineBetween(72, 44, 72, 60);
    g.lineStyle(1, RUMPF_TIEF, 1);
    g.lineBetween(24, 44, 40, 60);
    g.lineBetween(72, 44, 56, 60);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(C, 54, 18, 64);
    kanzel(g, C, 44, 8, 11);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(C, 17, 44, 6);
    g.fillStyle(GEHAEUSE, 1);
    g.fillCircle(C, 17, 5);
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
    paar(
      g,
      [
        [C, 30],
        [80, 70],
        [64, 66],
        [C, 78],
      ],
      RUMPF_MITTEL,
    );
    paar(
      g,
      [
        [86, 72],
        [66, 67],
        [67, 69.5],
        [86, 73.5],
      ],
      RUMPF_TIEF,
    );
    nahtPaar(g, [
      [42, 40],
      [16, 70],
    ]);
    kanzel(g, C, 28, 11, 17);
    g.fillStyle(NAHT, 1);
    g.fillRoundedRect(38, 70, 7, 3, 1);
    g.fillRoundedRect(51, 70, 7, 3, 1);
  },
  /** 17 Rakete - schlanker Zylinder mit drei Finnen. */
  (g) => {
    const finne: P[] = [
      [C - 11, 58],
      [22, 88],
      [C - 11, 78],
    ];
    voll(g, finne);
    voll(g, gespiegelt(finne));
    paar(
      g,
      [
        [C - 11, 66],
        [26, 84],
        [C - 11, 76],
      ],
      RUMPF_MITTEL,
    );
    voll(g, [
      [C, 4],
      [C + 11, 30],
      [C + 11, 74],
      [C - 11, 74],
      [C - 11, 30],
    ]);
    flaeche(
      g,
      [
        [C, 4],
        [C + 7, 20],
        [C - 7, 20],
      ],
      RUMPF_TIEF,
    );
    // Rechte Zylinderseite im Schatten - macht aus dem Rechteck eine Roehre.
    flaeche(
      g,
      [
        [C + 5, 22],
        [C + 11, 30],
        [C + 11, 74],
        [C + 5, 74],
      ],
      RUMPF_MITTEL,
    );
    g.fillStyle(RUMPF_TIEF, 1);
    g.fillRect(C - 11, 50, 22, 4);
    g.fillRect(C - 11, 64, 22, 2);
    fenster(g, [[C, 36]], 5);
    g.lineStyle(1, 0xffffff, 0.85);
    g.strokeCircle(C, 36, 5);
    triebwerk(g, C, 74, 10, 10);
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
    // Kammern der Kappe: Naehte strahlen vom Mittelpunkt, jede zweite dunkler.
    for (let i = 1; i < 8; i++) {
      const w = Math.PI + (Math.PI * i) / 8;
      naht(g, [
        [C + Math.cos(w) * 12, 46 + Math.sin(w) * 12],
        [C + Math.cos(w) * 39, 46 + Math.sin(w) * 39],
      ]);
    }
    g.lineStyle(3, RUMPF_TIEF, 1);
    g.beginPath();
    g.arc(C, 46, 38.5, Math.PI, 0, false);
    g.strokePath();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 82, 9);
    visier(g, C, 82, 8);
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
    nahtPaar(g, [
      [C - 12, 34],
      [C - 14, 86],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 20, 10);
    haarkappe(g, C, 20, 10);
    augen(g, C, 21, 10);
    // Die Figur vor dem Umhang: im mittleren Ton, damit sie sich abhebt.
    flaeche(
      g,
      [
        [C - 9, 32],
        [C + 9, 32],
        [C + 6, 64],
        [C - 6, 64],
      ],
      RUMPF_MITTEL,
    );
    flaeche(
      g,
      [
        [C - 7.5, 52],
        [C + 7.5, 52],
        [C + 7.2, 55],
        [C - 7.2, 55],
      ],
      RUMPF_TIEF,
    );
    brustzeichen(g, C, 41);
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
    paar(
      g,
      [
        [C - 8, 34],
        [4, 18],
        [6, 28],
        [C - 8, 42],
      ],
      RUMPF_MITTEL,
    );
    for (const ende of [
      [7, 34],
      [9, 42],
      [14, 50],
    ] as P[]) {
      nahtPaar(g, [[C - 8, 44], ende], 0.55);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 22, 9);
    haarkappe(g, C, 22, 9);
    augen(g, C, 23, 9);
    voll(g, [
      [C - 8, 32],
      [C + 8, 32],
      [C + 6, 88],
      [C - 6, 88],
    ]);
    flaeche(
      g,
      [
        [C - 7.4, 56],
        [C + 7.4, 56],
        [C + 7.2, 59],
        [C - 7.2, 59],
      ],
      RUMPF_TIEF,
    );
    brustzeichen(g, C, 44);
    naht(g, [
      [C, 60],
      [C, 86],
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
    // Tankbaender und Schattenseite - zwei Zylinder statt zwei Flaechen.
    paar(
      g,
      [
        [C - 19, 29],
        [C - 14, 30],
        [C - 14, 66],
        [C - 19, 68],
      ],
      RUMPF_MITTEL,
    );
    for (const y of [38, 56]) {
      paar(
        g,
        [
          [C - 30, y],
          [C - 14, y],
          [C - 14, y + 3],
          [C - 30, y + 3],
        ],
        RUMPF_TIEF,
      );
    }
    triebwerk(g, C - 22, 66, 9, 8);
    triebwerk(g, C + 22, 66, 9, 8);

    // Kompakte Figur dazwischen.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 24, 11);
    visier(g, C, 23, 11);
    voll(g, [
      [C - 9, 36],
      [C + 9, 36],
      [C + 7, 70],
      [C - 7, 70],
    ]);
    flaeche(
      g,
      [
        [C - 8, 58],
        [C + 8, 58],
        [C + 7.8, 61],
        [C - 7.8, 61],
      ],
      RUMPF_TIEF,
    );
    brustzeichen(g, C, 46);
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
    paar(
      g,
      [
        [C - 7, 19],
        [C - 4, 12],
        [C - 2.5, 19],
      ],
      RUMPF_TIEF,
    );
    for (const zacke of [haut[1], haut[3], haut[4]] as P[]) {
      nahtPaar(g, [[C - 6, 36], zacke], 0.6, 1);
    }
    flaeche(
      g,
      [
        [C, 36],
        [C + 3.5, 46],
        [C + 3, 68],
        [C - 3, 68],
        [C - 3.5, 46],
      ],
      RUMPF_MITTEL,
    );
    augen(g, C, 26, 8);
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
    nahtPaar(g, [
      [C - 4, 38],
      [6, 28],
    ]);
    nahtPaar(g, [
      [C - 4, 50],
      [6, 58],
    ]);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(C, 24, 9);
    // Facettenaugen: zwei grosse Glaskugeln.
    kuppel(g, C - 4.5, 22, 4);
    kuppel(g, C + 4.5, 22, 4);
    voll(g, [
      [C - 4, 32],
      [C + 4, 32],
      [C + 3, 90],
      [C - 3, 90],
    ]);
    for (let y = 44; y <= 84; y += 8) {
      naht(g, [
        [C - 3.6, y],
        [C + 3.6, y],
      ]);
    }
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
    // Brustpanzer: zwei Platten, Mittelnaht, Guertel.
    nahtPaar(g, [
      [C - 18, 38],
      [C - 3, 50],
      [C, 50],
    ]);
    naht(g, [
      [C, 50],
      [C, 62],
    ]);
    flaeche(
      g,
      [
        [C - 12, 62],
        [C + 12, 62],
        [C + 11, 67],
        [C - 11, 67],
      ],
      RUMPF_TIEF,
    );
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
    // Schulterstuecke und Plattenreihen des Panzers.
    paar(
      g,
      [
        [C - 22, 32],
        [C - 12, 32],
        [C - 13, 40],
        [C - 21, 38],
      ],
      RUMPF_MITTEL,
    );
    for (const y of [46, 54]) {
      naht(g, [
        [C - 19 + (y - 32) * 0.18, y],
        [C + 19 - (y - 32) * 0.18, y],
      ]);
    }
    brustzeichen(g, C, 40);
    flaeche(
      g,
      [
        [C - 16.5, 61],
        [C + 16.5, 61],
        [C + 16, 66],
        [C - 16, 66],
      ],
      RUMPF_TIEF,
    );
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
  /** 101-109 3D-Fallbacks: je eine lesbare Silhouette fuer Offline/2D. */
  (g) => {
    voll(g, [
      [C, 8],
      [86, 78],
      [C, 68],
      [10, 78],
    ]);
    akzent(g, [
      [C, 20],
      [C + 14, 62],
      [C, 54],
      [C - 14, 62],
    ]);
    duesen(g, C - 10, 58, C + 10, 90);
  },
  (g) => {
    voll(g, [
      [C, 8],
      [76, 48],
      [88, 82],
      [C, 72],
      [32, 82],
      [44, 48],
    ]);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(C, 40, 12);
    duesen(g, C - 12, 62, C + 12, 91);
  },
  (g) => {
    voll(g, [
      [C, 7],
      [94, 62],
      [70, 67],
      [C, 90],
      [26, 67],
      [2, 62],
    ]);
    akzent(g, [
      [C, 18],
      [C + 9, 58],
      [C, 72],
      [C - 9, 58],
    ]);
    duesen(g, C - 8, 72, C + 8, 92);
  },
  (g) => {
    g.lineStyle(10, 0xffffff, 1);
    g.strokeCircle(C, C, 34);
    voll(g, [
      [C, 8],
      [C + 14, 48],
      [C, 76],
      [C - 14, 48],
    ]);
    duesen(g, C - 8, 64, C + 8, 91);
  },
  (g) => {
    voll(g, [
      [C, 8],
      [60, 32],
      [86, 76],
      [C, 66],
      [42, 76],
      [68, 32],
    ]);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(C - 5, 24, 10, 42);
    duesen(g, C - 12, 64, C + 12, 91);
  },
  (g) => {
    stern(g, C, C, 42, 8, 4);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(C, C, 17);
    duesen(g, C - 9, 65, C + 9, 91);
  },
  (g) => {
    voll(g, [
      [C, 6],
      [C + 16, 36],
      [C + 40, 50],
      [C + 16, 62],
      [C, 90],
      [C - 16, 62],
      [C - 40, 50],
      [C - 16, 36],
    ]);
    akzent(g, [
      [C, 18],
      [C + 8, 50],
      [C, 72],
      [C - 8, 50],
    ]);
    duesen(g, C - 8, 70, C + 8, 92);
  },
  (g) => {
    voll(g, [
      [C, 8],
      [C + 28, 42],
      [C + 20, 88],
      [C, 72],
      [C - 20, 88],
      [C - 28, 42],
    ]);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeCircle(C, 46, 18);
    duesen(g, C - 10, 68, C + 10, 92);
  },
  (g) => {
    voll(g, [
      [C, 10],
      [C + 42, 70],
      [C + 12, 64],
      [C, 90],
      [C - 12, 64],
      [C - 42, 70],
    ]);
    akzent(g, [
      [C, 20],
      [C + 12, 56],
      [C, 72],
      [C - 12, 56],
    ]);
    duesen(g, C - 14, 68, C + 14, 92);
  },
];
