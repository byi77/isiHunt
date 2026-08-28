# isiHunt

> Jage das Licht.

Ein farbenfroher 2D-Arcade-Collector fuer den Handy-Browser. Du steuerst eine
Lichtgestalt durch Fantasy-Welten und sammelst Relikte ein, bevor sie
verblassen. Kurz spielbar fuer zwischendurch, mit Level-, Talent- und
Achievement-System fuer alle, die dranbleiben.

**Status:** spielbarer mobiler Browser-Stand; aktuelle Version steht in
`package.json`/`version.json`. Siehe [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Was das Spiel ist

- **Ein Run dauert 90 Sekunden.** Relikte tauchen auf, driften und verblassen.
- **Seltenheit bestimmt alles.** Grau bis Orange — je seltener, desto mehr
  Punkte, desto schneller, desto kuerzer sichtbar. Die Farbskala ist bewusst die
  aus MMOs bekannte Item-Qualitaet.
- **Ketten zaehlen.** Sammelst du ohne Pause weiter, steigt der Multiplikator
  bis x5. Ein zu langes Zoegern setzt ihn zurueck.
- **Fortschritt bleibt.** XP → Charakterlevel → Coin-basierte Talente → neue Welten und
  Erfolge.
- **Duell zu zweit.** Zwei Personen, ein Geraet, je 90 Sekunden — beide jagen
  dieselben Relikte in derselben Reihenfolge.
- **Bestenliste und Geraetewechsel.** Optional, ohne Konto und ohne Passwort.

Details: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)

## Spielen

Fertig gebaut und ohne Installation:

**[byi77.github.io/isiHunt](https://byi77.github.io/isiHunt/)**

Auf dem Handy: _Teilen → Zum Home-Bildschirm_. Dann laeuft das Spiel im
Vollbild ohne Adressleiste. Auf dem iPhone ist das der **einzige** Weg dorthin
— Safari kennt dort keine Fullscreen-API (ADR-0009).

## Steuerung

| Eingabe                     | Aktion                      |
| --------------------------- | --------------------------- |
| **Finger ziehen** (Handy)   | Die Figur laeuft zum Finger |
| **WASD / Pfeiltasten** (PC) | Figur direkt steuern        |

Die Figur folgt dem Finger, klebt aber nicht daran — so verdeckt die Hand nie
das Ziel.

### Debug-Tasten (nur im Dev-Build)

| Taste     | Wirkung                                                    |
| --------- | ---------------------------------------------------------- |
| `1` – `6` | Relikt der Seltenheit 1–6 sofort spawnen (`6` = legendaer) |
| `L`       | +1 Charakterlevel                                          |
| `K`       | +10 Sekunden Restzeit                                      |
| `J`       | Run sofort beenden                                         |
| `P`       | Pause an/aus                                               |
| `0`       | Spielstand zuruecksetzen                                   |

Diese Tasten existieren im Production-Build nicht (siehe `DEBUG_ENABLED` in
`src/config/GameConfig.ts`). Die Tastatur wirkt nur, wenn das Spielfenster den
Fokus hat — bei ausbleibender Reaktion einmal ins Bild klicken.

Im Dev-Build liegt die Phaser-Instanz zusaetzlich als `window.isiHunt` in der
Browser-Konsole (`isiHunt.scale`, `isiHunt.scene.getScene('Game')`).

---

## Loslegen

**Voraussetzung:** [Node.js](https://nodejs.org/) 20 oder neuer.

```bash
npm install
```

```bash
npm run dev
```

Vite gibt zwei Adressen aus: `localhost` fuer den PC und eine
Netzwerk-Adresse (`192.168.x.x:5173`). **Die Netzwerk-Adresse im Handy-Browser
oeffnen** — Handy und PC muessen im selben Netz sein. Aenderungen am Code sind
sofort auch auf dem Handy sichtbar.

### Weitere Befehle

| Befehl                | Zweck                                        |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Dev-Server mit Hot Reload, im LAN erreichbar |
| `npm run build`       | Typcheck + Production-Build nach `dist/`     |
| `npm run preview`     | Den Production-Build lokal testen            |
| `npm run typecheck`   | Nur TypeScript pruefen                       |
| `npm run lint`        | ESLint                                       |
| `npm run format`      | Prettier ueber alle Quellen                  |
| `npm run icons`       | App-Icons neu zeichnen                       |
| `npm run test`        | Vitest ueber `systems/` und `config/`        |
| `npm run test:scope`  | Nennt die zur Aenderung passende Teststufe   |
| `npm run playtest`    | Browser-Playtest, sieben Suiten (~20 Min)    |
| `npm run test:duel2g` | Zwei-Client-Duell2G gegen Supabase (~1 Min.) |
| `npm run smoke`       | Kurzer Boot-Test gegen einen Dev-Server      |
| `npm run ios:check`   | iOS-Mindestversion aus dem Build ermitteln   |

Der Playtest steuert das Spiel in einem echten Browser: Menuewege per Klick,
ein kompletter Run per Tastatur, Layout ueber 19 Geraeteformate und ein Lauf
in echtem WebKit. Einzelne Suiten ueber `--only=`, zusehen mit `--watch`:

```bash
npm run playtest -- --watch --only=nav
```

Fuer die `ios`-Suite einmalig `npx playwright install webkit`.

### DUELL2G ohne zwei Handys

`npm run test:duel2g` oeffnet zwei isolierte Browser-Kontexte mit eigenen
Supabase-Clients. Der Host erstellt den Raum, der Gast tritt ueber den echten
Code-Submit bei; danach werden Lobby, gemeinsamer Seed, Realtime-Live-Stand,
Presence, Ergebnis-Polling und die persistenten Rundenergebnisse geprueft.
Die 90-Sekunden-GameScene laeuft dabei mit echten 60-Hz-Deltas beschleunigt,
damit der Test in Sekunden fertig ist. Bei transienten RPC-/Realtime-Fehlern
wird der komplette Lauf bis zu zweimal mit einem frischen Raum wiederholt.

```bash
npm run test:duel2g
npm run test:duel2g -- --runs=3
npm run test:duel2g -- --watch
```

Der Test benoetigt die Werte in `.env` und einen ausgefuehrten Supabase-Stand
inklusive der Duel2G-Migrationen. Er prueft Netzwerk- und Spiellogik, ersetzt
aber keinen einzelnen echten Handytest fuer Touch, Safari/PWA und Mobilfunk.

### Online-Funktionen (optional)

Bestenliste und Spielstand-Abgleich brauchen ein Supabase-Projekt. **Ohne
Zugangsdaten laeuft das Spiel vollstaendig** — auch ohne Konto und ohne
Internetverbindung kann gespielt werden. Spielstaende werden lokal gespeichert;
Internet wird nur fuer Registrierung, Login und die optionalen Online-Funktionen
gebraucht. Die beiden Online-Knoepfe erscheinen ohne Backend gar nicht erst.

Zum Einrichten:

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) anlegen
2. `supabase/schema.sql` im SQL-Editor ausfuehren (legt Tabellen, Rechte und
   Zugriffsregeln an; wiederholbar)
3. `.env.example` nach `.env` kopieren und die beiden Werte aus
   _Project Settings → API keys_ eintragen

> Gebraucht wird ausschliesslich der **oeffentliche** Schluessel
> (`publishable` bzw. `anon`). Der `secret`- oder `service_role`-Schluessel
> umgeht saemtliche Zugriffsregeln und darf nie in den Client — siehe ADR-0012.

**Die Bestenliste ist manipulierbar.** Das Spiel laeuft im Browser; ohne
serverseitige Nachrechnung eines Runs laesst sich das nicht verhindern. Fuer
ein Duell unter Bekannten unerheblich, fuer eine oeffentliche Rangliste nicht
(ADR-0011).

---

## Technik

|          |                                                                   |
| -------- | ----------------------------------------------------------------- |
| Sprache  | TypeScript (strict)                                               |
| Engine   | [Phaser 3](https://phaser.io/)                                    |
| Build    | [Vite](https://vite.dev/)                                         |
| Backend  | [Supabase](https://supabase.com/) — optional                      |
| Ziel     | Mobile Browser (Hochformat), spaeter per Capacitor als App        |
| Grafiken | Ueberwiegend prozedural; Planeten, Logo und CC0-Sprites als Datei |

Warum dieser Stack: [docs/DECISIONS.md](docs/DECISIONS.md)
Wie der Code aufgebaut ist: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Dokumentation

| Datei                                        | Inhalt                                         |
| -------------------------------------------- | ---------------------------------------------- |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)   | Spielidee, Regeln, Balancing, Progression      |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Ordnerstruktur, Scenes, Systeme, Datenfluss    |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Meilensteine M0–M6                             |
| [docs/ART_STYLE.md](docs/ART_STYLE.md)       | Farbpalette, Formensprache, Asset-Regeln       |
| [docs/CODE_STYLE.md](docs/CODE_STYLE.md)     | Namenskonventionen, Regeln, Definition of Done |
| [docs/DECISIONS.md](docs/DECISIONS.md)       | Architekturentscheidungen mit Begruendung      |
| [CONTRIBUTING.md](CONTRIBUTING.md)           | Branches, Commits, Pull Requests               |
| [CHANGELOG.md](CHANGELOG.md)                 | Was sich je Version geaendert hat              |

## Lizenz

[MIT](LICENSE) — vorlaeufig, siehe ADR-0007 in [docs/DECISIONS.md](docs/DECISIONS.md).
