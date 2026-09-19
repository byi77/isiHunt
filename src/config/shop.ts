import { balancedCoinCost } from './balance';

/**
 * Der Laden: kaufbare Schiffsformen, Farben und Auren.
 *
 * ## Warum die Formen nicht mehr am Level haengen
 *
 * Bis 2026-08-20 wurden die sieben Schiffsvarianten ueber das Charakterlevel
 * freigeschaltet (Stufe 1/5/15/30/50/75/100). Praktisch war das wirkungslos:
 * Alle Varianten teilten sich denselben Rumpf und unterschieden sich nur
 * durch kleine angesetzte Bauteile. Ein Spieler auf Stufe 51 berichtete, nie
 * einen Wechsel bemerkt zu haben - die Belohnung existierte auf dem Papier.
 *
 * Die Formen sind jetzt neu gezeichnet (jede mit eigener Silhouette, siehe
 * `ui/textures.ts`) und werden ueber Muenzen gekauft. Damit bekommen die
 * Coins ihre erste echte Senke, und der Fortschritt bleibt sichtbar - nur
 * ueber eine Waehrung statt ueber eine Stufe.
 *
 * Wer die Formen bereits ueber sein Level freigeschaltet hatte, behaelt sie
 * (Migration in `SaveSystem`, SAVE_VERSION 8). Das Update nimmt niemandem
 * etwas weg.
 *
 * ## Warum der Laden 2026-09-19 von 111 auf 34 Formen gekuerzt wurde
 *
 * Der Bestand war ueber mehrere Etappen auf 111 Formen und 30 Farben
 * gewachsen. Damit war er kein Angebot mehr, sondern ein Katalog: Wer den
 * Laden oeffnete, scrollte an Zahnrad, Schluessel, Kompass und Rennwagen
 * vorbei - Dingen, die mit einem Flugspiel nichts zu tun haben - und fand
 * zwischen elf kaum unterscheidbaren Heldenfiguren nicht mehr heraus, wofuer
 * er eigentlich sparte. Eine Kaufentscheidung braucht eine ueberschaubare
 * Auswahl; 111 Eintraege verhindern sie.
 *
 * Gestrichen wurde nach zwei Regeln: thematische Fremdkoerper ganz, und von
 * mehreren Varianten derselben Idee bleibt eine. Jede Kategorie ist weiter
 * vertreten (Raumjaeger, Flugzeuge, Figuren, Tiere, Drohnen, 3D-Piloten).
 *
 * **Die entfernten Ids sind ersatzlos weg, auch gekaufte.** Das ist bewusst:
 * Die Userbase wird vor dem Release zurueckgesetzt, ein Bestandsschutz haette
 * also nur Code gekostet, den danach niemand mehr braucht. `getShipShape()`
 * faengt eine unbekannte Id ohnehin mit dem Pfeil ab - ein alter Spielstand
 * verliert die Form, nicht das Spiel.
 */

/** Eine kaufbare Schiffsform. Die Reihenfolge ist die Anzeigereihenfolge. */
export interface ShipShapeDef {
  readonly id: ShipShapeId;
  readonly name: string;
  /** Kurze Beschreibung fuer die Ladenkarte. */
  readonly description: string;
  /** Preis in Muenzen. 0 = von Anfang an dabei. */
  readonly cost: number;
  /** Index der prozeduralen Zeichnung in `createPlayerCore`. */
  readonly skinIndex: number;
  /** Optionaler Provider-Schluessel fuer ein externes 2D-Asset. */
  readonly assetId?: string;
  /** Optionaler Provider-Schluessel fuer ein lazy geladenes 3D-Modell. */
  readonly threeDAssetId?: string;
}

/**
 * Bewusst ein freier String statt einer Union.
 *
 * Jede Id muesste sonst an zwei Stellen gepflegt werden. `getShipShape()`
 * faengt Unbekanntes ohnehin mit dem Pfeil ab, und ein Balance-Test prueft,
 * dass jede Id genau einmal vorkommt und jeder `skinIndex` eine Zeichnung hat.
 */
export type ShipShapeId = string;

/**
 * Preise steigen mit der Auffaelligkeit der Form, nicht mit der Zeichenarbeit.
 *
 * Der Pfeil bleibt kostenlos - ohne ein Schiff kann man nicht spielen. Die
 * uebrigen liegen zwischen 400 und 3 000 Muenzen. Zum Vergleich: Ein Run
 * bringt rund 50 Muenzen, ein Levelaufstieg 20 dazu. Die teuerste Form
 * entspricht damit etwa 60 Runden - ein Fernziel, aber kein Grind ohne Ende.
 */
const SHIP_SHAPES_REFERENCE: readonly ShipShapeDef[] = [
  // --- Raumjaeger ---
  {
    id: 'arrow',
    name: 'Pfeil',
    description: 'Der Klassiker. Schlank und schnell abzulesen.',
    cost: 0,
    skinIndex: 0,
  },
  {
    id: 'delta',
    name: 'Delta',
    description: 'Breite Flügel, ruhige Fläche.',
    cost: 300,
    skinIndex: 1,
  },
  {
    id: 'sickle',
    name: 'Sichel',
    description: 'Weit ausgestellte Spitzen, schmale Mitte.',
    cost: 500,
    skinIndex: 2,
  },
  {
    id: 'ring',
    name: 'Ringjäger',
    description: 'Ein offener Kreis um den Rumpf.',
    cost: 700,
    skinIndex: 3,
  },
  {
    id: 'star',
    name: 'Sternenkreuzer',
    description: 'Sechs Zacken, in jede Richtung gleich.',
    cost: 1_100,
    skinIndex: 5,
  },
  {
    id: 'wedge',
    name: 'Keilkreuzer',
    description: 'Langer Keil, breites Heck.',
    cost: 1_900,
    skinIndex: 9,
  },
  {
    id: 'saucer',
    name: 'Scheibenfrachter',
    description: 'Runde Scheibe mit vorstehender Kanzel.',
    cost: 2_100,
    skinIndex: 10,
  },
  {
    id: 'probe',
    name: 'Sonde',
    description: 'Kugel mit drei Auslegern. Kennt kein Vorne.',
    cost: 2_300,
    skinIndex: 11,
  },

  // --- Flugzeuge ---
  {
    id: 'glider',
    name: 'Gleitschirm',
    description: 'Breite Kappe, ruhiger Flug.',
    cost: 600,
    skinIndex: 18,
  },
  {
    id: 'jet',
    name: 'Düsenjet',
    description: 'Pfeilflügel, Leitwerk, spitze Nase.',
    cost: 800,
    skinIndex: 13,
  },
  {
    id: 'prop',
    name: 'Propellermaschine',
    description: 'Gerade Tragfläche, runder Rumpf.',
    cost: 1_000,
    skinIndex: 14,
  },
  {
    id: 'biplane',
    name: 'Doppeldecker',
    description: 'Zwei Tragflächen mit Streben dazwischen.',
    cost: 1_200,
    skinIndex: 15,
  },
  {
    id: 'rocket',
    name: 'Rakete',
    description: 'Schlanker Zylinder mit drei Finnen.',
    cost: 1_400,
    skinIndex: 17,
  },
  {
    id: 'flyingwing',
    name: 'Nurflügler',
    description: 'Reine Fläche ohne abgesetzten Rumpf.',
    cost: 1_600,
    skinIndex: 16,
  },

  // --- Fliegende Figuren ---
  {
    id: 'astronaut',
    name: 'Astronaut',
    description: 'Helm auf, Arme angelegt.',
    cost: 1_800,
    skinIndex: 20,
  },
  {
    id: 'hero',
    name: 'Held',
    description: 'Beide Arme nach vorn gestreckt.',
    cost: 2_000,
    skinIndex: 19,
  },
  {
    id: 'caped',
    name: 'Umhangflieger',
    description: 'Der Umhang weht weit hinter ihm her.',
    cost: 2_200,
    skinIndex: 21,
  },
  {
    id: 'winged',
    name: 'Flügelwesen',
    description: 'Zwei große Schwingen tragen die Gestalt.',
    cost: 2_400,
    skinIndex: 22,
  },
  {
    id: 'jetpack',
    name: 'Düsenrucksack',
    description: 'Zwei Schubdüsen am Rücken.',
    cost: 2_600,
    skinIndex: 23,
  },

  // --- Fliegende Tiere ---
  {
    id: 'swallow',
    name: 'Schwalbe',
    description: 'Spitze Schwingen, gegabelter Schwanz.',
    cost: 900,
    skinIndex: 25,
  },
  {
    id: 'eagle',
    name: 'Adler',
    description: 'Breite Schwingen, gefächelter Schwanz.',
    cost: 1_000,
    skinIndex: 24,
  },
  {
    id: 'dragonfly',
    name: 'Libelle',
    description: 'Vier schmale Flügel, langer Hinterleib.',
    cost: 1_300,
    skinIndex: 27,
  },
  {
    id: 'bat',
    name: 'Fledermaus',
    description: 'Gezackte Häute zwischen den Fingern.',
    cost: 1_500,
    skinIndex: 26,
  },

  // --- Drohnen ---
  {
    id: 'quadcopter',
    name: 'Quadrokopter',
    description: 'Vier Rotoren im Kreuz.',
    cost: 1_100,
    skinIndex: 28,
  },
  {
    id: 'hexacopter',
    name: 'Hexakopter',
    description: 'Sechs Rotoren, dichteres Muster.',
    cost: 1_700,
    skinIndex: 29,
  },

  // --- Externe CC0-Assets ---
  //
  // Bleibt trotz der Ausduennung: ein eigens recherchiertes Sprite-Sheet, das
  // `BootScene` ohnehin laedt - kein Fuellmaterial wie die gestrichenen
  // prozeduralen Formen.
  {
    id: 'cc0-scout',
    name: 'CC0-Surveyor',
    description: 'Ein kompakter Scout aus einem frei nutzbaren Sprite-Sheet.',
    cost: 2_200,
    skinIndex: 100,
    assetId: 'cc0-scout',
  },

  // --- 3D-Piloten (CC0) ---
  {
    id: 'cc0-3d-ship-1',
    name: 'Orbital-01',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_400,
    skinIndex: 101,
    threeDAssetId: 'cc0-3d-ship-1',
  },
  {
    id: 'cc0-3d-ship-2',
    name: 'Orbital-02',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_450,
    skinIndex: 102,
    threeDAssetId: 'cc0-3d-ship-2',
  },
  {
    id: 'cc0-3d-ship-3',
    name: 'Orbital-03',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_500,
    skinIndex: 103,
    threeDAssetId: 'cc0-3d-ship-3',
  },
  {
    id: 'cc0-3d-ship-4',
    name: 'Orbital-04',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_550,
    skinIndex: 104,
    threeDAssetId: 'cc0-3d-ship-4',
  },
  {
    id: 'cc0-3d-ship-5',
    name: 'Orbital-05',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_600,
    skinIndex: 105,
    threeDAssetId: 'cc0-3d-ship-5',
  },
  {
    id: 'cc0-3d-ship-6',
    name: 'Orbital-06',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_650,
    skinIndex: 106,
    threeDAssetId: 'cc0-3d-ship-6',
  },
  {
    id: 'cc0-3d-ship-7',
    name: 'Orbital-07',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_700,
    skinIndex: 107,
    threeDAssetId: 'cc0-3d-ship-7',
  },
  {
    id: 'cc0-3d-ship-8',
    name: 'Orbital-08',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_750,
    skinIndex: 108,
    threeDAssetId: 'cc0-3d-ship-8',
  },
  {
    id: 'cc0-3d-ship-9',
    name: 'Orbital-09',
    description: 'Low-Poly-3D-Modell aus dem CC0-Schiffspack.',
    cost: 2_800,
    skinIndex: 109,
    threeDAssetId: 'cc0-3d-ship-9',
  },
];

// Die 3D-Piloten stehen im Shop bewusst ganz oben: Sie sind die aktuelle
// visuelle Erweiterung und sollen nicht erst nach 100 2D-Eintraegen gefunden
// werden. `skinIndex` und IDs bleiben unveraendert; nur die Shop-Reihenfolge
// wird sortiert.
export const SHIP_SHAPES: readonly ShipShapeDef[] = [
  ...SHIP_SHAPES_REFERENCE.filter((shape) => shape.threeDAssetId !== undefined),
  ...SHIP_SHAPES_REFERENCE.filter((shape) => shape.threeDAssetId === undefined),
].map((shape) => ({
  ...shape,
  cost: balancedCoinCost(shape.cost),
}));

/** Eine kaufbare Farbe fuer Schiff, Aura und Halo. */
export interface ShipColorDef {
  readonly id: ShipColorId;
  readonly name: string;
  readonly cost: number;
  /** `null` = die Farbe der gewaehlten Welt, wie bisher. */
  readonly color: number | null;
}

export type ShipColorId = string;

/**
 * Farben sind billiger als Formen: Sie aendern die Silhouette nicht und
 * lassen sich beliebig mit jeder Form kombinieren.
 *
 * Moeglich ist das ohne zusaetzliche Texturen, weil alle Spielgrafiken weiss
 * gezeichnet und zur Laufzeit getintet werden (siehe CLAUDE.md, "Texturen
 * sind weiss"). Eine Farbe kostet damit keinen Speicher und keine Ladezeit.
 */
const SHIP_COLORS_REFERENCE: readonly ShipColorDef[] = [
  { id: 'world', name: 'Weltfarbe', cost: 0, color: null },

  // Warme Toene
  { id: 'gold', name: 'Gold', cost: 200, color: 0xffd479 },
  { id: 'ember', name: 'Glut', cost: 300, color: 0xff7a3c },
  { id: 'crimson', name: 'Karmin', cost: 300, color: 0xff4d5e },

  // Kuehle Toene
  { id: 'ice', name: 'Eis', cost: 200, color: 0x8fe3ff },
  { id: 'azure', name: 'Azur', cost: 250, color: 0x4aa3ff },
  { id: 'teal', name: 'Petrol', cost: 250, color: 0x35d6c3 },

  // Gruen, Violett, Rosa
  { id: 'forest', name: 'Waldgrün', cost: 250, color: 0x4faf5c },
  { id: 'violet', name: 'Violett', cost: 350, color: 0xc084fc },
  { id: 'ruby', name: 'Rubin', cost: 700, color: 0xff2f5e },

  // Helle und dunkle Grundtoene
  { id: 'snow', name: 'Schnee', cost: 300, color: 0xffffff },
  { id: 'onyx', name: 'Onyx', cost: 500, color: 0x3a3f52 },

  // Das Fernziel unter den Farben
  { id: 'platinum', name: 'Platin', cost: 900, color: 0xe6f0ff },
];

export const SHIP_COLORS: readonly ShipColorDef[] = SHIP_COLORS_REFERENCE.map((color) => ({
  ...color,
  cost: balancedCoinCost(color.cost),
}));

/**
 * Eine kaufbare Aura - die dritte Kategorie neben Form und Farbe.
 *
 * ## Warum sie teurer ist als beides
 *
 * Formen und Farben sind Standbilder: Wer sie traegt, unterscheidet sich auf
 * einem Screenshot. Eine Aura sieht man nur in Bewegung, dafuer aber die
 * ganze Runde lang - sie ist das auffaelligste, was eine Figur tragen kann.
 * Deshalb ist sie das Fernziel: Die guenstigste kostet mehr als die teuerste
 * Form, die teuerste entspricht rund 200 Runden.
 *
 * ## Warum sie mit den anderen Kategorien kombiniert und nicht ersetzt
 *
 * Eine Aura veraendert weder Textur noch Grundfarbe - sie moduliert nur, was
 * Form und Farbe bereits festgelegt haben (siehe `ui/shipAnimations.ts`,
 * "Warum die Farbe verschoben und nicht ersetzt wird"). Damit behalten die
 * beiden guenstigeren Kategorien ihren Wert: Wer Gold gekauft hat, sieht auch
 * unter der Aura Gold.
 */
export interface ShipAuraDef {
  readonly id: ShipAuraId;
  readonly name: string;
  /** Kurze Beschreibung fuer die Ladenkarte. */
  readonly description: string;
  /** Preis in Muenzen. 0 = von Anfang an dabei (die Aura "keine"). */
  readonly cost: number;
  /**
   * Index der Bewegung in `SHIP_ANIMATIONS`, oder `null` fuer "keine Aura".
   *
   * Wie bei `skinIndex`: darf sich nie aendern, sonst traegt eine gekaufte
   * Aura ploetzlich eine andere Bewegung.
   */
  readonly animIndex: number | null;
  /**
   * Mindestlevel, ab dem sie ueberhaupt kaufbar ist. `0` = keine Bedingung.
   *
   * Nur die Prismaflut nutzt das. Bei allen anderen Auren entscheidet allein
   * das Guthaben - eine Stufenhuerde bei acht von neun Eintraegen waere eine
   * zweite Waehrung, die niemand verlangt hat.
   */
  readonly minLevel: number;
  /** Optionaler Provider-Schluessel fuer ein externes Aura-Overlay. */
  readonly assetId?: string;
}

/** Wie bei `ShipShapeId` bewusst ein freier String, nicht eine Union. */
export type ShipAuraId = string;

/**
 * Die Preise steigen mit der Auffaelligkeit, nicht mit der Rechenarbeit.
 *
 * "Keine" bleibt kostenlos - eine Aura ist Schmuck, kein Eintrittspreis. Die
 * uebrigen liegen zwischen 4 000 und 10 000 Muenzen. Zum Vergleich: Ein Run
 * bringt rund 50 Muenzen, die teuerste **Form** kostet 3 000. Die erste Aura
 * ist damit ein Ziel fuer nach dem Laden, nicht daneben.
 *
 * **Die Prismaflut steht ausserhalb dieser Reihe.** 25 000 Muenzen sind rund
 * 500 Runden - mehr als das Doppelte der bis dahin teuersten Aura. Dazu Stufe
 * 50, damit Geduld allein nicht reicht: Wer sie traegt, hat beides
 * aufgebracht. Genau das soll man ihr ansehen.
 */
const SHIP_AURAS_REFERENCE: readonly ShipAuraDef[] = [
  {
    id: 'none',
    name: 'Keine',
    description: 'Die Figur bleibt ruhig.',
    cost: 0,
    animIndex: null,
    minLevel: 0,
  },
  // Die Prismaflut steht bewusst an zweiter Stelle, nicht am Ende.
  //
  // Nach Preis sortiert gehoerte sie ganz nach unten - und genau dort hat sie
  // im ersten Screenshot niemand gesehen: Sie lag hinter acht Karten und dem
  // Zurueck-Balken. Das teuerste Stueck des Spiels war das einzige, das man
  // beim Oeffnen nicht zu Gesicht bekam. Ein Fernziel wirkt nur, wenn es
  // sofort ins Auge faellt.
  {
    id: 'prismasurge',
    name: 'Prismaflut',
    description: 'LÃ¤uft durch alle Farben und blitzt dabei auf. Ab Stufe 50.',
    cost: 25_000,
    animIndex: 8,
    minLevel: 50,
    assetId: 'cc0-kenney-flame',
  },
  {
    id: 'wingbeat',
    name: 'FlÃ¼gelschlag',
    description: 'Die Gestalt schlÃ¤gt seitlich aus, wie Schwingen im Flug.',
    cost: 4_000,
    animIndex: 0,
    minLevel: 0,
  },
  {
    id: 'heartbeat',
    name: 'Herzschlag',
    description: 'Zwei schnelle SchlÃ¤ge, dann eine Pause. Etwas Lebendiges.',
    cost: 4_500,
    animIndex: 3,
    minLevel: 0,
  },
  {
    id: 'tumble',
    name: 'Taumel',
    description: 'Langsames Kippen im Raum, ohne festen Takt.',
    cost: 5_000,
    animIndex: 5,
    minLevel: 0,
  },
  {
    id: 'spin',
    name: 'Kreisel',
    description: 'Dreht sich um die eigene Achse â€” mit Vorder- und RÃ¼ckseite.',
    cost: 6_000,
    animIndex: 1,
    minLevel: 0,
  },
  {
    id: 'phantom',
    name: 'Phantom',
    description: 'Wird durchscheinend und wieder fest.',
    cost: 6_500,
    animIndex: 4,
    minLevel: 0,
  },
  {
    id: 'prism',
    name: 'Prisma',
    description: 'Der Farbton wandert, ohne die getragene Farbe zu verlieren.',
    cost: 7_500,
    animIndex: 2,
    minLevel: 0,
  },
  {
    id: 'starfire',
    name: 'Sternenbrand',
    description: 'Unruhiges Flackern, das sich nie genau wiederholt.',
    cost: 9_000,
    animIndex: 6,
    minLevel: 0,
  },
  {
    id: 'singularity',
    name: 'SingularitÃ¤t',
    description: 'Sog bis fast zum Punkt, dann der RÃ¼cksprung.',
    cost: 10_000,
    animIndex: 7,
    minLevel: 0,
  },
];

export const SHIP_AURAS: readonly ShipAuraDef[] = SHIP_AURAS_REFERENCE.map((aura) => ({
  ...aura,
  cost: balancedCoinCost(aura.cost),
}));

export const DEFAULT_SHIP_SHAPE: ShipShapeId = 'arrow';
export const DEFAULT_SHIP_COLOR: ShipColorId = 'world';
export const DEFAULT_SHIP_AURA: ShipAuraId = 'none';

export function getShipShape(id: string): ShipShapeDef {
  return (
    SHIP_SHAPES.find((shape) => shape.id === id) ??
    SHIP_SHAPES.find((shape) => shape.id === DEFAULT_SHIP_SHAPE) ??
    SHIP_SHAPES[0]!
  );
}

export function getShipColor(id: string): ShipColorDef {
  return SHIP_COLORS.find((color) => color.id === id) ?? SHIP_COLORS[0]!;
}

export function getShipAura(id: string): ShipAuraDef {
  return SHIP_AURAS.find((aura) => aura.id === id) ?? SHIP_AURAS[0]!;
}

/**
 * Ob das Level fuer diese Aura reicht.
 *
 * Getrennt vom Guthaben gefragt, weil der Laden beides verschieden anzeigt:
 * Wer zu wenig Muenzen hat, sieht den Preis und kann darauf hinsparen. Wer
 * die Stufe nicht hat, sieht stattdessen die Stufe - sparen hilft ihm nicht.
 */
export function auraLevelReached(aura: ShipAuraDef, level: number): boolean {
  return level >= aura.minLevel;
}

/**
 * Die Bewegung, die die Figur tragen soll - oder `null` fuer keine.
 *
 * Wie bei `shipTint()` gilt: Nur tragen, was auch gekauft wurde. Ein
 * manipulierter Spielstand soll keine ungekaufte Aura zeigen.
 */
export function shipAuraIndex(save: { shipAura: string; ownedShipAuras: string[] }): number | null {
  if (!save.ownedShipAuras.includes(save.shipAura)) return null;
  return getShipAura(save.shipAura).animIndex;
}

/** Provider-Schluessel der getragenen Aura, falls sie ein Asset-Overlay nutzt. */
export function shipAuraAssetId(save: {
  shipAura: string;
  ownedShipAuras: string[];
}): string | undefined {
  if (!save.ownedShipAuras.includes(save.shipAura)) return undefined;
  return getShipAura(save.shipAura).assetId;
}

/**
 * Welche Formen ein Spielstand ueber sein altes Level bereits verdient hatte.
 *
 * Nur fuer die einmalige Migration auf SAVE_VERSION 8 gedacht - die Schwellen
 * entsprechen der frueheren `playerTextureForLevel()`. Danach entscheidet
 * ausschliesslich der Besitz aus dem Laden.
 */
export function shapesEarnedByLegacyLevel(level: number): ShipShapeId[] {
  const schwellen: readonly { readonly minLevel: number; readonly id: ShipShapeId }[] = [
    { minLevel: 1, id: 'arrow' },
    { minLevel: 5, id: 'delta' },
    { minLevel: 15, id: 'sickle' },
    { minLevel: 30, id: 'ring' },
    { minLevel: 50, id: 'twin' },
    { minLevel: 75, id: 'star' },
    { minLevel: 100, id: 'crown' },
  ];
  return schwellen.filter((s) => level >= s.minLevel).map((s) => s.id);
}

/**
 * Die Farbe, in der Schiff, Aura und Halo getintet werden.
 *
 * `weltAkzent` ist der Rueckfall: Wer die Weltfarbe traegt (Standard), sieht
 * die Figur weiterhin in der Stimmung der gewaehlten Welt.
 */
export function shipTint(
  save: { shipColor: string; ownedShipColors: string[] },
  weltAkzent: number,
): number {
  // Nur tragen, was auch gekauft wurde - ein manipulierter Spielstand soll
  // keine ungekaufte Farbe zeigen.
  if (!save.ownedShipColors.includes(save.shipColor)) return weltAkzent;
  return getShipColor(save.shipColor).color ?? weltAkzent;
}

/**
 * Die Farbe des Schiffsrumpfs.
 *
 * Anders als `shipTint()`, das Aura und Halo faerbt: Wer die Weltfarbe
 * traegt, behaelt einen **weissen** Rumpf. Ein grosser Teil des Spielfelds
 * traegt die Weltfarbe, und eine gruene Figur auf gruenem Grund ist im
 * Gewuehl kaum auszumachen - genau das zeigte der erste Versuch, den Rumpf
 * pauschal mitzufaerben. Gekaufte Farben stechen dagegen bewusst heraus;
 * dafuer wurden sie gekauft.
 */
export function shipHullTint(save: { shipColor: string; ownedShipColors: string[] }): number {
  if (!save.ownedShipColors.includes(save.shipColor)) return 0xffffff;
  return getShipColor(save.shipColor).color ?? 0xffffff;
}
