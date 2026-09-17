import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { CollectionEffects } from './CollectionEffects';
import { RARITIES } from '@/config/rarities';
import { COLLECTION_VISUALS } from '@/config/collectionVisuals';

vi.mock('@/systems/AccessibilitySystem', () => ({
  prefersReducedMotion: () => true,
  rarityMarker: () => '★',
}));

it('caps burst allocations, expires quiet effects, and releases its mask', () => {
  let liveLabels = 0;
  const mask = { destroy: vi.fn() };
  const graphic = () => {
    const methods: Record<string, unknown> = { createGeometryMask: () => mask };
    const chain: Record<string, unknown> = new Proxy(methods, {
      get: (target, key: string) => target[key] ?? (() => chain),
    });
    return chain;
  };
  const graphics = vi.fn(graphic);
  const scene = {
    game: { canvas: { getBoundingClientRect: () => ({ width: 390 }) } },
    add: {
      graphics,
      text: () => {
        liveLabels++;
        let destroyed = false;
        const label = {
          width: 140,
          height: 32,
          setDepth: () => label,
          setWordWrapWidth: () => label,
          setPosition: () => label,
          setAlpha: () => label,
          setVisible: () => label,
          destroy: () => {
            if (!destroyed) liveLabels--;
            destroyed = true;
          },
        };
        return label;
      },
    },
  } as unknown as Phaser.Scene;
  const effects = new CollectionEffects(
    scene,
    () => ({ x: 360, y: 600 }),
    () => ({ left: 10, top: 200, right: 710, bottom: 1100 }),
  );
  for (let i = 0; i < 50; i++) effects.add({ x: 300, y: 500 }, RARITIES[i % 6]!, 100);
  expect(liveLabels).toBe(COLLECTION_VISUALS.maxActive);
  expect(graphics).toHaveBeenCalledTimes(2);
  effects.update(COLLECTION_VISUALS.lifetimeMs);
  expect(liveLabels).toBe(0);
  effects.add({ x: 300, y: 500 }, RARITIES[5]!, 1000);
  effects.destroy();
  expect(liveLabels).toBe(0);
  expect(mask.destroy).toHaveBeenCalledOnce();
});
