# Architektur — isiHunt

**Stand:** 2026-08-12 · gilt fuer v0.1

Dieses Dokument beschreibt, **wie** der Code aufgebaut ist und **warum**.
Entscheidungen mit Alternativen stehen in [DECISIONS.md](DECISIONS.md).

---

## 1. Leitprinzip

> **Simulation weiss nichts von Darstellung. Darstellung weiss nichts von
> Regeln. Regeln wissen nichts von Phaser.**

Konkret:

| Schicht      | Kennt Phaser? | Beispiel                                         |
| ------------ | ------------- | ------------------------------------------------ |
| **Config**   | nein          | `rarities.ts`, `talents.ts` — reine Daten        |
| **Systems**  | fast nicht    | `ProgressionSystem`, `ScoreSystem` — reine Logik |
| **Entities** | ja            | `Player`, `Collectible` — GameObjects            |
| **Scenes**   | ja            | `GameScene`, `HudScene` — Orchestrierung         |
| **UI**       | ja            | `widgets.ts`, `textures.ts` — Darstellung        |

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
├── .githooks/
│   ├── pre-commit              Zieht die Version hoch (CODE_STYLE.md 1.9)
│   └── pre-push                Kein Push ohne Versionssprung
├── scripts/
│   ├── generate-icons.mjs      Zeichnet die App-Icons (npm run icons)
│   ├── bump-version.mjs        Patch-Version +1, vom pre-commit-Hook gerufen
│   └── check-deploy.mjs        Liegt der lokale Stand wirklich live? (deploy:check)
├── src/
│   ├── config/                 Reine Daten, keine Logik
│   │   ├── GameConfig.ts       Alle Balancing-Zahlen
│   │   ├── rarities.ts         Seltenheitsstufen
│   │   ├── worlds.ts           Welten
│   │   ├── talents.ts          Talente + Stat-Aufloesung
│   │   ├── challenge.ts        Duell: Dauer, Spielernamen, Fairness-Regeln
│   │   ├── backend.ts          Zugang zum Online-Dienst, Grenzwerte
│   │   └── achievements.ts     Erfolge als Praedikate
│   ├── core/
│   │   ├── EventBus.ts         Typisierter Event-Bus zwischen Scenes
│   │   ├── display.ts          Vollbild- und Installationszustand des Browsers
│   │   ├── layoutReport.ts     Misst sichere Raender und Canvas-Lage
│   │   ├── updateCheck.ts      Liegt eine neuere Fassung bereit?
│   │   └── viewport.ts         Haelt Phasers Canvas-Position aktuell
│   ├── entities/               Spielobjekte
│   │   ├── Player.ts
│   │   └── Collectible.ts
│   ├── input/
│   │   ├── InputController.ts  Touch + Tastatur vereinheitlicht
│   │   └── DebugKeys.ts        Nur im Dev-Build
│   ├── scenes/
│   │   ├── SceneKey.ts         Scene-Namen zentral
│   │   ├── BootScene.ts        Texturen erzeugen
│   │   ├── MenuScene.ts        Name, Welten, Start, Duell
│   │   ├── ProfileScene.ts     Name und Lichtfigur beim ersten Start
│   │   ├── GameScene.ts        Die Simulation (Solo und Duell)
│   │   ├── HudScene.ts         Anzeige waehrend des Runs
│   │   ├── ChallengeScene.ts   Duell: Einfuehrung, Uebergabe, Ergebnis
│   │   ├── LeaderboardScene.ts Online-Bestenliste, Gesamtansicht + Weltfilter
│   │   ├── SyncScene.ts        Spielstand-Abgleich zwischen Geraeten
│   │   ├── AdminScene.ts       Wartung: Version, Neuladen, Reset (versteckt)
│   │   ├── RulerScene.ts       Pixel-Lineal ueber dem Spielfeld
│   │   └── ResultScene.ts      Auswertung eines Solo-Runs
│   ├── systems/                Regeln ohne Darstellung
│   │   ├── SaveSystem.ts       localStorage, versioniert
│   │   ├── ProgressionSystem.ts XP, Level, Talentpunkte, Erfolge
│   │   ├── ScoreSystem.ts      Punkte + Combo eines Runs
│   │   ├── ChallengeSystem.ts  Duell-Zustand: Seed, Punktstaende, Sieger
│   │   ├── CloudSystem.ts      Bestenliste und Spielstand ueber Supabase
│   │   └── SpawnSystem.ts      Wann und wo etwas erscheint
│   ├── types/
│   │   └── index.ts            SaveData, RunStats, ChallengeState, ...
│   ├── ui/
│   │   ├── theme.ts            Farben, Schriftgroessen
│   │   ├── depth.ts            Zeichenreihenfolge aller Ebenen
│   │   ├── textures.ts         Prozedurale Grafiken
│   │   ├── hitDebug.ts         Trefferflaechen sichtbar machen (?hitboxes)
│   │   ├── textInput.ts        Echtes HTML-Eingabefeld ueber dem Canvas
│   │   └── widgets.ts          Knoepfe, Balken, Hintergruende, Effekte
│   ├── env.d.ts                Typen der Umgebungsvariablen
│   └── main.ts                 Phaser-Konfiguration
├── supabase/
│   └── schema.sql              Tabellen, Rechte und Zugriffsregeln
├── index.html                  Mobile-Meta-Tags, Scroll-Sperre, PWA-Verweise
├── vite.config.ts
├── tsconfig.json
└── eslint.config.js
```

**Regel:** Ein Import darf nur nach _unten_ zeigen.
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
Nach einem Solo-Run versucht `ResultScene` den aktuellen lokalen Stand
asynchron hochzuladen; ein Fehler bleibt lokal und blockiert den Run nicht.

Im Duell-Modus faellt dieser letzte Schritt komplett weg: `GameScene.endRun()`
uebergibt an `ChallengeSystem` statt an `ProgressionSystem`, und der Spielstand
wird nicht angefasst.

## 4.1 Determinismus im Duell

Beide Duellanten muessen dieselbe Relikt-Abfolge sehen. Gleicher Seed allein
reicht dafuer **nicht** — der Zufallsgenerator muss auch gleich _oft_ und in
gleicher _Reihenfolge_ verbraucht werden. Zwei Stellen verletzten das:

| Falle                                       | Wirkung                                                     | Loesung                                                            |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Volles Spielfeld hielt den Spawn-Timer an   | Wer langsamer sammelt, verschiebt den restlichen Spawn-Plan | Timer laeuft immer; ein faelliger Spawn faellt bei vollem Feld aus |
| Positionssuche brach beim ersten Treffer ab | Verbrauch haengt an der Figurposition                       | Es werden immer alle Kandidaten gezogen                            |

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

## 5.1 Zwei Versionsnummern, und warum es zwei sein muessen

| Wo                     | Sagt aus                         |
| ---------------------- | -------------------------------- |
| `APP_VERSION` im Code  | welcher Stand **geladen** wurde  |
| `version.json` am Netz | welcher Stand **verfuegbar** ist |

Die eingebaute Nummer allein kann einen haengenden Cache nicht aufdecken - sie
stammt ja aus genau dem Stand, der da haengt. Erst der Vergleich mit der Datei
auf dem Server macht den Unterschied sichtbar.

`version.json` entsteht beim Build (`vite.config.ts`, Plugin
`isihunt-version-manifest`) und wird in `core/updateCheck.ts` mit Cache-Buster
geladen. Weicht sie ab, bietet das Menue einen Hinweis an; erzwungen wird
nichts.

**Warum eine eigene Datei und nicht die `index.html`:** Sie laesst sich einzeln
und ohne Cache abfragen, ohne das Spiel neu zu starten.

**Warum das im Browser nicht auffiel:** Dort genuegt ein hartes Neuladen. Als
App vom Home-Bildschirm gibt es weder Adressleiste noch Reload-Knopf - deshalb
der Wartungsbildschirm (`AdminScene`), erreichbar ueber langen Druck auf die
Versionsnummer.

### 6.1 Bitte und Vollzug sind zwei Ereignisse

Der Pause-Knopf sitzt im HUD, anhalten kann aber nur die `GameScene`. Statt
dass das HUD sie sich holt (`scene.get('Game')`) — was die Trennung aus
ADR-0003 aufheben wuerde — laufen zwei Ereignisse in entgegengesetzte
Richtungen:

```
HudScene  ──PauseRequested──▶  GameScene   "bitte anhalten"
HudScene  ◀──RunPaused──────   GameScene   "ist angehalten"
```

Das ist kein Umweg, sondern der Punkt: **Nur die `GameScene` weiss, ob eine
Pause ueberhaupt zulaessig ist.** Waehrend des Countdowns gibt es nichts
anzuhalten, und im Duell darf nicht angehalten werden (sonst koennte man in
Ruhe zielen, waehrend ein legendaeres Relikt liegt). Das HUD baut seinen
Pause-Bildschirm deshalb erst auf `RunPaused` hin auf — auf die Tatsache, nicht
auf die Absicht.

Dieselbe Trennung gilt fuer `AbortRequested`.

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

## 8.1 Online: Bestenliste und Spielstand-Abgleich

`CloudSystem` kapselt Supabase vollstaendig; kein anderer Code kennt den
Dienst. Zwei Grundsaetze bestimmen den Aufbau:

**Das Netz haelt das Spiel nie auf.** Jede Funktion liefert ein
`CloudResult<T>` und wirft nie. Fehlende Zugangsdaten, kein Empfang, Dienst
weg — nichts davon darf verhindern, dass man spielt. Ohne Zugangsdaten
erscheinen die Online-Knoepfe gar nicht erst; ein Knopf, der zuverlaessig in
eine Fehlermeldung fuehrt, ist schlimmer als keiner.

**Kein Konto, kein Passwort, keine E-Mail.** Ein Spielstand gehoert einer
zufaelligen UUID, die nur lokal liegt. Fuer das zweite Geraet erzeugt das
erste einen sechsstelligen Code, der 15 Minuten gilt.

Die Bestenliste zeigt standardmaessig die besten Ergebnisse **ueber alle
Welten**. Jede Zeile traegt weiterhin ihre `world_id`, dargestellt als
Weltfarbmarker; die Weltentabs schraenken die Abfrage optional auf eine Welt
ein. Der globale und der gefilterte Rang werden jeweils durch einen passenden
Index in `supabase/schema.sql` unterstuetzt.

Pro Cloud-Profil (`SaveData.cloudId`) gibt es genau eine Zeile. Ein Solo-Run
ruft `submit_best_score` auf: Ein neuer Score ersetzt Score, Combo und Welt nur,
wenn er hoeher ist; der Name wird auch bei einem unveraenderten Bestwert
aktualisiert. Die alte Bestenliste muss beim Schemawechsel einmalig ueber
`supabase/cleanup_leaderboard.sql` geleert werden.

Nach einem Solo-Run wird das Ergebnis automatisch eingetragen, wenn ein Name
gespeichert und der Backend-Dienst eingerichtet ist. Ein fehlender Name,
fehlende Zugangsdaten oder ein Netzfehler veraendern den Ergebnisbildschirm
nicht. Duell-Runden werden weiterhin nicht eingetragen.

```
Geraet A                     Supabase                    Geraet B
   │                            │                            │
   ├── Spielstand hochladen ───▶│                            │
   ├── Code erzeugen ──────────▶│                            │
   │   "VST6PC"                 │◀───── Code einloesen ──────┤
   │                            ├────── Spielstand ─────────▶│
   │                            │                            │
   │                            │      Vergleich anzeigen ───┤
   │                            │      Nutzer entscheidet    │
   │                            │◀───── uebernehmen ─────────┤
```

**Der Konflikt wird gezeigt, nicht entschieden.** Wurde auf beiden Geraeten
gespielt, gibt es zwei Staende und keine Regel, die verlaesslich den richtigen
waehlt. "Der neuere gewinnt" kostet genau dann Wochen, wenn man auf dem
Zweitgeraet kurz eine Runde gespielt hat. Deshalb stehen beide Staende mit
Level, Bestwert und Anzahl Runs nebeneinander, und uebernommen wird erst auf
ausdrueckliche Ansage.

**Der Upload ist automatisch, die Uebernahme nicht.** Nach jedem Solo-Run und
bei Rueckkehr des Netzes wird der lokale Stand hochgeladen, sofern der Cloud-
Stand nicht sichtbar weiter ist. Erkennt `MenuScene` einen besseren Cloud-
Stand, zeigt sie Level, Bestwert und Runs und fragt vor dem Ueberschreiben.
Offline-Runs bleiben bis dahin in `localStorage` erhalten.

### Die GRANT-Falle

Supabase-Tabellen brauchen **zwei** Ebenen, die man leicht verwechselt:

| Ebene      | Regelt                                                 |
| ---------- | ------------------------------------------------------ |
| `GRANT`    | ob eine Rolle die Tabelle **ueberhaupt** anfassen darf |
| RLS-Policy | **welche Zeilen** sie dabei sieht und aendert          |

Fehlt der `GRANT`, nuetzt die beste Policy nichts — und der Fehler ist
besonders taeuschend, weil PostgREST eine Tabelle ohne Rechte nicht mit
"keine Berechtigung" quittiert, sondern mit:

```
PGRST205  Could not find the table 'public.scores' in the schema cache
```

Das liest sich wie "Tabelle existiert nicht" und schickt einen auf die Suche
nach einem Fehler im `CREATE TABLE`, wo keiner ist. Beim Aufbau hat genau das
zwei Fehlversuche gekostet. Aufgeklaert hat es ein RPC-Aufruf, der mit `204`
antwortete: Die Funktion loescht aus der angeblich fehlenden Tabelle — sie
musste also existieren, und es konnte nur an den Rechten liegen.

**Merksatz:** `PGRST205` heisst im Zweifel "keine Rechte", nicht "nicht da".

## 9. Assets

Die Spielgrafiken entstehen weiterhin groesstenteils in `src/ui/textures.ts`
aus Phaser-Graphics, werden weiss gezeichnet und zur Laufzeit getintet. Das
Boot laedt zusaetzlich das Logo und je Welt eine echte Planetentextur aus
`public/assets/`; diese grossen Kulissenbilder bleiben farbig und werden nur
ueber Alpha zurueckgenommen.

Vorteile: Die Kernobjekte behalten ihre tintbare, schnelle Textur-Pipeline;
die wenigen Rasterassets sind klar auf Logo und Hintergrundkulisse begrenzt.

Der Austausch gegen echte Assets aendert **nur** `textures.ts` — die
Texture-Keys bleiben. Das gilt auch fuer die sechs levelbasierten
Raumschiff-Skins; `playerTextureForLevel` waehlt sie zentral. Siehe
[ART_STYLE.md](ART_STYLE.md).

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

| Grenze                                              | Ab wann relevant                                    | Loesung                                    |
| --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Kein Object Pooling — jedes Relikt wird neu erzeugt | > 100 gleichzeitige Objekte                         | Pool in `SpawnSystem`                      |
| Kein Test-Setup                                     | ab erster Regressionsangst                          | Vitest, M2                                 |
| Kollisionstest ist O(n) ueber alle Objekte          | > ~200 Objekte                                      | Raeumliches Gitter                         |
| Keine Ton-Ebene                                     | M4                                                  | `SoundSystem` neben den anderen Systems    |
| HUD-Layout nutzt 720×variable Portraithoehe         | nie (FIT skaliert)                                  | —                                          |
| **Bestenliste ist manipulierbar**                   | sobald sie oeffentlich beworben wird                | Runs serverseitig nachrechnen (ADR-0011)   |
| Sync ueberschreibt, statt zusammenzufuehren         | wenn auf beiden Geraeten regelmaessig gespielt wird | Feldweises Zusammenfuehren monotoner Werte |
