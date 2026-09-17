export interface Point {
  x: number;
  y: number;
}
export interface EffectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Quadratic path with a bounded sideways bend; both endpoints remain exact. */
export function collectionPoint(start: Point, end: Point, progress: number, bend: number): Point {
  const t = Math.max(0, Math.min(1, progress));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const arc = 2 * (1 - t) * t * bend;
  return { x: start.x + dx * t - (dy / length) * arc, y: start.y + dy * t + (dx / length) * arc };
}

export function boxesOverlap(a: EffectBox, b: EffectBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Keep labels away from the HUD, ship, footer and other capture labels. */
export function collectionLabelBox(
  origin: Point,
  width: number,
  height: number,
  bounds: EffectBox,
  occupied: readonly EffectBox[],
): EffectBox | null {
  if (width > bounds.right - bounds.left || height > bounds.bottom - bounds.top) return null;
  for (const dy of [-height - 26, 36, -height * 2 - 40, height + 48]) {
    for (const dx of [0, -width - 12, width + 12]) {
      const left = Math.max(bounds.left, Math.min(bounds.right - width, origin.x + dx - width / 2));
      const top = Math.max(bounds.top, Math.min(bounds.bottom - height, origin.y + dy));
      const box = { left, top, right: left + width, bottom: top + height };
      if (!occupied.some((other) => boxesOverlap(box, other))) return box;
    }
  }
  return null;
}
