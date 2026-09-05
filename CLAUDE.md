# CLAUDE.md — Arbeitsanweisungen fuer isiHunt

Diese Datei wird bei jeder Sitzung geladen. Sie beschreibt, wie in diesem
Repository gearbeitet wird.

---

## Das Projekt in drei Saetzen

isiHunt ist ein 2D-Arcade-Collector fuer den Handy-Browser. Der Spieler steuert
eine Lichtgestalt und faengt Relikte verschiedener Seltenheit, bevor sie
verblassen. Ein Run dauert 90 Sekunden; Level, Talente und Erfolge tragen den
Langzeitfortschritt. Duelle laufen lokal gegen den Bot oder online in einer
Lobby fuer zwei bis vier Geraete.

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
6. **`systems/` kennt Phaser nicht.** Einzige Ausnahme ist `SpawnSystem`; was
   es von dort nimmt, muss reine Datenstruktur oder reine Rechnung sein
   (heute: `RandomDataGenerator`, `Geom.Rectangle`, `Math.Clamp`,
   `Math.Linear`). Kein zweites Modul bekommt diese Ausnahme.
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

Typecheck, Lint, **Formatierung**, vier statische Gates, **Tests** und Build in
der Reihenfolge, die auch die CI faehrt. Vor jedem Commit muss das gruen sein —
`format:check` gehoert dazu, sein Fehlen hat schon eine rote CI erzeugt, obwohl
lokal alles durchlief.

Die drei Gates decken ab, was Vitest nicht erreicht:
`balance:inventory` haelt Balance-Zahlen aus dem produktiven Code heraus,
`scene:guards` verhindert Oberflaechenzugriffe nach einem `await` ohne
`this.scene.isActive()` (Scenes sind mangels Canvas nicht unit-testbar),
`save:version` haelt `SAVE_VERSION` und die Postgres-Funktion
`save_version()` auf derselben Zahl - eine Divergenz dort loest
Client-Migrationen erneut aus und senkt dabei Level -, und
`balance:check` prueft, ob `balance-data.json` und der JSON-Block in der
Supabase-Migration dieselben Zahlen nennen. Nach einer Balance-Aenderung
`npm run balance:sync` fahren und die SQL-Datei mit committen.

```bash
npm run test          # einmalig
npm run test:watch    # laeuft mit
```

### Die beiden Skills

```
/start     Arbeitskopie einrichten - in zwei Laeufen mit Sitzungsneustart
           dazwischen: erst die globale Claude-Konfiguration, dann Hooks,
           npm ci, Playwright-Browser, Erinnerungen, .env und verify
/finish    Arbeitseinheit ausliefern - memory:save, verify, commit, push,
           deploy:wait, Versionsnummer melden
```

Beide liegen versioniert unter `.claude/skills/` und sind nach dem Klonen
sofort da. Von Hand fahrbar sind sie ueber ihre Skripte:

```bash
npm run setup:global   # was /start im 1. Lauf tut (dann Sitzungsneustart)
npm run setup          # was /start im 2. Lauf tut
npm run setup:check    # nur pruefen, nichts schreiben - taugt als Diagnose
npm run memory:save    # Erinnerungen -> Repo (vor dem Commit)
npm run memory:load    # Erinnerungen <- Repo (nach dem Klonen)
npm run memory:check   # weichen die Staende ab?
```

Einen neuen Rechner richtet `SETUP_NEUER_RECHNER.md` ein; die Begruendung
steht in `docs/ARCHITECTURE.md` 9.5/9.6.

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
src/scenes/     Boot, Menu, DuelSelect, OnlineDuel, Game, Hud, Result, Challenge
src/systems/    Save, Progression, Score, Spawn, Challenge, NetworkDuel — Regeln ohne Darstellung
src/types/      SaveData, RunStats, ProgressionResult
src/ui/         theme, textures (prozedural), shipShapes, widgets

.claude/skills/ /start und /finish - reisen mit dem Klon
.claude/memory/ Claude-Erinnerungen, per memory:save gepflegt
.claude/global/ Was sonst nur in ~/.claude staende (ARCHITECTURE.md 9.6)
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
Neue Logik in `systems/` bekommt Tests.

Scenes, Entities und Darstellung deckt der Browser-Playtest ab
(`docs/ARCHITECTURE.md` 9.3/9.4):

**Nicht jede Aenderung braucht jeden Test.** `npm run test:scope` liest die
geaenderten Dateien und nennt die angemessene Stufe:

| Stufe   | Dauer   | Wann                                               |
| ------- | ------- | -------------------------------------------------- |
| _keine_ | 0 Min   | Doku, Hooks, CI — `npm run verify` genuegt         |
| klein   | ~2 Min  | sonstiger Quellcode                                |
| mittel  | ~5 Min  | `ui/`, einzelne Scenes, Eingabe                    |
| gross   | ~11 Min | `index.html`, `main.ts`, `viewport.ts`, Persistenz |
| voll    | ~20 Min | `GameScene`, Balancing, Welten, Entities           |

```bash
npm run test:scope -- --run       # ermittelt die Stufe und faehrt sie
```

Ein Volltest bei einer Doku-Aenderung kostet 20 Minuten fuer nichts.

```bash
npm run playtest                  # alle sieben Suiten, ~20 Minuten
npm run playtest -- --sim         # Runden simuliert, ~9 Minuten
npm run playtest -- --only=nav    # screens|nav|controls|layout|ios|progress|modes
npm run playtest -- --watch       # sichtbares Fenster statt headless
npm run test:duel2g               # Online-Duell: Lobby, Talentphase, Run, Ergebnis
npm run ios:check                 # iOS-Mindestversion aus dem Build
```

Was die Suiten abdecken:

| Suite      | Prueft                                                         |
| ---------- | -------------------------------------------------------------- |
| `screens`  | Jeder Menue-Bildschirm oeffnet ohne Konsolenfehler             |
| `nav`      | Menuewege hin und zurueck, per echtem Klick auf den Knopf      |
| `controls` | Ueberlappende, verrutschte oder zu kleine Knoepfe; Scrollen    |
| `layout`   | Canvas-Ueberstand ueber 19 Geraeteformate                      |
| `ios`      | Dieselbe Seite in echtem WebKit statt in Chromium              |
| `progress` | Levelaufstieg, Muenzen, Erfolge, Spielstand ueber ein Neuladen |
| `modes`    | Solo in drei Welten, Tageslauf, Bot-Duell                      |

**`--sim` waehrend der Arbeit, echter Lauf vor dem Ausliefern.** Mit `--sim`
wird die 90-Sekunden-Runde nicht abgewartet, sondern gerechnet: `GameScene`
haengt allein am `delta` (Regel 5), also laesst sich `update()` selbst takten —
90 Sekunden Spielzeit in unter einer Sekunde. Kollision, Punkte, Fortschritt
und Persistenz laufen dabei unveraendert durch. **Nicht** geprueft werden
Rendering, Tweens und Bildrate, weil Phasers Loop solange schlaeft. Vor einem
Release oder einem Audit deshalb ohne `--sim` fahren.

Einmalig pro Arbeitskopie fuer die `ios`-Suite (echtes WebKit statt Chromium):

```bash
npx playwright install webkit
```

**Was auch das nicht ersetzt:** Touch-Eigenheiten echter Geraete, Game-Feel
und Bildrate unter Last bleiben Handarbeit auf dem Geraet.

Zwei Fallen beim Testschreiben:

- **Kein Phaser-Import in `systems/`.** Er zieht die Canvas-Erkennung mit und
  laesst die Datei ausserhalb des Browsers gar nicht erst laden.
- **`SaveSystem` cached im Modul.** `localStorage.clear()` allein setzt nichts
  zurueck — das Modul muss per `vi.resetModules()` neu geladen werden.
- **Werkzeuge in Hooks im Hook pruefen, nicht in der Konsole.** Git startet
  Hooks mit kleingeschriebenem Laufwerksbuchstaben; Vitest fand dadurch seinen
  Runner nicht, obwohl dieselbe Suite in jeder Shell gruen lief
  (`docs/ARCHITECTURE.md` 9.2).
