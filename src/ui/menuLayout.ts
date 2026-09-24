/** Bildschirm-Pixel zuerst: FIT darf die Touchflächen nicht unter 44 px drücken. */
export function calculateMenuLayout(
  canvasWidth: number,
  canvasHeight: number,
  bottomInset = 0,
  showInstallHint = false,
) {
  const compact = canvasHeight < 700;
  const scale = canvasWidth / 720;
  const unit = 1 / scale;
  const margin = compact ? 14 : 22;
  const gap = compact ? 6 : 10;
  const headerHeight = compact ? 54 : 76;
  const profileTop = headerHeight + 6;
  const profileHeight = compact ? 48 : 58;
  const rowHeight = compact ? 44 : 48;
  const primaryHeight = compact ? 48 : 56;
  const installHeight = showInstallHint ? (compact ? 32 : 40) : 0;
  const bottom = Math.max(compact ? 18 : 24, bottomInset + 12);
  const lastBottom = canvasHeight - bottom - (showInstallHint ? installHeight + gap : 0);
  const settingsY = lastBottom - rowHeight / 2;
  const tertiaryY = settingsY - rowHeight - gap;
  const secondaryY = tertiaryY - rowHeight - gap;
  const primaryY = secondaryY - rowHeight / 2 - gap - primaryHeight / 2;
  const worldTop = profileTop + profileHeight + gap;
  const worldBottom = primaryY - primaryHeight / 2 - gap;
  const worldTitleY = worldBottom - 40;
  const heroBottom = worldTitleY - 30;
  const heroHeight = Math.max(20, heroBottom - worldTop);
  // Der Planet bleibt Kulisse; das ausgeruestete Schiff ist der Vordergrund.
  // Beide Werte werden in CSS-Pixeln bestimmt, damit FIT die Hierarchie nicht
  // auf kleinen Geraeten umkehrt.
  const planetSize = Math.max(
    18,
    Math.min(compact ? 118 : 176, canvasWidth * 0.48, heroHeight * (compact ? 0.84 : 0.7)),
  );
  const planetY = worldTop + heroHeight * 0.46;
  const shipSize = Math.min(compact ? 82 : 108, planetSize * 0.62);
  const shipY = Math.min(heroBottom - shipSize * 0.95 - 4, planetY + planetSize * 0.3);
  const innerWidth = canvasWidth - margin * 2;

  // Alle Rückgabekoordinaten gehören wieder in Phasers logischen Raum.
  return {
    compact,
    unit,
    margin: margin * unit,
    innerWidth: innerWidth * unit,
    gap: gap * unit,
    headerHeight: headerHeight * unit,
    profileTop: profileTop * unit,
    profileHeight: profileHeight * unit,
    worldTop: worldTop * unit,
    worldBottom: worldBottom * unit,
    worldTitleY: worldTitleY * unit,
    worldSubtitleY: (worldBottom - 9) * unit,
    planetY: planetY * unit,
    planetSize: planetSize * unit,
    shipY: shipY * unit,
    shipSize: shipSize * unit,
    primaryY: primaryY * unit,
    primaryHeight: primaryHeight * unit,
    secondaryY: secondaryY * unit,
    tertiaryY: tertiaryY * unit,
    settingsY: settingsY * unit,
    rowHeight: rowHeight * unit,
    installY: (lastBottom + gap + installHeight / 2) * unit,
    installHeight: installHeight * unit,
    font: (cssPixels: number) => Math.round(cssPixels * unit),
  };
}

export type MenuLayout = ReturnType<typeof calculateMenuLayout>;
