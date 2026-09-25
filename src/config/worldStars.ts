/**
 * Drei Sterne je Welt: zwei Punkteschwellen und der Weltauftrag.
 *
 * Die Sterne geben den Welten einen Grund, sie mehr als einmal zu spielen,
 * und den hoeheren einen Grund, sie ueberhaupt zu betreten: Dort warten noch
 * leere Sterne. Gespeichert werden sie als Erfolge, damit Server, Coins und
 * Geraeteabgleich den bestehenden Weg nehmen (`achievements.ts`).
 *
 * Die Zahlen stehen in `balance-data.json` unter `worldStars`, weil der Server
 * dieselben Werte aus `balance_config()` liest (`progress_world_star_is_valid`).
 */

import type { RunStats } from '@/types';
import { BALANCE } from './balance';

export type WorldGoalMetric = 'collected' | 'rarePlus' | 'epicPlus' | 'combo' | 'score';

export interface WorldStarDef {
  readonly worldId: string;
  /** ASCII-Kurzname fuer die Erfolgs-ID - Welt-IDs koennen Umlaute tragen. */
  readonly slug: string;
  /** Punkte fuer den ersten und zweiten Stern. */
  readonly scores: readonly [number, number];
  readonly goal: { readonly metric: WorldGoalMetric; readonly target: number };
  /** Hebt den Erfolgsrang und damit die Coin-Praemie spaeter Welten an. */
  readonly rankOffset: number;
}

export const STARS_PER_WORLD = 3;

export const WORLD_STARS: readonly WorldStarDef[] = Object.entries(BALANCE.worldStars).map(
  ([worldId, entry]) => ({
    worldId,
    slug: entry.slug,
    scores: [entry.scores[0]!, entry.scores[1]!] as const,
    goal: { metric: entry.goal.metric as WorldGoalMetric, target: entry.goal.target },
    rankOffset: entry.rankOffset,
  }),
);

const STARS_BY_WORLD: Readonly<Record<string, WorldStarDef>> = Object.fromEntries(
  WORLD_STARS.map((def) => [def.worldId, def]),
);

export function getWorldStars(worldId: string): WorldStarDef | null {
  return STARS_BY_WORLD[worldId] ?? null;
}

/** Anzeige des Weltauftrags; Weltauftrag und dritter Stern teilen denselben Text. */
export const WORLD_GOAL_TEXT: Readonly<
  Record<WorldGoalMetric, { readonly unit: string; readonly describe: (target: string) => string }>
> = {
  collected: { unit: 'Relikte', describe: (t) => `Fange ${t} Relikte in einer Jagd.` },
  rarePlus: { unit: 'seltene Funde', describe: (t) => `Fange ${t} seltene oder bessere Relikte.` },
  epicPlus: { unit: 'epische Funde', describe: (t) => `Fange ${t} epische oder bessere Relikte.` },
  combo: { unit: 'Serie', describe: (t) => `Erreiche eine Serie von ${t}.` },
  score: { unit: 'Punkte', describe: (t) => `Erreiche ${t} Punkte in einer Jagd.` },
};

/** Umkehrung von `worldStarAchievementId` - fuer die Erfolgsanzeige. */
export function parseWorldStarAchievementId(
  id: string,
): { readonly def: WorldStarDef; readonly star: number } | null {
  const match = /^star_([a-z]+)_([1-3])$/.exec(id);
  if (!match) return null;
  const def = WORLD_STARS.find((entry) => entry.slug === match[1]);
  return def ? { def, star: Number(match[2]) } : null;
}

/** @param star 1 bis 3 */
export function worldStarAchievementId(def: WorldStarDef, star: number): string {
  return `star_${def.slug}_${star}`;
}

/**
 * Stand des Weltauftrags in einem Run.
 *
 * Punkte zaehlen ohne Abschlusspraemie, damit der Auftrag an der Jagd haengt
 * und nicht an der Rechnung danach. Der Server kennt nur die Gesamtpunkte und
 * prueft dadurch grosszuegiger - nie strenger als der Client.
 */
export function worldGoalValue(metric: WorldGoalMetric, run: RunStats): number {
  switch (metric) {
    case 'collected':
      return run.totalCollected;
    case 'rarePlus':
      return run.collected.rare + run.collected.epic + run.collected.legendary;
    case 'epicPlus':
      return run.collected.epic + run.collected.legendary;
    case 'combo':
      return run.bestCombo;
    case 'score':
      return run.score - (run.bonus?.score ?? 0);
  }
}

/**
 * Ob ein Run den Stern verdient.
 *
 * Endlos-Runden zaehlen nicht: Sie dauern 30 statt 90 Sekunden und laufen
 * serverseitig ueber `submit_endless_round`, das keine Sterne kennt.
 */
export function earnsWorldStar(def: WorldStarDef, star: number, run: RunStats): boolean {
  if (run.worldId !== def.worldId || run.endlessRound !== undefined) return false;
  if (star === 1) return run.score >= def.scores[0];
  if (star === 2) return run.score >= def.scores[1];
  if (star === 3) return worldGoalValue(def.goal.metric, run) >= def.goal.target;
  return false;
}

/** Wie viele der drei Sterne einer Welt freigeschaltet sind. */
export function worldStarCount(unlockedAchievements: readonly string[], worldId: string): number {
  const def = getWorldStars(worldId);
  if (!def) return 0;
  let count = 0;
  for (let star = 1; star <= STARS_PER_WORLD; star++) {
    if (unlockedAchievements.includes(worldStarAchievementId(def, star))) count++;
  }
  return count;
}

/** Zeile wie "★★☆" fuer Menue, Weltinfo und Sammlung. */
export function worldStarLabel(count: number): string {
  const filled = Math.max(0, Math.min(STARS_PER_WORLD, count));
  return '★'.repeat(filled) + '☆'.repeat(STARS_PER_WORLD - filled);
}
