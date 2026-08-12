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
  panel: 0x101733,
  ink: '#f4f1e8',
  inkDim: '#9aa3bd',
  gold: '#ffd479',
  goldHex: 0xffd479,
  danger: '#ff6b6b',
  success: '#7ee787',
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
