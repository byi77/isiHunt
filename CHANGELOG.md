# Changelog

Alle nennenswerten Aenderungen an isiHunt.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Geaendert

- **Die Serie ist jetzt eine Entscheidung, keine Selbstverstaendlichkeit.**
  Zwei Aenderungen greifen ineinander:

  1. Das Zeitfenster faellt von 1800 auf **900 ms**.
  2. Die Serie wird nur noch von **farbigen** Relikten gesteigert
     (ungewoehnlich und seltener). Weisse halten sie am Leben, ohne sie zu
     erhoehen.

  Vorher steigerte jeder Fang die Serie, und pro Zeitfenster erschienen 2,9
  bis 5,3 neue Relikte - sie riss praktisch nie. Im automatisierten Playtest
  lief sie regelmaessig ueber 180 Faenge ohne einen einzigen Abriss; es gab
  nie einen Moment, in dem etwas zu entscheiden war.

  Jetzt erscheinen farbige Relikte im Schnitt alle 1,6 s (Rundenanfang) bis
  0,9 s (Rundenende) - oft zu selten fuer das Fenster. Genau dann entsteht die
  Wahl: das weisse Relikt in Reichweite nehmen und die Serie retten, oder das
  farbige jagen und den Abriss riskieren. Gemessen ueber drei simulierte
  Runden: beste Serie von 183 auf **19**, Abrisse von praktisch 0 auf **11 pro
  Runde**, Score von rund 2500 auf rund 1580.

  Zum Nachjustieren fuer juengere Spieler zuerst `COMBO_GRACE_MS` erhoehen -
  der Wert wirkt direkter als jede andere Stellschraube.

### Hinzugefuegt

- **Eine Schleife hinter der Figur zeigt die laufende Serie.** Ab Serie 5
  sichtbar; Laenge und Farbe steigen mit der Stufe (blau, tuerkis, gruen,
  gold, gleissend). Umgesetzt ueber die Lebensdauer der bestehenden
  Partikelspur - laenger lebende Partikel bleiben weiter hinten liegen, die
  Dichte bleibt dabei gleich.

  **Die Laenge ist ab Stufe 4 gedeckelt.** Eine unbegrenzt wachsende Spur
  wuerde auf einem Handy im Hochformat genau die Relikte verdecken, die man
  fangen will - und die Steuerung ist ausdruecklich so gebaut, dass die Hand
  das Ziel nicht verdeckt. Ab dort traegt nur noch die Farbe die Information.

### Behoben

- **Die Anzeige des Serien-Fensters stand auf 0, sobald nur weisse Relikte
  gefangen wurden.** `comboTimerRatio` und der Zerfall in `ScoreSystem.update`
  pruefen jetzt den Timer statt die Serie: Ein weisser Fang haelt das Fenster
  offen, auch wenn die Serie dabei auf 0 steht. Ohne die Unterscheidung saehe
  der Spieler nicht, dass sein Rettungsfang gewirkt hat - und ein Fenster bei
  Serie 0 waere nie abgelaufen.

- **Die Tests der "Flow-Kette" prueften eine Mechanik, die es nicht gab.**
  Ihre Namen sprachen von "gleicher Seltenheit", der Code kannte so etwas
  aber nie: `sameRarityStreak` war schlicht ein zweiter Name fuer die Combo.
  Die Tests bestanden, weil beide Werte identisch waren, und der Test "setzt
  die Serie bei einer anderen Seltenheit zurueck" war gruen, weil das
  Zeitfenster ablief - nicht wegen der Seltenheit. Sie pruefen jetzt die
  tatsaechliche Regel; elf neue Tests decken Halten, Steigern und die
  Schleifenstufen ab.

### Hinzugefuegt

- **`npm run playtest -- --sim` rechnet die Runden, statt sie abzuwarten.**
  Der Lauf faellt von rund 20 auf rund 9 Minuten. Moeglich ist das, weil
  `GameScene.update(_time, delta)` seinen `time`-Parameter nicht benutzt: Die
  Simulation haengt allein am `delta` (Regel 5), und ausserhalb des
  Duell-Countdowns greift nichts auf die Wanduhr zu. Der Test haelt Phasers
  Loop an (`loop.sleep()`) und ruft `update()` selbst mit 16,67 ms je Schritt
  auf - 90 Sekunden Spielzeit in unter einer Sekunde.

  Phasers eigenes `timeScale` hilft dabei nicht: `TimeStep.smoothDelta()`
  deckelt jeden Frame auf `1000 / targetFps`, ein vergroesserter Delta wird
  abgeschnitten. Der Loop muss umgangen werden, nicht beschleunigt.

  Gesteuert wird ueber den Zeiger, nicht ueber `input_.direction` - den setzt
  `getDirection()` bei jedem Aufruf zurueck, ein direkt geschriebener
  Richtungsvektor waere wirkungslos. Ueber den Zeiger laeuft die Eingabe durch
  dieselbe Kette inklusive Deadzone und Abbremsung.

  Nicht geprueft werden dabei Rendering, Tweens und Bildrate, weil der Loop
  schlaeft. Vor einem Release oder Audit weiterhin ohne `--sim` fahren.

### Behoben

- **Tageslauf und Bot-Duell wurden im Playtest nie richtig gestartet.** Beide
  liefen ueber `window.isiHunt.__ch.startDaily(...)` - eine Bruecke, die es im
  Spielcode nie gab (`git log -S __ch` findet sie ausschliesslich im
  Testskript). `GameScene.create()` holte sich `ChallengeSystem.getState()`,
  bekam `null` und startete keine Runde.

  Dass es trotzdem gruen war, lag an einer Testabhaengigkeit: `ChallengeSystem`
  haelt seinen Zustand in einem Modul-Singleton. War im selben Browser-Context
  vorher ein Duell gelaufen, stand `state` noch - der Test bestand aus dem
  Zustand seines Vorgaengers heraus. Beide Modi gehen jetzt denselben Weg wie
  ein Spieler: ueber `WorldInfoScene` und `ChallengeScene`, per echtem Klick.

### Geaendert

- **Die Welten 2 bis 5 sind jetzt mechanisch abgestuft.** Sie standen alle auf
  `difficultyScale: 1` — also exakt so schwer wie die Lernzone Sternenweide —
  und unterschieden sich nur durch ihren Modifikator, den Hindernismodus und
  Multiplikatorschritte von rund 4 %. Die Schwierigkeit steigt jetzt
  durchgehend: 1,00 / 1,03 / 1,06 / 1,09 / 1,12. Der Wert skaliert die
  Hindernis-Wahrscheinlichkeit und kuerzt das Sichtfenster jedes Objekts.

  Die Welten 6 bis 10 wurden nur minimal angehoben (1,12 → 1,16, 1,25 → 1,28,
  1,40 → 1,42, 1,55 → 1,56, 1,70 unveraendert), damit die Kurve monoton bleibt,
  ohne das ueber viele Runs eingespielte Endgame-Balancing zu verschieben.

  `Balance.test.ts` prueft die Staffelung jetzt mit `>` statt `>=`. Die alte
  Pruefung war fuer genau diesen Fall blind: Fuenf identische Welten erfuellen
  `1 >= 1`. Der neue Test wurde gegen den Vor-Fix-Stand verifiziert und meldet
  dort "Eisring ist nicht schwerer als Sternenweide". Ein zweiter Test sichert
  ab, dass jede Erschwernis auch mit mehr Punkten und XP bezahlt wird.

### Behoben

- **Der Debug-Ringpuffer reichte waehrend eines Runs nur 6,7 Sekunden
  zurueck.** `TimerChanged` feuert in jedem Frame (~60/s) und wurde
  mitgeschrieben; ein 90-Sekunden-Run ueberschrieb den 400 Eintraege grossen
  Puffer damit 13,5-mal. App-Start, Login und Cloud-Fehler waren aus jedem
  Fehlerbericht verdraengt, der waehrend eines Runs entstand — also aus genau
  denen, fuer die der Puffer gebaut ist. `installDebugLogging()` ueberspringt
  dieses eine Ereignis jetzt; der Zeitverlauf bleibt ueber `RunStarted` und
  die Zeitstempel der Eintraege lesbar.

- **`format:check` prueft dieselben Dateien wie `format`.** Der Schreibbefehl
  erfasste `src/**/*.ts` und `*.{json,md}`, der Pruefbefehl nur `src/**/*.ts` —
  und der laeuft in CI, `pre-push` und `verify`. Die Differenz war damit
  strukturell ungeprueft: Sieben Dateien lagen unformatiert im Repo. Beide
  Befehle decken jetzt zusaetzlich `scripts/**/*.mjs` ab. `TODO.md` steht in
  einer neuen `.prettierignore` — die Datei enthaelt Inline-Code-Spans ueber
  Zeilenumbrueche hinweg, an denen Prettier nicht konvergiert; der Ausschluss
  gilt bewusst fuer beide Befehle, damit keine neue Asymmetrie entsteht.

- **Ein Spielstand ohne `version`-Feld schrieb seine Migration nicht zurueck.**
  `load()` las die fehlende Angabe als aktuelle Version, `migrate()` dagegen
  als 1. Der Stand wurde migriert, aber nicht persistiert — der Schutz gegen
  eine wiederholte Migration griff fuer diesen Fall nicht. Beide Stellen
  fragen jetzt `versionOf()`. (Kein Datenverlust: Die vorhandenen Migrationen
  sind idempotent, und der erste `save()` schrieb die Version ohnehin nach.)

### Geaendert

- **Regel 6 nennt jetzt alle vier erlaubten Phaser-Symbole.** `SpawnSystem`
  nutzt neben `RandomDataGenerator` und `Geom.Rectangle` auch `Math.Clamp` und
  `Math.Linear`; die Regel kannte nur die ersten beiden. Formuliert ist sie
  jetzt ueber das Kriterium — reine Datenstruktur oder reine Rechnung — statt
  ueber eine Liste, die erneut veralten kann.

- **Testabdeckung fuer bislang unerreichbare Pfade.** Drei Luecken, die eine
  gruene Suite nicht zeigen konnte:
  - `CloudSystem.configured.test.ts` (neu) prueft die "wirft nie"-Garantie mit
    **eingerichtetem** Backend. Die bestehende Suite mockt
    `isBackendConfigured: false`; dahinter kehrt jede Netzfunktion sofort an
    ihrem Guard zurueck, der Fehlerpfad war unerreichbar. Getrennt geprueft
    werden jetzt Anmelde-Guard und echter Netzausfall — inklusive des Falls,
    in dem schon die Anmeldepruefung selbst am Netz scheitert.
  - `ProgressSyncSystem.test.ts` deckt den Teilfehlschlag mit **mehreren**
    Ereignissen ab. Bisher legte jeder Test genau einen Run an; die
    `remaining`-Logik, die es nur fuer diesen Fall gibt, lief nie.
  - `SaveSystem.test.ts` prueft die Migration eines Standes **ohne**
    `version`-Feld. Beide Alt-Tests setzten das Feld explizit und konnten den
    Fehler oben deshalb nicht sehen.

### Hinzugefuegt

- **Der Playtest zeigt jetzt, woran er gerade arbeitet.** Vorab nennt er die
  geplanten Suiten und die geschaetzte Dauer; waehrend des Laufs schreibt
  eine Statuszeile mit mitlaufender Uhr, was gerade passiert — bei einem
  Run inklusive Punktestand. Vorher schwieg er waehrend eines 90-Sekunden-
  Runs komplett und war von einem Haenger nicht zu unterscheiden. In einer
  Pipe oder Datei faellt stattdessen eine normale Zeile pro Schritt an.

- **`npm run test:scope` waehlt die Teststufe anhand der Aenderung.** Fuenf
  Stufen von _keine_ (Doku, Hooks, CI) ueber klein (~2 Min), mittel (~5 Min)
  und gross (~11 Min) bis voll (~20 Min, alle Spielmodi). Ein Volltest bei
  einer Doku-Aenderung kostet 20 Minuten fuer nichts; ein Eingriff in
  `GameScene` braucht ihn dagegen. Die Regeln runden bewusst nach oben, und
  ein unbekannter Pfad zaehlt als klein statt als keine.

- **Zwei neue Playtest-Suiten: `nav` und `controls`.**
  `nav` klickt sich durch die Menuewege und wieder zurueck — mit **echten
  Klicks** auf die Knopfposition, nicht per `scene.start()`. Nur so laufen
  Trefferflaeche, Zeichenreihenfolge und Koordinatenumrechnung mit; der
  Rueckweg geht ueber den Zurueck-Knopf der Zielseite.
  `controls` prueft, was sonst erst auf dem Geraet auffaellt: ueberlappende
  Knoepfe, Elemente ausserhalb der Spielflaeche, zu kleine Tippziele und ob
  lange Menues sich wirklich per Wischen scrollen lassen.

  **Bewusst konservativ bewertet.** Ueberlappung wird nur zwischen zwei
  echten Knoepfen gemeldet: Das Logo im Hauptmenue traegt eine
  640x360-Trefferflaeche (Groesse der Originaltextur, nicht der Anzeige) und
  ueberdeckt rechnerisch 88 % des VOLLBILD-Knopfes — ein echter Klick liefert
  trotzdem VOLLBILD, weil Knoepfe auf `Depth.UI` liegen. Tippziele werden in
  CSS-Pixeln des echten Viewports gemessen; Apples 44 pt sind ein Hinweis,
  kein Fehler, weil der Zurueck-Knopf mit ~33 CSS-px darunter liegt und seit
  v0.1.3 auf dem Geraet als gut bedienbar bestaetigt ist.

  Aktueller Stand: keine Ueberlappungen, nichts ausserhalb der Spielflaeche,
  ProfileScene scrollt (146 px gemessen). Kleinstes Tippziel sind die
  Weltauswahl-Pfeile mit 28x28 CSS-px.

  **Ein Verdacht war keiner.** Das DOM-Namensfeld schien den Szenenwechsel zu
  ueberleben; die Ursache lag im Test. Er wechselte ueber den globalen
  Manager (`game.scene.start`), der die alte Scene mitlaufen laesst — das
  Spiel ruft immer `this.scene.start` auf der laufenden Scene, und dort
  raeumt Phaser das Feld zuverlaessig ab. Geprueft mit und ohne eigens
  gebauten Fix, beide Male sauber; der Fix wurde zurueckgenommen. Alle
  Suiten wechseln Scenes jetzt ueber `switchScene()` so, wie das Spiel es
  tut. Der Pruefschritt bleibt als Regressionsschutz und ist gruen.

- **`npm run ios:check`** ermittelt die iOS-Mindestversion aus dem gebauten
  Bundle: **laedt ab iOS 14.0**, **voll nutzbar ab iOS 15.4**. Massgeblich
  ist 15.4 — `structuredClone()` sitzt in `SaveSystem.update()` und laeuft
  bei jedem Run-Ende, dazwischen wuerde das Spiel starten und beim ersten
  Speichern abbrechen. Geprueft wird das Bundle statt `src/`, weil Vite auf
  `es2022` transpiliert und alles darueber stehen laesst, auch aus Phaser.
  Der Check schreibt die Grenze fest und bricht ab, wenn eine neue
  Abhaengigkeit sie anhebt.

- **`npm run playtest -- --only=ios`** faehrt die Seite in **echtem WebKit**
  (Safaris Engine) statt in Chromium — sechs iPhone-/iPad-Profile plus ein
  kompletter Run. Die uebrigen Suiten laufen unter Chromium mit
  iPhone-Etikett; das ist Blink, nicht WebKit. Voraussetzung:
  `npx playwright install webkit`.

- **`npm run playtest`** spielt isiHunt automatisiert durch — 71 Pruefschritte
  in sieben Suiten: alle Menue-Bildschirme, Solo in drei Welten plus Tageslauf
  und Bot-Duell, Layout ueber 19 Geraeteformate (iPhone SE bis 17 Pro Max,
  iPad Mini/Air/Pro 11"/Pro 12.9"/gen 7/gen 11, Pixel 7, Galaxy S20 und ein
  bewusst zu kurzes Fenster), sowie Levelaufstieg,
  Muenzen, Erfolge und Spielstand ueber ein Neuladen hinweg. Gesteuert wird
  ueber echte Tastatureingaben, nicht ueber gesetzte Positionen. Moeglich
  ueber `window.isiHunt` aus dem Dev-Build; `.env.playtest` haelt den Lauf
  offline und am Login vorbei. `--watch` zeigt den Lauf in einem sichtbaren
  Fenster, `--only=<suite>` grenzt ein. Details in ARCHITECTURE.md 9.3.

- **`npm run smoke`** startet einen echten Chromium (Playwright) gegen den
  laufenden Dev-Server, laedt die Seite in einem mobilen Viewport und
  schlaegt bei Konsolenfehlern fehl. Kein Ersatz fuer den Pflicht-Handytest
  (ARCHITECTURE.md 10), aber faengt kaputte Boots (z.B. fehlerhafte Imports)
  automatisiert ab. Playwright ist dafuer als `devDependency` dazugekommen.

### Behoben

- **Der Pause-Knopf lag auf fast jedem Geraet unter dem sichtbaren Rand.**
  Phasers ScaleManager misst seinen Elternknoten ueber die Aussenmasse und
  zieht dessen Padding nicht ab. `#game` traegt oben 32 px fuer sichere
  Flaeche und Laufband — Phaser hielt diese 32 px fuer nutzbare Hoehe und
  skalierte den Canvas entsprechend zu gross. Er begann unter dem Padding und
  ragte unten um genau diesen Betrag heraus; betroffen war alles am unteren
  Rand, zuerst der Pause-Knopf bei `GAME_HEIGHT - 58`.
  Gemessen ueber sieben Geraeteformate: sechs schnitten 32 px ab, nur ein sehr
  schmales Format blieb heil, weil dort `GAME_HEIGHT` ueber den Mindestwert
  hinauswaechst. Phaser haengt jetzt an einem eigenen Container
  (`#game-canvas`), der nur die Innenflaeche fuellt; Padding, Hintergrund und
  `padding-bottom: 0` von `#game` bleiben unangetastet.
  **Ein erster Versuch ueber `scale.setParentSize()` half nicht** — Phasers
  `refresh()` misst den Elternknoten sofort wieder selbst und ueberschreibt
  den Wert. Die Layout-Suite des Playtests sichert den Fix jetzt ab.

### Sicherheit

- `saves` und `sync_codes` hatten direkte Tabellenrechte fuer `anon`/
  `authenticated` mit `using (true)`-Policies — dadurch konnte jeder mit dem
  oeffentlichen anon-Key alle Spielstaende lesen/ueberschreiben und alle
  gueltigen Sync-Codes samt `save_id` auflisten. Zugriff laeuft jetzt nur noch
  ueber security-definer-RPCs (`get_save`, `upsert_save`, `create_sync_code`,
  `redeem_sync_code`), siehe ADR-0011-Nachtrag 2026-08-17.
  **`supabase/phase_2_10_lock_saves_access.sql` musste dafuer manuell im
  Supabase SQL-Editor ausgefuehrt werden** — ist bereits erledigt.

### Hinzugefuegt

- **Jeder Backend-Aufruf wird jetzt automatisch im Debug-Ringpuffer
  protokolliert** (Erfolg UND Fehlschlag, nicht nur der Fehlerfall wie
  bisher). `withTimeout()` in `CloudSystem.ts` ist der zentrale Durchgang
  fuer alle ~25 Supabase-Aufrufe - ein einziger Punkt statt manuellem
  Logging pro Funktion. Anlass: der Boost-Sichtbarkeits-Bug (siehe
  "Behoben" unten) brauchte drei Diagnoserunden, weil bisher nur
  `console.warn`/`console.error` im Fehlerfall geloggt wurde - "kein
  Fehler-Log" war dadurch mehrfach mit "kein Problem" verwechselbar.
  Bewusst ohne Nutzlast (kein Session-Token o.ae. im Klartext), nur Label,
  Erfolg/Fehlschlag und Dauer. `DEBUG_LOG_BUFFER_SIZE` von 200 auf 400
  erhoeht, weil dadurch deutlich mehr Eintraege pro Menuebesuch anfallen.
  **Nebenbefund beim Bauen:** `DebugSystem.ts` zog ueber einen statischen
  `SoundSystem`-Import (fuer die Ton-Diagnose im Text-Report) transitiv
  Phaser mit (`SoundSystem → EventBus → Phaser.Events.EventEmitter`) -
  seit `CloudSystem`/`AuthSystem` jetzt selbst `DebugSystem` importieren,
  brach das jeden ihrer Vitest-Laeufe (`CanvasFeatures.js`, kein
  Canvas-Mock in reinen Systemtests). Der `SoundSystem`-Import in
  `buildReport()` ist jetzt dynamisch (`await import(...)`) statt
  statisch - `systems/` bleibt damit Phaser-frei (CODE_STYLE.md 1.6), wie
  es der eigene Modulkommentar in `DebugSystem.ts` immer schon verlangte.
- **Netzwerk-Duell, Phase 1** (ADR-0010 Schritt 2): zwei Geraete koennen
  ueber einen Raum-Code beitreten und gleichzeitig dieselbe Runde starten —
  Uhr-Synchronisation gegen die Supabase-Serverzeit, gemeinsamer Countdown
  bis zu einer serverseitig gesetzten Startzeit, Ergebnisvergleich am Ende.
  Noch **kein** Live-Punktestand waehrend des Laufs, das folgt als Phase 2.
  Neue `OnlineDuelScene`, `NetworkDuelSystem`, `config/onlineDuel.ts`,
  `supabase/phase_2_11_duel_rooms.sql`. Menue umgebaut: JAGD und TAGESLAUF
  teilen sich jetzt die obere Reihe, DUELL und das neue DUELL2G die zweite.
  **`supabase/phase_2_11_duel_rooms.sql` musste dafuer manuell im Supabase
  SQL-Editor ausgefuehrt werden** — ist bereits erledigt.
- **Welt-Detailscreen vor jedem Run:** `WorldInfoScene` zeigt Besonderheit,
  Hindernismodus und Punkt-/XP-Bonus einer Welt in Klartext, bevor
  JAGD/DUELL/TAGESLAUF starten.
- **`attachVerticalScroll()` in `widgets.ts`:** gemeinsamer Touch-Drag-/
  Mausrad-Scroll fuer Unterseiten, deren Karten die sichtbare Hoehe
  uebersteigen koennen. Vorher zweimal fast identisch dupliziert
  (`SettingsScene`, `AdminScene`); `ProfileScene` brauchte beim
  Zusammenlegen mit dem AccountScene-Profilbereich (siehe unten) dieselbe
  Mechanik ein drittes Mal.

### Geaendert

- **Zwei "Profil"-Bildschirme zu einem zusammengefuehrt** _(2026-08-18,
  Nutzerwunsch: "es gibt zwei benutzer profil menüs ... fasse diese beiden
  zusammen")_. Der Hauptmenue-Knopf "PROFIL" (Name, Level, Statistik,
  `ProfileScene`) und der Weg ueber Einstellungen → "PROFIL ÖFFNEN"
  (Alias, "PROFIL ABGLEICHEN", "ABMELDEN", vorher der eingeloggte Zustand
  von `AccountScene`) zeigten auf zwei fachlich verschiedene Bildschirme
  mit gleichem Namen. `ProfileScene` ist jetzt das einzige Ziel fuer beide
  Wege, unabhaengig vom Login-Status: eingeloggt zeigt sie zusaetzlich
  Alias/Abgleichen/Abmelden, nicht eingeloggt einen Anmelden-Knopf zu
  `AccountScene`. `AccountScene` behandelt nur noch den eigentlichen
  Login-/Registrierungsvorgang und leitet bei bereits bestehender Sitzung
  sofort zu `ProfileScene` weiter (`buildSignedIn()`/`signOut()` dort
  entfernt). Die zusaetzliche Karte kann `ProfileScene` auf kleinen
  Geraeten ueber die sichtbare Hoehe hinaus verlaengern - die Seite ist
  jetzt per Touch-Drag/Mausrad scrollbar (siehe `attachVerticalScroll()`
  oben). **Ungeprueft:** das Zusammenspiel aus Container-Scroll und dem
  DOM-basierten Namens-Textinput auf einem echten Geraet - dieser
  Kombination gab es im Projekt bisher nicht.

- Diagnose-`console.warn`-Aufrufe in `AccountScene.signIn()` und
  `MenuScene.checkCloudSave()`/`synchronizeData()` wieder entfernt. Sie
  hatten ihren Zweck erfuellt: Der Login-Aussperr-Fall nach ADR-0017 ist
  geklaert (siehe "Behoben" unten), der Sync-Fall war bereits vorher inhaltlich
  gefixt.
- Talent-Reset kostet jetzt 100 statt 200 Coins — ein frueher Fehlkauf war
  fast so teuer wie der naechste Rang selbst und bremste Experimentieren.
- Talent _Gunst_ (Punkte) gibt jetzt +5 % pro Rang statt +4 % — damit ist es
  bei identischen Kosten gleich stark wie _Erkenntnis_ (XP).
- Admin-Wartungsboost (`admin_boost_user`) setzt jetzt 50000 statt 5000
  Coins. **Die SQL-Funktion in `supabase/phase_2_7_admin_tools.sql` muss
  dafuer manuell im Supabase SQL-Editor neu ausgefuehrt werden**, der
  Client-Fix allein reicht nicht.
- `MenuScene.checkCloudSave()`/`synchronizeData()` protokollieren jetzt
  Diagnosedaten (`console.warn`) zu jedem Entscheidungspunkt des
  automatischen Profil-Abgleichs. Anlass: ein Boost auf ein anderes Geraet
  kam dort nicht automatisch an, obwohl der manuelle "PROFIL ABGLEICHEN"-
  Button in den Einstellungen sofort funktionierte — die Ursache dafuer ist
  noch nicht gefunden, die Logs sollen den naechsten Fall beweisbar machen.
- Alle sichtbaren "5000 Coins"-Texte im Wartungsbereich (`AdminUsersScene`)
  auf 50000 nachgezogen; zwei Stellen hatte der vorige Boost-Fix noch nicht
  erfasst.
- **Login-Alias und Anzeigename sind jetzt derselbe Wert** (ADR-0017). Bisher
  liefen beide unabhaengig auseinander — Admin-Login-Alias `byi77`,
  Anzeigename `Yavuz` zum Beispiel — und das Wartungsdashboard zeigt den
  Anzeigenamen, waehrend Boost/Reset nur nach Alias suchen. Ein gemeldeter
  Spielername war darueber nicht zuverlaessig wiederzufinden. Es gelten
  jetzt ueberall dieselben, strengeren Alias-Regeln (3-16 Zeichen, `a-z`,
  `0-9`, `-`, `_`, klein geschrieben); `sanitizePlayerName` folgt derselben
  Regel. **`supabase/phase_2_8_unify_identity.sql` muss nach
  `phase_2_7_admin_tools.sql` einmalig manuell im Supabase SQL-Editor
  ausgefuehrt werden** — sie migriert Bestandsprofile (Anzeigename gewinnt,
  wird normalisiert und zum neuen Alias) und ersetzt `update_profile_name`/
  `update_profile_alias` durch `update_profile_identity`.

### Behoben

- **Netzwerk-Duell: Realtime-Kanal lehnte jeden Beitritt mit "Unauthorized"
  ab.** Beim ersten Zwei-Geraete-Test (2026-08-18) verweigerte der private
  Broadcast-Kanal die Verbindung, obwohl der Raum-Code korrekt war. Ursache:
  die RLS-Policy auf `realtime.messages` prueft per Subquery gegen
  `duel_rooms`, laeuft dabei aber mit den Rechten der verbindenden Rolle
  (`anon`), nicht als security definer - ohne direkten SELECT-Grant auf
  `duel_rooms` konnte die Policy nicht auswerten. Fix: spaltenbeschraenkter
  Grant nur auf `code`/`expires_at`; `seed` und alle anderen Felder bleiben
  ausschliesslich ueber RPCs erreichbar.
  **`supabase/phase_2_11_duel_rooms.sql` musste dafuer erneut manuell im
  Supabase SQL-Editor ausgefuehrt werden** — ist bereits erledigt.
- **Netzwerk-Duell: ein Verbindungsabbruch des Gegners blieb unbemerkt.**
  Presence-Tracking war wirkungslos: beide Spieler nutzten denselben
  Presence-Key (den Raum-Code statt eines individuellen Schluessels), und
  `channel.track(...)` fehlte komplett - ohne aktives Tracking kann kein
  `leave`-Event entstehen. Fix: `localPlayerIndex` als Presence-Key, `track()`
  nach erfolgreichem Verbinden, ein neuer `GameEvent.OpponentDisconnected`
  zeigt jetzt einen sichtbaren HUD-Hinweis waehrend des laufenden Runs, nicht
  nur in der Lobby.
- **Netzwerk-Duell: der nicht sendende Client blieb unbegrenzt in der Lobby
  haengen ("Warte auf Geschwister ..."), obwohl der Gastgeber laengst
  gestartet war.** Ursache im Code belegt: `broadcastStartTime()`/
  `broadcastReady()` riefen `activeChannel?.send(...)` mit `void` auf.
  Supabase Realtime `RealtimeChannel.send()` loest ohne die Option
  `broadcast.ack` sofort mit `"ok"` auf, sobald die Nachricht lokal in die
  Warteschlange gestellt wurde - nicht wenn sie beim Empfaenger ankam. Ein
  verlorener `start`-Broadcast blieb dadurch komplett unbemerkt, waehrend
  `set_duel_start_time` die Startzeit bereits erfolgreich serverseitig
  gespeichert hatte. Fix: `OnlineDuelScene` pollt jetzt zusaetzlich zum
  Broadcast-Handler alle 1,5s (`ONLINE_DUEL_START_POLL_INTERVAL_MS`, neu in
  `config/onlineDuel.ts`) `getRoomStatus()` fuer beide Rollen - findet die
  bereits gespeicherte Startzeit unabhaengig vom Broadcast.
  **Nebenbefund:** `NetworkDuelSystem` hatte eine eigene, duplizierte
  `withTimeout`-Funktion, die das automatische Erfolgs-/Fehler-Logging vom
  Boost-Bug-Fix nicht mitbekommen hatte - ein Zwei-Geraete-Testreport zeigte
  dadurch nicht einen einzigen `NetworkDuelSystem`-Eintrag, obwohl das Duell
  aktiv lief. Jetzt ebenfalls behoben (`duel:*`-Eintraege im Ringpuffer).
  **Ungeprueft:** ob der Fix den Slave tatsaechlich starten laesst - noch
  kein erneuter Zwei-Geraete-Test.
- **Offline-Fortschritt blieb nach Netzwiederkehr haengen, bis App-Neustart
  oder ein weiteres `online`-Ereignis.** Beim Phase-2.6-Geraetetest mit zwei
  iPhones (2026-08-17) wurde ein Offline-Run auf einem Geraet trotz Rueckkehr
  ins Menue bei bestehender Verbindung nicht hochgeladen; ein spaeterer
  Abgleich vom anderen Geraet aus ueberschrieb ihn. Per Debug-Report belegt:
  `requireAuthenticatedClient()` (`CloudSystem.ts`) scheiterte an
  `BACKEND_TIMEOUT_MS` (5s), weil iOS das `online`-Ereignis oft meldet, bevor
  die Verbindung zu Supabase tatsaechlich steht. `ProgressSyncSystem` plant
  bei einem Fehlschlag jetzt selbst eine automatische Wiederholung
  (`SYNC_RETRY_DELAYS_MS`: 5s/15s/60s) statt auf den naechsten
  `MenuScene`-Lebenszyklus zu warten.
- `phase_2_8_unify_identity.sql` aktualisierte `profiles.alias`, aber nicht
  die zugehoerige `auth.users.email` — der Login prueft aber genau diese
  E-Mail. Betroffene Konten (u. a. das Admin-Konto) waren nach der Migration
  ausgesperrt: Login mit dem neuen Namen schlug fehl, weil Supabase Auth
  noch den alten Alias in der internen E-Mail erwartete. Ebenso zog
  `update_profile_identity` diese E-Mail bisher nicht nach — jede kuenftige
  Namensaenderung haette denselben Aussperr-Effekt gehabt.
  `supabase/phase_2_9_fix_auth_email_sync.sql` repariert beides: sie
  gleicht `auth.users.email` einmalig an den aktuellen `alias` an und
  ersetzt `update_profile_identity` durch eine Fassung, die die Login-Adresse
  bei jeder Namensaenderung synchron mitzieht. **Muss nach
  `phase_2_8_unify_identity.sql` einmalig manuell im Supabase SQL-Editor
  ausgefuehrt werden.**
  **Nachtrag:** Nach beiden Migrationen blieb der Login trotzdem gesperrt.
  Ursache war keine dritte Code-Luecke, sondern eine falsche Annahme ueber
  die Datenlage — `profiles.player_name` stand fuer das Admin-Konto bereits
  auf `byi77`, nicht auf `Yavuz` wie angenommen. Die Migration hatte damit
  korrekt nichts zu tun. Nach Login mit dem tatsaechlichen, unveraenderten
  Namen (`byi77`) griff die bewusste Namensaenderung auf `yavuz` ueber die
  reparierte `update_profile_identity` und zog `auth.users.email` korrekt
  mit — Login mit `yavuz` funktioniert seitdem.
- Der automatische Profil-Abgleich beim Menuebesuch (auch beim App-Start)
  erkannte einen weiter fortgeschrittenen Cloud-Stand nur an Level, Bestwert,
  Runs, Gesamtpunkten und Coins. Ein Talentkauf, ein neuer Erfolg oder XP-
  Zuwachs auf einem anderen Geraet aendern davon oft keinen einzigen Wert —
  der Abgleich hielt den lokalen Stand dann faelschlich fuer aktuell, und nur
  das manuelle "PROFIL ABGLEICHEN" in den Einstellungen zog den echten Stand.
  `isRemoteAhead`/`isLocalAhead` vergleichen jetzt zusaetzlich Talentraenge,
  Anzahl freigeschalteter Erfolge und Gesamt-XP.
- **Admin-Boost (Level/Coins) war nach App-Start nicht sichtbar, bis manuell
  "PROFIL ABGLEICHEN" getippt wurde** _(2026-08-18, Emre und Simay sowie das
  eigene Testprofil des Entwicklers betroffen)_. Drei Zwischenstaende, bevor
  die tatsaechliche Ursache belegt war — chronologisch dokumentiert, weil
  jeder einzelne Schritt Teil des Belegs ist:
  Erste Hypothese war ein stiller Timeout in `requireAuthenticatedClient()`
  (`checkCloudSave()` erhielt dafuer einen automatischen Retry, analog zum
  bereits geloesten iPhone2-Sync-Bug) — **durch einen zweiten Selbsttest
  widerlegt**: Coins waren klar unter dem Boost-Zielwert, `isRemoteAhead`
  haette ueber die Coins-Bedingung zuschlagen muessen, tat es aber trotz
  Retry nicht. Der mitgelieferte Debug-Report zeigte keinen einzigen
  Fehler-Log, was sich als Beweisluecke statt als Entlastung herausstellte:
  `checkCloudSave()` protokollierte im Erfolgs- wie im Fehlerpfad nichts
  ausser `console.warn`/`console.error`, die der Ringpuffer abfaengt.
  `checkCloudSave()` schreibt jetzt bei jedem Durchlauf Zwischenergebnisse
  (`sync:profilePull`, `sync:remoteAheadCheck`: claimed/profile-Status,
  lokale und Remote-Level/Coins, `isRemoteAhead`-Ergebnis) in den
  Debug-Ringpuffer, bewusst dauerhaft. **Nachtrag:** Der naechste Report
  (v0.1.169, bestaetigt eingeloggt per Alias) zeigte trotzdem keinen
  einzigen `sync:*`-Eintrag — das Logging selbst wurde nie erreicht, ein
  fruehes stilles Abbrechen liegt naeher als ein falsches
  `isRemoteAhead`-Ergebnis. Weiteres Logging ergaenzt: `sync:start` (jeder
  Guard-Zustand beim Betreten von `synchronizeData()`), `sync:threw` (falls
  `checkCloudSave()` eine Exception wirft statt eines `CloudResult`-Fehlers
  — der bisherige `catch`-Block in `synchronizeData()` loggte nichts),
  `sync:checkCloudSave:signedIn` und `sync:afterFlush` (grenzt ein, ob
  `ProgressSyncSystem.flush()` durchlaeuft). Naechster Schritt: erneuter
  Boost, neuer Debug-Report.
  **Richtigstellung:** Der Eintrag unter "Geaendert" oben ("der Sync-Fall
  war bereits vorher inhaltlich gefixt") war verfrueht — die entfernten
  Diagnose-Logs haetten vermutlich geholfen. Der hier zuerst als "Behoben"
  eingetragene Retry-Fix war ebenfalls verfrueht.
  **Tatsaechliche Ursache, belegt durch den v0.1.170-Report:** Jeder
  `sync:start`-Log zeigte `"sceneActive":false`, ausnahmslos bei allen neun
  protokollierten Aufrufen. Nachvollzogen in Phasers eigenem
  `SceneManager.create()`: `scene.create.call(...)` laeuft, und **erst
  danach** setzt Phaser `settings.status = CONST.RUNNING`. `synchronizeData()`
  wird am Ende von `MenuScene.create()` als `void this.synchronizeData()`
  losgeschickt und lief bis zu ihrem ersten `await` synchron im selben Tick
  wie `create()` — in genau diesem Moment lieferte `this.scene.isActive()`
  garantiert `false`. Der Einstiegs-Guard
  `if (this.saveSyncBusy || !this.scene.isActive()) return;` brach deshalb
  bei **jedem** App-Start sofort ab, bevor `checkCloudSave()` je erreicht
  wurde — unabhaengig von Netz, Login-Status oder Boost-Wert. Kein
  Netzwerk-Timeout, keine falsche `isRemoteAhead`-Logik: Beide vorigen
  Zwischenstaende bekaempften ein Symptom, dessen Ursache ausserhalb ihrer
  jeweiligen Hypothese lag. Der Bug bestand schon vor allen drei
  Sync-Commits vom 2026-08-18 — kein Regressions-, sondern ein alter, nie
  belegter Fehler. **Fix:** Der `isActive()`-Teil des Einstiegs-Guards ist
  aus `synchronizeData()` und `checkCloudSave()` entfernt; die spaeteren
  `isActive()`-Checks nach jedem `await` bleiben unveraendert, dort ist
  `create()` laengst zurueckgekehrt und die Pruefung wieder verlaesslich.
- Ton blieb nach App-Kaltstart auf iOS oft dauerhaft stumm, obwohl "TON: AN"
  gesetzt war: Der allererste `AudioContext.resume()`-Aufruf blieb dort
  manchmal fuer immer in der Warteschleife (kein resolve, kein reject). Die
  Diagnoseanzeige im Wartungsbildschirm hat das auf dem Testgeraet
  reproduzierbar gezeigt: "resume() laeuft: ja" auf unbestimmte Zeit. Da
  jeder weitere Tipp im Spiel nur dieselbe haengende Anfrage zurueckbekam,
  half nichts mehr — `resumeAudioContext()` gibt eine haengende Anfrage
  jetzt nach 1,2 Sekunden frei, sodass der naechste Tipp einen frischen
  Versuch bekommt.
- Nach dem Aufwachen aus obigem Zustand kamen mehrere Toene gleichzeitig als
  Haufen statt einzeln: Waehrend `resume()` noch lief, sammelte eine
  Warteschlange jeden angefragten Ton und feuerte beim spaeten `running` alle
  auf einmal ab, ohne den urspruenglich gemeinten zeitlichen Bezug
  zueinander. Die Warteschlange ist entfallen — Toene, die anfallen bevor
  der Kontext laeuft, werden jetzt verworfen statt nachgeholt. Lieber die
  ersten ein bis zwei Sekunden nach Kaltstart still als spaeter ein
  akustisches Durcheinander.
- Ton blieb nach App-Wechsel oder Sperrbildschirm meist stumm: Ein frueherer
  Commit hatte unbeabsichtigt die `click`/`touchend`-Entsperr-Gesten entfernt
  und den `visibilitychange`-Handler so umgebaut, dass er den AudioContext
  beim Verlassen zwar pausierte, bei Rueckkehr aber nicht mehr aktiv
  reaktivierte. Auf iOS Safari zaehlt nicht jede Geste als gueltige
  Nutzeraktivierung fuer `resume()` — `pointerdown` allein reichte oft nicht.
- Der Zeitverlust-Text bei einem Hindernistreffer zeigte einen falschen Wert
  an; er wird jetzt aus dem tatsaechlichen Balancing-Wert berechnet.
- Ein fehlgeschlagenes Schreiben nach einer Spielstand-Migration (z.B. volles
  Speicherkontingent) konnte den migrierten Fortschritt stillschweigend
  durch einen leeren Stand ersetzen.

### Intern

- Wartungsbildschirm zeigt jetzt eine Ton-Diagnose (AudioContext-Status,
  Samplerate, laufender resume()-Versuch) live plus Testton-Knopf. Ohne
  Mac/Safari-Devtools war der AudioContext-Zustand auf dem iPhone bisher
  nicht einsehbar; die Anzeige hat sowohl den haengenden resume() als auch
  den Tonhaufen danach reproduzierbar sichtbar gemacht statt Ratearbeit.
- Balancing-Werte in `SpawnSystem`, `ChallengeSystem`, `ProgressionSystem`
  und `InputController` stehen jetzt vollstaendig in `src/config/`.
- Testabdeckung fuer `CloudSystem`, den Bot- und Tagesmodus in
  `ChallengeSystem`, `ProgressSyncSystem`, den Talent-Maximalrang-Guard,
  `SpawnSystem.reset()`/den Solo-Kapazitaetsguard sowie das Talent-x-Welt-
  Multiplikatorprodukt in `ScoreSystem` nachgezogen.

### Erststart und Profil

- Beim ersten Online-Start wird ein gemeinsames Profil mit Alias und
  sechsstelliger PIN angelegt; offline entsteht zunächst ein lokales Profil.
- Neue Profile verwenden einen PIN statt eines Passworts. Bestehende Konten
  bleiben vorübergehend mit ihrem bisherigen Zugang kompatibel.

### Hinzugefuegt

**Phase 5: Herausforderung**

- Tages-Herausforderung mit UTC-Tagesseed je Welt.
- Bot-Duell mit deterministischer Bewertung und drei internen
  Schwierigkeitsstufen.
- Weltmodifikatoren für Trägheit, kurze Lebensdauer, Sichtbarkeitsblinken und
  seltene Planeten.
- Sichtbare Hindernisse: Bremsfelder in mittleren Welten und Zeitverlust in
  den späten Welten; die Einstiegswelt bleibt frei davon.
- Erste Balancing-Runde: Hindernischance, Trägheit, Lebensdauer und Strafen
  abgeschwächt; die Grundbelohnung pro Solo-Runde steigt auf 30 Coins.
- Lokale Altspielstände schreiben ihre Talentpunkte- und Levelcoin-Migration
  sofort fest, damit sie nach einem Neustart nicht doppelt gutgeschrieben wird.

**Phase 4: Belohnung**

- Auffaelligere Punkte-Popups mit sichtbarem x2-Serienbonus ab drei gleichen
  gruenen, blauen, lila oder orangenen Relikten in Folge.
- Coins fuer jede abgeschlossene Runde, eingesammelte Relikte, neue Erfolge und
  Levelaufstiege.
- Talentbaum im Profil mit steigenden Coin-Kosten je Rang und kostenpflichtigem
  Reset.
- Atomare Talent-RPCs fuer angemeldete Mehrgeraete-Profile.
- Die Talentkosten sind auf 400 Coins für Rang 1 und jeweils 100 Coins mehr
  pro weiterem Rang angepasst; Zielwert ist etwa ein Rang je fünf Runden.
- Ranglisten-Einträge speichern und zeigen jetzt zusätzlich das Spielerlevel.

### Geaendert

- Der manuelle Geräte-Transfer wurde aus den Einstellungen entfernt. Angemeldete
  Profile synchronisieren sich automatisch; der alte Sync-Code bleibt nur als
  interner Migrationsweg für anonyme Alt-Spielstände erhalten.

**Phase 2.6: Login und Mehrgeräte-Profil**

- Freiwilliger Supabase-Login in den Einstellungen mit Alias/Passwort; eine
  E-Mail-Adresse wird vom Spieler weder benötigt noch angezeigt.
- Der Alias wird intern auf eine pseudonyme Auth-ID abgebildet. Für den
  alias-only Login muss die E-Mail-Bestätigung in Supabase deaktiviert sein;
  eine Wiederherstellung per E-Mail gibt es bewusst noch nicht.
- Gemeinsamer Profilstand für iPhone und iPad; das lokale Spiel bleibt ohne
  Login und offline nutzbar.
- Offline-Outbox für angemeldete Solo-Runs mit eindeutiger Ereignis-ID sowie
  serverseitige idempotente Zusammenführung von XP, Coins, Erfolgen und
  Bestwerten.
- SQL-Migration unter `supabase/phase_2_6_auth.sql`; sie muss nach
  `schema.sql` im Supabase SQL Editor ausgeführt werden.

**Tests**

- Vitest eingerichtet (`npm run test`, `npm run test:watch`). 62 Tests decken
  `ScoreSystem`, `ProgressionSystem` und `ChallengeSystem` ab: Combo-Zerfall
  und Multiplikatorstufen, XP-Kurve und Maximalstufe, Weltenfreischaltung,
  Erfolge sowie Sieger- und Gleichstandsermittlung im Duell.
- Die Tests haengen in `npm run verify` und laufen dadurch bei jedem Push
  (`pre-push`), in der CI und vor jedem Deploy.

**Phase 3: Weltraum-Thema**

- ADR-0013 legt den Wechsel von Fantasy zu Weltraum fest; Welt-IDs bleiben
  fuer bestehende Spielstaende unveraendert.
- Die Spielfigur ist jetzt ein Licht-Raumschiff und einsammelbare Relikte
  werden als tintbare Planeten mit Orbit dargestellt.
- Die Raumzonen heissen jetzt Sternenweide, Eisring, Glutnebel, Nullsektor und
  Sonnenkrone.
- Jede Raumzone hat eine eigene feste Stern-/Nebelkomposition mit passenden
  Hintergrundplaneten und Sternfarben.
- Das Raumschiff wechselt bei Level 5, 15, 30, 50, 75 und 100 auf jeweils
  sichtbar ausgebaute Skins; im Duell bleibt die Darstellung fairerweise
  neutral.
- Echte Planetentexturen je Raumzone und ein neues isiHunt-Logo wurden als
  vorab geladene PNG-Assets eingebaut.
- Die einsammelbaren Relikte zeigen jetzt diese echten Planetensprites passend
  zur Welt; die Seltenheitsfarben bleiben ueber Glow und Strahlenkranz lesbar.
- Das Logo nutzt ausschliesslich Gelb, Weiss, Cyan, Blau und Gruen — ohne Rot,
  Orange oder andere rotnahe Akzentfarben.

**Wartung und Safe Area**

- Zurueck-Navigation liegt jetzt auf allen Unterseiten unten links; die
  Versionsangabe sitzt unten rechts am Bildschirmrand.
- Der Update-Hinweis im Hauptmenue ist jetzt als grosser, klarer Ladebutton
  gestaltet; die unauffaellige Ueberschrift der Weltenauswahl wurde entfernt.
- Im Profil stehen Level, Bestwert und Coins jetzt mittig; die Beschriftung des
  Namensfeldes hat wieder ausreichend Abstand zum Eingabefeld.
- Der Wartungsmodus zeigt im Layout-Block jetzt auch erkannte Geraete-,
  Display-, Browser-, CPU-, Netzwerk- und Webspeicher-Daten.
- Eine Namensaenderung im Profil wird jetzt auch auf den bestehenden eigenen
  Ranglisteneintrag uebertragen.
- Die Laufzeile liegt unterhalb des iOS-Systemblurs und wird ohne unscharfen
  Textschatten gezeichnet. Der notwendige Schutzbereich darueber ist
  transparent und zeigt den Welt-Hintergrund statt eines blauen Leerfelds.
  Der Canvas reicht zugleich bis in die untere Home-Indicator-Safe-Area,
  sodass dort kein eigener Balken entsteht.
- Phase 3.5: prozedurale WebAudio-Toene fuer Klicks, Faenge, Combo-Stufen,
  Run-Start, Run-Ende und Levelaufstieg; der Ton ist in den Einstellungen
  abschaltbar und bleibt gespeichert.
- Farbige Planeten (gruen, blau, lila, orange) haben jetzt mehrstimmige,
  deutlich epischere Fangklaenge; das Scrollen durch die Welten spielt einen
  eigenen Auswahlton.
- Der Bereich oberhalb von Spielpixel 0 wird jetzt auf Geraeten mit Safe Area
  genutzt: Im Menue laeuft dort eine dezente Infozeile, waehrend des Runs steht
  dort die verbleibende Zeit in Sekunden.
- Falls iOS keinen oberen Safe-Area-Wert meldet, bleibt die Anzeige dank eines
  28-Pixel-Fallbacks trotzdem sichtbar; der Canvas wird entsprechend nach unten
  verschoben.
- Die Audio-Freischaltung ist robuster gegen iOS-PWA-Unterbrechungen; nach
  App-Wechsel oder Sperrbildschirm kann der Sound beim nächsten Tipp wieder
  aufgenommen werden.
- Der Wartungsmodus wird durch drei kurze Tipps auf die Versionsangabe und
  anschliessend langes Gedrueckthalten geoeffnet.

- Der Spielverlauf fuellt jetzt auch den gepaddeten Spielcontainer; dadurch
  bleibt die untere Safe Area auf iOS farbig statt weiss.
- Der lokale Spielstand-Reset bleibt im Admin-Menue sichtbar, ist waehrend der
  laufenden Testphase aber voruebergehend deaktiviert.
- Der Spielstart wartet in iOS-Home-Screen-Apps auf die endgueltige
  Viewport-Hoehe, bevor Phaser die interne Spielflaeche berechnet. Dadurch
  entsteht nach dem PWA-Start kein FIT-Balken mehr durch eine zu kleine
  Anfangshoehe.
- Der Bestwert steht jetzt im Profilblock des Hauptmenues und direkt neben dem
  Level im Profilbildschirm; die doppelte Anzeige unten im Menue entfaellt.
- Der technische Steuerungshinweis am unteren Bildschirmrand wurde aus dem
  Hauptmenue entfernt.
- Fuer installierte iOS-Web-Apps wird die WebKit-Viewport-Umgehung mit
  `100vh` aktiviert, damit die System-Safe-Area nicht als weisser Bereich
  ausserhalb der Web-Seite erscheint.

**Geraetehoehe und Hochformat**

- Die interne Portraithoehe waechst auf hohen, schmalen Handys mit der
  verfuegbaren sicheren Flaeche; die zusaetzliche Hoehe wird als Spielfeld
  genutzt und hinterlaesst keine FIT-Streifen im Canvas.
- Hochformat wird ueber das PWA-Manifest und die Screen-Orientation-API
  angefordert. Browser ohne diese API zeigen im Querformat einen klaren
  Hochkant-Hinweis statt eines seitlich unbedienbaren Spiels.

**Online: Bestenliste und Spielstand-Abgleich** (Supabase)

- Der Menüpunkt `BESTENLISTE` heißt jetzt `RANGLISTE`; er hat die Größe des
  Hauptbuttons und steht unter `DUELL ZU ZWEIT`. `EINSTELLUNGEN` steht allein
  mittig am unteren Menübereich.
- Coins werden im Spielstand gespeichert; bei voll ausgebautem Talentbaum
  werden ueberschuessige Talentpunkte automatisch in Coins umgewandelt.
- Der Ergebnisbildschirm erklaert diese Umwandlung sichtbar.
- Spielstaende werden nach Solo-Runs automatisch gesichert; Offline-Runs
  bleiben lokal und werden beim naechsten erreichbaren Abgleich nachgeladen.
- Der Menuepunkt `SPIELSTAND` heisst jetzt `EINSTELLUNGEN`; die
  Profiluebertragung auf ein anderes Geraet liegt dort als kindgerechte Option.
- Ein weiterentwickelter Cloud-Stand wird beim Start angezeigt und nur nach
  ausdruecklicher Entscheidung uebernommen.
- gemeinsame Bestenliste ueber alle Welten, Top 10, eigener Eintrag
  hervorgehoben; Weltentabs bleiben als Filter erhalten
- Weltfarbe als Marker pro Zeile, damit die Herkunft in der Gesamtliste
  sichtbar bleibt
- Jeder Solo-Run wird automatisch eingetragen, wenn ein Name gesetzt ist;
  ohne Namen, ohne Backend oder bei einem Fehler bleibt der Ergebnisbildschirm
  unveraendert
- Spielstand zwischen Geraeten per sechsstelligem Code, **ohne Konto,
  Passwort oder E-Mail**; der Code gilt 15 Minuten
- Sind zwei Spielstaende vorhanden, werden beide mit Level, Bestwert und
  Anzahl Runs gegenuebergestellt — uebernommen wird erst auf Ansage
- Profil mit Namensabfrage beim ersten Start, Lichtfigur und spaeterer Aenderung
  des Namens
- Namensfeld aus der Bestenliste entfernt; der Name wird im Profil gepflegt
- Level im Profil und im Hauptmenue prominent sichtbar
- Weltenauswahl als vertikaler Carousel: eine Welt im Fokus, Nachbarn kleiner
  und geblurt, Auswahl per Hoch-/Runter-Wischen
- Bestenliste pro Cloud-Profil auf genau einen Eintrag begrenzt; nur der beste
  Lauf bleibt, umgesetzt ueber einen atomaren Supabase-RPC
- Solo-Runs auf 90 Sekunden verlaengert, XP-Kurve auf `floor(750 · √n)`
  umgestellt und bei Level 100 gedeckelt; alte lokale Spielstaende werden
  automatisch auf die neue Kurve migriert
- Ohne Zugangsdaten laeuft das Spiel unveraendert weiter; der automatische
  Eintrag wird dann einfach uebersprungen
- Datenbankschema samt Rechten und Zugriffsregeln in `supabase/schema.sql`

> **Bekannte Grenze:** Punktestaende sind manipulierbar. Das Spiel laeuft im
> Browser, und ohne serverseitige Nachrechnung eines Runs laesst sich das
> nicht verhindern. Der Server schuetzt aber den Bestwert je Profil vor
> schlechteren Nachtraegen. Siehe ADR-0011.

**Duell-Modus fuer zwei Spieler**

- Zwei Personen spielen abwechselnd an einem Geraet, je 90 Sekunden
- Beide bekommen **dieselbe Relikt-Abfolge** — gleicher Seed, gleiche
  Seltenheiten, gleiche Positionen, gleiche Zeitpunkte
- Faire Bedingungen: keine Talente, und der Spielstand bleibt unberuehrt
- Einfuehrung, Uebergabe-Bildschirm und Ergebnis mit Sieger und Punktabstand
- Vorlage des Gegners im HUD; wird sie ueberholt, wird das gefeiert
- "Revanche" startet ein neues Duell mit frischem Seed

**Vollbild und Installation**

- PWA-Manifest — das Spiel laesst sich auf den Home-Bildschirm legen und
  laeuft dann ohne Adressleiste
- App-Icons, erzeugt von `scripts/generate-icons.mjs` (`npm run icons`)
- Vollbild-Knopf im Menue, wo die Fullscreen-API verfuegbar ist
- Auf dem iPhone stattdessen ein Hinweis auf "Zum Home-Bildschirm" — Safari
  kennt dort keine Fullscreen-API

**Wartungsbildschirm und Update-Erkennung**

- **`version.json`** entsteht beim Build und liegt neben der `index.html`. Sie
  sagt, welcher Stand **verfuegbar** ist — die eingebaute Nummer sagt nur,
  welcher **geladen** wurde. Erst der Vergleich deckt einen haengenden Cache auf
- **Hinweis im Menue**, wenn eine neuere Fassung bereitliegt: ein Tipp laedt
  sie. Nur als Angebot, nie selbsttaetig — ein Neustart mitten im Run waere das
  Gegenteil von hilfreich
- **Wartungsbildschirm** (`AdminScene`) mit Version, Startweg (Browser oder
  Home-Bildschirm), "Neu laden erzwingen" und Spielstand zuruecksetzen.
  Erreichbar ueber **langen Druck auf die Versionsnummer** — auffindbar fuer
  den, der davon weiss, unauffaellig fuer alle anderen. Ein sichtbarer
  Reset-Knopf waere fuer ein Kind eine Falle
- Das Zuruecksetzen braucht **zwei Tipps**; der erste bewaffnet nur
- `forceReload()` haengt einen neuen Suchteil an die Adresse. Ein blosses
  `location.reload()` genuegt auf iOS nicht — der Standalone-Modus beantwortet
  die Anfrage weiterhin aus seinem eigenen Speicher

**Pixel-Lineal** _(im Wartungsbildschirm)_

- Legt ein beschriftetes Raster über den gesamten Bildschirm: `0` liegt am
  tatsächlichen oberen Viewport-Rand hinter Uhr/Dynamic Island, die letzte
  Linie an der unteren Displaykante. Gemessen wird in CSS-Pixeln, unabhängig
  von Position und Skalierung des Spielfelds
- Zeichnet zusaetzlich die **sicheren Raender** ein und nennt die Balkenhoehen
- Damit wird aus "oben ist ein Balken" die Aussage "von 0 bis 160 ist
  schwarz" — eine Zahl, die sich nachrechnen laesst, statt einer Beschreibung,
  die eine Rueckfrage kostet

### Behoben — dritte Runde (iPhone 16 Pro)

- **Die Streifen ausserhalb des Spielfelds sind nicht mehr schwarz.** Das
  Spielfeld ist 9:16, moderne Handys sind schmaler — oben und unten bleiben
  rund 160 CSS-px frei. Dort stand ein harter schwarzer Balken neben einem
  farbigen Verlauf. Die Streifen tragen jetzt die Randfarben der aktuellen
  Welt (`--world-top` / `--world-bottom`, gesetzt von `createWorldBackdrop`),
  sodass die Naht verschwindet

- **Der Zurueck-Knopf verschwand hinter der Dynamic Island.** `viewport-fit=cover`
  laesst die Seite bis unter die Island reichen — richtig fuer den Hintergrund,
  falsch fuer das Spielfeld. `#game` bekommt jetzt ein Padding in Hoehe der
  sicheren Raender; der Hintergrund bleibt randlos, das Spielfeld rutscht
  hinein. Das verschiebt **das ganze Spiel**, nicht nur einen Knopf
- **Der Wartungsbildschirm zeigt die Layout-Werte des Geraets**: Fenstergroesse,
  sichere Raender, Balken oben und unten, Massstab. Ein Browser-Simulator kann
  iPhone-Groessen nachstellen, aber keine sicheren Raender — diese Klasse
  Fehler ist nur auf dem Geraet zu finden
- **Das Code-Feld lag weiterhin auf dem Knopf.** Der Abstand ist von 74 auf
  172 Spielpixel erhoeht. Zwei Anlaeufe mit "rechnerisch reicht das" sind
  gescheitert; im Dev-Build meldet der Bildschirm jetzt die **tatsaechliche**
  Position des Feldes, statt sie zu berechnen

### Behoben — zweite Runde

- **Die Versionsnummer stand zweimal unten rechts.** Sie war in derselben
  Sitzung doppelt eingebaut worden: im DOM (`main.ts`) und zusaetzlich im Canvas
  (`MenuScene`). Die Canvas-Variante ist entfernt; das DOM gewinnt, weil es die
  Nummer auch dann zeigt, wenn Phaser gar nicht erst startet
- **Das Code-Feld sass auf dem Knopf "CODE EINLOESEN".** Nachgemessen: 24
  Spielpixel Abstand, auf dem iPhone rund 13 CSS-px. Zu wenig fuer ein
  HTML-Eingabefeld, das ueber dem Canvas liegt und bei offener Systemtastatur
  zusaetzlich verschoben wird. Jetzt 74 px — rund eine Fingerbreite

**Versionierung und Auslieferung**

> Anlass: Vier Runden Fehlersuche an den Trefferflaechen liefen gegen einen
> Stand, den das Testgeraet nie geladen hatte — dort lief durchgehend v0.1.0.
> Jede Rueckmeldung beschrieb korrekt den **alten** Code.

- Jeder Commit zieht die Patch-Version hoch (`.githooks/pre-commit` →
  `scripts/bump-version.mjs`), einmalig zu aktivieren mit
  `git config core.hooksPath .githooks`
- **`.githooks/pre-push` blockiert Pushes ohne Versionssprung** und faehrt
  ausserdem `npm run verify` — der vorige Push ging mit roter CI raus, weil
  `format:check` in der lokalen Kette fehlte
- **Der Deploy prueft sich selbst.** Vorher liefen CI und Deploy unabhaengig auf
  denselben Push; eine rote CI hielt den Deploy nicht auf. Jetzt faehrt der
  Deploy `verify` und bricht ab, statt einen roten Stand auszuliefern
- **Die CI prueft den Versionssprung** gegen `HEAD~1` — unabhaengig davon, ob
  die lokalen Hooks eingerichtet sind oder mit `--no-verify` uebergangen wurden
- **`npm run deploy:check` / `deploy:wait`** (`scripts/check-deploy.mjs`) fragt
  den Server: laedt die `index.html`, folgt ihr zum gehashten Bundle und liest
  die ausgelieferte Version — denselben Weg geht auch der Browser. Damit meldet
  sich die Kette von selbst, statt auf Aufmerksamkeit angewiesen zu sein
- Der Deploy-Workflow schreibt die ausgelieferte Version in die
  Lauf-Zusammenfassung
- **`index.html` ist `no-cache`.** JS und CSS tragen einen Inhalts-Hash und
  duerfen gecacht werden; die `index.html` ist die einzige Stelle, die auf die
  neuen Hashes zeigt — aus dem Cache blockiert sie jeden Deploy
- **Die Nummer steht im DOM** (unten rechts), nicht nur im Canvas: sichtbar
  auch dann, wenn Phaser gar nicht erst startet
- `npm run verify` faehrt dieselbe Kette wie die CI, inklusive `format:check` —
  dessen Fehlen in der lokalen Pruefung hatte die CI rot gemacht
- `scripts/bump-version.mjs` ersetzt gezielt nur die Versionszeile, statt die
  `package.json` neu zu serialisieren — sonst wuerde jeder Commit die
  Formatierung umschreiben

**Diagnosewerkzeug fuer Trefferflaechen**

- `src/ui/hitDebug.ts`, eingeschaltet mit `?hitboxes` in der Adresse (nur im
  Dev-Build). Zeichnet jede Trefferflaeche, markiert jeden Tipp und zeigt die
  Umrechnungswerte als Text ueber dem Canvas — lesbar auch auf einem iPhone
  ohne angeschlossenen Mac
- Meldet ausdruecklich `<<< WIDERSPRUCH`, wenn Phaser ein anderes Objekt
  meldet, als die Geometrie hergibt

**Pause und Abbruch im Run**

- Pause-Knopf unten rechts im HUD — bisher gab es das nur als Debug-Taste `P`,
  die im fertigen Build nicht existiert
- Pause-Bildschirm mit "Weiter" und "Run verlassen"
- Ein abgebrochener Run wird **nicht gewertet**: kein XP, kein Bestwert, kein
  Erfolg. Sonst gaebe es einen Grund, jeden mittelmaessigen Run wegzuwerfen
- **Im Duell haelt die Simulation nicht an.** Wer pausieren koennte, waehrend
  ein legendaeres Relikt erscheint, duerfte in Ruhe zielen — das bricht die
  Fairness gegenueber dem ersten Spieler. Aussteigen bleibt moeglich, beendet
  dann aber das ganze Duell

**Grafik**

- Relikte sind geschliffene Steine mit acht Facetten statt glatter Kugeln
- Strahlenkranz hinter seltenen Relikten, gegenlaeufig rotierend
- Schockwelle beim Einsammeln; Fang-Partikel sind jetzt Splitter statt Punkte
- Lichtspur hinter der Figur, sobald sie sich bewegt
- Hintergrund in fuenf Ebenen: Verlauf, Horizontschein, Farbwolken, zwei
  Parallax-Ebenen — dazu eine Vignette
- Leuchtende Fortschrittsbalken, Schein hinter Knoepfen, abgesetzte Panels
- Farbmarke je Welt in der Weltenliste

### Behoben

**Nach dem ersten Spieltest mit Kindern (9 und 11)**

> ### ⚠ Der Knopf-Fehler gilt NICHT als behoben
>
> Vier Anlaeufe, vier gefundene und beseitigte Ursachen — das gemeldete Symptom
> ("rechts neben BESTENLISTE reagiert SPIELSTAND") trat danach weiterhin auf.
>
> **Gemessen und belegt** (Edge headless, echtes Spiel, echte Phaser-API):
> Trefferflaeche `74..318` deckungsgleich mit dem sichtbaren Knopf; Umrechnung
> CSS → Spiel mit Fehler 0,0 auf beiden Seiten; ein Tipp am rechten Knopfrand
> trifft den richtigen Knopf.
>
> **Ungeprueft:** dasselbe auf einem echten iPhone. Bis dahin bleibt der Punkt
> in `TODO.md` offen. Die naechste Runde beginnt mit einer Messung
> (`?hitboxes`), nicht mit einer weiteren Vermutung.

- **Trefferflaeche wanderte mit dem Druck-Effekt.** Der Container wurde beim
  Druecken auf 96 % gestaucht, und Phaser rechnet die Trefferflaeche in der
  Skalierung des Objekts, an dem sie haengt — sie schrumpfte also mit, waehrend
  der Finger schon auflag. Ein Tipp nahe am Rand loeste `pointerdown` aus, fiel
  aus der geschrumpften Flaeche und bekam nie ein `pointerup`. Gestaucht wird
  jetzt nur noch eine innere Gruppe, nie das interaktive Objekt.

- **Trefferflaeche lag um den Objekt-Ursprung verschoben.** Phaser addiert vor
  dem Test `displayOriginX` auf den Punkt — beim Container `width * 0.5`, aber
  nur wenn `setSize()` gelaufen ist, sonst 0. Dieselbe Rechteck-Definition war
  dadurch mal richtig und mal um eine halbe Knopfbreite daneben; daher die
  wechselnden Symptome ("rechts geht nicht" / "links geht nicht").

  Die Ausrichtung wird jetzt **gemessen statt gerechnet**
  (`makeAlignedHitArea`): Der Mittelpunkt des Knopfes muss ein Treffer sein,
  sonst wird das Rechteck verschoben. Das bleibt richtig, egal wie Phaser
  intern normalisiert.

- **Ein leicht wandernder Finger brach den Tipp ab.** Verliess der Finger
  zwischen Aufsetzen und Abheben die Flaeche um ein Pixel, passierte nichts
  mehr. Jetzt zaehlt der Tipp, solange er auf demselben Knopf endet.

- **Die Trefferflaechen sind wieder genau so gross wie die Knoepfe.** Der
  Versuch, sie ueber den Lichtschein hinaus zu vergroessern, war ein Fehlschlag:
  61 px unsichtbare Flaeche pro Knopf, und bei einer Ueberlappung gewinnt in
  Phaser das zuletzt erzeugte Objekt — nicht das naeherliegende. Genau so
  erwischte ein Tipp rechts neben BESTENLISTE den Knopf SPIELSTAND.

- **Die Weltenauswahl in der Bestenliste war kaum treffbar.** Die Marker sind
  auf 34 % skaliert und waren selbst interaktiv, also schrumpfte die
  Trefferflaeche mit: rund 12 CSS-Pixel, ein Viertel des Mindestmasses aus
  `ART_STYLE.md` 8. Jetzt 50 CSS-Pixel.

- **`viewport.ts` rechnete mit halb erneuerten Werten.** Vor jeder Beruehrung
  wurde die Canvas-Position neu gemessen, aber nur per `updateBounds()`. Das
  erneuert `canvasBounds`, **nicht** `displayScale` — und Phaser braucht beide
  zusammen (`spielX = (seitenX - bounds.left) * displayScale.x`). Jetzt laeuft
  die volle `refresh()`, aber nur wenn sich die Masse tatsaechlich geaendert
  haben.

- **Der Zurueck-Knopf der Bestenliste war nicht erreichbar.** Er lag unter dem
  Namensfeld, und dieses ist ein echtes HTML-Element ueber dem Canvas — es
  liegt immer obenauf, erst recht bei offener Systemtastatur.
- **Zurueck-Knoepfe waren nicht auffindbar**, weil sie auf jedem Bildschirm
  woanders standen. Sie sitzen jetzt einheitlich oben links.
- **Der iOS-Vollbildhinweis wurde uebersehen.** Er stand klein und grau in der
  Fusszeile; auf dem iPhone ist er aber der einzige Weg zum Vollbild
  (ADR-0009). Jetzt in einem eigenen Kasten.
- Aufraeumen nebenbei: Ein deaktivierter und wieder aktivierter Knopf verlor
  seine vergroesserte Trefferflaeche, weil `setInteractive()` ohne Argumente
  auf die Containergroesse zurueckfaellt.
- Im Ergebnisbildschirm ueberlappten sich "IN DIE BESTENLISTE" und "NOCHMAL"
  um 1 px, und die Statuszeile lag im Knopf darunter. Beim Nachmessen aller
  Knopfpaare aufgefallen — nicht durch das Spielen.
- Ein waehrend des Countdowns abgebrochener Run startete danach trotzdem: Der
  Countdown laeuft ueber `delayedCall` und laesst sich nicht zurueckrufen.

**Sonstiges**

- "1 Relikte" und "1 Runs" heissen jetzt "1 Relikt" und "1 Run"

### Geaendert

- **CI und Deploy fahren jetzt Node 24 statt Node 20.** Die Testumgebung
  `jsdom` verlangt `^22.22.2 || ^24.15.0 || >=26`; unter Node 20 brach der
  Testlauf mit `markAsUncloneable is not a function` ab. `engines` in der
  `package.json` steht entsprechend auf `>=22.22.2` statt `>=20.0.0`.
- **Der `pre-push`-Hook wechselt jetzt in Gits normalisiertes
  Wurzelverzeichnis.** Git startet Hooks unter Windows mit kleingeschriebenem
  Laufwerksbuchstaben; Vitest legte seine Module daraufhin unter `C:/...` ab,
  suchte den Runner aber ueber `c:/...` und brach mit "failed to find the
  runner" ab — ausschliesslich im Hook, waehrend dieselbe Suite in jeder Shell
  gruen lief.
- Die Testeinstellungen stehen jetzt in einer eigenen `vitest.config.ts`, die
  Alias und `define` per `mergeConfig` aus der Vite-Config erbt.
- **`ScoreSystem` importiert Phaser nicht mehr.** Der Import bestand fuer ein
  einzelnes `Math.Clamp`, zog aber die komplette Engine samt Canvas-Erkennung
  mit und machte die Datei ausserhalb eines Browsers unbenutzbar. Ersetzt durch
  eine Standardrechnung; damit gilt Regel 1.6 (Systeme kennen Phaser nicht)
  wieder ohne Ausnahme fuer diese Datei.
- Die CI fuehrt jetzt einen eigenen Test-Schritt aus. Sie ruft die Stufen
  einzeln auf statt `verify`, wodurch neue Tests dort sonst nie gelaufen waeren
  — dasselbe Muster, das zuvor schon einen Push mit rotem `format:check`
  durchgelassen hat.
- **Spawn-System ist deterministisch geworden.** Der Zufallsgenerator wird
  jetzt unabhaengig vom Spielverlauf verbraucht: ein volles Spielfeld haelt
  den Takt nicht mehr an, und die Positionssuche bricht nicht mehr frueh ab.
  Ohne beides haetten zwei Duell-Durchgaenge unterschiedliche Runden ergeben.
- Zeichenreihenfolge zentral in `src/ui/depth.ts` statt verstreuter Zahlen
- Duell-Konstanten in `src/config/challenge.ts`, mit den Fairness-Regeln als
  Begruendung

### Dokumentation

- Fuenf neue Architekturentscheidungen: Duell-Bauform (ADR-0008),
  Vollbild-Strategie (ADR-0009), Weg zum Netzwerkduell (ADR-0010),
  Backend ohne Konto samt Manipulierbarkeit (ADR-0011), Zugangsdaten im
  Repository (ADR-0012)
- Die `GRANT`-Falle bei Supabase dokumentiert: `PGRST205 "not found in schema
cache"` heisst im Zweifel "keine Rechte", nicht "Tabelle fehlt". Beim Aufbau
  hat das zwei Fehlversuche gekostet.
- Roadmap-Eintrag "Mehrspieler in Echtzeit — nicht geplant" als ueberholt
  gekennzeichnet und korrigiert
- ADR-0007 (Lizenz) um den Nachtrag ergaenzt, dass das Repository inzwischen
  oeffentlich und die MIT-Lizenz damit wirksam ist

---

## [0.1.0] — 2026-08-12

Erster spielbarer Prototyp.

### Hinzugefuegt

**Spiel**

- Runs von 60 Sekunden mit Countdown
- Sechs Seltenheitsstufen von Schlicht bis Legendaer, mit eigenen Werten fuer
  Punkte, XP, Spawnrate, Lebensdauer, Tempo und Groesse
- Combo-System mit Multiplikator bis ×5; Zerfall ueber Zeit, nicht durch
  verpasste Relikte
- Spawn-System mit Verdichtung zum Run-Ende und Mindestabstand zur Figur
- Fuenf Welten mit eigener Farbstimmung, freigeschaltet ueber das Level

**Fortschritt**

- Charakterlevel mit XP-Kurve `floor(80 · n^1.45)`
- Talentpunkte pro Levelaufstieg
- Sieben Talente — Wirkung implementiert, Vergabe-UI folgt in M2
- 15 Erfolge, geprueft nach jedem Run
- Spielstand in `localStorage`, versioniert und gegen defekte Daten abgesichert

**Einstellungen**

- Impressum mit Programmiererangabe und persoenlichem Dank an Emre und Simay

**Vollbild**

- Safe-Area-Laufschrift bleibt jetzt auch im Browser-Vollbild sichtbar

**Texte**

- Sichtbare deutsche Spieltexte verwenden jetzt echte Umlaute

**Steuerung**

- Touch: Figur laeuft zum Finger, mit Abbremsen nahe am Ziel
- Tastatur: WASD und Pfeiltasten
- Debug-Tasten im Dev-Build (`1`–`6`, `L`, `K`, `J`, `P`, `0`)

**Darstellung**

- Alle Texturen prozedural erzeugt — keine Bilddateien
- Partikel beim Einsammeln, Kamera-Ruckler ab episch
- HUD mit Punktestand, Combo, Timer-Balken und Warnfaerbung
- Menue mit Charakteruebersicht und Weltenauswahl
- Ergebnisbildschirm mit Ausbeute, XP-Balken und Freischaltungen

**Technik**

- TypeScript strict, Phaser 3, Vite
- Typisierter EventBus zwischen Spiel- und HUD-Scene
- Kollision per Distanztest statt Physik-Engine
- Frameratenunabhaengige Bewegung
- ESLint, Prettier, EditorConfig
- GitHub Actions: CI und automatisches Pages-Deployment

**Dokumentation**

- Game Design Document, Architektur, Roadmap, Art Style, Code Style
- Sieben Architekturentscheidungen mit Begruendung (ADR-0001 bis ADR-0007)
- README, Contributing-Leitfaden, PR-Vorlage

[Unreleased]: https://github.com/USER/isiHunt/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/USER/isiHunt/releases/tag/v0.1.0
