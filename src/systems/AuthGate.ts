/**
 * Die eine Antwort auf "darf hier gespielt werden?".
 *
 * Seit ADR-0026 wird nur angemeldet gespielt. Die Pruefung steht an zwei
 * Stellen - beim Start (`BootScene`) und am Menue selbst (`MenuScene`) -,
 * weil der Start nicht der einzige Weg ins Menue ist: Abmelden, ein
 * Rundenende und jeder Ruecksprung aus einem Untermenue landen ebenfalls
 * dort, und eine Supabase-Session kann zwischendurch ablaufen.
 *
 * Zwei Waechter duerfen aber nicht zwei Meinungen haben. Deshalb liegt die
 * Bedingung hier und nicht doppelt in den Scenes - insbesondere die
 * Testausnahme, die sonst genau an einer der beiden Stellen vergessen wuerde.
 */

import { DEBUG_ENABLED } from '@/config/GameConfig';
import * as AuthSystem from '@/systems/AuthSystem';

/**
 * Umgeht die Anmeldepflicht fuer automatisierte Browser-Laeufe.
 *
 * Playtest und Performance-Gate haben keine Supabase-Session und blieben
 * sonst in jeder Suite an der Anmeldung stehen. Der Haken wird **nur** im
 * Dev-Build ausgewertet: Im ausgelieferten Bundle ist `DEBUG_ENABLED` eine
 * Konstante `false`, der Zweig wird wegoptimiert und die Sperre laesst sich
 * nicht per URL umgehen.
 */
function skipAuthRequested(): boolean {
  if (!DEBUG_ENABLED) return false;
  return new URLSearchParams(window.location.search).has('skipAuth');
}

/** Ob der Spielbereich (Menue und alles dahinter) betreten werden darf. */
export function mayEnterGame(): boolean {
  return AuthSystem.isSignedIn() || skipAuthRequested();
}
