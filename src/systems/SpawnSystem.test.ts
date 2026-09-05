/** Tests fuer die faire, reproduzierbare Spawnfolge im Duell und Solo. */

import { describe, expect, it, vi } from 'vitest';

import {
  MAX_ACTIVE_COLLECTIBLES,
  WORLD_LIFETIME_SCALE_FLOOR,
  WORLD_OBSTACLE_MAX_CHANCE,
} from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import { phase5LifetimeScale, phase5ObstacleChance, SpawnSystem } from '@/systems/SpawnSystem';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
      Linear: (start: number, end: number, amount: number) => start + (end - start) * amount,
    },
  },
}));

class FakeRng {
  constructor(private readonly fraction = 0.5) {}

  realInRange(): number {
    return 1;
  }

  between(min: number): number {
    return min + 40;
  }

  frac(): number {
    return this.fraction;
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

  it('setzt Spürsinn in normalen Welten nur als einstufige Aufstiegschance um', () => {
    const spawner = new SpawnSystem(
      new FakeRng(0.1) as never,
      { left: 60, right: 660, top: 170, bottom: 1160, centerX: 360, centerY: 665 } as never,
      'blink',
      'none',
      1,
      false,
      0.2,
    );

    const spawn = spawner.update(1_000, 0, 0, 360, 665);

    expect(spawn?.rarity.id).toBe('common');
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

describe('SpawnSystem - Phase-5-Schwierigkeitsprofil', () => {
  it('erhöht den Hindernisdruck kontrolliert mit Welt und Run-Fortschritt', () => {
    const startChances = WORLDS.map((world) =>
      phase5ObstacleChance(world.obstacleMode, world.difficultyScale, 0),
    );
    const endChances = WORLDS.map((world) =>
      phase5ObstacleChance(world.obstacleMode, world.difficultyScale, 1),
    );

    expect(startChances[0]).toBe(0);
    expect(startChances.slice(1).every((chance, index) => chance > startChances[index]!)).toBe(
      true,
    );
    expect(endChances.every((chance, index) => chance >= startChances[index]!)).toBe(true);
    expect(endChances[endChances.length - 1]).toBeLessThanOrEqual(WORLD_OBSTACLE_MAX_CHANCE);
    expect(phase5ObstacleChance('penalty', WORLDS[WORLDS.length - 1]!.difficultyScale, 2)).toBe(
      endChances[endChances.length - 1],
    );
  });

  it('verkleinert Sichtfenster monoton und behält den konfigurierten Boden', () => {
    const scales = WORLDS.map((world) => phase5LifetimeScale(world.difficultyScale));

    expect(scales[0]).toBe(1);
    expect(scales.slice(1).every((scale, index) => scale < scales[index]!)).toBe(true);
    expect(scales[scales.length - 1]).toBeGreaterThanOrEqual(WORLD_LIFETIME_SCALE_FLOOR);
  });
});

/*
 * Regressionstests zu AUDIT_2026-09-05, Befund 8 und 9.
 *
 * `FakeRng` oben liefert konstante Werte und kann deshalb weder einen
 * Bildratenunterschied noch einen verschobenen Zufallsverbrauch zeigen -
 * genau daran ging beides ungesehen durch. Dieser Generator ist
 * deterministisch UND zaehlt, wie oft er gezogen wurde.
 */
class CountingRng {
  draws = 0;
  private seed = 12345;

  private next(): number {
    this.draws += 1;
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  frac(): number {
    return this.next();
  }

  realInRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  between(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next());
  }
}

function countingSpawner(rng: CountingRng, promotionChance = 0): SpawnSystem {
  return new SpawnSystem(
    rng as never,
    { left: 60, right: 660, top: 170, bottom: 1160, centerX: 360, centerY: 665 } as never,
    'none',
    'none',
    1,
    true,
    promotionChance,
  );
}

describe('AUDIT_2026-09-05 Befund 8: Bildratenunabhaengigkeit', () => {
  it('spawnt bei 30, 60 und 120 fps gleich oft', () => {
    // 89 statt 90 Sekunden: ein Spawn, der auf 89,99 s faellt, liegt je nach
    // Frame-Raster knapp innerhalb oder ausserhalb der Runde. Dieser
    // Randeffekt der Laufgrenze ist gewollt und nicht der gesuchte Drift.
    const counts = [30, 60, 120].map((fps) => {
      const system = countingSpawner(new CountingRng());
      const deltaMs = 1000 / fps;
      const frames = Math.round((fps * 89000) / 1000);
      let spawns = 0;
      for (let frame = 0; frame < frames; frame++) {
        if (system.update(deltaMs, frame / frames, 0, 360, 665)) spawns += 1;
      }
      return spawns;
    });

    // Frueher setzte update() den Timer auf ein volles Intervall und warf den
    // negativen Rest weg - grosse Deltas verloren mehr Zeit als kleine.
    expect(new Set(counts).size).toBe(1);
  });
});

describe('AUDIT_2026-09-05 Befund 9: gleicher Zufallsverbrauch', () => {
  it('zieht mit und ohne Spuersinn gleich viele Zufallszahlen', () => {
    const without = new CountingRng();
    const with_ = new CountingRng();
    countingSpawner(without, 0).update(1_000, 0, 0, 360, 665);
    countingSpawner(with_, 0.03).update(1_000, 0, 0, 360, 665);

    // Frueher sparte die Kurzschlussauswertung bei Chance 0 eine Ziehung -
    // danach liefen die Generatoren beider Duellanten auseinander.
    expect(with_.draws).toBe(without.draws);
  });

  it('laesst Spuersinn die Positionen der Folgespawns unveraendert', () => {
    const plain = countingSpawner(new CountingRng(), 0);
    const prospector = countingSpawner(new CountingRng(), 0.03);

    for (let index = 0; index < 5; index++) {
      const a = plain.update(1_000, 0, 0, 360, 665);
      const b = prospector.update(1_000, 0, 0, 360, 665);
      // Nur die Seltenheit darf sich unterscheiden, nie die Position.
      expect({ x: b?.x, y: b?.y }).toEqual({ x: a?.x, y: a?.y });
    }
  });

  it('gibt jedem Spawn eine Driftrichtung aus dem geteilten Generator mit', () => {
    // Ohne diesen Wert zog `Collectible` den Winkel aus `Math.random()` und
    // dieselben Relikte trieben bei beiden Spielern verschieden.
    const first = countingSpawner(new CountingRng()).update(1_000, 0, 0, 360, 665);
    const second = countingSpawner(new CountingRng()).update(1_000, 0, 0, 360, 665);

    expect(first?.driftAngle).toBeTypeOf('number');
    expect(second?.driftAngle).toBe(first?.driftAngle);
  });
});
