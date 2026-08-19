# Code Style — isiHunt

**Stand:** 2026-08-12

Werkzeuge erzwingen die Formatierung (Prettier) und einen Teil der Regeln
(ESLint). Dieses Dokument beschreibt, was Werkzeuge **nicht** pruefen koennen.

---

## 1. Die neun Regeln

### 1.1 Keine magischen Zahlen ausserhalb von `config/`

```ts
// Nein
if (this.remainingMs < 10000) { ... }

// Ja — in GameConfig.ts benannt, im Code gelesen
if (this.remainingMs < CRITICAL_TIME_MS) { ... }
```

Jede Zahl, an der man beim Balancing dreht, gehoert nach `src/config/`. Das
ist der Ort, an dem man das Spiel aendert, ohne Code zu lesen.

### 1.2 Kommentare erklaeren _warum_, nie _was_

```ts
// Nein — sagt nur, was ohnehin dasteht
// Multipliziere die Punkte mit dem Multiplikator
const points = base * multiplier;

// Ja — erklaert eine Entscheidung
// Exponentielle Annaeherung ist frameratenunabhaengig - anders als ein
// fester Lerp-Faktor, der bei 120 Hz doppelt so schnell reagieren wuerde.
const t = 1 - Math.exp(-PLAYER_ACCEL_RESPONSE * dtSec);
```

Wenn der Code selbst unklar ist, ist der Kommentar nicht die Loesung — der
bessere Name ist es.

### 1.3 Importe zeigen nur nach unten

```
scenes  →  systems  →  config
   ↓         ↓
entities    types
   ↓
  ui
```

`config` importiert nie aus `systems`. `systems` importiert nie aus `scenes`.
Ein Import, der nach oben zeigt, ist ein Architekturfehler und wird im Review
abgelehnt.

### 1.4 Jeder Listener wird abgemeldet

```ts
create(): void {
  eventBus.onEvent(GameEvent.ScoreChanged, this.onScore);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unregister());
}
```

Der `EventBus` ueberlebt Scene-Wechsel. Ohne Abmeldung feuern Listener nach
einem Restart doppelt und greifen auf zerstoerte Objekte zu. **Ausnahmslos.**

Handler als **Klassenfelder** (`private readonly onScore = (...) => {}`)
schreiben, nicht als Methoden — nur so ist die Referenz beim Abmelden
dieselbe wie beim Anmelden.

### 1.5 Alles Bewegte rechnet mit `delta`

```ts
// Nein — auf einem 120-Hz-Geraet doppelt so schnell
this.x += 5;

// Ja
this.x += this.speed * dtSec;
```

Gilt auch fuer Annaeherungen und Zerfallsraten, nicht nur fuer Geschwindigkeit.

### 1.6 Systeme kennen Phaser nicht

`ProgressionSystem`, `ScoreSystem`, `ChallengeSystem` und die
Achievement-Praedikate enthalten reine Logik. Sie laufen ohne Spiel und sind
dadurch pruefbar. Wer dort einen Tween oder ein GameObject einbaut, zerstoert
genau diese Eigenschaft.

`SpawnSystem` ist die bewusste Ausnahme: es nutzt Phasers
`RandomDataGenerator` (seedbar), `Geom.Rectangle` sowie `Math.Clamp` und
`Math.Linear` — reine Datenstrukturen und reine Rechnung, kein Rendering.

Die Liste ist eine Momentaufnahme, kein Freibrief: Massgeblich ist, dass das
Genommene ohne Canvas auskommt. Der Audit vom 2026-08-19 fand hier eine
Luecke — die Regel nannte zwei Symbole, benutzt wurden vier. Wer die Liste
erweitert, prueft zuerst, ob das Symbol wirklich rein ist, und traegt es
danach hier **und** in CLAUDE.md nach.

**Auch ein winziger Import zaehlt.** `ScoreSystem` holte sich Phaser fuer ein
einzelnes `Math.Clamp`. Das sah harmlos aus, zog aber beim Laden des Moduls die
komplette Engine samt Canvas-Erkennung mit — im Test brach die Datei mit
`getContext() is not implemented` ab, lange bevor eine einzige Zeile eigener
Logik lief. Ersetzt durch `Math.min(Math.max(x, 0), 1)`. Die Regel meint nicht
"kein Rendering", sondern **kein Import**.

### 1.7 Nur Daten ueber den EventBus

Niemals GameObjects, Scenes oder Callbacks. Ein Event ist eine Nachricht, kein
Zeiger.

### 1.8 No-Guess-Vertrag

**Wir raten nicht und wir schaetzen nicht. Wir halten uns an Fakten und an
Berechnungen.**

Eine Aussage ueber dieses Projekt ist nur zulaessig, wenn sie auf einer von drei
Quellen steht:

1. **Gelesener Quelltext** — die Datei wurde geoeffnet, nicht erinnert.
2. **Ein Werkzeugergebnis** — `typecheck`, `lint`, `build`, ein Suchlauf, eine
   Messung im Browser.
3. **Eine ausgeschriebene Rechnung** — mit den Werten aus `src/config/`, sodass
   sie nachgerechnet werden kann.

```
Nein  "Das duerfte am Spawn-Intervall liegen."
Ja    "SPAWN_INTERVAL_MS ist 620 (GameConfig.ts), bei 90 s ergeben sich ohne
       Endspurt maximal rund 145 Spawns pro Run."

Nein  "Der Wert ist ungefaehr 1.5x."
Ja    "RARITY_EPIC.scoreMultiplier ist 2.5 (rarities.ts:31)."

Nein  "Ich habe das angepasst, sollte jetzt passen."
Ja    "Angepasst; typecheck und lint sind gruen, im Browser noch ungeprueft."
```

**Was fehlt, wird benannt, nicht ueberbrueckt.** Wenn eine Zahl nicht auffindbar
oder eine Ursache nicht belegbar ist, lautet die Antwort "das ist ungeprueft"
oder "das muss gemessen werden" — nicht eine plausibel klingende Zahl. Eine
falsche Zahl mit sicherem Tonfall kostet mehr Zeit als ein offenes "weiss ich
nicht".

**Unsicherheit wird markiert, nicht versteckt.** Vermutungen sind als
Arbeitshypothese erlaubt, aber nur ausdruecklich gekennzeichnet und mit dem
Schritt, der sie pruefen wuerde. Eine Hypothese ohne Pruefschritt ist geraten.

**Gilt auch fuer den Abschluss.** "Fertig" heisst: die Definition of Done
(Abschnitt 5) ist abgehakt und nachgewiesen. Nicht geprueft heisst nicht
fertig — was uebersprungen wurde, wird gesagt.

### 1.9 Jeder Commit zieht die Version hoch, jeder Push liefert sie aus

**Der teuerste Fehler dieses Projekts war kein Programmierfehler.**

Vier Runden Fehlersuche an den Trefferflaechen liefen gegen einen Stand, den
das Testgeraet nie geladen hatte: Auf dem Handy lief weiterhin v0.1.0, waehrend
lokal laengst korrigiert war. Jede Rueckmeldung ("jetzt geht nur noch links")
beschrieb korrekt den **alten** Code — und schickte die Suche in eine neue
falsche Richtung.

Kein Werkzeug haette das gefunden. Eine Zahl auf dem Bildschirm haette es in
einer Sekunde beantwortet.

#### Die Kette

```
Aenderung → commit (Version +1) → push → GitHub Actions → Pages → Handy
```

Jedes Glied kann reissen, und keines meldet sich von selbst:

| Riss                       | Wirkung                                              |
| -------------------------- | ---------------------------------------------------- |
| nicht gepusht              | Actions laeuft nie, Geraet bleibt auf altem Stand    |
| CI rot                     | Deploy laeuft trotzdem — der Fehler faellt nicht auf |
| `index.html` aus dem Cache | Geraet laedt weiter die alten, gehashten Dateien     |
| Version nicht hochgezaehlt | neuer Build ist vom alten nicht zu unterscheiden     |

#### Was dagegen eingerichtet ist

Jede Bruchstelle sichert sich selbst ab. Keine der Massnahmen verlaesst sich
darauf, dass jemand daran denkt:

| Wo             | Was                                                                        |
| -------------- | -------------------------------------------------------------------------- |
| `pre-commit`   | zaehlt die Patch-Version hoch (`scripts/bump-version.mjs`)                 |
| `pre-push`     | blockiert bei unveraenderter Version **und** faehrt `npm run verify`       |
| CI             | prueft den Versionssprung gegen `HEAD~1` — unabhaengig von lokalen Hooks   |
| Deploy         | faehrt `verify` selbst und bricht ab, statt einen roten Stand auszuliefern |
| `index.html`   | `no-cache` — die einzige Datei ohne Inhalts-Hash                           |
| `deploy:check` | fragt den Server, welche Version wirklich liegt                            |

Zwei Dinge sind daran wesentlich:

**Der Deploy prueft selbst.** Vorher liefen CI und Deploy unabhaengig auf
denselben Push — eine rote CI hielt den Deploy nicht auf. Genau so ging ein
Stand mit rotem `format:check` live.

**Die CI prueft die Version.** Der lokale Hook greift nur, wenn er eingerichtet
ist und niemand `--no-verify` benutzt hat. Die CI-Pruefung greift immer.

Einmalig pro Arbeitskopie aktivieren — `.git/hooks` ist nicht versioniert:

```bash
git config core.hooksPath .githooks
```

#### Pflicht nach jedem Push

```bash
npm run deploy:wait
```

Das Skript (`scripts/check-deploy.mjs`) laedt die `index.html` vom Server, folgt
ihr zum gehashten Bundle und liest die ausgelieferte Version — denselben Weg
geht auch der Browser. Es endet erst, wenn die Live-Version der lokalen
entspricht, und nennt bei Misserfolg die Pruefreihenfolge.

Damit ist die Kette geschlossen: Sie meldet sich jetzt von selbst.

> **Ein Fehlerbericht ohne Versionsnummer ist wertlos.** Bevor eine
> Rueckmeldung ausgewertet wird, muss feststehen, welcher Stand sie erzeugt hat.
> Die Nummer steht unten rechts am Bildschirmrand.

Bewusst uebergehen: `git commit --no-verify` bzw. `git push --no-verify`. Die
CI-Pruefungen laufen trotzdem. Merge-, Rebase- und Amend-Commits ueberspringt
der pre-commit-Hook selbst — sie gehoeren zu einem bereits vergebenen Stand.

## 2. Namenskonventionen

| Was                          | Form                      | Beispiel                   |
| ---------------------------- | ------------------------- | -------------------------- |
| Dateien mit Klasse           | `PascalCase.ts`           | `GameScene.ts`             |
| Dateien mit Daten/Funktionen | `camelCase.ts`            | `rarities.ts`              |
| Klassen, Typen, Interfaces   | `PascalCase`              | `ScoreSystem`, `RarityDef` |
| Funktionen, Variablen        | `camelCase`               | `rollRarity`               |
| Konstanten                   | `SCREAMING_SNAKE`         | `RUN_DURATION_MS`          |
| Konstanten-Objekte           | `PascalCase` + `as const` | `SceneKey`, `TextureKey`   |
| Private Felder               | fuehrendes `private`      | `private readonly core`    |
| Bewusst ungenutzt            | fuehrender `_`            | `_time`                    |

**Zeiteinheiten gehoeren in den Namen:** `remainingMs`, `dtSec`,
`COMBO_GRACE_MS`. Eine Zahl namens `duration` ist ein Fehler, der darauf
wartet zu passieren.

## 3. TypeScript

- **`strict: true`** — nicht verhandelbar.
- **`noUncheckedIndexedAccess`** ist an. Array-Zugriffe liefern
  `T | undefined`. Entweder pruefen oder mit `!` begruenden, wenn es beweisbar
  sicher ist.
- **Keine `any`.** Bei echtem Bedarf `unknown` und dann eingrenzen.
- **`import type`** fuer reine Typ-Importe (`verbatimModuleSyntax` erzwingt es).
- **Rueckgabetypen** bei allen exportierten Funktionen ausschreiben.

## 4. Kein Code ohne Dokument

Diese Regel haelt die Doku aktuell — nicht Disziplin.

| Aenderung                 | Zuerst aktualisieren                                |
| ------------------------- | --------------------------------------------------- |
| Balancing-Wert            | `docs/GAME_DESIGN.md`                               |
| Neue Datei / neues System | `docs/ARCHITECTURE.md`                              |
| Architekturentscheidung   | `docs/DECISIONS.md` (neuer ADR)                     |
| Neue Farbe / Effekt       | `docs/ART_STYLE.md`                                 |
| Feature fertig            | `docs/ROADMAP.md` abhaken, `CHANGELOG.md` ergaenzen |

Die Dokumentation wird **im selben Commit** geaendert wie der Code. Ein
separater "docs update"-Commit bedeutet, dass die Doku schon einmal falsch war.

## 5. Definition of Done

Ein Feature ist fertig, wenn **alle** Punkte zutreffen:

- [ ] `npm run verify` ist gruen (Typecheck, Lint, Formatierung, Tests, Build)
- [ ] Neue Logik in `systems/` hat Tests (siehe ARCHITECTURE.md 9.2)
- [ ] `npm run test:scope -- --run` gruen — die Stufe richtet sich nach den
      geaenderten Dateien (ARCHITECTURE.md 9.3)
- [ ] Auf einem echten Handy getestet (nicht nur im Browser-Emulator) —
      der Playtest ersetzt das nicht, er verkuerzt nur die Runden
- [ ] Keine neuen Konsolenfehler
- [ ] Alle neuen Zahlen stehen in `config/`
- [ ] Betroffene Dokumentation im selben Commit aktualisiert
- [ ] Alle neuen Listener werden abgemeldet

## 6. Reviewfragen

Was beim Durchsehen eines Diffs zuerst gefragt wird:

1. Zeigt ein Import nach oben?
2. Steht eine neue Zahl im Code statt in `config/`?
3. Gibt es ein `onEvent` ohne passendes `offEvent`?
4. Bewegt sich etwas ohne `delta`?
5. Erklaert ein Kommentar _was_ statt _warum_?
6. Wurde die Doku mitgezogen?
7. Steht hinter jeder Zahl und jeder Begruendung eine Quelle — oder ist sie
   geraten?
