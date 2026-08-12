# Changelog

Alle nennenswerten Aenderungen an isiHunt.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Hinzugefuegt

**Duell-Modus fuer zwei Spieler**

- Zwei Personen spielen abwechselnd an einem Geraet, je 90 Sekunden
- Beide bekommen **dieselbe Relikt-Abfolge** — gleicher Seed, gleiche
  Seltenheiten, gleiche Positionen, gleiche Zeitpunkte
- Faire Bedingungen: keine Talente, und der Spielstand bleibt unberuehrt
- Einfuehrung, Uebergabe-Bildschirm und Ergebnis mit Sieger und Punktabstand
- Vorlage des Gegners im HUD; wird sie ueberholt, wird das gefeiert
- "Revanche" startet ein neues Duell mit frischem Seed

**Vollbild und Installation**

- PWA-Manifest — das Spiel laesst sich auf den Home-Bildschirm legen und
  laeuft dann ohne Adressleiste
- App-Icons, erzeugt von `scripts/generate-icons.mjs` (`npm run icons`)
- Vollbild-Knopf im Menue, wo die Fullscreen-API verfuegbar ist
- Auf dem iPhone stattdessen ein Hinweis auf "Zum Home-Bildschirm" — Safari
  kennt dort keine Fullscreen-API

**Grafik**

- Relikte sind geschliffene Steine mit acht Facetten statt glatter Kugeln
- Strahlenkranz hinter seltenen Relikten, gegenlaeufig rotierend
- Schockwelle beim Einsammeln; Fang-Partikel sind jetzt Splitter statt Punkte
- Lichtspur hinter der Figur, sobald sie sich bewegt
- Hintergrund in fuenf Ebenen: Verlauf, Horizontschein, Farbwolken, zwei
  Parallax-Ebenen — dazu eine Vignette
- Leuchtende Fortschrittsbalken, Schein hinter Knoepfen, abgesetzte Panels
- Farbmarke je Welt in der Weltenliste

### Geaendert

- **Spawn-System ist deterministisch geworden.** Der Zufallsgenerator wird
  jetzt unabhaengig vom Spielverlauf verbraucht: ein volles Spielfeld haelt
  den Takt nicht mehr an, und die Positionssuche bricht nicht mehr frueh ab.
  Ohne beides haetten zwei Duell-Durchgaenge unterschiedliche Runden ergeben.
- Zeichenreihenfolge zentral in `src/ui/depth.ts` statt verstreuter Zahlen
- Duell-Konstanten in `src/config/challenge.ts`, mit den Fairness-Regeln als
  Begruendung

### Dokumentation

- Drei neue Architekturentscheidungen: Duell-Bauform (ADR-0008),
  Vollbild-Strategie (ADR-0009), Weg zum Netzwerkduell (ADR-0010)
- Roadmap-Eintrag "Mehrspieler in Echtzeit — nicht geplant" als ueberholt
  gekennzeichnet und korrigiert
- ADR-0007 (Lizenz) um den Nachtrag ergaenzt, dass das Repository inzwischen
  oeffentlich und die MIT-Lizenz damit wirksam ist

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
