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
          setOrigin: () => label,
          setPosition: () => label,
          setScale: () => label,
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

it('laesst eine gefangene Punktzahl wachsen und dabei verwehen', async () => {
  // Gegenstueck zum Test oben, der `prefersReducedMotion: true` festhaelt und
  // damit nur den statischen Zweig prueft. Genau diese Luecke liess den Fehler
  // ueberleben: Die Anzeige stand still, waehrend die Strafanzeigen laengst
  // eine Bewegung hatten - auffallen konnte das nur am Geraet.
  vi.resetModules();
  vi.doMock('@/systems/AccessibilitySystem', () => ({
    prefersReducedMotion: () => false,
    rarityMarker: () => '★',
  }));
  const { CollectionEffects: Bewegt } = await import('./CollectionEffects');

  const mask = { destroy: vi.fn() };
  const graphic = () => {
    const methods: Record<string, unknown> = { createGeometryMask: () => mask };
    const chain: Record<string, unknown> = new Proxy(methods, {
      get: (target, key: string) => target[key] ?? (() => chain),
    });
    return chain;
  };
  // Der Zustand, auf den es ankommt: Groesse, Deckkraft und Hoehe je Frame.
  const zustand = { scale: 1, alpha: 1, y: 0 };
  const scene = {
    game: { canvas: { getBoundingClientRect: () => ({ width: 390 }) } },
    add: {
      graphics: vi.fn(graphic),
      text: () => {
        const label = {
          width: 140,
          height: 32,
          setDepth: () => label,
          setWordWrapWidth: () => label,
          setOrigin: () => label,
          setPosition: (_x: number, y: number) => {
            zustand.y = y;
            return label;
          },
          setScale: (value: number) => {
            zustand.scale = value;
            return label;
          },
          setAlpha: (value: number) => {
            zustand.alpha = value;
            return label;
          },
          setVisible: () => label,
          destroy: () => label,
        };
        return label;
      },
    },
  } as unknown as Phaser.Scene;

  const effects = new Bewegt(
    scene,
    () => ({ x: 360, y: 600 }),
    () => ({ left: 10, top: 200, right: 710, bottom: 1100 }),
  );
  effects.add({ x: 300, y: 500 }, RARITIES[2]!, 250);

  const proben: { scale: number; alpha: number; y: number }[] = [{ ...zustand }];
  for (let i = 0; i < 6; i++) {
    effects.update(COLLECTION_VISUALS.lifetimeMs / 7);
    proben.push({ ...zustand });
  }

  const erste = proben[0]!;
  const letzte = proben.at(-1)!;

  // Der Kern: Die Bewegung muss sich summieren. Eine, die zu ihrem Startwert
  // zurueckkehrt, ist messbar und trotzdem unsichtbar - daran scheiterte der
  // erste Anlauf.
  expect(letzte.scale).toBeGreaterThan(erste.scale * 1.5);
  // Durchgehend wachsend, kein Zurueckfedern.
  for (let i = 1; i < proben.length; i++)
    expect(proben[i]!.scale).toBeGreaterThanOrEqual(proben[i - 1]!.scale);
  // Und sie verweht, waehrend sie waechst - nicht erst danach.
  expect(letzte.alpha).toBeLessThan(erste.alpha);
  // Sie zieht dabei nach oben davon.
  expect(letzte.y).toBeLessThan(erste.y);

  effects.destroy();
});
