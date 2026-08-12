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
9. **Jeder Commit zieht die Version hoch.** Der `pre-commit`-Hook erledigt das
   (`scripts/bump-version.mjs`); die Nummer steht im Menue unten rechts.

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

## Versionierung

Jeder Commit bekommt eine eigene Patch-Version. Der Hook macht das selbst:

```bash
git config core.hooksPath .githooks   # einmalig pro Arbeitskopie
```

Danach zaehlt `.githooks/pre-commit` vor jedem Commit die Version in
`package.json` hoch und legt die Aenderung mit in denselben Commit.

**Warum das nicht optional ist:** Die Nummer steht im Menue unten rechts. Beim
Test auf dem Handy ist sie die einzige verlaessliche Auskunft darueber, ob der
neue Stand geladen wurde — iOS-Caches sind hartnaeckig, und ein Fehlerbericht
zu einem alten Stand kostet mehr Zeit als jede Versionsnummer.

Bewusst ohne Versionssprung committen: `git commit --no-verify`.

## Befehle

```bash
npm run dev
```

```bash
npm run typecheck && npm run lint && npm run build
```

Vor jedem Commit muessen alle drei gruen sein.

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

Ein automatisiertes Test-Setup gibt es noch nicht (geplant in M2, Vitest).
`ProgressionSystem`, `ScoreSystem` und die Achievement-Praedikate sind bereits
reine Logik und dafuer vorbereitet.
