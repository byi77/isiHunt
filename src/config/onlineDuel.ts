/**
 * Netzwerk-Duell: zwei Spieler, zwei Geraete, gleicher Seed, ueber Internet.
 *
 * Getrennt von `challenge.ts`, weil dort die Fairness-Regeln des *lokalen*
 * Duells begruendet stehen (ein Geraet, Uebergabe) - dieses Modul enthaelt
 * nur die zusaetzlichen Werte, die aus der Netzwerkuebertragung selbst
 * entstehen. `CHALLENGE_DURATION_MS`/`CHALLENGE_PLAYER_COUNT` gelten
 * unveraendert weiter und werden von dort importiert, nicht dupliziert.
 */

/**
 * Gueltigkeit eines Duell-Raum-Codes in Minuten.
 *
 * Kuerzer als der Sync-Code (15 Minuten, `SYNC_CODE_LENGTH` in
 * `config/backend.ts`): ein Duell-Beitritt ist ein aktiver, unmittelbarer
 * Vorgang ("ich rufe mein Geschwister gerade an"), kein "vielleicht spaeter
 * einloesen"-Fall wie ein Spielstand-Sync.
 */
export const DUEL_ROOM_CODE_TTL_MINUTES = 10;

/**
 * Vorlauf zwischen dem serverseitig gesetzten `start_at` und dem
 * tatsaechlichen Rundenstart, in Millisekunden.
 *
 * Muss grosszuegig genug sein, dass beide Clients die Zielzeit sicher vor
 * ihrem Eintreffen empfangen und ihren lokalen Countdown darauf ausrichten
 * koennen - typische Mobilfunklatenz liegt deutlich darunter. Kritisch ist
 * hier nicht Millisekundengenauigkeit (anders als bei einem kompetitiven
 * Shooter), sondern dass beide Spieler ungefaehr gleichzeitig denselben Seed
 * durchlaufen.
 */
export const ONLINE_DUEL_START_LEAD_MS = 5000;

/**
 * Hoechstens alle X Millisekunden ein Score-Broadcast waehrend des Runs.
 *
 * `ScoreChanged` feuert bei jedem einzelnen Sammel-Treffer, potenziell
 * mehrmals pro Sekunde bei einem Kettenzug. Ohne Takt wuerde das den
 * Realtime-Kanal mit Nachrichten fluten, ohne dass die Anzeige beim Gegner
 * merklich fluessiger wuerde - ein verlorenes Zwischenupdate ist unkritisch,
 * der naechste Takt liefert den aktuellen Stand nach.
 */
export const ONLINE_DUEL_SCORE_BROADCAST_INTERVAL_MS = 400;

/**
 * Ab wann ein ausgebliebener Live-Stand als "Verbindung weg" gilt.
 *
 * Der Gegner sendet alle `ONLINE_DUEL_SCORE_BROADCAST_INTERVAL_MS` - bleibt
 * das mehrfach hintereinander aus, ist die Verbindung gestoert. Grosszuegig
 * gegenueber dem Sendetakt bemessen (das Vielfache, nicht das Doppelte):
 * Mobilfunk laesst einzelne Nachrichten ausfallen, ohne dass die Verbindung
 * wirklich weg ist. Eine Anzeige, die bei jedem Funkloch "Verbindung weg"
 * blinkt, ist schlechter als eine, die zwei Sekunden spaeter recht hat.
 *
 * Ergaenzt die Presence-Meldung, ersetzt sie nicht: Presence erkennt ein
 * sauberes Verlassen des Kanals, dieser Wert auch ein stilles Verstummen
 * (Funkloch, eingefrorene App, leerer Akku) - dort kommt nie ein `leave`.
 */
export const ONLINE_DUEL_LIVE_STALE_MS = 3_000;

/**
 * Anzahl Messungen zur Bestimmung des Uhr-Offsets gegenueber der
 * Supabase-Serverzeit.
 *
 * Der Median mehrerer Messungen (statt einer einzelnen) daempft
 * Ausreisser durch Mobilfunk-Jitter auf einer einzelnen Anfrage.
 */
export const ONLINE_DUEL_CLOCK_SYNC_SAMPLES = 3;

/**
 * Wie lange in der Lobby auf "beide Spieler bereit" gewartet wird, bevor
 * zurueck zur Anzeige gewechselt wird, statt endlos zu warten.
 */
export const ONLINE_DUEL_READY_TIMEOUT_MS = 10_000;

/**
 * Polling-Takt fuer die serverseitig gesetzte Startzeit, solange kein
 * `start`-Broadcast eingetroffen ist.
 *
 * `channel.send()` von Supabase Realtime loest ohne `broadcast.ack`-Option
 * sofort mit "ok" auf, sobald die Nachricht lokal in die Warteschlange
 * gestellt wurde - nicht wenn sie beim Empfaenger ankam (siehe
 * `RealtimeChannel.send()`). Ein verlorener `start`-Broadcast liess den
 * nicht sendenden Client bisher unbegrenzt in der Lobby haengen, obwohl
 * `set_duel_start_time` die Zeit bereits erfolgreich in der Datenbank
 * abgelegt hatte (belegt durch einen Geraetetest 2026-08-18: Gastgeber lief
 * durch, Gast blieb bei "Warte auf Geschwister" haengen). `getRoomStatus()`
 * dient bereits als Fallback fuer den Gastgeber selbst (siehe
 * `pollAndSetStartTime`); derselbe Weg schliesst jetzt auch die
 * Broadcast-Luecke fuer den empfangenden Client.
 */
export const ONLINE_DUEL_START_POLL_INTERVAL_MS = 1_500;

/**
 * Polling-Takt fuer das Rundenergebnis des Gegners im Ergebnisbildschirm.
 *
 * Groesser als `ONLINE_DUEL_START_POLL_INTERVAL_MS`, weil die Wartezeit hier
 * eine voellig andere Groessenordnung hat: auf die Startzeit wartet man
 * Sekunden, auf das Ergebnis des Gegners bis zu einer vollen Rundenlaenge
 * (`CHALLENGE_DURATION_MS`), falls er spaeter gestartet ist oder pausiert
 * hat. Ein 1,5-Sekunden-Takt wuerde ueber diese Dauer Dutzende ueberfluessiger
 * Anfragen erzeugen; drei Sekunden sind fuer einen Ergebnisbildschirm immer
 * noch unmittelbar genug.
 */
export const ONLINE_DUEL_RESULT_POLL_INTERVAL_MS = 3_000;

/**
 * Obergrenze fuer das Ergebnis-Polling.
 *
 * Ohne Grenze fragte ein Geraet endlos weiter, wenn der Gegner die App
 * geschlossen hat - genau die Luecke, die beim Ready-Timeout schon einmal
 * auftrat (siehe `cleanupLobby`-Kommentar in `OnlineDuelScene`). Bemessen
 * auf eine volle Rundenlaenge plus Puffer: laenger als das kann ein noch
 * laufender Gegner nicht brauchen, also ist danach die Aussage "er ist weg"
 * richtiger als weiteres Warten.
 */
export const ONLINE_DUEL_RESULT_TIMEOUT_MS = 120_000;
