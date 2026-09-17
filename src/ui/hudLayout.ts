/** CSS-sized HUD, converted back to Phaser's logical coordinates. */
export function calculateHudLayout(width: number, height: number, rows = 0, bottomInset = 0) {
  const unit = 720 / Math.max(1, width);
  const margin = 14;
  const column = (width - margin * 2) / 3;
  return {
    unit,
    margin: margin * unit,
    width: (width - margin * 2) * unit,
    columnWidth: (column - 10) * unit,
    scoreX: (margin + column / 2) * unit,
    timeX: (width / 2) * unit,
    comboX: (width - margin - column / 2) * unit,
    headerHeight: (80 + rows * 17) * unit,
    rowY: (index: number) => (83 + index * 17) * unit,
    pauseSize: 44 * unit,
    pauseX: (width - margin - 22) * unit,
    pauseY: (height - Math.max(12, bottomInset + 8) - 22) * unit,
    font: (pixels: number) => Math.round(pixels * unit),
  };
}
