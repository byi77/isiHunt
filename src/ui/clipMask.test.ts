import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { ClipMask } from './clipMask';

function fixture() {
  const listeners = new Map<string, () => void>();
  const shape = {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    destroy: vi.fn(),
  };
  shape.clear.mockReturnValue(shape);
  shape.fillStyle.mockReturnValue(shape);
  shape.fillRect.mockReturnValue(shape);
  const filter = { autoUpdate: true, needsUpdate: false, destroy: vi.fn() };
  const camera = {
    dirty: false,
    shakeEffect: { isRunning: false },
    panEffect: { isRunning: false },
    zoomEffect: { isRunning: false },
    rotateToEffect: { isRunning: false },
  };
  const canvas = { width: 720, height: 1280 };
  const scene = {
    game: { canvas },
    cameras: { main: camera },
    events: {
      on: vi.fn((event: string, fn: () => void) => listeners.set(event, fn)),
      off: vi.fn((event: string) => listeners.delete(event)),
    },
    make: { graphics: () => shape },
  } as unknown as Phaser.Scene;
  const target = {
    enableFilters: vi.fn(),
    filters: { external: { addMask: () => filter } },
  } as unknown as Phaser.GameObjects.Graphics;
  const render = () => listeners.get('prerender')?.();
  return { scene, target, shape, filter, camera, canvas, render };
}

describe('ClipMask', () => {
  it('retains automatic rendering for scrolling UI masks', () => {
    const f = fixture();
    const mask = new ClipMask(f.scene, f.target);
    mask.set({ x: 0, y: 200, width: 720, height: 800 });
    expect(f.filter.autoUpdate).toBe(true);
    expect(f.scene.events.on).not.toHaveBeenCalled();
    mask.destroy();
  });

  it('refreshes a stationary mask only when its rectangle changes', () => {
    const f = fixture();
    const mask = new ClipMask(f.scene, f.target, true);
    expect(f.filter.autoUpdate).toBe(false);
    const rect = { x: 0, y: 200, width: 720, height: 800 };
    mask.set(rect);
    f.filter.needsUpdate = false;
    mask.set({ ...rect });
    f.render();
    expect(f.shape.fillRect).toHaveBeenCalledTimes(1);
    expect(f.filter.needsUpdate).toBe(false);
    mask.set({ ...rect, height: 900 });
    expect(f.filter.needsUpdate).toBe(true);
    expect(f.shape.fillRect).toHaveBeenCalledTimes(2);
    mask.destroy();
    expect(f.scene.events.off).toHaveBeenCalledWith('prerender', expect.any(Function));
  });

  it('refreshes during camera motion, after its final frame, and after resize', () => {
    const f = fixture();
    const mask = new ClipMask(f.scene, f.target, true);
    f.filter.needsUpdate = false;
    f.camera.shakeEffect.isRunning = true;
    f.render();
    expect(f.filter.needsUpdate).toBe(true);
    f.filter.needsUpdate = false;
    f.camera.shakeEffect.isRunning = false;
    f.render();
    expect(f.filter.needsUpdate).toBe(true);
    f.filter.needsUpdate = false;
    f.render();
    expect(f.filter.needsUpdate).toBe(false);
    f.canvas.height = 1500;
    f.render();
    expect(f.filter.needsUpdate).toBe(true);
    f.filter.needsUpdate = false;
    f.camera.dirty = true;
    f.render();
    expect(f.filter.needsUpdate).toBe(true);
    mask.destroy();
  });
});
