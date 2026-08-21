/**
 * Gibt den aktuellen Balance-Snapshot aus der echten TypeScript-Ableitung aus.
 *
 * Bewusst kein zweites Berechnungsmodell: Node laedt `balance.ts` direkt mit
 * dem eingebauten TypeScript-Stripper. Die Shopwerte kommen ebenfalls aus der
 * laufenden Konfiguration und nicht aus einer kopierten Preisliste.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { BALANCE, BALANCE_REPORT, balancedCoinCost } = await import('../src/config/balance.ts');

const shopSource = readFileSync(
  fileURLToPath(new URL('../src/config/shop.ts', import.meta.url)),
  'utf8',
);
const colorStart = shopSource.indexOf('const SHIP_COLORS_REFERENCE');
const auraStart = shopSource.indexOf('const SHIP_AURAS_REFERENCE');

function referenceCosts(source) {
  return [...source.matchAll(/\bcost:\s*([0-9][0-9_]*)/g)].map((match) => {
    const referenceCost = Number(match[1].replaceAll('_', ''));
    return { referenceCost, cost: balancedCoinCost(referenceCost) };
  });
}

const shapeCosts = referenceCosts(shopSource.slice(0, colorStart));
const colorCosts = referenceCosts(
  shopSource.slice(colorStart, auraStart > colorStart ? auraStart : shopSource.length),
);
const auraCosts = auraStart > colorStart ? referenceCosts(shopSource.slice(auraStart)) : [];

const firstPaid = (entries) => entries.find((entry) => entry.cost > 0) ?? null;
const mostExpensive = (entries) =>
  entries.length > 0
    ? entries.reduce((highest, entry) => (entry.cost > highest.cost ? entry : highest))
    : null;

const report = {
  source: {
    file: 'src/config/balance-data.json',
    expectedCatches: BALANCE.run.expectedCatches,
    economyCatches: BALANCE.run.economyCatches,
    referenceComboMultiplier: BALANCE.run.referenceComboMultiplier,
  },
  baselines: BALANCE_REPORT.baselines,
  runs: {
    expectedPointsPerCatch: BALANCE_REPORT.expectedPointsPerCatch,
    expectedXpPerCatch: BALANCE_REPORT.expectedXpPerCatch,
    expectedXpPerRun: BALANCE_REPORT.expectedXpPerRun,
    expectedCoinsPerRun: BALANCE_REPORT.expectedCoinsPerRun,
    expectedScorePerRun: BALANCE_REPORT.expectedScorePerRun,
    runsToMaxLevel: BALANCE_REPORT.runsToMaxLevel,
    runsToMaxTalents: BALANCE_REPORT.runsToMaxTalents,
  },
  daily: BALANCE_REPORT.daily,
  costs: {
    talentReset: BALANCE_REPORT.costs.talentReset,
    talents: BALANCE_REPORT.costs.talents,
    shop: {
      firstPaidShape: firstPaid(shapeCosts),
      mostExpensiveShape: mostExpensive(shapeCosts),
      firstPaidColor: firstPaid(colorCosts),
      mostExpensiveColor: mostExpensive(colorCosts),
      firstPaidAura: firstPaid(auraCosts),
      mostExpensiveAura: mostExpensive(auraCosts),
    },
  },
};

console.log(JSON.stringify(report, null, 2));
