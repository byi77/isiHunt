/**
 * Abschlusspraemien eines Runs: was die Ausbeute ueber den laufenden
 * Punktestand hinaus noch wert war.
 *
 * Waehrend des Runs zaehlt jeder Fang einzeln. Am Ende kommt die Frage dazu,
 * was aus der Summe geworden ist - viele Seltene, eine lange Kette, eine
 * grosse Menge. Der Ergebnisbildschirm zerlegt das in benannte Posten, statt
 * eine gewachsene Zahl ohne Begruendung zu zeigen.
 *
 * Reine Rechnung ohne Phaser: Dieselben Regeln laufen serverseitig in
 * `submit_progress_event` noch einmal (`supabase/phase_2_52_run_bonus.sql`).
 * Weichen beide ab, sieht ein angemeldeter Spieler eine Zahl, die sein Konto
 * nie erreicht - deshalb stammen beide Seiten aus derselben Balance-Datei und
 * der `balance:check` haelt sie zusammen.
 *
 * Bedingungen duerfen nur aus dem lesen, was auch beim Server ankommt:
 * `collected`, `bestCombo` und `worldId`. `missed` und `bestMultiplier`
 * stehen im Ereignis nicht und taugen daher nicht als Grundlage.
 */

import {
  RUN_BONUS_COLLECTION_TIERS,
  RUN_BONUS_MAX_SCORE,
  RUN_BONUS_MAX_XP,
  RUN_BONUS_RARITY_TIERS,
  RUN_BONUS_SERIES_TIERS,
  type RunBonusTier,
} from '@/config/balance';
import type { RarityId } from '@/config/rarities';
import type { RunStats } from '@/types';

/** Ein benannter Posten der Abschlussrechnung. */
export interface RunBonusEntry {
  /** Stabile Kennung - die Anzeige uebersetzt sie, Tests pruefen sie. */
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly score: number;
  readonly xp: number;
}

export interface RunBonusResult {
  readonly entries: readonly RunBonusEntry[];
  readonly score: number;
  readonly xp: number;
  /**
   * Ob der Deckel die Summe gekuerzt hat.
   *
   * Die Anzeige braucht das: Die Einzelposten bleiben stehen, addieren sich
   * dann aber auf mehr als die genannte Summe. Unkommentiert sieht das wie
   * ein Rechenfehler aus - deshalb sagt der Ergebnisbildschirm es dazu.
   */
  readonly capped: boolean;
}

const RARITY_LABELS: Record<string, string> = {
  rare: 'Seltene Beute',
  epic: 'Epische Beute',
  legendary: 'Legendaere Beute',
};

/**
 * Die hoechste erreichte Stufe, nicht die Summe aller erreichten.
 *
 * Gestaffelte Stufen bauen aufeinander auf: Wer die dritte schafft, hat die
 * ersten beiden zwangslaeufig auch erfuellt. Aufsummiert zahlte dieselbe
 * Leistung dreimal.
 */
function highestTier(tiers: readonly RunBonusTier[], value: number): RunBonusTier | null {
  let best: RunBonusTier | null = null;
  for (const tier of tiers) if (value >= tier.minCount) best = tier;
  return best;
}

function safeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
}

/**
 * Rechnet die Abschlusspraemien eines Runs aus.
 *
 * Der Deckel begrenzt die Summe, nicht die einzelnen Posten: Ein
 * Ausnahmerun soll sich lohnen, aber kein Vielfaches eines normalen Runs
 * ausschuetten. Die Anzeige zeigt trotzdem alle erreichten Posten - gekuerzt
 * wird erst die Summe, sonst verschwindet eine erreichte Leistung wortlos.
 */
export function calculateRunBonus(
  stats: Pick<RunStats, 'collected' | 'bestCombo'>,
): RunBonusResult {
  const entries: RunBonusEntry[] = [];

  for (const [rarityId, tiers] of Object.entries(RUN_BONUS_RARITY_TIERS)) {
    const count = safeCount(stats.collected[rarityId as RarityId]);
    const tier = highestTier(tiers, count);
    if (!tier) continue;
    entries.push({
      id: `rarity:${rarityId}`,
      label: RARITY_LABELS[rarityId] ?? rarityId,
      detail: `${count} Stueck`,
      score: tier.score,
      xp: tier.xp,
    });
  }

  const bestCombo = safeCount(stats.bestCombo);
  const seriesTier = highestTier(RUN_BONUS_SERIES_TIERS, bestCombo);
  if (seriesTier)
    entries.push({
      id: 'series',
      label: 'Serienbonus',
      detail: `Kette ${bestCombo}`,
      score: seriesTier.score,
      xp: seriesTier.xp,
    });

  const total = Object.values(stats.collected).reduce<number>(
    (sum, count) => sum + safeCount(count),
    0,
  );
  const collectionTier = highestTier(RUN_BONUS_COLLECTION_TIERS, total);
  if (collectionTier)
    entries.push({
      id: 'collection',
      label: 'Sammelbonus',
      detail: `${total} Relikte`,
      score: collectionTier.score,
      xp: collectionTier.xp,
    });

  const rawScore = entries.reduce((sum, entry) => sum + entry.score, 0);
  const rawXp = entries.reduce((sum, entry) => sum + entry.xp, 0);
  return {
    entries,
    score: Math.min(rawScore, RUN_BONUS_MAX_SCORE),
    xp: Math.min(rawXp, RUN_BONUS_MAX_XP),
    capped: rawScore > RUN_BONUS_MAX_SCORE || rawXp > RUN_BONUS_MAX_XP,
  };
}
