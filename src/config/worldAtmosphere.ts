/**
 * Bewegte Weltstimmung im Spielfeld - nur Darstellung, keine Spielregeln.
 *
 * Warum eigene Tabelle: Bis zu dieser Fassung teilten alle zehn Welten
 * denselben tiefblauen Grundverlauf, dieselben Sterne und dieselbe Drift. Sie
 * unterschieden sich nur in der Nebeltoenung und feinen Randlinien - im Run
 * sahen Welt 1 und Welt 10 fast gleich aus. Jede Welt bekommt deshalb eine
 * eigene Grundfarbe, eine eigene Sternfarbe und ein eigenes Bewegungsmotiv.
 *
 * Grenzen fuer jedes Motiv: klein, gedaempft und ohne harte Leuchtpunkte in
 * Reliktgroesse, damit Kulisse nie mit Relikten oder Hindernissen verwechselt
 * wird. Die Anzahl bewegter Teile bleibt je Welt unter `maxParticles`.
 */

export type AtmosphereMotif =
  | 'pollen'
  | 'snow'
  | 'embers'
  | 'void'
  | 'corona'
  | 'orbits'
  | 'shards'
  | 'storm'
  | 'pulse'
  | 'warp';

export interface WorldAtmosphereDef {
  readonly motif: AtmosphereMotif;
  /** Anteil der Weltfarbe `bgTop`/`bgBottom` im Grundverlauf; 0 = neutrales Tiefblau. */
  readonly tintMix: number;
  /** Farbe der drei Sternlagen. */
  readonly starTint: number;
  /** Hauptfarbe des Motivs. */
  readonly primary: number;
  /** Zweitfarbe fuer Akzente im Motiv. */
  readonly secondary: number;
  /** Anzahl bewegter Teilchen des Motivs. */
  readonly particles: number;
  /** Deckkraft der Teilchen am hellsten Punkt. */
  readonly alpha: number;
  /** Tempo in Spielpixeln je Sekunde. */
  readonly speed: number;
}

export const WORLD_ATMOSPHERE: readonly WorldAtmosphereDef[] = [
  // Sternenweide: Lichtpollen steigen langsam, zwei Lichtstroeme wiegen sich.
  {
    motif: 'pollen',
    tintMix: 0.55,
    starTint: 0xd9f7e4,
    primary: 0x86efac,
    secondary: 0xfef9c3,
    particles: 34,
    alpha: 0.55,
    speed: 18,
  },
  // Eisring: Eiskristalle fallen und drehen sich, gelegentlich blitzt ein Glanz.
  {
    motif: 'snow',
    tintMix: 0.6,
    starTint: 0xe0f2fe,
    primary: 0xe0f2fe,
    secondary: 0x7dd3fc,
    particles: 40,
    alpha: 0.5,
    speed: 34,
  },
  // Glutnebel: Glutfunken steigen flackernd, Hitzeschlieren ziehen quer.
  {
    motif: 'embers',
    tintMix: 0.7,
    starTint: 0xffd8b0,
    primary: 0xfb923c,
    secondary: 0xfde047,
    particles: 44,
    alpha: 0.85,
    speed: 46,
  },
  // Nullsektor: Staub wird spiralfoermig in einen Riss gezogen, Sterne fallen aus.
  {
    motif: 'void',
    tintMix: 0.65,
    starTint: 0xe9d5ff,
    primary: 0xc084fc,
    secondary: 0x0b0214,
    particles: 40,
    alpha: 0.75,
    speed: 30,
  },
  // Sonnenkrone: Strahlenkranz dreht sich von oben, goldener Staub sinkt.
  {
    motif: 'corona',
    tintMix: 0.7,
    starTint: 0xfff1c2,
    primary: 0xfde68a,
    secondary: 0xfbbf24,
    particles: 30,
    alpha: 0.5,
    speed: 16,
  },
  // Mondschmiede: Monde kreisen, Truemmer taumeln in gebogenen Bahnen.
  {
    motif: 'orbits',
    tintMix: 0.6,
    starTint: 0xc7d2fe,
    primary: 0xa5b4fc,
    secondary: 0x475569,
    particles: 18,
    alpha: 0.55,
    speed: 22,
  },
  // Kristallbruch: Splitter rasen diagonal durchs Bild und brechen Licht.
  {
    motif: 'shards',
    tintMix: 0.6,
    starTint: 0xcffafe,
    primary: 0x67e8f9,
    secondary: 0xf0abfc,
    particles: 22,
    alpha: 0.5,
    speed: 360,
  },
  // Sturmgrenze: Windschlieren, ferne Blitze und kurzes Wetterleuchten.
  {
    motif: 'storm',
    tintMix: 0.65,
    starTint: 0xf5d0fe,
    primary: 0xf0abfc,
    secondary: 0xffffff,
    particles: 30,
    alpha: 0.4,
    speed: 520,
  },
  // Lichtkern: Lichtwellen laufen vom Kern aus, Staub stroemt zum Kern.
  {
    motif: 'pulse',
    tintMix: 0.7,
    starTint: 0xffedd5,
    primary: 0xfbbf24,
    secondary: 0xfff7ed,
    particles: 32,
    alpha: 0.6,
    speed: 60,
  },
  // Horizonttor: Sterne ziehen als Lichtstreifen nach aussen, das Tor dreht sich.
  {
    motif: 'warp',
    tintMix: 0.6,
    starTint: 0xddd6fe,
    primary: 0xc4b5fd,
    secondary: 0x93c5fd,
    particles: 46,
    alpha: 0.35,
    speed: 240,
  },
];

/** Gemeinsame Budgets und Zeitkonstanten der Motive. */
export const ATMOSPHERE_TIMING = {
  /** Obergrenze aller bewegten Teilchen je Welt - Handy-Budget. */
  maxParticles: 48,
  /** Dauer eines Atemzugs der langsamen Flaechen (Lichtstrom, Kranz, Tor). */
  breathMs: 7_000,
  /** Drehung des Strahlenkranzes bzw. Tors je Sekunde (Bogenmass). */
  spinPerSecond: 0.05,
  /** Abstand zwischen zwei Blitzen: fest plus Zufallsanteil. */
  lightningMinMs: 3_800,
  lightningJitterMs: 4_200,
  /** Sichtdauer eines Blitzes. */
  lightningMs: 420,
  /** Hoechste Deckkraft des Wetterleuchtens ueber dem ganzen Feld. */
  lightningFlashAlpha: 0.1,
  /** Abstand zwischen zwei Lichtwellen im Lichtkern. */
  pulseMs: 3_200,
  /** Wie lange ein Stern im Nullsektor ausgeblendet bleibt. */
  voidBlinkMs: 1_400,
  /** Abstand zwischen zwei Eisglanzen. */
  glintMs: 1_700,
} as const;

export function worldAtmosphere(variant: number): WorldAtmosphereDef {
  return WORLD_ATMOSPHERE[variant] ?? WORLD_ATMOSPHERE[0]!;
}
