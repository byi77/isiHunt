/**
 * Welten = Zonen. Jede Welt hat eine eigene Farbstimmung und wird ueber das
 * Charakterlevel freigeschaltet - analog zu neuen Gebieten in einem MMO.
 *
 * Mechanisch sind die Welten in v0.1 identisch (bewusst: erst Feel, dann
 * Varianz). Der `modifier`-Text ist die geplante Besonderheit je Welt, siehe
 * docs/ROADMAP.md, Meilenstein M3.
 */

export interface WorldDef {
  readonly id: string;
  readonly name: string;
  /** Charakterlevel, ab dem die Welt spielbar ist. */
  readonly unlockLevel: number;
  /** Hintergrundverlauf oben / unten. */
  readonly bgTop: number;
  readonly bgBottom: number;
  /** Leitfarbe fuer HUD-Akzente, Figur-Aura und Schwebepartikel. */
  readonly accent: number;
  /** Kurzer Stimmungstext fuers Menue. */
  readonly flavor: string;
  /** Geplante mechanische Besonderheit (noch nicht implementiert). */
  readonly plannedModifier: string;
}

export const WORLDS: readonly WorldDef[] = [
  {
    id: 'silberhain',
    name: 'Silberhain',
    unlockLevel: 1,
    bgTop: 0x123021,
    bgBottom: 0x061410,
    accent: 0x4ade80,
    flavor: 'Ein stiller Wald, in dem die Blaetter von innen leuchten.',
    plannedModifier: 'Keine - die Lernwelt.',
  },
  {
    id: 'frostzinne',
    name: 'Frostzinne',
    unlockLevel: 3,
    bgTop: 0x11294d,
    bgBottom: 0x050d1c,
    accent: 0x7dd3fc,
    flavor: 'Gletscherhallen, in denen jeder Atemzug gefriert.',
    plannedModifier: 'Relikte gleiten weiter - Bewegung mit Traegheit.',
  },
  {
    id: 'glutmark',
    name: 'Glutmark',
    unlockLevel: 6,
    bgTop: 0x431407,
    bgBottom: 0x1a0703,
    accent: 0xfb923c,
    flavor: 'Verbrannte Ebenen unter einem Himmel aus Asche.',
    plannedModifier: 'Relikte verglühen schneller - kuerzere Zeitfenster.',
  },
  {
    id: 'leerenbluete',
    name: 'Leerenbluete',
    unlockLevel: 10,
    bgTop: 0x2e1065,
    bgBottom: 0x0f0524,
    accent: 0xc084fc,
    flavor: 'Zwischen den Welten wachsen Blueten aus purer Leere.',
    plannedModifier: 'Relikte blinken kurz aus der Sichtbarkeit.',
  },
  {
    id: 'sonnenhort',
    name: 'Sonnenhort',
    unlockLevel: 15,
    bgTop: 0x4a3308,
    bgBottom: 0x1a1103,
    accent: 0xfcd34d,
    flavor: 'Die Quelle allen Lichts. Hier endet die Jagd - oder beginnt neu.',
    plannedModifier: 'Doppelte Legendaer-Chance, halbierte Lebensdauer.',
  },
];

export const DEFAULT_WORLD_ID = WORLDS[0]!.id;

export function getWorld(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0]!;
}

export function unlockedWorlds(level: number): readonly WorldDef[] {
  return WORLDS.filter((w) => w.unlockLevel <= level);
}
