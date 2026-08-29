import { PLAYER_NAME_MAX_LENGTH } from '@/config/backend';

/** Maximale Anzahl von Ziffern in einem sichtbaren Spielernamen. */
export const PLAYER_NAME_MAX_DIGITS = 4;

/** Prueft einen bereits getrimmten Namen ohne ihn dabei zu veraendern. */
export function isValidPlayerName(value: string, minimumLength = 1): boolean {
  return (
    value.length >= minimumLength &&
    value.length <= PLAYER_NAME_MAX_LENGTH &&
    /^[A-Za-z0-9]+$/.test(value) &&
    (value.match(/[0-9]/g)?.length ?? 0) <= PLAYER_NAME_MAX_DIGITS
  );
}

/**
 * Bereinigt einen sichtbaren Spielernamen auf die gemeinsame Spielregel.
 *
 * Es bleiben nur ASCII-Buchstaben und Ziffern erhalten. Ziffern nach der
 * vierten werden entfernt; die Grossschreibung der weiteren Buchstaben bleibt
 * unangetastet. Beginnt der bereinigte Name mit einem Buchstaben, wird dieser
 * immer grossgeschrieben.
 */
export function sanitizePlayerName(raw: string): string {
  let digits = 0;
  const filtered = raw
    .split('')
    .filter((character) => {
      if (!/[A-Za-z0-9]/.test(character)) return false;
      if (/[0-9]/.test(character)) {
        if (digits >= PLAYER_NAME_MAX_DIGITS) return false;
        digits += 1;
      }
      return true;
    })
    .join('')
    .slice(0, PLAYER_NAME_MAX_LENGTH);

  if (!filtered) return '';
  return /^[A-Za-z]/.test(filtered) ? filtered[0]!.toUpperCase() + filtered.slice(1) : filtered;
}
