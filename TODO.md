# TODO — offene Arbeiten

**Stand:** 2026-08-14 · abgeleitet aus dem Spieltest-Feedback von Emre (11) und
Simay (9)

Reihenfolge nach Nutzen, nicht nach Aufwand.

## Ueberblick

| Phase   | Inhalt                                                   | Aufwand      |
| ------- | -------------------------------------------------------- | ------------ |
| 1       | Bedienbarkeit — **abgeschlossen**                        | —            |
| 1.1     | Zwei UI-Fehler, Wartungsbildschirm — **fertig**          | —            |
| 1.2     | Update-Erkennung — **gebaut, ungeprueft**                | Test noetig  |
| **1.3** | **Bestenliste: gemeinsam + automatisch — abgeschlossen** | —            |
| 2       | Profil, 90 s, XP-Kurve, Level 100                        | mittel       |
| **2.5** | Balken oben/unten — Bildschirm ganz nutzen               | mittel+      |
| 3       | Weltraum statt Fantasy                                   | mittel       |
| **3.5** | Ton (aus M4 vorgezogen)                                  | mittel       |
| **3.6** | Dynamic Island — braucht native App                      | Entscheidung |
| 4       | Bonus, Coins, Talentbaum                                 | mittel       |
| 5       | Modi, Hindernisse                                        | mittel       |
| 6       | Freunde, Realtime, Manipulationsschutz                   | hoch         |

**Fett = neu am 2026-08-13.**

### Entschieden (2026-08-13)

- **Phase 1 ist abgeschlossen.** Auf dem Handy laeuft v0.1.3, die Knoepfe
  reagieren. Der Fehler lag an der Auslieferung, nicht am Code.
- **Bestenliste wird geleert** beim Wechsel auf 90 Sekunden.
- **Ueberschuessige Talentpunkte werden zu Coins.**
- **Bestenliste soll uebergreifend sein** — geprueft: sie ist heute pro Welt
  getrennt. **Nach Phase 1.3 vorgezogen, dringend.**
- **Jeder Run wird automatisch eingetragen** (Variante B, ohne Filterung auf
  Bestwerte). Der Knopf im Ergebnisbildschirm entfaellt.
- **Spielstaende werden automatisch gesichert.** Offline bleibt `localStorage`
  massgeblich; ein besserer Cloud-Stand wird vor der Uebernahme angezeigt.
- **`SPIELSTAND` wird zu `EINSTELLUNGEN`.** Die Profiluebertragung bleibt dort
  als kindgerechter Unterpunkt erhalten.

### Noch offen — erst bei der jeweiligen Phase noetig

- **2.5 Balken:** flexibles Spielfeld oder nur die Balken einfaerben? Ersteres
  betrifft alle Scenes und verschiebt das Balancing.
- **3 Weltraum:** sollen die Dokumente jetzt umgeschrieben werden?
- **3.6 Dynamic Island:** native Umsetzung wird **nach Phase 4** angegangen.
  Vorbereitung und Planung beginnt jetzt; fuer iOS ohne eigenen Mac laufen
  Build und Signierung spaeter ueber macOS-CI/Cloud und TestFlight.
- **5 Hindernisse:** ab welcher Welt darf ein Hindernis bestrafen?
- **6 Manipulationsschutz:** vor oder nach Ranked-Modus und Rekord-Meldungen?

### Querschnitt

- [x] Sichtbare deutsche Spieltexte verwenden echte Umlaute (`ä`, `ö`, `ü`);
      technische IDs und Event-Namen bleiben unverändert.

---

## Erledigt — der Knopf-Fehler lag an der Auslieferung

> **Aufgeloest am 2026-08-13.** Auf dem Testgeraet lief durchgehend **v0.1.0**,
> waehrend lokal laengst korrigiert war. Alle vier Fehlersuchrunden liefen
> gegen einen Stand, den das Handy nie geladen hatte — jede Rueckmeldung
> beschrieb korrekt den **alten** Code und schickte die Suche in eine neue
> falsche Richtung.

**Was daraus folgt** (eingebaut, siehe `CODE_STYLE.md` 1.9):

- [x] `pre-push`-Hook blockiert Pushes ohne Versionssprung
- [x] `index.html` als `no-cache` — sie ist die einzige Datei ohne Inhalts-Hash
      und damit die einzige, die einen Deploy blockieren kann
- [x] Versionsnummer im DOM statt nur im Canvas (auch sichtbar, wenn Phaser
      nicht startet)
- [x] `npm run verify` fuehrt dieselbe Kette wie die CI, inklusive
      `format:check` — dessen Fehlen hatte die CI rot gemacht, ohne dass es
      lokal auffiel

**Die Korrekturen an den Trefferflaechen bleiben gueltig** — jede behob eine
nachgewiesene Ursache, auch wenn keine das gemeldete Symptom ausgeloest hat:

- [x] Trefferflaeche wanderte mit dem Druck-Effekt (Container wurde skaliert)
- [x] Trefferflaeche war um `displayOriginX` verschoben
- [x] `updateBounds()` ohne `displayScale`-Nachzug
- [x] Vergroesserte Flaechen erzeugten Ueberlappung → falscher Knopf gewann
- [x] Ausrichtung wird gemessen statt gerechnet (`makeAlignedHitArea`)

**Bestaetigt am 2026-08-13:** Auf dem Handy laeuft v0.1.3, die Version ist
sichtbar, **die Knoepfe reagieren gut**. Der Fehler ist damit erledigt — er lag
ausschliesslich an der Auslieferung, nicht am Code.

- [x] Auf dem Geraet gegengeprueft (Browser)
- [ ] Offen bleibt nur der Sonderfall Home-Bildschirm-App → Phase 1.2

---

## Phase 1 — Bedienbarkeit _(abgeschlossen 2026-08-13)_

- [x] Einheitlicher Zurueck-Knopf oben links (`createBackButton`)
- [x] Zurueck-Knopf der Bestenliste aus dem Bereich des Namensfeldes geholt
- [x] Pause und "Run verlassen" im laufenden Spiel
- [x] iOS-Vollbildhinweis in einem eigenen Kasten
- [x] Weltenauswahl der Bestenliste von 12 auf 50 CSS-px vergroessert
- [x] Versionsnummer im Menue (damit Test-Rueckmeldungen zuordenbar sind)
- [x] **Auf dem Geraet gegengeprueft** — v0.1.3 sichtbar, Knoepfe reagieren

### Phase 1.1 — Sofort, kleine Fehler _(erledigt 2026-08-13)_

- [x] **BUG: Version stand zweimal unten rechts.** Sie war doppelt eingebaut —
      im DOM (`main.ts`) und zusaetzlich im Canvas (`MenuScene`). Die
      Canvas-Variante ist entfernt; das DOM gewinnt, weil es die Nummer auch
      zeigt, wenn Phaser gar nicht startet.

- [x] **BUG: Code-Feld sass auf dem Knopf "CODE EINLOESEN".** Nachgemessen:
      24 Spielpixel Abstand = rund 13 CSS-px auf dem iPhone. Jetzt 74 px,
      etwa eine Fingerbreite.
      **Regel daraus:** Jedes DOM-Element ueber dem Canvas braucht mindestens
      60 Spielpixel Abstand zu allem Bedienbaren.

- [x] **Wartungsbildschirm** (`AdminScene`): Version, Startweg (Browser oder
      Home-Bildschirm), "Neu laden erzwingen", Spielstand zuruecksetzen mit
      Doppelbestaetigung. Erreichbar ueber langen Druck auf die Versionsnummer.

- [x] **Layout-Werte im Wartungsbildschirm**: Fenstergroesse, sichere Raender,
      Balken oben und unten, Massstab. Ein Browser-Simulator kennt keine
      sicheren Raender — diese Zahlen gibt es nur auf dem Geraet.

- [x] **Pixel-Lineal** (`RulerScene`, ueber den Wartungsbildschirm): Raster mit
      Beschriftung alle 100 Spielpixel, feine Striche alle 50, dazu die
      sicheren Raender. Macht aus "oben ist ein Balken" die Aussage "von 0 bis
      160 ist schwarz".

- [x] **Streifen ausserhalb des Spielfelds tragen die Weltfarbe** statt Schwarz.
      Das Spielfeld ist 9:16, moderne Handys sind schmaler — der harte Balken
      war der sichtbare Bruch dazwischen.

### Phase 1.3 — Bestenliste _(abgeschlossen 2026-08-13)_

> Von Phase 2 hierher gezogen. Beides zusammen, weil das eine ohne das andere
> wenig bringt: Eine gemeinsame Liste, die sich nur auf Knopfdruck fuellt,
> bleibt leer.

- [x] **Gemeinsame Liste ueber alle Welten** als Standardansicht.
      **Geprueft:** Heute ist sie pro Welt getrennt — `scores.world_id` ist
      Pflichtfeld, `fetchLeaderboard(worldId)` filtert mit
      `.eq('world_id', ...)`, und `LeaderboardScene` hat Weltentabs. Fuenf
      Welten = fuenf getrennte Listen.
  - [x] `fetchLeaderboard()` ohne `worldId` aufrufbar machen
  - [x] `world_id` bleibt in der Datenbank (die Herkunft ginge sonst verloren)
        und erscheint in der Zeile als Farbmarke, nicht als Text
  - [x] Weltentabs bleiben als Filter erhalten, sind aber nicht mehr die
        einzige Ansicht
  - [x] Neuer Index: `scores (score desc, created_at asc)` — der vorhandene
        `scores_world_rank_idx` greift ohne `world_id`-Filter nicht

- [x] **Automatisch eintragen nach jedem Run** _(entschieden: jeder Run,
      Variante B)_
  - [x] Der Knopf "IN DIE BESTENLISTE" im Ergebnisbildschirm entfaellt
  - [x] **Die bisherige Begruendung wird damit widerlegt** und ersetzt, nicht
        umgangen: In `ResultScene.ts` steht heute "Automatisch waere bequemer,
        wuerde die Liste aber mit jedem Uebungslauf fluten. Ein Eintrag soll
        eine Entscheidung sein."
  - [x] **Voraussetzung:** Ohne Namen geht kein Eintrag. Der Name muss also
        beim ersten Start abgefragt werden → haengt an Phase 2 (Profil).
        Bis dahin: eintragen nur, wenn ein Name gesetzt ist
  - [x] Fehlschlaege bleiben still — ein misslungener Eintrag darf den
        Ergebnisbildschirm nicht stoeren (`CloudResult` wirft ohnehin nie)
  - [x] Duell-Runden weiterhin **nicht** eintragen (Fairness-Regel 3)

- [x] **Top 10 statt Top 5.** **Geprueft: `LEADERBOARD_LIMIT` steht bereits auf
      10** (`config/backend.ts:31`), und `fetchLeaderboard` benutzt den Wert.
      Nachgerechnet passen auch alle zehn Zeilen auf den Schirm (Platz 10 bei
      y=952, das Namensfeld beginnt erst bei 1042).
      Die Anzahl sichtbarer Zeilen haengt weiterhin von der Datenbank ab; der
      Code laedt jetzt bis zu zehn Eintraege.

> **Vorbehalt zur Gesamtliste:** Sie ist fair, **solange die Welten mechanisch
> gleich sind** (`GAME_DESIGN.md` 7.3). Mit den Weltmodifikatoren aus Phase 5 —
> Sonnenhort mit doppelter Legendaer-Chance — endet das. Dann braucht es eine
> Normalisierung oder wieder getrennte Listen.

### Phase 1.2 — Warum die Home-Bildschirm-App nicht aktualisiert _(neu)_

> **Geprueft: Es gibt keinen Service Worker im Projekt** (kein `serviceWorker`,
> kein `sw.js`, kein Workbox). Die uebliche Erklaerung "veralteter Service
> Worker" scheidet damit aus.
>
> **Ungeprueft** bleibt, was iOS stattdessen tut. Als Home-Bildschirm-App
> benutzt Safari einen eigenen, langlebigen Cache. Dass das `no-cache`-Meta
> dort nicht so greift wie im Browser, ist durch die Beobachtung belegt — die
> genaue Regel dahinter nicht.

- [x] **`version.json` beim Build erzeugen** (`vite.config.ts`, Plugin
      `isihunt-version-manifest`) — sie sagt, welcher Stand verfuegbar ist
- [x] **Update-Erkennung** (`core/updateCheck.ts`): laedt `version.json` mit
      Cache-Buster und vergleicht mit `APP_VERSION`. Jeder Fehler wird
      verschluckt — ohne Netz verhaelt sich das Spiel wie vorher
- [x] **Hinweis im Menue**, wenn eine neuere Fassung bereitliegt. Nur als
      Angebot, nie selbsttaetig
- [x] **`forceReload()`** haengt einen neuen Suchteil an die Adresse. Ein
      blosses `location.reload()` genuegt auf iOS nicht

**Noch offen — erst nach dem Test auf dem Geraet entscheiden:**

- [x] **Messen:** Version in der Home-Bildschirm-App ablesen. Erscheint der
      Update-Hinweis dort? Funktioniert "Neu laden erzwingen"?
- [ ] **Nur falls das nicht reicht:** Service Worker mit
      `updateViaCache: 'none'`. Dann ist das Update-Verhalten steuerbar statt
      Safaris Gutduenken ueberlassen. Braucht einen ADR — neue Abhaengigkeit,
      neuer Lebenszyklus. **Bewusst noch nicht gebaut**, solange die einfachere
      Loesung ungeprueft ist.
- [ ] `manifest.webmanifest`: `start_url` mit Versionsparameter — erzwingt
      einen neuen Cache-Schluessel. _Wirkung ungeprueft_

## Phase 2 — Identitaet, Spielzeit, Fortschritt _(in Arbeit)_

- [x] Profil: Name beim ersten Start abfragen, Icon dazu, im Profil
      aenderbar
- [x] Name im Startmenue anzeigen
- [x] Weltenauswahl als vertikalen Carousel mit einer scharfen Welt sowie
      geblurten Nachbarn und Hoch-/Runter-Wischbewegung bauen
- [x] Namensfeld aus der Bestenliste entfernen (zieht ins Profil)
- [x] Levelanzeige im Profil und Hauptmenue prominent sichtbar
- [x] `RUN_DURATION_MS` 60 s → 90 s
- [x] Designziel 2 in `GAME_DESIGN.md` anpassen ("in 90 Sekunden gespielt")
- [x] XP-Kurve: `floor(80 · n^1.45)` → `floor(750 · √n)`
- [x] `MAX_LEVEL = 100`, Deckelung in `ProgressionSystem.applyRun()`
- [x] **Bestenliste leeren**: einmaliger, bewusst manueller Datenbankwechsel
      ueber `supabase/cleanup_leaderboard.sql`. Entschieden am 2026-08-13.
- [x] Bestenliste auf einen Eintrag je `cloudId` umstellen: nur der beste Run
      bleibt; Name und Welt werden beim neuen Bestwert aktualisiert
- [x] Einmalige Bereinigung ueber `supabase/cleanup_leaderboard.sql` ausfuehren
      (loescht die bisherigen Eintraege, danach ist `player_id` Pflicht)

> Die gemeinsame Bestenliste und der automatische Eintrag standen hier — beides
> ist am 2026-08-13 nach **Phase 1.3** vorgezogen worden.

- [x] XP-Tabelle in `GAME_DESIGN.md` 7.1 ersetzen

> Die Bestenliste wird erst nach ausdruecklicher Bestaetigung geleert. Das ist
> eine einmalige, nicht rueckgaengige Datenbankaktion und kein lokaler
> Code-Schritt.

**Zielwerte, nachgerechnet:** Level 10 nach 17 Runs ≈ 31 min · Level 100 nach
552 Runs ≈ 17 h · Grundlage 900 XP je 90-s-Run, 110 s je Durchgang.

**Entschieden am 2026-08-13:** Ueberschuessige Talentpunkte werden zu **Coins**.
99 Punkte stehen 32 Talentraengen gegenueber — ab etwa Level 33 ist alles
ausgebaut, die restlichen 67 haetten sonst kein Ziel.

- [x] `ProgressionSystem`: Sind alle Talente auf Maximalrang, wird der Punkt
      nicht vergeben, sondern in Coins gutgeschrieben
- [x] Umrechnungskurs steht in `GameConfig.ts` (10 Coins je Punkt)
- [x] Der Ergebnisbildschirm erklaert die Umwandlung ("Alle Talente ausgebaut -
      +N Coins"), sonst wirkt ein ausbleibender Talentpunkt wie ein Fehler
- [x] Coins-Feld und Migration sind als kleiner Unterbau von Phase 4 vorhanden;
      weitere Coin-Quellen und die Talentbaum-Oberflaeche bleiben Phase 4.

> **Erledigt am 2026-08-14:** Coins-Feld, Migration, Umrechnung (10 Coins je
> ueberschuessigem Talentpunkt) und die Rueckmeldung im Ergebnis sind gebaut.

## Phase 2.5 — Bildschirm ganz nutzen _(neu 2026-08-13)_

> **Ausgangslage:** Das Referenzlayout ist 720 × 1280, also 9:16. Moderne iPhones
> sind deutlich schmaler:
>
> | Geraet            | Viewport  | Canvas nach FIT | Balken gesamt |
> | ----------------- | --------- | --------------- | ------------- |
> | iPhone SE         | 375 × 667 | 375 × 667       | **0 px**      |
> | iPhone 12/13      | 390 × 844 | 390 × 693       | 151 px        |
> | iPhone 14 Pro     | 393 × 852 | 393 × 699       | 153 px        |
> | iPhone 15 Pro Max | 430 × 932 | 430 × 764       | 168 px        |
>
> Die frueheren Balken waren die Folge von `Phaser.Scale.FIT` bei fest
> gewaehltem 9:16. Die interne Hoehe waechst jetzt auf hohen, schmalen
> Geraeten mit der verfuegbaren sicheren Portrait-Flaeche.

- [x] **Spielfeld an das Geraet anpassen statt einzupassen.** Die Breite bleibt
      720 px, die interne Hoehe uebernimmt beim Start die verfuegbare
      Portrait-Flaeche (mindestens 1280 px). Die zusaetzliche Hoehe ist echte
      Spielflaeche; die Rundendauer bleibt unveraendert.
- [x] **Entscheidung:** Mehr Hoehe bedeutet laengere Laufwege. Das ist bewusst
      akzeptiert; Spawn-Grenzen und untere Layout-Elemente verwenden bereits
      `GAME_HEIGHT` und wachsen mit.
- [x] **Zwischenloesung umgesetzt (2026-08-13):** Die Streifen tragen die
      Randfarben der Welt statt Schwarz.
- [x] **Safe-Area-Hintergrund:** Sterne und ein subtiler Nebelschein liegen
      jetzt auch in den DOM-Streifen ausserhalb des Canvas.
- [x] **Werkzeug:** Das Pixel-Lineal (`RulerScene`) macht die
      Bewertung messbar — "von 0 bis 160" statt "oben ist was".
- [x] `docs/GAME_DESIGN.md` 9 anpassen (variable Hoehe dokumentiert)
- [x] Hochformat erzwingen: Manifest, best-effort Screen-Orientation-Lock und
      Landscape-Fallback fuer Browser ohne Orientierungs-API
- [x] Tablet-Kompatibilitaet geprueft: iPad nutzt weiterhin ein zentriertes,
      unveraendertes Hochformat-Layout. Eine breitere Nutzung wird bewusst mit
      dem spaeteren nativen Layout geplant, damit iPhone-Bedienung und
      Koordinaten nicht auseinanderlaufen.

## Phase 3 — Themenwechsel ins Weltall

- [x] ADR-0013: Themen- und Zielgruppenwechsel (mit verworfener Alternative)
- [x] `tex-player-core`: Raumschiff statt vierzackiger Stern
- [x] Relikte als Planeten (Rotation als Illusion — Phaser ist 2D)
- [x] Hintergrund: weltabhaengige Sternfarben, Nebelkompositionen und
      Planetenlayouts
- [x] Echte Planetentexturen je Welt und neues isiHunt-Logo als PNG-Assets
- [x] Skins fuer die Figur, freigeschaltet ab Level 5/15/30/50/75/100

> **Phase-3-Start 2026-08-14:** ADR-0013 ist angenommen. Raumschiff,
> Planeten-Relikte, Raumzonen-Namen, weltabhaengige Raumkulissen und
> Level-Skins sind umgesetzt.

- [x] `worlds.ts`: Fantasy-Namen → Weltraum-Regionen
- [x] `GAME_DESIGN.md`: Pitch, Zielgruppe, Referenz
- [x] `ART_STYLE.md`: Formensprache, Assets, Welten-Farbtabelle

> **Unantastbar:** Die sechs Seltenheitsfarben. Planetensprites duerfen ihre
> Weltdetails behalten; die Seltenheit wird weiterhin durch Glow, Strahlenkranz
> und Fang-Effekte eindeutig angezeigt.

## Phase 3.5 — Ton _(neu 2026-08-13, aus M4 vorgezogen)_

> Vorgezogen, weil Ton bei einem Arcade-Spiel keine Politur ist, sondern
> Rueckmeldung: Ein Knopf, der klickt, fuehlt sich getroffen an — das haette
> bei der Trefferflaechen-Suche sogar diagnostisch geholfen.

- [x] `SoundSystem` neben den anderen Systemen (`ARCHITECTURE.md` 10 sieht es
      dort bereits vor)
- [x] **Knopf-Klick** — kurz und trocken, bei jedem `pointerup` in `widgets.ts`
- [x] **Fang-Sounds je Seltenheit**, Tonhoehe steigend mit dem Wert;
      gruen/blau/lila/orange bekommen mehrstimmige, epischere Fanfaren;
      legendaer bekommt einen eigenen Klang
- [x] Weltwechsel im Hoch-/Runter-Wheel bekommt einen kurzen Auswahlton
- [x] **Combo-Stufe erreicht**, **Levelaufstieg**, **Run-Ende**
- [x] Stummschalter, Zustand im Spielstand (`reconcile()` braucht dafuer keine
      Migration)
- [x] **Toene prozedural erzeugen** (WebAudio-Oszillatoren) statt Dateien zu
      laden — passt zu ADR-0004: keine Assets, keine Ladezeit, alles im Code
- [x] **Fallstrick iOS:** Audio startet erst nach einer Nutzergeste. Der
      AudioContext muss beim ersten Tipp entsperrt werden, sonst bleibt es
      stumm — und zwar lautlos, ohne Fehlermeldung
- [x] `ART_STYLE.md` um einen Abschnitt Ton ergaenzen

> **Erledigt am 2026-08-14:** Phase 3.5 ist mit prozeduralen WebAudio-Toenen,
> gespeicherter Ton-Einstellung und iOS-Freischaltung beim ersten Tipp gebaut.

## Phase 3.6 — Dynamic Island _(neu 2026-08-13)_

> **Ehrlich vorab:** Die Dynamic Island laesst sich aus einer Web-App heraus
> **nicht** ansteuern. Sie gehoert dem System; Inhalte dort kommen aus Live
> Activities (ActivityKit) und setzen eine native App voraus. Im Browser gibt
> es keine Schnittstelle dafuer.
>
> Erreichbar waere sie erst mit Capacitor (M6), und auch dann nur ueber ein
> natives Plugin.

- [x] **Entscheidung:** Native Umsetzung kommt nach Phase 4. Die Vorbereitung
      wird jetzt dokumentiert, aber der Web-Stand bleibt bis dahin aktiv.
- [ ] **Was ohne native App geht** — und optisch in dieselbe Richtung zielt:
  - [x] Der Bereich _um_ die Island gehoert der Seite: Safe-Area-Laufband im
        Menue und Restzeit-Anzeige waehrend des Runs.
  - [ ] `theme-color` je Zustand umschalten — faerbt auf iOS die Statusleiste
        und damit die Umgebung der Island. Im Menue ruhig, im Run in der
        Weltfarbe, bei einem legendaeren Fang kurz aufleuchtend.
        _Aufwand: gering, Wirkung sichtbar_
  - [x] Der `safe-area-inset-top`-Bereich wird im Web-Stand fuer Laufband und
        Restzeit genutzt; die Systemuhr bleibt unangetastet.
- [ ] **Laufband im Vollbild/Home-Bildschirm-Modus stabilisieren.**
      Ursache: `black-translucent` legte den Webinhalt absichtlich hinter die
      iOS-Statusleiste; das bei `top: 0` fixierte Laufband lag dadurch direkt
      in der Dynamic Island. Zusaetzlich existierte die DOM-ID doppelt.
      Vor der Ursachenbehebung ausprobiert:
  - [x] HTML-Laufband in den `#game`-Container verschoben, damit es im
        Vollbild gemeinsam mit dem Canvas enthalten ist.
  - [x] `z-index`, `position: fixed`, Safe-Area-Hoehe und einen 28-px-Fallback
        fuer `env(safe-area-inset-top)` angepasst.
  - [x] Phaser `fullscreenTarget` auf `#game` gesetzt, damit nicht nur der
        Canvas in den Vollbildmodus geht.
  - [x] Cache-/Auslieferungsproblem ausgeschlossen: v0.1.52 ist live, das
        Problem besteht laut aktuellem Geraetetest weiterhin.
  - [x] Nach Abgleich mit Apples und WebKits dokumentiertem Standalone-Verhalten
        auf eine reservierte schwarze iOS-Statusleiste umgestellt. Das
        Laufband ist jetzt ein eigener 32-px-App-Kopfbereich darunter; die
        fehleranfaellige Laufzeitmessung und der doppelte DOM-Knoten entfallen.
        Geraetetest v0.1.58: auf dem iPhone 16 Pro weiterhin nicht sichtbar.
  - [x] Naechster Ansatz: nicht mehr auf eine von iOS beim Installieren
        gespeicherte Statusleistenart verlassen. Der dunkle Kopf reicht wieder
        bis zum Displayrand, waehrend Text und Canvas mit
        `safe-area-inset-top` plus modellabhaengigem Fallback unterhalb der
        Island beginnen. Echter Geraetetest mit v0.1.59 steht aus.
  - [x] Geraetetest bis v0.1.65: Geometrie oben 94 CSS-px und unten 0 CSS-px,
        aber `black-translucent` legt den iOS-Systemblur weiterhin ueber die
        Laufzeile. Deshalb ab v0.1.66 undurchsichtige schwarze Statusleiste;
        Web-Viewport und Laufzeile beginnen direkt darunter. Geraetetest offen.
  - [x] Geraetetest v0.1.66: iOS reserviert den Statusbereich entgegen dem
        erwarteten Verhalten nicht; Laufzeile verschwindet und Logo wird
        abgeschnitten. Ab v0.1.67 wieder sichere 126-CSS-px-Geometrie, aber der
        32-px-Blur-Schutz ist transparent und zeigt den Welt-Hintergrund. Nur
        die eigentliche Laufzeile bleibt dunkel. Geraetetest offen.
- [ ] Erst mit M6 (Capacitor): Live Activity mit Punktestand und Restzeit
      waehrend eines Runs; bis dahin wird die Anzeige als Prototyp beobachtet.

> **Entscheidung fuer die native Live Activity:** Zunaechst soll sie waehrend
> des gesamten Runs sichtbar bleiben und laufend sinnvolle Informationen zeigen.
> Welche Inhalte dauerhaft bleiben, wird nach dem ersten Test entschieden.

## Phase 4 — Belohnung

- [ ] Punkte-Popup auffaelliger (`floatingScore` existiert, ist zu dezent)
- [ ] Serien-Bonus: drei gleiche Seltenheiten → doppelte Punkte, ab Gruen
- [ ] Coin-System: Feld im Spielstand, Anzeige, Quellen (Run + Erfolge +
      ueberschuessige Talentpunkte)
- [ ] Talentbaum-Oberflaeche (Logik existiert, im Menue steht "Vergabe folgt")
- [ ] Talente zuruecksetzen
- [ ] **Vitest einrichten** — vor der XP-Kurve waere es besser gewesen

## Phase 5 — Herausforderung

- [ ] Tages-Herausforderung mit festem Seed (Technik steht seit dem Duell)
- [ ] Duell gegen Bot mit Fehlerrate je Schwierigkeitsgrad
- [ ] Weltmodifikatoren umsetzen (stehen als `plannedModifier` in `worlds.ts`)
- [ ] Hindernisse: bremsend in fruehen Welten, bestrafend in spaeten
- [ ] `GAME_DESIGN.md` §10 praezisieren (nicht streichen): kein Misserfolg in
      den Einstiegswelten
- [ ] ~~Ranked-Modus~~ — blockiert, siehe Phase 6

## Phase 6 — Sozial

- [ ] Zeitstempel in der Bestenliste (`createdAt` wird bereits geladen)
- [ ] **Punkte serverseitig bewerten** (Supabase Edge Function, Run nachspielen)
      — Vorbedingung fuer Ranked und Rekord-Meldungen
- [ ] Realtime-Sync der Bestenliste
- [ ] ADR-0014: dauerhafte Identitaeten fuer die Freundesliste (kehrt ADR-0011
      "kein Konto" teilweise um)
- [ ] Freundesliste mit Online/Offline, Rekord, Coins
- [ ] Duell per geteiltem Link (ADR-0010 Schritt 1)
- [ ] Rekord-Meldung im laufenden Spiel; echte Push-Meldung nur fuer
      installierte Web-Apps (iOS-Grenze)

---

## Aufraeumen

- [ ] `src/ui/hitDebug.ts` entfernen, sobald der Knopf-Fehler bestaetigt behoben
      ist — es ist ein Diagnosewerkzeug, kein Feature
- [ ] `ideen.txt` in die Roadmap ueberfuehren oder loeschen
