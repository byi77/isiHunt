# Mitarbeiten an isiHunt

---

## Einrichten

**Voraussetzung:** [Node.js](https://nodejs.org/) 20 oder neuer.

```bash
npm install
```

```bash
npm run dev
```

Vite gibt eine Netzwerk-Adresse aus (`192.168.x.x:5173`). Diese im
Handy-Browser oeffnen — Handy und PC im selben WLAN. Aenderungen sind sofort
auf dem Geraet sichtbar.

## Vor jedem Commit

```bash
npm run typecheck && npm run lint && npm run build
```

## Branches

| Branch         | Zweck                                                              |
| -------------- | ------------------------------------------------------------------ |
| `main`         | Immer lauffaehig. Jeder Push deployt automatisch auf GitHub Pages. |
| `feat/<name>`  | Neues Feature                                                      |
| `fix/<name>`   | Fehlerbehebung                                                     |
| `docs/<name>`  | Nur Dokumentation                                                  |
| `chore/<name>` | Werkzeuge, Abhaengigkeiten, Aufraeumen                             |

Beispiel: `feat/talent-screen`, `fix/combo-timer-reset`

**Nie direkt auf `main` committen.** `main` ist das, was Spieler sehen.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<typ>(<bereich>): <was sich aendert, Imperativ>
```

**Typen:** `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `chore`,
`balance`

`balance` ist projektspezifisch — fuer reine Zahlenanpassungen ohne
Codeaenderung. So laesst sich die Balancing-Geschichte separat nachlesen.

**Bereiche:** `game`, `hud`, `menu`, `result`, `progression`, `spawn`,
`score`, `save`, `input`, `ui`, `config`, `build`, `docs`

**Beispiele:**

```
feat(hud): Combo-Fenster als schrumpfenden Balken anzeigen
fix(save): Spielstand bei kaputtem JSON nicht verlieren
balance(config): Legendaer-Spawnrate von 1,5 % auf 1,2 % senken
docs(design): Combo-Regel und Begruendung ergaenzen
```

**Ein Commit = eine Aenderung.** Ein Commit, dessen Beschreibung ein "und"
braucht, sind zwei Commits.

## Pull Requests

1. Branch von `main` abzweigen
2. Arbeiten, dabei **Doku im selben Commit** mitziehen
3. Lokal `npm run verify` gruen bekommen (Typecheck, Lint, Format, Tests, Build)
4. Bei Aenderungen an Scenes, Layout oder Navigation: `npm run playtest`
   (oder gezielt `--only=nav,controls,layout`)
5. **Auf einem echten Handy testen** — nicht nur im Browser-Emulator.
   Der Playtest deckt Ablauf und Layout ab, aber weder Touch-Eigenheiten
   noch Game-Feel oder Bildrate unter Last.
6. PR oeffnen, Vorlage ausfuellen
7. CI muss gruen sein

## Die Doku ist Teil des Codes

| Aenderung                 | Zuerst aktualisieren                                |
| ------------------------- | --------------------------------------------------- |
| Balancing-Wert            | `docs/GAME_DESIGN.md`                               |
| Neue Datei / neues System | `docs/ARCHITECTURE.md`                              |
| Architekturentscheidung   | `docs/DECISIONS.md` (neuer ADR)                     |
| Neue Farbe / Effekt       | `docs/ART_STYLE.md`                                 |
| Feature fertig            | `docs/ROADMAP.md` abhaken, `CHANGELOG.md` ergaenzen |

Doku und Code gehoeren in **denselben** Commit. Ein separater
"docs update"-Commit bedeutet, dass die Doku dazwischen falsch war.

## Codestil

Vollstaendig in [docs/CODE_STYLE.md](docs/CODE_STYLE.md). Die wichtigsten
Punkte:

1. Keine magischen Zahlen ausserhalb von `src/config/`
2. Kommentare erklaeren _warum_, nie _was_
3. Importe zeigen nur nach unten (`scenes → systems → config`)
4. Jeder `onEvent` braucht ein `offEvent`
5. Alles Bewegte rechnet mit `delta`
6. Systeme kennen Phaser nicht
7. Nur Daten ueber den EventBus

## Fehler melden

Beim Melden hilfreich:

- Geraet und Browser
- Was passiert ist, was passieren sollte
- Konsolenausgabe, falls erreichbar
- Bildschirmaufnahme bei allem Visuellen
