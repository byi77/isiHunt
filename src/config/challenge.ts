/**
 * Der Duell-Modus: zwei Spieler, ein Geraet, dieselbe Jagd.
 *
 * Ablauf: Spieler 1 spielt einen Durchgang, gibt das Geraet weiter, Spieler 2
 * spielt denselben Durchgang. Danach wird verglichen.
 *
 * Die drei Fairness-Regeln stehen hier, weil sie Design sind und nicht Technik:
 *
 * 1. **Gleicher Seed.** Beide Spieler bekommen dieselbe Abfolge von Relikten -
 *    gleiche Seltenheiten zur gleichen Sekunde. Ohne das waere ein Duell ein
 *    Wuerfelspiel darum, wer das legendaere Relikt geschenkt bekommt.
 * 2. **Keine Talente.** Beide spielen mit den Grundwerten der Figur. Der
 *    Geraetebesitzer haette sonst durch seinen Spielstand einen Vorteil, den
 *    der Gast nicht ausgleichen kann.
 * 3. **Keine Progression.** Ein Duell vergibt weder XP noch Bestwerte. Die
 *    Haelfte der Durchgaenge wird von jemandem gespielt, dem der Spielstand
 *    nicht gehoert - sie duerfen ihn deshalb nicht veraendern.
 */

/** Anzahl Spieler in einem Duell. */
export const CHALLENGE_PLAYER_COUNT = 2;

/**
 * Laenge eines Duell-Durchgangs in Millisekunden.
 *
 * Im Duell zaehlt nur ein einziger Durchgang pro Person. Mehr Zeit heisst mehr
 * Spawns und weniger Streuung - das Ergebnis bildet Koennen ab statt Glueck.
 */
export const CHALLENGE_DURATION_MS = 90_000;

/** Anzeigenamen der Spieler. Reihenfolge = Spielreihenfolge. */
export const CHALLENGE_PLAYER_LABELS: readonly string[] = ['Spieler 1', 'Spieler 2'];

export function challengePlayerLabel(index: number): string {
  return CHALLENGE_PLAYER_LABELS[index] ?? `Spieler ${index + 1}`;
}
