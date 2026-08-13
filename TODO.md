# TODO — offene Arbeiten

**Stand:** 2026-08-13 · abgeleitet aus dem Spieltest-Feedback von Emre (11) und
Simay (9)

Reihenfolge nach Nutzen, nicht nach Aufwand.

## Ueberblick

| Phase   | Inhalt                                              | Aufwand      |
| ------- | --------------------------------------------------- | ------------ |
| 1       | Bedienbarkeit — **abgeschlossen**                   | —            |
| 1.1     | Zwei UI-Fehler, Wartungsbildschirm — **fertig**     | —            |
| 1.2     | Update-Erkennung — **gebaut, ungeprueft**           | Test noetig  |
| **1.3** | **Bestenliste: gemeinsam + automatisch — abgeschlossen** | —            |
| 2       | Profil, 90 s, XP-Kurve, Level 100                   | mittel       |
| **2.5** | Balken oben/unten — Bildschirm ganz nutzen          | mittel+      |
| 3       | Weltraum statt Fantasy                              | mittel       |
| **3.5** | Ton (aus M4 vorgezogen)                             | mittel       |
| **3.6** | Dynamic Island — braucht native App                 | Entscheidung |
| 4       | Bonus, Coins, Talentbaum                            | mittel       |
| 5       | Modi, Hindernisse                                   | mittel       |
| 6       | Freunde, Realtime, Manipulationsschutz              | hoch         |

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

### Noch offen — erst bei der jeweiligen Phase noetig

- **2.5 Balken:** flexibles Spielfeld oder nur die Balken einfaerben? Ersteres
  betrifft alle Scenes und verschiebt das Balancing.
- **3 Weltraum:** sollen die Dokumente jetzt umgeschrieben werden?
- **3.6 Dynamic Island:** braucht eine native App (M6 vorziehen?).
- **5 Hindernisse:** ab welcher Welt darf ein Hindernis bestrafen?
- **6 Manipulationsschutz:** vor oder nach Ranked-Modus und Rekord-Meldungen?

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

- [ ] **Messen:** Version in der Home-Bildschirm-App ablesen. Erscheint der
      Update-Hinweis dort? Funktioniert "Neu laden erzwingen"?
- [ ] **Nur falls das nicht reicht:** Service Worker mit
      `updateViaCache: 'none'`. Dann ist das Update-Verhalten steuerbar statt
      Safaris Gutduenken ueberlassen. Braucht einen ADR — neue Abhaengigkeit,
      neuer Lebenszyklus. **Bewusst noch nicht gebaut**, solange die einfachere
      Loesung ungeprueft ist.
- [ ] `manifest.webmanifest`: `start_url` mit Versionsparameter — erzwingt
      einen neuen Cache-Schluessel. _Wirkung ungeprueft_

## Phase 2 — Identitaet, Spielzeit, Fortschritt

- [ ] Profil: Name beim ersten Start abfragen, Icon dazu, in Einstellungen
      aenderbar
- [ ] Name im Startmenue anzeigen
- [ ] Namensfeld aus der Bestenliste entfernen (zieht ins Profil)
- [ ] Levelanzeige nicht mehr direkt im Menue, sondern erst hinter "Jagd
      beginnen" — das Menue soll mit Name und Spielstart oeffnen, nicht mit
      einer Statistik
- [ ] `RUN_DURATION_MS` 60 s → 90 s
- [ ] Designziel 2 in `GAME_DESIGN.md` anpassen ("in 60 Sekunden gespielt")
- [ ] XP-Kurve: `floor(80 · n^1.45)` → `floor(750 · √n)`
- [ ] `MAX_LEVEL = 100`, Deckelung in `ProgressionSystem.applyRun()`
- [ ] **Bestenliste leeren** (Eingriff in Supabase — Eintraege sind auf
      Rechteebene unveraenderlich, kein Knopf im Spiel). Entschieden am
      2026-08-13: ja, sauberer Schnitt beim Wechsel auf 90 Sekunden.

> Die gemeinsame Bestenliste und der automatische Eintrag standen hier — beides
> ist am 2026-08-13 nach **Phase 1.3** vorgezogen worden.

- [ ] XP-Tabelle in `GAME_DESIGN.md` 7.1 ersetzen

**Zielwerte, nachgerechnet:** Level 10 nach 16 Runs ≈ 29 min · Level 100 nach
560 Runs ≈ 17 h · Grundlage 900 XP je 90-s-Run, 110 s je Durchgang.

**Entschieden am 2026-08-13:** Ueberschuessige Talentpunkte werden zu **Coins**.
99 Punkte stehen 32 Talentraengen gegenueber — ab etwa Level 33 ist alles
ausgebaut, die restlichen 67 haetten sonst kein Ziel.

- [ ] `ProgressionSystem`: Sind alle Talente auf Maximalrang, wird der Punkt
      nicht vergeben, sondern in Coins gutgeschrieben
- [ ] Umrechnungskurs gehoert nach `GameConfig.ts`, nicht in die Logik
- [ ] Der Ergebnisbildschirm muss das erklaeren ("Alle Talente ausgebaut —
      +N Coins"), sonst wirkt ein ausbleibender Talentpunkt wie ein Fehler
- [ ] Setzt das Coin-System aus Phase 4 voraus. Bis dahin: Punkte weiter
      vergeben und beim Einbau der Coins rueckwirkend umrechnen

## Phase 2.5 — Bildschirm ganz nutzen _(neu 2026-08-13)_

> **Nachgerechnet:** Das Spielfeld ist 720 × 1280, also 9:16. Moderne iPhones
> sind deutlich schmaler:
>
> | Geraet            | Viewport  | Canvas nach FIT | Balken gesamt |
> | ----------------- | --------- | --------------- | ------------- |
> | iPhone SE         | 375 × 667 | 375 × 667       | **0 px**      |
> | iPhone 12/13      | 390 × 844 | 390 × 693       | 151 px        |
> | iPhone 14 Pro     | 393 × 852 | 393 × 699       | 153 px        |
> | iPhone 15 Pro Max | 430 × 932 | 430 × 764       | 168 px        |
>
> Die Balken sind also **kein Fehler**, sondern die Folge von
> `Phaser.Scale.FIT` bei fest gewaehltem 9:16. Auf dem SE gibt es keine, auf
> neueren Geraeten rund 150 px.

- [ ] **Spielfeld an das Geraet anpassen statt einzupassen.** Statt fester
      1280 px die verfuegbare Hoehe uebernehmen. Betrifft `main.ts`
      (Scale-Modus), `GameConfig.ts` (`GAME_HEIGHT` wird variabel) und jedes
      Layout, das mit `GAME_HEIGHT - x` rechnet — das sind alle Scenes.
      _Aufwand: mittel bis hoch, breite Wirkung_
- [ ] **Vorher entscheiden:** Mehr Hoehe heisst mehr Spielflaeche und damit
      laengere Laufwege. Das verschiebt das Balancing und muss zusammen mit der
      Rundendauer aus Phase 2 gerechnet werden.
- [x] **Zwischenloesung umgesetzt (2026-08-13):** Die Streifen tragen die
      Randfarben der Welt statt Schwarz. Der Bruch ist damit weg; die Frage,
      ob das Spielfeld selbst mitwachsen soll, bleibt offen.
- [ ] **Noch offen:** Hintergrundelemente (Sterne, Nebel) in die Streifen
      ziehen, damit sie nicht nur einfarbig sind. _Aufwand: gering_
- [ ] **Werkzeug steht bereit:** Das Pixel-Lineal (`RulerScene`) macht die
      Bewertung messbar — "von 0 bis 160" statt "oben ist was".
- [ ] `docs/GAME_DESIGN.md` 9 anpassen (dort steht die feste Aufloesung)

## Phase 3 — Themenwechsel ins Weltall

- [ ] ADR-0013: Themen- und Zielgruppenwechsel (mit verworfener Alternative)
- [ ] `tex-player-core`: Raumschiff statt vierzackiger Stern
- [ ] Relikte als Planeten (Rotation als Illusion — Phaser ist 2D)
- [ ] Hintergrund: Sternenfelder, Nebel, Planeten je Welt
- [ ] Skins fuer die Figur, freigeschaltet ab Level 5/15/30/50/75/100
- [ ] `worlds.ts`: Fantasy-Namen → Weltraum-Regionen
- [ ] `GAME_DESIGN.md`: Pitch, Zielgruppe, Referenz
- [ ] `ART_STYLE.md`: Formensprache, Assets, Welten-Farbtabelle

> **Unantastbar:** Die sechs Seltenheitsfarben. Texturen bleiben weiss und
> werden getintet — farbige Planeten brechen das Seltenheitssystem.

## Phase 3.5 — Ton _(neu 2026-08-13, aus M4 vorgezogen)_

> Vorgezogen, weil Ton bei einem Arcade-Spiel keine Politur ist, sondern
> Rueckmeldung: Ein Knopf, der klickt, fuehlt sich getroffen an — das haette
> bei der Trefferflaechen-Suche sogar diagnostisch geholfen.

- [ ] `SoundSystem` neben den anderen Systemen (`ARCHITECTURE.md` 10 sieht es
      dort bereits vor)
- [ ] **Knopf-Klick** — kurz und trocken, bei jedem `pointerup` in `widgets.ts`
- [ ] **Fang-Sounds je Seltenheit**, Tonhoehe steigend mit dem Wert;
      legendaer bekommt einen eigenen Klang
- [ ] **Combo-Stufe erreicht**, **Levelaufstieg**, **Run-Ende**
- [ ] Stummschalter, Zustand im Spielstand (`reconcile()` braucht dafuer keine
      Migration)
- [ ] **Toene prozedural erzeugen** (WebAudio-Oszillatoren) statt Dateien zu
      laden — passt zu ADR-0004: keine Assets, keine Ladezeit, alles im Code
- [ ] **Fallstrick iOS:** Audio startet erst nach einer Nutzergeste. Der
      AudioContext muss beim ersten Tipp entsperrt werden, sonst bleibt es
      stumm — und zwar lautlos, ohne Fehlermeldung
- [ ] `ART_STYLE.md` um einen Abschnitt Ton ergaenzen

## Phase 3.6 — Dynamic Island _(neu 2026-08-13)_

> **Ehrlich vorab:** Die Dynamic Island laesst sich aus einer Web-App heraus
> **nicht** ansteuern. Sie gehoert dem System; Inhalte dort kommen aus Live
> Activities (ActivityKit) und setzen eine native App voraus. Im Browser gibt
> es keine Schnittstelle dafuer.
>
> Erreichbar waere sie erst mit Capacitor (M6), und auch dann nur ueber ein
> natives Plugin.

- [ ] **Entscheidung noetig:** Soll das Spiel dafuer nativ werden, also M6
      vorgezogen? Ohne das ist der Wunsch technisch nicht erfuellbar.
- [ ] **Was ohne native App geht** — und optisch in dieselbe Richtung zielt:
  - [ ] Der Bereich _um_ die Island gehoert der Seite. Ein bewusst gestalteter
        Streifen dort (Farbverlauf, treibende Lichtpunkte) laesst die Island
        eingebettet wirken statt wie ein Loch
  - [ ] `theme-color` je Zustand umschalten — faerbt auf iOS die Statusleiste
        und damit die Umgebung der Island. Im Menue ruhig, im Run in der
        Weltfarbe, bei einem legendaeren Fang kurz aufleuchtend.
        _Aufwand: gering, Wirkung sichtbar_
  - [ ] Der `safe-area-inset-top`-Bereich wird bisher nur freigehalten
        (`index.html`) — er koennte Punktzahl oder Timer tragen
- [ ] Erst mit M6 (Capacitor): Live Activity mit Punktestand und Restzeit
      waehrend eines Runs

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
