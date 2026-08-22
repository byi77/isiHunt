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

  // --- Helden, Maerchengestalten und weitere Fluggeraete (Etappe 2+3) ---
  //
  // Reihenfolge hier ist Anzeigereihenfolge; `skinIndex` verweist auf die
  // Zeichnung in `ui/shipShapes.ts` und darf sich nie aendern - sonst traegt
  // ein gekauftes Schiff ploetzlich eine andere Form.
  {
    id: 'heroine',
    name: 'Heldin',
    description: 'Ein Arm vorgestreckt, Umhang im Wind.',
    cost: 2_000,
    skinIndex: 30,
  },
  {
    id: 'masked',
    name: 'Maskenheld',
    description: 'Maske über den Augen, beide Fäuste vorn.',
    cost: 2_100,
    skinIndex: 31,
  },
  {
    id: 'caped_heroine',
    name: 'Umhangheldin',
    description: 'Weiter Umhang, Hände in die Hüften.',
    cost: 2_200,
    skinIndex: 32,
  },
  {
    id: 'titan',
    name: 'Kraftheld',
    description: 'Massige Schultern, Arme durchgestreckt.',
    cost: 2_300,
    skinIndex: 33,
  },
  {
    id: 'starlight',
    name: 'Sternenheldin',
    description: 'Ein Stern über der erhobenen Hand.',
    cost: 2_600,
    skinIndex: 34,
  },
  {
    id: 'armored',
    name: 'Panzerheld',
    description: 'Breite Schultern, geschlossener Helm.',
    cost: 2_400,
    skinIndex: 35,
  },
  {
    id: 'bolt',
    name: 'Blitzheld',
    description: 'Zackiger Umriss, nichts daran ist gerade.',
    cost: 2_500,
    skinIndex: 80,
  },
  {
    id: 'shieldmaiden',
    name: 'Schildheldin',
    description: 'Runder Schild vor dem Körper.',
    cost: 2_400,
    skinIndex: 81,
  },
  {
    id: 'archer',
    name: 'Bogenschützin',
    description: 'Gespannter Bogen quer vor dem Körper.',
    cost: 2_300,
    skinIndex: 82,
  },
  {
    id: 'lancer',
    name: 'Speerkämpfer',
    description: 'Langer Speer, aufrechte Haltung.',
    cost: 2_200,
    skinIndex: 83,
  },
  {
    id: 'princess',
    name: 'Prinzessin',
    description: 'Krone und weites Kleid.',
    cost: 1_900,
    skinIndex: 36,
  },
  {
    id: 'fairy',
    name: 'Fee',
    description: 'Durchscheinende Flügel und ein Zauberstab.',
    cost: 2_000,
    skinIndex: 37,
  },
  {
    id: 'sorceress',
    name: 'Zauberin',
    description: 'Spitzhut, langer Umhang, Sternenstab.',
    cost: 2_400,
    skinIndex: 38,
  },
  { id: 'queen', name: 'Königin', description: 'Krone und Zepter.', cost: 2_700, skinIndex: 39 },
  {
    id: 'wingfairy',
    name: 'Flügelfee',
    description: 'Federflügel statt Insektenflügeln.',
    cost: 2_200,
    skinIndex: 40,
  },
  {
    id: 'nightfairy',
    name: 'Nachtfee',
    description: 'Fledermausflügel und Spitzhut.',
    cost: 2_300,
    skinIndex: 41,
  },
  {
    id: 'mermaid',
    name: 'Meerjungfrau',
    description: 'Flosse statt Beinen.',
    cost: 2_100,
    skinIndex: 42,
  },
  {
    id: 'knight',
    name: 'Ritter',
    description: 'Federbusch am Helm, Schwert erhoben.',
    cost: 2_200,
    skinIndex: 43,
  },
  {
    id: 'dragon',
    name: 'Drache',
    description: 'Rückenzacken, Hautflügel, langer Schwanz.',
    cost: 2_900,
    skinIndex: 44,
  },
  {
    id: 'unicorn',
    name: 'Einhorn',
    description: 'Horn und Federflügel.',
    cost: 2_800,
    skinIndex: 45,
  },
  {
    id: 'ghost',
    name: 'Geist',
    description: 'Wehender Umriss ohne Beine.',
    cost: 1_800,
    skinIndex: 85,
  },
  {
    id: 'kraken',
    name: 'Krake',
    description: 'Runder Kopf, acht Arme.',
    cost: 2_000,
    skinIndex: 86,
  },
  {
    id: 'crescent',
    name: 'Sichelmond',
    description: 'Eine schmale Sichel, offen nach hinten.',
    cost: 1_400,
    skinIndex: 46,
  },
  {
    id: 'manta',
    name: 'Manta',
    description: 'Sehr flach, weit ausladend.',
    cost: 1_500,
    skinIndex: 47,
  },
  {
    id: 'spear',
    name: 'Speerschiff',
    description: 'Extrem schlank, lange Spitze.',
    cost: 1_300,
    skinIndex: 48,
  },
  {
    id: 'beetle',
    name: 'Käfer',
    description: 'Runder Panzer mit zwei Fühlern.',
    cost: 1_400,
    skinIndex: 49,
  },
  {
    id: 'anchor',
    name: 'Anker',
    description: 'Ring oben, ausladende Arme unten.',
    cost: 1_600,
    skinIndex: 50,
  },
  {
    id: 'twindisc',
    name: 'Zwillingsscheibe',
    description: 'Zwei Scheiben nebeneinander.',
    cost: 1_700,
    skinIndex: 51,
  },
  {
    id: 'comb',
    name: 'Kamm',
    description: 'Fünf senkrechte Finger auf einer Basis.',
    cost: 1_500,
    skinIndex: 52,
  },
  {
    id: 'spiral',
    name: 'Spirale',
    description: 'Drei gedrehte Arme aus der Mitte.',
    cost: 1_900,
    skinIndex: 53,
  },
  {
    id: 'cube',
    name: 'Würfel',
    description: 'Kantiger Block mit abgesetzten Ecken.',
    cost: 1_600,
    skinIndex: 54,
  },
  {
    id: 'claw',
    name: 'Greifklaue',
    description: 'Drei nach innen gebogene Finger.',
    cost: 1_800,
    skinIndex: 55,
  },
  {
    id: 'sail',
    name: 'Segler',
    description: 'Dreieckiges Segel an einem Mast.',
    cost: 1_500,
    skinIndex: 56,
  },
  {
    id: 'torus',
    name: 'Torus',
    description: 'Ein dicker Ring, sonst nichts.',
    cost: 1_700,
    skinIndex: 57,
  },
  {
    id: 'arrowhead',
    name: 'Pfeilspitze',
    description: 'Flach und breit, tiefe Kerbe.',
    cost: 1_400,
    skinIndex: 58,
  },
  {
    id: 'tower',
    name: 'Turm',
    description: 'Schmal und hoch, drei Absätze.',
    cost: 1_600,
    skinIndex: 59,
  },
  {
    id: 'crystal',
    name: 'Kristall',
    description: 'Facettierter Kegel.',
    cost: 2_000,
    skinIndex: 92,
  },
  {
    id: 'pyramid',
    name: 'Pyramide',
    description: 'Dreieck mit sichtbarer Seitenfläche.',
    cost: 1_500,
    skinIndex: 93,
  },
  {
    id: 'portal',
    name: 'Portal',
    description: 'Ring mit gezacktem Inneren.',
    cost: 2_600,
    skinIndex: 99,
  },
  {
    id: 'deepkraken',
    name: 'Tiefenkrake',
    description: 'Spiralarme um eine Kugel.',
    cost: 2_700,
    skinIndex: 98,
  },
  {
    id: 'seaplane',
    name: 'Wasserflugzeug',
    description: 'Schwimmer unter den Tragflächen.',
    cost: 1_200,
    skinIndex: 60,
  },
  {
    id: 'helicopter',
    name: 'Hubschrauber',
    description: 'Rotor quer über der Kabine.',
    cost: 1_400,
    skinIndex: 61,
  },
  {
    id: 'hangglider',
    name: 'Deltaflieger',
    description: 'Hängegleiter mit Pilot darunter.',
    cost: 1_000,
    skinIndex: 62,
  },
  {
    id: 'zeppelin',
    name: 'Zeppelin',
    description: 'Langer Ballon mit Gondel.',
    cost: 1_300,
    skinIndex: 63,
  },
  {
    id: 'balloon',
    name: 'Heißluftballon',
    description: 'Runder Ballon, Korb an Seilen.',
    cost: 1_100,
    skinIndex: 64,
  },
  {
    id: 'paperplane',
    name: 'Papierflieger',
    description: 'Gefaltete Kanten, sichtbarer Knick.',
    cost: 800,
    skinIndex: 65,
  },
  {
    id: 'racecar',
    name: 'Rennwagen',
    description: 'Flach, mit breitem Heckflügel.',
    cost: 1_500,
    skinIndex: 90,
  },
  {
    id: 'submarine',
    name: 'U-Boot',
    description: 'Zigarrenform mit Turm.',
    cost: 1_600,
    skinIndex: 91,
  },
  {
    id: 'butterfly',
    name: 'Schmetterling',
    description: 'Vier runde Flügel, schmaler Leib.',
    cost: 1_300,
    skinIndex: 66,
  },
  {
    id: 'owl',
    name: 'Eule',
    description: 'Gedrungen, breiter Kopf, Federohren.',
    cost: 1_400,
    skinIndex: 67,
  },
  {
    id: 'hummingbird',
    name: 'Kolibri',
    description: 'Langer Schnabel, schwirrende Flügel.',
    cost: 1_500,
    skinIndex: 68,
  },
  {
    id: 'stork',
    name: 'Storch',
    description: 'Langer Hals, lange Beine.',
    cost: 1_400,
    skinIndex: 69,
  },
  {
    id: 'ray',
    name: 'Rochen',
    description: 'Flacher Körper, dünner Schwanz.',
    cost: 1_300,
    skinIndex: 70,
  },
  {
    id: 'jellyfish',
    name: 'Qualle',
    description: 'Runde Glocke mit Tentakeln.',
    cost: 1_200,
    skinIndex: 71,
  },
  {
    id: 'wasp',
    name: 'Wespe',
    description: 'Gestreifter Hinterleib, schmale Taille.',
    cost: 1_600,
    skinIndex: 72,
  },
  {
    id: 'octocopter',
    name: 'Oktokopter',
    description: 'Acht Rotoren, dichtes Muster.',
    cost: 2_000,
    skinIndex: 73,
  },
  {
    id: 'tricopter',
    name: 'Tricopter',
    description: 'Drei Rotoren in Y-Form.',
    cost: 1_300,
    skinIndex: 74,
  },
  {
    id: 'satellite',
    name: 'Satellit',
    description: 'Kern mit zwei Solarflächen.',
    cost: 1_700,
    skinIndex: 75,
  },
  {
    id: 'telescope',
    name: 'Teleskop',
    description: 'Langes Rohr auf einem Dreibein.',
    cost: 1_500,
    skinIndex: 76,
  },
  { id: 'compass', name: 'Kompass', description: 'Ring mit Nadel.', cost: 1_400, skinIndex: 77 },
  {
    id: 'key',
    name: 'Schlüssel',
    description: 'Runder Griff, gezackter Bart.',
    cost: 1_200,
    skinIndex: 78,
  },
  {
    id: 'gear',
    name: 'Zahnrad',
    description: 'Acht Zähne um eine Nabe.',
    cost: 1_300,
    skinIndex: 79,
  },
  {
    id: 'robot',
    name: 'Roboter',
    description: 'Eckiger Kopf mit Antenne.',
    cost: 1_900,
    skinIndex: 84,
  },
  {
    id: 'snowflake',
    name: 'Schneeflocke',
    description: 'Sechs verzweigte Arme.',
    cost: 1_800,
    skinIndex: 87,
  },
  {
    id: 'flame',
    name: 'Flamme',
    description: 'Züngelnder Umriss, unten breit.',
    cost: 1_700,
    skinIndex: 88,
  },
  {
    id: 'droplet',
    name: 'Tropfen',
    description: 'Runde Basis, spitz nach oben.',
    cost: 1_000,
    skinIndex: 89,
  },
  {
    id: 'heart',
    name: 'Herz',
    description: 'Zwei Bögen oben, Spitze unten.',
    cost: 1_200,
    skinIndex: 94,
  },
  {
    id: 'flower',
    name: 'Blume',
    description: 'Fünf Blüten um eine Mitte.',
    cost: 1_300,
    skinIndex: 95,
  },
  {
    id: 'hourglass',
    name: 'Sanduhr',
    description: 'Zwei Dreiecke, Spitze an Spitze.',
    cost: 1_500,
    skinIndex: 96,
  },
  { id: 'eye', name: 'Auge', description: 'Mandelform mit Pupille.', cost: 1_600, skinIndex: 97 },
  {
    id: 'cc0-scout',
    name: 'CC0-Surveyor',
    description: 'Ein kompakter Scout aus einem frei nutzbaren Sprite-Sheet.',
    cost: 2_200,
    skinIndex: 100,
    assetId: 'cc0-scout',
  },
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

export const SHIP_SHAPES: readonly ShipShapeDef[] = SHIP_SHAPES_REFERENCE.map((shape) => ({
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
    description: 'Läuft durch alle Farben und blitzt dabei auf. Ab Stufe 50.',
    cost: 25_000,
    animIndex: 8,
    minLevel: 50,
    assetId: 'cc0-kenney-flame',
  },
  {
    id: 'wingbeat',
    name: 'Flügelschlag',
    description: 'Die Gestalt schlägt seitlich aus, wie Schwingen im Flug.',
    cost: 4_000,
    animIndex: 0,
    minLevel: 0,
  },
  {
    id: 'heartbeat',
    name: 'Herzschlag',
    description: 'Zwei schnelle Schläge, dann eine Pause. Etwas Lebendiges.',
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
    description: 'Dreht sich um die eigene Achse — mit Vorder- und Rückseite.',
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
    name: 'Singularität',
    description: 'Sog bis fast zum Punkt, dann der Rücksprung.',
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
  return SHIP_SHAPES.find((shape) => shape.id === id) ?? SHIP_SHAPES[0]!;
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
