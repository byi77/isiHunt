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
├── src/
│   ├── config/                 Reine Daten, keine Logik
│   │   ├── GameConfig.ts       Alle Balancing-Zahlen
│   │   ├── rarities.ts         Seltenheitsstufen
│   │   ├── worlds.ts           Welten
│   │   ├── talents.ts          Talente + Stat-Aufloesung
│   │   └── achievements.ts     Erfolge als Praedikate
│   ├── core/
│   │   └── EventBus.ts         Typisierter Event-Bus zwischen Scenes
│   ├── entities/               Spielobjekte
│   │   ├── Player.ts
│   │   └── Collectible.ts
│   ├── input/
│   │   ├── InputController.ts  Touch + Tastatur vereinheitlicht
│   │   └── DebugKeys.ts        Nur im Dev-Build
│   ├── scenes/
│   │   ├── SceneKey.ts         Scene-Namen zentral
│   │   ├── BootScene.ts        Texturen erzeugen
│   │   ├── MenuScene.ts        Charakter, Welten, Start
│   │   ├── GameScene.ts        Die Simulation
│   │   ├── HudScene.ts         Anzeige waehrend des Runs
│   │   └── ResultScene.ts      Auswertung
│   ├── systems/                Regeln ohne Darstellung
│   │   ├── SaveSystem.ts       localStorage, versioniert
│   │   ├── ProgressionSystem.ts XP, Level, Talentpunkte, Erfolge
│   │   ├── ScoreSystem.ts      Punkte + Combo eines Runs
│   │   └── SpawnSystem.ts      Wann und wo etwas erscheint
│   ├── types/
│   │   └── index.ts            SaveData, RunStats, ProgressionResult
│   ├── ui/
│   │   ├── theme.ts            Farben, Schriftgroessen
│   │   ├── textures.ts         Prozedurale Grafiken
│   │   └── widgets.ts          Knoepfe, Balken, Partikel
│   └── main.ts                 Phaser-Konfiguration
├── index.html                  Mobile-Meta-Tags, Scroll-Sperre
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
MenuScene    ←──────────────────────┐
    ↓  scene.start(Game)            │
GameScene  ──launch──▶  HudScene    │
    ↓  scene.start(Result)          │
ResultScene ────────────────────────┘
    └── "Nochmal" ──▶ GameScene
```

`GameScene` und `HudScene` laufen **gleichzeitig**. Sie kennen sich nicht.

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

v0.1 laedt **keine Bilddateien**. Alle Grafiken entstehen in
`src/ui/textures.ts` aus Phaser-Graphics, werden weiss gezeichnet und zur
Laufzeit getintet.

Vorteile: keine Ladezeit, keine Asset-Pipeline, eine Textur bedient sechs
Seltenheiten und fuenf Welten.

Der Austausch gegen echte Assets aendert **nur** `textures.ts` — die
Texture-Keys bleiben. Siehe [ART_STYLE.md](ART_STYLE.md).

## 10. Grenzen der aktuellen Architektur

Ehrlich benannt, damit sie nicht ueberrascht:

| Grenze | Ab wann relevant | Loesung |
|---|---|---|
| Kein Object Pooling — jedes Relikt wird neu erzeugt | > 100 gleichzeitige Objekte | Pool in `SpawnSystem` |
| Kein Test-Setup | ab erster Regressionsangst | Vitest, M2 |
| Kollisionstest ist O(n) ueber alle Objekte | > ~200 Objekte | Raeumliches Gitter |
| Keine Ton-Ebene | M4 | `SoundSystem` neben den anderen Systems |
| HUD-Layout ist fest auf 720×1280 | nie (FIT skaliert) | — |
