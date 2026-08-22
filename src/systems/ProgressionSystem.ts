/**
 * Charakterlevel, XP, Coins, Weltenfreischaltung und Achievements.
 *
 * Reine Logik ohne Phaser-Abhaengigkeit - dadurch komplett unit-testbar und
 * unabhaengig davon, ob ein Run gerade laeuft.
 */

import { ACHIEVEMENT_BY_ID, ACHIEVEMENTS } from '@/config/achievements';
import {
  COLLECTION_STEP_SIZE,
  COINS_PER_COLLECTION_STEP,
  COINS_PER_LEVEL,
  COINS_PER_RUN,
  EPIC_BONUS_COINS_PER_STEP,
  EPIC_CATCHES_PER_BONUS_STEP,
  LEGENDARY_BONUS_COINS,
  MAX_LEVEL,
  MAX_COLLECTION_BONUS_COINS,
  RARE_CATCHES_PER_BONUS_COIN,
  TALENT_RESET_COST,
  xpForLevel,
} from '@/config/GameConfig';
import { auraLevelReached, SHIP_AURAS, SHIP_COLORS, SHIP_SHAPES } from '@/config/shop';
import { TALENTS, talentCost, type TalentId } from '@/config/talents';
import { WORLDS } from '@/config/worlds';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import type { ProgressionResult, RunStats, SaveData } from '@/types';

/** XP-Fortschritt innerhalb des aktuellen Levels - fuer die HUD-Leiste. */
export interface LevelProgress {
  level: number;
  xpInLevel: number;
  xpNeeded: number;
  /** 0 bis 1. */
  ratio: number;
}

function safeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
}

/** Coins bleiben wertvoll: Fangmenge und hochwertige Beute helfen, nicht Masse allein. */
export function coinsForRun(run: RunStats): number {
  const totalCollected = safeCount(run.totalCollected);
  const rare = safeCount(run.collected.rare);
  const epic = safeCount(run.collected.epic);
  const legendary = safeCount(run.collected.legendary);
  const collectionBonus = Math.min(
    MAX_COLLECTION_BONUS_COINS,
    Math.floor(totalCollected / COLLECTION_STEP_SIZE) * COINS_PER_COLLECTION_STEP,
  );
  const rarityBonus =
    Math.floor(rare / RARE_CATCHES_PER_BONUS_COIN) +
    Math.floor(epic / EPIC_CATCHES_PER_BONUS_STEP) * EPIC_BONUS_COINS_PER_STEP +
    legendary * LEGENDARY_BONUS_COINS;
  return Math.max(0, COINS_PER_RUN + collectionBonus + rarityBonus);
}

function grantLevelReward(data: SaveData): number {
  data.talentPoints = 0;
  data.coins += COINS_PER_LEVEL;
  return COINS_PER_LEVEL;
}

export function getLevelProgress(save: SaveData): LevelProgress {
  if (save.level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, xpInLevel: 0, xpNeeded: 0, ratio: 1 };
  }

  const xpNeeded = xpForLevel(save.level);
  return {
    level: save.level,
    xpInLevel: save.xp,
    xpNeeded,
    ratio: xpNeeded > 0 ? Math.min(save.xp / xpNeeded, 1) : 0,
  };
}

/**
 * Verrechnet einen abgeschlossenen Run mit dem Spielstand.
 *
 * Schreibt den Spielstand und liefert zurueck, was sich veraendert hat, damit
 * der Ergebnisbildschirm Levelaufstiege und neue Achievements feiern kann.
 */
export function applyRun(run: RunStats): ProgressionResult {
  const before = SaveSystem.load();
  const levelBefore = before.level;
  const safeScore = safeCount(run.score);
  const safeBestCombo = safeCount(run.bestCombo);
  const safeXpGained = safeCount(run.xpGained);
  const safeCollected = { ...run.collected };
  for (const rarityId of Object.keys(safeCollected)) {
    safeCollected[rarityId as keyof typeof safeCollected] = safeCount(
      safeCollected[rarityId as keyof typeof safeCollected],
    );
  }
  const safeRun = {
    ...run,
    score: safeScore,
    bestCombo: safeBestCombo,
    xpGained: safeXpGained,
    collected: safeCollected,
    totalCollected: safeCount(run.totalCollected),
    missed: safeCount(run.missed),
    durationMs: safeCount(run.durationMs),
  };
  const isNewBestScore = safeScore > before.bestScore;
  const recordTimestamp = normalizedTimestamp(run.completedAt);
  const talentPointsGained = 0;
  let coinsGained = 0;
  const runCoins = coinsForRun(safeRun);
  coinsGained += runCoins;

  const after = SaveSystem.update((data) => {
    data.totalRuns += 1;
    data.totalScore += safeScore;
    data.totalPlayTimeMs += safeCount(run.durationMs);
    data.bestScore = Math.max(data.bestScore, safeScore);
    if (isNewBestScore) data.bestScoreRecordedAt = recordTimestamp;
    data.bestCombo = Math.max(data.bestCombo, safeBestCombo);
    data.lastWorldId = run.worldId;
    data.coins += runCoins;

    for (const [rarityId, count] of Object.entries(safeCollected)) {
      data.collected[rarityId as keyof typeof data.collected] += count;
    }

    // XP verrechnen; mehrere Levelaufstiege in einem Run sind moeglich.
    data.xp += safeXpGained;
    let guard = 0;
    while (data.level < MAX_LEVEL && data.xp >= xpForLevel(data.level) && guard < MAX_LEVEL) {
      data.xp -= xpForLevel(data.level);
      data.level += 1;
      coinsGained += grantLevelReward(data);
      guard += 1;
    }

    // Auf Maximalstufe gibt es keinen unsichtbar anwachsenden XP-Vorrat.
    if (data.level >= MAX_LEVEL) {
      data.level = MAX_LEVEL;
      data.xp = 0;
    }
  });

  const levelsGained = after.level - levelBefore;

  const unlockedWorldIds = WORLDS.filter(
    (w) => w.unlockLevel > levelBefore && w.unlockLevel <= after.level,
  ).map((w) => w.id);

  // Achievements erst NACH der XP-Verrechnung pruefen: manche haengen am Level.
  const unlockedAchievementIds = evaluateAchievements(after, safeRun);
  const achievementCoins = unlockedAchievementIds.reduce(
    (sum, id) => sum + (ACHIEVEMENT_BY_ID[id]?.coinReward ?? 0),
    0,
  );
  if (achievementCoins > 0) {
    SaveSystem.update((data) => {
      data.coins += achievementCoins;
    });
    coinsGained += achievementCoins;
  }

  SaveSystem.update((data) => {
    data.totalCoinsEarned += coinsGained;
  });

  return {
    levelsGained,
    newLevel: after.level,
    talentPointsGained,
    coinsGained,
    unlockedWorldIds,
    unlockedAchievementIds,
    isNewBestScore,
  };
}

/**
 * Gewaehrt den einmaligen Tageslauf-Bonus lokal. Der gleiche Schritt wird beim
 * naechsten Sync serverseitig wiederholt; die Merker im Save machen ihn
 * geraeteuebergreifend idempotent.
 */
export function applyDailyBonus(
  coins: number,
  xp: number,
): {
  coinsGained: number;
  xpGained: number;
  levelsGained: number;
} {
  const before = SaveSystem.load();
  const safeCoins = Math.max(0, Math.round(coins));
  const safeXp = Math.max(0, Math.round(xp));
  let totalCoinGain = safeCoins;

  const after = SaveSystem.update((data) => {
    data.coins += safeCoins;
    data.xp += safeXp;
    let guard = 0;
    while (data.level < MAX_LEVEL && data.xp >= xpForLevel(data.level) && guard < MAX_LEVEL) {
      data.xp -= xpForLevel(data.level);
      data.level += 1;
      totalCoinGain += grantLevelReward(data);
      guard += 1;
    }
    if (data.level >= MAX_LEVEL) data.xp = 0;
    data.totalCoinsEarned += totalCoinGain;
  });

  return {
    coinsGained: totalCoinGain,
    xpGained: safeXp,
    levelsGained: after.level - before.level,
  };
}

/** Bewahrt einen vom Run stammenden Zeitstempel, ohne kaputte Altwerte zu speichern. */
function normalizedTimestamp(value: string | undefined): string {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

/** Kauft genau einen Rang lokal; der Talentbildschirm validiert nicht blind. */
export function purchaseTalent(talentId: TalentId): SaveData | null {
  const talent = TALENTS.find((entry) => entry.id === talentId);
  if (!talent) return null;

  let purchased = false;
  const result = SaveSystem.update((data) => {
    const currentRank = data.talents[talentId] ?? 0;
    const cost = talentCost(currentRank);
    if (data.coins < cost || currentRank >= talent.maxRank) return;
    data.coins -= cost;
    data.coinsSpent += cost;
    data.talents[talentId] = currentRank + 1;
    purchased = true;
  });
  return purchased ? result : null;
}

/**
 * Kauft eine Schiffsform. `null`, wenn das Guthaben nicht reicht oder die
 * Form schon gehoert.
 */
export function purchaseShipShape(shapeId: string): SaveData | null {
  const shape = SHIP_SHAPES.find((entry) => entry.id === shapeId);
  if (!shape) return null;

  let gekauft = false;
  SaveSystem.update((data) => {
    if (data.ownedShipShapes.includes(shape.id)) return;
    if (data.coins < shape.cost) return;
    data.coins -= shape.cost;
    data.coinsSpent += shape.cost;
    data.ownedShipShapes = [...data.ownedShipShapes, shape.id];
    // Frisch Gekauftes gleich anziehen - wer kauft, will es sehen.
    data.shipShape = shape.id;
    gekauft = true;
  });
  if (!gekauft) return null;
  const updated = SaveSystem.recordCosmeticPurchase('shapes', shape.id);
  CloudSystem.queueCosmeticSync(updated);
  return updated;
}

/** Kauft eine Farbe. Gleiche Regeln wie bei den Formen. */
export function purchaseShipColor(colorId: string): SaveData | null {
  const color = SHIP_COLORS.find((entry) => entry.id === colorId);
  if (!color) return null;

  let gekauft = false;
  SaveSystem.update((data) => {
    if (data.ownedShipColors.includes(color.id)) return;
    if (data.coins < color.cost) return;
    data.coins -= color.cost;
    data.coinsSpent += color.cost;
    data.ownedShipColors = [...data.ownedShipColors, color.id];
    data.shipColor = color.id;
    gekauft = true;
  });
  if (!gekauft) return null;
  const updated = SaveSystem.recordCosmeticPurchase('colors', color.id);
  CloudSystem.queueCosmeticSync(updated);
  return updated;
}

/**
 * Kauft eine Aura.
 *
 * Wie bei Formen und Farben, mit einer zusaetzlichen Huerde: Manche Auren
 * verlangen ein Mindestlevel (heute nur die Prismaflut). Die Pruefung steht
 * **hier** und nicht nur in der Ladenanzeige - ein manipulierter Aufruf soll
 * die Stufe nicht umgehen koennen, genau wie er kein ungekauftes Schiff
 * tragen kann.
 */
export function purchaseShipAura(auraId: string): SaveData | null {
  const aura = SHIP_AURAS.find((entry) => entry.id === auraId);
  if (!aura) return null;

  let gekauft = false;
  SaveSystem.update((data) => {
    if (data.ownedShipAuras.includes(aura.id)) return;
    if (!auraLevelReached(aura, data.level)) return;
    if (data.coins < aura.cost) return;
    data.coins -= aura.cost;
    data.coinsSpent += aura.cost;
    data.ownedShipAuras = [...data.ownedShipAuras, aura.id];
    data.shipAura = aura.id;
    gekauft = true;
  });
  if (!gekauft) return null;
  const updated = SaveSystem.recordCosmeticPurchase('auras', aura.id);
  CloudSystem.queueCosmeticSync(updated);
  return updated;
}

/**
 * Zieht eine bereits gekaufte Form, Farbe oder Aura an.
 *
 * Was nicht im Besitz ist, wird still abgelehnt - ein manipulierter
 * Spielstand soll keine ungekaufte Form tragen koennen.
 */
export function equipShip(shapeId?: string, colorId?: string, auraId?: string): SaveData | null {
  let geaendert = false;
  const result = SaveSystem.update((data) => {
    if (shapeId && data.ownedShipShapes.includes(shapeId) && data.shipShape !== shapeId) {
      data.shipShape = shapeId;
      geaendert = true;
    }
    if (colorId && data.ownedShipColors.includes(colorId) && data.shipColor !== colorId) {
      data.shipColor = colorId;
      geaendert = true;
    }
    if (auraId && data.ownedShipAuras.includes(auraId) && data.shipAura !== auraId) {
      data.shipAura = auraId;
      geaendert = true;
    }
  });
  if (!geaendert) return null;
  CloudSystem.queueCosmeticSync(result);
  return result;
}

/**
 * Setzt alle Talentränge gegen die konfigurierte Reset-Gebühr zurück.
 *
 * Das `zurueckgesetzt`-Flag folgt demselben Muster wie die Kauffunktionen:
 * Der Rueckgabewert von `SaveSystem.update()` sagt nichts darueber aus, ob
 * der Mutator tatsaechlich etwas geaendert hat - ohne das Flag meldete ein
 * uebersprungener Guard einen Erfolg.
 *
 * Vorher stand die Guthabenpruefung doppelt da: einmal als Vorpruefung ueber
 * `load()`, einmal im Mutator. Die Vorpruefung faengt denselben Fall ab und
 * ist mit dem Flag ueberfluessig - zwei Stellen mit derselben Bedingung
 * laufen sonst irgendwann auseinander (Audit 2026-08-23).
 */
export function resetTalents(): SaveData | null {
  let zurueckgesetzt = false;
  const result = SaveSystem.update((data) => {
    if (data.coins < TALENT_RESET_COST) return;
    data.coins -= TALENT_RESET_COST;
    data.coinsSpent += TALENT_RESET_COST;
    data.talents = {};
    zurueckgesetzt = true;
  });
  return zurueckgesetzt ? result : null;
}

/** Prueft alle noch nicht freigeschalteten Achievements und speichert Treffer. */
function evaluateAchievements(save: SaveData, run: RunStats): string[] {
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (a) => !save.unlockedAchievements.includes(a.id) && a.check(save, run),
  ).map((a) => a.id);

  if (newlyUnlocked.length > 0) {
    SaveSystem.update((data) => {
      data.unlockedAchievements.push(...newlyUnlocked);
    });
  }

  return newlyUnlocked;
}

/** Debug-Hilfe: gewaehrt Level, ohne einen Run spielen zu muessen. */
export function grantLevels(count: number): SaveData {
  return SaveSystem.update((data) => {
    const currentLevel = Math.min(MAX_LEVEL, Math.max(1, data.level));
    const nextLevel = Math.min(MAX_LEVEL, currentLevel + Math.max(0, count));
    const gained = nextLevel - currentLevel;
    data.level = nextLevel;
    for (let index = 0; index < gained; index++) grantLevelReward(data);
    data.xp = 0;
  });
}
