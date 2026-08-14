/** Tests fuer die faire, reproduzierbare Spawnfolge im Duell. */

import { describe, expect, it, vi } from 'vitest';

import { SpawnSystem } from '@/systems/SpawnSystem';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
      Linear: (start: number, end: number, amount: number) => start + (end - start) * amount,
    },
  },
}));

class FakeRng {
  realInRange(): number {
    return 1;
  }

  between(min: number): number {
    return min + 40;
  }

  frac(): number {
    return 0.5;
  }
}

function createSpawner(): SpawnSystem {
  return new SpawnSystem(
    new FakeRng() as never,
    { left: 60, right: 660, top: 170, bottom: 1160, centerX: 360, centerY: 665 } as never,
    'blink',
    'penalty',
    1.4,
    true,
  );
}

describe('SpawnSystem - Duellfairness', () => {
  it('liefert trotz unterschiedlicher Spielerbewegung dieselben Positionen', () => {
    const first = createSpawner();
    const second = createSpawner();

    const firstSpawn = first.update(1_000, 0.25, 0, 100, 250);
    const secondSpawn = second.update(1_000, 0.25, 0, 620, 1_000);

    expect(firstSpawn).not.toBeNull();
    expect(secondSpawn).toEqual(firstSpawn);
  });

  it('verwirft im Duell keinen Spawn, nur weil das Feld voll ist', () => {
    const spawner = createSpawner();

    expect(spawner.update(1_000, 0.5, 14, 360, 665)).not.toBeNull();
  });
});
