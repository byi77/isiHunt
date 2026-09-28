/**
 * Weltaura des Schiffs - nur Darstellung, keine Spielregeln.
 *
 * Warum eigene Ebene neben der gekauften Aura: Bis zu dieser Fassung trug das
 * Schiff in jeder Welt denselben Schein, nur anders getoent. Die Welt soll
 * am Schiff selbst spuerbar werden - Eiskristalle im Eisring, Glutzungen im
 * Glutnebel. Gekaufte Auren und Farben bleiben unberuehrt, die Weltaura legt
 * sich zusaetzlich darum. Im Duell tragen beide Spieler dieselbe Weltaura,
 * der Vergleich bleibt also fair.
 *
 * Grenzen: Elemente bleiben ausserhalb des Rumpfs und innerhalb von
 * `orbitRadius` + 30 px, damit der Fangradius lesbar bleibt. Die Spur
 * erzeugt hoechstens `wakeMax` Teilchen gleichzeitig.
 */

export interface WorldShipAuraDef {
  /** Farbe von Triebwerksflamme und Duese. */
  readonly engine: number;
  /** Hauptfarbe der Aura-Elemente. */
  readonly primary: number;
  /** Zweitfarbe fuer Akzente. */
  readonly secondary: number;
  /** Anzahl umlaufender Elemente. */
  readonly orbiters: number;
  /** Abstand der Elemente zum Schiffsmittelpunkt in Spielpixeln. */
  readonly orbitRadius: number;
  /** Umlaeufe je Sekunde (Bogenmass); negativ = gegen den Uhrzeigersinn. */
  readonly orbitSpeed: number;
  /** Deckkraft der Elemente am hellsten Punkt. */
  readonly alpha: number;
  /** Spurteilchen je Sekunde bei voller Fahrt. */
  readonly wakeRate: number;
  /** Lebensdauer eines Spurteilchens in Sekunden. */
  readonly wakeLife: number;
}

export const WORLD_SHIP_AURA: readonly WorldShipAuraDef[] = [
  // Sternenweide: drei Lichtpollen kreisen ruhig, gruene Pollen bleiben zurueck.
  {
    engine: 0x86efac,
    primary: 0xbbf7d0,
    secondary: 0xfef9c3,
    orbiters: 3,
    orbitRadius: 62,
    orbitSpeed: 1.1,
    alpha: 0.8,
    wakeRate: 18,
    wakeLife: 1.2,
  },
  // Eisring: sechs Kristalle auf gekippter Bahn, Schneeflocken als Spur.
  {
    engine: 0xbae6fd,
    primary: 0xe0f2fe,
    secondary: 0x7dd3fc,
    orbiters: 6,
    orbitRadius: 66,
    orbitSpeed: 0.9,
    alpha: 0.85,
    wakeRate: 16,
    wakeLife: 1.4,
  },
  // Glutnebel: Glutzungen lodern um das Schiff, Funken steigen auf.
  {
    engine: 0xfb923c,
    primary: 0xfdba74,
    secondary: 0xfde047,
    orbiters: 10,
    orbitRadius: 48,
    orbitSpeed: 0,
    alpha: 0.9,
    wakeRate: 30,
    wakeLife: 0.9,
  },
  // Nullsektor: dunkler Ring, Teilchen werden ins Schiff gezogen.
  {
    engine: 0xc084fc,
    primary: 0xc084fc,
    secondary: 0x1e0536,
    orbiters: 8,
    orbitRadius: 74,
    orbitSpeed: -1.6,
    alpha: 0.8,
    wakeRate: 20,
    wakeLife: 1,
  },
  // Sonnenkrone: drehende Krone um den Rumpf, goldene Funken.
  {
    engine: 0xfde68a,
    primary: 0xfde68a,
    secondary: 0xfbbf24,
    orbiters: 0,
    orbitRadius: 64,
    orbitSpeed: 0.5,
    alpha: 0.5,
    wakeRate: 22,
    wakeLife: 0.8,
  },
  // Mondschmiede: zwei Monde kreisen mit Tiefe, Staub taumelt nach.
  {
    engine: 0xa5b4fc,
    primary: 0xc7d2fe,
    secondary: 0x64748b,
    orbiters: 2,
    orbitRadius: 70,
    orbitSpeed: 1.3,
    alpha: 0.9,
    wakeRate: 10,
    wakeLife: 1.6,
  },
  // Kristallbruch: vier Splitter rasen nach aussen zeigend um das Schiff.
  {
    engine: 0x67e8f9,
    primary: 0xa5f3fc,
    secondary: 0xf0abfc,
    orbiters: 4,
    orbitRadius: 60,
    orbitSpeed: 2.6,
    alpha: 0.85,
    wakeRate: 20,
    wakeLife: 0.6,
  },
  // Sturmgrenze: zuckende Blitzboegen, Funkenschlag als Spur.
  {
    engine: 0xf0abfc,
    primary: 0xf5d0fe,
    secondary: 0xffffff,
    orbiters: 3,
    orbitRadius: 58,
    orbitSpeed: 0,
    alpha: 0.9,
    wakeRate: 24,
    wakeLife: 0.45,
  },
  // Lichtkern: Lichtwellen laufen vom Schiff aus, heller Kern.
  {
    engine: 0xfff7ed,
    primary: 0xfbbf24,
    secondary: 0xfff7ed,
    orbiters: 3,
    orbitRadius: 80,
    orbitSpeed: 0,
    alpha: 0.4,
    wakeRate: 18,
    wakeLife: 1,
  },
  // Horizonttor: kleines Tor dreht sich um das Schiff, Sprungstreifen dahinter.
  {
    engine: 0x93c5fd,
    primary: 0xc4b5fd,
    secondary: 0x93c5fd,
    orbiters: 0,
    orbitRadius: 66,
    orbitSpeed: 0.8,
    alpha: 0.55,
    wakeRate: 26,
    wakeLife: 0.5,
  },
];

/** Gemeinsame Grenzen aller Weltauren. */
export const SHIP_AURA_LIMITS = {
  /** Hoechstzahl gleichzeitiger Spurteilchen. */
  wakeMax: 40,
  /** Unterhalb dieses Tempoanteils (0..1) entsteht keine Spur. */
  wakeMinThrust: 0.12,
  /** Abstand zwischen zwei Lichtwellen bzw. Blitzboegen. */
  pulseMs: 1_300,
  arcMs: 90,
} as const;

export function worldShipAura(variant: number): WorldShipAuraDef {
  return WORLD_SHIP_AURA[variant] ?? WORLD_SHIP_AURA[0]!;
}
