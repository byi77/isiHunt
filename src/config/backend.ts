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

/** Obergrenze fuer den sichtbaren Spielernamen. */
export const PLAYER_NAME_MAX_LENGTH = 16;

/**
 * Zeitlimit fuer jede Netzanfrage.
 *
 * Ohne Limit haengt die Oberflaeche bei schlechtem Empfang beliebig lange. Fuenf
 * Sekunden sind lang genug fuer ein langsames Mobilfunknetz und kurz genug,
 * dass sich das Spiel nicht kaputt anfuehlt.
 */
export const BACKEND_TIMEOUT_MS = 5000;

/**
 * Wartezeiten fuer automatische Sync-Wiederholungen nach einem Fehlschlag.
 *
 * Direkt nach einem `online`-Ereignis meldet iOS das Netz oft schon, bevor
 * die Verbindung zu Supabase wirklich steht - ein erster Versuch kann am
 * `BACKEND_TIMEOUT_MS`-Limit scheitern, obwohl das Geraet Sekunden spaeter
 * problemlos verbindet. Ohne Wiederholung blieb ein Offline-Run dann bis zum
 * naechsten `online`-Ereignis oder App-Neustart in der Outbox stehen -
 * beobachtet 2026-08-17 (TODO.md, Phase-2.6-Testbefund).
 */
export const SYNC_RETRY_DELAYS_MS = [5000, 15000, 60000];

/**
 * Wie weit ein Tagesschluessel vom heutigen Tag abweichen darf, damit der
 * Tagesbonus noch eingeloest werden kann.
 *
 * **Muss zu `daily_key_is_plausible()` passen**
 * (`supabase/phase_2_13_daily_key_window.sql`, dort ein Tag in beide
 * Richtungen). Der Server bleibt die verbindliche Instanz; dieser Wert
 * erspart nur den aussichtslosen Aufruf und verhindert, dass ein alter
 * Schluessel dauerhaft in der Outbox haengen bleibt.
 *
 * Ein Tag Toleranz deckt drei legitime Faelle ab: der Server rechnet in UTC
 * und ist der lokalen Zeit bis zu zwei Stunden hinterher, ein Lauf kann ueber
 * Mitternacht gehen, und ein Offline-Lauf wird unter Umstaenden erst am
 * naechsten Tag hochgeladen.
 */
export const DAILY_KEY_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Mindestabstand zwischen zwei vollstaendigen Abgleichen im Menue.
 *
 * **Warum es den braucht.** `MenuScene.create()` startet einen Abgleich, und
 * `create()` laeuft bei **jeder** Rueckkehr ins Menue - nach jedem Run, nach
 * jedem Bildschirmwechsel, nach jedem Zurueck-Knopf. Ein Debug-Report vom
 * 2026-08-21 zeigte dadurch rund 25 vollstaendige Durchlaeufe in zehn
 * Sekunden, zusammen etwa 100 Backend-Aufrufe - ausgeloest allein durch
 * Herumtippen im Menue.
 *
 * Das vorhandene `saveSyncBusy` schuetzte dagegen nicht: Es wird erst in
 * `checkCloudSave()` gesetzt und ist nach jedem Durchlauf wieder `false` -
 * es verhindert *parallele*, nicht *aufeinanderfolgende* Laeufe. Im Report
 * stand bei jedem einzelnen `sync:start` entsprechend `saveSyncBusy: false`.
 *
 * 30 Sekunden sind lang genug, um das Tippen im Menue zu daempfen, und kurz
 * genug, dass ein Wechsel auf ein zweites Geraet sich noch wie sofort
 * anfuehlt. Ausdrueckliche Anlaesse (Netz kehrt zurueck, Nutzer entscheidet
 * ueber einen Cloud-Stand) umgehen die Sperre bewusst.
 */
export const SYNC_MIN_INTERVAL_MS = 30_000;
