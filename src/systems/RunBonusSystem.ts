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
  RUN_BONUS_COMPLETION,
  RUN_BONUS_MAX_SCORE_RUNS,
  RUN_BONUS_MAX_XP_RUNS,
  RUN_BONUS_RARITY_TIERS,
  RUN_BONUS_SERIES_TIERS,
  scoreForRuns,
  xpForRuns,
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
 *
 * **Gerechnet wird in Run-Anteilen, gerundet genau einmal.** Die Zahlen an
 * den Einzelposten sind nur fuer die Anzeige; die Summe entsteht aus den
 * Anteilen, nicht aus ihnen. Sonst weicht sie von der serverseitigen
 * Rechnung ab, die es genauso macht - und bei der XP entscheidet der Server,
 * was im Konto landet.
 */
export function calculateRunBonus(
  stats: Pick<RunStats, 'collected' | 'bestCombo'>,
): RunBonusResult {
  const entries: RunBonusEntry[] = [];
  let scoreRuns = 0;
  let xpRuns = 0;
  const total = Object.values(stats.collected).reduce<number>(
    (sum, count) => sum + safeCount(count),
    0,
  );

  const erfasse = (tier: RunBonusTier, eintrag: Omit<RunBonusEntry, 'score' | 'xp'>): void => {
    scoreRuns += tier.scoreRuns;
    xpRuns += tier.xpRuns;
    entries.push({
      ...eintrag,
      score: scoreForRuns(tier.scoreRuns),
      xp: xpForRuns(tier.xpRuns),
    });
  };

  // Ein abgeschlossener, echter Lauf soll immer sichtbar belohnt werden.
  // Die weiteren Gruppen bleiben leistungsabhaengige Zuschlaege darauf.
  if (total > 0)
    erfasse(RUN_BONUS_COMPLETION, {
      id: 'completion',
      label: 'Run abgeschlossen',
      detail: `${total} Relikte`,
    });

  for (const [rarityId, tiers] of Object.entries(RUN_BONUS_RARITY_TIERS)) {
    const count = safeCount(stats.collected[rarityId as RarityId]);
    const tier = highestTier(tiers, count);
    if (!tier) continue;
    erfasse(tier, {
      id: `rarity:${rarityId}`,
      label: RARITY_LABELS[rarityId] ?? rarityId,
      detail: `${count} Stueck`,
    });
  }

  const bestCombo = safeCount(stats.bestCombo);
  const seriesTier = highestTier(RUN_BONUS_SERIES_TIERS, bestCombo);
  if (seriesTier)
    erfasse(seriesTier, { id: 'series', label: 'Serienbonus', detail: `Kette ${bestCombo}` });

  const collectionTier = highestTier(RUN_BONUS_COLLECTION_TIERS, total);
  if (collectionTier)
    erfasse(collectionTier, {
      id: 'collection',
      label: 'Sammelbonus',
      detail: `${total} Relikte`,
    });

  return {
    entries,
    score: scoreForRuns(Math.min(scoreRuns, RUN_BONUS_MAX_SCORE_RUNS)),
    xp: xpForRuns(Math.min(xpRuns, RUN_BONUS_MAX_XP_RUNS)),
    capped: scoreRuns > RUN_BONUS_MAX_SCORE_RUNS || xpRuns > RUN_BONUS_MAX_XP_RUNS,
  };
}
