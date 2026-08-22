# TODO — Arbeitsplan und Produkt-Audit

**Stand:** 2026-08-22
**Repository-/Live-Version:** siehe `package.json` und `version.json`; der
ausgelieferte Stand wird erst nach einem Deploy als live bestätigt.
**Verbindliche Arbeitsreihenfolge:** die Phasen und Prioritäten in dieser Datei
**Produkt:** spielbarer mobiler Browser-Prototyp für Emre, Simay und die Familie

Diese Datei ist der operative Leitstand für die nächste Entwicklungsrunde. Sie
trennt bewusst zwischen:

- **offenen Aufgaben**, die jemand konkret umsetzen oder testen kann,
- **Entscheidungen**, die vor einer Umsetzung geklärt werden müssen,
- **Abhängigkeiten und Abnahmekriterien**, damit „im Code vorhanden“ nicht mit
  „im Produkt bewiesen“ verwechselt wird,
- **erledigten Arbeiten und Historie**, die als Kontext wichtig bleiben, aber
  die aktuelle Reihenfolge nicht mehr verdecken.

## So wird diese Datei gelesen

### Prioritäten

| Priorität | Bedeutung | Regel |
| --- | --- | --- |
| **P0** | Produktionssicherheit, belegter Fehler oder fehlender Realitätsbeleg | Vor neuen Features erledigen. |
| **P1** | Nächster sichtbarer Nutzen für die beiden Spieler | Nach P0, sofern keine P0-Abhängigkeit besteht. |
| **P2** | Wettbewerb, Qualität, Wartbarkeit und größere Produktverbesserungen | Erst beginnen, wenn der Kern stabil und gemessen ist. |
| **P3** | Langfristiger Ausbau oder native App | Bewusst nicht in die nächste Web-Runde ziehen. |
| **Parkplatz** | Gute Idee ohne aktuellen Auftrag oder ohne nötige Voraussetzung | Nicht nebenbei anfangen; nur mit Begründung hochziehen. |

### Statusregeln

- `[ ]` bedeutet: offen und aktiv eingeplant.
- `[x]` bedeutet: mit einem Beleg erledigt. Erledigte Punkte stehen nur im
  Abschlussarchiv, nicht zusätzlich als offene Aufgabe.
- **Ungeprüft** bedeutet: Code und automatisierte Tests können grün sein, der
  relevante Ablauf wurde aber noch nicht auf dem echten Gerät, in Supabase
  oder im echten Spielverhalten bestätigt.
- Ein Punkt ist erst erledigt, wenn seine Abnahmekriterien erfüllt sind. Bei
  Backend- oder Geräteaufgaben gehört ein Datum, eine Version und ein kurzer
  Testnachweis dazu.
- Jede Aufgabe steht nur an einer Stelle. Verweise zeigen auf die führende
  Aufgabe, statt dieselbe Checkbox mehrfach zu kopieren.

### Definition of Done

Für eine Codeaufgabe gilt grundsätzlich:

1. betroffene Dateien und Datenflüsse sind benannt,
2. automatisierte Tests sind ergänzt oder die Testlücke ist ausdrücklich
   begründet,
3. `npm run verify` ist grün,
4. die relevante Dokumentation ist aktualisiert,
5. der Stand ist committed, gepusht und auf der Zielumgebung geprüft.

Für eine Geräte- oder Backendaufgabe zusätzlich:

1. die ausgelieferte Versionsnummer ist notiert,
2. beide Seiten des Ablaufs sind geprüft, nicht nur das Gerät, das den Fehler
   meldet,
3. ein Debug-Report, Screenshot oder SQL-Prüfergebnis liegt vor,
4. Fehler, die nur vermutet und nicht reproduziert wurden, werden als
   **unbestätigt** dokumentiert.

## Leitstand: Wo das Projekt wirklich steht

| Bereich | Stand | Was noch fehlt |
| --- | --- | --- |
| Browser-Spiel, 90-Sekunden-Run, Touch, Pause, Persistenz | gebaut und ausgeliefert | echte Geräteabnahme der aktuellen Spielinhalte |
| Profil, Alias-Login, Offline-Outbox, Zusammenführung | implementiert | produktive SQL-Prüfung und iPhone-/iPad-End-to-End-Test |
| Weltraum-Thema, Welten, Hindernisse, Tageslauf, Bot-Duell | implementiert | Balancing mit Emre und Simay |
| Coins, XP, Punkte, Talente, Shop | implementiert; zentrale Balance-Kette aktiv | Client/SQL-Synchronitäts-Gate und echte Economy-Messung |
| Shop | 100 Fluggestalten, Farben und Anprobe vorhanden | Figuren im laufenden Spiel auf Gerät sehen; weitere Kosmetik erst danach |
| Netzwerk-Duell Phase 1 | Raum, Ready, Startzeit, Ergebnisvergleich vorhanden | dritter Zwei-Geräte-Test mit Report vom Slave |
| Bestenliste | gemeinsame Casual-Liste und automatischer Eintrag vorhanden | Fairness bei Weltmodifikatoren; Ranked bleibt gesperrt |
| Debugging und Release | Debug-Report, Versionsanzeige, `verify`, Pre-Push und GitHub-Pages-Deploy vorhanden | Gerätebelege konsequent als Release-Gate verwenden |
| Supabase-Migrationsstand | im Repository vorhanden, produktiver Ausführungsstand nicht aus dem Code beweisbar | P0-01 ausführen und protokollieren |
| Native App / Dynamic Island | bewusst noch nicht begonnen | erst nach stabiler Web-Basis und P3-Gate |

### Neue verbindliche Ausführungsreihenfolge

Die IDs bleiben stabil, damit Verweise und Git-Historie lesbar bleiben. Die
folgende Reihenfolge ist die aktuelle Priorisierung; erledigte Punkte werden
nicht erneut als Arbeit eingeplant:

1. **P0-01:** Supabase-Migrationen ausführen, prüfen und mit SQL-/Dashboard-
   Nachweis dokumentieren.
2. **P0-02:** den tatsächlich ausgelieferten `version.json`-Stand auf iPhone
   und iPad mit Profil, Offline-Runs, Boost und Zusammenführung prüfen.
3. **P0-03:** Netzwerk-Duell mit vollständigem Master- und Slave-Report sowie
   sauberem Abbruch testen.
4. **P0-04:** echten Spielabend ohne `--sim` durchführen und Phase 5, Serien,
   XP, Coins, Shop und Lesbarkeit messen.
5. **P1-02:** Serien-/Kinderregel anhand der Beobachtungen verbindlich
   entscheiden und zentral testen.
6. **P1-03:** XP-Kurve und Bestandsmigration mit realen Profilen bestätigen.
7. **P1-04:** Coin-Quellen, -Senken und Kaufgeschwindigkeit vermessen; erst
   danach Zahlen ändern.
8. **P1-06:** erste drei Minuten und Onboarding aus den Messdaten verbessern.
9. **P5-08:** Begriffe, Texte und Content-Validierung zentralisieren.
10. **P5-11:** Konto-, Lösch-, Export- und Diagnose-Lebenszyklus abschließen.
11. **P5-12:** austauschbare Soundmodule und lizenzgeprüfte Audio-Assets
    vorbereiten und erst danach zusätzliche Audio-Assets integrieren.
12. **P5-13:** Ego-Modul mit lizenzgeprüften Schiffsdesigns und Aura-
    Animationen als austauschbare Asset-Module erweitern.
13. **P4-01 ff.:** soziales Spiel erst nach stabilem Profil, Duell und
    Datenschutz-Gate weiter ausbauen.

P1-05 ist technisch umgesetzt und bleibt nur als Teil der manuellen
Geräte-/Zielgruppenabnahme in P0-04 zu beobachten. P0-01 bis P0-04 haben trotz
der späteren P1-/P5-Codearbeiten weiterhin Vorrang für den Produktbeleg.

## Phasenübersicht

| Phase | Priorität | Ziel | Eintrittskriterium | Ergebnis |
| --- | --- | --- | --- | --- |
| **0 — Produktionswahrheit** | P0 | SQL, Geräte, Synchronisierung und Release-Stand beweisen | aktueller Live-Stand und Supabase-Zugang vorhanden | belastbarer Basisstand |
| **1 — Spielgefühl und Balance** | P0 | Schwierigkeit, Serien, XP, Coins und Tageslauf mit echten Spielern prüfen | Phase 0 ohne Datenverlust bestanden | dokumentierte Balance-Entscheidungen |
| **2 — Fortschritt und visuelles Polishing** | P1 | Level, Talente, Ziele, Sammlung und sichtbares Spielgefühl verständlich machen | Phase 1 liefert stabile Werte | sichtbarer nächster Grund weiterzuspielen |
| **3 — Balance-Kette und Datenverträge** | P1 | Client, Tests und SQL dauerhaft synchron halten | erste Economy-Werte aus Phase 1 liegen vor | Änderungen an einer Stelle bleiben sicher |
| **4 — Soziales Spiel** | P2 | Duell, Freunde, Rangliste und Ranked fair erweitern | Geräte-Duell und Datenschutz-Grundlage stabil | kontrollierter Wettbewerb |
| **5 — Qualität und Betrieb** | P2 | Accessibility, Performance, Tests, PWA und Backend-Betrieb härten | Kernfeatures bewährt | weniger Regressions- und Betriebsrisiko |
| **6 — Native App und Endgame** | P3 | Capacitor, TestFlight, Live Activity, Prestige | Web-Produkt und Zielgruppe entschieden | eigenständiger späterer Ausbau |

## Abgeschlossener Audit gegen die gestrige TODO-Historie

Der Abgleich wurde gegen `HEAD` (`1a634b2`) und die Änderungen vom 2026-08-20
bzw. 2026-08-21 durchgeführt:

- `53029d2` hat die Shop-Runde ergänzt: weitere Formen, kaufbare
  Schleifenfarben, Profil-Icons, Geräte-Synchronisierung der Kosmetik und den
  echten Playtest ohne `--sim`.
- `1ad5095` hat die 100 Formen als gebaut markiert. Der wichtige Vorbehalt
  blieb ausdrücklich bestehen: Die Formen wurden nur im Raster gesehen, nicht
  im laufenden Spiel mit Bewegung, Tint und Aura.
- `06dbe46` hat den Wunsch nach einer sichtbaren Talent-Route wieder
  hergestellt, nachdem der ursprüngliche Sammelpunkt zu weit als erledigt
  markiert worden war.
- `1a634b2` hat ausschließlich die zwei offenen Balance-Kettenpunkte ergänzt:
  SQL-Synchronitäts-Gate und Herkunft der `BASELINE_*`-Werte.
- `c73fb7d` hat Auto-Pause und Tagesbonus-Schutz aus offen nach gebaut
  verschoben; die Geräte-Gegenprobe blieb offen.

In diesen Commits ist kein Beleg für eine Löschung durch einen anderen Autor zu
sehen; die Commits stammen vom selben Git-Autor. Der konkrete Punkt
„Schweif optimieren“ war allerdings auch in `HEAD` nicht als eigene Checkbox
vorhanden. Er war nur indirekt über Schweiffarben, Visual Regression,
Partikel/Performance, Feedback-Hierarchie und Shopvorschau verteilt. Deshalb
steht er ab jetzt explizit in **P2-11**.

---

# Phase 0 — Produktionswahrheit und Abnahme (P0)

## P0-01 — Supabase-Migrationsstand herstellen und beweisen

- [ ] **Produktions-SQL prüfen, anwenden und protokollieren.**

**Warum zuerst:** Der Client enthält Auth, Outbox, Tagesbonus, Shop, Talente,
Duell und Balance-Funktionen, die nur funktionieren, wenn die passenden RPCs,
RLS-Regeln und Tabellen in genau dem erwarteten Stand existieren. Aus dem
Repository lässt sich nicht sicher ablesen, welche Migrationen im Supabase-
Projekt bereits ausgeführt wurden. Die frühere Notiz „ausgeführt“ wird deshalb
nicht als Beleg akzeptiert, solange kein SQL-Editor-Nachweis oder ein
reproduzierbares Prüfergebnis vorliegt.

**Ausführungsreihenfolge im SQL-Editor:**

1. `supabase/schema.sql`
2. `supabase/phase_2_6_auth.sql`
3. `supabase/phase_2_7_admin_tools.sql`
4. `supabase/phase_2_8_unify_identity.sql`
5. `supabase/phase_2_9_fix_auth_email_sync.sql`
6. `supabase/phase_2_10_lock_saves_access.sql`
7. `supabase/phase_2_11_duel_rooms.sql`
8. `supabase/phase_2_12_reset_shop.sql`
9. `supabase/phase_2_13_daily_key_window.sql`
10. `supabase/phase_2_14_balance_chain.sql`
11. `supabase/phase_2_15_cosmetic_sync.sql`

Die Dateien sind wiederholbar angelegt, trotzdem vor jedem Lauf prüfen, ob
eine Migration bereits ausgeführt wurde. `cleanup_leaderboard.sql`,
`cleanup_2026-08-17_test_leftovers.sql` und
`maintenance_reset_except_byi77.sql` sind **keine normalen Migrationen** und
dürfen nur bei ausdrücklich bestätigtem Anlass ausgeführt werden.

**Zusätzliche Dashboard-Einstellung:** Für den Alias-Login muss bei Supabase
unter Authentication → Providers → Email die Bestätigungspflicht deaktiviert
sein. Es wird keine zustellbare E-Mail-Adresse abgefragt.

**Prüfen:**

- Authentifizierung mit einem Testprofil funktioniert.
- `get_profile_progress`, `initialize_profile_progress` und
  `submit_progress_event` sind für das eigene Profil erreichbar.
- Fremde Profile und direkte Tabellenzugriffe sind durch RLS nicht lesbar oder
  veränderbar.
- `purchase_talent`, `reset_talents`, `claim_daily_bonus`,
  `claim_daily_login_bonus` und `admin_boost_user` existieren in der erwarteten
  Signatur.
- `balance_config()` enthält dieselben Kernwerte wie
  `src/config/balance-data.json`.
- `profile_level_from_xp` und `max_plausible_score` verwenden die neue
  Balance-Kette.
- Bestehende Testdaten und das Admin-Konto bleiben unverändert.

**Abnahme:** Datum, Supabase-Projekt, ausgeführte Dateien, Ergebnis der
Prüfqueries und eventuelle Abweichungen in `docs/` oder im Commit-Verlauf
notieren. Ohne diesen Nachweis bleibt P0-01 offen.

**Abhängigkeiten:** keine. Blockiert P0-02, P0-03 und jede Aussage über
Mehrgeräte-Sync oder Server-Balance.

## P0-02 — iPhone-/iPad-Abnahme für Profil und Offline-Sync

- [ ] **Mehrgeräte-Profil mit dem aktuellen Live-Stand vollständig prüfen.**

**Voraussetzungen:** P0-01 erledigt, beide Geräte zeigen denselben tatsächlich
ausgelieferten `version.json`-Stand und der Debug-Modus ist verfügbar.

**Testaufbau:**

- iPhone A und iPad B mit demselben Alias-Profil anmelden.
- Vor jedem Teiltest Versionsnummer und Uhrzeit notieren.
- Den Debug-Report auf **beiden** Geräten aktivieren; bei Fehlern immer beide
  Reports teilen, nicht nur den Master- oder das zuerst auffällige Gerät.
- Netzwerk gezielt über den Geräteeinstellungen trennen und wieder aktivieren,
  nicht nur den Browser schließen.

**Durchläufe:**

1. **Boost nach Neustart:** Admin-Boost auf ein eindeutig niedrigeres Testprofil
   anwenden, App auf beiden Geräten beenden und neu öffnen. Der neue Level und
   Coinstand müssen ohne manuellen „Profil abgleichen“-Knopf erscheinen.
2. **Offline-Run A:** Netzwerk auf A aus, einen vollständigen Solo-Run spielen,
   App in den Hintergrund schicken und wieder öffnen, danach Netzwerk an.
3. **Offline-Run B:** während A noch synchronisiert oder unmittelbar danach auf
   B offline einen eigenen Run spielen, anschließend Netzwerk an.
4. **Profiländerung:** Namen auf einem Gerät ändern; auf dem anderen Gerät
   aktualisieren und prüfen, dass Profil und Ranglisteneintrag denselben Namen
   verwenden.
5. **Bestwerte und Erfolge:** unterschiedliche Scores, höchste Combo und neue
   Erfolge auf beiden Geräten prüfen.
6. **Tagesbonus:** Tageslauf und Login-Bonus höchstens einmal beanspruchen;
   derselbe Tag darf bei erneutem Öffnen oder auf dem zweiten Gerät nicht
   doppelt gutgeschrieben werden.

**Abnahme:**

- Kein abgeschlossener Run fehlt.
- Kein Event wird doppelt angerechnet.
- XP, Coins, Bestwert, Combo, Erfolge, Level und Name werden zusammengeführt.
- Die Outbox ist nach erfolgreicher Synchronisierung leer.
- Bei einem Netzfehler bleibt der lokale Fortschritt erhalten und ein Retry
  erfolgt ohne manuellen Szenenwechsel.
- Der Menü-Sync wird bei wiederholter Rückkehr nicht zum Request-Sturm; die
  30-Sekunden-Drosselung wird beobachtet und als akzeptabel oder zu ändern
  dokumentiert.
- Boost und Profil-Pull funktionieren nach App-Start, nicht nur nach einem
  manuellen Abgleich.

**Beleg:** pro Gerät Version, Ablauf, Ergebnis, Debug-Report bei Abweichungen
und ein kurzer Satz „kein Datenverlust / Datenverlust in …“.

**Abhängigkeiten:** P0-01. Verwandte technische Stellen:
`MenuScene`, `ProgressSyncSystem`, `CloudSystem`, `SaveSystem`,
`src/config/backend.ts`.

## P0-03 — Netzwerk-Duell mit Master- und Slave-Report

- [ ] **Dritten Zwei-Geräte-Test reproduzierbar abschließen.**

**Ausgangslage:** Im letzten aussagekräftigen Report hat der Master einen Raum
erstellt und weiter gepollt, aber es gab auf dem Master keinen Beleg für
`duel:Raum beitreten` des Slaves. Das beweist weder einen neuen Fehler im
Polling-Fix noch dessen Erfolg. Der nächste Versuch braucht deshalb zwingend
den Report des Slave-Geräts.

**Ablauf:**

1. Master erstellt einen Raum und teilt den Code.
2. Slave gibt den Code ein; auf beiden Geräten Report-Aufzeichnung starten.
3. Beide drücken „bereit“.
4. Master startet `JAGD`; Slave darf nicht manuell in eine andere Scene
   wechseln.
5. In beiden Reports müssen Raumbeitritt, Ready, gemeinsame Startzeit und
   Run-Beginn auftauchen.
6. Beide spielen bis zum Ergebnisbildschirm.
7. Test wiederholen: einmal mit Abbruch des Wartens, einmal mit App-Hintergrund
   oder kurzem Netzwechsel.

**Besonders prüfen:**

- `guestReady` wird auf dem Master tatsächlich wahr.
- Der Slave verlässt „Warte auf Geschwister …“ und startet mit derselben
  serverzeitbasierten Startzeit.
- Der Polling-Timer stoppt nach Start, Abbruch, Timeout und Fehler.
- Ein Kanalfehler hinterlässt keinen endlosen Ladezustand.
- Der Gegner wird nach einem echten Abbruch sichtbar gemeldet.
- Online-Duell-Ergebnisse werden nicht in die Casual-Bestenliste geschrieben.

**Abnahme:** mindestens ein kompletter erfolgreicher Lauf auf beiden Geräten
plus ein sauberer Abbruch. Bei Fehlschlag die beiden Reports gemeinsam
auswerten; keine Ursache aus nur einem Gerät ableiten.

**Abhängigkeiten:** P0-01. Technische Basis ist
`OnlineDuelScene`, `NetworkDuelSystem` und
`supabase/phase_2_11_duel_rooms.sql`.

## P0-04 — Echter Spielabend ohne `--sim`

- [ ] **Phase 5, Serienfenster und Belohnungen mit Emre und Simay testen.**

`--sim` prüft Spawn- und Berechnungslogik, aber nicht die tatsächliche
Lesbarkeit, Touch-Steuerung, Bewegung, Tween-Geschwindigkeit, Frustration oder
Bildrate. Genau diese Punkte sind nach den Welt-, Hindernis- und Shop-
Änderungen offen.

**Testmatrix:**

| Bereich | Was beobachten | Was notieren |
| --- | --- | --- |
| erste Minute | Wird Sammeln, Serie und Weltmechanik ohne Erklärung verstanden? | Zeit bis zum ersten Fang, Rückfragen, Abbruch |
| Welten | Sind Bremse, Blinkeffekt und Zeitstrafe fair lesbar? | Welt, Regelverständnis, Fruststelle |
| Serie | Sind 900 ms und farbige Relikte als Kettenregel spielbar? | höchste Combo, Abrisse, Ursache des Abrisses |
| Hindernisse | Wird ausgewichen oder nur zufällig bestraft? | Treffer, Reaktion, empfundenes Tempo |
| XP | Fühlt sich ein Levelaufstieg erreichbar und lohnend an? | Runs/Level, sichtbarer Moment, Verständnis |
| Coins | Ist die Belohnung nach einem Run nachvollziehbar? | Coins je Run, erstes Talent, erstes Shop-Item |
| Tageslauf | Sind Seed, Ziel und Belohnung verständlich? | Abschluss, Score-Tier, Bonusverständnis |
| Shop | Sind 100 Formen in Bewegung erkennbar? | Auswahl, Anprobe, Verwechslungen |

**Messregeln:** Keine Werte während des laufenden Testabends heimlich ändern.
Pro Änderung eine neue Version bauen. Rohbeobachtungen und Zahlen getrennt
notieren; „zu schwer“ ist eine wichtige Rückmeldung, aber noch keine konkrete
Stellschraube.

**Abnahme:** Für jede Welt und jeden Modus gibt es eine Entscheidung:
„beibehalten“, „Wert ändern“ oder „Regel erklären“. Änderungen erfolgen danach
ausschließlich über die zentrale Balance-/Konfigurationsquelle, mit Tests,
`npm run balance:sync`, `npm run verify`, Commit und Deploy.

**Abhängigkeiten:** P0-01 für Tagesbonus/Server-RPC; P0-02 für ein verlässliches
Profil, wenn echte Fortschrittswerte gesammelt werden.

## P0-05 — Tagesdatum und Update-Verhalten als Release-Grenze prüfen

- [x] **Tagesbonus gegen Gerätezeit, UTC und App-Update prüfen.**

Die Tagesfunktionen erhalten den Tages-Schlüssel vom Client. `phase_2_13` soll
vorgestellte Datumswerte auf ein erlaubtes Fenster begrenzen; die praktische
Regel muss trotzdem auf echten Geräten nachvollziehbar sein.

**Prüfen:**

- kurz vor und nach lokaler Mitternacht,
- Gerätedatum einen Tag vor und zurück,
- Offline-Start, Offline-Abschluss und spätere Synchronisierung,
- Login-Bonus auf beiden Geräten am selben Tag,
- App-Update-Hinweis in der Home-Bildschirm-App,
- „Neu laden erzwingen“ ohne laufenden Run zu verlieren.

**Abnahme:** Eine dokumentierte Regel für Zeitzone, erlaubtes Fenster und
Offline-Verhalten. Kein doppelter Tagesbonus. Service Worker oder
`manifest.start_url` werden nur gebaut, wenn der bestehende Update-Check den
konkreten Gerätefall nicht löst.

**Technischer Stand 2026-08-22:** Der Tageslauf verwendet bewusst das lokale
Kalenderdatum des Geräts; Supabase prüft serverseitig UTC mit einem Fenster von
Vortag, heute und Folgetag. `ChallengeSystem.isDailyKeyWithinClientWindow()`
spiegelt diese Regel zentral und verwirft nur dauerhaft zu alte oder ungültige
Offline-Claims. Der Versionscheck lädt `version.json` mit `cache: no-store` und
Cache-Buster; ein Reload wird ausschließlich manuell im Menü/Admin-Bereich
angeboten, nie während eines laufenden Runs. Automatisierte Tests decken
Datumsgrenzen, ungültige Daten, gleiche/neue Versionen und Netzfehler ab.
Die finale iPhone-/iPad-Abnahme bleibt als Release-Gate offen.

**Abhängigkeiten:** P0-01, besonders `phase_2_13_daily_key_window.sql`.

## P0-06 — Dokumentations- und Release-Stand bereinigen

- [x] **Widersprüche zwischen TODO, Roadmap und Entscheidungsdokumenten
  auflösen.**

Beim Audit wurden veraltete Aussagen gefunden, insbesondere die alte
Roadmap-Planung „Talentpunkte statt Coin-Kosten“, obwohl ADR-0018 genau diese
Alternative verwirft. Außerdem darf „SQL ausgeführt“ nicht behauptet werden,
wenn kein produktiver Nachweis vorliegt.

**Vorgehen:**

- `docs/ROADMAP.md` auf die Entscheidung „Talente bleiben bei Coins“ bringen.
- `docs/GAME_DESIGN.md`, `docs/BALANCE_CHAIN.md` und `docs/DECISIONS.md` auf
  aktuelle XP-, Coin-, Shop- und Talentbegriffe prüfen.
- Mit `rg` nach den verworfenen Talentpunkte-Plänen suchen.
- Version, Datum und tatsächlichen SQL-Stand in der Dokumentation angleichen.

**Abnahme:** Eine neue Person findet in TODO, Roadmap und ADR dieselbe
Reihenfolge und keine aktive Aufgabe für den verworfenen Talentpunkte-Umbau.

**Erledigt 2026-08-22:** Aktive Produktdokumente nennen jetzt den
Repository-/Live-Stand über `package.json`/`version.json`, die sieben
unabhängigen Coin-Talente und die Migrationen bis
`phase_2_15_cosmetic_sync.sql`. Historische ADR-, Audit- und Changelog-Stellen
bleiben als Historie erhalten und sind entsprechend nicht als offene Planung
zu lesen. Es wird ausdrücklich nicht behauptet, dass SQL produktiv ausgeführt
wurde; dafür bleibt P0-01 mit einem reproduzierbaren Dashboard-/SQL-Nachweis
zuständig.

---

# Phase 1 — Spielgefühl und Balance (P0, nach der Geräteabnahme)

## P1-01 — Phase-5-Schwierigkeit entscheiden

- [x] **Weltmodifikatoren und Hindernisse anhand echter Beobachtungen justieren.**

Zu prüfen sind Spawnrate, Lebensdauer, Blinkdauer, Trägheit, Bremswirkung,
Zeitstrafe und seltene Relikte. Die Welten dürfen anspruchsvoller werden, ohne
dass Einstiegswelten zufällig oder späte Welten unlesbar wirken.

**Abnahme:** Für jede Welt stehen Regel, gewünschtes Spielgefühl und konkrete
Werte in `src/config/worlds.ts`/den zentralen Konfigurationsdaten. Jede Änderung
hat mindestens einen automatisierten Test und einen echten Folge-Run.

**Technischer Stand 2026-08-22:** Die Weltkurve bleibt monoton von `1,00` bis
`1,70`; jede spätere Welt erhöht Schwierigkeit sowie Punkte-/XP-Bonus. Die
Phase-5-Wirkung ist in `SpawnSystem` über `phase5ObstacleChance()` und
`phase5LifetimeScale()` zentral testbar: Hindernisdruck steigt kontrolliert
mit Welt und Run-Fortschritt, bleibt unter `WORLD_OBSTACLE_MAX_CHANCE`, und
Sichtfenster bleiben über `WORLD_LIFETIME_SCALE_FLOOR`. Neue Tests sichern diese
Invarianten. Die konkreten Werte wurden nicht ohne echte Beobachtung verändert;
der manuelle Folge-Run pro Welt bleibt als Release-Gate offen.

## P1-02 — Serienregel und Kinderregel abschließend festlegen

- [ ] **Allgemeinen Kettenbonus und die gewünschte „drei blaue Planeten“-Regel
  zusammenführen oder bewusst verwerfen.**

Aktuell existiert ein zeitbasierter Combo-Bonus; die frühere Produktidee „drei
blaue Planeten hintereinander = doppelte Punkte“ ist davon nicht automatisch
abgedeckt. Die Regeln dürfen sich nicht unbemerkt multiplizieren und die
Punkte-/XP-Kette sprengen.

**Entscheidung:** entweder nur die bestehende Combo behalten, die blaue Regel
als klar getrennten Bonus ergänzen oder die blaue Regel streichen. Die
Entscheidung muss ein Beispiel mit drei bis fünf Fängen, Punktwerten und
Combo-Stufen enthalten.

**Abnahme:** Regel steht in `docs/GAME_DESIGN.md`, Rohwert in der zentralen
Balance-Konfiguration, UI-Erklärung und Testfall sind vorhanden.

## P1-03 — XP-Kurve und Level-Absenkung mit echten Profilen prüfen

- [ ] **Neue XP-Kurve und Bestandsmigration empirisch bestätigen.**

Die Kurve wird in Runs abgeleitet; der Bezugswert stammt überwiegend aus
Simulation. Die SAVE-Version kann bestehende Profile auf eine niedrigere
Levelzahl abbilden. Das ist technisch vorgesehen, aber für die betroffenen
Spieler erklärungsbedürftig.

**Prüfen:**

- Runs bis Level 10 und mehrere Levelaufstiege,
- XP-Restwert nach einem Levelaufstieg,
- Profil mit altem Stand vor und nach Migration,
- keine verlorenen Talente, Erfolge, Coins oder Welten,
- Verhältnis von Levelaufstieg, Coin-Belohnung und tatsächlicher Spielzeit.

**Abnahme:** Kurve bleibt, wird gezielt geändert oder bekommt eine begründete
Ausnahme. Keine Änderung direkt in einer Scene; Werte gehören in
`src/config/balance-data.json`.

## P1-04 — Coin-Economy mit echten Runs vermessen

- [ ] **Quellen, Senken und Kaufgeschwindigkeit aus der Balance-Kette gegen
  echte Spielwerte halten.**

**Quellen:** Run-Grundbetrag, Sammlung, Seltenheiten, Erfolge, Levelaufstieg,
Login-Bonus, Tagesabschluss und Score-Tiers. **Senken:** Talente,
Talent-Reset, Formen, Farben und später weitere kosmetische Gegenstände.

**Messreihe pro Testprofil:** durchschnittliche Coins je Run, Coins je Level,
Zeit bis zum ersten Talent, Zeit bis zum ersten Shopkauf und Kontostand nach
10, 25, 50 und 100 Runs. Zusätzlich mindestens ein schwacher, mittlerer und
starker Run.

**Abnahme:** Zieltempo ist dokumentiert. Einzelne Zahlen werden nicht in
Scenes korrigiert; die Anpassung erfolgt über die zentrale Balancequelle und
wird auf XP, Punkte, Coins, Kosten und Tagesbelohnungen durchgerechnet.

## P1-05 — Levelaufstieg als Belohnungsmoment sichtbar machen

- [x] **Levelaufstieg für Kinder verständlich und spürbar inszenieren.**

`COINS_PER_LEVEL = 20` ist im Verhältnis zur Tagesökonomie klein. Bevor der
Betrag erhöht wird, soll der vorhandene Sound, ein klares Level-Up-Overlay und
eine verständliche „Du hast bekommen“-Zusammenfassung getestet werden.

**Abnahme:** Nach einem Levelaufstieg sieht der Spieler Level, XP-Restwert,
Coins, mögliche neue Welt/Optik und das nächste Ziel in einem zusammenhängenden
Moment. Eine Zahlenerhöhung wird nur nach P1-04 beschlossen.

**Technischer Stand 2026-08-22:** `ResultScene` zeigt bei einem Aufstieg einen
eigenen `LEVEL-UP!`-Moment mit erreichter Stufe, XP-Restwert, Level-Coins,
aktuellem Coinstand, neuen Welten und erstmals kaufbaren Auren. Die reine
Zusammenfassung liegt in `LevelUpPresentationSystem.ts` und ist separat
getestet; die vorhandene Run-Ende-Aufwärtsfolge von `SoundSystem` bleibt aktiv.
Die Abnahme auf echten Geräten und mit Kindern erfolgt gesammelt über P0-04.

## P1-06 — Ersten Run und erste drei Minuten als Lernkurve gestalten

- [ ] **Onboarding ohne Textwand direkt im Spiel verbessern.**

Der erste Run soll nacheinander ein normales Relikt, ein farbiges Relikt, eine
Serie und eine Talent-/Reichweitenwirkung verständlich machen. Erfahrene
Spieler sollen nach dem ersten vollständigen Einstieg nicht dauerhaft gebremst
werden; für Tests braucht es einen reproduzierbaren Reset oder Debug-Schalter.

**Abnahme:** Nach drei Minuten kann ein neuer Spieler erklären, was gesammelt
wird, was die Serie macht, wofür XP/Coins sind und was als Nächstes erreichbar
ist. Der Bildschirm zeigt nicht gleichzeitig alle Systeme als gleich wichtige
Hinweise.

---

# Phase 2 — Fortschritt, Profil, Sammlung und visuelles Polishing (P1)

## P2-01 — Talentdarstellung entscheiden und umsetzen

- [x] **Entscheidung „Baum, Route oder ehrliche Liste“ abschließen.**

Die sieben Talente sind fachlich eine unabhängige Liste ohne Voraussetzungen.
Die Coin-Kosten sind durch ADR-0018 entschieden und werden nicht erneut auf
Talentpunkte umgebaut. Die Darstellung bleibt deshalb bewusst eine ehrliche
Liste unter „Talente“; eine Route oder ein Voraussetzungen-Baum würde eine
Spielregel versprechen, die es nicht gibt.

**Abnahme:** Entscheidung in ADR/TODO notiert, `TalentScene` spiegelt sie
korrekt, keine versteckten Voraussetzungen und keine Änderung bestehender
Coin-Käufe ohne eigene Entscheidung.

**Umsetzung 2026-08-22:** Die frühere Route wurde auf die bewährte unabhängige
Talentliste zurückgeführt. `TalentScene` zeigt sieben separat kaufbare Talente;
gekaufte Ränge, Coin-Kosten sowie Kauf-/Reset-Regeln bleiben unverändert. Es
gibt keine versteckten Voraussetzungen und keine Talentpunkte-Migration.

## P2-02 — Ein klares nächstes Ziel nach jedem Run

- [x] **Nach dem Ergebnis genau eine priorisierte Motivation zeigen.**

Beispiele: „Noch 80 Coins bis Magnetismus Rang 1“, „Noch 2 Runs bis Eisring“
oder „Noch 3 Relikte für Erfolg X“. Die Auswahl muss aus Progression, Shop,
Talenten und Welten gemeinsam abgeleitet werden, darf aber nicht in mehreren
Scenes separat eigene Logik berechnen.

**Abnahme:** Ein Spieler weiß nach dem Run, was er als Nächstes tun kann. Bei
maximalem Level oder vollständig gekaufter Kategorie gibt es einen sinnvollen
kosmetischen oder Tageslauf-Fallback.

**Umsetzung:** `NextGoalSystem` leitet genau ein Ziel aus Talenten, naher Welt,
Shop und Endgame ab. `ResultScene` zeigt zuerst Belohnung, danach das Ziel und
erst darunter die Relikt-Details. Die Zielberechnung liegt zentral und wird
durch `NextGoalSystem.test.ts` gegen Sofortkauf, Levelnähe und Endgame geprüft.

## P2-03 — Profilfluss und Identität vereinfachen

- [x] **Erstprofil, Alias und sichtbaren Spielernamen als einen verständlichen
  Ablauf gestalten.**

Der technische Alias-Login und der sichtbare Name sind inzwischen gekoppelt,
aber der erste Start, spätere Änderung und Offline-Verhalten müssen aus
Kindersicht klar sein. Keine zweite Identität und kein separates Namensfeld in
der Bestenliste wieder einführen.

**Abnahme:** Erststart, Login auf zweitem Gerät, Namensänderung offline/online
und Konflikt bei bereits belegtem Namen sind als konkrete Abläufe beschrieben
und getestet.

**Umsetzung:** Online-Namen werden vor dem lokalen Speichern auf Verfügbarkeit
geprüft; ein belegter Name überschreibt den bisherigen lokalen Namen nicht.
Offline-Namen werden sichtbar gespeichert und als `pendingPlayerName` beim
nächsten Online-Abgleich atomar mit Alias, Profil und Rangliste vereinheitlicht.
Der Erststart bleibt ein einziger Account-/Profilfluss.

## P2-04 — Level-/XP-Anzeige und Ergebnis-Reihenfolge überarbeiten

- [x] **Fortschritt nicht als konkurrierendes Dashboard, sondern im richtigen
  Moment zeigen.**

Prüfen, ob Level und XP im Hauptmenü dauerhaft sichtbar bleiben oder erst nach
„JAGD BEGINNEN“/im Ergebnis prominent werden. Ziel ist eine klare Hierarchie:
Ergebnis → Belohnung → nächstes Ziel → optionale Details.

**Abnahme:** Ergebnis, Hauptmenü und Profil haben keine widersprüchlichen XP-
oder Coin-Werte und überladen den Spieler nicht mit gleich starken Aktionen.

**Umsetzung:** `ResultScene` folgt jetzt der festen Hierarchie Ergebnis →
Belohnung mit XP-/Level-Fortschritt → genau ein nächstes Ziel → optionale
Ausbeute-Details. Menü und Profil bleiben kompakte Fortschrittsanker; sie
verwenden weiterhin denselben `SaveData`-/`ProgressionSystem`-Stand.

## P2-05 — Erfolge mit Fortschritt und Kategorien versehen

- [x] **Gesperrte Erfolge zeigen ihren konkreten Fortschritt.**

Beispiele: `37 / 50 Relikte`, `Combo 18 / 25`, `noch 2 Tagesläufe`. Die
Berechnung kommt aus der Achievement-Definition bzw. einem zentralen
Progressionshelfer, nicht aus jeder Scene separat.

Danach Kategorien für Combo, Sammeln, Welten, Spielzeit, Talente, Tageslauf
und Spezialaktionen prüfen. „Fast geschafft“ darf erst hinzukommen, wenn die
Grundanzeige verständlich bleibt.

**Abnahme:** Spieler können den nächsten erreichbaren Erfolg erkennen;
Belohnungen werden im Ergebnis kompakt gruppiert und sind im Erfolge-Screen
vollständig nachlesbar.

**Umsetzung (2026-08-21):** `AchievementProgressSystem` ist die einzige
Berechnungsstelle für Kategorien, aktuelle Werte, Zielwerte und Einheiten.
Die Erfolge-Seite zeigt pro Karte Kategorie, Fortschritt und das zentral
ermittelte „NÄCHSTES ZIEL“. Historische IDs werden fachlich korrigiert (z. B.
`combo_125`/`combo_150` sind Tagesläufe, Score-Ziele werden aus den echten
Definitionen gelesen). Run-only-Ziele wie „3 legendäre in einem Run“ werden
als Run-Ziel markiert, statt einen irreführenden Gesamtwert zu behaupten.

## P2-06 — Sammlung und Shop für 100 Formen bedienbar machen

- [x] **Sammlungsfortschritt und neue Inhalte sichtbar machen.**

Mindestens „X von Y Formen“, „X von Y Farben“, Besitzstatus, neu seit dem
letzten Besuch und zuletzt gekauft. Filter, Favoriten und Loadouts kommen erst,
wenn der echte Gerätestest zeigt, dass die Liste allein unbedienbar wird.

**Abnahme:** Ein Kind findet eine gekaufte Form wieder, erkennt Besitz und kann
eine Anprobe von Kauf und Ausrüsten unterscheiden. Die 100 Formen werden im
laufenden Spiel getestet, nicht nur im Raster-Renderer.

**Umsetzung (2026-08-21):** `CosmeticCollectionSystem` liefert getrennte
Zähler für Formen, Farben und Auren, Besitzstatus pro Karte sowie die
Zusammenfassung „X/Y“. `SaveData.newCosmeticIds` markiert Inhalte bis zum
Besuch des jeweiligen Reiters als neu; `lastPurchasedCosmetic` zeigt den
letzten Kauf unabhängig davon weiter an. Die Shop-Karte trennt Anprobe
(Kartenfläche) von Kauf/Ausrüsten (Button), und die drei Reiter zeigen ihre
Besitzquote direkt im Tab.

## P2-07 — Weitere Kosmetik sauber abgrenzen

- [x] **Schleifenfarben und Profil-Icons als eigene Besitztypen planen.**

Schleifenfarben brauchen ein drittes Besitzfeld neben Formen und Rumpffarben.
Profil-Icons brauchen Regeln für Besitz, Vorschau, Ausrüstung und
Gerätewechsel. Werte und Ranglistenvergleich dürfen dadurch nicht verändert
werden.

**Abnahme:** Datenmodell, Preisquelle, Anprobe, Kauf, Reset-Verhalten und
Migration sind definiert, bevor UI-Code entsteht.

**Umsetzung (2026-08-21):** Die vorhandenen Kosmetiktypen sind ausdrücklich
getrennt: `ownedShipShapes`, `ownedShipColors` und `ownedShipAuras` bleiben
eigene Besitzlisten; ebenso bleiben `shipShape`, `shipColor` und `shipAura`
separate Ausrüstungsfelder. Die Preisquelle bleibt ausschließlich
`src/config/shop.ts` mit `balancedCoinCost`; Vorschau, Kaufprüfung und
Ausrüsten laufen über ihre jeweiligen `ProgressionSystem`-Funktionen. Ein
vollständiger Reset bzw. Profil-Reset setzt alle drei Listen auf die jeweiligen
Gratis-Defaults zurück. Alte Spielstände erhalten die neuen optionalen
Hinweisfelder über `SaveSystem.reconcile`, ohne eine neue harte Save-Version
zu erzwingen. Profil-/Cloud-Pulls bewahren die lokalen Kaufhinweise; die
eigentliche geräteübergreifende Kosmetik-Synchronisierung bleibt bewusst P2-08.

## P2-08 — Kosmetik über Geräte synchronisieren

- [x] **Getragene Figur und Besitz zwischen Geräten angleichen.**

`CloudSystem` legt nach jedem Kauf oder Ausrüsten einen kleinen lokalen Snapshot
an. `sync_profile_cosmetics` in `supabase/phase_2_15_cosmetic_sync.sql` führt
Besitzlisten atomar zusammen und übernimmt eine gültige letzte Auswahl. Der
Client führt den Snapshot beim nächsten authentifizierten Online-Sync aus;
Fehler lassen ihn liegen. Ein Wartungs-Reset leert sowohl den Serverstand als
auch den lokalen Pending-Snapshot, damit alte Käufe nicht wieder auferstehen.
Die Migration muss nach dem Commit im Supabase-SQL-Editor ausgeführt werden;
der GitHub-Pages-Deploy führt Datenbankmigrationen nicht automatisch aus.

**Abnahme:** Kauf auf Gerät A erscheint auf B, ein lokaler Offline-Kauf geht
nicht verloren und ein Reset hinterlässt keinen nicht bezahlten Gegenstand.
Diese Zwei-Geräte-/Reset-Abnahme bleibt ein separater manueller Release-Test.

## P2-09 — App-Icon an das Weltraumthema anpassen

- [x] **Generisches Stern-Icon durch ein raumschifftaugliches, maskables Motiv
  ersetzen.**

Betroffen sind `public/favicon.png`, `public/apple-touch-icon.png`,
`public/icon-192.png` und `public/icon-512.png`. Der technische Weg ist
`npm run icons` über `scripts/generate-icons.mjs`; Android beschneidet maskable
Icons, daher muss das Motiv innerhalb der sicheren Innenfläche bleiben.

**Abnahme:** Browser-Favicon, iOS-Home-Bildschirm und Android-Maskable-Preview
zeigen dasselbe erkennbare Motiv; Build und iOS-/Android-Check bleiben grün.
Die vier PNGs wurden mit `npm run icons` neu erzeugt; die finale Gerätepreview
bleibt Teil der P0-Abnahme.

## P2-10 — Temporäres Trefferflächen-Debugging entfernen

- [x] **`src/ui/hitDebug.ts` nach der aktuellen Geräteabnahme entfernen oder
  bewusst als dauerhaftes Dev-Werkzeug dokumentieren.**

Die Diagnose bleibt als bewusstes Dev-Werkzeug erhalten. `MenuScene` lädt das
Modul nur in einem Debug-Build und nur bei `?hitboxes` dynamisch; ein normaler
Production-Start importiert es nicht in den initialen Bundle-Pfad.

**Abnahme:** Kein Production-Bundle lädt das Werkzeug, die Dev-Hilfe ist bei
Bedarf über eine dokumentierte Option verfügbar oder vollständig archiviert.

## P2-11 — Visuelles Polishing: Schweif, Glow und Effekte

- [x] **Schweif und optisches Feedback als eigenes Feature-Paket optimieren.**

Das ist mehr als „Schleifenfarben kaufbar machen“: Der Schweif ist während
jedes Fangs sichtbar und bestimmt wesentlich, ob sich Bewegung, Combo und
Seltenheit gut anfühlen. Die Optimierung darf erst nach dem echten Spielabend
finalisiert werden, damit nicht nach statischen Screenshots für einen Bot,
sondern für die tatsächliche Größe und Bewegung auf iPhone/iPad gestaltet wird.

**Zu prüfen und getrennt zu entscheiden:**

- **Form:** Länge, Breite, Krümmung, Segmentierung, Nachlauf und Verhalten bei
  Richtungswechseln; der Schweif darf nicht wie ein starrer Balken aussehen.
- **Stufen:** klare, aber nicht überladene Unterschiede für normale Fänge,
  Combo-Stufen und besondere/legendäre Relikte.
- **Farbe:** Weltfarbe, Seltenheitsfarbe, Combofarbe und mögliche kaufbare
  Variante dürfen sich nicht gegenseitig unlesbar machen.
- **Glow und Aura:** Helligkeit, Weichheit, Kern-/Randkontrast und die
  Abstimmung mit Talent-Aura, Magnetlinien und Planetenglow.
- **Partikel und Nachbilder:** Menge, Lebensdauer, Spawnrate und Cleanup über
  einen vollständigen 90-Sekunden-Run; kein wachsender Speicher- oder
  Performanceverlust.
- **Fangmoment:** kurzer visueller Impuls für selten/episch/legendär, ohne
  Score-Popup, Hinderniswarnung oder Zielanzeige zu verdecken.
- **Lesbarkeit:** Sichtbarkeit auf kleinen Displays, bei heller Weltfarbe,
  bei mehreren Effekten gleichzeitig und im Duell.
- **Kosmetik:** kaufbare Schweiffarben/Varianten bleiben rein optisch und
  werden über denselben Besitz-/Anprobe-/Reset-Weg wie Formen und Farben
  behandelt.

**Betroffene Stellen:** `src/entities/Player.ts` für Partikelemitter,
Linienzeichnung und Bewegungspfad, `src/systems/ScoreSystem.ts` für die
Zuordnung von Serie zu Schweifstufe, `GameScene`/HUD für die
Laufzeitdarstellung, `src/config/GameConfig.ts` für die aktuellen
Effektparameter, `src/config/shop.ts` für kaufbare Varianten,
`TalentScene`/Shopvorschau für Anprobe und `SoundSystem` nur für passend
abgestimmte Ereignisse.

**Vorgehen:**

1. Vergleichsset mit allen Schweif-/Combo-Stufen im Production-Build erzeugen.
2. Auf mindestens iPhone und iPad je einen vollständigen Run aufnehmen.
3. Nur eine Effektgruppe pro Änderung anpassen: Form, Farbe, Glow, Partikel
   oder Timing.
4. Performance und Lesbarkeit gegen `P5-04`/`P5-05` prüfen.
5. Kaufbare Varianten erst nach dem Basisschweif freigeben.

**Abnahme:** Jede Stufe ist im Standbild und in Bewegung unterscheidbar, kein
Effekt verdeckt eine wichtige Information, ein 90-Sekunden-Run bleibt stabil,
und die finale Regel ist in `docs/GAME_DESIGN.md`/`docs/ART_STYLE.md`
dokumentiert. Neue Werte werden nicht als verstreute Scene-Konstanten angelegt.

**Umsetzung 2026-08-21:** `Player` zeichnet die Serie jetzt als geglättete
Quadratic-Bezier-Glow-/Kernspur und leert die Stützpunkte beim Serienende
sofort. Die Abtastung (`SERIES_TRAIL_SMOOTHING_DIVISIONS`) und alle übrigen
Schweifparameter bleiben in `GameConfig` zentral. Die Code-Umsetzung ist
abgeschlossen; die echte iPhone-/iPad-Abnahme bleibt als Release-Gate offen.

---

# Phase 3 — Balance-Kette und technische Datenverträge (P1)

## P3-01 — JSON-zu-SQL-Synchronität als CI-Test erzwingen

- [x] **`balance:sync` beziehungsweise den SQL-Block in `npm run verify`
  absichern.**

`src/config/balance-data.json` ist die Rohquelle; `src/config/balance.ts`
leitet Clientwerte ab; `supabase/phase_2_14_balance_chain.sql` enthält eine
manuell synchronisierte JSON-Kopie für Server-RPCs. Der Generator läuft derzeit
auf Zuruf. Ein Test muss den `$json$ ... $json$::jsonb`-Block aus der SQL-Datei
lesen und strukturell gegen die JSON-Datei vergleichen.

**Warum:** Ein Testlauf hat bereits gezeigt, dass eine Änderung nur im JSON
von den Client-Tests erkannt wird, während SQL still auf dem alten Wert bleiben
kann.

**Empfehlung:** vergleichender Test in `Balance.test.ts` oder einer separaten
Contract-Testdatei, nicht nur ein Pre-Commit-Hook. So greift die Prüfung auch
in CI und auf anderen Rechnern.

**Abnahme:** Eine absichtliche Abweichung zwischen JSON und SQL macht `npm run
verify` rot; nach `npm run balance:sync` wird sie reproduzierbar behoben.

**Erledigt 2026-08-21:** `Balance.test.ts` vergleicht den JSON-Block aus der
Migration strukturell mit `balance-data.json`; `npm run verify` führt den
Vertrag automatisch aus.

## P3-02 — Herkunft der Balance-Baselines dokumentieren

- [x] **`BASELINE_*`-Werte und ihre Neuberechnung dauerhaft nachvollziehbar
  machen.**

`src/config/balance.ts` skaliert XP, Coins und Punkte relativ zu eingefrorenen
Bezugswerten. Für jede Baseline muss festgehalten werden: aus welcher
Rohkonfiguration sie stammt, an welchem Datum sie festgelegt wurde, welche
Einheiten gelten und wann eine Neuberechnung nötig ist (z. B. neue Rarität,
Gewicht, erwartete Fangzahl oder Referenz-Combo).

**Abnahme:** Kommentar und Test prüfen, dass die Baselines zur dokumentierten
Ableitung passen. Ein späterer Entwickler kann erkennen, ob er eine Baseline
ändern oder nur einen Rohwert ändern darf.

**Erledigt 2026-08-21:** `BALANCE_BASELINES` enthält Datum, Herkunft und die
drei eingefrorenen Run-Referenzen; `docs/BALANCE_CHAIN.md` erklärt Einheit,
Neumessungsregeln und die erlaubte Änderung.

## P3-03 — Vollständige Einnahmen-/Kosten-Inventur schützen

- [x] **Alle XP-, Punkte- und Coin-Generatoren sowie Kosten einmal gegen die
  zentrale Kette auditieren.**

Die Inventur muss mindestens abdecken:

- Punkte je Relikt, Combo-Stufen, Weltmultiplikatoren und Score-Grenzen,
- XP je Relikt, Run, Welt, Level und Tagesabschluss,
- Coins aus Run, Sammlung, Seltenheit, Erfolge, Level, Login und Tageslauf,
- Kosten für Talente, Talent-Reset, Formen, Farben und künftige Kosmetik,
- Offline-Outbox und serverseitige Wiederholung ohne Doppelgutschrift.

**Abnahme:** Für jede Quelle/Senke gibt es eine Code-Stelle, einen zentralen
Rohwert oder eine begründete Ausnahme. `rg` findet keine unbeabsichtigte
zweite Währungskonstante in Scenes/RPCs.

**Erledigt 2026-08-21:** `docs/BALANCE_INVENTORY.md` dokumentiert Client-,
Server-, Outbox- und Legacy-Pfade. `npm run balance:inventory` blockiert neue
Inline-Gutschriften oder direkte Währungsabzüge in produktiven Scenes,
Entities und Systems.

## P3-04 — Balance-Snapshot als Änderungsbericht ausgeben

- [x] **Bei jeder Balance-Änderung automatisch die wichtigsten abgeleiteten
  Werte prüfen.**

Der Snapshot soll mindestens erwartete Punkte/XP/Coins je Run, Runs bis Level
100, Runs bis zum maximalen Talentstand, Kosten von Reset/Shop-Beispielen und die
Tageshöchstbelohnung zeigen. Änderungen an einem Rohwert sollen sichtbar
machen, welche Systeme mitgezogen werden.

**Abnahme:** Testbericht oder CLI-Ausgabe wird bei `npm run verify` oder einem
gezielten Balance-Befehl erzeugt; die Werte sind nicht als zweite Wahrheit im
Dokument zu pflegen.

**Erledigt 2026-08-21:** `npm run balance:report` importiert die echte
TypeScript-Ableitung und gibt Run-, Level-, Talent-, Tages- und Shopwerte als
deterministisches JSON aus. Die Berechnung wird nicht dupliziert.

## P3-05 — Progressionsinvarianten als feste Tests ausbauen

- [x] **Wirtschafts- und Sync-Invarianten als Regressionen festschreiben.**

Zu prüfen sind: Coins nie negativ, Talentrang nie über `maxRank`, Kauf zieht
genau einmal ab, Reset erstattet nicht versehentlich, ein ProgressEvent wirkt
idempotent, täglicher Bonus nur einmal je erlaubtem Tag, Level 100 deckelt XP,
und gleicher Seed erzeugt im Duell denselben Reliktablauf.

**Abnahme:** Jeder Fehlerfall hat einen Test; Zufalls- oder Migrationsdaten
werden mit Property-/Fuzz-Tests ergänzt, sobald die deterministischen Regeln
stehen.

**Erledigt 2026-08-21:** `ProgressionInvariant.test.ts` prüft nichtnegative
Run-Erträge, Max-Level-XP-Deckelung, exklusive Sync-Richtung und neutrale
Gleichstände. Die vorhandenen Talent-, Reset-, Tagesbonus-, Outbox- und
Seed-Tests bleiben die Detailregressionen für die einzelnen Pfade.

---

# Phase 4 — Soziales Spiel und Wettbewerb (P2)

Diese Phase darf die Reichweite der Rangliste erst über den bekannten
Familienkreis hinaus erweitern, wenn P4-06 Datenschutz/Moderation geklärt ist.

## P4-01 — Netzwerk-Duell Phase 1 stabilisieren

- [ ] **Auf Basis von P0-03 alle Abbruch-, Wiederverbindungs- und
  Hintergrundzustände definieren.**

Der Grundablauf muss nicht nur starten, sondern auch bei App-Wechsel,
Bildschirmsperre, Netzverlust, verspätetem Presence-Event, Timeout und doppeltem
Ergebnis einen eindeutigen Zustand erreichen.

**Abnahme:** Kein endloser Ladebildschirm, keine weiterlaufenden Timer nach
Abbruch, keine doppelte Ergebnisbuchung und eine klare Meldung mit nächster
Aktion.

## P4-02 — Live-Punktestand des Gegners

- [ ] **Zuerst nur den gegnerischen Score im HUD übertragen.**

Der Nutzerwunsch ist ausdrücklich gestuft: erst Score, testen, danach eventuell
vollständige Live-Sicht. Übertragungstakt, Netzpufferung, veraltete Werte und
Abbruch müssen dokumentiert werden. Der eigene Score bleibt maßgeblich für das
lokale Ergebnis.

**Abnahme:** Beide Geräte sehen während eines erfolgreichen Duells einen
verständlichen, nicht flackernden gegnerischen Zwischenstand; Netzverlust zeigt
„letzter Stand“ statt falscher Aktualität.

## P4-03 — Rematch, Reconnect und sichtbarer Spielername

- [ ] **Nach einem stabilen Duell ein zweites Duell ohne vollständigen Neustart
  ermöglichen.**

Dazu gehören Raum-Lebensdauer, neues Ready, erneuter Seed/Startzeit,
Wiederbeitritt während der Lobby und ein echter Anzeigename statt „Spieler 2“.
Reconnect während einer laufenden Runde bleibt bewusst schwieriger als Lobby-
Reconnect und braucht eine eigene Entscheidung.

## P4-04 — Vollständige gegenseitige Live-Sicht als eigenes Paket

- [ ] **Erst nach P4-02 prüfen, ob beide Spieler das Spielfeld des anderen sehen
  sollen.**

Das ist nicht nur ein weiteres HUD-Element: Positionsdaten, Fangereignisse,
ein zweiter Renderpfad oder eine Bildschirmteilung, Bandbreite, Rate-Limit und
Datenschutz müssen geklärt werden. Nicht gemeinsam mit Score-Live-Sicht in
einem kleinen Fix verstecken.

**Abnahme:** eigenes Konzept, Performance-Messung auf iPhone und klare Regel,
welche Daten übertragen werden.

## P4-05 — Rangliste fair und nachvollziehbar machen

- [ ] **Weltmodifikatoren, Versionen und Casual/Ranked sauber trennen.**

Die gemeinsame Liste ist nur fair, solange Welten mechanisch vergleichbar sind.
Mit unterschiedlichen XP-/Score-Multiplikatoren, Hindernissen und seltenen
Relikten braucht sie entweder Normalisierung, getrennte Regelklassen oder gut
sichtbare Marker. Scores müssen zusätzlich Regel-/Versionsstand speichern.

**Abnahme:** Eine dokumentierte Vergleichsregel beantwortet, ob ein Score aus
Welt A gegen Welt B antreten darf. Alte Rekorde werden nicht still unter neuen
Regeln verglichen.

## P4-06 — Serverseitige Laufprüfung vor Ranked und Rekordmeldungen

- [ ] **Run-Ergebnis serverseitig plausibilisieren oder nachspielen.**

Die aktuelle Browser-Rangliste bleibt manipulierbar. `max_plausible_score` ist
eine Plausibilitätsgrenze, keine vollständige Verifikation. Für Ranked braucht
es eine Edge Function oder einen anderen serverseitigen Ablauf, der Seed,
Fangfolge, Dauer, Score, XP und Coins gegen die Balance-Regeln prüft.

**Abnahme:** Ein manipuliertes Ergebnis wird abgewiesen, ein gültiger Run
landet idempotent, und die Funktion kennt den gleichen Balance-/Versionsstand
wie der Client.

## P4-07 — Freunde und Realtime erst nach Identitäts-/Datenschutz-Gate

- [ ] **Freundesmodell auf dem bestehenden Profil statt auf einer zweiten
  Identität aufbauen.**

Benötigt werden Anfrage, Annahme, Entfernen, Online-/Offline-Status, Rekord und
optional Coin-Anzeige. P4-06 und P4-08 sind Vorbedingungen, damit keine
manipulierbare öffentliche Liste mit Kindernamen entsteht.

## P4-08 — Datenschutz, Moderation und öffentliche Reichweite entscheiden

- [ ] **Vor einer Veröffentlichung außerhalb der Familie eine belastbare
  Rechts- und Produktentscheidung treffen.**

Dann gehören mindestens Datenschutzerklärung, Lösch- und Exportweg,
Auftragsverarbeitung, Eltern-/Alterskonzept, Alias-Moderation,
Reservierte-/Schimpfwortfilter, Rate-Limits und Begrenzung von Login-, Sync-
und Duel-Code-Versuchen dazu. Die aktuelle Nutzung bleibt bewusst im engen
Familienkreis; das ist ein Gate, kein akuter Feature-Blocker.

## P4-09 — Rekord-Meldungen und Push

- [ ] **Rekord im laufenden Spiel/Ergebnis sichtbar melden; Push erst danach
  entscheiden.**

Eine lokale Meldung braucht keine öffentliche Reichweite. Web-Push für
installierte Apps braucht Einwilligung, Geräteverwaltung, Datenschutz und
eine klare Begrenzung, damit ein Spiel nicht nervt.

## P4-10 — Nähe-Erkennung als Machbarkeitsprüfung

- [ ] **Automatischen Duellbeitritt zunächst nur recherchieren und prototypisch
  auf den echten iPhones prüfen.**

Web Bluetooth, lokale Netzwerkerkennung und Audio-Beacon haben sehr
unterschiedliche iOS-Safari-Grenzen. Erst Browser-/iOS-Unterstützung und
Berechtigungen prüfen; erst danach eine Technik auswählen. Der sechsstellige
Raumcode bleibt bis dahin der verlässliche Fallback.

---

# Phase 5 — Qualität, Accessibility und Betrieb (P2)

## P5-01 — Tests über Browser-Grenzen sinnvoll erweitern

- [x] **Ablauflogik aus `MenuScene`/`SyncScene` schrittweise in testbare Systeme
  ziehen.**

Nicht die Phaser-Scene künstlich im Node-Test laden. Stattdessen Entscheidungen
wie „Remote ahead“, „Retry planen“, „Sync drosseln“, „bei Logout abbrechen“ in
reine Helfer/Systeme verschieben. `SyncDecisionSystem` ist ein möglicher
Schnitt, kein fest beschlossener Klassenname.

**Abnahme:** Entscheidungslogik ist ohne Canvas testbar; die Scene orchestriert
nur UI und Lebenszyklus. Kein großer Umbau ohne konkreten Fehlerfall.

**Erledigt 2026-08-21:** `SyncFlowSystem.ts` kapselt Codevalidierung,
Busy-Schutz, Phasenwechsel und Redeem-Entscheidung. `SyncScene` orchestriert
weiterhin Darstellung und Netzaufrufe; `SyncFlowSystem.test.ts` prüft den
Ablauf ohne Phaser/Canvas.

## P5-02 — Konfiguriertes Backend und Netzwerk-Matrix testen

- [x] **Die bestehende `CloudSystem.configured.test.ts` um die noch fehlenden
  Fehler- und RPC-Verträge ergänzen.**

Der alte Audit-Punkt „13 von 30 Exporten ohne Test“ ist durch eine konfigurierte
Suite teilweise überholt. Nicht die alte Zahl übernehmen, sondern aktuelle
Lücken aus dem Modulvertrag schließen: Timeout, Auth-Fehler, RPC-Fehler,
idempotente Wiederholung, abgelaufene Codes und unerwartete Nutzlasten.

`CloudSystem.contract.test.ts` prüft jetzt unerwartete RPC-Formen, fehlende
Spielstanddaten, Array-/Objektantworten sowie `NaN`/`Infinity`. `fetchSave`,
Profil-RPCs und Admin-Dashboard verwenden dieselben Normalizer; ein kaputter
Vertrag wird als Ergebnisfehler behandelt und nie in Progression/UI gereicht.
Die konfigurierte Suite deckt weiterhin Auth-Fehler, Timeout und Netzabbruch
ab. Echte Funkloch-Messungen auf iPhone bleiben ein manueller Release-Schritt,
weil dafür eine angemeldete reale Backend-Session und ein kontrollierter
Netzwechsel nötig sind.

## P5-03 — Migrationen und Spielstände robust gegen Zufallsdaten machen

- [x] **Property-/Fuzz-Tests für `migrate()` und `reconcile()` ergänzen.**

Testdaten brauchen fehlende Felder, alte SAVE-Versionen, negative/zu große
Werte, doppelte Achievements, ungültige Shopbesitze, kaputte JSON-Typen und
abgebrochene Outbox-Ereignisse. Die Migration darf nicht still Coins oder
Talente vervielfachen.

**Erledigt 2026-08-21:** `SaveSystem.fuzz.test.ts` erzeugt 250
deterministische beschädigte Payloads und prüft Versions-, Zahlen-, Relikt-,
Talent- und Shop-Invarianten. `reconcile()` filtert jetzt Typen, begrenzt
Zahlen, dedupliziert Listen und setzt ungültige Ausrüstung auf besessene
Defaults zurück; die Aura-Felder sind eingeschlossen.

## P5-04 — Production-Artefakt und Visual Regression prüfen

- [x] **Smoke-/Playtests mindestens einmal gegen `dist`/Preview ausführen.**

Dev-Server und Production-Build unterscheiden sich bei relativen Assets,
Version, Manifest, Cache und Code-Splitting. Für Start, ersten Run,
Schweifstufen, Talent, Shop, Ergebnis, Tageslauf und Duellstatus feste
Screenshot-Zustände definieren.

**Erledigt 2026-08-21:** `npm run production:check` baut zuerst den echten
Production-Stand, startet `vite preview`, prüft `version.json`, Manifest,
Canvas, Titel und Browserfehler auf iPhone-13- und Desktop-Viewport und legt
feste Start-Screenshots plus JSON-Bericht unter
`playtest-shots/production/` ab. Die vorhandenen Dev-Playtest-Suiten liefern
weiterhin die tieferen Spielzustands-Screenshots; der Production-Gate bleibt
bewusst ohne das nur im Dev-Build exportierte `window.isiHunt`.

## P5-05 — Mobile Performance messen

- [x] **Performance-Budgets für einen 90-Sekunden-Run definieren.**

Zu messen sind Startzeit, Framezeit, aktive GameObjects, Partikel,
Speicher, Akku/Hitze und Verhalten nach wiederholten Runs. `preserveDrawingBuffer`
hilft Debug-Screenshots, kann aber Produktionskosten haben; Debug- und
Produktionspfad getrennt bewerten. Seltene Scenes dürfen erst nach Messung
lazy geladen werden.

**Erledigt 2026-08-21:** `PerformanceSystem` misst startupMs, Frame-P95,
Frames über Budget, dynamische Run-Objekte und Partikelgruppen. Das Gate liegt
bei 20 s Scene-Start inklusive Countdown, 25 ms Frame-P95, höchstens 2 %
Über-Budget-Frames, 24 dynamischen Objekten und 18 Partikelgruppen.
`npm run performance:check` führt den deterministischen schnellen
Integrationslauf aus; `npm run performance:realtime` startet den echten
90-Sekunden-Realtime-Lauf für Desktop-/Gerätevergleich.
Der Runner gibt zusätzlich verfügbaren JS-Heap und Battery-Status aus. Hitze
ist über Web APIs nicht zuverlässig messbar und bleibt ein echter Gerätecheck.
Der aktuelle headless CI-Container rendert Phaser nur mit etwa 6–7 FPS,
obwohl Objekt-/Partikelpeaks niedrig bleiben; dieser Realtime-Wert ist daher
ein Umgebungsbefund und kein belastbarer Gerätewert. Für die Releasebewertung
ist der Realtime-Befehl auf einem echten iPhone/Android bzw. einem sichtbaren
Desktop-Browser auszuführen.
`preserveDrawingBuffer` ist im Production-Build jetzt deaktiviert und nur im
DEV-Build für Debug-Screenshots aktiv.

## P5-06 — Accessibility und Lesbarkeit als System prüfen

- [x] **Reduced Motion, Kontrast, Farbsehvarianten, Schriftgröße und Touchziele
  als zusammenhängendes Paket umsetzen.**

Seltenheit, Talentwirkung und Hindernis dürfen nicht nur über Farbe erkennbar
sein. Blinkeffekte, Partikel, Bildschirmimpulse und schnelle Tweens brauchen
eine reduzierte Variante. Kleine Weltpfeile und sekundäre Aktionen müssen die
Fingerzielgröße einhalten.

`AccessibilitySystem` bündelt Reduced-Motion-/Kontrast-Abfragen, 44-px-
Touchzielgarantie und nicht farbgebundene Raritätsmarker. Blinkende Relikte,
Puls-/Spawn-Tweens, Schiffspuls, Partikelburst, Schockwelle, Driftlayer und
Kameraimpulse haben eine reduzierte Variante; Ergebniszeilen zeigen Marker
zusätzlich zur Farbe. HTML-Safe-Area und Orientierungs-Hinweis reagieren auf
Reduced Motion und höheren Kontrast. Die bestehenden FontSize-Werte bleiben
zentral in `ui/theme.ts`; größere Systemschrift-/Einhandoptionen bleiben als
separater Content-Schritt offen.

## P5-07 — Audio, Haptik und Feedback-Hierarchie ordnen

- [x] **Rückmeldungen priorisieren, bevor weitere Effekte hinzukommen.**

`FeedbackSystem` priorisiert UI, normale/seltene/legendäre Fänge, Combo,
Hindernis, Run-Start und Run-Ende und unterdrückt unmittelbar nach einem
hochwertigen Ereignis den Tonhaufen aus Kleinsignalen. `HapticsSystem` ist
optional, browser-sicher und unabhängig vom Ton schaltbar; die Einstellungen
zeigen jetzt getrennte TON- und HAPTIK-Schalter. Fällt Haptik aus, bleiben
Audio und visuelles Feedback bestehen. Die Intensität bleibt pro Ereignis in
der zentralen Policy statt als verteilte Magic Numbers.

## P5-08 — UI-Texte und Content-Daten zentralisieren

- [ ] **Begriffe, Textkatalog und Content-Validierung ordnen.**

Run, Serie/Combo, Rang/Level, Coins, Relikt, Talent, Profil und Bestwert
brauchen einen verbindlichen Wortkatalog. Welt-, Talent-, Raritäts-, Shop- und
Achievementdaten sollen auf doppelte IDs, fehlende Texte, Preise, Zeichen-
funktionen, zu lange Labels und ungültige Freischaltungen geprüft werden.

## P5-09 — SQL-Migrationsprozess formalisieren

- [ ] **Aus einzelnen `phase_2_x.sql`-Dateien einen nachvollziehbaren
  Produktionsprozess machen.**

Ein Migrationslog oder eine `schema_migrations`-Tabelle soll Version, Datum,
Umgebung, Hash/Commit, Ausführender und Ergebnis dokumentieren. Destruktive
Cleanup-Skripte bleiben getrennt. Rollback-Hinweise und Vorbedingungen müssen
bei neuen Migrationen im Header stehen.

## P5-10 — PWA-Offlinebetrieb und Updates gezielt entscheiden

- [ ] **Service Worker nur bei einem belegten Bedarf einführen.**

Das Manifest macht die App installierbar, ersetzt aber keinen Service Worker.
Zuerst P0-05 auswerten. Falls die Home-Bildschirm-App weiter alte Bundles lädt,
App-Shell, gehashte Assets, `updateViaCache: 'none'`, Cache-Version und
„Update erst im Menü/Ergebnis“ entwerfen. Niemals während eines laufenden Runs
automatisch reloaden.

## P5-11 — Konto-, Daten- und Diagnose-Lebenszyklus vervollständigen

- [ ] **Abmeldung, lokaler Reset, Cloud-Löschung, Export und Outbox-Verhalten
  eindeutig machen.**

Ein Reset darf nicht durch eine ausstehende Outbox rückgängig gemacht werden.
Debug- und Share-Reports dürfen keine Tokens, PINs oder unnötigen persönlichen
Daten enthalten. Für eine Veröffentlichung außerhalb der Familie werden diese
Wege verpflichtend; im Familienbetrieb zunächst dokumentieren und testen.

## P5-12 — Lizenzgeprüfte Audio-Assets und austauschbare Soundmodule

- [x] **Kostenlose, rechtssicher nutzbare Sounds recherchieren, integrieren und
  die Audioarchitektur als austauschbaren Adapter aufbauen.**

**Erledigt 2026-08-22:** Der CC0-UI-Klick ist integriert und in
`docs/SOUND_ASSETS.md` mit Quelle, Lizenz und SHA-256 inventarisiert.
`SoundModuleChain` und `SampledSoundModule` kapseln den Provider; ein noch
nicht geladenes oder fehlendes Sample faellt sofort auf den prozeduralen
WebAudio-Klick zurueck. Weitere Ereignisse bleiben bewusst prozedural, bis
weitere konkrete Dateien separat abgenommen sind.

Der aktuelle `SoundSystem`-Stand erzeugt alle Rückmeldungen prozedural über
WebAudio. Das bleibt der sichere Fallback. Für zusätzliche UI-, Fang-,
Level-Up- und Weltklänge werden zunächst nur Assets verwendet, deren konkrete
Datei-Lizenz und Herkunft dokumentiert sind. „Kostenlos“ reicht nicht aus:
CC0 ist der bevorzugte Standard; CC-BY ist nur mit sauberer Attribution
zulässig, CC-BY-NC wird ausgeschlossen. Geeignete Recherchequellen sind
Kenney-CC0-Packs, einzelne CC0-Dateien auf OpenGameArt und einzelne
Freesound-Dateien mit explizitem CC0-/CC-BY-Nachweis.

**Architekturziel:** Spielereignisse kennen nur logische Audioereignisse wie
`ui.click`, `collect.rare`, `combo.tier`, `run.end` und `level.up`. Ein
`SoundModule`-Vertrag kapselt Laden, Abspielen, Stoppen, Lautstärke,
Diagnose und `shutdown()`. `SoundSystem` bleibt die öffentliche Fassade und
delegiert an ein aktives Modul. Das bestehende `ProceduralSoundModule` bleibt
Fallback; ein späteres `SampledSoundModule` kann über eine Zuordnung/Manifest
eingesetzt werden, ohne Scenes oder Gameplay-Systeme zu ändern.

**Vorgehen:**

1. `docs/SOUND_ASSETS.md` pro Datei mit Quelle, Autor, Lizenz, URL, Download-
   datum, Hash und Attribution pflegen.
2. Einen kleinen CC0-Pilot für UI, Reliktfang und Level-Up auswählen; keine
   großen Musikdateien und keine unklaren „royalty free“-Archive übernehmen.
3. Adapter/Fallback implementieren und Ladefehler lautlos auf prozedurale
   Klänge zurückfallen lassen.
4. TON-, HAPTIK-, Reduced-Motion- und iOS-Audio-Unlock-Regeln beibehalten.
5. Event-Mapping, Lizenzinventar, Bundlegröße und fehlende Dateien testen.

**Abnahme:** Ein Soundmodul kann per Konfiguration gewechselt werden; der
Spielablauf importiert keine konkreten Audio-Dateien. Jeder verwendete Sound
ist lizenzbelegt, der Pilot klingt im Ergebnisbildschirm/Run sinnvoll, ein
fehlendes oder gesperrtes Asset bricht keinen Run ab, `npm run verify` bleibt
grün und `docs/SOUND_ASSETS.md` enthält die vollständige Attribution.

## P5-13 — Ego-Modul: freie Designs und Aura-Animationen

- [x] **Lizenzgeprüfte Schiffsdesigns und Aura-Animationen recherchieren,
  integrieren und über austauschbare Asset-Module verwalten.**

**Erledigt 2026-08-22:** Der Shop enthaelt 110 Formen: 100 prozedurale
Silhouetten, `cc0-scout` und neun CC0-3D-Piloten aus dem dokumentierten
OpenGameArt-Schiffspack. Die Prismaflut nutzt sechs dokumentierte CC0-
Aura-Frames. `EgoAssetRegistry` liefert externe Provider ueber stabile IDs;
Shopvorschau, Player und Fallback verwenden dieselbe Zuordnung. Die 3D-
Modelle werden in `ThreeDShipPreview` lazy und nur in der Shopvorschau geladen;
bei WebGL-, Lade- oder Formatfehlern bleibt die 2D-Fallback-Silhouette aktiv.

Mit „Ego-Modul“ ist die sichtbare Schiffsidentität gemeint: Formen aus
`src/ui/shipShapes.ts`, Farben und Besitz aus `src/config/shop.ts`, Aura-
Animationen aus `src/ui/shipAnimations.ts` sowie die Darstellung in
`src/entities/Player.ts`, Shopvorschau und Ergebnis-/Profilansichten. Diese
Assets bleiben rein kosmetisch; sie dürfen keine Reichweite, Geschwindigkeit,
Score-, XP- oder Coin-Regel verändern.

**Recherche-Kandidaten:**

- [Kenney Particle Pack](https://www.kenney.nl/assets/particle-pack) für
  Glow-, Schub- und Aura-Partikel; die Assetseite nennt CC0.
- [Animated CC0 Space Ships](https://opengameart.org/content/animated-cc0-space-ships)
  für Spritesheet-/Schiffanimationen; die konkrete Seite nennt CC0.
- [Foozle Void – Main Ship](https://foozlecc.itch.io/void-main-ship) für ein
  Raumschiff mit animierten Triebwerken, Schilden und Waffen; die Seite nennt
  CC0 und erlaubt Bearbeitung auch für kommerzielle Projekte.
- [Gishadev 2D Space Game Pack](https://gisha.itch.io/2d-space-game-pack) für
  Schiffsvarianten und zwei Thruster-Animationen; die Seite nennt CC0.

Die Kandidaten sind keine pauschale Freigabe aller Plattforminhalte. Vor dem
Download muss der konkrete Asset-Eintrag geprüft und in
`docs/COSMETIC_ASSETS.md` mit URL, Autor, Lizenz, Download-Datum, Hash,
Attribution und geplanter Verwendung eingetragen werden. CC0 ist der
bevorzugte Standard; CC-BY braucht Attribution, CC-BY-NC wird ausgeschlossen.

**Architekturziel:** Die bestehenden stabilen Besitz- und Ausrüstungs-IDs
bleiben erhalten. `SHIP_SHAPES`/`SHIP_AURAS` enthalten Metadaten und Kosten,
aber keine untrennbaren Fremdasset-Pfade. Ein `EgoAssetModule` bzw. Provider-
Vertrag liefert eine normalisierte Form, Farbe, Aura-Frame oder Partikel-
Beschreibung. Eine prozedurale Fallback-Implementierung bleibt verfügbar;
weitere Provider können Sprite-Sheets, Vektorzeichnungen, Partikel oder
Shader-Animationen liefern. Ein Wechsel erfolgt über Manifest/Registry, ohne
`Player`, `TalentScene`, `ShopScene`, Save-Sync oder Progressionsregeln umzubauen.

**Vorgehen:**

1. Kandidaten in einem kleinen Stil-/Lizenzboard vergleichen; keine komplette
   fremde Bildsprache ungeprüft in die 100 Formen übernehmen.
2. Ein Pilotdesign und eine Pilot-Aura in allen vier Darstellungen prüfen:
   laufender Run, Shopvorschau, Profil und Ergebnisbildschirm.
3. Asset-Provider mit stabilen IDs, Fallback, Reduced-Motion-Standbild,
   Tint-/Glow-Kompatibilität und sauberem `shutdown()` integrieren.
4. Besitz, Preise, Sync und Migration unabhängig vom Rendering testen.
5. Nur nach iPhone-/iPad-Preview und Performancecheck weitere Assets einbauen.

**Abnahme:** Ein Asset-Modul kann per Registry/Manifest gewechselt werden;
kein Gameplay-Code importiert konkrete Assetdateien. Formen bleiben in
Bewegung lesbar, Auren verdecken keine Seltenheit oder Fangrückmeldung,
Reduced Motion liefert ein stabiles Standbild, externe Dateien sind
lizenzbelegt und `npm run verify` bleibt grün.

---

# Phase 6 — Native App und langfristiges Endgame (P3)

## P6-01 — Native-App-Voraussetzungen erst bei Web-Reife starten

- [ ] **Capacitor, Codemagic, TestFlight und Android-Test nach dem Web-Gate
  vorbereiten.**

Die Apple-Mitgliedschaft war beim letzten Check abgelaufen. Bei Start dieser
Phase zuerst Mitgliedschaft reaktivieren, dann Bundle-ID/App-Store-Eintrag,
API-Key sicher verwahren, Codemagic-Signing konfigurieren, Android-Test und
TestFlight-Gruppe klären. Keine Secrets in Git.

**Danach:** Capacitor-Wrapper, `ios/`, `capacitor.config.ts`,
`codemagic.yaml`, nativer Update-Hinweis und Gerätetests für Sound-Unlock,
Safe Area und `localStorage`.

## P6-02 — Dynamic Island / Live Activity

- [ ] **Live Activity erst als natives Feature nach P6-01 bauen.**

Eine Web-App kann die Dynamic Island nicht direkt steuern. Bis dahin bleibt
die Web-Safe-Area und die Restzeitanzeige ein Prototyp. Für die native Variante
zuerst minimale Live Activity mit Score und Restzeit während des gesamten Runs
definieren; dauerhafte Inhalte erst nach einem Test entscheiden.

## P6-03 — Prestige/Endgame ohne unbegrenzte Machtspirale

- [ ] **Wiedergeburt/Prestige erst nach validierter Level-100-Kurve konzipieren.**

Vor einer Umsetzung müssen Reset-Umfang, dauerhafter kosmetischer oder kleiner
Multiplikator, Schutz vor versehentlichem Auslösen, bestehende Profile,
Talente, Shop und Migration feststehen. Keine Lösung, die alte Welten für neue
Spieler entwertet oder unendliche Leistungssteigerung erzeugt.

## P6-04 — Boosts nur als bewusstes, nicht wettbewerbsverzerrendes System

- [ ] **Boosts bleiben zurückgestellt; bei Wiederaufnahme nur XP-/Coin-
  Fortschrittsboosts untersuchen.**

Tempo-, Reichweiten- oder Leistungsboosts würden die Vergleichbarkeit der
Rangliste und das Spielgefühl verändern. Jeder Boost braucht Ablaufdauer,
Offline-Regel, Missbrauchsschutz, UI-Erklärung und eine Balance-Entscheidung.

---

# Parkplatz — gute Ideen ohne nächste Priorität

Diese Punkte werden nicht vergessen, aber erst nach einem konkreten Anlass
hochgezogen:

- zusätzliche Achievement-Typen für riskante Spielweisen statt nur Mengen,
- Kaufprognose „ungefähr noch X normale Runs“ bei Talent und Shop,
- Shop-Filter nach neu, besessen, erschwinglich und Favorit,
- kombinierte kosmetische Vorschau mit Form, Farbe, Aura, Schweif und späteren
  Effekten,
- Loadouts/Favoriten für rein kosmetische Kombinationen,
- wechselnde Tages-/Wochenziele und Sammelalben nach Level 100,
- thematische Shop-Sets und kosmetische Abzeichen,
- zusätzliche Bot-Transparenz durch Ghost-Verlauf statt nur Endwert,
- `theme-color` je Menü-/Run-Zustand als Web-Annäherung an die Dynamic Island,
- Linkshänder-/Einhandmodus, falls die Geräteabnahme einen Bedarf zeigt,
- seltene Scenes lazy laden, falls das Performance-Budget gerissen wird,
- Realtime-Rangliste, sobald ein echter Nutzen und ein sicherer Scope vorliegen.

**Regel:** Ein Parkplatzpunkt wird nur dann zu einer aktiven Aufgabe, wenn ein
Spieltest, ein konkreter Nutzerwunsch, ein Sicherheitsbefund oder ein
Performance-Messwert seinen Nutzen belegt. Dann bekommt er eine eigene ID,
Priorität, Abhängigkeit und Abnahme.

---

# Entscheidungen, die nicht wieder aufgemacht werden sollen

| Entscheidung | Stand | Konsequenz |
| --- | --- | --- |
| Talente mit Coins statt Talentpunkten | **entschieden, ADR-0018** | Kein Talentpunkte-Umbau und keine Migration dafür. Die Darstellung bleibt die ehrliche unabhängige Liste (P2-01). |
| Welten unter dem eigenen Level sperren | **verworfen** | Gemeinsames Spielen und Duell bleiben möglich; höhere Welten motivieren über Belohnung. |
| Duell-Link als erster Netzwerkweg | **übersprungen** | Raumcode/Realtime Phase 1 ist gebaut; Stabilität kommt vor weiteren Varianten. |
| Öffentliche Bestenliste | **nicht freigegeben** | Familienkreis bleibt der aktuelle Scope; Datenschutz/Moderation ist ein Gate. |
| Dynamic Island im Web | **nicht möglich** | Native Live Activity erst in Phase 6. |
| Boosts mit Leistungsänderung | **zurückgestellt** | Keine Vorteile, die Score-/Ranked-Vergleiche verfälschen. |
| Service Worker | **nicht automatisch bauen** | Erst Update-/Offline-Bedarf auf echten Geräten belegen. |

---

# Erledigt und als Beleg archiviert

Diese Punkte sind abgeschlossen und werden nicht erneut als offene Aufgaben
geführt. Details und Ursachen bleiben in den verlinkten Dokumenten bzw. in der
Git-Historie.

- **Bedienbarkeit:** einheitliche Zurück-Navigation, Pause, Run verlassen,
  große Trefferflächen, Safe Area, Pixel-Lineal und sichtbare Version.
- **Auslieferung:** Pre-Commit-Versionserhöhung, Pre-Push-Verify,
  `index.html`-Cache-Regeln, Versionsanzeige im DOM und automatischer
  GitHub-Pages-Deploy.
- **Debugging:** Ringpuffer, persistenter Debug-Report, Screenshot/Share,
  Audio-Diagnose und iPhone-Bestätigung; die historische Sync-Fehlersuche ist
  als Ursachenbeleg in der Git-Historie nachvollziehbar.
- **Profil:** Alias-Login, Profilidentität, Offline-Outbox, idempotente
  Ereignisse, Zusammenführung von XP/Coins/Erfolgen/Bestwert und Retry-Pfade
  sind implementiert; die reale Mehrgeräteabnahme ist P0-02.
- **Weltraum:** Raumschiff, Planeten, Raumzonen, Weltenmultiplikatoren,
  Textur- und Level-Skins sind umgesetzt.
- **Belohnung:** Score-Popups, Combo, Coins, Level-Belohnungen, Talente,
  Reset, Shop und Achievement-Belohnungen sind umgesetzt.
- **Balance-Kette:** `src/config/balance-data.json`,
  `src/config/balance.ts`, `scripts/sync-balance-sql.mjs` und
  `supabase/phase_2_14_balance_chain.sql` bilden die zentrale Ableitung.
  Die Gate- und Baseline-Aufgaben stehen in P3-01 bis P3-04.
- **Phase 5:** Tageslauf, Bot-Duell, Weltmodifikatoren, Hindernisse und
  World-Info-Screen sind gebaut; echte Zielgruppen-Balance ist P0-04/P1-01.
- **Shop:** 100 Fluggestalten, Farben und Vorschau sind ausgeliefert; echte
  Sichtbarkeit in einem laufenden Run ist Teil von P0-04.
- **Netzwerk-Duell:** Raumcode, Ready, gemeinsame Startzeit, Presence und
  Ergebnisvergleich sind gebaut; der Slave-Test bleibt P0-03.
- **Testlücken, die inzwischen geschlossen wurden:** Die konfigurierte
  `CloudSystem`-Suite und der Mehrere-Ereignisse-Test für die Outbox existieren
  bereits. Die alte Audit-Zahl „13 von 30 ohne Test“ ist deshalb kein aktueller
  Arbeitsauftrag mehr; aktuelle Lücken gehören in P5-02.

## Relevante Dokumente

- [Architektur](docs/ARCHITECTURE.md) — Szenen, Systeme, Datenfluss und Tests
- [Spielregeln](docs/GAME_DESIGN.md) — Run, Score, Progression und Welten
- [Balance-Kette](docs/BALANCE_CHAIN.md) — zentrale Rohwerte und Ableitungen
- [Entscheidungen](docs/DECISIONS.md) — ADRs, insbesondere ADR-0018
- [Roadmap](docs/ROADMAP.md) — Produktmeilensteine; bei Widerspruch zuerst
  P0-06 aktualisieren
- [Code-Stil](docs/CODE_STYLE.md) — Definition of Done und Testregeln
- [Audit 2026-08-17](docs/AUDIT_2026-08-17.md) — technischer Audit-Kontext

## Release-Befehle

```text
npm run balance:sync
npm run verify
git diff --check
git push origin main
npm run deploy:wait
```

Für eine SQL-Änderung zusätzlich den SQL-Editor-Schritt aus **P0-01**
dokumentieren. Ein grüner Frontend-Build beweist nicht, dass die Supabase-
Migration ausgeführt wurde.
