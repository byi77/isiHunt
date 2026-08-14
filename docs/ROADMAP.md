# Roadmap — isiHunt

**Stand:** 2026-08-12

Meilensteine sind nach _spielbarem Wert_ geordnet, nicht nach technischem
Aufwand. Jeder Meilenstein endet mit etwas, das man in die Hand nehmen kann.

---

## M0 — Fundament ✅ _(abgeschlossen)_

Das Geruest steht und ist spielbar.

- [x] Projektstruktur, TypeScript strict, Vite, ESLint, Prettier
- [x] Gesamte Dokumentation angelegt
- [x] GitHub-Vorbereitung: CI, Pages-Deployment, PR-Vorlage
- [x] Prozedurale Texturen — keine Asset-Abhaengigkeit
- [x] Steuerung: Touch + Tastatur
- [x] Seltenheiten, Spawning, Combo, Punkte
- [x] XP, Level, Talentpunkte, Erfolge, Weltenfreischaltung
- [x] Menue, Run, HUD, Ergebnis
- [x] Persistenz ueber `localStorage`, versioniert
- [x] Debug-Tasten im Dev-Build

## M1 — Spielgefuehl _(laufend)_

Der Prototyp funktioniert. Jetzt muss er sich **gut** anfuehlen.

- [x] Grafische Aufwertung: Facetten-Relikte, Strahlenkranz, Schockwelle,
      Lichtspur, Hintergrund in Schichten, Vignette
- [x] Vollbild ohne Adressleiste (Fullscreen-API + PWA-Installation)
- [x] App-Icon und Manifest
- [x] **Erster Spieltest mit der Zielgruppe** (Kinder, 9 und 11) — die
      Rueckmeldungen haben mehr Bedienfehler zutage gefoerdert als jedes
      eigene Testen; die Ergebnisse stehen unten unter M1.6
- [ ] Auf weiteren Geraeten testen (verschiedene Groessen, Android)
- [ ] Balancing nach dem ersten echten Spieltest nachziehen
- [ ] Vibrations-Feedback bei seltenen Faengen (`navigator.vibrate`)
- [x] Pause-Bildschirm mit sichtbarem Knopf statt nur Debug-Taste
- [ ] Erster Start: dezente Einfuehrung ohne Textwand
- [ ] Bildschirmschoner / Sperre waehrend eines Runs verhindern (Wake Lock)
- [ ] Verhalten beim Wegwischen der App (Run pausieren statt weiterlaufen)

## M1.6 — Nach dem ersten Spieltest _(laufend)_

Der Prototyp wurde erstmals von der eigentlichen Zielgruppe gespielt. Die
Rueckmeldungen zerfielen in drei Sorten: Bedienfehler, Erweiterungswuensche und
Wuensche, die die Designgrundlage verschieben. Diese Phase raeumt die erste
Sorte auf.

- [x] **Knopf-Fehler behoben.** Ursache war die Auslieferung, nicht der Code:
      Auf dem Handy lief durchgehend v0.1.0, waehrend lokal laengst korrigiert
      war. Mit v0.1.3 auf dem Geraet gegengeprueft — die Knoepfe reagieren.
      Die Absicherung dagegen steht in `CODE_STYLE.md` 1.9.
- [x] Trefferflaechen werden am gemessenen Ursprung ausgerichtet statt
      berechnet (`makeAlignedHitArea`)
- [x] Druck-Effekt staucht nur noch die Grafik, nicht die Trefferflaeche
- [x] Zurueck-Knopf einheitlich oben links, als eigenes Widget
- [x] Zurueck-Knopf der Bestenliste aus dem Bereich des Namensfeldes geholt
      (HTML-Eingabefelder liegen immer ueber dem Canvas)
- [x] Pause und "Run verlassen" im laufenden Spiel
- [x] iOS-Vollbildhinweis in einem eigenen Kasten statt in der Fusszeile
- [x] Weltenauswahl der Bestenliste von 12 auf 50 CSS-px vergroessert
- [x] Versionsnummer im Menue, bei jedem Commit hochgezaehlt — damit
      Test-Rueckmeldungen einem Stand zuzuordnen sind
- [x] Diagnosewerkzeug `?hitboxes` fuer Trefferflaechen
- [ ] Ergebnis auf dem Geraet der Kinder gegenpruefen

Was aus demselben Spieltest folgt, aber groesser ist — Profil, Spielzeit,
XP-Kurve, Weltraum-Thema, Coins, Freundesliste — steht in den Meilensteinen
M2 bis M6.

## M1.5 — Duell _(neu, teilweise fertig)_

Ein Modus fuer zwei Personen.

- [x] Duell an einem Geraet, abwechselnd, 90 Sekunden je Durchgang
- [x] Gleicher Seed fuer beide — identische Relikt-Abfolge
- [x] Faire Bedingungen: keine Talente, keine Progression
- [x] Uebergabe- und Ergebnisbildschirm mit Revanche
- [x] Vorlage des Gegners im HUD, Ueberhol-Moment gefeiert
- [ ] Duell ueber zwei Geraete per geteiltem Link (ADR-0010, Schritt 1)
- [ ] Benannte Spieler statt "Spieler 1 / Spieler 2"

## M2 — Talente & Charakter

Der Fortschritt bekommt seine Oberflaeche.

- [x] Talent-Bildschirm mit Punktevergabe
- [x] Talente zuruecksetzen
- [ ] Erfolgsuebersicht mit Fortschrittsanzeige
- [ ] Statistik-Bildschirm (Runs gesamt, Relikte gesamt, beste Kette)
- [x] **Vitest einrichten** — `ProgressionSystem`, `ScoreSystem` und
      `ChallengeSystem` sind mit 62 Tests abgedeckt; `npm run test` haengt in
      `verify` und damit in `pre-push`, CI und Deploy
- [ ] **Test fuer den Duell-Determinismus** — dass zwei Durchgaenge mit
      gleichem Seed dieselbe Relikt-Abfolge liefern, bricht sonst unbemerkt
      bei der naechsten Aenderung am Spawning (ARCHITECTURE.md 4.1)
- [ ] Level-Aufstieg im Run feiern, nicht erst im Ergebnis

## M2.5 — Login & Mehrgeräte-Profil _(priorisiert)_

Der bisherige Sync-Code ist ein einmaliger Umzug. Für iPhone und iPad mit
demselben Profil braucht es ein Backend-Profil mit Login und eine
Zusammenführung statt des bisherigen vollständigen Ersetzens.

- [x] Supabase Auth mit Alias/Passwort und Profil-Tabelle; Supabase erhält
      dafür intern nur eine pseudonyme Auth-ID, keine echte Kontaktadresse
- [x] RLS- und RPC-Skript: jedes Profil sieht und ändert nur seine eigenen Daten
- [x] Offline-Outbox für Solo-Run-Ereignisse mit eindeutiger `event_id`
- [x] Serverseitige, idempotente Zusammenführung von XP, Coins, Erfolgen und
      Bestwerten
- [x] Migration des bestehenden `cloudId`-Profils ohne Fortschrittsverlust
- [ ] SQL-Migration in Supabase ausführen und mit echten Konten prüfen
- [ ] Paralleler iPhone-/iPad-Test mit Offline-Runs und Netzrückkehr

## M3 — Welten mit Charakter

Bisher unterscheiden sich die Welten nur farblich.

- [x] Weltmodifikatoren implementieren (siehe GAME_DESIGN.md, 7.3)
- [ ] Eigene Hintergrundelemente je Welt (Parallax)
- [ ] Weltspezifische Seltenheitsverteilungen pruefen
- [ ] Zweiter Spielmodus: Endlos ohne Timer
- [x] Tages-Herausforderung mit festem Seed

## M4 — Anmutung

Aus dem Prototyp wird ein Produkt.

- [ ] Echte Grafiken statt prozeduraler Platzhalter
- [ ] Eigene Schrift statt System-Font
- [x] Ton: Fang-Sounds je Seltenheit, Level-Aufstieg, Run-Ende und UI-Klicks
- [x] Ton stummschaltbar, Zustand gespeichert (Phase 3.5 vorgezogen)
- [x] App-Icon und PWA-Manifest ("Zum Home-Bildschirm") — in M1 vorgezogen
- [ ] Startbildschirm der installierten App (Splash Screen)
- [ ] Ladebildschirm, sobald es etwas zu laden gibt

## M5 — Teilen & Wettbewerb _(teilweise fertig)_

- [x] **Online-Bestenliste je Welt** ueber Supabase, Top 10
- [x] **Spielstand geraeteuebergreifend** per Sync-Code, ohne Konto
      _(bleibt als einmaliger Umzug und Migrationsweg erhalten)_
- [x] Konflikt zweier Spielstaende wird gezeigt statt still entschieden
- [ ] Ergebnisbild zum Teilen erzeugen
- [ ] Duell ueber zwei Geraete per geteiltem Link (ADR-0010, Schritt 1)
- [ ] Echtzeit-Duell ueber Netzwerk (ADR-0010, Schritt 2)
- [ ] **Punkte serverseitig bewerten** — solange das fehlt, ist die
      Bestenliste manipulierbar (ADR-0011). Vor jeder oeffentlichen Bewerbung
      der Liste noetig.
- [ ] Spielstaende dauerhaft ueber das gemeinsame Login-Profil zusammenfuehren
      _(M2.5, vor Phase 4 priorisiert)_

## M6 — Als App

- [ ] Capacitor einrichten
- [ ] Android-Build und APK-Test auf den eigenen Geraeten
- [ ] **iOS-Build ohne eigenen Mac:** macOS-CI/Cloud-Build einrichten
      (z. B. GitHub Actions mit macOS-Runner oder ein vergleichbarer Dienst)
- [ ] Apple-Developer-Konto sowie Zertifikate und Signierung fuer den iOS-Build
- [ ] **TestFlight einrichten** und die iOS-App auf dem eigenen iPhone und dem
      iPhone des Sohnes testen
- [ ] Store-Material (Beschreibung, Bilder, Datenschutz)

---

## Nicht geplant

Damit die Roadmap ehrlich bleibt:

- **Werbung / In-App-Kaeufe** — erst wenn das Spiel ohne sie ueberzeugt.
- **Querformat** — das Spiel ist fuer eine Hand gebaut.
- **Desktop-Version als eigenes Produkt** — der Browser reicht.
- **Geteilter Bildschirm im Duell** — zwei Spielfelder sind auf einem
  Hochformat-Handy zu klein (ADR-0008).

### Korrigiert

- ~~**Mehrspieler in Echtzeit** — passt nicht zur 60-Sekunden-Schleife.~~
  _(Stand 2026-08-12)_ Ueberholt. Das lokale Duell zeigt, dass ein Modus fuer
  zwei Personen sehr wohl passt — er ist nur laenger als die Solo-Schleife.
  Echtzeit ueber Netzwerk ist jetzt in M5 eingeplant, mit dem Link-Duell als
  guenstigerem Zwischenschritt (ADR-0010).
