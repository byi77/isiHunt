# TODO — offene Arbeiten

**Stand:** 2026-08-17 · abgeleitet aus dem Spieltest-Feedback von Emre und
Simay

Reihenfolge nach Nutzen, nicht nach Aufwand.

## Ueberblick

| Phase   | Inhalt                                                   | Aufwand      |
| ------- | -------------------------------------------------------- | ------------ |
| 1       | Bedienbarkeit — **abgeschlossen, erneut bestaetigt**     | —            |
| 1.1     | Zwei UI-Fehler, Wartungsbildschirm — **fertig**          | —            |
| 1.2     | Update-Erkennung — **gebaut, ungeprueft**                | Test noetig  |
| **1.3** | **Bestenliste: gemeinsam + automatisch — abgeschlossen** | —            |
| 2       | Profil, 90 s, XP-Kurve, Level 100                        | mittel       |
| **2.5** | Balken oben/unten — Bildschirm ganz nutzen               | mittel+      |
| **2.6** | **Login & Mehrgeräte-Profil**                            | **hoch**     |
| 3       | Weltraum statt Fantasy                                   | mittel       |
| **3.5** | Ton (aus M4 vorgezogen)                                  | mittel       |
| **3.6** | Dynamic Island — braucht native App                      | Entscheidung |
| 4       | Bonus, Coins, Talentbaum — erste Fassung abgeschlossen   | —            |
| **4.1** | **Talentpunkte-Neuentwurf — pausiert, siehe unten**      | **hoch**     |
| 5       | Modi, Hindernisse — gebaut, Spieltest offen              | mittel       |
| 6       | Freunde, Realtime, Ranked und Rekorde                    | hoch         |

**Fett = neu am 2026-08-13.**

## Aktuell priorisiert — Feedback Emre & Simay (2026-08-17)

> **Aktuelle Entwicklungsphase:** Die spielbaren Grundlagen von Phase 1 bis 5
> sind gebaut. **Phase 4.1 (Talentpunkte-Umbau) ist pausiert** — die
> Kernidee "Talente kosten keine Coins mehr" steht nochmal zur Diskussion,
> siehe P1 unten. Bis zur Entscheidung ruecken **P0** (Phase 2.6 produktiv
> pruefen, Phase 5 balancieren) und danach **Phase 6** in den Vordergrund.

### P0 — erst absichern und messen

- [x] Button-Trefferflaechen auf dem Testgeraet erneut bestaetigt: funktionieren
      gut.
- [x] Zurueck-Navigation auf dem Testgeraet erneut bestaetigt: funktioniert gut.
- [ ] **Phase 2.6 produktiv pruefen:** SQL-Migration in Supabase anwenden und
      mit einem Profil auf iPhone und iPad testen: Offline spielen, verbinden,
      dann XP, Coins, Name, Bestwert und Erfolge pruefen.
- [ ] **Phase 5 mit Kindern balancieren:** Schwierige Welten, Hindernisse,
      Tempo, Sichtfenster und Belohnungen sollen fordernd, aber nie frustrierend
      sein.

### P0.5 — Debug-Modus fuer Tester _(gebaut 2026-08-17, siehe ADR-0016)_

> **Ziel:** Bug-Reports von Emre und Simay ohne Konsole, ohne Admin-PIN.
> Zehnmal aufs Logo im Hauptmenue tippen schaltet einen schwebenden
> Debug-Knopf frei, der ueberall im Spiel sichtbar bleibt. Ein Tipp darauf
> erzeugt einen Text-Report (Geraet, Version, Layout, Ton-Diagnose, die
> letzten 50 Ereignisse/Fehler) plus Screenshot und oeffnet das native
> Share-Sheet (WhatsApp waehlbar).

- [x] `DebugSystem.ts` (Ringpuffer, Report-Text, Toggle-Persistenz,
      Screenshot-zu-File), `DebugConfig.ts`, `ui/debugOverlay.ts`
- [x] Zehn-Tipp-Geste auf dem Logo in `MenuScene`, PIN-frei und getrennt vom
      Wartungsbereich
- [x] `npm run verify` gruen (Typecheck, Lint, Format, 177 Tests, Build)
- [ ] **Am echten iPhone pruefen:** Trifft die Tipp-Geste das Logo zuverlaessig?
      Uebernimmt WhatsApp beim Teilen beide Dateien (PNG + TXT) oder nur eine?
      Ist der Screenshot-Inhalt brauchbar?

### P1 — Fortschritt vor Wettbewerb neu entscheiden _(pausiert 2026-08-17)_

> **Pausiert:** Die Grundidee "Talente kosten keine Coins mehr, sondern
> Talentpunkte pro Levelaufstieg" wird nochmal ueberdacht, bevor hier
> weitergeplant oder gebaut wird. Die folgenden Punkte bleiben stehen, sind
> aber bis zur Entscheidung nicht aktiv.

- [ ] **Talentpunkte statt Coin-Kosten planen und bauen.** Jeder Levelaufstieg
      soll Talentpunkte geben; Talentkaeufe duerfen dann keine Coins kosten.
- [ ] **Zahl zuerst entscheiden:** Von Level 1 bis 100 gibt es bei Punkten ab
      Levelaufstieg nur 99 Aufstiege. Entweder hat der Baum 99 Ränge oder ein
      neues Profil startet mit einem Talentpunkt, damit 100 Ränge erreichbar
      sind.
- [ ] Talentbaum auf die beschlossene Gesamtzahl ausbauen; darunter eine
      kindgerechte Schleife/Route als sichtbaren Fortschritt zeichnen.
- [ ] Sichere Migration fuer bestehende Coin-Talente und den Supabase-Stand
      planen, bevor die Kosten umgestellt werden.
- [ ] Coins bleiben Waehrung fuer spaetere Skins und optionale Boni; Skin-Inventar
      und Shop nur vorbereiten, nicht vor dem Talentpunkte-Umbau bauen.
- [ ] Profilfluss verbessern: beim allerersten Profil einen getrennten sichtbaren
      Spielernamen erfragen; danach im Profil/Aliasbereich aenderbar halten.
- [ ] Auswaehlbare Profil-Icons/Avatare vorbereiten.
- [ ] Level/XP aus dem Hauptmenue ausblenden und erst nach einem klaren
      "JAGD BEGINNEN"-Schritt zeigen.
- [ ] Den vorhandenen Kettenbonus gegen die konkrete Regel "drei blaue
      Planeten hintereinander = doppelte Punkte" abgleichen und entscheiden,
      ob beide Boni nebeneinander bestehen sollen.

### P2 — Phase 6: Wettbewerb und Freunde

- [ ] Rangliste per Supabase Realtime aktualisieren, solange sie geoeffnet ist.
- [ ] Rekord-Ereignis im Spiel sichtbar machen; Web-Push fuer installierte Apps
      erst danach mit Einwilligung planen.
- [ ] Serverseitige Laufpruefung als Voraussetzung fuer einen echten
      Ranked-Modus.
- [ ] Freundesmodell auf `profiles` aufsetzen: Anfrage, Annahme, Online-Status,
      Rekord und Coin-Anzeige.
- [ ] 1vs1-Einladung zuerst als Duell-Link zwischen zwei Geraeten bauen;
      Echtzeit erst als folgenden Schritt pruefen.

### P3 — erst nach stabilem Kern

- [ ] Wiedergeburt/Prestige konzipieren: klarer Reset-Umfang, dauerhafter
      Multiplikator, Schutz vor versehentlichem Ausloesen und Migration fuer
      bestehende Profile.

### Entschieden (2026-08-13)

- **Phase 1 ist abgeschlossen.** Auf dem Handy laeuft v0.1.3, die Knoepfe
  reagieren. Der Fehler lag an der Auslieferung, nicht am Code.
- **Bestenliste wird geleert** beim Wechsel auf 90 Sekunden.
- **Talente werden mit Coins gekauft; Levelaufstiege geben Level-Coins.**
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
  Build und Signierung spaeter ueber Codemagic (Cloud) und TestFlight —
  Details in ADR-0015 (`docs/DECISIONS.md`) und im neuen Abschnitt
  "M8 — Native App vorbereiten" unten.
- **2.6 Login & Mehrgeräte-Profil:** wird vor dem Abschluss von Phase 4
  priorisiert. Der bisherige Sync-Code bleibt als Migration und Notfallweg;
  der neue Standard wird ein Backend-Profil mit Login.
- **5 Hindernisse:** entschieden und umgesetzt — ab Nullsektor bestrafen
- **6 Manipulationsschutz:** vor oder nach Ranked-Modus und Rekord-Meldungen?

### M8 — Native App vorbereiten (geplant, siehe ADR-0015)

> **Blockiert nichts.** Diese Punkte sind reine Konto-/Rahmenvorbereitung
> ohne Codeänderung und verzögern M4.1, M6 oder M7 nicht. Die eigentliche
> Umsetzung (Capacitor-Integration, `codemagic.yaml`) bleibt hinter M4.1/M6/M7
> einsortiert.

**Jetzt schon klärbar:**

- [ ] Apple Developer Account Status prüfen: Mitgliedschaft aktiv/bezahlt,
      Team-ID notiert, Zugriff auf App Store Connect, 2FA eingerichtet.
- [ ] App Store Connect: App-Eintrag "isiHunt" anlegen, Bundle-ID reservieren
      (Namensschema noch offen, siehe ADR-0015).
- [ ] App Store Connect API Key erzeugen (Rolle "App Manager"/"Admin"),
      Key-ID/Issuer-ID/`.p8`-Datei sicher verwahren.
- [ ] Codemagic-Account anlegen, Repository verbinden, API Key als
      Signing-Integration hinterlegen; vorher Preismodell/Build-Minuten fuer
      macOS-Builds pruefen.
- [ ] Testergruppe (E-Mail-Adressen) fuer TestFlight sammeln.

**Erst mit M8 (nach M4.1, M6, M7):**

- [ ] Capacitor-Pakete einbinden, `ios/`-Ordner erzeugen, `capacitor.config.ts`
      anlegen.
- [ ] `codemagic.yaml` einrichten, ersten Testbuild durchlaufen lassen.
- [ ] Update-Check-Mechanismus (`src/core/updateCheck.ts`) fuer die native
      Variante loesen (deaktivieren oder eigener Hinweis).
- [ ] Gerätetest der bestehenden Systeme auf echtem TestFlight-Build:
      Sound-Unlock (`SoundSystem`), Safe-Area (`SafeAreaSystem`,
      `viewport.ts`), `localStorage`-Persistenz (`SaveSystem`).
- [ ] Android-Reihenfolge gegen die Roadmap abgleichen (Roadmap nennt
      "Capacitor, Android-Test, iOS-Build/TestFlight" — Android zuerst als
      Testplattform).

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

- [x] **Pixel-Lineal** (`RulerScene`, über den Wartungsbildschirm): festes
      DOM-Raster über den kompletten Viewport. Bildschirmrand oben ist CSS-y 0,
      die Skala reicht bis zur exakten Unterkante; Safe Area und Spielfeld sind
      zusätzlich markiert.

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

## Phase 2.6 — Login & Mehrgeräte-Profil _(priorisiert, App integriert)_

> **Ziel:** Ein Profil kann dauerhaft auf mehreren eigenen Geräten genutzt
> werden, zum Beispiel auf iPhone und iPad. Beide Geräte melden sich mit
> demselben Profil an; Offline-Runs werden später sicher zusammengeführt.
>
> **Warum:** Der heutige Sync-Code ist ein einmaliger Spielstand-Umzug. Zwei
> Geräte können danach zwar dieselbe `cloudId` kennen, aber ein vollständiger
> Upload kann den Stand des anderen Geräts ersetzen. Das ist für ein dauerhaft
> gemeinsames Profil nicht ausreichend.

### Technischer Plan

- [x] **Supabase Auth einführen:** Login und Sitzung werden vom Backend
      verwaltet. Alias/Passwort ist der erste plattformübergreifende Weg;
      Apple-Login kann später für die native App ergänzt werden. Eine echte
      E-Mail wird weder abgefragt noch in Rangliste oder Profilanzeige verwendet.
- [x] **Profil-Tabelle und RLS-Skript anlegen:** `profiles.id` referenziert
      `auth.users.id`; Name, Erstellungs- und Änderungszeitpunkt liegen im
      Backend. `SaveData.cloudId` wird auf diese Profil-ID migriert.
- [ ] **SQL in Supabase ausführen und prüfen:** RLS erlaubt Lesen und Schreiben des
      eigenen Profils nur über `auth.uid()`. Ranglisten-Schreiben bleibt eine
      kontrollierte RPC; fremde Spielstände und Login-Daten bleiben verborgen.
- [x] **Login-UX in der App:** Auf dem ersten Gerät Profil anlegen oder
      einloggen; auf einem weiteren Gerät einloggen und Profil laden. Der
      Offline-Spielstart bleibt möglich, wenn das Netz vorübergehend fehlt.
- [x] **Offline-Outbox je Gerät:** abgeschlossene Solo-Runs werden lokal mit
      eindeutiger `event_id` vorgemerkt und bei Start, Rückkehr des Netzes und
      nach einem Run übertragen. Wiederholtes Senden darf nichts doppelt zählen.
- [x] **Zusammenführung statt Komplettüberschreiben:** XP und Coins aus
      bestätigten Solo-Runs werden addiert, Erfolge vereinigt, Bestwert und
      Best-Combo maximiert. Talentkäufe werden serverseitig atomar geprüft.
- [x] **Profiländerungen synchronisieren:** Namensänderungen werden auf allen
      Geräten sichtbar und aktualisieren auch den Ranglisteneintrag.
- [x] **Migration ohne Verlust vorbereiten:** Bestehende `cloudId`-Profile können nach dem
      ersten Login übernommen werden. Der alte Sync-Code bleibt zunächst als
      einmaliger Migrations- und Notfallweg erhalten.
- [ ] **Tests mit iPhone und iPad:** beide Geräte offline bespielen, danach
      verbinden; Level, Coins, Bestwert, Erfolge, Name und Wiederholungen prüfen.

### Lieferreihenfolge

1. Supabase Auth, `profiles` und RLS.
2. Login, Sitzung und Migration des bestehenden lokalen Profils.
3. Ereignisse, Offline-Outbox und idempotente Zusammenführung.
4. Der manuelle Gerätewechsel bleibt nur intern als Migrationsweg; die
   sichtbare Gerätewechsel-UI ist entfernt.
5. Echter iPhone-/iPad-Test; erst danach weitere Phase-4-Fortschrittsquellen
   als synchronisierte Ereignisse anschließen.

**SQL-Migration:** `supabase/phase_2_6_auth.sql` nach `schema.sql` im
Supabase SQL Editor ausführen. Danach in Supabase unter Authentication ->
Providers -> Email die Bestätigungspflicht deaktivieren, weil der Alias-Login
keine zustellbare E-Mail-Adresse verwendet. Ohne diese Schritte bleibt der
Login-Code bewusst funktionslos und das lokale Spiel läuft trotzdem weiter.

> **Native Anschluss:** Das Auth-Modell funktioniert zunächst als Web-App und
> später in Capacitor/TestFlight. Der native Build bleibt für Phase 8 geplant
> (siehe ADR-0015 in `docs/DECISIONS.md`); die Mehrgeräte-Datenstruktur muss
> dafür nicht neu erfunden werden.

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
> Erreichbar waere sie erst mit Capacitor (M8, siehe ADR-0015), und auch dann
> nur ueber ein natives Plugin.

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
- [ ] Erst mit M8 (Capacitor, siehe ADR-0015): Live Activity mit Punktestand
      und Restzeit waehrend eines Runs; bis dahin wird die Anzeige als
      Prototyp beobachtet.

> **Entscheidung fuer die native Live Activity:** Zunaechst soll sie waehrend
> des gesamten Runs sichtbar bleiben und laufend sinnvolle Informationen zeigen.
> Welche Inhalte dauerhaft bleiben, wird nach dem ersten Test entschieden.

## Phase 4 — Belohnung — abgeschlossen

- [x] Punkte-Popup auffaelliger (`floatingScore` mit animiertem Bonus-Hinweis)
- [x] Zeitbasierter Kettenbonus mit sichtbarem Multiplikator
- [ ] **Exakte Kinderregel nach Phase 4.1 entscheiden:** drei blaue Planeten
      hintereinander → doppelte Punkte. Sie ist nicht mit dem bestehenden
      allgemeinen Kettenbonus gleichzusetzen.
- [x] Coin-System: Feld im Spielstand, Anzeige, Quellen (Run, Erfolge und
      Levelaufstiege)
- [x] Talentbaum-Oberflaeche mit Rangkauf ueber Profil
- [x] Talente zuruecksetzen gegen 250 Coins, ohne Erstattung
- [x] Coin-Balance auf etwa einen Talent-Rang je fünf abgeschlossene Runden
- [x] **Vitest** — 62 Tests in npm run verify

> **Erledigt am 2026-08-14:** Phase 4 ist lokal und offline vollstaendig
> umgesetzt. Fuer angemeldete Profile muessen die beiden neuen RPC-Funktionen
> aus supabase/phase_2_6_auth.sql noch einmal im Supabase SQL Editor
> ausgefuehrt werden.

### Balancing noch nachtesten

> Erste technische Runde umgesetzt: Die Phase-5-Strafen wurden reduziert und
> die Solo-Grundbelohnung auf 25 Coins angepasst. Die offenen Punkte brauchen
> noch echte Runs mit Emre und Simay, bevor sie als abgeschlossen gelten.

- [ ] **Phase-5-Schwierigkeit:** Weltmodifikatoren und Hindernisse mit den
      Kindern testen; Spawnrate, Lebensdauer, Blinkdauer, Bremswirkung und
      Zeitstrafe so einstellen, dass die Welten fordernd, aber nicht frustrierend
      werden.
- [ ] **Coin-/Talent-Balance:** Coin-Einnahmen pro Runde, Relikt und Levelaufstieg
      gegen Talentkosten und Resetkosten prüfen; Ziel bleibt ungefähr ein
      sinnvoller Talent-Rang nach etwa fünf normalen Runden.
- [x] **Talentpunkte-Migration:** geprüft, dass alte Talentpunkte genau einmal
      korrekt in Coins überführt werden und keine doppelten Gutschriften entstehen.

## Phase 5 — Herausforderung

- [x] Tages-Herausforderung mit festem Seed (UTC-Tag + Welt bilden den Seed)
- [x] Duell gegen Bot mit drei deterministischen Schwierigkeitsstufen
- [x] Weltmodifikatoren umgesetzt: Trägheit, kürzere Lebensdauer, Blinken und
      erhöhte seltene Planeten
- [x] Hindernisse: keine in Sternenweide, bremsend in Eisring/Glutnebel,
      zeitbestrafend in Nullsektor/Sonnenkrone
- [x] `GAME_DESIGN.md` §10 präzisieren: keine Lebenspunkte und kein Game Over;
      Einstiegswelten bestrafen nur mit lesbaren Bremsen, spätere Welten mit
      kurzem Zeitverlust.
- [ ] ~~Ranked-Modus~~ — blockiert, siehe Phase 6

## Phase 6 — Sozial

- [x] Zeitstempel in der Bestenliste anzeigen
- [ ] **Punkte serverseitig bewerten** (Supabase Edge Function, Run nachspielen)
      — Vorbedingung fuer Ranked und Rekord-Meldungen
- [ ] Realtime-Sync der Bestenliste
- [ ] Freundesliste auf die dauerhafte Profil-/Geräteidentität aus Phase 2.6
      aufsetzen (kein zweites Identitätssystem)
- [ ] Freundesliste mit Online/Offline, Rekord, Coins
- [ ] Duell per geteiltem Link (ADR-0010 Schritt 1)
- [ ] Rekord-Meldung im laufenden Spiel; echte Push-Meldung nur fuer
      installierte Web-Apps (iOS-Grenze)

---

## Aufraeumen

- [ ] **PRIO HOCH — Testdaten aus der Produktions-Supabase-Datenbank
      loeschen** _(neu 2026-08-17)_

  > **Was passiert ist:** Beim Nachziehen von Testabdeckung fuer
  > `CloudSystem` (Audit-Block, siehe `docs/AUDIT_2026-08-17.md` Abschnitt
  > 5.2) hat ein erster, ungemockter Testlauf tatsaechlich gegen die echte
  > Produktions-Supabase-Instanz gesprochen — nicht gegen eine Attrappe. Der
  > Grund: `isBackendConfigured` (`src/config/backend.ts`) wird beim
  > Modul-Laden aus `import.meta.env.VITE_SUPABASE_URL`/`_ANON_KEY`
  > berechnet. Die lokale, gitignorete `.env`-Datei auf diesem Rechner
  > enthaelt dieselben echten Zugangsdaten wie `.env.production`, und Vite/
  > Vitest laedt `.env` automatisch bei jedem lokalen Lauf — auch bei
  > Tests. Ohne expliziten Mock verhaelt sich ein Testlauf also identisch
  > zur echten App und schreibt in dieselbe Datenbank wie echte Spieler.
  >
  > **Usecase, der das ausgeloest hat:** Der Test sollte pruefen, dass
  > `CloudSystem`-Funktionen (`pushSave()`, `createSyncCode()`, etc.) bei
  > fehlender Backend-Konfiguration sauber `{ ok: false }` zurueckgeben statt
  > zu werfen (die im Modulkommentar von `CloudSystem.ts` versprochene
  > "wirft nie"-Garantie). Die Testannahme war "in dieser Umgebung ist kein
  > Backend konfiguriert" — das stimmte in der CI (kein `.env`), aber nicht
  > lokal (echte `.env` vorhanden). Dadurch lief `pushSave()` durch, legte
  > einen echten Spielstand-Datensatz an, und `createSyncCode()` erzeugte
  > einen echten, einloesbaren Sync-Code dazu.
  >
  > **Sofort behoben im Code:** `src/systems/CloudSystem.test.ts` mockt
  > seither `@/config/backend` fest auf "nicht konfiguriert"
  > (`vi.mock('@/config/backend', ...)`), unabhaengig davon, ob lokal eine
  > `.env` mit echten Werten liegt. Kuenftige Testlaeufe koennen nicht mehr
  > versehentlich gegen die echte Datenbank schreiben. **Das hier offene
  > Aufraeumen betrifft nur die zwei bereits entstandenen Altdatensaetze.**
  - [ ] Supabase-Dashboard → Table Editor → Tabelle `sync_codes` → Zeile mit
        `code = '67N0B2'` suchen und loeschen.
  - [ ] Supabase-Dashboard → Table Editor → Tabelle `saves` → Zeile mit
        `id = 'b91ec0c5-999f-4408-8cc7-587bb0c065c5'` suchen und loeschen.
  - [ ] Vor dem Loeschen zur Sicherheit `created_at`/`updated_at` beider
        Zeilen gegenpruefen: beide sind exakt am 2026-08-17 kurz vor dem
        ersten Commit dieser Aufraeum-Session entstanden. Der Score-Eintrag
        hat keinen plausiblen `playerName` und keine Verbindung zu einem
        echten Auth-Profil — eindeutig als Testdaten erkennbar.
  - [ ] **Nicht zeitkritisch:** Kein Schaden fuer echte Spieler (die
        `playerId` ist zufaellig, gehoert zu keinem echten Profil, taucht in
        keiner ihnen zugeordneten Ansicht auf). Einzige denkbare Sichtbarkeit
        waere ein Rangplatz in der Welt-Bestenliste (`LEADERBOARD_LIMIT =
10`) mit Score 100 — nur relevant, falls die jeweilige Welt aktuell
        sehr wenig befuellt ist. Erledigen, sobald ohnehin im
        Supabase-Dashboard gearbeitet wird.

- [ ] `src/ui/hitDebug.ts` entfernen, sobald der Knopf-Fehler bestaetigt behoben
      ist — es ist ein Diagnosewerkzeug, kein Feature
- [x] `ideen.txt` in die priorisierte Planung oben ueberfuehrt; die Datei bleibt
      als unveraenderte Quelle des Kinderfeedbacks erhalten.
