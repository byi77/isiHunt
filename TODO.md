# TODO — offene Arbeiten

**Stand:** 2026-08-21 · abgeleitet aus dem Spieltest-Feedback von Emre und
Simay, ergaenzt um zwei Audits

Reihenfolge nach Nutzen, nicht nach Aufwand.

> **Wie diese Datei gelesen wird** _(Struktur neu geordnet 2026-08-21)_
>
> | Abschnitt          | Bedeutung                                                 |
> | ------------------ | --------------------------------------------------------- |
> | **P0**             | Behebt einen belegten Fehler oder macht eine unbelegte     |
> |                    | Behauptung ueber den Code belegt. Zuerst.                  |
> | **P1**             | Naechster Kernnutzen fuer die Spieler.                     |
> | **P2**             | Wettbewerb, Langzeitmotivation, Qualitaetsausbau.          |
> | **P3**             | Langfrist-Ausbau nach stabiler Basis.                      |
> | **Zurueckgestellt**| Bewusst nicht eingeplant, mit Bedingung fuer Wiedervorlage.|
> | **Reserve**        | Fachlich richtig, aber nicht eingeplant. Ohne Checkbox —   |
> |                    | Einzelpunkte werden bei Bedarf nach oben gezogen.          |
> | Phasen 1–6, M8     | Historie und Detailplanung. Kein eigener Rang.             |
>
> **Regel gegen Wildwuchs:** Ein Punkt steht an **einer** Stelle. Steht er
> woanders auch, wird die zweite Stelle zu einem Verweis (`[x]` mit
> "hochgezogen nach ..."). Sammelposten mit mehreren Themen in einer Checkbox
> sind nicht zulaessig — sie sind nie abhakbar und zaehlen doppelt.

## Ueberblick

| Phase   | Inhalt                                                   | Aufwand      |
| ------- | -------------------------------------------------------- | ------------ |
| 1       | Bedienbarkeit — **abgeschlossen, erneut bestaetigt**     | —            |
| 1.1     | Zwei UI-Fehler, Wartungsbildschirm — **fertig**          | —            |
| 1.2     | Update-Erkennung — **gebaut, ungeprueft**                | Test noetig  |
| **1.3** | **Bestenliste: gemeinsam + automatisch — abgeschlossen** | —            |
| 2       | Profil, 90 s, XP-Kurve, Level 100                        | mittel       |
| **2.5** | Balken oben/unten — Bildschirm ganz nutzen               | mittel+      |
| **2.6** | **Login & Mehrgeräte-Profil**                            | **hoch**     |
| 3       | Weltraum statt Fantasy                                   | mittel       |
| **3.5** | Ton (aus M4 vorgezogen)                                  | mittel       |
| **3.6** | Dynamic Island — braucht native App                      | Entscheidung |
| 4       | Bonus, Coins, Talentbaum — erste Fassung abgeschlossen   | —            |
| **4.1** | **Talentpunkte — Entscheidung offen, siehe P1.a**        | Entscheidung |
| 5       | Modi, Hindernisse — gebaut, Spieltest offen (P0.c)       | mittel       |
| 6       | Freunde, Realtime, Ranked und Rekorde                    | hoch         |

**Fett = neu am 2026-08-13.** Die Phasen sind Detailplanung und Historie; die
Reihenfolge der Arbeit steht in P0–P3 darunter.

## Priorisierte Gesamtplanung — Feedback, Audit und Architektur (2026-08-21)

> **Aktuelle Entwicklungsphase:** Die spielbaren Grundlagen von Phase 1 bis 5
> sind gebaut, der Shop seit v0.1.209 mit 100 Fluggestalten ausgeliefert.
>
> **Der Engpass ist heute kein Feature, sondern ein Beleg.** Vier gebaute und
> ausgelieferte Fixe sind auf keinem echten Geraet bestaetigt — der wichtigste
> davon seit 39 Versionen (v0.1.170, Boost-Fix). Solange das so ist, steht
> jede Aussage ueber Sync, Duell und Darstellung auf einer Code-Lesung. Genau
> aus dieser Lage sind im August vier Fehlersuchrunden gegen einen Stand
> entstanden, den das Geraet nie geladen hatte. Deshalb steht die
> **Geraetetest-Runde (P0.a)** vor allem anderen.
>
> Danach: **P0.b** (zwei belegte Fehler ohne Fix), **P0.c** (Balancing mit den
> Kindern), dann die eine blockierende Entscheidung in **P1.a**
> (Talentpunkte), dann Phase 6.
>
> **P0.5** ist abgeschlossen und bleibt nur als technischer Zwischenstatus
> stehen — keine zweite Prioritaetsliste.

### Kurzfassung — was als naechstes drankommt

| Rang     | Punkt                                    | Aufwand    |
| -------- | ---------------------------------------- | ---------- |
| **P0.a** | Vier Geraetebestaetigungen in einem Lauf | ein Abend  |
| **P0.b** | Auto-Pause · Tagesbonus auf Servertag    | klein      |
| **P0.c** | Phase 5 + Serien-Fenster mit den Kindern | ein Abend  |
| **P1.a** | Talentpunkte: entscheiden, nicht bauen   | Gespraech  |
| **P1.b** | Profilfluss, Profil-Icons, Level/XP-Ablauf | mittel   |

### P0 — erst absichern und messen

> **Was P0 hier heisst:** Ein Punkt steht in P0, wenn er entweder einen
> belegten Fehler behebt oder eine unbelegte Behauptung ueber den Code zu
> einer belegten macht. Untersuchungen ohne konkreten Anlass gehoeren nicht
> hierher — sie stehen in der Reserve weiter unten.

#### P0.a — Geraetetest-Runde: vier offene Bestaetigungen _(neu gebuendelt 2026-08-21)_

> **Warum gebuendelt:** Vier Fixe sind gebaut, gruen getestet und
> ausgeliefert, aber keiner war auf einem echten Geraet bestaetigt. Solange
> das offen ist, steht **jede** Aussage ueber Sync, Duell und Darstellung
> auf einer Code-Lesung statt auf einer Messung — genau die Lage, aus der
> die vier Fehlersuchrunden im August entstanden sind.
>
> **Stand 2026-08-21: zwei von vier bestaetigt.** Der Sync-Pfad ist damit
> zum ersten Mal seit v0.1.170 belegt und nicht mehr nur hergeleitet.
> Test 3 lief, war aber nicht auswertbar (Report nur vom Master); Test 4
> ist bewusst verschoben. Beide bleiben offen.
>
> **Zwei Nebenbefunde aus demselben Report** sind als eigene Punkte in
> **P0.b** eingetragen — sie haben mit dem Duell nichts zu tun, standen aber
> im selben Log.

- [x] **1. Boost-Fix bestaetigt (2026-08-21, v0.1.209)** — Wartungsboost
      wird nach App-Neustart **ohne** "PROFIL ABGLEICHEN" sichtbar.
      **Damit ist der `isActive()`-Guard-Fix aus v0.1.170 belegt** und nicht
      mehr nur aus dem Code hergeleitet. Der Strang, der drei Diagnoserunden
      gekostet hat (Verlauf in P0.d), ist geschlossen.
      **Was das mit-belegt:** `MenuScene.synchronizeData()` und
      `checkCloudSave()` laufen beim App-Start tatsaechlich durch — damit
      steht auch die Retry-Logik aus `SYNC_RETRY_DELAYS_MS` zum ersten Mal
      auf einem gemessenen Pfad statt auf einem unerreichbaren.
- [x] **2. Profil-Menues auf dem Geraet bestaetigt (2026-08-21)** — beide
      Wege (Hauptmenue "PROFIL", Einstellungen "PROFIL ÖFFNEN") fuehren zu
      `ProfileScene`. Damit ist auch `attachVerticalScroll()` erstmals auf
      einem Geraet gesehen, inklusive der bis dahin im Projekt nie
      dagewesenen Kombination aus DOM-Textinput in einem scrollenden
      Container.
- [ ] **3. Dritter Zwei-Geraete-Duell-Test — durchgefuehrt, aber nicht
      auswertbar** _(2026-08-21, Report v0.1.205 vom Master-Geraet)_.
      **Bewusst uebersprungen, bleibt offen.**
      **Was der Report belegt:** `duel:Raum erzeugen` ok, `duel:Bereit
      melden` ok, danach **26 x `duel:Raumstatus laden` ueber 37 Sekunden,
      alle ok**. Nie erscheint `duel:Startzeit setzen`. Nach
      `OnlineDuelScene.pollAndSetStartTime()` setzt der Host die Startzeit
      nur bei `hostReady && guestReady` — `guestReady` war also durchgehend
      `false`.
      **Der Polling-Fix aus v0.1.174 ist damit NICHT widerlegt.** Er hat
      26-mal sauber gepollt, genau wie gebaut; er fand nur nichts, weil
      nichts da war. Er behebt einen verlorenen `start`-Broadcast, *nachdem*
      beide im Raum sind — dieser Fall lag anders.
      **Der Slave ist nie in den Raum gekommen.** Im Report fehlt jedes
      `duel:Raum beitreten`. Drei Erklaerungen, keine belegt: (a) Code nie
      eingegeben, (b) `joinRoom()` schlug fehl, (c) Beitritt lief, aber
      `markReady()` scheiterte.
      **Warum nicht auswertbar:** Der Report stammt vom **Master**. Was auf
      dem Slave geschah, kann er per Konstruktion nicht zeigen.
      **Fuer den naechsten Versuch zwingend: Debug-Report vom SLAVE-Geraet.**
      Ohne den ist jede weitere Runde wieder eine Vermutung — dieselbe Falle
      wie bei der Sync-Fehlersuche im August.
- [ ] **4. Playtest ohne `--sim` fahren** _(2026-08-21 bewusst verschoben,
      nicht vergessen)_ — steht seit mehreren Balance- und
      Darstellungsaenderungen aus. `--sim` prueft Rendering, Tweens und
      Bildrate **nicht** — also genau das, was 100 neue Fluggestalten und
      die Serien-Schleife betrifft. Die Gestalten sind bisher nur als
      gerendertes Raster gesehen, nie im laufenden Spiel.

#### P0.b — Belegte Fehler ohne Fix

- [x] **Sync-Sturm im Menue eingegrenzt (2026-08-21)** — Mindestpause von
      30 Sekunden zwischen zwei vollstaendigen Abgleichen
      (`SYNC_MIN_INTERVAL_MS`).
      **Ursache belegt:** `MenuScene.create()` startet einen Abgleich, und
      `create()` laeuft bei jeder Rueckkehr ins Menue. `saveSyncBusy` half
      nicht — es wird erst in `checkCloudSave()` gesetzt und sperrt nur
      *parallele* Laeufe; im Report stand bei jedem `sync:start`
      `saveSyncBusy: false`.
      **Zeitstempel modulweit, nicht als Feld:** Phaser legt bei jeder
      Rueckkehr eine neue Scene-Instanz an — ein Feld waere jedes Mal wieder
      `0` und der Guard wirkungslos.
      **Drei Anlaesse umgehen die Sperre:** Netzrueckkehr, Nutzerentscheidung
      ueber einen Cloud-Stand, und die schon gedrosselte Fehler-Wiederholung.
      **Nebenbei:** Der Abgleich-Hinweis erscheint jetzt erst, wenn wirklich
      synchronisiert wird; abgewiesene Aufrufe stehen als `sync:throttled` im
      Report. `npm run verify` gruen (313 Tests).
  - [ ] **Ungeprueft:** ob 30 Sekunden sich im Gebrauch richtig anfuehlen —
        insbesondere beim Wechsel zwischen zwei Geraeten, wo ein Abgleich
        gewuenscht ist. Beim naechsten Geraetedurchgang mitbeobachten; der
        Wert steht in `config/backend.ts` und ist leicht zu aendern.
  - [ ] **Nicht durch einen Unit-Test gedeckt.** Die Regel sitzt in
        `MenuScene`, das ausserhalb des Browsers nicht laedt (Regel 6). Genau
        der Fall, den der Querschnitt-Punkt "Ablauflogik nach `systems/`
        ziehen" adressiert — ein `SyncDecisionSystem` koennte das pruefbar
        machen.

- [ ] **Duell-Lobby: 37 Sekunden ohne Rueckmeldung** _(neu 2026-08-21, im
      Report belegt)_ — der Master stand 37 Sekunden in "Warte auf
      Geschwister ...", ohne dass die Meldung "Geschwister ist nicht
      rechtzeitig beigetreten" erschien. Die haengt an
      `ONLINE_DUEL_READY_TIMEOUT_MS` und feuert nur beim Host.
      **Zwei Moeglichkeiten, keine geprueft:** Der Timeout ist laenger als
      37 s, oder der Test wurde vorher abgebrochen. So oder so fehlt in der
      Lobby eine sichtbare Rueckmeldung, dass ueberhaupt noch etwas laeuft —
      genau das laesst einen Wartezustand wie einen Absturz wirken (dieselbe
      Ursache wie beim Auto-Pause-Punkt darunter).
- [x] **Auto-Pause bei App-Wechsel gebaut (2026-08-21)** — `GameScene`
      registriert einen `visibilitychange`-Handler und ruft bei
      `visibilityState === 'hidden'` die neue Methode
      `pauseForInterruption()`.
      **Bewusst kein `togglePause()`:** Das ist ein Umschalter, und iOS sendet
      `visibilitychange` mehrfach kurz hintereinander — der Run waere beim
      zweiten Ereignis wieder angelaufen, bei ausgeschaltetem Bildschirm.
      **Fortsetzen bleibt Handarbeit:** Wer aus einem Anruf zurueckkommt, hat
      den Finger nicht schon auf dem Glas.
      **Duell:** Hinweis erscheint, Simulation laeuft weiter — Entscheidung
      vom 2026-08-21, die Fairness-Regel aus `config/challenge.ts` bleibt
      unangetastet. Ein Vorteil entstuende ohnehin nicht, weil Phaser die
      Schleife im Hintergrund von sich aus anhaelt.
      `RunPaused` traegt dafuer jetzt `reason` (`manual` | `interrupted`); der
      Bildschirm heisst `PAUSE` oder `ANGEHALTEN`. `npm run verify` gruen
      (310 Tests). `ARCHITECTURE.md` 6.1 und CHANGELOG ergaenzt.
  - [ ] **Auf dem Geraet bestaetigen** — Run starten, Anruf annehmen bzw.
        Bildschirm sperren, zurueckkehren. Erwartung: Bildschirm
        `ANGEHALTEN` mit dem Hinweis "Die App war kurz im Hintergrund", Run
        laeuft erst nach Tippen auf FORTSETZEN weiter. **Zweiter Fall:** Der
        Wechsel ins Kontrollzentrum (Wischen von oben, ohne die App zu
        verlassen) darf keinen zweiten Bildschirm stapeln.
        _Gehoert in denselben Durchgang wie P0.a.4._

- [x] **Tagesbonus serverseitig abgesichert (2026-08-21)** — beide RPCs
      pruefen jetzt ueber `daily_key_is_plausible()` Format, gueltiges Datum
      und hoechstens einen Tag Abstand zum Servertag
      (`supabase/phase_2_13_daily_key_window.sql`).
      **Befund bestaetigt:** Vorher stand dort nur
      `p_daily_key !~ '^\d{4}-\d{2}-\d{2}$'` — `9999-12-31` kam durch, und
      gesperrt war nur ein *gleicher* Schluessel.
      **Fenster statt exaktem Servertag** _(Entscheidung 2026-08-21)_: `now()`
      liefert UTC; zwischen 00:00 und 02:00 deutscher Sommerzeit haette ein
      strikter Vergleich echte Spieler ausgesperrt. Dazu Laeufe ueber
      Mitternacht und nachgereichte Offline-Laeufe.
      **Nebenbefund mitbehoben:** `ProgressSyncSystem` liess einen
      fehlgeschlagenen Claim unbegrenzt in `pendingDailyKey` stehen. Ein
      dauerhaft abgelehnter Schluessel haette bei jedem Abgleich einen
      aussichtslosen Aufruf ausgeloest. Verfall jetzt lokal gespiegelt
      (`DAILY_KEY_TOLERANCE_MS`), vier neue Tests.
      **Nebenbefund 2:** Die bestehenden Tagesbonus-Tests hingen an festen
      Datums-Strings und waeren am Folgetag von selbst rot geworden — Zeit ist
      jetzt ueber `vi.setSystemTime` fixiert.
      `npm run verify` gruen (313 Tests).
  - [x] **SQL in Supabase ausgefuehrt (2026-08-21).** Die Serverpruefung ist
        damit aktiv.
  - [ ] **Gegenprobe am Geraet:** Tagesbonus holen, Geraetedatum auf ein Jahr
        spaeter stellen, erneut versuchen — muss abgelehnt werden. _Gehoert in
        denselben Durchgang wie P0.a.4._
  - [ ] **Ungeprueft geblieben:** ob `abs(parsed - current_date) <= 1` in
        Postgres den erwarteten Integer-Abstand liefert. Steht so im Skript,
        aber nicht gegen eine echte Datenbank gefahren.

#### P0.c — Spielbarkeit mit den Kindern

- [ ] **Phase 5 mit Kindern balancieren:** Schwierige Welten, Hindernisse,
      Tempo, Sichtfenster und Belohnungen sollen fordernd, aber nie
      frustrierend sein. **Der einzige P0-Punkt, der direkt am Spielgefuehl
      arbeitet** — die anderen sichern nur ab.
- [ ] **Serien-Umstellung mit Emre und Simay pruefen** _(hochgezogen aus
      "Balance-Aenderungen ohne Spielertest")_. Das Zeitfenster ging von 1800
      auf 900 ms, und die Serie steigt nur noch bei farbigen Relikten.
      Gemessen wurde gegen einen Bot, der praeziser steuert als ein Kind:
      beste Serie von 183 auf 19, rund 11 Abrisse je Runde. Ist es zu hart,
      zuerst `COMBO_GRACE_MS` erhoehen (z. B. auf 1100) — der Wert wirkt
      direkter als jede andere Stellschraube. **Gehoert in denselben
      Spielabend wie Phase 5.**

#### P0.d — Verlauf der Sync-Fehlersuche _(abgeschlossen, als Beleg behalten)_

> **Alles hier ist Historie.** Die einzige offene Arbeit aus diesem Strang
> ist der Geraetetest, und der steht als **P0.a.1**. Der Verlauf bleibt
> vollstaendig stehen, weil er die teuerste Lehre des Projekts belegt: Zwei
> plausible Fixe (Retry, Logging) haben nichts geaendert, weil die Ursache
> woanders lag — ein `isActive()`-Guard, der bei **jedem** App-Start
> zuschlug. Wer den Strang kuerzt, verliert den Beleg dafuer, wie leicht
> eine plausible Hypothese eine Fehlersuche in die Irre fuehrt.

- [x] Button-Trefferflaechen auf dem Testgeraet erneut bestaetigt: funktionieren
      gut.
- [x] Zurueck-Navigation auf dem Testgeraet erneut bestaetigt: funktioniert gut.
- [x] **Phase 2.6 produktiv pruefen:** SQL-Migration in Supabase anwenden und
      mit einem Profil auf iPhone und iPad testen: Offline spielen, verbinden,
      dann XP, Coins, Name, Bestwert und Erfolge pruefen.
      **Der offene Geraetetest dazu steht oben als P0.a.1** — hier darunter
      steht nur noch, wie die Ursache gefunden wurde.
  - [x] **BUG gefunden und behoben (2026-08-17), per Debug-Report belegt:**
        Zwei iPhones, gleiches Profil. iPhone1 offline gespielt → online →
        Sync-Popup kam, Abgleich lief. iPhone2 offline gespielt → online, im
        Menue, online gleichzeitig → kein Sync-Popup, der Offline-Run wurde
        nicht hochgeladen. Nach "PROFIL ABGLEICHEN" zuerst auf iPhone1, dann
        auf iPhone2 stand am Ende **iPhone2 auf dem (aelteren) Stand von
        iPhone1** — der iPhone2-Offline-Lauf war verloren.
        **Ursache, belegt durch den Debug-Report-Verlauf:**
        `[CloudSystem] Login prüfen fehlgeschlagen` direkt nach `run:ended` —
        `requireAuthenticatedClient()` ruft `supabase.auth.getUser()` mit dem
        5s-`BACKEND_TIMEOUT_MS`-Limit auf; iOS meldet das `online`-Ereignis
        oft, bevor die Verbindung zu Supabase tatsaechlich steht, der erste
        Versuch lief prompt in den Timeout. Ohne Wiederholung blieb der Run
        bis zum naechsten `online`-Ereignis oder App-Neustart in der Outbox
        stehen (`MenuScene` registriert den Listener nur einmalig).
        **Fix:** `ProgressSyncSystem` plant bei einem Fehlschlag jetzt selbst
        einen automatischen Wiederholungsversuch (`SYNC_RETRY_DELAYS_MS` in
        `config/backend.ts`: 5s/15s/60s), unabhaengig vom `MenuScene`- oder
        `online`-Lebenszyklus. Bricht sauber ab, wenn sich der Nutzer
        zwischenzeitlich abmeldet. Zwei neue Tests in
        `ProgressSyncSystem.test.ts`.
        **Noch offen:** erneuter Geraetetest mit demselben Ablauf (zwei
        Geraete, Offline-Run auf einem, direkt nach Netzwiederkehr), um zu
        bestaetigen, dass der Retry den Fall jetzt tatsaechlich auffaengt.
  - [x] **Zweiter BUG derselben Fehlerklasse gefunden und behoben
        (2026-08-18):** Emre und Simay per Wartungsboost auf Level 50 +
        50000 Coins gesetzt; nach App-Start war der Boost bei beiden nicht
        sichtbar, erst "PROFIL ABGLEICHEN" zog ihn. **Ursache:**
        `MenuScene.checkCloudSave()` scheiterte beim eingeloggten Profil-
        Pull, wenn `requireAuthenticatedClient()` innerhalb von
        `BACKEND_TIMEOUT_MS` (5s) keine Antwort bekam — genau derselbe
        Timeout-Mechanismus wie beim ersten Bug, nur auf dem Lade- statt dem
        Sende-Pfad. Der Fehlschlag blieb lautlos: kein Retry, kein
        sichtbarer Fehler, das UI zeigte weiter den alten lokalen Stand.
        **Nicht die Ursache:** `isRemoteAhead` selbst — Level und Coins
        waren dort bereits vor diesem Fix als Vergleichsfelder abgedeckt.
        **Fix:** `checkCloudSave()` plant bei einem Fehlschlag jetzt
        denselben automatischen Wiederholungsversuch wie
        `ProgressSyncSystem` (`SYNC_RETRY_DELAYS_MS`: 5s/15s/60s), inklusive
        Aufraeumen des Timers im `shutdown`-Handler. `npm run verify` gruen
        (212 Tests).
        **Noch offen:** Geraetetest mit einem erneuten Boost, um zu
        bestaetigen, dass der Retry den Fall auf einem echten iPhone
        tatsaechlich auffaengt.
  - [x] **Widerlegt durch echten Test (2026-08-18)** — _ueberholt durch den
        Befund weiter unten, hier nur noch als Verlauf:_ Der Retry-Fix hat den
        Fall NICHT behoben. Selbsttest: eigenes Profil (Level bereits ueber
        50, Coins klar unter 50000) geboostet, Coins blieben nach App-Start
        unveraendert, erst "PROFIL ABGLEICHEN" zog sie nach. Level-Seite war
        durch den Test selbst nicht aussagekraeftig (Boost setzt Level fest
        auf 50, war beim Tester bereits hoeher) - aber die Coins-Bedingung in
        `isRemoteAhead` (`Number(remote.data.coins) > local.coins`) haette
        zuschlagen muessen und tat es nicht.
        **Der mitgelieferte Debug-Report zeigte keinen einzigen Fehler-Log**
        (nur `app:start`-Eintraege) - das ist keine Entlastung fuer die
        Timeout-Hypothese, sondern eine Beweisluecke: `checkCloudSave()`
        loggt im Erfolgs- UND im Fehlerpfad nichts außer `console.warn`/
        `console.error`, die der Ringpuffer abfaengt. Ob der Timeout-Pfad
        ueberhaupt lief, war aus dem Report nicht ablesbar.
        **Fix zurueckgestuft von "behoben" auf "Diagnose eingebaut":**
        `checkCloudSave()` protokolliert jetzt bei jedem Durchlauf
        (`sync:profilePull`, `sync:remoteAheadCheck`) Zwischenergebnisse in
        den Debug-Ringpuffer - claimed/profile ok-Status, lokale und
        Remote-Level/Coins, das `isRemoteAhead`-Ergebnis. Bewusst dauerhaft,
        nicht nur zum Debuggen wieder entfernen (siehe die eigene Kritik im
        CHANGELOG an der letzten voreiligen Entfernung).
        **Naechster Schritt:** mit dieser Version erneut boosten und einen
        neuen Debug-Report ziehen - der zeigt jetzt, ob `claimCloudProfile`/
        `fetchProfileProgress` ueberhaupt den geboosteten Coins-Wert liefern
        und ob `isRemoteAhead` daraus korrekt `true` berechnet.
  - [x] **v0.1.169-Report ausgewertet: das neue Log erschien ueberhaupt
        nicht** — _ueberholt durch den Befund weiter unten, hier nur noch als
        Verlauf:_ Trotz bestaetigtem Alias-Login zeigte der Report nur
        `app:start`, keinen einzigen `sync:profilePull`-Eintrag - obwohl
        `checkCloudSave()` den eingeloggten Zweig, in dem das Logging sitzt,
        haette durchlaufen muessen. Zwei moegliche Erklaerungen, keine davon
        bestaetigt: (a) ein frueher Guard in `synchronizeData()`/
        `checkCloudSave()` (z.B. `saveSyncBusy`, `scene.isActive()`) bricht
        vor dem Log-Punkt ab, (b) `ProgressSyncSystem.flush()` wirft eine
        ungefangene Exception statt eines `CloudResult`-Fehlers und landet
        im `catch` von `synchronizeData()`, der bisher ebenfalls nichts
        loggte. **Zusaetzliches Logging eingebaut:** `sync:start` (jeder
        Guard-Zustand beim Betreten von `synchronizeData()`), `sync:threw`
        (falls `checkCloudSave()` tatsaechlich wirft, mit Stacktrace),
        `sync:checkCloudSave:signedIn` und `sync:afterFlush` (um zu sehen,
        ob `ProgressSyncSystem.flush()` durchlaeuft oder haengt). Damit ist
        JEDER bisher bekannte stille Ausstiegspunkt jetzt sichtbar.
        **Naechster Schritt:** erneut boosten, neuen Debug-Report ziehen -
        falls wieder kein `sync:*`-Eintrag erscheint, ist die Ursache
        ausserhalb von `MenuScene` zu suchen (z.B. `create()` erreicht
        Zeile `synchronizeData()` gar nicht, oder der Ringpuffer selbst
        verliert Eintraege vor dem Report).
  - [x] **Tatsaechliche Ursache gefunden und belegt (v0.1.170-Report,
        2026-08-18):** Jeder `sync:start`-Eintrag zeigte
        `"sceneActive":false` - bei JEDEM der neun protokollierten
        Aufrufe, ohne Ausnahme. Nachvollzogen in
        `node_modules/phaser/src/scene/SceneManager.js::create()`: Phaser
        ruft `scene.create.call(scene, settings.data)` auf und setzt
        `settings.status = CONST.RUNNING` **danach**, erst nach der
        Rueckkehr aus `create()`. `synchronizeData()` wird am Ende von
        `MenuScene.create()` als `void this.synchronizeData()`
        losgeschickt und lief bis zu ihrem ersten `await` **synchron im
        selben Tick wie `create()`** - genau in diesem Moment lieferte
        `this.scene.isActive()` garantiert `false`. Der Guard
        `if (this.saveSyncBusy || !this.scene.isActive()) return;` brach
        deshalb bei jedem einzigen App-Start sofort ab, bevor
        `checkCloudSave()` je erreicht wurde - unabhaengig von Netz,
        Login-Status oder Boost-Wert. Kein Netzwerk-Timeout, keine falsche
        `isRemoteAhead`-Logik; die ersten zwei "Fixe" fuer dieses Symptom
        (Retry, erweitertes Logging) haben deshalb nichts geaendert. **Der
        Bug bestand schon vor allen drei Sync-bezogenen Commits vom
        2026-08-18** - kein Regressions-Bug, sondern ein alter, bisher nie
        belegter Fehler.
        **Fix:** Der `isActive()`-Teil des Einstiegs-Guards ist aus
        `synchronizeData()` und `checkCloudSave()` entfernt (dort schuetzt
        nur noch `saveSyncBusy`); die spaeteren `isActive()`-Checks nach
        jedem `await` bleiben unveraendert bestehen - dort ist `create()`
        laengst zurueckgekehrt und die Pruefung liefert wieder verlaessliche
        Werte. `npm run verify` gruen (212 Tests).
        **Noch offen:** Geraetetest, der bestaetigt, dass ein Boost nach
        diesem Fix ohne manuellen Abgleich sichtbar wird.
  - [x] **Diagnose-Infrastruktur aus diesem Bug verallgemeinert
        (2026-08-18):** Statt bei jedem kuenftigen Backend-Bug erneut
        manuell Logging nachzuruesten, protokolliert `withTimeout()` in
        `CloudSystem.ts` jetzt automatisch jeden der ~25 Backend-Aufrufe
        (Erfolg UND Fehlschlag, Label + Dauer, keine Nutzlast) in den
        Debug-Ringpuffer. `DEBUG_LOG_BUFFER_SIZE` 200 -> 400, weil dadurch
        mehr Eintraege pro Menuebesuch anfallen. Nebenbei gefunden und
        gefixt: `DebugSystem.ts` zog ueber `SoundSystem` transitiv Phaser
        mit und brach dadurch jeden Vitest-Lauf von `CloudSystem`/
        `AuthSystem`, sobald diese `DebugSystem` importieren - behoben durch
        einen dynamischen statt statischen `SoundSystem`-Import in
        `buildReport()`. `npm run verify` gruen (212 Tests).
> **Die beiden Punkte, die hier standen, sind hochgezogen:** Der
> Profil-Menue-Geraetetest steht jetzt als P0.a.2, "Phase 5 mit Kindern
> balancieren" als P0.c. Inhaltlich unveraendert, nur einsortiert.

### P0.5 — Debug-Modus fuer Tester _(gebaut 2026-08-17, siehe ADR-0016)_

> **Ziel:** Bug-Reports von Emre und Simay ohne Konsole, ohne Admin-PIN.
> Zehnmal aufs Logo im Hauptmenue tippen schaltet einen schwebenden
> Debug-Knopf frei, der ueberall im Spiel sichtbar bleibt. Ein Tipp darauf
> erzeugt einen Text-Report (Geraet, Version, Layout, Ton-Diagnose, die
> letzten 50 Ereignisse/Fehler) plus Screenshot und oeffnet das native
> Share-Sheet (WhatsApp waehlbar).

- [x] `DebugSystem.ts` (Ringpuffer, Report-Text, Toggle-Persistenz,
      Screenshot-zu-File), `DebugConfig.ts`, `ui/debugOverlay.ts`
- [x] Zehn-Tipp-Geste auf dem Logo in `MenuScene`, PIN-frei und getrennt vom
      Wartungsbereich
- [x] `npm run verify` gruen (Typecheck, Lint, Format, 177 Tests, Build)
- [x] **Am echten iPhone geprueft (2026-08-17):** Tipp-Geste trifft das Logo,
      WhatsApp uebernimmt beide Dateien (PNG + TXT).
- [x] **BUG gefunden und behoben: Screenshot komplett schwarz.** Ursache:
      `main.ts` setzt `type: Phaser.AUTO` ohne `preserveDrawingBuffer: true` -
      WebGL loescht den Backbuffer sofort nach dem Praesentieren, und
      `DebugSystem.captureScreenshot()` liest ueber `canvas.toBlob()` einen
      bereits geleerten Puffer. Fix: `preserveDrawingBuffer: true` in der
      `render`-Konfiguration.
- [x] **Fix am echten iPhone bestaetigt (2026-08-17, v0.1.159):** Screenshot
      zeigt jetzt den tatsaechlichen Spielinhalt statt Schwarz.
- [x] **BUG gefunden und behoben (2026-08-18): Log-Ringpuffer war rein
      In-Memory.** Beim Netzwerk-Duell-Testen bemerkt: `logBuffer` in
      `DebugSystem.ts` war ein einfaches Array ohne `localStorage`-Anbindung
      - jeder App-Neustart (z. B. App verlassen, um erst einen Screenshot zu
      pruefen, bevor man teilt) loeschte den kompletten Verlauf. Genau der
      Moment, in dem ein Fehlerbericht am wichtigsten ist. Fix: Puffer wird
      gedrosselt (500ms, wegen `TimerChanged` mit ~60 Eintraegen/s waehrend
      eines Runs) in `localStorage` gespiegelt, zusaetzlich sofort beim
      `visibilitychange`-Event (App-Wechsel) geschrieben, und beim
      Modul-Start wiederhergestellt. Neuer `DEBUG_LOG_STORAGE_KEY`, 5 neue
      Tests.

> **P0.5 damit vollstaendig abgeschlossen.**

### P1 — Fortschritt vor Wettbewerb

#### P1.a — Die eine Entscheidung, die P1 blockiert _(zusammengefuehrt 2026-08-21)_

> **Warum hier:** Das Talentpunkte-Thema stand bisher an drei Stellen — als
> pausierter P1-Block, als offene Frage im Gespraechsprotokoll und als
> "Talentbaum-Konzept eindeutig entscheiden" im Audit-Anhang. Die Rechnung,
> die es entscheidet, stand nur an der mittleren Stelle. Alles drei ist hier
> zusammengezogen; die anderen zwei Stellen verweisen hierher.
>
> **Solange das offen ist, sind vier P1-Punkte und der halbe Talentbaum
> blockiert.** Es ist eine Entscheidung, kein Bauauftrag — sie kostet ein
> Gespraech, nicht eine Woche.

- [ ] **Entscheiden: bleiben Talente bei Coin-Kosten, oder kommen
      Talentpunkte?** Die Argumente stehen vollstaendig da, ein Urteil fehlt:
  - **Gegen den Umbau (Rechnung vom 2026-08-19/20):** Alle 32 Talentraenge
    kosten heute 15 650 Muenzen. Bei einem Punkt je zwei Level gaebe es bis
    Stufe 100 aber **50 Punkte** bei nur 32 Raengen — ab etwa Stufe 64 waere
    alles voll und die Belohnung wertlos. Der Reiz von Talentpunkten liegt im
    Verzicht; wenn am Ende ohnehin alles offen ist, bleibt nur eine
    Reihenfolge statt einer Wahl.
  - **Gegen den Umbau, zweites Argument (aus Phase 2):** Der Ueberschuss ist
    beim Coin-Weg bereits geloest — sind alle Talente auf Maximalrang, wird
    der Punkt nicht vergeben, sondern zu Coins (10 je Punkt, `GameConfig.ts`).
    Das Problem, das der Umbau loesen wollte, hat also schon eine Antwort.
  - **Fuer den Umbau:** Levelaufstiege haetten eine eigene, spuerbare
    Belohnung statt nur Coins. Kindgerecht ist "du hast einen Punkt bekommen"
    greifbarer als ein Kontostand.
  - **Falls Umbau:** Von Level 1 bis 100 gibt es nur 99 Aufstiege. Entweder
    hat der Baum 99 Raenge, oder ein neues Profil startet mit einem
    Talentpunkt, damit 100 Raenge erreichbar sind.
- [ ] **Erst nach der Entscheidung:** Bezeichnung klaeren. Die aktuelle
      Ansicht ist fachlich eine Talentliste, kein Baum. Entweder echte Zweige
      mit Verbindungen und Voraussetzungen bauen (drei Wege pruefen:
      Beweglichkeit, Konzentration, Belohnung) oder das Wort "Talentbaum"
      durch ein klares "Talente"-Menue ersetzen. _(aus dem Audit 2026-08-21)_
- [ ] **Nur falls der Umbau kommt:** Talentbaum auf die beschlossene
      Gesamtzahl ausbauen; darunter eine kindgerechte Schleife/Route als
      sichtbaren Fortschritt zeichnen.
- [ ] **Nur falls der Umbau kommt:** Sichere Migration fuer bestehende
      Coin-Talente und den Supabase-Stand planen, bevor die Kosten umgestellt
      werden.

#### P1.b — Fortschritt und Profil
- [x] ~~Coins bleiben Waehrung fuer spaetere Skins und optionale Boni;
      Skin-Inventar und Shop nur vorbereiten, nicht vor dem Talentpunkte-Umbau
      bauen.~~ **Ueberholt (2026-08-20):** Der Shop ist gebaut und ausgeliefert
      (v0.1.196 bis v0.1.205) — 30 Fluggestalten, 30 Farben, Anprobe vor dem
      Kauf, Loeschung beim Wartungs-Reset. Der Talentpunkte-Umbau blieb dabei
      unberuehrt; die Reihenfolge war doch nicht bindend.
- [ ] Profilfluss verbessern: beim allerersten Profil einen getrennten sichtbaren
      Spielernamen erfragen; danach im Profil/Aliasbereich aenderbar halten.
- [ ] Auswaehlbare Profil-Icons/Avatare vorbereiten. **Anschluss an den Shop:**
      Sie sollen dort kaufbar sein, mit demselben Besitz- und Anprobe-Muster
      wie Formen und Farben (`config/shop.ts`).
- [ ] Level/XP aus dem Hauptmenue ausblenden und erst nach einem klaren
      "JAGD BEGINNEN"-Schritt zeigen.
- [ ] Den vorhandenen Kettenbonus gegen die konkrete Regel "drei blaue
      Planeten hintereinander = doppelte Punkte" abgleichen und entscheiden,
      ob beide Boni nebeneinander bestehen sollen.

#### P1.c — Aus dem Audit hochgezogen _(2026-08-21)_

> **Auswahl statt Sammelposten.** Der Audit-Anhang unten enthaelt rund 50
> Punkte. Diese drei sind hier eingeplant, weil sie auf etwas bereits
> Gebautes zeigen und mit den zwei bekannten Spielern ueberpruefbar sind.
> Der Rest bleibt Reserve — siehe den Reserve-Hinweis vor dem Anhang.

- [ ] **Nach dem Run genau ein naechstes Ziel zeigen.** Statt mehrerer gleich
      starker Menueoptionen eine konkrete Motivation: "Noch 80 Coins bis
      Magnetismus Rang 1" oder "Noch 2 Runs bis Welt Eisring". Aus
      Progression, Shop und Talenten gemeinsam abgeleitet. **Warum
      hochgezogen:** billigster Motivationsgewinn im ganzen Anhang, weil alle
      drei Datenquellen bereits existieren.
- [ ] **Fortschritt innerhalb gesperrter Erfolge anzeigen.** Neben "gesperrt"
      soll "37 / 50 Relikte" oder "Combo 18 / 25" stehen. Die Berechnung darf
      nicht in der Scene dupliziert werden, sondern kommt aus der
      Achievement-Definition. **Warum hochgezogen:** Erfolge sind gebaut, aber
      ohne sichtbaren Fortschritt sind sie fuer Kinder unsichtbare Ziele.
- [ ] **Sammlungsfortschritt im Shop sichtbar machen.** "12 von 100 Formen",
      "18 von 30 Farben", neue Gegenstaende markieren. **Warum hochgezogen:**
      Mit 100 Fluggestalten seit v0.1.209 ist die Liste lang genug, dass ohne
      Zaehler niemand mehr sieht, wie weit er ist. Filter, Favoriten und
      Loadouts bleiben dagegen Reserve — die kommen erst, wenn das Sortiment
      ohne sie unbedienbar wird.

### P2 — Phase 6: Wettbewerb und Freunde

- [ ] Rangliste per Supabase Realtime aktualisieren, solange sie geoeffnet ist.
- [ ] Rekord-Ereignis im Spiel sichtbar machen; Web-Push fuer installierte Apps
      erst danach mit Einwilligung planen.
- [ ] Serverseitige Laufpruefung als Voraussetzung fuer einen echten
      Ranked-Modus.
- [ ] Freundesmodell auf `profiles` aufsetzen: Anfrage, Annahme, Online-Status,
      Rekord und Coin-Anzeige.
- [ ] 1vs1-Einladung zuerst als Duell-Link zwischen zwei Geraeten bauen;
      Echtzeit erst als folgenden Schritt pruefen.

### P3 — erst nach stabilem Kern

- [ ] Wiedergeburt/Prestige konzipieren: klarer Reset-Umfang, dauerhafter
      Multiplikator, Schutz vor versehentlichem Ausloesen und Migration fuer
      bestehende Profile.

### Zurueckgestellt — bewusst nicht eingeplant, Anlass abwarten

> **Warum ein eigener Abschnitt (neu 2026-08-21):** Ein Punkt, der im eigenen
> Text "bewusst zurueckgestellt" sagt, gehoert nicht in "erst absichern und
> messen". Er ist deshalb nicht geloescht, sondern hierher verschoben — mit
> der Bedingung davor, unter der er wieder aktiv wird.

**Wird aktiv, sobald eine Veroeffentlichung ueber den Familienkreis hinaus
konkret geplant wird:**

- [ ] **DSGVO-Einschaetzung fuer Kinderdaten einholen, falls Veroeffentlichung
      angestrebt wird** _(aktualisiert 2026-08-17)_ — `profiles`/`scores`
      speichern Aliase von Minderjaehrigen, Supabase-Region `eu-west-1` (EU,
      kein Drittlandtransfer).
      **Stand heute bestaetigt: Reichweite ist ausschliesslich enge Familie,
      keine Freunde, keine Bekannten** — damit greift die Haushaltsausnahme
      (Art. 2 Abs. 2 lit. c DSGVO) unstrittig, hier besteht kein akuter
      Klaerungsbedarf.
      **Die eigentlich offene Frage ist eine andere:** was eine oeffentliche
      Veroeffentlichung braucht. Das ist kein Graubereich mehr, sondern volle
      Pflicht: Impressum (TMG/DDG), Datenschutzerklaerung (Art. 13 DSGVO),
      Auftragsverarbeitungsvertrag mit Supabase (Art. 28), ueberpruefbare
      Elterneinwilligung fuer Nutzer unter 16 (Art. 8 DSGVO — der aufwendigste
      Punkt, ein Alterskennzeichen allein ersetzt das nicht), sowie ein
      Loeschkonzept/Betroffenenrechte-Prozess. Diskutierte, aber ungeprueft
      abgesegnete Ideen: erzwungene, nicht identifizierende Aliase (reduziert
      Re-Identifizierbarkeit, ersetzt Art. 8 aber nicht), Timestamps aus der
      Rangliste entfernen (nur Randwirkung, loest nicht das Kernproblem).
      **Bewusst zurueckgestellt (2026-08-17):** Veroeffentlichung ist aktuell
      nicht geplant, das Thema wird erst bei konkretem Anlass wieder
      aufgegriffen. Bis dahin bleibt die Bestenliste auf den bekannten
      Personenkreis begrenzt — siehe Vermerk bei Phase 6 unten.

### Reserve — Detailbeschreibungen aus dem Audit (2026-08-21)

> **Status: Reserve, nicht eingeplant.** Die rund 50 Punkte unten stammen aus
> einem Audit ausserhalb der Architekturpruefung. Sie sind fachlich richtig,
> aber sie beschreiben ueberwiegend Produktarbeit fuer ein Produkt mit
> Nutzerbasis — die Zielgruppe hier sind zwei Kinder und die enge Familie, und
> eine Veroeffentlichung ist laut Abschnitt oben nicht geplant.
>
> **Deshalb keine Prioritaetsmarken mehr an diesen Punkten.** Sie standen
> vorher als sieben Sammelposten in P0, P1 und P2 — Checkboxen mit bis zu elf
> Themen darin, die nie abhakbar sind und die Liste doppelt zaehlen liessen
> (einmal als Container, einmal im Anhang). Die Sammelposten sind entfernt.
>
> **So wird dieser Abschnitt benutzt:** Wenn P0 leer ist, wird hier ein
> einzelner Punkt herausgezogen, begruendet nach oben einsortiert und dort
> abgearbeitet — so wie es am 2026-08-21 mit dem Tagesbonus (nach P0.b) und
> mit drei P1-Punkten geschehen ist. **Nicht** blockweise abarbeiten.
>
> **Vorgemerkt als naechste Kandidaten**, wenn wieder Platz ist — alle drei
> zeigen auf die Luecke, die den Sync-Bug drei Runden hat leben lassen:
>
> - `CloudSystem`-Suite mit `isBackendConfigured: true` (siehe "Offen aus dem
>   Audit vom 2026-08-19")
> - Progressionsinvarianten als feste Regeln pruefen (siehe "Test-, QA- und
>   Release-Prozess")
> - `SyncDecisionSystem` herausloesen (siehe "Querschnitt")

#### Erste Spielminute und Onboarding

- **Den ersten Run als spielbares Tutorial gestalten.** Das Designziel
      „in 5 Sekunden verstanden“ bleibt erhalten, aber der erste Durchgang
      soll die Regeln kontrolliert und ohne langen Text vermitteln. Moeglicher
      Ablauf: zuerst ein einzelnes Relikt, danach ein farbiges Relikt, dann die
      erste Serie, anschliessend ein sichtbarer Reichweiten-/Magnetismusfall und
      erst danach die normale Spawn-Dichte.

- **Kein separates Texttutorial erzwingen.** Die Einfuehrung soll direkt im
      laufenden Spiel passieren und bei erfahrenen Spielern nach dem ersten
      abgeschlossenen Einstieg automatisch entfallen. Fuer Tests und Debugging
      soll sie per Profil-/URL-Option erneut gestartet werden koennen.

- **Nach dem Run genau ein naechstes Ziel zeigen.** _(→ eingeplant als P1.c)_ Statt mehrere gleich
      starke Menueoptionen nebeneinander zu stellen, soll der Ergebnis- oder
      Menuebildschirm eine konkrete Motivation geben, zum Beispiel:
      „Noch 80 Coins bis Magnetismus Rang 1“ oder „Noch 2 Runs bis Welt Eisring“.
      Die Information soll aus Progression, Shop und Talenten gemeinsam
      abgeleitet werden.

- **Die ersten drei Minuten als zusammenhaengende Lernkurve pruefen.**
      Nach dem ersten Run soll der Spieler mindestens eine sichtbare Belohnung,
      eine erklaerte Mechanik und ein erreichbares naechstes Ziel erhalten.
      Dabei darf der Bildschirm nicht mit XP, Coins, Erfolgen, Welten und Shop-
      Hinweisen gleichzeitig ueberladen werden.

#### Progression und Coin-Oekonomie

- **Coin-Quellen und Coin-Senken regelmaessig messen.** Die Quellen sind
      Grundbelohnung, Sammelboni, Seltenheiten, Levelaufstiege, Erfolge,
      Tageslauf und Login-Bonus. Ausgaben sind Talente, Talent-Reset,
      Schiffsformen und Farben. Pro Testprofil und Run-Reihe erfassen:
      durchschnittliche Coins je Run, Coins je Level, Zeit bis zum ersten
      Talent, Zeit bis zum ersten kosmetischen Kauf sowie Restguthaben nach
      10, 25, 50 und 100 Runs.

- **Dem Spieler eine Kaufprognose anzeigen.** Bei Talenten und Shop-
      Gegenstaenden soll sichtbar sein, wie viele normale Runs ungefaehr bis
      zum Kauf fehlen. Die Schaetzung ist nur eine Orientierung und muss mit
      derselben Coin-Berechnung wie die Progression arbeiten.

- **Level 100 und das Endgame bewusst planen.** Nach dem maximalen Level
      darf der Spieler nicht das Gefuehl bekommen, dass alle langfristigen
      Ziele verschwunden sind. Moegliche rein kosmetische Endgame-Schleifen:
      Meisterschaftsstufen, Sammelalben, wechselnde Tages-/Wochenziele,
      besondere Schweiffarben oder saisonal rotierende Challenge-Abzeichen.
      Keine unbegrenzte Machtsteigerung, die alte Inhalte entwertet.

- **Das Talentbaum-Konzept eindeutig entscheiden.** _(→ zusammengefuehrt in P1.a)_ Die aktuelle Ansicht
      ist fachlich eine Talentliste. Entweder echte Zweige mit Verbindungen und
      Voraussetzungen bauen oder die Bezeichnung „Talentbaum“ durch ein
      klares „Talente“-Menue ersetzen. Bei einem echten Baum drei erkennbare
      Wege pruefen: Beweglichkeit, Konzentration und Belohnung.

#### Erfolge und langfristige Ziele

- **Fortschritt innerhalb gesperrter Erfolge anzeigen.** _(→ eingeplant als P1.c)_ Neben „gesperrt“
      soll sichtbar sein: „37 / 50 Relikte“, „Combo 18 / 25“ oder „noch 2 Runs“.
      Die Berechnung darf nicht in der Scene dupliziert werden, sondern soll
      aus der Achievement-Definition kommen.

- **Erfolge kategorisieren und nach Naehe sortierbar machen.** Kategorien:
      Combo, Sammeln, Welten, Spielzeit, Talente, Tageslauf und Spezialaktionen.
      Zusaetzlich einen Bereich „fast geschafft“ und einen empfohlenen naechsten
      Erfolg pruefen.

- **Mehr spielerische statt ausschliesslich mengenbasierte Erfolge
      ergaenzen.** Beispiele: ein legendaeres Relikt ohne Magnetismus fangen,
      eine Serie nach einem riskanten Umweg retten, ein Hindernis knapp
      umfliegen oder eine Runde ohne Zeitverlust durch Hindernisse beenden.
      Die Bedingungen sollen verschiedene Spielstile belohnen und nicht nur
      lange Spielzeit.

- **Erfolgsbelohnungen beim Ergebnis begrenzen und staffeln.** Viele
      gleichzeitige Freischaltungen sollen nicht als langer Textblock
      untergehen. Eine kompakte Auswahl mit anschliessender Detailansicht
      pruefen; die vollstaendige Liste bleibt im Erfolge-Bildschirm.

#### Shop und kosmetische Sammlung

- **Den Shop bei wachsendem Sortiment filterbar machen.** Filter pruefen:
      erschwinglich, neu, besessen, nicht besessen und favorisiert. Die
      Auswahl soll nicht nur eine lange vertikale Liste bleiben.

- **Form und Farbe als kombinierte Vorschau darstellen.** Die Anprobe soll
      in einer groesseren Vorschau bereits Schiffsform, Rumpffarbe, Aura,
      Schweif und spaeter Talent-/Magneteffekte zeigen.

- **Favoriten und Loadouts ergaenzen.** Spieler sollen Kombinationen wie
      „Eis“, „Glut“ oder „Mein Lieblingsschiff“ speichern und mit einem Tipp
      anlegen koennen. Das bleibt rein kosmetisch und veraendert keine Werte.

- **Sammlungsfortschritt sichtbar machen.** _(→ eingeplant als P1.c)_ Zum Beispiel „12 von 40
      Formen“ und „18 von 30 Farben“, neue Gegenstaende markieren und zuletzt
      erworbene Inhalte hervorheben. Sets oder thematische Kollektionen
      koennen zusaetzliche kosmetische Ziele liefern.

- **Content-Linter fuer Shopdaten ausbauen.** Automatisch pruefen: doppelte
      IDs, fehlende Zeichnungen, ungueltige Preise, zu lange Namen,
      fehlende Beschreibungen, nicht vorhandene Farben und nicht darstellbare
      Kombinationen.

#### Game-Feel, Unterbrechungen und Bedienung

- **Verhalten bei App-Unterbrechungen festlegen.** _(→ Teilaspekt Auto-Pause eingeplant als P0.b)_ Anruf, Bildschirm-
      sperre, Kontrollzentrum, Safari-Wechsel und verlorener Browserfokus
      muessen eine eindeutige Regel bekommen. Solo-Runs sollten auf Wunsch
      automatisch pausieren und „Run pausiert“ anzeigen. Im Duell muss die
      Regel wegen Fairness gesondert gelten.

- **Wiederaufnahme nach Unterbrechung testen.** Nach `visibilitychange`,
      `pageshow`, Netzverlust und Rueckkehr darf kein Run still Zeit verlieren,
      keine Eingabe haengen bleiben und kein alter Pointer weitersteuern.

- **Optionale haptische Rueckmeldung pruefen.** Kurzer Impuls bei Fang,
      Hindernis, seltenem und legendaerem Relikt. Abschaltbar, nicht als
      Pflichtfunktion und mit Sound-/Visual-Fallback fuer Geraete ohne
      Vibrationsunterstuetzung.

- **Feedback-Hierarchie definieren.** Score-Popup, Combo, Schweif,
      Talent-Aura, Magnetlinien, Hinderniswarnung, Bildschirmimpuls und Sound
      duerfen sich nicht gegenseitig ueberdecken. Eine Reihenfolge fuer
      wichtige Ereignisse festlegen: legendaeres Relikt vor seltenem Relikt,
      Run-Ende vor Nebenfeedback, Spielerziel vor Hintergrunddekoration.

- **Audio in Kategorien und Intensitaeten teilen.** SFX, Combo, seltene
      Ereignisse, Menue und spaetere Musik getrennt steuern. Wiederholte
      Combo-Sounds muessen gedrosselt oder dynamisch variiert werden, damit ein
      langer Run nicht ermuedet.

#### Accessibility und Lesbarkeit

- **Reduced-Motion-Modus einfuehren.** Partikel, Nachbilder, Blinkeffekte,
      Bildschirmimpulse und schnelle Tweens muessen abgeschwaecht oder ersetzt
      werden koennen. Die Spielmechanik bleibt unveraendert.

- **High-Contrast-Modus und Farbsehvarianten pruefen.** Seltenheiten,
      Talentwirkungen und Hindernisse duerfen nicht nur ueber Farbe erkennbar
      sein. Formen, Muster, Ringtypen, Icons und optionale Audiohinweise als
      zweite Informationsebene einsetzen.

- **Schrift- und UI-Groessen als Einstellung anbieten.** Besonders kleine
      Texte in Shop, Talentbaum, Ergebnis und Bestenliste sollen vergroesserbar
      sein, ohne dass wichtige Aktionen aus dem sicheren Bereich laufen.

- **Touchziel-Grenzen vereinheitlichen.** Alle interaktiven Flaechen sollen
      die Mindestgroesse fuer Fingerbedienung einhalten. Kleine Weltpfeile,
      Seitenwechsel und sekundare Aktionen separat auf echten Geraeten testen.

- **Linkshaender- und Einhandmodus pruefen.** Wichtige Aktionen, Timer,
      Pause und Ergebnisnavigation sollen optional in eine angenehmere Zone
      verschoben werden koennen, ohne die Spielfeldlogik zu veraendern.

- **Canvas-UI durch Status-/Vorleseebenen ergaenzen.** Fuer Menueaktionen,
      Ergebnis, Run-Status, Pause und Fehlermeldungen eine zusaetzliche DOM-
      oder Live-Region pruefen. Das muss nicht jedes Spielfeldobjekt abbilden,
      soll aber die wichtigsten Zustandswechsel zugreifbar machen.

#### Tageslauf, Zeit und Challenge-Logik

- **Tageslauf-Zeitzone eindeutig festlegen.** Der Client erzeugt den
      Tages-Schluessel derzeit aus der lokalen Geraetezeit. Serverseitig wird
      im Tagesbonus-RPC der Schluessel sichtbar nur auf das Datumsformat
      geprueft. Serverdatum, lokale Anzeige, Sommerzeit, Mitternacht und
      Offline-Runs muessen eine dokumentierte gemeinsame Regel erhalten.

- **Tagesbonus serverseitig an den aktuellen Tag binden.** _(→ eingeplant als P0.b)_ Pruefen, ob ein
      Nutzer durch frei gewaehlte gueltige Datumsstrings mehrere Tagesboni
      hintereinander beanspruchen kann. `claim_daily_bonus()` und
      `claim_daily_login_bonus()` sollten den Servertag verwenden oder eine
      nachvollziehbare erlaubte Zeitspanne pruefen.

- **Tageslauf abwechslungsreicher machen.** Neben dem festen Seed weitere
      rotierende Ziele oder Modifikatoren pruefen: Combo-Ziel, bestimmte
      Seltenheit, Zeitbonus, Hindernisregel oder Weltvorgabe. Die Bedingungen
      muessen vorher sichtbar und fair sein.

- **Bot-Duell transparenter gestalten.** Pruefen, ob der Bot als
      simuliertes Ergebnis erklaert wird und ob seine Schwierigkeit stabil,
      nachvollziehbar und nicht nur als Multiplikator auf die Spielerleistung
      wahrgenommen wird. Eine kleine Zielkurve oder ein Ghost-Verlauf waere
      verstaendlicher als ein rein abstrakter Gegnerwert.

#### Bestenliste und Wettbewerb

- **Vergleichbarkeit der Welten dauerhaft pruefen.** Wenn Welten mehr
      seltene Beute, andere Lebensdauer oder andere Punktmultiplikatoren
      erhalten, ist eine gemeinsame Bestenliste nicht automatisch fair.
      Normalisierten Score, getrennte Weltlisten oder klare Welt-/Regelmarker
      pruefen.

- **Versions- und Regelstand im Ranking speichern.** Ein Score sollte
      erkennen lassen, mit welcher Spielversion und welchen Weltregeln er
      entstanden ist. Bei grossen Balancingaenderungen koennen alte Rekorde
      archiviert statt still verglichen werden.

- **Casual- und Ranked-Bestenliste trennen.** Solange der Server keinen
      vollstaendigen Run nachrechnet, sollte die Rangliste als plausibilisiert
      oder casual gekennzeichnet werden. Ein echter Ranked-Modus braucht eine
      staerkere serverseitige Verifikation.

- **Netzwerk-Duell gegen Abbruch und Wiederverbindung testen.** Timeout,
      App-Hintergrund, Netzwechsel, verspaetete Presence-Events, doppeltes
      Ergebnis und Revanche nach einem Abbruch muessen einen eindeutigen
      Abschlusszustand besitzen.

#### Backend-Sicherheit, Datenschutz und Betrieb

- **Anmelde- und Codeversuche begrenzen.** Alias/PIN-Anmeldung,
      Sync-Codes und Duel-Room-Codes brauchen serverseitige Rate-Limits,
      Fehlversuchszaehler und gegebenenfalls kurze Sperrzeiten. Die sechs-
      stelligen Codes sind nur dann ausreichend, wenn beliebiges Raten begrenzt
      wird.

- **Oeffentliche RPC-Berechtigungen regelmaessig pruefen.** Besonders
      Bereinigungsfunktionen wie `purge_expired_sync_codes()` und
      `purge_expired_duel_rooms()` sollten nicht unnoetig von anonymen Clients
      beliebig oft aufgerufen werden koennen. Serverseitige Cron-Bereinigung
      oder begrenzte Wartungsaufrufe pruefen.

- **Client- und Server-Balancing nicht doppelt pflegen.** Raritaeten,
      Welten, Punktwerte und plausible Scoregrenzen stehen teilweise sowohl in
      TypeScript als auch in SQL. Eine gemeinsame generierte Datenquelle oder
      Contract-Tests zwischen Code und Datenbank pruefen, damit neue Welten und
      Raritaeten nicht nur auf einer Seite geaendert werden.

- **SQL-Migrationsprozess formalisieren.** Die vielen `phase_2_x.sql`-
      Dateien brauchen eine nachvollziehbare Reihenfolge, angewendete
      Versionsnummer, Vorbedingungen, Rollback-Hinweise und eine getrennte
      Test-/Produktionspruefung. Eine kleine `schema_migrations`-Tabelle oder
      ein Migrationsprotokoll pruefen.

- **Profilverwaltung vervollstaendigen.** Fuer dauerhafte Online-Profile
      einen nachvollziehbaren Weg fuer Abmeldung, Datenexport, Profilloeschung,
      Cloud-Spielstandloeschung und lokalen Reset vorsehen.

- **Alias-Moderation und Schutzbegriffe ergaenzen.** Reservierte Namen,
      beleidigende Begriffe und missverstaendliche Systemnamen aus der
      Bestenliste herausfiltern. Die Regeln muessen clientseitig freundlich
      anzeigen und serverseitig verbindlich pruefen.

#### PWA, Mobile und Offline-Betrieb

- **Echte Offline-PWA pruefen und ergaenzen.** Ein Manifest macht die App
      installierbar, ersetzt aber keinen Service Worker. App-Shell, gehashte
      Bundles, Logos und Texturen sollen nach einem erfolgreichen Erstbesuch
      offline verfuegbar bleiben.

- **PWA-Updates ohne Run-Unterbrechung organisieren.** Neue Versionen erst
      im Menue oder nach dem Ergebnis anbieten. Kein automatischer Reload
      waehrend eines laufenden Runs. Cache-Version und `APP_VERSION` sollen
      nachvollziehbar zusammenpassen.

- **Renderoptionen messen und geraeteabhaengig pruefen.**
      `preserveDrawingBuffer: true`, hohe GPU-Prioritaet und Antialiasing sind
      fuer Debug-Screenshots beziehungsweise Optik hilfreich, koennen aber
      Speicher, Akku und Waerme beeinflussen. Debug-Screenshotpfad und
      Produktionspfad getrennt messen.

- **Seltene Scenes spaeter lazy laden.** Admin-, Debug-, Bestenlisten- und
      Online-Duell-Code muss nicht zwingend im ersten App-Bundle liegen. Vorher
      Startzeit, Cache-Verhalten und echte Mobilgeraete messen.

- **Mobile Performance-Budgets definieren.** Fuer Startzeit, Framezeit,
      Partikelzahl, aktive GameObjects, Speicher und Akkuverbrauch Messwerte
      festlegen. Nicht nur „laeuft“, sondern auch „bleibt nach 90 Sekunden auf
      schwachen Geraeten stabil“ pruefen.

#### Test-, QA- und Release-Prozess

- **Property- und Fuzz-Tests fuer Spielstand und Migrationen ergaenzen.**
      Zufallsspielstaende, fehlende Felder, falsche Typen, negative Werte,
      doppelte Achievements, ungueltige Shopbesitze und alte SAVE_VERSIONs
      automatisch gegen `migrate()` und `reconcile()` testen.

- **Progressionsinvarianten als feste Regeln pruefen.** Coins duerfen nie
      negativ werden, Talentrang darf nie ueber `maxRank` steigen, ein
      ProgressEvent darf nur einmal wirken, ein Kauf darf nicht doppelt
      abgerechnet werden und ein Duell muss bei gleicher Seedfolge identisch
      bleiben.

- **Zeit- und Netzwerk-Matrix in den Playtest aufnehmen.** Offlinegehen
      genau beim Run-Ende, Netzverlust waehrend eines Kaufs, App-Abbruch nach
      einer RPC-Antwort, Wiederaufnahme nach Hintergrund und abgelaufene
      Sync-/Duel-Codes als echte Browserablaeufe testen.

- **Production-Artefakt statt nur Dev-Server pruefen.** Smoke- und
      Playtests sollen mindestens einmal gegen den gebauten `dist`-Stand oder
      eine Preview laufen. So werden relative Assetpfade, Manifest, Version,
      Cache und Code-Splitting mitgeprueft.

- **Visual Regression fuer zentrale Zustaende etablieren.** Festgelegte
      Screenshots fuer Start, erster Run, jede Schweifstufe, Talentraenge,
      Shopvorschau, Ergebnis, Tageslauf und Duellstatus erzeugen. Kleine
      Layout- oder Kontrastverschlechterungen sollen dadurch auffallen.

- **iOS- und Android-Geraetetests erweitern.** Nicht nur Syntax- und
      Playwright-Pruefungen, sondern echte Tests fuer Safe Area, Standalone-
      Modus, Tastatur, Audio-Unlock, App-Hintergrund, Notch, Home-Indikator,
      schwache Hardware und Hoch-/Querformat dokumentieren.

#### Texte, Lokalisierung und Content-Wartbarkeit

- **UI-Texte zentralisieren.** Viele Meldungen und Beschriftungen stehen
      direkt in Scenes. Einen Textkatalog mit stabilen IDs, Pluralformen,
      Zahlenformaten, Datumsformaten und Fehlermeldungen pruefen. Das macht
      spaetere Sprachversionen und kindgerechte Textanpassungen sicherer.

- **Begriffe vereinheitlichen.** Fuer Run, Serie, Combo, Rang, Level,
      Coins, Relikt, Talent, Profil und Bestenwert einen verbindlichen Wort-
      katalog festlegen. So werden Menue, Ergebnis, Talentbaum und Cloud-
      Meldungen nicht sprachlich uneinheitlich.

- **Content-Validierung ausbauen.** Welt-, Talent-, Raritaets-, Shop- und
      Achievementdaten automatisch auf doppelte IDs, fehlende Texte,
      ungueltige Werte, zu lange Labels, fehlende Texturen und widerspruechliche
      Freischaltbedingungen pruefen.

#### Datenschutz und kinderfreundlicher Betrieb

- **Gespeicherte Daten transparent dokumentieren.** Klar ausweisen, welche
      Profil-, Fortschritts-, Bestenlisten- und Diagnoseinformationen lokal
      beziehungsweise online gespeichert werden.

- **Debug- und Diagnoseberichte datensparsam halten.** Keine Tokens,
      Passwoerter, PINs, vollstaendige Spielstaende oder unnoetige persoenliche
      Daten in Logs und Share-Reports aufnehmen. Die vorhandene lokale
      Diagnose sollte diesen Vertrag als automatisierten Test behalten.

- **Loesch- und Widerrufswege fuer Familien sauber gestalten.** Lokalen
      Spielstand, Cloud-Profil und Ranglisteneintrag getrennt loeschbar machen
      und jede Aktion deutlich bestaetigen. Ein Reset darf nicht unbemerkt
      wieder durch eine ausstehende Outbox hergestellt werden.

### Entschieden (2026-08-13)

- **Phase 1 ist abgeschlossen.** Auf dem Handy laeuft v0.1.3, die Knoepfe
  reagieren. Der Fehler lag an der Auslieferung, nicht am Code.
- **Bestenliste wird geleert** beim Wechsel auf 90 Sekunden.
- **Talente werden mit Coins gekauft; Levelaufstiege geben Level-Coins.**
- **Bestenliste soll uebergreifend sein** — geprueft: sie ist heute pro Welt
  getrennt. **Nach Phase 1.3 vorgezogen, dringend.**
- **Jeder Run wird automatisch eingetragen** (Variante B, ohne Filterung auf
  Bestwerte). Der Knopf im Ergebnisbildschirm entfaellt.
- **Spielstaende werden automatisch gesichert.** Offline bleibt `localStorage`
  massgeblich; ein besserer Cloud-Stand wird vor der Uebernahme angezeigt.
- **`SPIELSTAND` wird zu `EINSTELLUNGEN`.** Die Profiluebertragung bleibt dort
  als kindgerechter Unterpunkt erhalten.

### Noch offen — erst bei der jeweiligen Phase noetig

- **2.5 Balken:** flexibles Spielfeld oder nur die Balken einfaerben? Ersteres
  betrifft alle Scenes und verschiebt das Balancing.
- **3 Weltraum:** sollen die Dokumente jetzt umgeschrieben werden?
- **3.6 Dynamic Island:** native Umsetzung wird **nach Phase 4** angegangen.
  Vorbereitung und Planung beginnt jetzt; fuer iOS ohne eigenen Mac laufen
  Build und Signierung spaeter ueber Codemagic (Cloud) und TestFlight —
  Details in ADR-0015 (`docs/DECISIONS.md`) und im neuen Abschnitt
  "M8 — Native App vorbereiten" unten.
- **2.6 Login & Mehrgeräte-Profil:** wird vor dem Abschluss von Phase 4
  priorisiert. Der bisherige Sync-Code bleibt als Migration und Notfallweg;
  der neue Standard wird ein Backend-Profil mit Login.
- **5 Hindernisse:** entschieden und umgesetzt — ab Nullsektor bestrafen
- **6 Manipulationsschutz:** vor oder nach Ranked-Modus und Rekord-Meldungen?

### M8 — Native App vorbereiten (geplant, siehe ADR-0015)

> **Blockiert nichts.** Diese Punkte sind reine Konto-/Rahmenvorbereitung
> ohne Codeänderung und verzögern M4.1, M6 oder M7 nicht. Die eigentliche
> Umsetzung (Capacitor-Integration, `codemagic.yaml`) bleibt hinter M4.1/M6/M7
> einsortiert.

**Jetzt schon klärbar:**

- [x] **Apple Developer Account Status geprueft (2026-08-17):** Team-ID
      `2ML2A7586J`, App Store Connect Zugriff vorhanden, 2FA ueber iPhone
      aktiv. **Mitgliedschaft ist abgelaufen** (war frueher aktiv) — bewusst
      noch nicht reaktiviert, da M8 ohnehin erst nach M4.1/M6/M7 beginnt.
      **Reaktivierung ist der erste Schritt bei M8-Start**, vor App-Eintrag
      und Bundle-ID-Reservierung (die brauchen eine aktive Mitgliedschaft).
- [ ] App Store Connect: App-Eintrag "isiHunt" anlegen, Bundle-ID reservieren
      (Namensschema noch offen, siehe ADR-0015). **Voraussetzung: Mitgliedschaft
      reaktiviert.**
- [ ] App Store Connect API Key erzeugen (Rolle "App Manager"/"Admin"),
      Key-ID/Issuer-ID/`.p8`-Datei sicher verwahren.
- [ ] Codemagic-Account anlegen, Repository verbinden, API Key als
      Signing-Integration hinterlegen; vorher Preismodell/Build-Minuten fuer
      macOS-Builds pruefen.
- [ ] Testergruppe (E-Mail-Adressen) fuer TestFlight sammeln.

**Erst mit M8 (nach M4.1, M6, M7):**

- [ ] Capacitor-Pakete einbinden, `ios/`-Ordner erzeugen, `capacitor.config.ts`
      anlegen.
- [ ] `codemagic.yaml` einrichten, ersten Testbuild durchlaufen lassen.
- [ ] Update-Check-Mechanismus (`src/core/updateCheck.ts`) fuer die native
      Variante loesen (deaktivieren oder eigener Hinweis).
- [ ] Gerätetest der bestehenden Systeme auf echtem TestFlight-Build:
      Sound-Unlock (`SoundSystem`), Safe-Area (`SafeAreaSystem`,
      `viewport.ts`), `localStorage`-Persistenz (`SaveSystem`).
- [ ] Android-Reihenfolge gegen die Roadmap abgleichen (Roadmap nennt
      "Capacitor, Android-Test, iOS-Build/TestFlight" — Android zuerst als
      Testplattform).

### Offen aus dem Audit vom 2026-08-19

Sechs Durchgaenge ueber v0.1.185; zwei Defekte und drei latente Schwachstellen.
Die Defekte sind behoben (v0.1.187/188), die Testluecken nicht. Der Bericht
liegt als Artefakt vor, nicht im Repo:
https://claude.ai/code/artifact/5fcc7a9c-e9ea-48ac-a358-917461195ff2

- [ ] **`CloudSystem`: 13 von 30 Exporten ohne Test.** Der Modulkommentar
      verspricht "Jede Funktion hier gibt ein Ergebnisobjekt zurueck und wirft
      nie". Die Testdatei nagelt `isBackendConfigured` auf `false` — damit
      kehrt jede Netzfunktion sofort am Guard zurueck, und der gesamte
      Fehlerpfad ist **per Konstruktion unerreichbar**. Die Garantie haelt
      (im Audit empirisch geprueft), ruht aber auf keiner Pruefung.
      Braeuchte eine zweite Suite mit `isBackendConfigured: true`.

- [ ] **`ProgressSyncSystem`: Teilfehlschlag mit mehreren Ereignissen
      ungetestet.** Jeder der 14 Tests legt genau **ein** Ereignis an. Die
      `remaining`-Logik existiert aber fuer den Fall, dass von drei Laeufen
      der zweite scheitert. Der Pfad ist heute korrekt (im Audit nachgestellt),
      aber unbewacht.

- [ ] **`ProgressSyncSystem`: `indexOf` haengt an Referenzidentitaet.** Der
      Code ist korrekt, **weil** `readOutbox()` bei jedem Aufruf frisch
      `JSON.parse` ausfuehrt. Wuerde jemand die Outbox aus Effizienzgruenden
      im Speicher halten — eine harmlos aussehende Umstellung — dupliziert die
      Restlogik Ereignisse. Diese Abhaengigkeit steht nirgends.

- [ ] **Regel 6 in CLAUDE.md praezisieren.** Sie nennt zwei erlaubte
      Phaser-Symbole fuer `SpawnSystem` (`RandomDataGenerator`,
      `Geom.Rectangle`), genutzt werden vier (zusaetzlich `Math.Clamp` und
      `Math.Linear`). Inhaltlich harmlos — reine Mathematik ohne Canvas-Bezug —
      aber die Ausnahme ist enger formuliert als die Wirklichkeit. Das
      Vor-Audit meldete hier "vollstaendig konform", weil es die Import-Zeile
      prueft statt der Symbole.

### Zur Entscheidung offen (aus dem Gespraech 2026-08-19/20)

- [x] **Talentkosten auf 0, dafuer ein Talentpunkt alle zwei Level?**
      **Verschoben nach P1.a (2026-08-21)** — die Frage stand hier, in P1 und
      im Audit-Anhang gleichzeitig, die entscheidende Rechnung aber nur hier.
      Beides ist jetzt unter **P1.a** zusammengefuehrt und wird dort
      entschieden. Der Eintrag hier ist nur noch ein Verweis, keine offene
      Aufgabe.

- [ ] **Welten unterhalb des eigenen Levels sperren?** Als Idee eingebracht.
      **Drei Einwaende:** (1) Es bestraft gemeinsames Spielen — ein Kind auf
      Stufe 30 koennte nicht mehr mit einem auf Stufe 8 dieselbe Welt spielen,
      und genau zwei Geschwister sind die Zielgruppe. (2) Es widerspricht dem
      Duell-Modus, der eine gemeinsame Welt und denselben Seed braucht.
      (3) Der Zweck ist bereits geloest: Hoehere Welten geben mehr Punkte und
      XP — wer unten bleibt, verliert ohnehin. Anreize sind besser als Verbote.
      Falls es um die Vergleichbarkeit der Bestenliste geht, ist das ein
      Problem der **Liste**, nicht der Welten (siehe `CloudSystem.ts`,
      "Ehrliche Grenze" bei `fetchLeaderboard`).

### Balance-Aenderungen ohne Spielertest

- [x] **Serien-Umstellung mit Emre und Simay pruefen.** **Hochgezogen nach
      P0.c (2026-08-21)** — gehoert in denselben Spielabend wie das
      Phase-5-Balancing, statt hier unten getrennt zu warten. Volltext dort.

- [ ] **Neue XP-Kurve pruefen.** Sie ist in Runs formuliert
      (`XP_PER_RUN_REFERENCE`, gemessen 2 146 XP je Run): 0,5 Runs auf Stufe 1,
      2,2 ab Stufe 10, 3,0 auf Stufe 99. Der Bezugswert stammt aus vier
      simulierten Runden — ein echter Messwert von den Kindern fehlt.

- [ ] **Level-Absenkung bei Bestandsstaenden bestaetigen.** `SAVE_VERSION 7`
      legt die gesamte XP auf die neue Kurve um; Stufe 51 wurde dabei zu 45
      (auf dem Testgeraet bestaetigt, keine Welt verloren). Bei Emre und Simay
      steht die Pruefung aus.

### Offen aus der Shop-Runde (2026-08-20)

- [x] **Etappe 2 und 3: 100 Fluggestalten — erledigt 2026-08-21, v0.1.209.**
      Aus 30 wurden 100. Die 70 neuen verteilen sich auf Helden und Heldinnen
      (10), Maerchen und Magie (12), Raumfahrzeuge (18), Flugzeuge und
      Fahrzeuge (8), Tiere (7), Drohnen und Geraete (8) sowie Zeichen (7).
      Preise 800 bis 2 900 Muenzen.

      Weibliche Gestalten sind ausdruecklich dabei: Prinzessin, Fee, Zauberin,
      Koenigin, Fluegelfee, Nachtfee, Meerjungfrau, Heldin, Umhangheldin,
      Sternenheldin, Schildheldin, Bogenschuetzin.

      Neue Helfer in `ui/shipShapes.ts` halten die Figuren kurz: `kopf`,
      `rumpf`, `arme`, `beine`, `umhang`, `fluegelpaar`, `stab`. Eine Fee ist
      damit sechs Zeilen statt eines Polygonblocks — bei 40 humanoiden Formen
      zaehlt das.

      **Die Silhouetten-Regel hat sich bewaehrt.** Acht Formen mussten nach
      dem ersten Vergleichsrendern nachgebessert werden: bei Fluegelfee und
      Nachtfee verschluckten die Fluegel den Koerper (beide lasen sich als
      Blatt), Drache und Einhorn waren beide nur "Fluegel mit Klumpen
      dazwischen", der Anker las sich als Flugzeug mit Tragflaechen, die
      Schildheldin als Kreis mit Kopf, das Auge als blosse Raute. Ohne das
      Raster waeren alle acht ausgeliefert worden.

      **Offen:** auf einem echten Geraet im Spiel gesehen sind sie nicht — nur
      als gerendertes Raster. Ob eine Silhouette in Bewegung mit Tint und Aura
      noch traegt, sagt das Bild nicht.

- [ ] **Schleifen-Farben kaufbar machen.** Die Serien-Schleife traegt heute die
      Stufenfarbe aus `SERIES_TRAIL_TIERS`. Kaufbare Varianten brauchen ein
      drittes Besitzfeld nach demselben Muster wie Formen und Farben.

- [ ] **Profil-Icons kaufbar machen** (siehe auch P1-Liste oben).

- [ ] **Getragene Figur ueber Geraete hinweg angleichen.** Sie liegt derzeit
      bewusst nur lokal: Der Server pflegt in `profile_progress` eine eigene
      `data`-Kopie und kennt die Auswahl nie (`initialize_profile_progress`
      greift nur beim ersten Mal, `pushSave()` schreibt in `saves`). Braeuchte
      eine neue RPC, die Auswahl und Besitz vom Client entgegennimmt.

- [ ] **Boosts** — von der Projektleitung vorerst zurueckgestellt. Falls sie
      kommen: nur Fortschritts-Boosts (XP, Coins), keine Leistungs-Boosts.
      Ein gekaufter Tempo-Vorteil braeche die Vergleichbarkeit der Rangliste.

- [x] **Playtest ohne `--sim` fahren.** **Hochgezogen nach P0.a.4
      (2026-08-21)** — gebuendelt mit den drei anderen offenen
      Geraetebestaetigungen.

### Querschnitt

- [x] Sichtbare deutsche Spieltexte verwenden echte Umlaute (`ä`, `ö`, `ü`);
      technische IDs und Event-Namen bleiben unverändert.

- [ ] **Ablauflogik aus `MenuScene`/`SyncScene` nach `systems/` ziehen**
      (aus dem Audit 2026-08-19). `scenes/`, `ui/`, `entities/`, `core/` und
      `input/` haben zusammen 11.005 Zeilen ohne Unit-Test. Das ist **kein
      Versäumnis**: Diese Dateien erben von Phaser-Klassen und laden
      ausserhalb eines Browsers nicht (`getContext() is not implemented` —
      derselbe Grund, aus dem `ScoreSystem` sein `Math.Clamp` verlor, siehe
      `docs/CODE_STYLE.md`). Die Architektur schiebt prüfbare Logik deshalb
      bewusst nach `systems/` (dort 3.300 Zeilen Test auf 4.199 Zeilen Code).

      **Die verbleibende Lücke ist enger, aber real:** In `MenuScene` stehen
      49 Verzweigungen, viele davon reine Ablauflogik über Netz-, Login- und
      Spielstandszustände (`synchronizeData()`, `checkCloudSave()`). Genau
      dort sass der Boost-Bug vom 2026-08-18 — ein falscher
      `isActive()`-Guard, der `checkCloudSave()` bei jedem Aufruf aus
      `create()` abbrach. Drei Diagnoserunden, weil kein Test ihn fangen
      konnte.

      Richtiger Schnitt ist **nicht**, `MenuScene` testbar zu machen, sondern
      die Entscheidungsketten herauszulösen (z. B. ein `SyncDecisionSystem`,
      das aus Zuständen eine Handlung ableitet, ohne selbst zu handeln).
      Dann läuft die Logik ohne Phaser und wird wie `ScoreSystem` geprüft.

      Zusätzlich offen: Der Playtest erreicht **8 von 20 Scenes** (Menu,
      Game, Result, Profile, Settings, Leaderboard, Achievements, Admin).
      Nicht abgedeckt sind u. a. `Talent`, `Sync`, `Account`, `Challenge`,
      `OnlineDuel`, `WorldInfo`, `AdminPin`, `AdminStats`, `AdminUsers`.

---

## Erledigt — der Knopf-Fehler lag an der Auslieferung

> **Aufgeloest am 2026-08-13.** Auf dem Testgeraet lief durchgehend **v0.1.0**,
> waehrend lokal laengst korrigiert war. Alle vier Fehlersuchrunden liefen
> gegen einen Stand, den das Handy nie geladen hatte — jede Rueckmeldung
> beschrieb korrekt den **alten** Code und schickte die Suche in eine neue
> falsche Richtung.

**Was daraus folgt** (eingebaut, siehe `CODE_STYLE.md` 1.9):

- [x] `pre-push`-Hook blockiert Pushes ohne Versionssprung
- [x] `index.html` als `no-cache` — sie ist die einzige Datei ohne Inhalts-Hash
      und damit die einzige, die einen Deploy blockieren kann
- [x] Versionsnummer im DOM statt nur im Canvas (auch sichtbar, wenn Phaser
      nicht startet)
- [x] `npm run verify` fuehrt dieselbe Kette wie die CI, inklusive
      `format:check` — dessen Fehlen hatte die CI rot gemacht, ohne dass es
      lokal auffiel

**Die Korrekturen an den Trefferflaechen bleiben gueltig** — jede behob eine
nachgewiesene Ursache, auch wenn keine das gemeldete Symptom ausgeloest hat:

- [x] Trefferflaeche wanderte mit dem Druck-Effekt (Container wurde skaliert)
- [x] Trefferflaeche war um `displayOriginX` verschoben
- [x] `updateBounds()` ohne `displayScale`-Nachzug
- [x] Vergroesserte Flaechen erzeugten Ueberlappung → falscher Knopf gewann
- [x] Ausrichtung wird gemessen statt gerechnet (`makeAlignedHitArea`)

**Bestaetigt am 2026-08-13:** Auf dem Handy laeuft v0.1.3, die Version ist
sichtbar, **die Knoepfe reagieren gut**. Der Fehler ist damit erledigt — er lag
ausschliesslich an der Auslieferung, nicht am Code.

- [x] Auf dem Geraet gegengeprueft (Browser)
- [ ] Offen bleibt nur der Sonderfall Home-Bildschirm-App → Phase 1.2

---

## Phase 1 — Bedienbarkeit _(abgeschlossen 2026-08-13)_

- [x] Einheitlicher Zurueck-Knopf oben links (`createBackButton`)
- [x] Zurueck-Knopf der Bestenliste aus dem Bereich des Namensfeldes geholt
- [x] Pause und "Run verlassen" im laufenden Spiel
- [x] iOS-Vollbildhinweis in einem eigenen Kasten
- [x] Weltenauswahl der Bestenliste von 12 auf 50 CSS-px vergroessert
- [x] Versionsnummer im Menue (damit Test-Rueckmeldungen zuordenbar sind)
- [x] **Auf dem Geraet gegengeprueft** — v0.1.3 sichtbar, Knoepfe reagieren

### Phase 1.1 — Sofort, kleine Fehler _(erledigt 2026-08-13)_

- [x] **BUG: Version stand zweimal unten rechts.** Sie war doppelt eingebaut —
      im DOM (`main.ts`) und zusaetzlich im Canvas (`MenuScene`). Die
      Canvas-Variante ist entfernt; das DOM gewinnt, weil es die Nummer auch
      zeigt, wenn Phaser gar nicht startet.

- [x] **BUG: Code-Feld sass auf dem Knopf "CODE EINLOESEN".** Nachgemessen:
      24 Spielpixel Abstand = rund 13 CSS-px auf dem iPhone. Jetzt 74 px,
      etwa eine Fingerbreite.
      **Regel daraus:** Jedes DOM-Element ueber dem Canvas braucht mindestens
      60 Spielpixel Abstand zu allem Bedienbaren.

- [x] **Wartungsbildschirm** (`AdminScene`): Version, Startweg (Browser oder
      Home-Bildschirm), "Neu laden erzwingen", Spielstand zuruecksetzen mit
      Doppelbestaetigung. Erreichbar ueber langen Druck auf die Versionsnummer.

- [x] **Layout-Werte im Wartungsbildschirm**: Fenstergroesse, sichere Raender,
      Balken oben und unten, Massstab. Ein Browser-Simulator kennt keine
      sicheren Raender — diese Zahlen gibt es nur auf dem Geraet.

- [x] **Pixel-Lineal** (`RulerScene`, über den Wartungsbildschirm): festes
      DOM-Raster über den kompletten Viewport. Bildschirmrand oben ist CSS-y 0,
      die Skala reicht bis zur exakten Unterkante; Safe Area und Spielfeld sind
      zusätzlich markiert.

- [x] **Streifen ausserhalb des Spielfelds tragen die Weltfarbe** statt Schwarz.
      Das Spielfeld ist 9:16, moderne Handys sind schmaler — der harte Balken
      war der sichtbare Bruch dazwischen.

### Phase 1.3 — Bestenliste _(abgeschlossen 2026-08-13)_

> Von Phase 2 hierher gezogen. Beides zusammen, weil das eine ohne das andere
> wenig bringt: Eine gemeinsame Liste, die sich nur auf Knopfdruck fuellt,
> bleibt leer.

- [x] **Gemeinsame Liste ueber alle Welten** als Standardansicht.
      **Geprueft:** Heute ist sie pro Welt getrennt — `scores.world_id` ist
      Pflichtfeld, `fetchLeaderboard(worldId)` filtert mit
      `.eq('world_id', ...)`, und `LeaderboardScene` hat Weltentabs. Fuenf
      Welten = fuenf getrennte Listen.
  - [x] `fetchLeaderboard()` ohne `worldId` aufrufbar machen
  - [x] `world_id` bleibt in der Datenbank (die Herkunft ginge sonst verloren)
        und erscheint in der Zeile als Farbmarke, nicht als Text
  - [x] Weltentabs bleiben als Filter erhalten, sind aber nicht mehr die
        einzige Ansicht
  - [x] Neuer Index: `scores (score desc, created_at asc)` — der vorhandene
        `scores_world_rank_idx` greift ohne `world_id`-Filter nicht

- [x] **Automatisch eintragen nach jedem Run** _(entschieden: jeder Run,
      Variante B)_
  - [x] Der Knopf "IN DIE BESTENLISTE" im Ergebnisbildschirm entfaellt
  - [x] **Die bisherige Begruendung wird damit widerlegt** und ersetzt, nicht
        umgangen: In `ResultScene.ts` steht heute "Automatisch waere bequemer,
        wuerde die Liste aber mit jedem Uebungslauf fluten. Ein Eintrag soll
        eine Entscheidung sein."
  - [x] **Voraussetzung:** Ohne Namen geht kein Eintrag. Der Name muss also
        beim ersten Start abgefragt werden → haengt an Phase 2 (Profil).
        Bis dahin: eintragen nur, wenn ein Name gesetzt ist
  - [x] Fehlschlaege bleiben still — ein misslungener Eintrag darf den
        Ergebnisbildschirm nicht stoeren (`CloudResult` wirft ohnehin nie)
  - [x] Duell-Runden weiterhin **nicht** eintragen (Fairness-Regel 3)

- [x] **Top 10 statt Top 5.** **Geprueft: `LEADERBOARD_LIMIT` steht bereits auf
      10** (`config/backend.ts:31`), und `fetchLeaderboard` benutzt den Wert.
      Nachgerechnet passen auch alle zehn Zeilen auf den Schirm (Platz 10 bei
      y=952, das Namensfeld beginnt erst bei 1042).
      Die Anzahl sichtbarer Zeilen haengt weiterhin von der Datenbank ab; der
      Code laedt jetzt bis zu zehn Eintraege.

> **Vorbehalt zur Gesamtliste:** Sie ist fair, **solange die Welten mechanisch
> gleich sind** (`GAME_DESIGN.md` 7.3). Mit den Weltmodifikatoren aus Phase 5 —
> Sonnenhort mit doppelter Legendaer-Chance — endet das. Dann braucht es eine
> Normalisierung oder wieder getrennte Listen.

### Phase 1.2 — Warum die Home-Bildschirm-App nicht aktualisiert _(neu)_

> **Geprueft: Es gibt keinen Service Worker im Projekt** (kein `serviceWorker`,
> kein `sw.js`, kein Workbox). Die uebliche Erklaerung "veralteter Service
> Worker" scheidet damit aus.
>
> **Ungeprueft** bleibt, was iOS stattdessen tut. Als Home-Bildschirm-App
> benutzt Safari einen eigenen, langlebigen Cache. Dass das `no-cache`-Meta
> dort nicht so greift wie im Browser, ist durch die Beobachtung belegt — die
> genaue Regel dahinter nicht.

- [x] **`version.json` beim Build erzeugen** (`vite.config.ts`, Plugin
      `isihunt-version-manifest`) — sie sagt, welcher Stand verfuegbar ist
- [x] **Update-Erkennung** (`core/updateCheck.ts`): laedt `version.json` mit
      Cache-Buster und vergleicht mit `APP_VERSION`. Jeder Fehler wird
      verschluckt — ohne Netz verhaelt sich das Spiel wie vorher
- [x] **Hinweis im Menue**, wenn eine neuere Fassung bereitliegt. Nur als
      Angebot, nie selbsttaetig
- [x] **`forceReload()`** haengt einen neuen Suchteil an die Adresse. Ein
      blosses `location.reload()` genuegt auf iOS nicht

**Noch offen — erst nach dem Test auf dem Geraet entscheiden:**

- [x] **Messen:** Version in der Home-Bildschirm-App ablesen. Erscheint der
      Update-Hinweis dort? Funktioniert "Neu laden erzwingen"?
- [ ] **Nur falls das nicht reicht:** Service Worker mit
      `updateViaCache: 'none'`. Dann ist das Update-Verhalten steuerbar statt
      Safaris Gutduenken ueberlassen. Braucht einen ADR — neue Abhaengigkeit,
      neuer Lebenszyklus. **Bewusst noch nicht gebaut**, solange die einfachere
      Loesung ungeprueft ist.
- [ ] `manifest.webmanifest`: `start_url` mit Versionsparameter — erzwingt
      einen neuen Cache-Schluessel. _Wirkung ungeprueft_

## Phase 2 — Identitaet, Spielzeit, Fortschritt _(in Arbeit)_

- [x] Profil: Name beim ersten Start abfragen, Icon dazu, im Profil
      aenderbar
- [x] Name im Startmenue anzeigen
- [x] Weltenauswahl als vertikalen Carousel mit einer scharfen Welt sowie
      geblurten Nachbarn und Hoch-/Runter-Wischbewegung bauen
- [x] Namensfeld aus der Bestenliste entfernen (zieht ins Profil)
- [x] Levelanzeige im Profil und Hauptmenue prominent sichtbar
- [x] `RUN_DURATION_MS` 60 s → 90 s
- [x] Designziel 2 in `GAME_DESIGN.md` anpassen ("in 90 Sekunden gespielt")
- [x] XP-Kurve: `floor(80 · n^1.45)` → `floor(750 · √n)`
- [x] `MAX_LEVEL = 100`, Deckelung in `ProgressionSystem.applyRun()`
- [x] **Bestenliste leeren**: einmaliger, bewusst manueller Datenbankwechsel
      ueber `supabase/cleanup_leaderboard.sql`. Entschieden am 2026-08-13.
- [x] Bestenliste auf einen Eintrag je `cloudId` umstellen: nur der beste Run
      bleibt; Name und Welt werden beim neuen Bestwert aktualisiert
- [x] Einmalige Bereinigung ueber `supabase/cleanup_leaderboard.sql` ausfuehren
      (loescht die bisherigen Eintraege, danach ist `player_id` Pflicht)

> Die gemeinsame Bestenliste und der automatische Eintrag standen hier — beides
> ist am 2026-08-13 nach **Phase 1.3** vorgezogen worden.

- [x] XP-Tabelle in `GAME_DESIGN.md` 7.1 ersetzen

> Die Bestenliste wird erst nach ausdruecklicher Bestaetigung geleert. Das ist
> eine einmalige, nicht rueckgaengige Datenbankaktion und kein lokaler
> Code-Schritt.

**Zielwerte, nachgerechnet:** Level 10 nach 17 Runs ≈ 31 min · Level 100 nach
552 Runs ≈ 17 h · Grundlage 900 XP je 90-s-Run, 110 s je Durchgang.

**Entschieden am 2026-08-13:** Ueberschuessige Talentpunkte werden zu **Coins**.
99 Punkte stehen 32 Talentraengen gegenueber — ab etwa Level 33 ist alles
ausgebaut, die restlichen 67 haetten sonst kein Ziel.

- [x] `ProgressionSystem`: Sind alle Talente auf Maximalrang, wird der Punkt
      nicht vergeben, sondern in Coins gutgeschrieben
- [x] Umrechnungskurs steht in `GameConfig.ts` (10 Coins je Punkt)
- [x] Der Ergebnisbildschirm erklaert die Umwandlung ("Alle Talente ausgebaut -
      +N Coins"), sonst wirkt ein ausbleibender Talentpunkt wie ein Fehler
- [x] Coins-Feld und Migration sind als kleiner Unterbau von Phase 4 vorhanden;
      weitere Coin-Quellen und die Talentbaum-Oberflaeche bleiben Phase 4.

> **Erledigt am 2026-08-14:** Coins-Feld, Migration, Umrechnung (10 Coins je
> ueberschuessigem Talentpunkt) und die Rueckmeldung im Ergebnis sind gebaut.

## Phase 2.5 — Bildschirm ganz nutzen _(neu 2026-08-13)_

> **Ausgangslage:** Das Referenzlayout ist 720 × 1280, also 9:16. Moderne iPhones
> sind deutlich schmaler:
>
> | Geraet            | Viewport  | Canvas nach FIT | Balken gesamt |
> | ----------------- | --------- | --------------- | ------------- |
> | iPhone SE         | 375 × 667 | 375 × 667       | **0 px**      |
> | iPhone 12/13      | 390 × 844 | 390 × 693       | 151 px        |
> | iPhone 14 Pro     | 393 × 852 | 393 × 699       | 153 px        |
> | iPhone 15 Pro Max | 430 × 932 | 430 × 764       | 168 px        |
>
> Die frueheren Balken waren die Folge von `Phaser.Scale.FIT` bei fest
> gewaehltem 9:16. Die interne Hoehe waechst jetzt auf hohen, schmalen
> Geraeten mit der verfuegbaren sicheren Portrait-Flaeche.

- [x] **Spielfeld an das Geraet anpassen statt einzupassen.** Die Breite bleibt
      720 px, die interne Hoehe uebernimmt beim Start die verfuegbare
      Portrait-Flaeche (mindestens 1280 px). Die zusaetzliche Hoehe ist echte
      Spielflaeche; die Rundendauer bleibt unveraendert.
- [x] **Entscheidung:** Mehr Hoehe bedeutet laengere Laufwege. Das ist bewusst
      akzeptiert; Spawn-Grenzen und untere Layout-Elemente verwenden bereits
      `GAME_HEIGHT` und wachsen mit.
- [x] **Zwischenloesung umgesetzt (2026-08-13):** Die Streifen tragen die
      Randfarben der Welt statt Schwarz.
- [x] **Safe-Area-Hintergrund:** Sterne und ein subtiler Nebelschein liegen
      jetzt auch in den DOM-Streifen ausserhalb des Canvas.
- [x] **Werkzeug:** Das Pixel-Lineal (`RulerScene`) macht die
      Bewertung messbar — "von 0 bis 160" statt "oben ist was".
- [x] `docs/GAME_DESIGN.md` 9 anpassen (variable Hoehe dokumentiert)
- [x] Hochformat erzwingen: Manifest, best-effort Screen-Orientation-Lock und
      Landscape-Fallback fuer Browser ohne Orientierungs-API
- [x] Tablet-Kompatibilitaet geprueft: iPad nutzt weiterhin ein zentriertes,
      unveraendertes Hochformat-Layout. Eine breitere Nutzung wird bewusst mit
      dem spaeteren nativen Layout geplant, damit iPhone-Bedienung und
      Koordinaten nicht auseinanderlaufen.

## Phase 2.6 — Login & Mehrgeräte-Profil _(priorisiert, App integriert)_

> **Ziel:** Ein Profil kann dauerhaft auf mehreren eigenen Geräten genutzt
> werden, zum Beispiel auf iPhone und iPad. Beide Geräte melden sich mit
> demselben Profil an; Offline-Runs werden später sicher zusammengeführt.
>
> **Warum:** Der heutige Sync-Code ist ein einmaliger Spielstand-Umzug. Zwei
> Geräte können danach zwar dieselbe `cloudId` kennen, aber ein vollständiger
> Upload kann den Stand des anderen Geräts ersetzen. Das ist für ein dauerhaft
> gemeinsames Profil nicht ausreichend.

### Technischer Plan

- [x] **Supabase Auth einführen:** Login und Sitzung werden vom Backend
      verwaltet. Alias/Passwort ist der erste plattformübergreifende Weg;
      Apple-Login kann später für die native App ergänzt werden. Eine echte
      E-Mail wird weder abgefragt noch in Rangliste oder Profilanzeige verwendet.
- [x] **Profil-Tabelle und RLS-Skript anlegen:** `profiles.id` referenziert
      `auth.users.id`; Name, Erstellungs- und Änderungszeitpunkt liegen im
      Backend. `SaveData.cloudId` wird auf diese Profil-ID migriert.
- [ ] **SQL in Supabase ausführen und prüfen:** RLS erlaubt Lesen und Schreiben des
      eigenen Profils nur über `auth.uid()`. Ranglisten-Schreiben bleibt eine
      kontrollierte RPC; fremde Spielstände und Login-Daten bleiben verborgen.
- [x] **Login-UX in der App:** Auf dem ersten Gerät Profil anlegen oder
      einloggen; auf einem weiteren Gerät einloggen und Profil laden. Der
      Offline-Spielstart bleibt möglich, wenn das Netz vorübergehend fehlt.
- [x] **Offline-Outbox je Gerät:** abgeschlossene Solo-Runs werden lokal mit
      eindeutiger `event_id` vorgemerkt und bei Start, Rückkehr des Netzes und
      nach einem Run übertragen. Wiederholtes Senden darf nichts doppelt zählen.
- [x] **Zusammenführung statt Komplettüberschreiben:** XP und Coins aus
      bestätigten Solo-Runs werden addiert, Erfolge vereinigt, Bestwert und
      Best-Combo maximiert. Talentkäufe werden serverseitig atomar geprüft.
- [x] **Profiländerungen synchronisieren:** Namensänderungen werden auf allen
      Geräten sichtbar und aktualisieren auch den Ranglisteneintrag.
- [x] **Migration ohne Verlust vorbereiten:** Bestehende `cloudId`-Profile können nach dem
      ersten Login übernommen werden. Der alte Sync-Code bleibt zunächst als
      einmaliger Migrations- und Notfallweg erhalten.
- [ ] **Tests mit iPhone und iPad:** beide Geräte offline bespielen, danach
      verbinden; Level, Coins, Bestwert, Erfolge, Name und Wiederholungen prüfen.

### Lieferreihenfolge

1. Supabase Auth, `profiles` und RLS.
2. Login, Sitzung und Migration des bestehenden lokalen Profils.
3. Ereignisse, Offline-Outbox und idempotente Zusammenführung.
4. Der manuelle Gerätewechsel bleibt nur intern als Migrationsweg; die
   sichtbare Gerätewechsel-UI ist entfernt.
5. Echter iPhone-/iPad-Test; erst danach weitere Phase-4-Fortschrittsquellen
   als synchronisierte Ereignisse anschließen.

**SQL-Migration:** `supabase/phase_2_6_auth.sql` nach `schema.sql` im
Supabase SQL Editor ausführen. Danach in Supabase unter Authentication ->
Providers -> Email die Bestätigungspflicht deaktivieren, weil der Alias-Login
keine zustellbare E-Mail-Adresse verwendet. Ohne diese Schritte bleibt der
Login-Code bewusst funktionslos und das lokale Spiel läuft trotzdem weiter.

> **Native Anschluss:** Das Auth-Modell funktioniert zunächst als Web-App und
> später in Capacitor/TestFlight. Der native Build bleibt für Phase 8 geplant
> (siehe ADR-0015 in `docs/DECISIONS.md`); die Mehrgeräte-Datenstruktur muss
> dafür nicht neu erfunden werden.

## Phase 3 — Themenwechsel ins Weltall

- [x] ADR-0013: Themen- und Zielgruppenwechsel (mit verworfener Alternative)
- [x] `tex-player-core`: Raumschiff statt vierzackiger Stern
- [x] Relikte als Planeten (Rotation als Illusion — Phaser ist 2D)
- [x] Hintergrund: weltabhaengige Sternfarben, Nebelkompositionen und
      Planetenlayouts
- [x] Echte Planetentexturen je Welt und neues isiHunt-Logo als PNG-Assets
- [x] Skins fuer die Figur, freigeschaltet ab Level 5/15/30/50/75/100

> **Phase-3-Start 2026-08-14:** ADR-0013 ist angenommen. Raumschiff,
> Planeten-Relikte, Raumzonen-Namen, weltabhaengige Raumkulissen und
> Level-Skins sind umgesetzt.

- [x] `worlds.ts`: Fantasy-Namen → Weltraum-Regionen
- [x] `GAME_DESIGN.md`: Pitch, Zielgruppe, Referenz
- [x] `ART_STYLE.md`: Formensprache, Assets, Welten-Farbtabelle

> **Unantastbar:** Die sechs Seltenheitsfarben. Planetensprites duerfen ihre
> Weltdetails behalten; die Seltenheit wird weiterhin durch Glow, Strahlenkranz
> und Fang-Effekte eindeutig angezeigt.

- [ ] **Neues App-Icon** _(Wunsch des Nutzers, 2026-08-18)_: **"Ich brauche
      ein neues App-Icon, ein modernes und thematisch passendes."** Der
      Themenwechsel Fantasy → Weltraum (ADR-0013) ist fuer die Spieltexturen
      laengst umgesetzt (Zeile oben: "Raumschiff statt vierzackiger Stern"),
      aber die App-Icons selbst sind davon unberuehrt geblieben: Sie zeigen
      weiterhin einen generischen vierzackigen Stern (siehe
      `scripts/generate-icons.mjs`, Kommentar "derselbe vierzackige Stern in
      Gold auf dem Grundton" — ein Relikt aus der Zeit vor dem Weltraum-
      Thema), waehrend Menue und Spiel laengst das Raumschiff-Logo
      (`public/assets/isihunt-logo-v2.png`) zeigen.
      **Betroffene Dateien:** `public/favicon.png`, `public/apple-touch-icon.png`,
      `public/icon-192.png`, `public/icon-512.png` — Groessen und Zweck stehen
      im `manifest.webmanifest` und in `docs/ART_STYLE.md` Abschnitt 6.
      **Technischer Weg bereits vorbereitet:** Das Icon wird prozedural per
      `npm run icons` (`scripts/generate-icons.mjs`) erzeugt, kein Bildeditor
      noetig — wer das Motiv aendert, aendert den Zeichencode im Skript.
      Wichtige Einschraenkung aus demselben Skript: Android beschneidet
      "maskable" Icons zu einem Kreis/Squircle und garantiert nur die
      inneren 80 % der Flaeche (`STAR_RADIUS_RATIO = 0.3` haelt das Motiv
      deshalb bewusst klein) — ein neues Motiv muss dieselbe Kreisprobe
      bestehen. Alternative: falls das neue Motiv zu fein fuer den
      prozeduralen PNG-Encoder ist (z. B. Details wie beim Raumschiff-Logo),
      waere ein Export aus dem bestehenden Logo-Artwork der pragmatischere
      Weg statt neuer Zeichencode.

## Phase 3.5 — Ton _(neu 2026-08-13, aus M4 vorgezogen)_

> Vorgezogen, weil Ton bei einem Arcade-Spiel keine Politur ist, sondern
> Rueckmeldung: Ein Knopf, der klickt, fuehlt sich getroffen an — das haette
> bei der Trefferflaechen-Suche sogar diagnostisch geholfen.

- [x] `SoundSystem` neben den anderen Systemen (`ARCHITECTURE.md` 10 sieht es
      dort bereits vor)
- [x] **Knopf-Klick** — kurz und trocken, bei jedem `pointerup` in `widgets.ts`
- [x] **Fang-Sounds je Seltenheit**, Tonhoehe steigend mit dem Wert;
      gruen/blau/lila/orange bekommen mehrstimmige, epischere Fanfaren;
      legendaer bekommt einen eigenen Klang
- [x] Weltwechsel im Hoch-/Runter-Wheel bekommt einen kurzen Auswahlton
- [x] **Combo-Stufe erreicht**, **Levelaufstieg**, **Run-Ende**
- [x] Stummschalter, Zustand im Spielstand (`reconcile()` braucht dafuer keine
      Migration)
- [x] **Toene prozedural erzeugen** (WebAudio-Oszillatoren) statt Dateien zu
      laden — passt zu ADR-0004: keine Assets, keine Ladezeit, alles im Code
- [x] **Fallstrick iOS:** Audio startet erst nach einer Nutzergeste. Der
      AudioContext muss beim ersten Tipp entsperrt werden, sonst bleibt es
      stumm — und zwar lautlos, ohne Fehlermeldung
- [x] `ART_STYLE.md` um einen Abschnitt Ton ergaenzen

> **Erledigt am 2026-08-14:** Phase 3.5 ist mit prozeduralen WebAudio-Toenen,
> gespeicherter Ton-Einstellung und iOS-Freischaltung beim ersten Tipp gebaut.

## Phase 3.6 — Dynamic Island _(neu 2026-08-13)_

> **Ehrlich vorab:** Die Dynamic Island laesst sich aus einer Web-App heraus
> **nicht** ansteuern. Sie gehoert dem System; Inhalte dort kommen aus Live
> Activities (ActivityKit) und setzen eine native App voraus. Im Browser gibt
> es keine Schnittstelle dafuer.
>
> Erreichbar waere sie erst mit Capacitor (M8, siehe ADR-0015), und auch dann
> nur ueber ein natives Plugin.

- [x] **Entscheidung:** Native Umsetzung kommt nach Phase 4. Die Vorbereitung
      wird jetzt dokumentiert, aber der Web-Stand bleibt bis dahin aktiv.
- [ ] **Was ohne native App geht** — und optisch in dieselbe Richtung zielt:
  - [x] Der Bereich _um_ die Island gehoert der Seite: Safe-Area-Laufband im
        Menue und Restzeit-Anzeige waehrend des Runs.
  - [ ] `theme-color` je Zustand umschalten — faerbt auf iOS die Statusleiste
        und damit die Umgebung der Island. Im Menue ruhig, im Run in der
        Weltfarbe, bei einem legendaeren Fang kurz aufleuchtend.
        _Aufwand: gering, Wirkung sichtbar_
  - [x] Der `safe-area-inset-top`-Bereich wird im Web-Stand fuer Laufband und
        Restzeit genutzt; die Systemuhr bleibt unangetastet.
- [ ] **Laufband im Vollbild/Home-Bildschirm-Modus stabilisieren.**
      Ursache: `black-translucent` legte den Webinhalt absichtlich hinter die
      iOS-Statusleiste; das bei `top: 0` fixierte Laufband lag dadurch direkt
      in der Dynamic Island. Zusaetzlich existierte die DOM-ID doppelt.
      Vor der Ursachenbehebung ausprobiert:
  - [x] HTML-Laufband in den `#game`-Container verschoben, damit es im
        Vollbild gemeinsam mit dem Canvas enthalten ist.
  - [x] `z-index`, `position: fixed`, Safe-Area-Hoehe und einen 28-px-Fallback
        fuer `env(safe-area-inset-top)` angepasst.
  - [x] Phaser `fullscreenTarget` auf `#game` gesetzt, damit nicht nur der
        Canvas in den Vollbildmodus geht.
  - [x] Cache-/Auslieferungsproblem ausgeschlossen: v0.1.52 ist live, das
        Problem besteht laut aktuellem Geraetetest weiterhin.
  - [x] Nach Abgleich mit Apples und WebKits dokumentiertem Standalone-Verhalten
        auf eine reservierte schwarze iOS-Statusleiste umgestellt. Das
        Laufband ist jetzt ein eigener 32-px-App-Kopfbereich darunter; die
        fehleranfaellige Laufzeitmessung und der doppelte DOM-Knoten entfallen.
        Geraetetest v0.1.58: auf dem iPhone 16 Pro weiterhin nicht sichtbar.
  - [x] Naechster Ansatz: nicht mehr auf eine von iOS beim Installieren
        gespeicherte Statusleistenart verlassen. Der dunkle Kopf reicht wieder
        bis zum Displayrand, waehrend Text und Canvas mit
        `safe-area-inset-top` plus modellabhaengigem Fallback unterhalb der
        Island beginnen. Echter Geraetetest mit v0.1.59 steht aus.
  - [x] Geraetetest bis v0.1.65: Geometrie oben 94 CSS-px und unten 0 CSS-px,
        aber `black-translucent` legt den iOS-Systemblur weiterhin ueber die
        Laufzeile. Deshalb ab v0.1.66 undurchsichtige schwarze Statusleiste;
        Web-Viewport und Laufzeile beginnen direkt darunter. Geraetetest offen.
  - [x] Geraetetest v0.1.66: iOS reserviert den Statusbereich entgegen dem
        erwarteten Verhalten nicht; Laufzeile verschwindet und Logo wird
        abgeschnitten. Ab v0.1.67 wieder sichere 126-CSS-px-Geometrie, aber der
        32-px-Blur-Schutz ist transparent und zeigt den Welt-Hintergrund. Nur
        die eigentliche Laufzeile bleibt dunkel. Geraetetest offen.
- [ ] Erst mit M8 (Capacitor, siehe ADR-0015): Live Activity mit Punktestand
      und Restzeit waehrend eines Runs; bis dahin wird die Anzeige als
      Prototyp beobachtet.

> **Entscheidung fuer die native Live Activity:** Zunaechst soll sie waehrend
> des gesamten Runs sichtbar bleiben und laufend sinnvolle Informationen zeigen.
> Welche Inhalte dauerhaft bleiben, wird nach dem ersten Test entschieden.

## Phase 4 — Belohnung — abgeschlossen

- [x] Punkte-Popup auffaelliger (`floatingScore` mit animiertem Bonus-Hinweis)
- [x] Zeitbasierter Kettenbonus mit sichtbarem Multiplikator
- [ ] **Exakte Kinderregel nach Phase 4.1 entscheiden:** drei blaue Planeten
      hintereinander → doppelte Punkte. Sie ist nicht mit dem bestehenden
      allgemeinen Kettenbonus gleichzusetzen.
- [x] Coin-System: Feld im Spielstand, Anzeige, Quellen (Run, Erfolge und
      Levelaufstiege)
- [x] Talentbaum-Oberflaeche mit Rangkauf ueber Profil
- [x] Talente zuruecksetzen gegen 250 Coins, ohne Erstattung
- [x] Coin-Balance auf etwa einen Talent-Rang je fünf abgeschlossene Runden
- [x] **Vitest** — 62 Tests in npm run verify

> **Erledigt am 2026-08-14:** Phase 4 ist lokal und offline vollstaendig
> umgesetzt. Fuer angemeldete Profile muessen die beiden neuen RPC-Funktionen
> aus supabase/phase_2_6_auth.sql noch einmal im Supabase SQL Editor
> ausgefuehrt werden.

### Balancing noch nachtesten

> Erste technische Runde umgesetzt: Die Phase-5-Strafen wurden reduziert und
> die Solo-Grundbelohnung auf 25 Coins angepasst. Die offenen Punkte brauchen
> noch echte Runs mit Emre und Simay, bevor sie als abgeschlossen gelten.

- [ ] **Phase-5-Schwierigkeit:** Weltmodifikatoren und Hindernisse mit den
      Kindern testen; Spawnrate, Lebensdauer, Blinkdauer, Bremswirkung und
      Zeitstrafe so einstellen, dass die Welten fordernd, aber nicht frustrierend
      werden.
- [ ] **Coin-/Talent-Balance:** Coin-Einnahmen pro Runde, Relikt und Levelaufstieg
      gegen Talentkosten und Resetkosten prüfen; Ziel bleibt ungefähr ein
      sinnvoller Talent-Rang nach etwa fünf normalen Runden.
- [x] **Talentpunkte-Migration:** geprüft, dass alte Talentpunkte genau einmal
      korrekt in Coins überführt werden und keine doppelten Gutschriften entstehen.

## Phase 5 — Herausforderung

- [x] Tages-Herausforderung mit festem Seed (UTC-Tag + Welt bilden den Seed)
- [x] Duell gegen Bot mit drei deterministischen Schwierigkeitsstufen
- [x] Weltmodifikatoren umgesetzt: Trägheit, kürzere Lebensdauer, Blinken und
      erhöhte seltene Planeten
- [x] Hindernisse: keine in Sternenweide, bremsend in Eisring/Glutnebel,
      zeitbestrafend in Nullsektor/Sonnenkrone
- [x] `GAME_DESIGN.md` §10 präzisieren: keine Lebenspunkte und kein Game Over;
      Einstiegswelten bestrafen nur mit lesbaren Bremsen, spätere Welten mit
      kurzem Zeitverlust.
- [x] **Welt-Detailscreen vor jedem Run** _(neu 2026-08-17)_: Die Mechanik
      einer Welt (`plannedModifier`) stand bisher nur in `config/worlds.ts`,
      im Weltenkarussell erschien nur der reine Stimmungstext (`flavor`) ohne
      Mechanik-Angabe — fuer ein Balancing-Gespraech mit Kindern reicht das
      nicht, sie muessten die Wirkung raten statt sie nachzulesen.
      Neue `WorldInfoScene` zeigt jetzt Besonderheit, Hindernismodus
      (`obstacleMode` in Klartext übersetzt) und Punkt-/XP-Bonus in Prozent.
      JAGD, DUELL und TAGESLAUF fuehren jetzt alle erst ueber diesen Screen,
      bevor der eigentliche Modus startet; ein `(i)`-Symbol auf der
      ausgewaehlten Karussell-Karte oeffnet ihn auch ohne Rundenstart.
      `npm run verify` gruen (Typecheck, Lint, Format, 184 Tests, Build).
      **Im Dev-Server getestet und bestaetigt (2026-08-17).**
- [ ] ~~Ranked-Modus~~ — blockiert, siehe Phase 6

## Phase 6 — Sozial

> **Vermerk 2026-08-17:** Diese Phase vergroessert absichtlich die Reichweite
> der Bestenliste (Freunde, Realtime, Ranked). Solange die DSGVO-Einschaetzung
> fuer Kinderdaten (siehe P0 oben) nicht geklaert ist, darf keiner dieser
> Punkte den Personenkreis ueber "bekannt" hinaus erweitern — das gilt
> insbesondere fuer Realtime-Sync und eine oeffentlich beworbene Rangliste.

- [x] Zeitstempel in der Bestenliste anzeigen
- [ ] **Punkte serverseitig bewerten** (Supabase Edge Function, Run nachspielen)
      — Vorbedingung fuer Ranked und Rekord-Meldungen
- [ ] Realtime-Sync der Bestenliste
- [ ] Freundesliste auf die dauerhafte Profil-/Geräteidentität aus Phase 2.6
      aufsetzen (kein zweites Identitätssystem)
- [ ] Freundesliste mit Online/Offline, Rekord, Coins
- [ ] ~~Duell per geteiltem Link (ADR-0010 Schritt 1)~~ — uebersprungen,
      direkt Schritt 2 gebaut (siehe unten)
- [x] **Netzwerk-Duell, Phase 1** (ADR-0010 Schritt 2) _(neu 2026-08-17/18)_:
      Raum-Code, Uhr-Synchronisation, gemeinsamer serverzeitbasierter
      Countdown, Ergebnisvergleich am Ende. Noch **kein** Live-Score
      waehrend des Laufs. `supabase/phase_2_11_duel_rooms.sql` ausgefuehrt.
      `npm run verify` gruen, 22 neue Tests.
  - [x] **Erster Zwei-Geraete-Test (2026-08-18), zwei Bugs gefunden und
        behoben:**
        (1) Realtime-Kanal lehnte JEDEN Beitritt mit "Unauthorized" ab -
        die RLS-Policy auf `realtime.messages` wertet ihre Subquery gegen
        `duel_rooms` mit den Rechten der verbindenden Rolle aus, nicht als
        security definer; ohne direkten (spaltenbeschraenkten) SELECT-Grant
        auf `code`/`expires_at` konnte sie nicht auswerten. Fix in
        `phase_2_11_duel_rooms.sql`, erneut ausgefuehrt.
        (2) Presence-Tracking war komplett wirkungslos: beide Spieler
        nutzten denselben Presence-Key (den Raum-Code statt eines
        individuellen Schluessels), und `channel.track(...)` fehlte
        komplett - ohne aktives Tracking kann kein `leave`-Event entstehen.
        Fix: `localPlayerIndex` als Presence-Key, `track()` nach
        erfolgreichem Verbinden, `NetworkDuelSystem.updateHandlers()` fuer
        einen scene-uebergreifenden Handler-Wechsel (Lobby vs. laufender
        Run), neues `GameEvent.OpponentDisconnected` mit sichtbarem
        HUD-Hinweis.
  - [x] **Zweiter Zwei-Geraete-Test (2026-08-18), Ursache gefunden und
        wahrscheinlicher Fix gebaut, noch NICHT am Geraet bestaetigt:**
        Ablauf: Master erstellt Code, Slave tritt bei. Master startet JAGD,
        spielt die Runde komplett durch, landet im Ergebnis ("Dein
        Geschwister spielt noch seine Runde"). Der Slave haengt
        waehrenddessen durchgehend bei "Uhr wird abgeglichen .../Warte auf
        Geschwister ...". **Wichtig, gegen Ferndiagnose-Versuchung:** Master
        kam im selben Testlauf, gegen dieselbe Datenbank/Policy, durch - das
        schliesst einen generellen Server-/RLS-Fehler aus.
        **Erneuter Testlauf mit verbessertem Logging (v0.1.173,
        2026-08-18):** Debug-Report vom Slave zeigte trotz aktivem Duell
        (`Scenes OnlineDuel`) keinen einzigen `NetworkDuelSystem`-Eintrag -
        weder Erfolg noch Fehler. Grund dafuer selbst gefunden:
        `NetworkDuelSystem` hat sein eigenes, dupliziertes `withTimeout`
        (siehe Kommentar dort), das anders als `CloudSystem.withTimeout`
        NICHT das automatische Erfolgs-/Fehler-Logging vom 2026-08-18-Fix
        bekommen hatte - dieselbe Luecke wie beim Boost-Bug, nur an einer
        zweiten, uebersehenen Stelle. Jetzt behoben, `duel:*`-Eintraege im
        Ringpuffer.
        **Eigentliche Ursache, im Code belegt (nicht nur vermutet):**
        `NetworkDuelSystem.broadcastStartTime()`/`broadcastReady()` rufen
        `activeChannel?.send(...)` mit `void` auf. Supabase Realtime
        `RealtimeChannel.send()` loest ohne `broadcast.ack`-Option **sofort
        mit "ok" auf, sobald die Nachricht lokal in die Warteschlange
        gestellt wurde** - nicht wenn sie beim Empfaenger ankam (Quelle:
        `node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js`,
        `send()`, Zeile ~576). Ein verlorener `start`-Broadcast liess den
        empfangenden Client unbegrenzt in der Lobby haengen, obwohl
        `set_duel_start_time` die Zeit bereits erfolgreich serverseitig
        gespeichert hatte.
        **Fix:** `OnlineDuelScene.runLobbyFlow()` pollt jetzt zusaetzlich
        zum Broadcast-Handler alle `ONLINE_DUEL_START_POLL_INTERVAL_MS`
        (1,5s, neu in `config/onlineDuel.ts`) `getRoomStatus()` fuer BEIDE
        Rollen - findet die bereits gespeicherte Startzeit unabhaengig
        davon, ob das `start`-Event ankam. Sauber aufgeraeumt in
        `beginRun()`/`cleanupLobby()`. `npm run verify` gruen (212 Tests).
  - [ ] **Dritter Zwei-Geraete-Test noetig (seit v0.1.174 live):** bestaetigen,
        dass der Slave nach dem Polling-Fix tatsaechlich startet, statt bei
        "Warte auf Geschwister ..." haengen zu bleiben. Ablauf wie beim
        zweiten Test: Master erstellt Code, Slave tritt bei, Master startet
        JAGD. Der urspruengliche Report erwaehnte zusaetzlich
        "Verbindungsfehler: channel error: transport failure" - der zweite
        Testlauf zeigte das nicht mehr, blieb aber unbestaetigt, ob das am
        Fix liegt oder Zufall des Testlaufs war - im dritten Test mit
        beobachten.
  - [x] **Neu (2026-08-18): Kein sichtbares Feedback bei App-Hintergrund.**
        **Hochgezogen nach P0.b (2026-08-21)** — belegter Fehler mit
        vorhandener Infrastruktur, gehoert nicht als Unterpunkt eines
        Unterpunkts hierher. Ursachenbeschreibung bleibt zur Nachvollziehbarkeit
        stehen:
        Phaser pausiert die Update-Loop automatisch, wenn die Seite in den
        Hintergrund geht (App-Wechsel, Sperrbildschirm) - das ist
        Standardverhalten, aber die App zeigt dabei nichts an. Im ersten
        Test wirkte das wie ein kompletter Absturz ("Bildschirm hing,
        nichts ging mehr"). Es gibt bereits ein Pause-Overlay
        (`HudScene.showPauseOverlay()`), aber nur fuer den manuellen
        Pause-Knopf - kein `visibilitychange`-Handler, der es automatisch
        zeigt. Betrifft nicht nur Netzwerk-Duelle, aber dort am
        sichtbarsten, weil der Gegner in der Zwischenzeit weiterwartet.
  - [ ] Phase 2: Live-Punktestand des Gegners waehrend des Laufs im HUD
  - [ ] Phase 3: Rematch fuer Online-Duelle, Reconnect waehrend einer
        laufenden Runde, Anzeigename statt "Spieler 2"
  - [ ] **Phase 4 — volle gegenseitige Live-Sicht** _(Wunsch des Nutzers,
        2026-08-18)_: **"Eigentlich habe ich gedacht man kann sich
        gegenseitig zusehen wie der andere spielt - also Master-Spiel ist
        sichtbar auf Slave und Slave-Spiel ist sichtbar auf Master."** Beide
        Spieler sehen also nicht nur den Punktestand des anderen, sondern
        sein komplettes laufendes Spielfeld in Echtzeit: Spielfigur,
        Bewegung, jeden Fang - vermutlich als zweites, kleineres Spielfeld
        oder Bildschirmteilung. Reihenfolge vom Nutzer explizit bestaetigt:
        **erst Phase 2 (nur Punktestand) bauen und testen, danach Phase 4
        (volle Sicht) angehen** - nicht gleichzeitig. Einschaetzung dazu:
        technisch machbar (staendige Positionsdaten statt eines 400ms-Takts,
        zweiter Render-Pfad, neue HUD-Flaeche), aber ein eigenes
        Feature-Paket mit eigenem Umfang, kein Anhaengsel an Phase 2.
  - [ ] **Naeherungserkennung fuer Geraete im selben Raum** _(Wunsch des
        Nutzers, 2026-08-18)_: **"Wenn die Geraete nebeneinander sind mit
        Abstand von 1-2m, dann kann man doch eine Technik einbauen die
        erkennt dass Master und Slave gerade nebeneinander sitzen"** - Ziel:
        Beitritt zum Duell-Raum automatisch erkennen/vorschlagen, statt den
        6-stelligen Code manuell abzutippen, wenn beide Kinder ohnehin im
        selben Zimmer sitzen. Technisch ein eigenes Thema, nicht Teil des
        bestehenden Realtime-Ansatzes - moegliche Wege (noch nicht
        recherchiert, welcher im mobilen Browser tatsaechlich zuverlaessig
        funktioniert): Web Bluetooth (eingeschraenkte Unterstuetzung,
        insbesondere iOS Safari), lokale Netzwerk-Discovery, oder ein
        Naeherungssignal ueber Lautsprecher/Mikrofon (Audio-Beacon). Vor
        einer Umsetzung braucht es zuerst eine eigene Machbarkeitspruefung,
        welcher Weg auf den tatsaechlichen Geraeten (iPhones) ueberhaupt
        geht.
- [ ] Rekord-Meldung im laufenden Spiel; echte Push-Meldung nur fuer
      installierte Web-Apps (iOS-Grenze)

---

## Aufraeumen

- [x] **PRIO HOCH — Testdaten aus der Produktions-Supabase-Datenbank
      geloescht** _(neu 2026-08-17, erledigt 2026-08-17)_

  > **Was passiert ist:** Beim Nachziehen von Testabdeckung fuer
  > `CloudSystem` (Audit-Block, siehe `docs/AUDIT_2026-08-17.md` Abschnitt
  > 5.2) hat ein erster, ungemockter Testlauf tatsaechlich gegen die echte
  > Produktions-Supabase-Instanz gesprochen — nicht gegen eine Attrappe. Der
  > Grund: `isBackendConfigured` (`src/config/backend.ts`) wird beim
  > Modul-Laden aus `import.meta.env.VITE_SUPABASE_URL`/`_ANON_KEY`
  > berechnet. Die lokale, gitignorete `.env`-Datei auf diesem Rechner
  > enthaelt dieselben echten Zugangsdaten wie `.env.production`, und Vite/
  > Vitest laedt `.env` automatisch bei jedem lokalen Lauf — auch bei
  > Tests. Ohne expliziten Mock verhaelt sich ein Testlauf also identisch
  > zur echten App und schreibt in dieselbe Datenbank wie echte Spieler.
  >
  > **Usecase, der das ausgeloest hat:** Der Test sollte pruefen, dass
  > `CloudSystem`-Funktionen (`pushSave()`, `createSyncCode()`, etc.) bei
  > fehlender Backend-Konfiguration sauber `{ ok: false }` zurueckgeben statt
  > zu werfen (die im Modulkommentar von `CloudSystem.ts` versprochene
  > "wirft nie"-Garantie). Die Testannahme war "in dieser Umgebung ist kein
  > Backend konfiguriert" — das stimmte in der CI (kein `.env`), aber nicht
  > lokal (echte `.env` vorhanden). Dadurch lief `pushSave()` durch, legte
  > einen echten Spielstand-Datensatz an, und `createSyncCode()` erzeugte
  > einen echten, einloesbaren Sync-Code dazu.
  >
  > **Sofort behoben im Code:** `src/systems/CloudSystem.test.ts` mockt
  > seither `@/config/backend` fest auf "nicht konfiguriert"
  > (`vi.mock('@/config/backend', ...)`), unabhaengig davon, ob lokal eine
  > `.env` mit echten Werten liegt. Kuenftige Testlaeufe koennen nicht mehr
  > versehentlich gegen die echte Datenbank schreiben. **Das hier offene
  > Aufraeumen betrifft nur die zwei bereits entstandenen Altdatensaetze.**
  - [x] Vorab per SQL Editor gegengeprueft statt blind geloescht
        (`supabase/cleanup_2026-08-17_test_leftovers.sql`): `saves`-Zeile
        `id = 'b91ec0c5-999f-4408-8cc7-587bb0c065c5'` mit `level=1,
        best_score=0, total_runs=0, updated_at 07:01:12 UTC` — eindeutig ein
        unbespielter Testdatensatz. `sync_codes`-Zeile `code = '67N0B2'`,
        `save_id` passend, `created_at 07:01:13 UTC` — eine Sekunde nach dem
        saves-Eintrag. **Korrektur zur urspruenglichen Vermutung:** ein
        verknuepfter `scores`-Eintrag ("der Score-Eintrag hat keinen
        plausiblen playerName") liess sich nicht bestaetigen — die Abfrage
        auf `player_id = 'b91ec0c5-...'` lieferte keine Zeile. Nur zwei
        DELETEs noetig, nicht drei.
  - [x] Beide Zeilen geloescht (`delete from public.sync_codes ...`, danach
        `delete from public.saves ...`, in dieser Reihenfolge wegen der
        Fremdschluessel-Beziehung).

- [ ] `src/ui/hitDebug.ts` entfernen, sobald der Knopf-Fehler bestaetigt behoben
      ist — es ist ein Diagnosewerkzeug, kein Feature
- [x] `ideen.txt` in die priorisierte Planung oben ueberfuehrt; die Datei bleibt
      als unveraenderte Quelle des Kinderfeedbacks erhalten.
