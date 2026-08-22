/**
 * Reine Zusammenfassung fuer den Level-Up-Moment auf dem Ergebnisbildschirm.
 *
 * Die Scene entscheidet nur ueber die Darstellung. Welche Belohnungen sichtbar
 * werden, bleibt hier testbar und folgt denselben Welt-/Shopdaten wie der Rest
 * des Spiels.
 */

import { COINS_PER_LEVEL } from '@/config/GameConfig';
import { SHIP_AURAS } from '@/config/shop';
import { getWorld } from '@/config/worlds';
import type { ProgressionResult, SaveData } from '@/types';

export interface LevelUpRewardSummary {
  readonly isLevelUp: boolean;
  readonly level: number;
  readonly levelsGained: number;
  readonly levelCoins: number;
  readonly totalCoins: number;
  readonly unlockedWorldNames: readonly string[];
  readonly availableAuraNames: readonly string[];
}

/**
 * Ermittelt genau die Dinge, die ein Spieler nach einem Levelaufstieg sehen
 * soll: neue Stufe, Level-Coins, aktuelles Guthaben und unmittelbare Inhalte.
 * Kosmetik wird nur genannt, wenn die Stufe sie erstmals kaufbar macht.
 */
export function getLevelUpRewardSummary(
  save: SaveData,
  progression: ProgressionResult,
): LevelUpRewardSummary {
  const levelsGained = Math.max(0, Math.floor(progression.levelsGained));
  const level = Math.max(1, Math.floor(progression.newLevel));
  const previousLevel = Math.max(1, level - levelsGained);
  const unlockedWorldNames = progression.unlockedWorldIds
    .map((worldId) => getWorld(worldId).name)
    .filter(Boolean);
  const availableAuraNames = SHIP_AURAS.filter(
    (aura) =>
      aura.minLevel > previousLevel &&
      aura.minLevel <= level &&
      !save.ownedShipAuras.includes(aura.id),
  ).map((aura) => aura.name);

  return {
    isLevelUp: levelsGained > 0,
    level,
    levelsGained,
    levelCoins: levelsGained * COINS_PER_LEVEL,
    totalCoins: Math.max(0, Math.floor(save.coins)),
    unlockedWorldNames,
    availableAuraNames,
  };
}
