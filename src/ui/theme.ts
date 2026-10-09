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
  panel: 0x090e20,
  panelBorder: 0x69738d,
  buttonSurface: 0x202b48,
  buttonHover: 0x2c3b60,
  buttonInk: '#eef2ff',
  buttonInkHex: 0xeef2ff,
  ink: '#eef2ff',
  inkDim: '#d1d8ef',
  inkDimHex: 0xd1d8ef,
  gold: '#ffe59b',
  goldHex: 0xffe59b,
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
  medalCore: 0x090e20,
  medalShadow: 0x050817,
  daily: '#46d7c3',
  dailyHex: 0x46d7c3,
  achievementHex: 0xc084fc,
} as const;

/**
 * Schriftfamilie: bewusst System-Fonts. Keine Webfont-Ladezeit, kein
 * Layoutsprung, funktioniert offline. Ersetzbar in M4 (docs/ROADMAP.md).
 */
export const FONT_FAMILY = 'system-ui, sans-serif';

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
  color: string = size >= FontSize.heading ? Palette.gold : Palette.ink,
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

/** Shared measurements are in CSS pixels; canvas widgets convert them at creation. */
export const InterfaceStyle = {
  cardRadius: 16,
  buttonRadius: 10,
  cardAlpha: 0.82,
  borderWidth: 1,
  minTouchSize: 44,
  bodySize: 14,
  headingSize: 16,
  hintSize: 12,
  spacing: 12,
  padding: 16,
} as const;

export function canvasUiPixels(
  cssPixels: number,
  canvasWidth: number,
  logicalWidth: number,
): number {
  return (cssPixels * logicalWidth) / canvasWidth;
}

/** Export the same values to native controls instead of maintaining another palette. */
export function installUiTheme(root: HTMLElement): void {
  const cardChannels = [16, 8, 0].map((shift) => (Palette.panel >> shift) & 255).join(', ');
  const headingChannels = [16, 8, 0].map((shift) => (Palette.goldHex >> shift) & 255).join(', ');
  const tokens: Record<string, string> = {
    font: FONT_FAMILY,
    ink: Palette.ink,
    muted: Palette.inkDim,
    heading: Palette.gold,
    'heading-soft': `rgba(${headingChannels}, .33)`,
    'heading-glow': `rgba(${headingChannels}, .4)`,
    'heading-faint': `rgba(${headingChannels}, .2)`,
    surface: toCss(Palette.panel),
    card: `rgba(${cardChannels}, ${InterfaceStyle.cardAlpha})`,
    button: toCss(Palette.buttonSurface),
    'button-hover': toCss(Palette.buttonHover),
    border: toCss(Palette.panelBorder),
    success: Palette.success,
    danger: Palette.danger,
    'card-radius': `${InterfaceStyle.cardRadius}px`,
    'button-radius': `${InterfaceStyle.buttonRadius}px`,
    'border-width': `${InterfaceStyle.borderWidth}px`,
    'touch-size': `${InterfaceStyle.minTouchSize}px`,
    'body-size': `${InterfaceStyle.bodySize}px`,
    'heading-size': `${InterfaceStyle.headingSize}px`,
    'hint-size': `${InterfaceStyle.hintSize}px`,
    gap: `${InterfaceStyle.spacing}px`,
    padding: `${InterfaceStyle.padding}px`,
  };
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(`--ui-${name}`, value);
}
