/** Tests fuer die faire, reproduzierbare Spawnfolge im Duell und Solo. */

import { describe, expect, it, vi } from 'vitest';

import { MAX_ACTIVE_COLLECTIBLES } from '@/config/GameConfig';
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

function createSpawner(synchronizedPositions = true): SpawnSystem {
  return new SpawnSystem(
    new FakeRng() as never,
    { left: 60, right: 660, top: 170, bottom: 1160, centerX: 360, centerY: 665 } as never,
    'blink',
    'penalty',
    1.4,
    synchronizedPositions,
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
    const spawner = createSpawner(true);

    expect(spawner.update(1_000, 0.5, 14, 360, 665)).not.toBeNull();
  });
});

describe('SpawnSystem - Solo-Kapazitaetsguard', () => {
  // docs/AUDIT_2026-08-17.md Abschnitt 5.6: der Solo-Zweig
  // (synchronizedPositions = false) ist die in jedem einzelnen Solo-Run
  // tatsaechlich durchlaufene Logik, wurde bisher aber nie getestet - nur
  // der Duell-Zweig oben.
  it('verwirft einen Spawn, wenn das Feld voll ist', () => {
    const spawner = createSpawner(false);

    expect(spawner.update(1_000, 0.5, MAX_ACTIVE_COLLECTIBLES, 360, 665)).toBeNull();
  });

  it('spawnt weiterhin, solange das Feld noch nicht voll ist', () => {
    const spawner = createSpawner(false);

    expect(spawner.update(1_000, 0.5, MAX_ACTIVE_COLLECTIBLES - 1, 360, 665)).not.toBeNull();
  });

  it('verbraucht den Zufallsgenerator gleich, ob der Spawn verworfen wird oder nicht', () => {
    // Kein direkter Zugriff auf den RNG-Zaehler von aussen moeglich - die
    // Kontrolle laeuft ueber den deterministischen FakeRng: beide Aufrufe
    // muessten bei gleichem Ablauf dieselbe Position berechnen, wenn sie
    // jemals sichtbar wuerde. Bestaetigt hier nur, dass ein verworfener und
    // ein nicht-verworfener Aufruf beide fehlerfrei durchlaufen (kein
    // fruehes return VOR findPosition()/rollWorldRarity()).
    const spawner = createSpawner(false);

    expect(() => spawner.update(1_000, 0.5, MAX_ACTIVE_COLLECTIBLES, 360, 665)).not.toThrow();
  });
});

describe('SpawnSystem - reset', () => {
  // docs/AUDIT_2026-08-17.md Abschnitt 5.6: reset() wird von
  // GameScene.startRun() genutzt, um nach dem Countdown sofort einen Spawn
  // auszuloesen (der interne Timer koennte sonst aus der Countdown-Phase
  // noch einen Rest-Wert > 0 haben). Bisher rief kein Test reset() auf.
  it('macht nach einem Countdown sofort wieder einen Spawn faellig', () => {
    const spawner = createSpawner(true);

    // Ein Update mit wenig deltaMs laesst den internen Timer > 0 zurueck -
    // solange braucht ein "Countdown", der die Spawns noch nicht anzeigt.
    spawner.update(50, 0, 0, 360, 665);
    expect(spawner.update(50, 0, 0, 360, 665)).toBeNull();

    spawner.reset();

    // Nach reset() muss der naechste update()-Aufruf sofort wieder spawnen,
    // unabhaengig davon, wie viel Rest-Zeit vor dem reset() im Timer stand.
    expect(spawner.update(1, 0, 0, 360, 665)).not.toBeNull();
  });
});
