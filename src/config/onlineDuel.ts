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
