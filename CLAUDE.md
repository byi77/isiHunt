# CLAUDE.md — Arbeitsanweisungen fuer isiHunt

Diese Datei wird bei jeder Sitzung geladen. Sie beschreibt, wie in diesem
Repository gearbeitet wird.

---

## Das Projekt in drei Saetzen

isiHunt ist ein 2D-Arcade-Collector fuer den Handy-Browser. Der Spieler steuert
eine Lichtgestalt und faengt Relikte verschiedener Seltenheit, bevor sie
verblassen. Ein Run dauert 60 Sekunden; Level, Talente und Erfolge tragen den
Langzeitfortschritt.

**Stack:** TypeScript (strict) · Phaser 3 · Vite · Ziel: mobiler Browser,
Hochformat.

## Vor dem ersten Handgriff lesen

| Frage                       | Datei                  |
| --------------------------- | ---------------------- |
| Was soll das Spiel sein?    | `docs/GAME_DESIGN.md`  |
| Wie ist der Code aufgebaut? | `docs/ARCHITECTURE.md` |
| Wie wird geschrieben?       | `docs/CODE_STYLE.md`   |
| Warum so und nicht anders?  | `docs/DECISIONS.md`    |
| Was kommt als naechstes?    | `docs/ROADMAP.md`      |

## Die neun Regeln

Vollstaendig begruendet in `docs/CODE_STYLE.md`. Kurzfassung:

1. **Keine magischen Zahlen ausserhalb von `src/config/`.** Jeder
   Balancing-Wert gehoert dorthin.
2. **Kommentare erklaeren _warum_, nie _was_.**
3. **Importe zeigen nur nach unten:** `scenes → systems → config`. Nie zurueck.
4. **Jeder `eventBus.onEvent` braucht ein `offEvent`** im `SHUTDOWN`-Handler.
   Handler als Klassenfelder schreiben, damit die Referenz gleich bleibt.
5. **Alles Bewegte rechnet mit `delta`.**
6. **`systems/` kennt Phaser nicht** (Ausnahme: `SpawnSystem` nutzt
   `RandomDataGenerator` und `Geom.Rectangle`).
7. **Nur Daten ueber den EventBus** — nie GameObjects oder Callbacks.
8. **No-Guess-Vertrag: wir raten und schaetzen nicht.** Jede Aussage ueber den
   Code steht auf einer gelesenen Datei, einem Werkzeugergebnis oder einer
   ausgeschriebenen Rechnung. Was nicht geprueft wurde, wird als ungeprueft
   benannt — nicht als wahrscheinlich verkauft.
9. **Jeder Commit zieht die Version hoch, jeder Push liefert sie aus.** Die
   Hooks erledigen das; nach dem Push wird der Deploy geprueft. Ein
   Fehlerbericht ohne Versionsnummer ist wertlos.

## Kein Code ohne Dokument

| Aenderung                 | Zuerst aktualisieren                                |
| ------------------------- | --------------------------------------------------- |
| Balancing-Wert            | `docs/GAME_DESIGN.md`                               |
| Neue Datei / neues System | `docs/ARCHITECTURE.md`                              |
| Architekturentscheidung   | `docs/DECISIONS.md` (neuer ADR)                     |
| Neue Farbe / Effekt       | `docs/ART_STYLE.md`                                 |
| Feature fertig            | `docs/ROADMAP.md` abhaken, `CHANGELOG.md` ergaenzen |

**Im selben Commit.** Ein nachgelagerter "docs update"-Commit bedeutet, dass
die Doku dazwischen falsch war.

## Versionierung und Deploy

Einmalig pro Arbeitskopie aktivieren (`.git/hooks` ist nicht versioniert):

```bash
git config core.hooksPath .githooks
```

**Warum das keine Formsache ist.** Ein kompletter Testabend ging verloren, weil
auf dem Handy weiterhin v0.1.0 lief, waehrend lokal laengst korrigiert war —
vier Fehlersuchrunden gegen einen Stand, den das Geraet nie geladen hatte.

Die Kette muss ganz durchlaufen, und **jedes Glied kann reissen**:

```
Aenderung → commit (Version +1) → push → CI + Deploy → Pages → Handy
```

Deshalb sichert jede Bruchstelle inzwischen sich selbst ab:

| Bruchstelle                | Absicherung                                            |
| -------------------------- | ------------------------------------------------------ |
| Version nicht hochgezaehlt | `pre-commit` zaehlt hoch, `pre-push` und CI blockieren |
| Kaputter Code gepusht      | `pre-push` faehrt `npm run verify`                     |
| CI rot, Deploy trotzdem    | der Deploy faehrt `verify` selbst und bricht ab        |
| `index.html` aus dem Cache | `no-cache`-Meta                                        |
| Deploy kommt nicht an      | `npm run deploy:check` fragt den Server                |

**Pflicht nach jedem Push:**

```bash
npm run deploy:wait     # wartet, bis die neue Version live ist
```

Das Skript holt die `index.html` vom Server, folgt ihr zum gehashten Bundle und
vergleicht die Version mit der lokalen — denselben Weg geht auch der Browser.
Erst wenn das gruen ist, sind Rueckmeldungen vom Geraet verwertbar.

> **Ein Fehlerbericht ohne Versionsnummer ist wertlos.** Die Nummer steht unten
> rechts auf dem Bildschirm (im DOM, nicht im Canvas — sichtbar auch dann, wenn
> Phaser nicht startet).

Bewusst uebergehen: `git commit --no-verify` bzw. `git push --no-verify`. Die
CI-Pruefung laesst sich damit **nicht** umgehen.

## Befehle

```bash
npm run dev
```

```bash
npm run verify
```

Typecheck, Lint, **Formatierung**, **Tests** und Build in der Reihenfolge, die
auch die CI faehrt. Vor jedem Commit muss das gruen sein — `format:check`
gehoert dazu, sein Fehlen hat schon eine rote CI erzeugt, obwohl lokal alles
durchlief.

```bash
npm run test          # einmalig
npm run test:watch    # laeuft mit
```

## Sprache

- **Code, Bezeichner, Commit-Typen:** Englisch (`ScoreSystem`, `feat(hud):`)
- **Kommentare, Dokumentation, Commit-Beschreibungen, UI-Texte:** Deutsch
- **Umlaute in Quelldateien vermeiden** (`ue`, `oe`, `ae`, `ss`) — die
  Toolchain laeuft unter Windows und Linux gemischt. In Markdown sind Umlaute
  in Ordnung.

## Wo was liegt

```
src/config/     Reine Daten: Balancing, Seltenheiten, Welten, Talente, Erfolge
src/core/       EventBus
src/entities/   Player, Collectible
src/input/      InputController (Touch + Tastatur), DebugKeys
src/scenes/     Boot, Menu, Game, Hud, Result
src/systems/    Save, Progression, Score, Spawn — Regeln ohne Darstellung
src/types/      SaveData, RunStats, ProgressionResult
src/ui/         theme, textures (prozedural), widgets
```

## Wiederkehrende Fallen

- **Debug-Tasten** existieren nur im Dev-Build (`DEBUG_ENABLED`). Nichts
  einbauen, das im Production-Build davon abhaengt.
- **Der Spielstand wird einmal pro Run geschrieben**, nicht bei jedem Fang.
  Kein `localStorage`-Zugriff in der Frame-Schleife.
- **`GameScene.input` ist Phasers Eingabe-Plugin.** Der eigene Controller
  heisst deshalb `input_`.
- **Neue Felder in `SaveData`** brauchen keine Migration (`reconcile()` fuellt
  auf). Umbenennungen und Bedeutungswechsel schon.
- **Texturen sind weiss und werden getintet.** Farbige Assets brechen das
  Seltenheitssystem.

## Testen

Auf einem echten Handy testen, nicht nur im Browser-Emulator. `npm run dev`
gibt eine Netzwerk-Adresse aus; Handy und PC muessen im selben WLAN sein.

**Automatisiert:** Vitest deckt `ScoreSystem`, `ProgressionSystem` und
`ChallengeSystem` ab (`npm run test`, Details in `docs/ARCHITECTURE.md` 9.2).
Neue Logik in `systems/` bekommt Tests; Scenes, Entities und Darstellung sind
nicht abgedeckt und bleiben Handarbeit auf dem Geraet.

Zwei Fallen beim Testschreiben:

- **Kein Phaser-Import in `systems/`.** Er zieht die Canvas-Erkennung mit und
  laesst die Datei ausserhalb des Browsers gar nicht erst laden.
- **`SaveSystem` cached im Modul.** `localStorage.clear()` allein setzt nichts
  zurueck — das Modul muss per `vi.resetModules()` neu geladen werden.
- **Werkzeuge in Hooks im Hook pruefen, nicht in der Konsole.** Git startet
  Hooks mit kleingeschriebenem Laufwerksbuchstaben; Vitest fand dadurch seinen
  Runner nicht, obwohl dieselbe Suite in jeder Shell gruen lief
  (`docs/ARCHITECTURE.md` 9.2).
