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

`ProgressionSystem`, `ScoreSystem`, `ChallengeSystem` und die
Achievement-Praedikate laufen ohne laufendes Spiel. Genau daraus zieht die
Testbarkeit ihren Nutzen: Sie sind mit Vitest abgedeckt (Abschnitt 9.2), ohne
dass dafuer eine Phaser-Instanz hochgefahren werden muesste.

Einzig `SpawnSystem` kennt Phaser noch — es braucht `RandomDataGenerator` und
`Geom.Rectangle`. `ScoreSystem` hatte den Import fuer ein einzelnes
`Math.Clamp`; er ist einer Standardrechnung gewichen, weil er die komplette
Engine samt Canvas-Erkennung in eine reine Rechendatei zog.

## 2. Ordnerstruktur

```
isiHunt/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              Typecheck + Lint + Tests + Build bei jedem Push
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
│   ├── check-deploy.mjs        Liegt der lokale Stand wirklich live? (deploy:check)
│   ├── smoke-test.mjs          Playwright gegen den Dev-Server (npm run smoke)
│   └── playtest.mjs            Spielt einen ganzen Run automatisiert (npm run playtest)
├── src/
│   ├── config/                 Reine Daten, keine Logik
│   │   ├── GameConfig.ts       Alle Balancing-Zahlen
│   │   ├── rarities.ts         Seltenheitsstufen
│   │   ├── worlds.ts           Welten
│   │   ├── talents.ts          Talente + Stat-Aufloesung
│   │   ├── challenge.ts        Duell: Dauer, Spielernamen, Fairness-Regeln
│   │   ├── backend.ts          Zugang zum Online-Dienst, Grenzwerte
│   │   ├── achievements.ts     Erfolge als Praedikate
│   │   ├── DebugConfig.ts      Tap-Schwelle, Ringpuffer-Groesse, Debug-Modus-Key
│   │   └── Balance.test.ts     Regressionstests fuer Balancing-Konstanten
│   ├── core/
│   │   ├── EventBus.ts         Typisierter Event-Bus zwischen Scenes
│   │   ├── display.ts          Vollbild- und Installationszustand des Browsers
│   │   ├── deviceReport.ts     Geraete-/Browser-Kennwerte fuer den Wartungsbildschirm
│   │   ├── layoutReport.ts     Misst sichere Raender und Canvas-Lage
│   │   ├── orientation.ts      Hochformat erzwingen, Landscape-Fallback
│   │   ├── updateCheck.ts      Liegt eine neuere Fassung bereit?
│   │   └── viewport.ts         Haelt Phasers Canvas-Position aktuell
│   ├── entities/               Spielobjekte
│   │   ├── Player.ts
│   │   ├── Collectible.ts
│   │   └── Obstacle.ts         Bremsende und zeitbestrafende Hindernisse (Phase 5)
│   ├── input/
│   │   ├── InputController.ts  Touch + Tastatur vereinheitlicht
│   │   └── DebugKeys.ts        Nur im Dev-Build
│   ├── scenes/
│   │   ├── SceneKey.ts         Scene-Namen zentral
│   │   ├── BootScene.ts        Texturen erzeugen
│   │   ├── MenuScene.ts        Name, Welten, Start, Duell
│   │   ├── ProfileScene.ts     Zentrales Profil: Name, Level, Statistik,
│   │   │                       Login/Abgleichen/Abmelden (2026-08-18
│   │   │                       zusammengefuehrt, war zuvor Teil von
│   │   │                       AccountScene)
│   │   ├── AccountScene.ts     Nur noch Login/Registrierung (Phase 2.6);
│   │   │                       leitet bei bereits bestehender Sitzung zu
│   │   │                       ProfileScene weiter
│   │   ├── SettingsScene.ts    Ton, Spielstand-Aktionen; Profil-Knopf zeigt
│   │   │                       auf ProfileScene
│   │   ├── TalentScene.ts      Talentbaum-Oberflaeche mit Rangkauf
│   │   ├── AchievementsScene.ts Erfolgsliste
│   │   ├── GameScene.ts        Die Simulation (Solo und Duell)
│   │   ├── HudScene.ts         Anzeige waehrend des Runs
│   │   ├── ChallengeScene.ts   Duell: Einfuehrung, Uebergabe, Ergebnis
│   │   ├── OnlineDuelScene.ts  Netzwerk-Duell: Raum, Lobby, Ergebnis (ADR-0010 Schritt 2)
│   │   ├── LeaderboardScene.ts Online-Bestenliste, Gesamtansicht + Weltfilter
│   │   ├── SyncScene.ts        Legacy-Abgleich für anonyme Alt-Spielstände
│   │   ├── AdminScene.ts       Wartung: Version, Neuladen, Reset (versteckt)
│   │   ├── AdminPinScene.ts    PIN-Abfrage vor dem Wartungsbildschirm
│   │   ├── AdminStatsScene.ts  Aggregierte Nutzungsstatistik (serverseitig geprueft)
│   │   ├── AdminUsersScene.ts  Profilverwaltung im Wartungsbereich
│   │   ├── RulerScene.ts       CSS-Pixel-Lineal über dem gesamten Viewport
│   │   └── ResultScene.ts      Auswertung eines Solo-Runs
│   ├── systems/                Regeln ohne Darstellung
│   │   ├── SaveSystem.ts       localStorage, versioniert
│   │   ├── SaveSystem.test.ts
│   │   ├── SafeAreaSystem.ts   Safe-Area-Laufband und Run-Restzeit
│   │   ├── SafeAreaSystem.test.ts
│   │   ├── SoundSystem.ts      Prozedurales WebAudio-Feedback
│   │   ├── SoundSystem.test.ts
│   │   ├── AuthSystem.ts       Alias/PIN-Anmeldung, Sitzungspflege (Phase 2.6)
│   │   ├── AuthSystem.test.ts
│   │   ├── ProgressSyncSystem.ts Offline-Outbox fuer angemeldete Profile
│   │   ├── ProgressSyncSystem.test.ts
│   │   ├── SyncStatusSystem.ts Sichtbarer Sync-Status im Menue
│   │   ├── ProgressionSystem.ts XP, Level, Talentpunkte, Erfolge
│   │   ├── ProgressionSystem.test.ts
│   │   ├── ScoreSystem.ts      Punkte + Combo eines Runs
│   │   ├── ScoreSystem.test.ts
│   │   ├── ChallengeSystem.ts  Duell-Zustand: Seed, Punktstaende, Sieger
│   │   ├── ChallengeSystem.test.ts
│   │   ├── CloudSystem.ts      Bestenliste und Spielstand ueber Supabase
│   │   ├── CloudSystem.test.ts
│   │   ├── NetworkDuelSystem.ts Netzwerk-Duell: Raum, Uhr-Sync, Realtime-Kanal
│   │   ├── NetworkDuelSystem.test.ts
│   │   ├── SpawnSystem.ts      Wann und wo etwas erscheint
│   │   ├── SpawnSystem.test.ts
│   │   ├── DebugSystem.ts      Ringpuffer, Report-Text, Screenshot, Share-Sheet (ADR-0016)
│   │   └── DebugSystem.test.ts
│   ├── types/
│   │   └── index.ts            SaveData, RunStats, ChallengeState, ...
│   ├── ui/
│   │   ├── theme.ts            Farben, Schriftgroessen
│   │   ├── depth.ts            Zeichenreihenfolge aller Ebenen
│   │   ├── textures.ts         Prozedurale Grafiken
│   │   ├── hitDebug.ts         Trefferflaechen sichtbar machen (?hitboxes)
│   │   ├── debugOverlay.ts     Schwebender Debug-Knopf ausserhalb des Canvas (ADR-0016)
│   │   ├── textInput.ts        Echtes HTML-Eingabefeld ueber dem Canvas
│   │   └── widgets.ts          Knoepfe, Balken, Hintergruende, Effekte, createStatusPage
│   ├── env.d.ts                Typen der Umgebungsvariablen
│   └── main.ts                 Phaser-Konfiguration
├── supabase/
│   └── schema.sql              Tabellen, Rechte und Zugriffsregeln
├── ios/                        Natives Xcode-Projekt, generiert von Capacitor
│                                (M8, geplant — siehe ADR-0015 in DECISIONS.md)
├── index.html                  Mobile-Meta-Tags, Scroll-Sperre, PWA-Verweise
├── vite.config.ts
├── capacitor.config.ts         Native-App-Konfiguration (M8, geplant)
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

**Netzwerk-Duell (`kind: 'duel-online'`, ADR-0010 Schritt 2):** dieselbe
`ChallengeState`-Struktur, aber `OnlineDuelScene` statt `ChallengeScene` und
`GameScene` startet ueber eine serverseitige Zielzeit statt eines festen
Schrittzaehlers. `NetworkDuelSystem` kapselt Supabase Realtime (Raum-RPCs,
Uhr-Offset-Messung, Broadcast/Presence); `ChallengeSystem.submitOnlineRound()`
ordnet Ergebnisse ueber `onlineRounds` einer festen Spielerposition zu, weil
sie unabhaengig voneinander eintreffen (Ankunftsreihenfolge ≠ Spielerreihenfolge,
anders als beim lokalen Duell). Phase 1: kein Live-Score waehrend des Laufs,
nur synchroner Start und Ergebnisvergleich am Ende.

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
Test dafuer steht weiterhin aus (ROADMAP.md, M2): Die Vitest-Suite deckt den
Duell-Zustand ab — Seed-Vergabe, Rundenwechsel, Sieger — aber nicht, dass
derselbe Seed dieselbe Abfolge erzeugt. Genau diese Eigenschaft bricht sonst
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

### 8.2 Geplantes Login und Mehrgeräte-Profil (Phase 2.6)

Der aktuelle `cloudId`- und Sync-Code bildet einen **Spielstand-Umzug** ab,
aber noch kein Profil, auf dem mehrere Geräte dauerhaft spielen. Die geplante
Lösung trennt deshalb Backend-Profil und lokale Installation:

- Supabase Auth verwaltet die Sitzung. Die App fragt nur einen Alias und ein
  Passwort ab. Intern wird der normalisierte Alias auf eine pseudonyme,
  technische Auth-ID abgebildet; eine E-Mail-Adresse wird weder
  abgefragt noch in Profilanzeige oder Rangliste veröffentlicht.
- Aliase sind global eindeutig, 3 bis 16 Zeichen lang und auf `a-z`, `0-9`,
  `-` und `_` begrenzt. Da keine Kontaktadresse hinterlegt wird, ist eine
  Passwort-Wiederherstellung per E-Mail zunächst nicht möglich.
- Alias und sichtbarer Anzeigename (Bestenliste, Profil) sind seit ADR-0017
  **derselbe Wert** — nicht zwei unabhängig änderbare Felder. Ein Konto hat
  genau einen Namen, gesetzt über `CloudSystem.updateProfileIdentity()`.
- `profiles.id` referenziert `auth.users.id`; RLS erlaubt nur Zugriff auf das
  eigene Profil.
- `progress_events` nimmt abgeschlossene Solo-Runs mit eindeutiger `event_id`
  entgegen. Wiederholungen nach Netzfehlern bleiben dadurch folgenlos.
- Jedes Gerät hält eine lokale Outbox. Offline bleibt der Run spielbar; bei
  Netzrückkehr werden Ereignisse hochgeladen und der gemeinsame Stand gelesen.
- Der Server aggregiert XP und Coins, vereinigt Erfolge und nimmt Maximum für
  Bestwert und Best-Combo. Talentkäufe werden atomar geprüft.

Das vorhandene `saves`-Ersetzen bleibt zunächst als bewusst ausgelöste
Migration erhalten. Ein weiteres Gerät meldet sich einfach mit demselben
Login an. Der spätere native Capacitor-/TestFlight-Weg kann dieselbe
Profil-ID verwenden; Apple-Login ist dabei eine spätere Ergänzung, nicht die
Voraussetzung für die erste Web-Version.

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

## 9.2 Tests

**Vitest, `jsdom`, Testdatei neben der Quelldatei** (`ScoreSystem.test.ts` neben
`ScoreSystem.ts`). Erfasst wird `src/**/*.test.ts`; gefahren wird `npm run test`.
Die Einstellungen stehen in `vitest.config.ts` und erben Alias und `define` per
`mergeConfig` aus der Vite-Config.

`jsdom` statt `node`, weil `SaveSystem` auf `window.localStorage` zugreift. Die
Progression laeuft dadurch gegen die echte Persistenz statt gegen eine Attrappe
— eine Attrappe haette den Modul-Cache in `SaveSystem` nicht mit abgebildet, und
genau der ist die Stelle, an der Tests unbemerkt voneinander abhaengig werden.

| Datei                       | Deckt ab                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `ScoreSystem.test.ts`       | Multiplikatorstufen, Combo-Zerfall, Rundung, Run-Statistik   |
| `ProgressionSystem.test.ts` | XP-Kurve, mehrfache Aufstiege, Maximalstufe, Welten, Erfolge |
| `ChallengeSystem.test.ts`   | Seed-Vergabe, Rundenwechsel, Sieger und Gleichstand          |

**Zwei Regeln, die die Tests brauchbar halten:**

1. **Erwartungen kommen aus der Config, nicht aus abgetippten Zahlen.** Ein Test
   liest `COMBO_TIERS` oder `xpForLevel()` und rechnet damit. Ein
   Balancing-Wechsel faerbt die Suite deshalb nicht rot — ein Bruch der Regel
   dahinter schon. Anders herum waere jede Balancing-Aenderung eine Runde
   Testpflege, und Tests, die staendig im Weg stehen, werden abgeschaltet.
2. **Zustand wird vor jedem Test zurueckgesetzt.** `SaveSystem` und
   `ChallengeSystem` sind Modul-Singletons. Beim `SaveSystem` reicht
   `localStorage.clear()` nicht — der Modul-Cache ueberlebt es. Dort wird per
   `vi.resetModules()` das Modul selbst neu geladen.

**Was nicht abgedeckt ist:** Scenes, Entities, Eingabe und Darstellung. Dafuer
braeuchte es einen echten Browser; die Grenze steht in Abschnitt 10. Ebenso
offen bleibt der Determinismus-Test des Duells (Abschnitt 4.1) — geprueft ist
der Duell-_Zustand_, nicht die Gleichheit der Spawn-Abfolge bei gleichem Seed.

**`npm run smoke`** (`scripts/smoke-test.mjs`) startet einen echten Chromium
per Playwright gegen einen laufenden `npm run dev`, laedt die Seite in einem
mobilen Viewport (iPhone 13) und schlaegt fehl, wenn die Konsole Fehler zeigt.
Das ist kein Ersatz fuer den Handytest — es sieht keine Touch-Eigenheiten
echter Geraete — aber es faengt Laufzeitfehler (kaputte Imports, unbehandelte
Exceptions beim Boot) automatisiert ab, statt dass sie erst beim manuellen
Test auffallen. Playwright ist deshalb eine `devDependency`, kein Teil des
Production-Builds.

### 9.3 Automatisierter Playtest

**`npm run playtest`** (`scripts/playtest.mjs`) prueft in vier Suiten die
Kette, die Vitest nicht erreicht: Scene-Fluss, Steuerung, Kollision,
Punktevergabe, Layout und Persistenz. 39 Schritte, rund 20 Minuten.

| Suite      | Deckt ab                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| `screens`  | Profil, Talentbaum, Erfolge, Einstellungen, Rangliste, Wartung           |
| `layout`   | Canvas-Ueberstand und unterster Knopf ueber 19 Geraeteformate            |
| `progress` | Levelaufstieg, Muenzen, Erfolge, Bestwert, Spielstand ueber Neuladen     |
| `modes`    | Solo in drei Welten, Tageslauf, Bot-Duell                                |

### 9.4 iOS: Engine und Mindestversion

Zwei getrennte Fragen, zwei getrennte Werkzeuge.

**Laeuft es in Safaris Engine?** `npm run playtest -- --only=ios` faehrt
dieselbe Seite in **echtem WebKit** statt in Chromium, ueber sechs
iPhone-/iPad-Profile plus einen kompletten Run. Die uebrigen Suiten laufen
unter Chromium mit iPhone-Etikett — das ist Blink, nicht WebKit, und genau
die Eigenheiten, die dieses Projekt teuer bezahlt hat (`100dvh`,
`env(safe-area-*)`, `visualViewport`), stecken in WebKit. Voraussetzung:
`npx playwright install webkit`.

**Ab welchem iOS laeuft es?** `npm run ios:check` liest das **gebaute
Bundle** und meldet die hoechste gefundene Anforderung:

| | |
| --- | --- |
| Laedt ueberhaupt ab | **iOS 14.0** (Logical Assignment `??=`) |
| Vollstaendig nutzbar ab | **iOS 15.4** (`structuredClone()`, `dvh`) |

**Massgeblich ist iOS 15.4.** `structuredClone()` sitzt in
`SaveSystem.update()` und laeuft bei jedem Run-Ende — dazwischen wuerde das
Spiel starten und beim ersten Speichern abbrechen, was schlechter ist als
gar nicht zu laden.

Geprueft wird das Bundle, nicht `src/`: Vite transpiliert auf `es2022` und
laesst alles darueber stehen, auch aus Phaser und supabase-js. Der Check
schreibt die Grenze fest und bricht ab, wenn eine neue Abhaengigkeit sie
anhebt — sonst steigt die Mindestversion still.

Zwei Muster wurden dabei wieder entfernt, weil sie in minifiziertem Code nur
Rauschen fanden: `.group(` traf ausschliesslich `console.group()`, und ein
Regex-Literal `/d` ist von einer Division `1/d` nicht zu unterscheiden.

Die Geraeteliste der Layout-Suite kommt aus **Playwrights eigenen Profilen**
(iPhone SE bis 17 Pro Max, iPad Mini/gen 7/gen 11/Pro 11, Pixel 7) samt
echtem Skalierungsfaktor — iPhones laufen mit dpr 3, ein fest gesetztes 2
verfaelschte die Rechnung. Nur was Playwright nicht kennt, steht als eigener
Viewport daneben: iPad Air 11", iPad Pro 12.9", Galaxy S20 und der
Kurz-Fall (390x600), der Safari mit ausgeklappter Adressleiste nachbildet —
dort bricht ein Hoehenfehler zuerst durch.

Einzeln zu fahren ueber `--only=layout` (mehrere kommagetrennt).
`--watch` oeffnet ein sichtbares Fenster mit gebremster Eingabe.

Drei Bausteine machen das moeglich:

| Baustein                          | Warum es geht                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `window.isiHunt` (`main.ts` 282)  | Der Dev-Build haengt die Phaser-Instanz an `window`; darueber sind Scenes und Felder lesbar     |
| Tastatur statt Klick-Koordinaten  | `InputController` nimmt WASD/Pfeile; das umgeht Phasers FIT-Skalierung samt Koordinatenumrechnung |
| `.env.playtest`                   | Leere Backend-Zugangsdaten ⇒ `AuthSystem` wird nie ready ⇒ MenuScene loescht den vorgesetzten Stand nicht |

**Der Login ist die eigentliche Huerde, nicht das Spielen.** `MenuScene.create()`
schickt jeden Stand ohne `playerName` in die `AccountScene` (Zeile 76-82) und
loescht zuvor sogar das lokale Profil, wenn eine Auth-Session existiert, aber
niemand angemeldet ist (Zeile 71-75). Ein vorgesetzter `localStorage`-Eintrag
allein genuegt deshalb nicht — erst ohne konfiguriertes Backend bleibt er stehen.
Genau daran ist der erste Entwurf gescheitert.

**Gesteuert wird, nicht gesetzt.** Der Runner liest die Position des naechsten
Relikts und drueckt Tasten; er verschiebt den Spieler nicht direkt und
manipuliert keinen Score. Punkte entstehen dadurch ueber denselben Weg wie beim
Spielen mit der Hand — `InputController` → `GameScene.update()` → Distanztest →
`ScoreSystem`. Ein Test, der Positionen setzt, wuerde genau die Kette
ueberspringen, die er absichern soll.

**Was er nicht ersetzt:** Touch-Eigenheiten echter Geraete, Game-Feel,
Bildrate unter Last und alles Visuelle jenseits "die Scene laeuft". Der
Pflicht-Handytest bleibt (Abschnitt 10).

### Die Falle mit dem Laufwerksbuchstaben

Git startet Hooks unter Windows mit **kleingeschriebenem** Laufwerksbuchstaben
(`c:\Git\isiHunt`), die Konsole dagegen mit grossem. Vitest legt Module unter
`C:/...` im Cache ab und sucht den Test-Runner ueber `c:/...` — fuer Nodes
Modul-Aufloesung sind das zwei verschiedene Pfade. Die Suite bricht dann mit
`Vitest failed to find the runner` ab.

Das Tueckische daran: Der Fehler tritt **ausschliesslich** im Hook auf.
Manuell, in Bash, in PowerShell, unter Hook-`PATH` und mit Hook-Variablen
laeuft dieselbe Suite gruen — die Ursache liegt in keiner Umgebungsvariablen,
sondern in einer Zeichenkette. Der `pre-push`-Hook beginnt deshalb mit
`cd "$(git rev-parse --show-toplevel)"`.

Wer ein weiteres Werkzeug in einen Hook haengt, prueft es **im Hook**, nicht in
der Konsole.

### Node-Version

`jsdom` verlangt Node `^22.22.2 || ^24.15.0 || >=26`. CI und Deploy liefen auf
Node 20 und brachen im Testschritt mit `markAsUncloneable is not a function`
ab — lokal lief dieselbe Suite gruen, weil dort Node 24 steht. Beide Workflows
fahren jetzt Node 24, `engines` in der `package.json` steht auf `>=22.22.2`.

Dasselbe Muster wie eine Ebene hoeher: Ein Werkzeug laeuft dort gruen, wo man
es startet, und faellt dort um, wo es tatsaechlich laufen muss.

## 10. Grenzen der aktuellen Architektur

Ehrlich benannt, damit sie nicht ueberrascht:

| Grenze                                              | Ab wann relevant                                    | Loesung                                    |
| --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Kein Object Pooling — jedes Relikt wird neu erzeugt | > 100 gleichzeitige Objekte                         | Pool in `SpawnSystem`                      |
| Tests decken nur `systems/`, nicht Scenes/Entities  | ab Regressionen in Darstellung oder Eingabe         | `npm run playtest` deckt Scene-Fluss, Steuerung, Kollision und Persistenz ab (9.3); Aussehen und Game-Feel bleiben Handarbeit |
| Kollisionstest ist O(n) ueber alle Objekte          | > ~200 Objekte                                      | Raeumliches Gitter                         |
| Ton nur prozedural, keine Audiodateien              | Musik oder komplexe Klangkulisse                    | Dateien/Audio-Mixer in M4                  |
| HUD-Layout nutzt 720×variable Portraithoehe         | nie (FIT skaliert)                                  | —                                          |
| **Bestenliste ist manipulierbar**                   | sobald sie oeffentlich beworben wird                | Runs serverseitig nachrechnen (ADR-0011)   |
| Sync ueberschreibt, statt zusammenzufuehren         | wenn auf beiden Geraeten regelmaessig gespielt wird | Feldweises Zusammenfuehren monotoner Werte |
