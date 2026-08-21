import balanceData from './balance-data.json' with { type: 'json' };

/**
 * Eine einzige Quelle fuer alle spielrelevanten Balance-Zahlen.
 *
 * `balance-data.json` enthaelt die Rohwerte. Dieses Modul berechnet daraus
 * alle konkreten XP-, Coin- und Score-Werte. Zielwerte werden in Runs statt
 * in Waehrungszahlen beschrieben, damit eine Aenderung der Einnahmen die
 * Kosten und Belohnungen automatisch mitzieht.
 */

export interface RarityBalance {
  readonly points: number;
  readonly xp: number;
  readonly weight: number;
}

export const BALANCE = balanceData;

export type BalanceRarityId = keyof typeof BALANCE.rarities;
export type BalanceWorldId = keyof typeof BALANCE.worlds;

const rarityEntries = Object.values(BALANCE.rarities) as RarityBalance[];
const rarityWeightTotal = rarityEntries.reduce((sum, rarity) => sum + rarity.weight, 0);

function weightedAverage(field: 'points' | 'xp'): number {
  return rarityEntries.reduce(
    (sum, rarity) => sum + (rarity.weight / rarityWeightTotal) * rarity[field],
    0,
  );
}

export const EXPECTED_POINTS_PER_CATCH = weightedAverage('points');
export const EXPECTED_XP_PER_CATCH = weightedAverage('xp');

/**
 * Eingefrorene Bezugsgroessen fuer die relative Skalierung.
 *
 * Diese Werte sind keine aktuellen Messwerte, sondern die bewusst stabile
 * Referenz aus vier simulierten Startwelt-Runs vor der Zentralisierung der
 * Balance-Kette. Aendert sich die Rohkonfiguration, wird dagegen skaliert;
 * die Referenz darf nur nach einer bewusst dokumentierten Neumessung wechseln.
 */
export const BALANCE_BASELINES = {
  capturedAt: '2026-08-19',
  source: 'Vier simulierte Startwelt-Runs vor der Zentralisierung',
  expectedXpPerRun: 1_883.985,
  expectedCoinsPerRun: 52.186,
  expectedScorePerRun: 1_499.07625,
} as const;

const BASELINE_EXPECTED_XP_PER_RUN = BALANCE_BASELINES.expectedXpPerRun;
const BASELINE_EXPECTED_COINS_PER_RUN = BALANCE_BASELINES.expectedCoinsPerRun;
const BASELINE_EXPECTED_SCORE_PER_RUN = BALANCE_BASELINES.expectedScorePerRun;

export const EXPECTED_XP_PER_RUN =
  EXPECTED_XP_PER_CATCH * BALANCE.run.expectedCatches * BALANCE.progression.xp.globalMultiplier;

export const EXPECTED_COINS_PER_RUN =
  BALANCE.economy.globalMultiplier *
  (BALANCE.economy.sources.runBaseCoins +
    Math.min(
      BALANCE.economy.sources.collection.maxCoins,
      (BALANCE.run.economyCatches / BALANCE.economy.sources.collection.stepSize) *
        BALANCE.economy.sources.collection.coinsPerStep,
    ) +
    (BALANCE.run.economyCatches * BALANCE.rarities.rare.weight) /
      rarityWeightTotal /
      BALANCE.economy.sources.rarity.rareCatchesPerCoin +
    ((BALANCE.run.economyCatches * BALANCE.rarities.epic.weight) /
      rarityWeightTotal /
      BALANCE.economy.sources.rarity.epicCatchesPerStep) *
      BALANCE.economy.sources.rarity.epicCoinsPerStep +
    ((BALANCE.run.economyCatches * BALANCE.rarities.legendary.weight) / rarityWeightTotal) *
      BALANCE.economy.sources.rarity.legendaryCoinsPerCatch);

export const EXPECTED_SCORE_PER_RUN =
  EXPECTED_POINTS_PER_CATCH * BALANCE.run.economyCatches * BALANCE.run.referenceComboMultiplier;

const xpRunScale = EXPECTED_XP_PER_RUN / BASELINE_EXPECTED_XP_PER_RUN;
const coinRunScale = EXPECTED_COINS_PER_RUN / BASELINE_EXPECTED_COINS_PER_RUN;
const scoreRunScale = EXPECTED_SCORE_PER_RUN / BASELINE_EXPECTED_SCORE_PER_RUN;

export function xpForRuns(runs: number): number {
  return Math.max(0, Math.round(runs * BALANCE.progression.xp.referencePerRun * xpRunScale));
}

export function coinsForRuns(runs: number): number {
  return Math.max(0, Math.round(runs * BALANCE.economy.referenceCoinsPerRun * coinRunScale));
}

/** Skaliert einen bestehenden Coin-Preis mit der aktuellen Einnahmenrate. */
export function balancedCoinCost(referenceCost: number): number {
  return Math.max(0, Math.round(referenceCost * coinRunScale));
}

export function scoreForRuns(runs: number): number {
  return Math.max(0, Math.round(runs * 1_500 * scoreRunScale));
}

export function xpForLevel(level: number): number {
  if (level >= BALANCE.progression.maxLevel) return 0;

  const curve = BALANCE.progression.xp.runsPerLevel;
  const runs =
    level <= curve.rampEnd
      ? curve.start + ((curve.settled - curve.start) * (level - 1)) / (curve.rampEnd - 1)
      : curve.settled +
        ((curve.max - curve.settled) * (level - curve.rampEnd)) /
          (BALANCE.progression.maxLevel - 1 - curve.rampEnd);

  return xpForRuns(runs);
}

export const MAX_LEVEL = BALANCE.progression.maxLevel;
export const XP_PER_RUN_REFERENCE = xpForRuns(1);
export const XP_GLOBAL_MULTIPLIER = BALANCE.progression.xp.globalMultiplier;

export const COINS_PER_RUN = Math.round(
  BALANCE.economy.sources.runBaseCoins * BALANCE.economy.globalMultiplier,
);
export const COINS_PER_COLLECTION_STEP = Math.round(
  BALANCE.economy.sources.collection.coinsPerStep * BALANCE.economy.globalMultiplier,
);
export const COLLECTION_STEP_SIZE = BALANCE.economy.sources.collection.stepSize;
export const MAX_COLLECTION_BONUS_COINS = Math.round(
  BALANCE.economy.sources.collection.maxCoins * BALANCE.economy.globalMultiplier,
);
export const RARE_CATCHES_PER_BONUS_COIN = BALANCE.economy.sources.rarity.rareCatchesPerCoin;
export const EPIC_CATCHES_PER_BONUS_STEP = BALANCE.economy.sources.rarity.epicCatchesPerStep;
export const EPIC_BONUS_COINS_PER_STEP = Math.round(
  BALANCE.economy.sources.rarity.epicCoinsPerStep * BALANCE.economy.globalMultiplier,
);
export const LEGENDARY_BONUS_COINS = Math.round(
  BALANCE.economy.sources.rarity.legendaryCoinsPerCatch * BALANCE.economy.globalMultiplier,
);
export const COINS_PER_LEVEL = coinsForRuns(BALANCE.economy.sources.levelRewardRuns);
export const COINS_PER_ACHIEVEMENT = coinsForRuns(BALANCE.economy.sources.achievement.baseRuns);
export const ACHIEVEMENT_COINS_PER_RANK = coinsForRuns(
  BALANCE.economy.sources.achievement.additionalRunsPerRank,
);
export const TALENT_RESET_COST = coinsForRuns(BALANCE.economy.sinks.talentResetRuns);
export const TALENT_COSTS = BALANCE.economy.sinks.talentCosts.map(balancedCoinCost);
export const DAILY_LOGIN_BONUS_COINS = coinsForRuns(BALANCE.economy.sources.daily.loginRuns);
export const DAILY_COMPLETION_BONUS_COINS = coinsForRuns(
  BALANCE.economy.sources.daily.completionRuns,
);
export const DAILY_COMPLETION_BONUS_XP = xpForRuns(BALANCE.progression.xp.dailyCompletionRuns);
export const DAILY_SCORE_BONUS_STEP = scoreForRuns(1);
export const DAILY_SCORE_BONUS_COINS = coinsForRuns(BALANCE.economy.sources.daily.scoreTierRuns);
export const DAILY_SCORE_BONUS_XP = xpForRuns(BALANCE.progression.xp.dailyScoreTierRuns);
export const DAILY_SCORE_BONUS_MAX_TIERS = BALANCE.economy.sources.daily.scoreTierCount;

export const TALENT_POINTS_PER_LEVEL = 1;
export const COINS_PER_EXTRA_TALENT_POINT = 10;
export const COMBO_TIERS = BALANCE.score.comboTiers;
export const SERIES_RAISING_MIN_RARITY_INDEX = BALANCE.score.seriesRaisingMinRarityIndex;
export const WORLD_REWARDS = BALANCE.worlds;

export function achievementCoinReward(rank: number): number {
  return Math.max(0, COINS_PER_ACHIEVEMENT + Math.max(0, rank - 1) * ACHIEVEMENT_COINS_PER_RANK);
}

export function talentCost(currentRank: number): number {
  const index = Math.min(Math.max(0, currentRank), TALENT_COSTS.length - 1);
  return TALENT_COSTS[index] ?? 0;
}

export interface BalanceSnapshot {
  readonly expectedPointsPerCatch: number;
  readonly expectedXpPerCatch: number;
  readonly expectedXpPerRun: number;
  readonly expectedCoinsPerRun: number;
  readonly expectedScorePerRun: number;
  readonly xpToMaxLevel: number;
  readonly runsToMaxLevel: number;
  readonly totalTalentCost: number;
  readonly runsToMaxTalents: number;
}

export function getBalanceSnapshot(): BalanceSnapshot {
  const xpToMaxLevel = Array.from({ length: MAX_LEVEL - 1 }, (_, index) =>
    xpForLevel(index + 1),
  ).reduce((sum, xp) => sum + xp, 0);
  const totalTalentCost = Object.values(BALANCE.talents.maxRanks).reduce(
    (sum, maxRank) => sum + TALENT_COSTS.slice(0, maxRank).reduce((costs, cost) => costs + cost, 0),
    0,
  );

  return {
    expectedPointsPerCatch: EXPECTED_POINTS_PER_CATCH,
    expectedXpPerCatch: EXPECTED_XP_PER_CATCH,
    expectedXpPerRun: EXPECTED_XP_PER_RUN,
    expectedCoinsPerRun: EXPECTED_COINS_PER_RUN,
    expectedScorePerRun: EXPECTED_SCORE_PER_RUN,
    xpToMaxLevel,
    runsToMaxLevel: xpToMaxLevel / Math.max(1, EXPECTED_XP_PER_RUN),
    totalTalentCost,
    runsToMaxTalents: totalTalentCost / Math.max(1, EXPECTED_COINS_PER_RUN),
  };
}

export const BALANCE_SNAPSHOT = getBalanceSnapshot();

export interface BalanceReport extends BalanceSnapshot {
  readonly baselines: typeof BALANCE_BASELINES;
  readonly daily: {
    readonly completionCoins: number;
    readonly completionXp: number;
    readonly scoreTierCoins: number;
    readonly scoreTierXp: number;
    readonly maxCoins: number;
    readonly maxXp: number;
    readonly maxScoreThreshold: number;
  };
  readonly costs: {
    readonly talentReset: number;
    readonly talents: readonly number[];
  };
}

/**
 * Deterministischer Änderungsbericht für die Balance-Kette.
 *
 * Der Bericht liest keine zweite Konfiguration: Alle Werte kommen aus den
 * oben definierten Ableitungen und werden nur für CLI/CI zusammengefasst.
 */
export function getBalanceReport(): BalanceReport {
  const daily = BALANCE.economy.sources.daily;
  const dailyXp = BALANCE.progression.xp;

  return {
    ...getBalanceSnapshot(),
    baselines: BALANCE_BASELINES,
    daily: {
      completionCoins: coinsForRuns(daily.completionRuns),
      completionXp: xpForRuns(dailyXp.dailyCompletionRuns),
      scoreTierCoins: coinsForRuns(daily.scoreTierRuns),
      scoreTierXp: xpForRuns(dailyXp.dailyScoreTierRuns),
      maxCoins: coinsForRuns(daily.completionRuns + daily.scoreTierCount * daily.scoreTierRuns),
      maxXp: xpForRuns(
        dailyXp.dailyCompletionRuns + daily.scoreTierCount * dailyXp.dailyScoreTierRuns,
      ),
      maxScoreThreshold: scoreForRuns(daily.scoreTierCount),
    },
    costs: {
      talentReset: TALENT_RESET_COST,
      talents: TALENT_COSTS,
    },
  };
}

export const BALANCE_REPORT = getBalanceReport();
