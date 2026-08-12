# Changelog

Alle nennenswerten Aenderungen an isiHunt.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

Siehe [docs/ROADMAP.md](docs/ROADMAP.md), Meilenstein M1.

---

## [0.1.0] — 2026-08-12

Erster spielbarer Prototyp.

### Hinzugefuegt

**Spiel**

- Runs von 60 Sekunden mit Countdown
- Sechs Seltenheitsstufen von Schlicht bis Legendaer, mit eigenen Werten fuer
  Punkte, XP, Spawnrate, Lebensdauer, Tempo und Groesse
- Combo-System mit Multiplikator bis ×5; Zerfall ueber Zeit, nicht durch
  verpasste Relikte
- Spawn-System mit Verdichtung zum Run-Ende und Mindestabstand zur Figur
- Fuenf Welten mit eigener Farbstimmung, freigeschaltet ueber das Level

**Fortschritt**

- Charakterlevel mit XP-Kurve `floor(80 · n^1.45)`
- Talentpunkte pro Levelaufstieg
- Sieben Talente — Wirkung implementiert, Vergabe-UI folgt in M2
- 15 Erfolge, geprueft nach jedem Run
- Spielstand in `localStorage`, versioniert und gegen defekte Daten abgesichert

**Steuerung**

- Touch: Figur laeuft zum Finger, mit Abbremsen nahe am Ziel
- Tastatur: WASD und Pfeiltasten
- Debug-Tasten im Dev-Build (`1`–`6`, `L`, `K`, `J`, `P`, `0`)

**Darstellung**

- Alle Texturen prozedural erzeugt — keine Bilddateien
- Partikel beim Einsammeln, Kamera-Ruckler ab episch
- HUD mit Punktestand, Combo, Timer-Balken und Warnfaerbung
- Menue mit Charakteruebersicht und Weltenauswahl
- Ergebnisbildschirm mit Ausbeute, XP-Balken und Freischaltungen

**Technik**

- TypeScript strict, Phaser 3, Vite
- Typisierter EventBus zwischen Spiel- und HUD-Scene
- Kollision per Distanztest statt Physik-Engine
- Frameratenunabhaengige Bewegung
- ESLint, Prettier, EditorConfig
- GitHub Actions: CI und automatisches Pages-Deployment

**Dokumentation**

- Game Design Document, Architektur, Roadmap, Art Style, Code Style
- Sieben Architekturentscheidungen mit Begruendung (ADR-0001 bis ADR-0007)
- README, Contributing-Leitfaden, PR-Vorlage

[Unreleased]: https://github.com/USER/isiHunt/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/USER/isiHunt/releases/tag/v0.1.0
