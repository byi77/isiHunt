/**
 * Visuelle Konstanten der Oberflaeche.
 *
 * Alles, was mit "wie sieht UI aus" zu tun hat, steht hier - Scenes definieren
 * keine eigenen Farben oder Schriftgroessen. Siehe docs/ART_STYLE.md.
 */

export const Palette = {
  /** Dunkler Grundton unter allen Welten. */
  backdrop: 0x0b1020,
  /** Panel-Hintergrund fuer Menue und Ergebnis. */
  panel: 0x13212c,
  panelBorder: 0x344753,
  buttonSurface: 0x172734,
  buttonHover: 0x213847,
  buttonInk: '#15202a',
  buttonInkHex: 0x15202a,
  ink: '#f4f1e8',
  inkDim: '#b8c0d9',
  inkDimHex: 0xb8c0d9,
  gold: '#ffd479',
  goldHex: 0xffd479,
  danger: '#ff6b6b',
  dangerHex: 0xff6b6b,
  success: '#7ee787',
  /**
   * Bremsfeld: kaltes Stahlgrau. Weder Blau (selten) noch Grau (schlicht) -
   * die Form traegt die Unterscheidung, die Farbe nur die Warnung.
   */
  obstacleBrakeHex: 0xa9bfd6,
  /** Zeitstrafe: dieselbe Warnfarbe wie die kritische Restzeit im HUD. */
  obstaclePenaltyHex: 0xff6b6b,
  /** Hinderniskoerper: nah am Grundton, damit er vor jeder Welt als Schatten absteht. */
  obstacleBody: 0x0a0e18,
  /** Abzeichen: dieselben Metalltoene wie der fruehere Pokal der Erfolgsseite. */
  medalPrimary: 0xf0b52f,
  medalShade: 0xb87316,
  medalLight: 0xfff0a0,
  medalLocked: 0x69738d,
  medalLockedShade: 0x4b556d,
  medalLockedLight: 0xaeb6c7,
  medalCore: 0x13212c,
  medalShadow: 0x050817,
  daily: '#46d7c3',
  dailyHex: 0x46d7c3,
  achievementHex: 0xc084fc,
} as const;

/**
 * Schriftfamilie: bewusst System-Fonts. Keine Webfont-Ladezeit, kein
 * Layoutsprung, funktioniert offline. Ersetzbar in M4 (docs/ROADMAP.md).
 */
export const FONT_FAMILY = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";

export const FontSize = {
  title: 68,
  heading: 40,
  large: 34,
  body: 26,
  small: 21,
  tiny: 17,
} as const;

/** Basis-Textstil - Scenes ergaenzen nur, was abweicht. */
export function textStyle(
  size: number,
  color: string = Palette.ink,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    ...extra,
  };
}

/** Wandelt eine Phaser-Zahl-Farbe in einen CSS-Hexstring (fuer Text). */
export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
