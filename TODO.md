# TODO — offene Arbeiten

**Stand:** 2026-08-13 · abgeleitet aus dem Spieltest-Feedback von Emre (11) und
Simay (9)

Reihenfolge nach Nutzen, nicht nach Aufwand.

## Ueberblick

| Phase   | Inhalt                                        | Aufwand      |
| ------- | --------------------------------------------- | ------------ |
| **1.1** | Doppelte Versionsanzeige, Admin-Modus         | gering       |
| **1.2** | Home-Bildschirm-App aktualisiert nicht        | offen        |
| 2       | Profil, 90 s Rundendauer, XP-Kurve, Level 100 | mittel       |
| **2.5** | Balken oben/unten — Bildschirm ganz nutzen    | mittel+      |
| 3       | Weltraum statt Fantasy                        | mittel       |
| **3.5** | Ton (aus M4 vorgezogen)                       | mittel       |
| **3.6** | Dynamic Island — braucht native App           | Entscheidung |
| 4       | Bonus, Coins, Talentbaum                      | mittel       |
| 5       | Modi, Hindernisse                             | mittel       |
| 6       | Freunde, Realtime, Manipulationsschutz        | hoch         |

**Fett = neu am 2026-08-13.**

Zwei Punkte brauchen eine Entscheidung, bevor Code entsteht:

- **3.6 Dynamic Island** ist aus einer Web-App heraus nicht erreichbar. Sie
  setzt eine native App voraus (M6, Capacitor). Ohne diese Entscheidung bleibt
  nur die Gestaltung des Bereichs _um_ die Island herum.
- **2.5 Balken** bedeutet mehr Spielflaeche und verschiebt damit das Balancing
  — gehoert zusammen mit der Rundendauer aus Phase 2 gerechnet.

---

## ZUERST — Ursache geklaert: das Handy lief nie auf dem korrigierten Stand

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

**Offen:**

- [ ] Auf dem Handy gegenpruefen — **zuerst die Versionsnummer unten rechts
      ablesen.** Steht dort nicht die aktuelle, ist der Deploy das Problem und
      nicht der Code.
- [ ] Erst wenn die Version stimmt und es weiterhin hakt: `?hitboxes` oeffnen
      und einen Fehlgriff abfotografieren

---

## Phase 1 — Bedienbarkeit _(fertig bis auf den Knopf-Fehler)_

- [x] Einheitlicher Zurueck-Knopf oben links (`createBackButton`)
- [x] Zurueck-Knopf der Bestenliste aus dem Bereich des Namensfeldes geholt
- [x] Pause und "Run verlassen" im laufenden Spiel
- [x] iOS-Vollbildhinweis in einem eigenen Kasten
- [x] Weltenauswahl der Bestenliste von 12 auf 50 CSS-px vergroessert
- [x] Versionsnummer im Menue (damit Test-Rueckmeldungen zuordenbar sind)
- [ ] **Auf dem Geraet der Kinder gegenpruefen** ← Voraussetzung fuer Phase 2

### Phase 1.1 — Sofort, kleine Fehler _(neu 2026-08-13)_

- [ ] **BUG: Version steht zweimal unten rechts.** Belegt: sie wird an zwei
      Stellen gezeichnet — im DOM (`main.ts:66` → `index.html` `#version`) und
      zusaetzlich im Canvas (`MenuScene.ts:358`). Beides in derselben Sitzung
      eingebaut, beides unten rechts.
      **Loesung:** die Canvas-Variante entfernen. Die DOM-Variante bleibt, weil
      sie auch dann sichtbar ist, wenn Phaser gar nicht startet — genau dafuer
      war sie gedacht. _Aufwand: sehr gering_

- [ ] **Admin-Modus / manuelles Update.** Ein Bildschirm mit Version,
      "Neu laden erzwingen", Spielstand zuruecksetzen und Debug-Schaltern.
      Vom Home-Bildschirm aus laesst sich sonst nicht hart neu laden — dort
      gibt es weder Adressleiste noch Reload-Knopf.
      Erreichbar ueber eine unauffaellige Geste (langer Druck auf die
      Versionsnummer), damit Kinder nicht versehentlich hineingeraten.
      _Aufwand: gering_ · haengt mit Phase 1.2 zusammen

### Phase 1.2 — Warum die Home-Bildschirm-App nicht aktualisiert _(neu)_

> **Geprueft: Es gibt keinen Service Worker im Projekt** (kein `serviceWorker`,
> kein `sw.js`, kein Workbox). Die uebliche Erklaerung "veralteter Service
> Worker" scheidet damit aus.
>
> **Ungeprueft** bleibt, was iOS stattdessen tut. Als Home-Bildschirm-App
> benutzt Safari einen eigenen, langlebigen Cache. Dass das `no-cache`-Meta
> dort nicht so greift wie im Browser, ist durch die Beobachtung belegt — die
> genaue Regel dahinter nicht.

- [ ] **Zuerst messen, nicht raten:** Version in der Home-Bildschirm-App
      ablesen und mit `npm run deploy:check` vergleichen. Erst dann
      entscheiden, welche der folgenden Massnahmen noetig ist.
- [ ] **Naheliegendste Massnahme:** Beim Start die Live-Version abfragen
      (kleine `version.json` neben der `index.html`, Zeitstempel als
      Cache-Buster) und bei Abweichung einen Hinweis zeigen: "Neue Version
      verfuegbar — jetzt laden". Der Nutzer ist damit nicht mehr darauf
      angewiesen, dass der Cache von selbst nachgibt.
- [ ] **Falls das nicht reicht:** Service Worker mit `updateViaCache: 'none'`.
      Dann ist das Update-Verhalten steuerbar statt Safaris Gutduenken
      ueberlassen. Braucht einen ADR — neue Abhaengigkeit, neuer Lebenszyklus.
- [ ] `manifest.webmanifest`: `start_url` mit Versionsparameter (`./?v=0.1.3`)
      — erzwingt einen neuen Cache-Schluessel.
      _Aufwand: sehr gering, Wirkung ungeprueft_

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
      Rechteebene unveraenderlich, kein Knopf im Spiel)
- [ ] XP-Tabelle in `GAME_DESIGN.md` 7.1 ersetzen

**Zielwerte, nachgerechnet:** Level 10 nach 16 Runs ≈ 29 min · Level 100 nach
560 Runs ≈ 17 h · Grundlage 900 XP je 90-s-Run, 110 s je Durchgang.

**Offen:** Was passiert mit ueberschuessigen Talentpunkten? 99 Punkte stehen 32
Talentraengen gegenueber — ab etwa Level 33 ist alles ausgebaut. Vorschlag:
Ueberschuss wird zu Coins (Phase 4).

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
- [ ] **Guenstige Zwischenloesung:** Die Balken in der Weltfarbe fuellen statt
      schwarz zu lassen und Hintergrundelemente hineinziehen. Der Bildschirm
      wirkt gefuellt, ohne dass sich am Spielfeld etwas aendert.
      _Aufwand: gering_
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
