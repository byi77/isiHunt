# isiHunt

> Jage das Licht.

Ein farbenfroher 2D-Arcade-Collector fuer den Handy-Browser. Du steuerst eine
Lichtgestalt durch Fantasy-Welten und sammelst Relikte ein, bevor sie
verblassen. Kurz spielbar fuer zwischendurch, mit Level-, Talent- und
Achievement-System fuer alle, die dranbleiben.

**Status:** v0.1 — spielbarer Prototyp. Siehe [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Was das Spiel ist

- **Ein Run dauert 60 Sekunden.** Relikte tauchen auf, driften und verblassen.
- **Seltenheit bestimmt alles.** Grau bis Orange — je seltener, desto mehr
  Punkte, desto schneller, desto kuerzer sichtbar. Die Farbskala ist bewusst die
  aus MMOs bekannte Item-Qualitaet.
- **Ketten zaehlen.** Sammelst du ohne Pause weiter, steigt der Multiplikator
  bis x5. Ein zu langes Zoegern setzt ihn zurueck.
- **Fortschritt bleibt.** XP → Charakterlevel → Talentpunkte → neue Welten und
  Erfolge.

Details: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)

## Steuerung

| Eingabe | Aktion |
|---|---|
| **Finger ziehen** (Handy) | Die Figur laeuft zum Finger |
| **WASD / Pfeiltasten** (PC) | Figur direkt steuern |

Die Figur folgt dem Finger, klebt aber nicht daran — so verdeckt die Hand nie
das Ziel.

### Debug-Tasten (nur im Dev-Build)

| Taste | Wirkung |
|---|---|
| `1` – `6` | Relikt der Seltenheit 1–6 sofort spawnen (`6` = legendaer) |
| `L` | +1 Charakterlevel |
| `K` | +10 Sekunden Restzeit |
| `J` | Run sofort beenden |
| `P` | Pause an/aus |
| `0` | Spielstand zuruecksetzen |

Diese Tasten existieren im Production-Build nicht (siehe `DEBUG_ENABLED` in
`src/config/GameConfig.ts`).

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
oeffnen** — Handy und PC muessen im selben WLAN sein. Aenderungen am Code sind
sofort auch auf dem Handy sichtbar.

### Weitere Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot Reload, im LAN erreichbar |
| `npm run build` | Typcheck + Production-Build nach `dist/` |
| `npm run preview` | Den Production-Build lokal testen |
| `npm run typecheck` | Nur TypeScript pruefen |
| `npm run lint` | ESLint |
| `npm run format` | Prettier ueber alle Quellen |

---

## Technik

| | |
|---|---|
| Sprache | TypeScript (strict) |
| Engine | [Phaser 3](https://phaser.io/) |
| Build | [Vite](https://vite.dev/) |
| Ziel | Mobile Browser (Hochformat), spaeter per Capacitor als App |
| Assets | v0.1 komplett prozedural erzeugt — keine Bilddateien |

Warum dieser Stack: [docs/DECISIONS.md](docs/DECISIONS.md)
Wie der Code aufgebaut ist: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Dokumentation

| Datei | Inhalt |
|---|---|
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | Spielidee, Regeln, Balancing, Progression |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Ordnerstruktur, Scenes, Systeme, Datenfluss |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Meilensteine M0–M6 |
| [docs/ART_STYLE.md](docs/ART_STYLE.md) | Farbpalette, Formensprache, Asset-Regeln |
| [docs/CODE_STYLE.md](docs/CODE_STYLE.md) | Namenskonventionen, Regeln, Definition of Done |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architekturentscheidungen mit Begruendung |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, Commits, Pull Requests |
| [CHANGELOG.md](CHANGELOG.md) | Was sich je Version geaendert hat |

## Lizenz

[MIT](LICENSE) — vorlaeufig, siehe ADR-0007 in [docs/DECISIONS.md](docs/DECISIONS.md).
