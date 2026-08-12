# Roadmap — isiHunt

**Stand:** 2026-08-12

Meilensteine sind nach *spielbarem Wert* geordnet, nicht nach technischem
Aufwand. Jeder Meilenstein endet mit etwas, das man in die Hand nehmen kann.

---

## M0 — Fundament ✅ *(abgeschlossen)*

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

## M1 — Spielgefuehl *(als naechstes)*

Der Prototyp funktioniert. Jetzt muss er sich **gut** anfuehlen.

- [ ] Auf echten Geraeten testen (verschiedene Groessen, iOS + Android)
- [ ] Balancing nach dem ersten echten Spieltest nachziehen
- [ ] Vibrations-Feedback bei seltenen Faengen (`navigator.vibrate`)
- [ ] Pause-Bildschirm mit sichtbarem Knopf statt nur Debug-Taste
- [ ] Erster Start: dezente Einfuehrung ohne Textwand
- [ ] Bildschirmschoner / Sperre waehrend eines Runs verhindern (Wake Lock)
- [ ] Verhalten beim Wegwischen der App (Run pausieren statt weiterlaufen)

## M2 — Talente & Charakter

Der Fortschritt bekommt seine Oberflaeche.

- [ ] Talent-Bildschirm mit Punktevergabe
- [ ] Talente zuruecksetzen
- [ ] Erfolgsuebersicht mit Fortschrittsanzeige
- [ ] Statistik-Bildschirm (Runs gesamt, Relikte gesamt, beste Kette)
- [ ] **Vitest einrichten** — `ProgressionSystem`, `ScoreSystem`,
      Achievement-Praedikate sind bereits reine Logik und sofort testbar
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
- [ ] App-Icon, Startbildschirm, PWA-Manifest ("Zum Startbildschirm")
- [ ] Ladebildschirm, sobald es etwas zu laden gibt

## M5 — Teilen & Wettbewerb

- [ ] Ergebnisbild zum Teilen erzeugen
- [ ] Lokale Bestenliste je Welt
- [ ] Online-Bestenliste (Backend-Entscheidung noch offen)
- [ ] Spielstand geraeteuebergreifend

## M6 — Als App

- [ ] Capacitor einrichten
- [ ] Android-Build
- [ ] iOS-Build
- [ ] Store-Material (Beschreibung, Bilder, Datenschutz)

---

## Nicht geplant

Damit die Roadmap ehrlich bleibt:

- **Mehrspieler in Echtzeit** — passt nicht zur 60-Sekunden-Schleife.
- **Werbung / In-App-Kaeufe** — erst wenn das Spiel ohne sie ueberzeugt.
- **Querformat** — das Spiel ist fuer eine Hand gebaut.
- **Desktop-Version als eigenes Produkt** — der Browser reicht.
