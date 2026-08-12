/**
 * Zugang zum Online-Dienst (Supabase).
 *
 * ## Warum die Zugangsdaten im Client stehen duerfen
 *
 * Der `anon`-Schluessel ist dafuer gemacht, im ausgelieferten JavaScript zu
 * stehen. Er gewaehrt fuer sich genommen keine Rechte - was mit ihm moeglich
 * ist, legen die Zugriffsregeln der Datenbank fest (`supabase/schema.sql`).
 *
 * Der `service_role`-Schluessel umgeht diese Regeln vollstaendig und darf
 * deshalb **niemals** hier landen.
 *
 * ## Ohne Zugangsdaten
 *
 * Fehlen die Werte, laeuft das Spiel vollstaendig weiter - nur die
 * Online-Funktionen blenden sich aus. Das haelt das Projekt fuer jeden
 * lauffaehig, der es ohne eigenes Supabase-Projekt auscheckt, und macht den
 * Ausfall des Dienstes zu einem erwarteten Zustand statt zu einem Fehler.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const BACKEND_URL = url;
export const BACKEND_ANON_KEY = anonKey;

/** Sind beide Werte gesetzt? Steuert, ob Online-Knoepfe ueberhaupt erscheinen. */
export const isBackendConfigured = url.length > 0 && anonKey.length > 0;

/** Wie viele Eintraege eine Bestenliste zeigt. */
export const LEADERBOARD_LIMIT = 10;

/** Laenge des Sync-Codes. Muss zur Pruefregel in schema.sql passen. */
export const SYNC_CODE_LENGTH = 6;

/**
 * Zeichenvorrat des Sync-Codes: Ziffern und Grossbuchstaben **ohne** I, O und
 * L. Die verwechselt man auf einem Handybildschirm mit 1 und 0 - und ein Code,
 * den man falsch abliest, ist schlimmer als ein laengerer Code.
 */
export const SYNC_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Obergrenze fuer den Spielernamen. Muss zur Pruefregel in schema.sql passen. */
export const PLAYER_NAME_MAX_LENGTH = 16;

/**
 * Zeitlimit fuer jede Netzanfrage.
 *
 * Ohne Limit haengt die Oberflaeche bei schlechtem Empfang beliebig lange. Fuenf
 * Sekunden sind lang genug fuer ein langsames Mobilfunknetz und kurz genug,
 * dass sich das Spiel nicht kaputt anfuehlt.
 */
export const BACKEND_TIMEOUT_MS = 5000;
