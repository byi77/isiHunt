import { describe, expect, it } from 'vitest';
import { boxesOverlap, collectionLabelBox, collectionPoint } from './collectionMotion';

describe('collection paths and label safety', () => {
  const bounds = { left: 20, top: 180, right: 700, bottom: 1100 };
  it('preserves both endpoints, including overshooting progress', () => {
    const start = { x: 40, y: 70 },
      end = { x: 220, y: 400 };
    expect(collectionPoint(start, end, -1, 46)).toEqual(start);
    expect(collectionPoint(start, end, 2, 46)).toEqual(end);
    expect(collectionPoint(start, end, 0.5, 46)).not.toEqual({ x: 130, y: 235 });
  });
  it('handles a capture directly on the ship without NaN', () => {
    expect(collectionPoint({ x: 40, y: 70 }, { x: 40, y: 70 }, 0.5, 46)).toEqual({ x: 40, y: 70 });
  });
  it('keeps edge labels inside the usable area', () => {
    for (const origin of [
      { x: 0, y: 0 },
      { x: 720, y: 1280 },
    ]) {
      const box = collectionLabelBox(origin, 180, 70, bounds, [])!;
      expect(box.left).toBeGreaterThanOrEqual(bounds.left);
      expect(box.top).toBeGreaterThanOrEqual(bounds.top);
      expect(box.right).toBeLessThanOrEqual(bounds.right);
      expect(box.bottom).toBeLessThanOrEqual(bounds.bottom);
    }
  });
  it('avoids the ship and previously placed labels', () => {
    const occupied = [{ left: 302, right: 418, top: 500, bottom: 616 }];
    for (let i = 0; i < 4; i++) {
      const box = collectionLabelBox({ x: 360, y: 558 }, 150, 40, bounds, occupied)!;
      expect(box).not.toBeNull();
      expect(occupied.some((other) => boxesOverlap(box, other))).toBe(false);
      occupied.push(box);
    }
  });
  it('omits a label when no safe place remains', () => {
    expect(collectionLabelBox({ x: 360, y: 500 }, 180, 70, bounds, [bounds])).toBeNull();
    expect(collectionLabelBox({ x: 360, y: 500 }, 800, 70, bounds, [])).toBeNull();
  });
});
