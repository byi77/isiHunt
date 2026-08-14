/**
 * Welten = Raumzonen. Jede Welt hat eine eigene Farbstimmung und wird ueber das
 * Charakterlevel freigeschaltet - analog zu neuen Gebieten in einem MMO.
 *
 * Jede Welt hat neben der Farbstimmung eine kleine, klar lesbare Regel. Die
 * technischen Werte liegen direkt an der Welt, der Text bleibt bewusst
 * kindgerecht und sichtbar im Menue.
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
  /** Index fuer die feste Stern-/Nebel-/Planetenkomposition der Zone. */
  readonly spaceVariant: number;
  /** Kurzer Stimmungstext fuers Menue. */
  readonly flavor: string;
  /** Kindgerechte Beschreibung der mechanischen Besonderheit. */
  readonly plannedModifier: string;
  /** Technische Umsetzung des Weltmodifikators. */
  readonly modifier: 'none' | 'inertia' | 'short_lived' | 'blink' | 'rare_bonus';
  /** Hindernisse bremsen zuerst und bestrafen spaeter. */
  readonly obstacleMode: 'none' | 'brake' | 'penalty';
}

export const WORLDS: readonly WorldDef[] = [
  {
    id: 'silberhain',
    name: 'Sternenweide',
    unlockLevel: 1,
    bgTop: 0x123021,
    bgBottom: 0x061410,
    accent: 0x4ade80,
    spaceVariant: 0,
    flavor: 'Ruhige Nebelbahnen mit jungen Sternen und sanften Lichtströmen.',
    plannedModifier: 'Keine - die Lernzone.',
    modifier: 'none',
    obstacleMode: 'none',
  },
  {
    id: 'frostzinne',
    name: 'Eisring',
    unlockLevel: 3,
    bgTop: 0x11294d,
    bgBottom: 0x050d1c,
    accent: 0x7dd3fc,
    spaceVariant: 1,
    flavor: 'Ein Planet aus Eis, umkreist von splittrigen Kristallringen.',
    plannedModifier: 'Planeten driften weiter - Bewegung mit Trägheit.',
    modifier: 'inertia',
    obstacleMode: 'brake',
  },
  {
    id: 'glutmark',
    name: 'Glutnebel',
    unlockLevel: 6,
    bgTop: 0x431407,
    bgBottom: 0x1a0703,
    accent: 0xfb923c,
    spaceVariant: 2,
    flavor: 'Heisse Gaswolken, in denen jeder Kurs zum Wettlauf wird.',
    plannedModifier: 'Planeten verglühen schneller - kürzere Zeitfenster.',
    modifier: 'short_lived',
    obstacleMode: 'brake',
  },
  {
    id: '__LEERENBLÜTE__',
    name: 'Nullsektor',
    unlockLevel: 10,
    bgTop: 0x2e1065,
    bgBottom: 0x0f0524,
    accent: 0xc084fc,
    spaceVariant: 3,
    flavor: 'Ein stiller Raumriss, in dem Sterne kurz aus der Sicht fallen.',
    plannedModifier: 'Planeten blinken kurz aus der Sichtbarkeit.',
    modifier: 'blink',
    obstacleMode: 'penalty',
  },
  {
    id: 'sonnenhort',
    name: 'Sonnenkrone',
    unlockLevel: 15,
    bgTop: 0x4a3308,
    bgBottom: 0x1a1103,
    accent: 0xfcd34d,
    spaceVariant: 4,
    flavor: 'Die leuchtende Krone eines Sterns - dort beginnt die nächste Reise.',
    plannedModifier: 'Doppelte Chance auf seltene Planeten, halbe Lebensdauer.',
    modifier: 'rare_bonus',
    obstacleMode: 'penalty',
  },
];

export const DEFAULT_WORLD_ID = WORLDS[0]!.id;

export function getWorld(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0]!;
}

export function unlockedWorlds(level: number): readonly WorldDef[] {
  return WORLDS.filter((w) => w.unlockLevel <= level);
}
