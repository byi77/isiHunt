# Changelog

Alle nennenswerten Aenderungen an isiHunt.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Hinzugefuegt

**Online: Bestenliste und Spielstand-Abgleich** (Supabase)

- Bestenliste je Welt, Top 10, eigener Eintrag hervorgehoben
- Eintragen auf Knopfdruck im Ergebnisbildschirm — bewusst nicht automatisch,
  sonst flutet jeder Uebungslauf die Liste
- Spielstand zwischen Geraeten per sechsstelligem Code, **ohne Konto,
  Passwort oder E-Mail**; der Code gilt 15 Minuten
- Sind zwei Spielstaende vorhanden, werden beide mit Level, Bestwert und
  Anzahl Runs gegenuebergestellt — uebernommen wird erst auf Ansage
- Namensfeld in der Bestenliste, echtes Eingabefeld mit Systemtastatur
- Ohne Zugangsdaten laeuft das Spiel unveraendert weiter; die Online-Knoepfe
  erscheinen dann gar nicht erst
- Datenbankschema samt Rechten und Zugriffsregeln in `supabase/schema.sql`

> **Bekannte Grenze:** Punktestaende sind manipulierbar. Das Spiel laeuft im
> Browser, und ohne serverseitige Nachrechnung eines Runs laesst sich das
> nicht verhindern. Eintraege sind immerhin unveraenderlich. Siehe ADR-0011.

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
