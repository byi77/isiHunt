---
name: finish
description: >
  Schliesst eine Arbeitseinheit an isiHunt vollstaendig ab: Memory sichern,
  Pruefkette fahren, committen, pushen und warten, bis die neue Version
  tatsaechlich auf GitHub Pages ausgeliefert ist. Verwenden, wenn der Nutzer
  /finish schreibt oder sagt, dass eine Aenderung fertig ist und raus soll -
  etwa "das kann raus", "committe und deploye das", "fertig, ausliefern".
  Nicht verwenden fuer einen blossen Commit ohne Deploy.
---

# /finish — Arbeitseinheit ausliefern

Faehrt die vollstaendige Kette vom fertigen Code bis zur bestaetigten Version
auf dem Server:

```
memory:save → verify → commit → push → deploy:wait → Versionsnummer melden
```

## Das Grundgesetz dieses Skills

**Ein Fehlerbericht ohne Versionsnummer ist wertlos.** Der Skill ist erst
fertig, wenn `deploy:wait` bestaetigt hat, dass die neue Version live ist. Ein
`git push` allein ist kein Abschluss — die Kette

```
Aenderung → commit (Version +1) → push → CI + Deploy → Pages → Handy
```

kann an jedem Glied reissen, und keines meldet sich von selbst. Ein kompletter
Testabend ging bereits verloren, weil auf dem Handy weiterhin v0.1.0 lief,
waehrend lokal laengst korrigiert war (`docs/CODE_STYLE.md` 1.9).

## Schritt 1 — Lage aufnehmen

```bash
git status --short
git branch --show-current
git log -3 --format='%h %s'
```

**Wenn nichts zu committen ist:** melden und aufhoeren. Kein Leer-Commit, kein
Push. Falls der Nutzer trotzdem einen Deploy will, weil der letzte Push nicht
durchkam, `npm run deploy:wait` einzeln fahren und das sagen.

**Wenn der Branch nicht `main` ist:** den Nutzer fragen, ob auf diesem Branch
committet werden soll. Nicht selbst wechseln oder mergen. Der Deploy laeuft
nur auf `main` — auf einem Feature-Branch endet der Skill nach dem Push mit
dem Hinweis, dass kein Deploy stattfindet.

## Schritt 2 — Memory sichern

```bash
npm run memory:save
```

Holt die Erinnerungen aus `~/.claude/projects/<slug>/memory/` ins versionierte
`.claude/memory/`, damit sie mit dem Commit auf die anderen Rechner reisen.
Das Skript meldet, was sich geaendert hat; oft ist es "unveraendert", und das
ist in Ordnung.

Aendert sich hier etwas, gehoert es **in denselben Commit** — nicht in einen
eigenen. Die Erinnerung gehoert zu der Sitzung, in der sie entstanden ist.

## Schritt 3 — Pruefkette

```bash
npm run verify
```

Braucht mehrere Minuten (Typecheck, Lint, Format, vier Gates, Tests, Build) —
Timeout auf mindestens **600000 ms** setzen.

**Ist verify rot: hier abbrechen.** Nichts committen, nichts pushen. Die
Fehlerausgabe zeigen, die Ursache benennen und den Nutzer entscheiden lassen.
Keine Reparatur auf eigene Faust und kein zweiter Versuch mit `--no-verify` —
der Sinn der Kette ist, dass kaputter Code nicht auf `main` landet.

Beim Melden den Fehler einordnen, nicht nur die Ausgabe durchreichen:

| Rot geworden bei    | Bedeutet meist                                                        |
| ------------------- | --------------------------------------------------------------------- |
| `format:check`      | `npm run format` vergessen — trivial, aber der Nutzer entscheidet     |
| `balance:inventory` | eine Balance-Zahl steht im produktiven Code statt in `src/config/`    |
| `scene:guards`      | Oberflaechenzugriff nach `await` ohne `this.scene.isActive()`         |
| `save:version`      | `SAVE_VERSION` und die Postgres-Funktion `save_version()` divergieren |
| `balance:check`     | nach einer Balance-Aenderung fehlt `npm run balance:sync`             |

## Schritt 4 — Commit

Die Nachricht aus dem tatsaechlichen Diff formulieren, nicht aus der
Erinnerung an das Gespraech:

```bash
git diff --stat
git diff
```

**Form:** englischer Typ, deutsche Beschreibung, Kleinschreibung, kein Punkt
am Ende.

```
feat(hud): zeigt die verbleibende Zeit als Ring
fix(spawn): verhindert Relikte ausserhalb des Spielfelds
docs: ergaenzt die Einrichtung fuer einen zweiten Rechner
```

Gaengige Typen im Repo: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

**Vor dem Commit** die formulierte Nachricht im Antworttext zeigen, damit der
Nutzer sie mitliest — aber nicht darauf warten. Der Nutzer hat mit `/finish`
bereits zugestimmt.

Alles einbeziehen, was zur Arbeitseinheit gehoert — geaenderte Dateien, neue
Dateien, die Memory aus Schritt 2:

```bash
git add -A
git commit -m "<typ>(<bereich>): <beschreibung>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

**Der `pre-commit`-Hook zaehlt die Patch-Version hoch** und legt
`package.json` mit in den Commit. Das ist gewollt — nicht mit `--no-verify`
umgehen.

Faellt hier auf, dass der Hook gar nicht laeuft (die Version bleibt stehen),
ist auf dieser Arbeitskopie `git config core.hooksPath .githooks` nie gesetzt
worden. Das melden und setzen, bevor es weitergeht: ohne Versionssprung ist
der Deploy auf dem Geraet nicht von seinem Vorgaenger zu unterscheiden, und
die CI blockiert ihn ohnehin.

## Schritt 5 — Push

```bash
git push
```

Der `pre-push`-Hook faehrt `npm run verify` ein zweites Mal. Das dauert und
ist Absicht — Timeout grosszuegig setzen (**600000 ms**).

## Schritt 6 — Auf die Auslieferung warten

```bash
npm run deploy:wait
```

Fragt den Server, welche Version dort liegt: holt die `index.html`, folgt ihr
zum gehashten Bundle und vergleicht — denselben Weg geht auch der Browser.

**Bis zu 40 Versuche im Abstand von 15 Sekunden, also maximal 10 Minuten.**
Timeout deshalb auf **660000 ms** setzen, sonst bricht das Werkzeug ab,
waehrend der Deploy noch laeuft, und die Meldung waere falsch.

Laeuft es in den Timeout, ist der Deploy nicht durch. Dann:

```bash
gh run list --limit 3
```

Die Actions-Laeufe ansehen und den Grund benennen (CI rot, Deploy haengt,
Pages noch nicht umgeschaltet). Nicht als "fertig" melden.

## Schritt 7 — Melden

Kurz und mit Zahlen:

- die neue **Versionsnummer**, live bestaetigt
- was committet wurde, in einem Satz
- die Commit-Kennung
- ob sich die Memory geaendert hat

Beispiel:

> Ausgeliefert: **v0.1.304** (`a1b2c3d`) — Zeitring im HUD.
> Live bestaetigt auf https://byi77.github.io/isiHunt/.
> Memory unveraendert.

Danach der Hinweis, dass Rueckmeldungen vom Geraet ab jetzt verwertbar sind,
**wenn** die Nummer unten rechts auf dem Bildschirm mit der gemeldeten
uebereinstimmt. Die Nummer steht im DOM, nicht im Canvas — sichtbar auch dann,
wenn Phaser gar nicht startet.

## Was dieser Skill nicht tut

- **Keine Doku-Updates.** Der Nutzer hat festgelegt: Markdown-Dokumentation
  erst nach Abschluss und immer nach Rueckfrage. Wenn die Aenderung eine
  Doku-Anpassung nahelegt (`GAME_DESIGN`, `ARCHITECTURE`, `DECISIONS`,
  `ROADMAP`, `ART_STYLE`, `CHANGELOG`), **im Abschlussbericht danach fragen** —
  nicht ungefragt mitcommitten.
- **Keine Playtests.** `/finish` faehrt `verify`, nicht `playtest`. Wenn die
  Aenderung nach `docs/ARCHITECTURE.md` 9.3/9.4 einen Browser-Playtest braucht,
  im Bericht darauf hinweisen und `npm run test:scope -- --run` als naechsten
  Schritt nennen. Playtests laufen bei diesem Nutzer immer mit `--watch`.
- **Keine Reparaturversuche.** Rot heisst Stopp (Schritt 3).
- **Kein `--no-verify`.** Weder beim Commit noch beim Push.
- **Kein Branch-Wechsel, kein Merge, kein Rebase.**

## Wenn der Nutzer Text mitgibt

`/finish zeitring im hud` — den Text als Kern der Commit-Nachricht nehmen und
nur in die Form bringen (Typ, Bereich, Kleinschreibung). Nicht neu erfinden.
