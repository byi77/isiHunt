/**
 * Der Laden: kaufbare Schiffsformen und Farben.
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
}

/**
 * Bewusst ein freier String statt einer Union.
 *
 * Bei dreissig und mehr Formen muesste jede Id an zwei Stellen gepflegt
 * werden. `getShipShape()` faengt Unbekanntes ohnehin mit dem Pfeil ab, und
 * ein Balance-Test prueft, dass jede Id genau einmal vorkommt und jeder
 * `skinIndex` eine Zeichnung hat.
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
export const SHIP_SHAPES: readonly ShipShapeDef[] = [
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
    id: 'twin',
    name: 'Doppelrumpf',
    description: 'Zwei Hälften, eine Brücke.',
    cost: 900,
    skinIndex: 4,
  },
  {
    id: 'star',
    name: 'Sternenkreuzer',
    description: 'Sechs Zacken, in jede Richtung gleich.',
    cost: 1_100,
    skinIndex: 5,
  },
  {
    id: 'crown',
    name: 'Krone',
    description: 'Drei Zinnen auf breiter Basis.',
    cost: 1_300,
    skinIndex: 6,
  },
  {
    id: 'quadwing',
    name: 'Vierflügler',
    description: 'Vier gespreizte Tragflächen um einen Spindelrumpf.',
    cost: 1_500,
    skinIndex: 7,
  },
  {
    id: 'podfighter',
    name: 'Kanzeljäger',
    description: 'Kugelkanzel zwischen zwei senkrechten Flächen.',
    cost: 1_700,
    skinIndex: 8,
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
  {
    id: 'funnel',
    name: 'Trichter',
    description: 'Weit geöffneter Einlass, schmales Heck.',
    cost: 2_500,
    skinIndex: 12,
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
];

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
export const SHIP_COLORS: readonly ShipColorDef[] = [
  { id: 'world', name: 'Weltfarbe', cost: 0, color: null },

  // Warme Toene
  { id: 'gold', name: 'Gold', cost: 200, color: 0xffd479 },
  { id: 'sand', name: 'Sand', cost: 200, color: 0xe8cfa0 },
  { id: 'amber', name: 'Bernstein', cost: 200, color: 0xffb340 },
  { id: 'peach', name: 'Pfirsich', cost: 250, color: 0xffb59e },
  { id: 'ember', name: 'Glut', cost: 300, color: 0xff7a3c },
  { id: 'crimson', name: 'Karmin', cost: 300, color: 0xff4d5e },
  { id: 'rust', name: 'Rost', cost: 300, color: 0xc75b32 },

  // Kuehle Toene
  { id: 'ice', name: 'Eis', cost: 200, color: 0x8fe3ff },
  { id: 'steel', name: 'Stahl', cost: 200, color: 0x9aa3bd },
  { id: 'azure', name: 'Azur', cost: 250, color: 0x4aa3ff },
  { id: 'teal', name: 'Petrol', cost: 250, color: 0x35d6c3 },
  { id: 'mint', name: 'Minze', cost: 250, color: 0x9ff7d8 },
  { id: 'deepsea', name: 'Tiefsee', cost: 300, color: 0x2f6df0 },
  { id: 'midnight', name: 'Mitternacht', cost: 400, color: 0x5560c8 },

  // Gruentoene
  { id: 'forest', name: 'Waldgrün', cost: 250, color: 0x4faf5c },
  { id: 'lime', name: 'Limette', cost: 250, color: 0xd4ff5c },
  { id: 'toxic', name: 'Giftgrün', cost: 300, color: 0x9dff4f },

  // Violett und Rosa
  { id: 'violet', name: 'Violett', cost: 350, color: 0xc084fc },
  { id: 'orchid', name: 'Orchidee', cost: 350, color: 0xe07aff },
  { id: 'rose', name: 'Rosé', cost: 350, color: 0xff8fc4 },
  { id: 'magenta', name: 'Magenta', cost: 400, color: 0xff4fd8 },

  // Helle und dunkle Grundtoene
  { id: 'ash', name: 'Asche', cost: 250, color: 0x6d7488 },
  { id: 'snow', name: 'Schnee', cost: 300, color: 0xffffff },
  { id: 'onyx', name: 'Onyx', cost: 500, color: 0x3a3f52 },

  // Besondere - die teuersten, als Fernziel
  { id: 'copper', name: 'Kupfer', cost: 600, color: 0xd98d52 },
  { id: 'emerald', name: 'Smaragd', cost: 700, color: 0x2fd97a },
  { id: 'sapphire', name: 'Saphir', cost: 700, color: 0x3d7bff },
  { id: 'ruby', name: 'Rubin', cost: 700, color: 0xff2f5e },
  { id: 'platinum', name: 'Platin', cost: 900, color: 0xe6f0ff },
];

export const DEFAULT_SHIP_SHAPE: ShipShapeId = 'arrow';
export const DEFAULT_SHIP_COLOR: ShipColorId = 'world';

export function getShipShape(id: string): ShipShapeDef {
  return SHIP_SHAPES.find((shape) => shape.id === id) ?? SHIP_SHAPES[0]!;
}

export function getShipColor(id: string): ShipColorDef {
  return SHIP_COLORS.find((color) => color.id === id) ?? SHIP_COLORS[0]!;
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
