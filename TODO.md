# TODO — offene Arbeiten

**Stand:** 2026-08-13 · abgeleitet aus dem Spieltest-Feedback von Emre (11) und
Simay (9)

Der vollstaendige Plan mit Begruendungen steht im Umbauplan; hier die
Arbeitsliste. Reihenfolge nach Nutzen, nicht nach Aufwand.

---

## ZUERST — Ursache geklaert: das Handy lief nie auf dem korrigierten Stand

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

**Offen:**

- [ ] Auf dem Handy gegenpruefen — **zuerst die Versionsnummer unten rechts
      ablesen.** Steht dort nicht die aktuelle, ist der Deploy das Problem und
      nicht der Code.
- [ ] Erst wenn die Version stimmt und es weiterhin hakt: `?hitboxes` oeffnen
      und einen Fehlgriff abfotografieren

---

## Phase 1 — Bedienbarkeit _(fertig bis auf den Knopf-Fehler)_

- [x] Einheitlicher Zurueck-Knopf oben links (`createBackButton`)
- [x] Zurueck-Knopf der Bestenliste aus dem Bereich des Namensfeldes geholt
- [x] Pause und "Run verlassen" im laufenden Spiel
- [x] iOS-Vollbildhinweis in einem eigenen Kasten
- [x] Weltenauswahl der Bestenliste von 12 auf 50 CSS-px vergroessert
- [x] Versionsnummer im Menue (damit Test-Rueckmeldungen zuordenbar sind)
- [ ] **Auf dem Geraet der Kinder gegenpruefen** ← Voraussetzung fuer Phase 2

## Phase 2 — Identitaet, Spielzeit, Fortschritt

- [ ] Profil: Name beim ersten Start abfragen, Icon dazu, in Einstellungen
      aenderbar
- [ ] Name im Startmenue anzeigen
- [ ] Namensfeld aus der Bestenliste entfernen (zieht ins Profil)
- [ ] Levelanzeige nicht mehr direkt im Menue, sondern erst hinter "Jagd
      beginnen" — das Menue soll mit Name und Spielstart oeffnen, nicht mit
      einer Statistik
- [ ] `RUN_DURATION_MS` 60 s → 90 s
- [ ] Designziel 2 in `GAME_DESIGN.md` anpassen ("in 60 Sekunden gespielt")
- [ ] XP-Kurve: `floor(80 · n^1.45)` → `floor(750 · √n)`
- [ ] `MAX_LEVEL = 100`, Deckelung in `ProgressionSystem.applyRun()`
- [ ] **Bestenliste leeren** (Eingriff in Supabase — Eintraege sind auf
      Rechteebene unveraenderlich, kein Knopf im Spiel)
- [ ] XP-Tabelle in `GAME_DESIGN.md` 7.1 ersetzen

**Zielwerte, nachgerechnet:** Level 10 nach 16 Runs ≈ 29 min · Level 100 nach
560 Runs ≈ 17 h · Grundlage 900 XP je 90-s-Run, 110 s je Durchgang.

**Offen:** Was passiert mit ueberschuessigen Talentpunkten? 99 Punkte stehen 32
Talentraengen gegenueber — ab etwa Level 33 ist alles ausgebaut. Vorschlag:
Ueberschuss wird zu Coins (Phase 4).

## Phase 3 — Themenwechsel ins Weltall

- [ ] ADR-0013: Themen- und Zielgruppenwechsel (mit verworfener Alternative)
- [ ] `tex-player-core`: Raumschiff statt vierzackiger Stern
- [ ] Relikte als Planeten (Rotation als Illusion — Phaser ist 2D)
- [ ] Hintergrund: Sternenfelder, Nebel, Planeten je Welt
- [ ] Skins fuer die Figur, freigeschaltet ab Level 5/15/30/50/75/100
- [ ] `worlds.ts`: Fantasy-Namen → Weltraum-Regionen
- [ ] `GAME_DESIGN.md`: Pitch, Zielgruppe, Referenz
- [ ] `ART_STYLE.md`: Formensprache, Assets, Welten-Farbtabelle

> **Unantastbar:** Die sechs Seltenheitsfarben. Texturen bleiben weiss und
> werden getintet — farbige Planeten brechen das Seltenheitssystem.

## Phase 4 — Belohnung

- [ ] Punkte-Popup auffaelliger (`floatingScore` existiert, ist zu dezent)
- [ ] Serien-Bonus: drei gleiche Seltenheiten → doppelte Punkte, ab Gruen
- [ ] Coin-System: Feld im Spielstand, Anzeige, Quellen (Run + Erfolge +
      ueberschuessige Talentpunkte)
- [ ] Talentbaum-Oberflaeche (Logik existiert, im Menue steht "Vergabe folgt")
- [ ] Talente zuruecksetzen
- [ ] **Vitest einrichten** — vor der XP-Kurve waere es besser gewesen

## Phase 5 — Herausforderung

- [ ] Tages-Herausforderung mit festem Seed (Technik steht seit dem Duell)
- [ ] Duell gegen Bot mit Fehlerrate je Schwierigkeitsgrad
- [ ] Weltmodifikatoren umsetzen (stehen als `plannedModifier` in `worlds.ts`)
- [ ] Hindernisse: bremsend in fruehen Welten, bestrafend in spaeten
- [ ] `GAME_DESIGN.md` §10 praezisieren (nicht streichen): kein Misserfolg in
      den Einstiegswelten
- [ ] ~~Ranked-Modus~~ — blockiert, siehe Phase 6

## Phase 6 — Sozial

- [ ] Zeitstempel in der Bestenliste (`createdAt` wird bereits geladen)
- [ ] **Punkte serverseitig bewerten** (Supabase Edge Function, Run nachspielen)
      — Vorbedingung fuer Ranked und Rekord-Meldungen
- [ ] Realtime-Sync der Bestenliste
- [ ] ADR-0014: dauerhafte Identitaeten fuer die Freundesliste (kehrt ADR-0011
      "kein Konto" teilweise um)
- [ ] Freundesliste mit Online/Offline, Rekord, Coins
- [ ] Duell per geteiltem Link (ADR-0010 Schritt 1)
- [ ] Rekord-Meldung im laufenden Spiel; echte Push-Meldung nur fuer
      installierte Web-Apps (iOS-Grenze)

---

## Aufraeumen

- [ ] `src/ui/hitDebug.ts` entfernen, sobald der Knopf-Fehler bestaetigt behoben
      ist — es ist ein Diagnosewerkzeug, kein Feature
- [ ] `ideen.txt` in die Roadmap ueberfuehren oder loeschen
