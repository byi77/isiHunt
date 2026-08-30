/**
 * Netzwerk-Duell: zwei bis vier Spieler, getrennte Geraete, gleicher Seed,
 * ueber Internet.
 *
 * Getrennt von `challenge.ts`, weil dort die Fairness-Regeln des *lokalen*
 * Duells begruendet stehen (ein Geraet, Uebergabe) - dieses Modul enthaelt
 * nur die zusaetzlichen Werte, die aus der Netzwerkuebertragung selbst
 * entstehen. `CHALLENGE_DURATION_MS` gilt unveraendert weiter und wird von
 * dort importiert, nicht dupliziert. Die Spielerzahl kommt aus dem Raumstatus.
 */

/**
 * Gueltigkeit eines Duell-Raum-Codes in Minuten.
 *
 * Kuerzer als der Sync-Code (15 Minuten, `SYNC_CODE_LENGTH` in
 * `config/backend.ts`): ein Duell-Beitritt ist ein aktiver, unmittelbarer
 * Vorgang ("ich rufe meinen Freund gerade an"), kein "vielleicht spaeter
 * einloesen"-Fall wie ein Spielstand-Sync.
 */
export const DUEL_ROOM_CODE_TTL_MINUTES = 10;

/** Wie lange eine direkte Duell-Einladung auf Annahme wartet. */
export const ONLINE_DUEL_INVITATION_TTL_SECONDS = 90;

/**
 * Polling-Takt fuer offene Duell-Einladungen in der globalen Lobby.
 *
 * Das Realtime-Broadcast ist nur ein schneller Hinweis. Die Einladung liegt
 * dauerhaft in der Datenbank und muss auch dann auftauchen, wenn der Hinweis
 * wegen eines kurzen Mobilfunk-Aussetzers oder beim Szenenwechsel verloren
 * geht.
 */
export const ONLINE_DUEL_INVITATION_POLL_INTERVAL_MS = 2_000;

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
 * Wie lange nach einem Presence-`leave` auf die Rueckkehr des Gegners
 * gewartet wird, bevor die Trennung gemeldet wird.
 *
 * **Warum ueberhaupt gewartet wird.** Ein `leave` ist nicht gleichbedeutend
 * mit "weg". Beim Wechsel Lobby -> GameScene baut jeder Client seinen Kanal
 * neu auf; der jeweils andere sieht dabei ein `leave`, dem unmittelbar ein
 * `join` folgt. Bis v0.1.252 galt jedes `leave` sofort als Abbruch - der
 * Zwei-Geraete-Bericht vom 2026-08-25 zeigt die Folge in aller Deutlichkeit:
 *
 *     10:58:38.512  run:started
 *     10:58:38.517  duel:opponent-disconnected     <- 5 ms spaeter
 *
 * Fuenf Millisekunden nach dem Rundenstart kann keine Verbindung
 * zusammengebrochen sein. Das HUD zeigte danach die ganze Runde lang
 * "Verbindung weg" und den Gegnerstand bei 0, obwohl beide Geraete
 * durchspielten und ihr Ergebnis abgaben.
 *
 * **Warum dieser Wert.** Ein Kanalwechsel beim Szenenuebergang ist in
 * Millisekunden erledigt (im Bericht: 5 ms) - eine Sekunde ist dafuer
 * grosszuegig, selbst wenn das Geraet gerade den Rundenaufbau stemmt. Nach
 * oben begrenzt ihn die Ehrlichkeit der Anzeige: laenger zu warten hiesse,
 * einen echten Abbruch sekundenlang zu verschweigen.
 *
 * Ein zu kurzer Wert ist hier ausserdem unkritisch, weil er nichts kaputt
 * macht: `ONLINE_DUEL_LIVE_STALE_MS` erkennt ein echtes Verstummen ohnehin
 * unabhaengig davon (siehe `GameScene.checkOpponentAlive`). Presence ist die
 * Abkuerzung fuer den sauberen Abgang, nicht die alleinige Wahrheit -
 * dieselbe Aufteilung wie bei Startzeit und Rundenergebnis.
 */
export const ONLINE_DUEL_PRESENCE_GRACE_MS = 1_000;

/**
 * Anzahl Messungen zur Bestimmung des Uhr-Offsets gegenueber der
 * Supabase-Serverzeit.
 *
 * Der Median mehrerer Messungen (statt einer einzelnen) daempft
 * Ausreisser durch Mobilfunk-Jitter auf einer einzelnen Anfrage.
 */
export const ONLINE_DUEL_CLOCK_SYNC_SAMPLES = 3;

/**
 * Wie lange in der Lobby auf "beide Spieler bereit" gewartet wird, bevor der
 * Bildschirm das Warten als aussichtslos meldet.
 *
 * **Bemessen gegen eine menschliche Handlungsdauer, nicht gegen Netzlatenz.**
 * Zwischen "Raum erstellt" und "Gast ist bereit" liegt kein Roundtrip, sondern
 * ein Vorgang aus Fleisch und Blut: Code ablesen, ihn dem Freund
 * vorlesen oder zeigen, sechs Zeichen auf einer Handytastatur tippen,
 * BEITRETEN treffen. Der fruehere Wert von 10 Sekunden war die
 * Groessenordnung eines Netzwerk-Roundtrips und hat das Duell in genau diesem
 * Zeitfenster zuverlaessig zerrissen - belegt durch den Zwei-Geraete-Bericht
 * v0.1.246 (2026-08-23): der Gastgeber gab bei t+10,07s auf, der Gast trat bei
 * t+56s bei und fand einen Raum vor, um den sich niemand mehr kuemmerte.
 *
 * Die Obergrenze bleibt `DUEL_ROOM_CODE_TTL_MINUTES` - laenger warten als der
 * Code gilt waere sinnlos. Innerhalb dieser Grenze ist grosszuegig richtig:
 * seit dem WEITER-WARTEN-Knopf (`OnlineDuelScene`) ist ein zu frueher Timeout
 * kein Abbruch mehr, sondern nur eine Frage - und eine Frage nach zwei
 * Minuten stoert weniger, als eine nach zehn Sekunden das Duell zerstoert.
 */
export const ONLINE_DUEL_READY_TIMEOUT_MS = 120_000;

/**
 * Wie lange der Gast auf die Startzeit wartet, bevor er sie als ausgeblieben
 * meldet.
 *
 * Der Gast hatte bis v0.1.246 ueberhaupt kein Zeitlimit: er pollte
 * `getRoomStatus()` unbegrenzt auf eine `startAtMs`, die nach dem Aufgeben des
 * Gastgebers nie mehr kam (Bericht 2026-08-23). Unbegrenztes stilles Warten
 * ist der schlechteste der moeglichen Zustaende - schlechter noch als ein zu
 * frueher Abbruch, weil es dem Spieler nicht einmal sagt, dass etwas nicht
 * stimmt.
 *
 * Derselbe Wert wie beim Gastgeber, weil beide auf dasselbe warten: darauf,
 * dass der andere seine Lobby erreicht. Ein eigener Wert waere eine zweite
 * Zahl ohne zweite Begruendung.
 */
export const ONLINE_DUEL_GUEST_START_TIMEOUT_MS = ONLINE_DUEL_READY_TIMEOUT_MS;

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
 * durch, Gast blieb bei "Warte auf Freund" haengen). `getRoomStatus()`
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
