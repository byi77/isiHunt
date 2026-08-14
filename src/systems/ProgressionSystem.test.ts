/**
 * Tests fuer Levelaufstieg, Talentpunkte, Weltenfreischaltung und Achievements.
 *
 * `SaveSystem` haelt den Spielstand in einem Modul-Cache. Der ueberlebt ein
 * `localStorage.clear()` - deshalb wird vor jedem Test das Modul selbst neu
 * geladen (`resetModules`), sonst traegt ein Test den Stand des vorigen mit.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COINS_PER_LEVEL, MAX_LEVEL, xpForLevel } from '@/config/GameConfig';
import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID, WORLDS } from '@/config/worlds';
import type { RarityId } from '@/config/rarities';
import type * as ProgressionSystem from '@/systems/ProgressionSystem';
import type * as SaveSystemModule from '@/systems/SaveSystem';
import type { RunStats } from '@/types';

let Progression: typeof ProgressionSystem;
let SaveSystem: typeof SaveSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  SaveSystem = await import('@/systems/SaveSystem');
  Progression = await import('@/systems/ProgressionSystem');
});

/** Ein Run ohne Besonderheiten; einzelne Werte je Test ueberschreiben. */
function createRun(overrides: Partial<RunStats> = {}): RunStats {
  const collected: Record<RarityId, number> = emptyRarityCounts();
  return {
    worldId: DEFAULT_WORLD_ID,
    score: 0,
    bestCombo: 0,
    bestMultiplier: 1,
    collected,
    totalCollected: 0,
    missed: 0,
    xpGained: 0,
    ...overrides,
  };
}

describe('getLevelProgress', () => {
  it('meldet den Fortschritt innerhalb des aktuellen Levels', () => {
    const needed = xpForLevel(1);
    SaveSystem.update((data) => {
      data.level = 1;
      data.xp = Math.floor(needed / 2);
    });

    const progress = Progression.getLevelProgress(SaveSystem.load());
    expect(progress.level).toBe(1);
    expect(progress.xpNeeded).toBe(needed);
    expect(progress.ratio).toBeCloseTo(0.5, 1);
  });

  it('meldet auf Maximalstufe eine volle Leiste ohne Restbedarf', () => {
    SaveSystem.update((data) => {
      data.level = MAX_LEVEL;
      data.xp = 0;
    });

    const progress = Progression.getLevelProgress(SaveSystem.load());
    expect(progress.ratio).toBe(1);
    expect(progress.xpNeeded).toBe(0);
  });
});

describe('applyRun - Statistik', () => {
  it('schreibt Bestwerte nur nach oben', () => {
    Progression.applyRun(createRun({ score: 500, bestCombo: 12 }));
    Progression.applyRun(createRun({ score: 100, bestCombo: 3 }));

    const save = SaveSystem.load();
    expect(save.bestScore).toBe(500);
    expect(save.bestCombo).toBe(12);
  });

  it('summiert Runs, Punkte und Faenge ueber mehrere Runs', () => {
    const collected = { ...emptyRarityCounts(), rare: 2 };
    Progression.applyRun(createRun({ score: 100, collected }));
    Progression.applyRun(createRun({ score: 250, collected }));

    const save = SaveSystem.load();
    expect(save.totalRuns).toBe(2);
    expect(save.totalScore).toBe(350);
    expect(save.collected.rare).toBe(4);
  });

  it('meldet einen neuen Bestwert nur, wenn er wirklich uebertroffen wurde', () => {
    expect(Progression.applyRun(createRun({ score: 100 })).isNewBestScore).toBe(true);
    // Punktgleich ist kein neuer Bestwert.
    expect(Progression.applyRun(createRun({ score: 100 })).isNewBestScore).toBe(false);
    expect(Progression.applyRun(createRun({ score: 101 })).isNewBestScore).toBe(true);
  });

  it('merkt sich die zuletzt gespielte Welt', () => {
    // Bewusst eine echte Welt aus der Config, nicht irgendeine Zeichenkette.
    const other = WORLDS.find((w) => w.id !== DEFAULT_WORLD_ID) ?? WORLDS[0]!;

    Progression.applyRun(createRun({ worldId: other.id }));

    expect(SaveSystem.load().lastWorldId).toBe(other.id);
  });

  it('vergibt Coins für eingesammelte Relikte', () => {
    const result = Progression.applyRun(createRun({ totalCollected: 7 }));

    expect(result.coinsGained).toBeGreaterThanOrEqual(7);
    expect(SaveSystem.load().coins).toBe(result.coinsGained);
  });
});

describe('applyRun - Levelaufstieg', () => {
  it('steigt nicht auf, solange die XP nicht reichen', () => {
    const result = Progression.applyRun(createRun({ xpGained: xpForLevel(1) - 1 }));

    expect(result.levelsGained).toBe(0);
    expect(result.newLevel).toBe(1);
    expect(SaveSystem.load().xp).toBe(xpForLevel(1) - 1);
  });

  it('steigt bei genau erreichter Schwelle auf und faengt bei 0 XP an', () => {
    const result = Progression.applyRun(createRun({ xpGained: xpForLevel(1) }));

    expect(result.levelsGained).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(SaveSystem.load().xp).toBe(0);
  });

  it('nimmt den XP-Ueberschuss ins naechste Level mit', () => {
    const surplus = 25;
    Progression.applyRun(createRun({ xpGained: xpForLevel(1) + surplus }));

    expect(SaveSystem.load().xp).toBe(surplus);
  });

  it('erlaubt mehrere Levelaufstiege in einem einzigen Run', () => {
    const xp = xpForLevel(1) + xpForLevel(2) + xpForLevel(3);
    const result = Progression.applyRun(createRun({ xpGained: xp }));

    expect(result.levelsGained).toBe(3);
    expect(result.newLevel).toBe(4);
  });

  it('vergibt pro Levelaufstieg Coins', () => {
    const result = Progression.applyRun(createRun({ xpGained: xpForLevel(1) + xpForLevel(2) }));

    expect(result.talentPointsGained).toBe(0);
    expect(result.coinsGained).toBeGreaterThanOrEqual(2 * COINS_PER_LEVEL);
    expect(SaveSystem.load().coins).toBe(result.coinsGained);
  });

  it('haelt auf Maximalstufe an und sammelt keine XP mehr an', () => {
    SaveSystem.update((data) => {
      data.level = MAX_LEVEL;
      data.xp = 0;
    });

    const result = Progression.applyRun(createRun({ xpGained: 999_999 }));

    expect(result.newLevel).toBe(MAX_LEVEL);
    expect(result.levelsGained).toBe(0);
    expect(SaveSystem.load().xp).toBe(0);
  });
});

describe('applyRun - Weltenfreischaltung', () => {
  it('meldet eine Welt genau in dem Run, der ihr Level erreicht', () => {
    const locked = WORLDS.filter((w) => w.unlockLevel > 1).sort(
      (a, b) => a.unlockLevel - b.unlockLevel,
    )[0];

    // Ohne freischaltbare Welt in der Config ist hier nichts zu pruefen.
    if (!locked) return;

    const previousLevel = locked.unlockLevel - 1;
    SaveSystem.update((data) => {
      data.level = previousLevel;
      data.xp = 0;
    });

    const result = Progression.applyRun(createRun({ xpGained: xpForLevel(previousLevel) }));
    expect(result.newLevel).toBe(locked.unlockLevel);
    expect(result.unlockedWorldIds).toContain(locked.id);

    // Im naechsten Run darf dieselbe Welt nicht erneut gemeldet werden.
    const again = Progression.applyRun(createRun());
    expect(again.unlockedWorldIds).not.toContain(locked.id);
  });

  it('meldet mehrere Welten, wenn ein Run ueber mehrere Schwellen traegt', () => {
    const thresholds = [...new Set(WORLDS.map((w) => w.unlockLevel))]
      .filter((level) => level > 1)
      .sort((a, b) => a - b);

    // Mindestens zwei Schwellen noetig, sonst ist der Fall nicht konstruierbar.
    if (thresholds.length < 2) return;

    const target = thresholds[1]!;
    let xp = 0;
    for (let level = 1; level < target; level++) xp += xpForLevel(level);

    const result = Progression.applyRun(createRun({ xpGained: xp }));

    expect(result.newLevel).toBe(target);
    const expected = WORLDS.filter((w) => w.unlockLevel > 1 && w.unlockLevel <= target);
    for (const world of expected) {
      expect(result.unlockedWorldIds).toContain(world.id);
    }
  });
});

describe('applyRun - Achievements', () => {
  it('schaltet ein Achievement nur einmal frei', () => {
    const run = createRun({ score: 5_000, xpGained: 500, totalCollected: 50 });

    const first = Progression.applyRun(run);
    const second = Progression.applyRun(run);

    // Was der erste Run freigeschaltet hat, darf der zweite nicht wiederholen.
    for (const id of first.unlockedAchievementIds) {
      expect(second.unlockedAchievementIds).not.toContain(id);
    }
  });

  it('schreibt freigeschaltete Achievements in den Spielstand', () => {
    const result = Progression.applyRun(
      createRun({ score: 5_000, xpGained: 500, totalCollected: 50 }),
    );

    const save = SaveSystem.load();
    for (const id of result.unlockedAchievementIds) {
      expect(save.unlockedAchievements).toContain(id);
    }
  });
});

describe('grantLevels', () => {
  it('hebt das Level und vergibt die zugehoerigen Coins', () => {
    const save = Progression.grantLevels(3);

    expect(save.level).toBe(4);
    expect(save.coins).toBe(3 * COINS_PER_LEVEL);
  });

  it('geht nie ueber die Maximalstufe hinaus', () => {
    const save = Progression.grantLevels(MAX_LEVEL + 50);
    expect(save.level).toBe(MAX_LEVEL);
  });

  it('ignoriert negative Werte, statt Level zu verlieren', () => {
    Progression.grantLevels(5);
    const save = Progression.grantLevels(-3);

    expect(save.level).toBe(6);
  });
});

describe('Talentkäufe', () => {
  it('kauft Ränge mit Coins und berechnet den kostenpflichtigen Reset', () => {
    SaveSystem.update((data) => {
      data.coins = 1300;
    });

    expect(Progression.purchaseTalent('reach')).not.toBeNull();
    expect(Progression.purchaseTalent('reach')).not.toBeNull();
    expect(SaveSystem.load().talents.reach).toBe(2);
    expect(SaveSystem.load().coins).toBe(400);

    expect(Progression.resetTalents()).not.toBeNull();
    expect(SaveSystem.load().talents.reach).toBeUndefined();
    expect(SaveSystem.load().coins).toBe(150);
  });

  it('verweigert Käufe ohne ausreichende Coins', () => {
    expect(Progression.purchaseTalent('reach')).toBeNull();
    expect(Progression.resetTalents()).toBeNull();
  });
});
