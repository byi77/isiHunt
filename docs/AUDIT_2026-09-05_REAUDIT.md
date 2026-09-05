# Erneuter Audit in sechs Durchlaeufen — 2026-09-05

Gepruefter Stand: **`e41ff4c`, v0.1.312**, Datenbank-Sollstand 49.
Der Arbeitsbaum war zu Beginn sauber. Dieser Bericht prueft den aktuellen
Code erneut; er ersetzt nicht den historischen [Erstaudit](AUDIT_2026-09-05.md).

**Sechs bestaetigte Findings: zwei P1, vier P2. Kein P0 belegt.**
Die pauschale Erledigt-Meldung im Erstaudit reichte insbesondere fuer die
Duellergebnis-Outbox und die Bot-Belohnungen noch nicht aus.

P1: vor dem naechsten Release beheben; unbestaetigte Ergebnisse oder
Fortschrittsereignisse gehen unwiederbringlich verloren.
P2: Funktionsfehler unter den jeweils genannten Betriebsbedingungen.

## Stand der Behebung

**Alle sechs Findings sind behoben.** Jeder Abschnitt unten schliesst mit
einem Absatz **Behoben**, der die tatsaechliche Aenderung und ihren
Regressionstest nennt. Der urspruengliche Befundtext bleibt unveraendert
stehen - er beschreibt den Zustand bei `e41ff4c`, nicht den heutigen.

> Die Zeilennummern in den **Fundstellen** beziehen sich deshalb auf
> `e41ff4c` und stimmen im heutigen Quelltext nicht mehr. Sie absichtlich
> nicht nachgezogen: sie sind der Nachweis, wo der Befund stand, nicht ein
> Wegweiser in den aktuellen Code.

| Nr. | Prio | Kern der Korrektur                                                                                                          | Regressionstest                                                               |
| --- | ---- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | P1   | Allowlist echter SQL-Ablehnungen statt "jedes `error` ist fachlich"                                                         | `NetworkDuelSystem.resultRetry.test.ts` (+4)                                  |
| 2   | P1   | Original erst loeschen, wenn die Kopie gelang; Rest bleibt sichtbar                                                         | `ProgressSyncSystem.test.ts` (+2)                                             |
| 3   | P2   | Client quarantaeniert permanente Ablehnungen; Server begrenzt offene Matches nach Anzahl statt Alter (Phase 2.50, ADR-0024) | `ProgressSyncSystem.test.ts` (+7)                                             |
| 4   | P2   | `start_bot_match` wird wiederholt; ungesicherte Praemie wird benannt                                                        | `CloudSystem.botMatch.test.ts` (+4), `ChallengeSystem.botReward.test.ts` (+3) |
| 5   | P2   | Schluessel-Aufzaehlung faengt ab; Ergebniswechsel haengt an keiner Ablage                                                   | `ProgressSyncSystem.test.ts` (+2)                                             |
| 6   | P2   | Temporaerer Claim-Fehler plant einen Retry, permanenter verfaellt                                                           | `ProgressSyncSystem.test.ts` (+2)                                             |

Die Testsuite waechst dadurch von **552 auf 576 Tests** (37 auf 39 Dateien).
Hinzu kommt eine Datenbank-Migration (Phase 2.50) und eine neue Regel im
SQL-Vertragsgate.

Zwei Fixes wurden gegengeprueft, indem sie testweise zurueckgenommen wurden:
Bei Finding 1 schlagen drei der vier neuen Duell-Tests fehl, bei Finding 3
meldet das SQL-Gate die wieder eingefuehrte Altersgrenze und faerbt die CI
rot. Beide sind damit nachweislich ursaechlich, nicht nur begleitend.

## Sechs Durchlaeufe

Die Durchlaeufe sind aufeinander aufbauende Reviews mit gezielten
Gegenpruefungen, nicht sechs identische Wiederholungen der Testsuite.

| Nr. | Schwerpunkt                       | Pruefung                                                                                                                                           |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ausgangsstand und Qualitaetsgates | Projektregeln, Architektur, Erstaudit, Typecheck, Lint, Format, Balance-/Scene-/Save-Gates, 552 Tests und Build                                    |
| 2   | Serververtraege und Auslieferung  | Aktuelle SQL-Definitionen fuer Kosmetik, Fortschritt, Bot-Matches, Duell-Ergebnisse und Ranking; Migrationskette, CI und Release-Gates             |
| 3   | Speicherung und Offline-Faelle    | Array-Outbox-Migration, einzelne Event-Schluessel, Speicherfehler, Profiluebernahme, Tages- und Bot-Praemien                                       |
| 4   | Netzwerkduelle und Wiederholungen | Tatsaechliches Supabase-SDK mit lokal ersetztem Fetch, Ergebnis-Outbox, Rematch-Aufrufer, Fehlerklassifikation                                     |
| 5   | Gameplay und Browser              | Eingabe, Spawn-/Driftlogik, Run-Ende, Scene-Listener, Service Worker; Browser-Suiten mit echten Runden ohne `--sim`                                |
| 6   | Gegenpruefung und Priorisierung   | Sieben isolierte Beobachtungstests, Ausschluss eines Rematch-Fehlalarms, Abgleich der Aufrufer und SQL-Bedingungen, Konsolidierung dieses Berichts |

## Findings nach Prioritaet

### 1. P1 — Ein normaler SDK-Netzwerkfehler loescht das Duellergebnis

**Fundstellen:** [NetworkDuelSystem.ts](../src/systems/NetworkDuelSystem.ts),
Zeilen 144–145, 854–860 und 879–882.

`submitRoundResultWithRetry()` behandelt jedes `response.value.error` als
dauerhafte fachliche Ablehnung. Das installierte Supabase/PostgREST-SDK
liefert aber auch Fetch-Fehler als aufgeloeste Antwort mit `error.message`
und Status 0. Der bestehende Regressionstest simuliert stattdessen eine
abgelehnte RPC-Promise und trifft diesen normalen SDK-Pfad nicht.

Bei einem solchen Funkloch wird nur einmal aufgerufen. Die Rueckgabe
`TypeError: Failed to fetch` hat nicht das von `isRetryableDuelResultError()`
erwartete Praefix; `submitRoundResult()` entfernt daraufhin den zuvor
dauerhaft gespeicherten Eintrag. Auch ein Neustart kann ihn nicht nachliefern.
Ohne alle Ergebnisse wird das Match nicht in der Duellrangliste gewertet.

**Nachweis:** Beobachtungstest B1 verwendet das echte installierte
`createClient()` mit ausschliesslich lokalem, fehlschlagendem Fetch.
Ergebnis: ein RPC-Aufruf, Fehler wie oben, Outbox-Schluessel anschliessend
nicht vorhanden. Es wurde keine Anfrage an ein Backend gesendet.

**Korrektur:** Transportstatus und strukturierte Fehlerart bis zum Aufrufer
erhalten. Netzwerk-/Timeout- und temporaere Serverfehler wiederholen und
in der Outbox behalten; nur sicher permanente Ablehnungen austragen.
Den SDK-Pfad mit aufgeloester Fehlerantwort als Regressionstest aufnehmen.

**Behoben.** Die Entscheidung haengt nicht mehr daran, _ob_ eine Antwort ein
`error` traegt, sondern daran, _welche Meldung_ darin steht.

- `PERMANENT_DUEL_RESULT_REJECTIONS` in
  [NetworkDuelSystem.ts](../src/systems/NetworkDuelSystem.ts) listet die acht
  inhaltsabhaengigen Ablehnungen aus `submit_duel_result`
  (`Ungueltiges Ergebnisformat`, `Ergebnis zu gross`, `Ergebnis
unvollstaendig`, `Ergebnis ausserhalb des Wertebereichs`, `Ungueltige
Rundendauer`, `Ergebnis nicht plausibel`, `Ungueltige Reliktstatistik`,
  `Reliktstatistik passt nicht zum Ergebnis` — phase_2_46, Zeilen 124–171).
  Nur sie brechen die Retry-Schleife ab und nehmen den Eintrag aus der Outbox.
- `isRetryableDuelResultError()` ist jetzt die Umkehrung dieser Allowlist.
  Alles Uebrige — `TypeError: Failed to fetch` eingeschlossen — bleibt liegen
  und wird wiederholt.
- Bewusst **nicht** als permanent gefuehrt: `Duell-Teilnehmer nicht
autorisiert`, `Duell nicht gefunden oder abgelaufen` und `Duell noch nicht
gestartet`. Sie sind zeit- bzw. zustandsabhaengig; ein Rundenende kann den
  noch nicht committeten Raumstart ueberholen. Ein faelschlich behaltenes
  Ergebnis kostet einen Retry, ein faelschlich verworfenes die Wertung des
  ganzen Matches.

**Regressionstests** (`NetworkDuelSystem.resultRetry.test.ts`, +4): SDK-
Fehlerantwort fuehrt zu vier statt einem Aufruf und laesst den Outbox-
Schluessel stehen; ein einmaliges SDK-Funkloch geht beim zweiten Versuch
durch; `Duell noch nicht gestartet` haelt den Eintrag fest; die Nachlieferung
nach Neustart ueberlebt einen erneuten Transportfehler.

**Gegenprobe:** Mit zurueckgenommener Klassifikation schlagen drei der vier
neuen Tests fehl. Der Fix ist also ursaechlich, nicht nur begleitend.

### 2. P1 — Die Outbox-Migration entfernt das Original trotz fehlgeschlagener Kopie

**Fundstelle:** [ProgressSyncSystem.ts](../src/systems/ProgressSyncSystem.ts),
Zeilen 337–338; Rueckgabeverhalten von `storeProgressEvent()` ab Zeile 299.

Beim ersten Lesen einer alten kontoabhängigen Array-Outbox werden ihre Runs
in einzelne Storage-Schluessel kopiert. `storeProgressEvent()` faengt
Schreibfehler und gibt `false` zurueck. `migrateArrayOutbox()` ignoriert dieses
Ergebnis und loescht anschliessend immer den alten Array-Schluessel.

Bei vollem localStorage scheitert gerade die zusaetzliche Kopie leicht, weil
das Original noch Platz belegt. Danach fehlen die nicht kopierten Runs in
beiden Formaten. Der umgebende `catch` hilft nicht: der Schreibfehler wurde
bereits in `storeProgressEvent()` abgefangen.

**Nachweis:** B3 legt einen gueltigen alten Run ab und laesst nur das
Schreiben neuer Event-Schluessel mit `QuotaExceededError` scheitern.
`pendingCount()` liefert danach 0; auch der alte Schluessel ist geloescht.

**Korrektur:** Original erst entfernen, wenn alle Eintraege erfolgreich
uebernommen wurden. Bei Teilfehlern die wiederholbare Migration und den
verbleibenden Originalbestand erhalten; Speicherfehler sichtbar melden.

**Behoben.** `migrateArrayOutbox()` in
[ProgressSyncSystem.ts](../src/systems/ProgressSyncSystem.ts) wertet den
Rueckgabewert von `storeProgressEvent()` jetzt aus:

- Der alte Array-Schluessel wird **nur** entfernt, wenn jede Kopie gelang.
- Bei Teilfehlern wird er auf die nicht uebernommenen Runs verkleinert. Der
  naechste Zugriff zieht sie nach, ohne die bereits kopierten ein zweites Mal
  einzureihen. Scheitert selbst das Verkleinern, bleibt der vollstaendige
  Originalschluessel unangetastet liegen — doppelte Eintraege sind
  unschaedlich, weil `readOutbox()` ueber die Event-ID entdupliziert.
- Der Fehlschlag wird mit Anzahl gemeldet
  (`Outbox-Migration unvollstaendig: n von m Runs nicht uebernommen`).

Beim Umsetzen kam ein Restdefekt hinzu, den der Befundtext noch nicht nennt:
ein nicht migrierter Run waere zwar nicht mehr geloescht, aber **unsichtbar**
gewesen — `readOutbox()` liest sonst ausschliesslich Event-Schluessel.
`migrateArrayOutbox()` gibt die nicht uebernommenen Runs deshalb zurueck, und
`readOutbox()` reiht sie vorn ein (sie sind aelter als alles Spaetere). Damit
sie nach erfolgreichem Upload nicht endlos erneut gesendet werden, traegt das
neue `dropSettledFromArrayOutbox()` sie auch aus dem Array aus.

**Regressionstests** (`ProgressSyncSystem.test.ts`, +2): bei fehlschlagenden
Schreibvorgaengen auf Event-Schluessel meldet `pendingCount()` weiterhin 1 und
der Run ist nach Freigabe des Speichers vollstaendig lesbar; bei gelingender
Kopie verschwindet der Originalschluessel wie zuvor.

### 3. P2 — Ein nicht mehr vorhandenes Bot-Match blockiert folgende Praemien und die Abmeldung

**Fundstellen:** [ProgressSyncSystem.ts](../src/systems/ProgressSyncSystem.ts),
Zeilen 158–172 und 528–533;
[phase_2_49_bot_match_challenge.sql](../supabase/phase_2_49_bot_match_challenge.sql),
Zeilen 59–60 und 112–116;
[ProfileScene.ts](../src/scenes/ProfileScene.ts), Zeilen 554–562.

Der Server entfernt beim Start eines neuen Bot-Matches offene Match-IDs,
die aelter als einen Tag sind. Ein anderes Geraet desselben Kontos kann
diese Bereinigung ausloesen, waehrend das erste seinen Sieg noch offline
aufbewahrt. Dessen spaeterer Claim wird dauerhaft mit
`Bot-Duell nicht gestartet` abgelehnt.

`flushBotVictories()` bricht bei jedem Fehler vor dem naechsten Eintrag ab
und entfernt auch permanente Ablehnungen nicht. Folgende Bot-Siege werden
nicht gesendet; der anschliessende Tagesbonus-Pfad wird ebenfalls nicht
erreicht. Solo-Ereignisse werden vorher bearbeitet und sind davon nicht
blockiert. `hasPendingData()` bleibt wahr und sperrt die Abmeldung.

**Nachweis:** B4 legt zwei Bot-Siege in die lokale Warteschlange; der erste
erhaelt die im SQL definierte permanente Antwort. Zwei Flushes senden
ausschliesslich die erste ID. Die Entstehungsbedingung wurde im SQL gelesen,
nicht gegen eine produktive Datenbank ausgefuehrt.

**Korrektur:** Permanente Bot-Ablehnungen sichtbar quarantänisieren und
folgende Eintraege weiter bearbeiten. Die Haltbarkeit serverseitiger Matches
mit der zugesagten Offline-Nachlieferung abstimmen. Zeitabhaengige
Cooldown-Antworten weiterhin wiederholen.

**Behoben.** `flushBotVictories()` unterscheidet jetzt zwischen dauerhafter
Ablehnung und Netzfehler:

- `PERMANENT_BOT_VICTORY_REJECTIONS` fuehrt `Bot-Duell nicht gestartet` und
  `Ungueltiges Bot-Duell` (phase_2_49, Zeilen 98 und 113). Ein solcher
  Eintrag wird ausgetragen, unter
  `isihunt.bot-victories.rejected.v1.<konto>` abgelegt und **die Schleife
  laeuft weiter** — folgende Bot-Siege und der Tagesbonus-Pfad werden
  erreicht.
- Zeitabhaengige Antworten (`Bot-Duell noch nicht beendet`, `Bot-Duell zu
schnell eingereicht`) und alle Netzfehler halten den Eintrag wie zuvor
  fest. `Profilstand noch nicht angelegt` gilt ebenfalls als
  wiederholbar — der Stand entsteht beim naechsten Abgleich.
- Die Funktion gibt zurueck, ob alles abgearbeitet ist. Nur ein _offener_
  Rest plant noch einen Retry und haelt den Tagesbonus zurueck; quarantaenierte
  Eintraege tun das nicht mehr. Damit faellt auch die dauerhafte Sperre der
  Abmeldung ueber `hasPendingData()` weg.

Die Quarantaene ist bewusst eine Ablage, kein stilles Loeschen: sie ist fuer
den Server wertlos, fuer die Fehlersuche aber die einzige Spur, welche Praemie
verlorenging.

**Serverseite ebenfalls behoben** (Nachtrag, [ADR-0024](DECISIONS.md)). Der
Client-Fix allein liess die _Entstehungsbedingung_ bestehen: Der Server
loeschte offene Match-IDs weiter nach einem Tag, der Client verlor die Praemie
nur nicht mehr lautlos. `supabase/phase_2_50_bot_match_retention.sql` beendet
das.

**Die Ursachenanalyse im Befund ist zu eng.** Genannt wird "ein anderes
Geraet desselben Kontos". Das ist die seltenere Variante: der `delete` in
`start_bot_match()` gehoert zum **eigenen** Duellstart. Wer offline gewinnt
und ueber einen Tag spaeter wieder spielt, loescht seinen eigenen Anspruch —
ein zweites Geraet braucht es dafuer nicht. Ein Handy ohne Verbindung ueber
24 Stunden (Urlaub, Flugmodus, defektes WLAN) genuegt.

**Anzahl statt Alter.** Phase 2.50 behaelt pro Konto die 24 juengsten offenen
Matches (`bot_match_retention_count()`) und loescht aeltere — unabhaengig
vom Alter. Der entscheidende Unterschied: Eine Frist hat immer ein Fenster,
das ein Offline-Geraet verpassen kann; eine Anzahl hat keines. Zugleich
deckelt sie das Tabellenwachstum haerter, als es eine Frist kann — 24 Zeilen
sind eine Obergrenze, "ein Tag" ist keine.

Das Aufraeumen selbst muss bleiben: Nur ein _gewonnenes_ Duell raeumt seine
Zeile ab, jedes verlorene hinterlaesst eine Karteileiche. Die 24 sind bewusst
groesser als `BOT_VICTORY_MAX_PENDING = 16` im Client — der Puffer deckt die
dazwischenliegenden verlorenen Duelle ab.

Zwei Dinge kamen dabei mit heraus:

- `bot_victory_claims` wurde bisher **nie** aufgeraeumt und waechst pro
  gebuchtem Sieg um eine dauerhafte Zeile. `prune_bot_victory_claims()`
  wendet dieselbe Grenze an. Die Doppelbuchungssperre bleibt intakt: ein
  geloeschter Nachweis erlaubt eine zweite Buchung nur, wenn die zugehoerige
  Zeile in `bot_victory_matches` noch existiert — die loescht
  `claim_bot_victory_bonus()` aber beim Buchen (phase_2_49, Zeile 150).
- Der Client gibt nach `BOT_VICTORY_MAX_FAILED_ATTEMPTS` (240)
  aufeinanderfolgenden erfolglosen Durchlaeufen auf und quarantaeniert die
  Eintraege. Das faengt den verbleibenden Fall ab, in dem ein Claim _immer_
  voruebergehend scheitert (geloeschtes Konto, defektes Profil) und
  `hasPendingData()` sonst dauerhaft die Abmeldung sperrte — dieselbe Klasse
  von Blockade wie dieser Befund, nur mit anderer Ursache. Bewusst ein
  Zaehler und kein Verfallsdatum je Eintrag: die Warteschlange speichert
  reine Match-IDs, ein Zeitstempel braeuchte einen Formatwechsel samt
  Migration.

**Gegen Rueckfall gesichert:** `scripts/check-sql-contract.mjs` bricht ab,
wenn in Phase 2.50 wieder ein `started_at < now() - interval` auftaucht.
Gegengeprueft — mit wieder eingebauter Altersgrenze meldet das Gate
"offene Bot-Matches duerfen nicht nach Alter geloescht werden" und die CI
wird rot.

**Regressionstests** (`ProgressSyncSystem.test.ts`, +4): zwei vorgemerkte
Siege, von denen der erste permanent abgelehnt wird — der zweite wird
trotzdem gesendet und `hasPendingData()` faellt auf `false`; derselbe Fall in
**einem** Flush-Durchlauf, mit den IDs direkt im Speicher, damit kein
`enqueueBotVictory()`-Flush dazwischenfunkt; die Ablage der abgelehnten ID;
und ein Cooldown-Fehler, der den Eintrag weiterhin haelt.

### 4. P2 — Bei fehlgeschlagenem Bot-Start verschwinden angezeigte Sieg-Praemien spaeter

**Fundstellen:** [DuelSelectScene.ts](../src/scenes/DuelSelectScene.ts),
Zeilen 97–105; [ChallengeScene.ts](../src/scenes/ChallengeScene.ts),
Zeilen 462–478; [GameScene.ts](../src/scenes/GameScene.ts), Zeilen 715–720;
[MenuScene.ts](../src/scenes/MenuScene.ts), Zeile 340.

Scheitert `startBotMatch()` bei einem angemeldeten Spieler, startet die UI
das Bot-Duell trotzdem ohne Match-ID. Ein Sieg schreibt XP und Coins lokal
gut, aber `GameScene` legt ohne `reward.matchId` keinen Outbox-Eintrag an.
Ein spaeterer erfolgreicher Profilabgleich, etwa beim Login-Bonus, ersetzt
diese lokale Gutschrift durch den Serverstand.

Damit bleibt der urspruengliche Verlust aus dem Erstaudit im Offline- bzw.
Startfehler-Pfad bestehen. Es gibt weder eine nachlieferbare Berechtigung
noch einen Hinweis, dass die angezeigte Belohnung nicht gesichert ist.

**Nachweis:** B6 startet den gleichen Systempfad ohne Match-ID, wertet einen
lokalen Bot-Sieg und uebernimmt anschliessend den vorherigen Profilstand.
Coins steigen zuerst, `hasPendingData()` bleibt falsch, nach der Uebernahme
sind die Coins wieder auf dem Ausgangswert. Die UI-Fehlerzweige wurden
zusaetzlich gelesen.

**Korrektur:** Bei fehlender serverseitiger Startbestaetigung keine gesicherte
Kontopraemie versprechen. Start wiederholbar machen bzw. einen ausdruecklichen
lokalen Uebungsmodus anbieten. Keine erfundenen Match-IDs nachtraeglich als
Berechtigung akzeptieren.

**Behoben** auf beiden vorgeschlagenen Wegen — erst den Fehler seltener
machen, dann den Rest ehrlich benennen.

_Start wiederholbar._ `CloudSystem.startBotMatch()` wiederholt einen
Fehlversuch entlang `BOT_MATCH_START_RETRY_DELAYS_MS` (`[400, 1200]` in
[config/backend.ts](../src/config/backend.ts), kurz gehalten, weil der Spieler
auf den Start wartet). Das ist gefahrlos und erzeugt keine Karteileiche:
`start_bot_match()` gibt innerhalb von 80 Sekunden denselben offenen Datensatz
zurueck, statt einen zweiten anzulegen (phase_2_49). Auch hier gilt die
Lehre aus Finding 1 — eine SDK-Fehlerantwort wird wiederholt, nur die
fachliche Ablehnung `Anmeldung erforderlich` bricht sofort ab.

_Ungesicherte Praemie wird benannt._ `awardBotVictory()` setzt
`localOnly: true`, wenn ein **angemeldeter** Spieler ohne Match-ID gewinnt.
`ChallengeScene` zeigt die Zeile dann gedaempft statt in Gold und ergaenzt
"Nur auf diesem Gerät - nicht im Konto gesichert."

Die Unterscheidung nach Anmeldestatus ist der Kern: ein **abgemeldeter**
Spieler behaelt seine lokale Gutschrift dauerhaft, weil es keinen Serverstand
gibt, der sie ueberschreiben koennte. Ihm einen Warnhinweis zu zeigen waere
schlicht falsch. Betroffen ist nur der angemeldete Spieler ohne
Startbestaetigung. Erfundene Match-IDs werden nach wie vor nirgends erzeugt.

**Regressionstests:** `CloudSystem.botMatch.test.ts` (+4, neue Datei) deckt
Wiederholung nach Rejection und nach SDK-Fehlerantwort, das Aufgeben nach
allen Stufen und den Sofortabbruch bei `Anmeldung erforderlich` ab — dieser
RPC war zuvor von **keinem** Test beruehrt.
`ChallengeSystem.botReward.test.ts` (+3, neue Datei) prueft die drei
Kombinationen aus Anmeldestatus und Match-ID. Eigene Dateien, weil die
bestehenden Suiten `AuthSystem` bzw. das Backend bewusst anders mocken.

### 5. P2 — Gesperrter localStorage laesst den Outbox-Zugriff ungefangen abbrechen

**Fundstelle:** [ProgressSyncSystem.ts](../src/systems/ProgressSyncSystem.ts),
Zeilen 289–295 und 351; Aufruf am Tageslauf-Ende in
[GameScene.ts](../src/scenes/GameScene.ts), Zeilen 698–735.

Die neue Schluessel-Aufzaehlung greift ausserhalb eines `try/catch` auf
`window.localStorage.length` und `.key()` zu. Verweigert der Browser den
Storage-Zugriff, wirft bereits `pendingCount()` bzw. `enqueueRun()` eine
Exception. Die Fehlerbehandlung der zuvor aufgerufenen Migrationsfunktionen
schuetzt diese Schleife nicht.

Beim angemeldeten Tageslauf wird `enqueueRun()` aufgerufen, nachdem die Phase
auf `ended` gesetzt wurde, aber bevor der Wechsel zum Ergebnisbildschirm
geplant wird. Auf diesem Fehlerpfad bleibt der Wechsel aus. `SaveSystem`
behandelt denselben gesperrten Speicher bereits defensiv; die Outbox hebt
diese Absicherung wieder auf.

**Nachweis:** B7 laesst den Storage-Getter mit `SecurityError` scheitern und
beobachtet die aus `pendingCount()` entweichende Exception. Der ausbleibende
Scene-Wechsel ist aus der gelesenen Aufrufreihenfolge abgeleitet, nicht als
separater Browserlauf reproduziert.

**Korrektur:** Auch Aufzaehlung und Lesen der Outbox abfangen, einen expliziten
Speicherfehler weitergeben und den Ergebniswechsel unabhaengig davon
abschliessen. Nicht still als erfolgreich gespeicherten Run behandeln.

**Behoben** an beiden Enden der Kette.

- `storageKeysWithPrefix()` kapselt Zugriff, `length` und `key()` in ein
  `try/catch`, meldet den Fehler als
  `[ProgressSyncSystem] Outbox nicht lesbar` und liefert eine leere Liste.
  `pendingCount()` und `enqueueRun()` werfen dadurch nicht mehr. Auch das
  Aufraeumen eines defekten Eintrags im `catch` von `readOutbox()` ist jetzt
  einzeln abgesichert — ein fehlschlagendes `removeItem` darf die Aufzaehlung
  nicht abbrechen.
- In [GameScene.ts](../src/scenes/GameScene.ts) liegt der gesamte
  Persistenzblock des Challenge-/Tageslauf-Zweiges (`submitRound`,
  `awardBotVictory`, `enqueueRun`, `completeDaily`, `flush`) in einem
  `try/catch`. Der `delayedCall` zum Ergebnisbildschirm steht **ausserhalb**
  und laeuft in jedem Fall. Ein Fehler wird als
  `[GameScene] Rundenergebnis nicht vollstaendig gesichert` gemeldet — nicht
  still als Erfolg behandelt.

Der Solo-Pfad braucht dieselbe Klammer nicht: dort ruft erst `ResultScene`
`enqueueRun()` auf, also nach dem Szenenwechsel. Die Absicherung in
`storageKeysWithPrefix()` deckt ihn trotzdem mit ab.

**Regressionstests** (`ProgressSyncSystem.test.ts`, +2): mit einem
`Storage.prototype.key`, der `SecurityError` wirft, werfen weder
`pendingCount()` noch `enqueueRun()`. Der ausbleibende Szenenwechsel bleibt
wie im Befund aus der Aufrufreihenfolge abgeleitet — `GameScene` ist mangels
Canvas nicht unit-testbar; der Browser-Playtest deckt den regulaeren Pfad ab.

_Nebenbefund aus der Testarbeit:_ Ein Storage-Spy aus einem fehlgeschlagenen
Test vergiftete alle folgenden Tests derselben Datei und liess sie wie echte
Regressionen aussehen. `ProgressSyncSystem.test.ts` ruft `vi.restoreAllMocks()`
deshalb jetzt im `afterEach`, nicht am Testende.

**Praezisierung des Befunds.** Der Befundtext beschreibt den Fehler allgemein.
Tatsaechlich trifft er **ausschliesslich angemeldete Spieler**, und zwar aus
zwei unabhaengigen Gruenden:

- `enqueueRun()` prueft `AuthSystem.isSignedIn()` in seiner ersten Zeile -
  also **vor** jedem Speicherzugriff. Ein abgemeldeter Spieler kehrt dort
  zurueck, ohne die Aufzaehlung je zu erreichen.
- `pendingCount()` ruft `readOutbox(null)`. Dessen erster Schritt
  `quarantineLegacyOutbox()` hat ein eigenes `try/catch`, der zweite ist
  `if (!accountId) return []`. Auch hier kein ungeschuetzter Zugriff.

Das senkt die Schwere nicht - fuer einen angemeldeten Spieler mit blockierten
Cookies bleibt es ein Totalausfall am Rundenende - erklaert aber, warum sich
dafuer kein Browser-Test bauen laesst. Siehe
[Die Grenzen der Browser-Abdeckung](#die-grenzen-der-browser-abdeckung).

### 6. P2 — Ein voruebergehender Tagesbonus-Fehler beendet die automatische Retry-Kette

**Fundstelle:** [ProgressSyncSystem.ts](../src/systems/ProgressSyncSystem.ts),
Zeilen 526 und 550–552.

Nach geleerter Run-Outbox wird der Retry-Timer abgebrochen. Scheitert
anschliessend `claimDailyBonus()`, kehrt die Funktion zurueck, ohne einen
neuen Versuch zu planen. Der Bonus bleibt lokal ausstehend, obwohl die
automatische Wiederholung bei Run- und Bot-Ereignissen vorhanden ist.

Ohne einen weiteren externen Flush-Ausloeser — etwa Menuebesuch, manuelle
Synchronisation oder erneutes Online-Ereignis — kommt der Bonus nicht an.
Ein einzelner kurzer Fehler kann ihn dadurch bis zum naechsten solchen
Anlass zurueckhalten; nach Ablauf des Datumsfensters verfaellt er.

**Nachweis:** B5 legt einen aktuellen Tagesbonus ohne weitere Runs ab,
simuliert eine temporaere Claim-Ablehnung und laesst 120 Sekunden virtuelle
Zeit verstreichen. Der Claim bleibt bei genau einem Aufruf und die
ausstehenden Daten bleiben erhalten.

**Korrektur:** Fuer temporaere Claim-Fehler denselben Retry-Mechanismus nutzen;
Datumsablauf und bereits bestaetigte Claims getrennt behandeln.

**Behoben.** Der Tagesbonus-Zweig am Ende von `flushPending()` unterscheidet
jetzt drei Ausgaenge statt eines:

- **Dauerhafte Ablehnung** (`isPermanentRejection()`, enthaelt bereits
  `Ungueltiger Tageslauf` aus phase_2_29): der lokale Stand wird ueber
  `clearPendingDaily()` geraeumt und gemeldet, damit nicht bei jedem Abgleich
  ein aussichtsloser Aufruf ausgeloest wird.
- **Voruebergehender Fehler:** `scheduleRetry()` — derselbe Mechanismus wie
  bei Run- und Bot-Ereignissen. Die Run-Outbox ist an dieser Stelle leer und
  ihr Timer oben abgebrochen, der Bonus haengt also nicht mehr an einem
  zufaelligen externen Ausloeser.
- **Erfolg ohne Nutzdaten:** ebenfalls ein Retry. Ob der Server gebucht hat,
  ist dann nicht entscheidbar; der lokale Stand bleibt stehen, und der Claim
  ist serverseitig idempotent.

Die Kette laeuft nicht unbegrenzt: `SYNC_RETRY_DELAYS_MS` deckelt bei 60
Sekunden, und sobald `isDailyKeyWithinClientWindow()` das Datumsfenster
verlaesst, raeumt der naechste Durchlauf den Bonus ohnehin ab.

**Regressionstests** (`ProgressSyncSystem.test.ts`, +2): nach einem
`Zeitüberschreitung`-Claim mit anschliessend 120 Sekunden virtueller Zeit
folgt ein zweiter Aufruf und `pendingDailyKey` wird geraeumt; ein
`Ungueltiger Tageslauf` fuehrt zu genau einem Aufruf und verfaellt sofort.

## Gegenpruefungen und nicht als Finding gewertete Punkte

- **Bot-Rematch-ID:** Der Bot-Zweig von `ChallengeSystem.rematch()` uebernimmt
  zwar die alte ID. Die aktuelle UI benutzt diesen Zweig aber nicht, sondern
  holt in `ChallengeScene.startRematch()` eine neue ID und ruft `startBot()`
  auf. Deshalb kein Rematch-Finding. B2 dokumentiert nur den verworfenen
  Anfangsverdacht.
- Die vorherigen Korrekturen fuer `version.json`, HTTP-Fehler im
  Navigation-Cache, den Spawn-Timerrest und den konstanten RNG-Verbrauch
  sind im aktuellen Quelltext vorhanden; ihre vorhandenen Tests bestehen.
- Der Array-Outbox-Verlust durch neue Runs waehrend eines Uploads ist fuer
  die normale Event-Outbox durch einzelne Schluessel adressiert. Finding 2
  betrifft die Migration unter Schreibfehlern.
- Das Dependency-Audit meldet null bekannte Schwachstellen. Das beweist
  weder allgemeine Fehlerfreiheit noch die Sicherheit des Live-Backends.

## Verifikation und Grenzen

- `npm run verify`: erfolgreich, **37 Testdateien / 552 Tests**, alle Gates
  und Production-Build. Bekannte jsdom-Canvas-Ausgaben und die Vite-Warnung
  zu grossen Chunks sind keine Testfehler.
- `npm run release:check`: erfolgreich; Smoke, Production in zwei Viewports,
  Performance-Simulation, iOS-Kompatibilitaetscheck und statischer SQL-Vertrag.
- `npm audit --json`: erfolgreich, **0 gemeldete Schwachstellen**.
- Isolierte Beobachtungstests: **7/7 bestanden**. Sie bestaetigen den
  beschriebenen Ist-Zustand; sie sind keine Tests fuer bereits erfolgte Fixes.
- Browser-Volllauf ohne `--sim`: **76/76 Schritte bestanden**, alle sieben
  Suiten (`screens`, `nav`, `controls`, `layout`, `ios`, `progress`, `modes`).
  Einschliesslich echtem WebKit-Run, Persistenz ueber Reload, Solo in drei
  Welten, Tageslauf und Bot-Duell. Den mobilen Production-Screenshot habe ich
  zusaetzlich visuell geprueft; dabei kein weiteres Layout-Finding belegt.
- Umgebung: Windows, Node **v24.20.0**, npm **11.19.0**.

Lokale Belege liegen im git-ignorierten Ordner `playtest-shots/`:

- `loop2.audit.test.ts`, `audit-loop2.config.ts`, `audit-loop2-tests.log`
- `audit-2026-09-05-loop2-playtest.log`
- `audit-2026-09-05-loop2-release.log`
- `audit-2026-09-05-loop2-dependencies.json`

Die Beobachtungstests lassen sich mit
`npx vitest run --config playtest-shots/audit-loop2.config.ts` erneut ausfuehren.
Sie wurden nicht in die regulaere Regressionstestsuite aufgenommen.

Der **Auditlauf selbst** aenderte nur die Dokumentation und lokale
Pruefartefakte, keinen Produktcode. Die produktive Datenbank, echte
Kontowechsel auf mehreren Geraeten und Netzwerkduelle gegen einen Live-Server
wurden nicht ausgefuehrt. SQL-Befunde und Berechtigungen wurden am
versionierten Sollstand beurteilt. Ein Test auf physischer iOS-/Android-
Hardware ist nicht Bestandteil dieses Laufs.

## Verifikation der Behebung

Der Behebungslauf aendert dagegen Produktcode **und** die Datenbank.

| Datei                                 | Findings   |
| ------------------------------------- | ---------- |
| `src/systems/NetworkDuelSystem.ts`    | 1          |
| `src/systems/ProgressSyncSystem.ts`   | 2, 3, 5, 6 |
| `src/systems/CloudSystem.ts`          | 4          |
| `src/systems/ChallengeSystem.ts`      | 4          |
| `src/config/backend.ts`               | 4          |
| `src/scenes/ChallengeScene.ts`        | 4          |
| `src/scenes/GameScene.ts`             | 5          |
| `src/types/index.ts`                  | 4          |
| `supabase/phase_2_50_...` (neu)       | 3          |
| `supabase/verify_migration_state.sql` | 3          |
| `scripts/check-sql-contract.mjs`      | 3          |
| `supabase/README.md`                  | 3          |
| `docs/DECISIONS.md` (ADR-0024)        | 3          |

- `npm run typecheck`: erfolgreich.
- `npm run verify`: erfolgreich — Typecheck, Lint, Format, alle vier
  statischen Gates (`balance:inventory`, `scene:guards`, `save:version`,
  `balance:check`), **39 Testdateien / 576 Tests** und der Production-Build.
  Die bekannten jsdom-Canvas-Ausgaben und die Vite-Warnung zu grossen Chunks
  sind wie zuvor keine Testfehler.
- `npm run playtest`: erfolgreich, **76/76 Schritte** in allen sieben Suiten
  (`screens`, `nav`, `controls`, `layout`, `ios`, `progress`, `modes`) — ohne
  `--sim`, also mit echten 90-Sekunden-Runden, im sichtbaren Fenster. Damit
  sind die von den Aenderungen beruehrten Pfade auch im Browser gelaufen:
  Tageslauf (Finding 5, `enqueueRun` vor dem Szenenwechsel) und Bot-Duell
  (Finding 4, `startBotMatch` und die Praemienanzeige). `npm run test:scope`
  hatte fuer diesen Diff die Vollstufe empfohlen.
- `node scripts/check-sql-contract.mjs`: erfolgreich, **23 transaktionale
  Migrationen** (vorher 22) — die neue Phase 2.50 wird erfasst.
- Gegenproben: mit zurueckgenommener Klassifikation sind drei der vier neuen
  Duell-Tests rot (Finding 1); mit wieder eingebauter Altersgrenze bricht das
  SQL-Gate ab (Finding 3). Fuer die uebrigen Findings wurde diese Probe nicht
  einzeln gefahren.

**Die Migration ist nicht eingespielt.** Phase 2.50 liegt versioniert vor und
besteht das Vertragsgate, wurde aber gegen keine Datenbank ausgefuehrt — auch
nicht gegen eine Testinstanz. Der Datenbank-Sollstand steigt erst beim
Einspielen von 49 auf 50; bis dahin meldet `verify_migration_state.sql` gegen
die produktive Instanz eine Abweichung. Das Einspielen gehoert zum Deploy,
nicht zu diesem Lauf.

## Die Grenzen der Browser-Abdeckung

Drei Fehlerbedingungen sind ausschliesslich durch Unit-Tests mit
Doppelgaengern gedeckt: gesperrter Speicher, Funkloch und abgeraeumtes
Bot-Match. Fuer die erste wurde eine Browser-Suite **gebaut und wieder
verworfen** - der Versuch ist hier festgehalten, damit ihn niemand ein
zweites Mal unternimmt.

### Gesperrter Speicher: nicht im Browser herstellbar

Die Suite sperrte `window.localStorage` nach dem Rundenstart per
`Object.defineProperty` und prueefte, ob der Ergebnisbildschirm trotzdem kommt.
Sie lief gruen - **und blieb gruen, als der Fix testweise zurueckgenommen
wurde.** Sie war also wertlos.

Der Grund steht oben unter Finding 5: `enqueueRun()` prueft die Anmeldung vor
jedem Speicherzugriff. Der Playtest laeuft ohne Konto, die fehlerausloesende
Zeile wird nie erreicht. Ein angemeldeter Zustand liesse sich nur ueber eine
Testbruecke im Produktivcode faelschen - genau die Art Konstruktion, die in
`scripts/playtest.mjs` schon einmal zu einem jahrelang gruenen Scheintest
gefuehrt hat (`window.isiHunt.__ch`, Kommentar in `suiteModes`). Der Preis
ist hoeher als der Ertrag.

**Was stattdessen gilt:** Die Absicherung in `ProgressSyncSystem` ist
unit-getestet. Der Szenenwechsel in `GameScene` ist es nicht - er bleibt aus
der Aufrufreihenfolge abgeleitet, weil Scenes mangels Canvas nicht
unit-testbar sind (ARCHITECTURE.md 9.2). Diese Luecke bleibt offen und
schliesst sich nur durch einen Test auf einem echten Geraet mit blockierten
Cookies bei angemeldetem Konto.

### Funkloch: Browser bringt keinen Erkenntnisgewinn

Playwright koennte Requests blockieren. Geprueft wuerde damit aber Playwrights
Blockierung, nicht mehr als der Unit-Test mit gestubbtem `fetch` ohnehin
abdeckt - bei zwanzigfachen Kosten. Bewusst nicht gebaut.

### Abgeraeumtes Bot-Match: braucht eine echte Datenbank

Die Entstehungsbedingung ist ein serverseitiger `delete` zwischen zwei
Anmeldungen. Der Playtest faehrt gegen den lokalen Dev-Server ohne Backend;
die Bedingung ist dort prinzipiell nicht herstellbar. Was es braeuchte:

1. Eine Testdatenbank mit eingespielter Migrationskette.
2. Zwei Konten bzw. zwei Sitzungen desselben Kontos.
3. Einen Lauf, der `start_bot_match()` aufruft, waehrend ein Sieg lokal wartet.

Das ist eine eigene Testebene ("Integrationstest gegen Supabase"), die es im
Projekt bisher nicht gibt. Sie einzufuehren ist eine Architekturentscheidung
und gehoert in einen ADR - nicht in diesen Behebungslauf.

Fuer den konkreten Befund ist die Dringlichkeit allerdings gesunken: Phase
2.50 raeumt offene Matches nicht mehr nach Alter ab, die Entstehungsbedingung
existiert also gar nicht mehr. Der Client-Fix bleibt trotzdem richtig - er
faengt jede kuenftige permanente Ablehnung ab, nicht nur diese eine.

**Was diese Behebung nicht belegt.** Die Regressionstests reproduzieren die
Fehlerbedingungen mit Doppelgaengern (gefaelschter Storage, gezaehlte RPCs,
gestubbtes `fetch`) — sie ersetzen keinen Lauf gegen die echte Datenbank.
Der Browser-Playtest belegt, dass die geaenderten Pfade im **Normalfall**
weiterhin durchlaufen; die Fehlerpfade selbst (gesperrter Speicher, Funkloch,
abgeraeumtes Bot-Match) loest er nicht aus.
Nicht ausgefuehrt wurden: ein realer Kontowechsel auf zwei Geraeten (die
Entstehungsbedingung von Finding 3), ein Netzwerkduell gegen einen
Live-Server und ein Test auf physischer Hardware. Die Haltbarkeit
serverseitiger Bot-Matches bleibt wie oben beschrieben offen.
