/**
 * Der lokale Duell-Modus: zwei bis vier Spieler, ein Geraet, dieselbe Jagd.
 *
 * Ablauf: Spieler 1 spielt einen Durchgang, gibt das Geraet weiter, Spieler 2
 * spielt denselben Durchgang. Danach wird verglichen.
 *
 * Die drei Fairness-Regeln stehen hier, weil sie Design sind und nicht Technik:
 *
 * 1. **Gleicher Seed.** Beide Spieler bekommen dieselbe Abfolge von Relikten -
 *    gleiche Seltenheiten zur gleichen Sekunde. Ohne das waere ein Duell ein
 *    Wuerfelspiel darum, wer das legendaere Relikt geschenkt bekommt.
 * 2. **Temporäre Talente.** Vor jedem Durchgang verteilen beide Spieler
 *    unabhängig voneinander bis zu zehn Punkte. So haben beide dieselbe
 *    Auswahlchance, ohne dass der dauerhafte Spielstand einen Vorteil gibt.
 * 3. **Keine normale Progression.** Ein Spielerduell vergibt weder XP noch
 *    Bestwerte. Das Bot-Duell ist die bewusste Ausnahme: Ein Sieg gibt einen
 *    einmaligen Bonus.
 */

/** Standardanzahl Spieler in einem lokalen Duell. */
export const CHALLENGE_DEFAULT_PLAYER_COUNT = 2;
export const CHALLENGE_MIN_PLAYER_COUNT = 2;
export const CHALLENGE_MAX_PLAYER_COUNT = 4;
/** Legacy-Konstante fuer den Standardfall des Zwei-Spieler-Duells. */
export const CHALLENGE_PLAYER_COUNT = CHALLENGE_DEFAULT_PLAYER_COUNT;

/**
 * Laenge eines Duell-Durchgangs in Millisekunden.
 *
 * Im Duell zaehlt nur ein einziger Durchgang pro Person. Mehr Zeit heisst mehr
 * Spawns und weniger Streuung - das Ergebnis bildet Koennen ab statt Glueck.
 */
export const CHALLENGE_DURATION_MS = 90_000;

/** Punktebudget fuer den temporaeren Talent-Build vor einem Duell. */
export const DUEL_TALENT_POINT_BUDGET = 10;

/** Zeit fuer die Talentvergabe vor dem Start bzw. einem Rematch. */
export const DUEL_TALENT_DRAFT_DURATION_MS = 20_000;

/** Anzeigenamen der Spieler. Reihenfolge = Spielreihenfolge. */
export const CHALLENGE_PLAYER_LABELS: readonly string[] = [
  'Spieler 1',
  'Spieler 2',
  'Spieler 3',
  'Spieler 4',
];

export function challengePlayerLabel(index: number): string {
  return CHALLENGE_PLAYER_LABELS[index] ?? `Spieler ${index + 1}`;
}

/**
 * Wie stark ein Bot je Schwierigkeitsstufe im Verhaeltnis zur echten
 * Spielerleistung abschneidet (1 = gleichauf).
 */
export const CHALLENGE_BOT_DEFAULT_DIFFICULTY = 'normal' as const;
export const CHALLENGE_BOT_DIFFICULTY_RATIOS = { easy: 0.72, normal: 0.96, hard: 1.04 } as const;
/** Modulo-Basis fuer die deterministische Bot-Streuung aus dem Seed-Hash. */
export const CHALLENGE_BOT_NOISE_MODULO = 13;
/** Verschiebt den Modulo-Rest auf ein symmetrisches Intervall um 0. */
export const CHALLENGE_BOT_NOISE_OFFSET = 6;
/** Teiler, der den Streuungsschritt auf einen Prozentanteil skaliert. */
export const CHALLENGE_BOT_NOISE_SCALE = 100;
