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
  /** Erschwernis fuer Spawn-Dichte und Sichtfenster. */
  readonly difficultyScale: number;
  /** Punktebonus als Gegenleistung fuer die Erschwernis. */
  readonly scoreMultiplier: number;
  /** XP wachsen flacher als Punkte, damit das Endgame nicht davonrast. */
  readonly xpMultiplier: number;
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
    difficultyScale: 1,
    scoreMultiplier: 1,
    xpMultiplier: 1,
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
    difficultyScale: 1,
    scoreMultiplier: 1.04,
    xpMultiplier: 1.02,
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
    difficultyScale: 1,
    scoreMultiplier: 1.08,
    xpMultiplier: 1.04,
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
    difficultyScale: 1,
    scoreMultiplier: 1.12,
    xpMultiplier: 1.06,
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
    difficultyScale: 1,
    scoreMultiplier: 1.16,
    xpMultiplier: 1.08,
  },
  {
    id: 'mondschmiede',
    name: 'Mondschmiede',
    unlockLevel: 22,
    bgTop: 0x172554,
    bgBottom: 0x080f2e,
    accent: 0x818cf8,
    spaceVariant: 5,
    flavor: 'Schwere Monde ziehen jede Bewegung aus ihrer geraden Bahn.',
    plannedModifier: 'Mehr Trägheit und deutlichere Hindernisse.',
    modifier: 'inertia',
    obstacleMode: 'penalty',
    difficultyScale: 1.12,
    scoreMultiplier: 1.2,
    xpMultiplier: 1.11,
  },
  {
    id: 'kristallbruch',
    name: 'Kristallbruch',
    unlockLevel: 30,
    bgTop: 0x164e63,
    bgBottom: 0x082f49,
    accent: 0x22d3ee,
    spaceVariant: 6,
    flavor: 'Splitter rasen durch die Bahn und lassen Relikte schneller verblassen.',
    plannedModifier: 'Kürzere Sichtfenster und mehr Hindernisse.',
    modifier: 'short_lived',
    obstacleMode: 'penalty',
    difficultyScale: 1.25,
    scoreMultiplier: 1.26,
    xpMultiplier: 1.15,
  },
  {
    id: 'sturmgrenze',
    name: 'Sturmgrenze',
    unlockLevel: 40,
    bgTop: 0x3b0764,
    bgBottom: 0x160b2b,
    accent: 0xe879f9,
    spaceVariant: 7,
    flavor: 'Im kosmischen Sturm wechseln Sichtbarkeit und Richtung ständig.',
    plannedModifier: 'Blinkende Relikte, starke Trägheit und harte Hindernisse.',
    modifier: 'blink',
    obstacleMode: 'penalty',
    difficultyScale: 1.4,
    scoreMultiplier: 1.33,
    xpMultiplier: 1.19,
  },
  {
    id: 'lichtkern',
    name: 'Lichtkern',
    unlockLevel: 55,
    bgTop: 0x713f12,
    bgBottom: 0x271100,
    accent: 0xfbbf24,
    spaceVariant: 8,
    flavor: 'Der Kern leuchtet hell – seltene Relikte sind hier besonders wertvoll.',
    plannedModifier: 'Sehr schnelle Relikte, viele Hindernisse, bessere Beute.',
    modifier: 'rare_bonus',
    obstacleMode: 'penalty',
    difficultyScale: 1.55,
    scoreMultiplier: 1.39,
    xpMultiplier: 1.22,
  },
  {
    id: 'horizonttor',
    name: 'Horizonttor',
    unlockLevel: 75,
    bgTop: 0x312e81,
    bgBottom: 0x110b39,
    accent: 0xa78bfa,
    spaceVariant: 9,
    flavor: 'Hinter dem letzten Tor wartet die dichteste und schnellste Jagd.',
    plannedModifier: 'Maximale Geschwindigkeit und die höchste Belohnung.',
    modifier: 'short_lived',
    obstacleMode: 'penalty',
    difficultyScale: 1.7,
    scoreMultiplier: 1.45,
    xpMultiplier: 1.25,
  },
];

export const DEFAULT_WORLD_ID = WORLDS[0]!.id;

export function getWorld(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0]!;
}

export function unlockedWorlds(level: number): readonly WorldDef[] {
  return WORLDS.filter((w) => w.unlockLevel <= level);
}
