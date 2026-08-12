# Architektur — isiHunt

**Stand:** 2026-08-12 · gilt fuer v0.1

Dieses Dokument beschreibt, **wie** der Code aufgebaut ist und **warum**.
Entscheidungen mit Alternativen stehen in [DECISIONS.md](DECISIONS.md).

---

## 1. Leitprinzip

> **Simulation weiss nichts von Darstellung. Darstellung weiss nichts von
> Regeln. Regeln wissen nichts von Phaser.**

Konkret:

| Schicht | Kennt Phaser? | Beispiel |
|---|---|---|
| **Config** | nein | `rarities.ts`, `talents.ts` — reine Daten |
| **Systems** | fast nicht | `ProgressionSystem`, `ScoreSystem` — reine Logik |
| **Entities** | ja | `Player`, `Collectible` — GameObjects |
| **Scenes** | ja | `GameScene`, `HudScene` — Orchestrierung |
| **UI** | ja | `widgets.ts`, `textures.ts` — Darstellung |

`ProgressionSystem` und die Achievement-Praedikate laufen ohne laufendes
Spiel — sie sind dadurch ohne Testharness pruefbar.

## 2. Ordnerstruktur

```
isiHunt/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              Typecheck + Lint + Build bei jedem Push
│   │   └── deploy.yml          Build → GitHub Pages bei Push auf main
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── GAME_DESIGN.md          Was gebaut wird
│   ├── ARCHITECTURE.md         Wie es gebaut ist  ← dieses Dokument
│   ├── ROADMAP.md              In welcher Reihenfolge
│   ├── ART_STYLE.md            Wie es aussieht
│   ├── CODE_STYLE.md           Wie geschrieben wird
│   └── DECISIONS.md            Warum so und nicht anders
├── public/                     Statische Dateien, 1:1 nach dist/
│   ├── manifest.webmanifest    PWA: "Zum Home-Bildschirm"
│   └── icon-*.png              Erzeugt von scripts/generate-icons.mjs
├── scripts/
│   └── generate-icons.mjs      Zeichnet die App-Icons (npm run icons)
├── src/
│   ├── config/                 Reine Daten, keine Logik
│   │   ├── GameConfig.ts       Alle Balancing-Zahlen
│   │   ├── rarities.ts         Seltenheitsstufen
│   │   ├── worlds.ts           Welten
│   │   ├── talents.ts          Talente + Stat-Aufloesung
│   │   ├── challenge.ts        Duell: Dauer, Spielernamen, Fairness-Regeln
│   │   └── achievements.ts     Erfolge als Praedikate
│   ├── core/
│   │   ├── EventBus.ts         Typisierter Event-Bus zwischen Scenes
│   │   └── display.ts          Vollbild- und Installationszustand des Browsers
│   ├── entities/               Spielobjekte
│   │   ├── Player.ts
│   │   └── Collectible.ts
│   ├── input/
│   │   ├── InputController.ts  Touch + Tastatur vereinheitlicht
│   │   └── DebugKeys.ts        Nur im Dev-Build
│   ├── scenes/
│   │   ├── SceneKey.ts         Scene-Namen zentral
│   │   ├── BootScene.ts        Texturen erzeugen
│   │   ├── MenuScene.ts        Charakter, Welten, Start, Duell
│   │   ├── GameScene.ts        Die Simulation (Solo und Duell)
│   │   ├── HudScene.ts         Anzeige waehrend des Runs
│   │   ├── ChallengeScene.ts   Duell: Einfuehrung, Uebergabe, Ergebnis
│   │   └── ResultScene.ts      Auswertung eines Solo-Runs
│   ├── systems/                Regeln ohne Darstellung
│   │   ├── SaveSystem.ts       localStorage, versioniert
│   │   ├── ProgressionSystem.ts XP, Level, Talentpunkte, Erfolge
│   │   ├── ScoreSystem.ts      Punkte + Combo eines Runs
│   │   ├── ChallengeSystem.ts  Duell-Zustand: Seed, Punktstaende, Sieger
│   │   └── SpawnSystem.ts      Wann und wo etwas erscheint
│   ├── types/
│   │   └── index.ts            SaveData, RunStats, ChallengeState, ...
│   ├── ui/
│   │   ├── theme.ts            Farben, Schriftgroessen
│   │   ├── depth.ts            Zeichenreihenfolge aller Ebenen
│   │   ├── textures.ts         Prozedurale Grafiken
│   │   └── widgets.ts          Knoepfe, Balken, Hintergruende, Effekte
│   └── main.ts                 Phaser-Konfiguration
├── index.html                  Mobile-Meta-Tags, Scroll-Sperre, PWA-Verweise
├── vite.config.ts
├── tsconfig.json
└── eslint.config.js
```

**Regel:** Ein Import darf nur nach *unten* zeigen.
`scenes → systems → config` ist erlaubt. `config → scenes` ist es nie.

## 3. Scene-Fluss

```
BootScene          Texturen erzeugen, Ladehinweis entfernen
    ↓
MenuScene    ←──────────────────────┬───────────────────────┐
    │                               │                       │
    │ Solo                          │ Duell                 │
    ↓  scene.start(Game)            ↓  scene.start(Challenge)│
GameScene  ──launch──▶  HudScene    ChallengeScene           │
    ↓  scene.start(Result)          │        ↑               │
ResultScene ────────────────────────┘        │               │
    └── "Nochmal" ──▶ GameScene              │               │
                                             ↓               │
                             GameScene (mode: challenge) ────┘
```

`GameScene` und `HudScene` laufen **gleichzeitig**. Sie kennen sich nicht.

**`ChallengeScene` ist eine Scene fuer drei Zustaende** — Einfuehrung,
Uebergabe, Ergebnis. Sie bekommt keine Parameter, sondern liest den
Duell-Zustand aus `ChallengeSystem` und leitet daraus ab, welche Phase gilt:
keine Runde gespielt → Einfuehrung, eine → Uebergabe, alle → Ergebnis. Dadurch
laesst sie sich von ueberall mit `scene.start(SceneKey.Challenge)` betreten,
ohne dass der Aufrufer den Fortschritt kennen muss.

**Warum der Duell-Zustand ein Modul-Singleton ist:** Ein Duell ueberspannt vier
Scene-Wechsel. Scene-Felder ueberleben `scene.start()` nicht, dieser Zustand
muss das aber. Persistiert wird er bewusst nicht — ein Duell ist ein Spiel zu
zweit im Hier und Jetzt, kein Fortschritt zum Aufheben.

## 4. Datenfluss im Run

```
InputController ──Richtung──▶ Player.move()
                                  │
                                  ▼
GameScene.update()  ──▶  Distanztest gegen alle Collectibles
                                  │
                         Treffer  ▼
                          ScoreSystem.registerCollect()
                                  │
                          ┌───────┴────────┐
                          ▼                ▼
                     EventBus         Partikel/Tweens
                          │            (GameScene)
                          ▼
                     HudScene aktualisiert Anzeige

Run-Ende ──▶ ScoreSystem.toRunStats() ──▶ ProgressionSystem.applyRun()
                                                   │
                                            SaveSystem (localStorage)
                                                   │
                                            ResultScene zeigt Ergebnis
```

**Wichtig:** Der Spielstand wird **einmal pro Run** geschrieben, nicht bei
jedem Fang. Das haelt `localStorage`-Zugriffe aus der Frame-Schleife heraus.

Im Duell-Modus faellt dieser letzte Schritt komplett weg: `GameScene.endRun()`
uebergibt an `ChallengeSystem` statt an `ProgressionSystem`, und der Spielstand
wird nicht angefasst.

## 4.1 Determinismus im Duell

Beide Duellanten muessen dieselbe Relikt-Abfolge sehen. Gleicher Seed allein
reicht dafuer **nicht** — der Zufallsgenerator muss auch gleich *oft* und in
gleicher *Reihenfolge* verbraucht werden. Zwei Stellen verletzten das:

| Falle | Wirkung | Loesung |
|---|---|---|
| Volles Spielfeld hielt den Spawn-Timer an | Wer langsamer sammelt, verschiebt den restlichen Spawn-Plan | Timer laeuft immer; ein faelliger Spawn faellt bei vollem Feld aus |
| Positionssuche brach beim ersten Treffer ab | Verbrauch haengt an der Figurposition | Es werden immer alle Kandidaten gezogen |

Beide Regeln stehen als Kommentar in `SpawnSystem.ts`, weil sie beim Lesen des
Codes wie unnoetiger Aufwand aussehen. Sie sind es nicht — ohne sie ist der
Modus kaputt, und zwar auf eine Weise, die niemand beim Spielen bemerkt.

**Geprueft** wurde das durch zwei Durchgaenge desselben Duells ohne Eingabe: 12
Spawns, identisch in Seltenheit, Position und Spielzeit. Ein automatisierter
Test dafuer gehoert zu Vitest in M2 — genau diese Eigenschaft bricht sonst
unbemerkt bei der naechsten Aenderung am Spawning.

## 5. Kollision ohne Physik-Engine

`GameScene.isTouching()` vergleicht quadrierte Distanzen:

```ts
const reach = player.collectRadius + orb.radius;
return Phaser.Math.Distance.Squared(px, py, ox, oy) <= reach * reach;
```

Warum keine Arcade Physics: Wir brauchen weder Schwerkraft noch Impulse noch
Kollisionsaufloesung — nur einen Kreis-gegen-Kreis-Test gegen maximal 14
Objekte. Der Distanztest ist exakter (keine Body-Skalierungsfallen), schneller
und macht den Sammelradius zu genau der Zahl, die im HUD als Ring zu sehen ist.

Quadrierte Distanz statt `Math.hypot`: spart die Wurzel in der Frame-Schleife.

## 6. Der EventBus

Ein Modul-Singleton (`src/core/EventBus.ts`), typisiert ueber
`GameEventPayloads`. Er ueberlebt Scene-Wechsel.

**Zwei harte Regeln:**

1. **Nur Daten ueber den Bus.** Niemals GameObjects, Scenes oder Funktionen —
   sonst entsteht genau die Kopplung, die der Bus verhindern soll.
2. **Jeder `onEvent` braucht ein `offEvent` im `SHUTDOWN`-Handler.** Ohne
   Abmeldung feuern Listener nach einem Scene-Restart doppelt und greifen auf
   zerstoerte Objekte zu. `HudScene` zeigt das Muster.

## 7. Frameratenunabhaengigkeit

Alles Bewegte rechnet mit `delta`:

```ts
this.x += this.velocity.x * dtSec;
```

Die Beschleunigung der Figur nutzt eine **exponentielle Annaeherung**:

```ts
const t = 1 - Math.exp(-PLAYER_ACCEL_RESPONSE * dtSec);
```

Ein fester Lerp-Faktor (`velocity.lerp(desired, 0.2)`) wuerde auf einem
120-Hz-Geraet doppelt so schnell reagieren wie auf einem 60-Hz-Geraet. Die
Exponentialform ist unabhaengig von der Framerate.

## 8. Persistenz

`SaveSystem` kapselt `localStorage` vollstaendig. Kein anderer Code liest oder
schreibt direkt.

- **Versioniert** ueber `SAVE_VERSION`. Breaking Changes brauchen einen Zweig
  in `migrate()`.
- **`reconcile()`** fuellt fehlende Felder aus dem Default auf — neue Felder
  brauchen dadurch keine Migration.
- **Fehler blockieren nie den Start.** Privater Modus, volles Quota oder
  kaputtes JSON fuehren zu einem frischen Spielstand mit Konsolenwarnung.

## 9. Assets

Das Spiel laedt **keine Bilddateien**. Alle Spielgrafiken entstehen in
`src/ui/textures.ts` aus Phaser-Graphics, werden weiss gezeichnet und zur
Laufzeit getintet.

Vorteile: keine Ladezeit, keine Asset-Pipeline, eine Textur bedient sechs
Seltenheiten und fuenf Welten.

Der Austausch gegen echte Assets aendert **nur** `textures.ts` — die
Texture-Keys bleiben. Siehe [ART_STYLE.md](ART_STYLE.md).

**Ausnahme App-Icons.** Manifest und iOS-Home-Bildschirm brauchen echte
PNG-Dateien; iOS akzeptiert fuer `apple-touch-icon` kein SVG. Sie werden
deshalb von `scripts/generate-icons.mjs` erzeugt — derselbe Stern, dieselben
Farben, nur eben vorab statt zur Laufzeit. Das Skript bringt einen kleinen
PNG-Encoder mit, statt fuer vier Dateien eine Bildbibliothek ins Projekt zu
holen.

```bash
npm run icons
```

## 9.1 Zeichenreihenfolge

Alle Tiefenwerte stehen in `src/ui/depth.ts`, von hinten nach vorne lesbar:
Hintergrund → Parallax-Ebenen → Lichtstaub → Relikte → Figur → Effekte →
Punktzahlen → Vignette → Einblendungen.

Vorher lagen diese Zahlen als `setDepth(60)` in Entities, Scenes und Widgets
verstreut. Wer eine neue Ebene einzog, musste alle Dateien durchsuchen.

## 10. Grenzen der aktuellen Architektur

Ehrlich benannt, damit sie nicht ueberrascht:

| Grenze | Ab wann relevant | Loesung |
|---|---|---|
| Kein Object Pooling — jedes Relikt wird neu erzeugt | > 100 gleichzeitige Objekte | Pool in `SpawnSystem` |
| Kein Test-Setup | ab erster Regressionsangst | Vitest, M2 |
| Kollisionstest ist O(n) ueber alle Objekte | > ~200 Objekte | Raeumliches Gitter |
| Keine Ton-Ebene | M4 | `SoundSystem` neben den anderen Systems |
| HUD-Layout ist fest auf 720×1280 | nie (FIT skaliert) | — |
