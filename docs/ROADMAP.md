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
- [ ] Auf echten Geraeten testen (verschiedene Groessen, iOS + Android)
- [ ] Balancing nach dem ersten echten Spieltest nachziehen
- [ ] Vibrations-Feedback bei seltenen Faengen (`navigator.vibrate`)
- [ ] Pause-Bildschirm mit sichtbarem Knopf statt nur Debug-Taste
- [ ] Erster Start: dezente Einfuehrung ohne Textwand
- [ ] Bildschirmschoner / Sperre waehrend eines Runs verhindern (Wake Lock)
- [ ] Verhalten beim Wegwischen der App (Run pausieren statt weiterlaufen)

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

- [ ] Talent-Bildschirm mit Punktevergabe
- [ ] Talente zuruecksetzen
- [ ] Erfolgsuebersicht mit Fortschrittsanzeige
- [ ] Statistik-Bildschirm (Runs gesamt, Relikte gesamt, beste Kette)
- [ ] **Vitest einrichten** — `ProgressionSystem`, `ScoreSystem`,
      `ChallengeSystem` und die Achievement-Praedikate sind reine Logik und
      sofort testbar
- [ ] **Test fuer den Duell-Determinismus** — dass zwei Durchgaenge mit
      gleichem Seed dieselbe Relikt-Abfolge liefern, bricht sonst unbemerkt
      bei der naechsten Aenderung am Spawning (ARCHITECTURE.md 4.1)
- [ ] Level-Aufstieg im Run feiern, nicht erst im Ergebnis

## M3 — Welten mit Charakter

Bisher unterscheiden sich die Welten nur farblich.

- [ ] Weltmodifikatoren implementieren (siehe GAME_DESIGN.md, 7.3)
- [ ] Eigene Hintergrundelemente je Welt (Parallax)
- [ ] Weltspezifische Seltenheitsverteilungen pruefen
- [ ] Zweiter Spielmodus: Endlos ohne Timer
- [ ] Tages-Herausforderung mit festem Seed

## M4 — Anmutung

Aus dem Prototyp wird ein Produkt.

- [ ] Echte Grafiken statt prozeduraler Platzhalter
- [ ] Eigene Schrift statt System-Font
- [ ] Ton: Fang-Sounds je Seltenheit, Level-Aufstieg, Hintergrundmusik
- [ ] Ton stummschaltbar, Zustand gespeichert
- [x] App-Icon und PWA-Manifest ("Zum Home-Bildschirm") — in M1 vorgezogen
- [ ] Startbildschirm der installierten App (Splash Screen)
- [ ] Ladebildschirm, sobald es etwas zu laden gibt

## M5 — Teilen & Wettbewerb _(teilweise fertig)_

- [x] **Online-Bestenliste je Welt** ueber Supabase, Top 10
- [x] **Spielstand geraeteuebergreifend** per Sync-Code, ohne Konto
- [x] Konflikt zweier Spielstaende wird gezeigt statt still entschieden
- [ ] Ergebnisbild zum Teilen erzeugen
- [ ] Duell ueber zwei Geraete per geteiltem Link (ADR-0010, Schritt 1)
- [ ] Echtzeit-Duell ueber Netzwerk (ADR-0010, Schritt 2)
- [ ] **Punkte serverseitig bewerten** — solange das fehlt, ist die
      Bestenliste manipulierbar (ADR-0011). Vor jeder oeffentlichen Bewerbung
      der Liste noetig.
- [ ] Spielstaende zusammenfuehren statt ersetzen

## M6 — Als App

- [ ] Capacitor einrichten
- [ ] Android-Build
- [ ] iOS-Build
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
