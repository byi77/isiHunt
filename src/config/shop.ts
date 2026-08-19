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

export type ShipShapeId = 'arrow' | 'delta' | 'sickle' | 'ring' | 'twin' | 'star' | 'crown';

/**
 * Preise steigen mit der Auffaelligkeit der Form, nicht mit der Zeichenarbeit.
 *
 * Der Pfeil bleibt kostenlos - ohne ein Schiff kann man nicht spielen. Die
 * uebrigen liegen zwischen 400 und 3 000 Muenzen. Zum Vergleich: Ein Run
 * bringt rund 50 Muenzen, ein Levelaufstieg 20 dazu. Die teuerste Form
 * entspricht damit etwa 60 Runden - ein Fernziel, aber kein Grind ohne Ende.
 */
export const SHIP_SHAPES: readonly ShipShapeDef[] = [
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
    cost: 400,
    skinIndex: 1,
  },
  {
    id: 'sickle',
    name: 'Sichel',
    description: 'Weit ausgestellte Spitzen, schmale Mitte.',
    cost: 800,
    skinIndex: 2,
  },
  {
    id: 'ring',
    name: 'Ring',
    description: 'Ein offener Kreis um den Rumpf.',
    cost: 1_200,
    skinIndex: 3,
  },
  {
    id: 'twin',
    name: 'Doppelrumpf',
    description: 'Zwei Hälften, eine Brücke.',
    cost: 1_800,
    skinIndex: 4,
  },
  {
    id: 'star',
    name: 'Stern',
    description: 'Sechs Zacken, in jede Richtung gleich.',
    cost: 2_400,
    skinIndex: 5,
  },
  {
    id: 'crown',
    name: 'Krone',
    description: 'Drei Zinnen auf breiter Basis.',
    cost: 3_000,
    skinIndex: 6,
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

export type ShipColorId = 'world' | 'gold' | 'ice' | 'ember' | 'toxic' | 'violet' | 'rose';

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
  { id: 'gold', name: 'Gold', cost: 300, color: 0xffd479 },
  { id: 'ice', name: 'Eis', cost: 300, color: 0x8fe3ff },
  { id: 'ember', name: 'Glut', cost: 500, color: 0xff7a3c },
  { id: 'toxic', name: 'Giftgrün', cost: 500, color: 0x9dff4f },
  { id: 'violet', name: 'Violett', cost: 700, color: 0xc084fc },
  { id: 'rose', name: 'Rosé', cost: 700, color: 0xff8fc4 },
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
