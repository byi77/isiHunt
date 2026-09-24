# Roadmap — isiHunt

**Stand:** 2026-08-30 · Produktstand siehe `package.json`/`version.json` · Die detaillierte und verbindliche Aufgabenreihenfolge
steht in [`TODO.md`](../TODO.md). Diese Datei zeigt nur den Produktweg.

## Bereits spielbar

- [x] Eigene Spielfeldkulisse mit strukturierten Weltennebeln, drei
  Sternlagen, sanfter Parallaxe und hochaufgeloestem Randplaneten.

### Grafik-Update - Grafikrunde 3 (2026-09-24)

- [x] Start aus dem Menue mit Tauch-Uebergang; der vorhandene Szenenwechsel
  traegt den Ablauf bis zur Jagd und zum Ergebnis.
- [x] Prozedurale, statische Weltkonturen fuer Eis, Gas, Raumriss und weitere
  Welttypen in den aeusseren Spielfeldzonen.
- [x] Ausgeruestetes Schiff zusaetzlich in der Solo-Ergebnisansicht.
- [x] Dezente Cockpit-Skala am HUD und facettierter Siegelrand fuer legendaere
  Fangaeffekte.
- [ ] Sichtpruefung auf 360/390/402 CSS-Pixeln, echte Mobilgeraete,
  reduzierte Bewegung und Laufzeit-/Speichermessung.

Details und offene Pruefungen: [Grafik-Update-Plan](GRAFIK_UPDATE_PLAN.md).

### Grafik-Update - Schiffe (2026-09-24)

- [x] Schiffstexturen in dreifacher Aufloesung mit Kontur, Fase, Licht und Glanz.
- [x] 18 Raumschiffe und Flugzeuge neu gezeichnet; Figuren, Tiere und Drohnen mit Binnenzeichnung.
- [x] Hangar zeigt die eingefaerbte Zeichnung statt einer einfarbigen Silhouette.
- [x] Bonus-XP-Knopf nur bei vorhandenem Bonusrecht, ohne Ueberdeckung des Startknopfs; verstaendliche Fehlermeldungen.
- [x] Menue-Logo nicht mehr vom Vollbildknopf verdeckt; Emojis bei Buchstabenabstand heil.
- [ ] Formen 30-99 (nicht im Shop) und 3D-Modelle unveraendert; Bonusknopf mit echtem Bonusrecht auf dem Geraet pruefen.

### Grafik-Update - Runde 2 (2026-09-24)

- [x] Hindernisse als Schatten mit Warnkontur und Symbol statt Leuchten und Lila.
- [x] Restzeitbogen um jedes Relikt; Lichtriss beim Erscheinen ab episch.
- [x] Roter Warnrand im Sekundentakt in den letzten 10 Sekunden; HUD-Schleier ohne Doppelzeilen.
- [x] Ueberblendungen zwischen Menue, Weltinfo, Duell, Jagd und Ergebnis.
- [x] Leuchtshader fuer Figur und epische/legendaere Relikte; Effektstufe VOLL/SPARSAM (ADR-0027).
- [x] Erfolgsabzeichen je Kategorie mit Rangmarken; Rangrahmen passt sich der Schrift an.
- [x] Freischaltungen im Ergebnis mit aufdrehendem Bild.
- [x] `npm run verify` (660 Tests) und Playtest `--sim` 76/76 gruen; Screenshots im Browser geprueft.
- [ ] Voller Playtest ohne `--sim`, echte Mobilgeraete und Bildrate der Leuchtshader auf schwachen Geraeten.

### Grafik-Update - Punkt 7 live in v0.1.322

- [x] Drehbarer 3D-Hangar mit Plattform, neun Modellen, Farben, Auren und Triebwerkslicht.
- [x] Passende 2D-Silhouetten, scrollbare Auswahl und feste Aktionen ab 44 CSS-Pixeln.
- [x] Layouts bei 320/390/430 Pixeln und fünf Öffnen-/Schließen-Zyklen geprüft; 611 Tests bestanden.
- [ ] Echte Mobilgeräte, OS-Bewegungsreduktion und GPU-/Speicher-Langzeitprüfung.

Details: [Punkt 7](design/2026-09-17-hangar/README.md).
Technische Nachprüfung: [Abschlussbericht](design/2026-09-17-audit/README.md).

### Grafik-Update - Punkt 8 lokal umgesetzt

- [x] Gemeinsame Ergebnisansicht mit festem Kopf, 44-CSS-Pixel-Aktionen und scrollbar allen Belohnungen.
- [x] Rekorde, Levelaufstieg, Talentpunkte und Freischaltungen getrennt hervorgehoben.
- [x] Kleine/grosse Formate, Mehrfachbelohnungen, vier Spieler und lokale Bot-Praemien geprueft; 611 Tests bestanden.
- [ ] Echte Mobilgeraete, reduzierte Bewegung auf OS-Ebene und Live-Netzwerkduell.

Details: [Punkt 8](design/2026-09-17-results/README.md).


### Grafik-Update — Punkt 6 lokal umgesetzt

- [x] Gebogene Lichtsplitter, geneigte Ringe und nicht allein farbgebundene Seltenheitshinweise.
- [x] Acht aktive Fangdarstellungen, maximal 700 ms; ruhige Alternative und vollständige Bereinigung.
- [x] HUD-/Randabstände und 50-Fang-Budget geprüft; 609 Tests bestanden.
- [ ] Schwache Mobilgeräte, hörbare Audio-Latenz und Langzeitprüfung.

Details: [Punkt 6](design/2026-09-16-collection/README.md).

### Grafik-Update — Punkt 5 lokal umgesetzt

- [x] Feste HUD-Spalten, eigene Gegnerzeilen und ruhige Unterlage auf allen Welten.
- [x] Stabile Textgrenzen bei Punkte-/Serienfeedback; Talentdetails in der Pauseansicht.
- [x] Pause- und Dialogbuttons mindestens 44 CSS-Pixel; Inhalt und Größenwechsel berücksichtigt.
- [x] Zehn Weltansichten sowie korrigierte Textabstände in drei Formaten geprüft; 603 Tests bestanden.
- [ ] Echte Geräte, vollständige Runde unter realer Last und Live-Netzwerkduell prüfen.

Details: [Punkt 5](design/2026-09-16-hud/README.md).

### Grafik-Update — Punkt 4 lokal umgesetzt

- [x] Kontrastreichere Raumjäger, weiche Flugneigung und Partikelursprung am Heck.
- [x] Dekorativer Aura-Ring vor/hinter dem Rumpf; gemeinsamer 2D-Stil und 3D-Tiefentest.
- [x] Zentrierte 3D-Drehung und kombinierte Shop-Anprobe über Reiter hinweg.
- [x] Menü-/Shop-Sichtprüfung und 599 erfolgreiche Tests einschließlich Flugpose.
- [ ] Echte Mobilgeräte und vollständige Skin-/Aura-Kombinationsprüfung.

Details und Aufnahmen: [Punkt 4](design/2026-09-16-ships/README.md).

### Grafik-Update — Punkt 3

- [x] Zehn eigene Kugeloberflächen mit fester Beleuchtung und Atmosphärenrand.
- [x] Ringe hinter/vor dem Planeten, Koronen und Monde; Kulissen mit geringem Kontrast.
- [x] Oberflächenrotation im Menü, langsame Nebeldrift und stehende Sterne bei reduzierter Bewegung.
- [ ] Echte Mobilgeräte- und Langzeitmessung der neuen Effekte.

Prüfumfang und offene Punkte: [Grafik-Update-Plan](GRAFIK_UPDATE_PLAN.md).

### Grafik-Update — Punkt 2 umgesetzt

- [x] Hauptmenü und gemeinsamer Button-/Panelstil, CSS-basierte Menüabstände.
- [x] Profilbeschriftung vom Namensfeld getrennt; lange Namen im Menü begrenzt.
- [ ] Abschließende Prüfung auf echten Mobilgeräten einschließlich iOS.

Arbeitsstand, Nachweise und nächste Etappe: [Grafik-Update-Plan](GRAFIK_UPDATE_PLAN.md).

### M0 — Fundament ✅

Das Browser-Spiel, Touch- und Tastatursteuerung, Persistenz, Tests, Build und
automatische Auslieferung stehen.

### M1 — Spielgefühl und Bedienung ✅

Menüs, Pause, Run verlassen, sichtbare iOS-Installationshilfe, einheitliche
Zurück-Navigation und große Touch-Trefferflächen sind umgesetzt. Emre und
Simay haben die Button- und Zurück-Navigation am Testgerät erneut als gut
funktionierend bestätigt.

### M2 — Profil und Fortschritt ✅

Profile, Charaktername, Level bis 100, XP, Erfolge, Weltenfreischaltung,
Bestwert und lokale Speicherung funktionieren. Ein angemeldetes Profil kann
seinen Namen ändern und wird im Hauptmenü gezeigt.

### M2.6 — Login und mehrere Geräte 🟡

Alias-Login mit PIN, gemeinsamer Fortschritt, Offline-Outbox und sichere
Zusammenführung sind implementiert.

**Live bestaetigt am 2026-08-30:** Der verknuepfte Supabase-Stand steht auf
Phase 2.42; `supabase/verify_migration_state.sql` findet den Migrationsmarker
und die erwarteten RPC-Signaturen. Offen bleibt der echte iPhone-/iPad-Test mit
Offline-Runs und anschliessender Verbindung.

### M3 — Weltraumwelt ✅

Das Licht-Raumschiff ersetzt den Stern, Relikte sind Planeten, jede Raumzone
hat eigene Sternen-, Nebel- und Planetenansichten. Mit hohem Level werden
Raumschiff-Skins und schwierigere Welten freigeschaltet.

### M4 — Belohnung, Coins und Talente ✅

Punkte-Popups, Kettenbonus, Coins, Erfolge, die talentpunktbasierte Talent- und Shop-
Ansicht und der sichtbare Level-Up-Moment sind spielbar.

> Die Talentpunkt-Wirtschaft ist die geltende Entscheidung (ADR-0021):
> Level vergeben kostenlose Talentpunkte, der Reset ist kostenlos, und Coins
> bleiben für Runs, Levelbelohnungen und den Shop.

### M5 — Herausforderungen und Modi ✅

Normaler Solo-Run, Tages-Herausforderung, VS Bot mit mittlerer Schwierigkeit
und Siegbonus sowie Weltmodifikatoren und Hindernisse sind vorhanden. Das
Online-Duell erweitert den Modus um eine direkte Bereitschaftslobby, einen
Host-Raum fuer zwei bis vier Geraete, Einladungen, gemeinsame Talentphase,
Live-Gegnerpunkte und persistente Ergebnisse.

**Noch offen:** Schwierigkeit und Belohnungen mit der Zielgruppe sowie der
Online-Ablauf auf echten iPhone-/Android-Geraeten balancieren und abnehmen.

## Nächste Meilensteine

### M4.1 — Talentdarstellung und Profilidentität

- Kostenlose Talentpunkte aus Leveln und einen kostenlosen Reset beibehalten;
  bestehende Testprofile werden bei der Version-9-Migration zurückgesetzt.
- Die zehn unabhängigen Talent-Ränge als ehrliche, kindgerechte Liste
  verständlich darstellen und visuell weiter polieren; kein Baumversprechen.
- Talentpunkte, Talentränge und Kosmetikstände geräteübergreifend synchron halten.
- Profil-Icons, getrennten sichtbaren Spielernamen und Skin-Inventar
  weiterführen.

### M6 — Freunde, Wettbewerb und Realtime

- Live-Aktualisierung der Rangliste.
- Rekord-Ereignisse im Spiel und später optional Web-Push für installierte
  Apps.
- Serverseitige Laufprüfung als Grundlage für Ranked.
- Freundesliste mit Anfrage, Online-Status, Rekord und Coins.
- Erweiterte Freundesfunktionen rund um die bestehende Duell-Lobby, sobald
  Datenschutz, Moderation und Reichweite geklaert sind.

### M7 — Prestige

Wiedergeburt als freiwilliger, geschützter Reset mit dauerhaftem Multiplikator.
Der genaue Reset-Umfang und die Belohnung werden erst nach validierter
Level-100-Kurve, Coin-Economy und Zielgruppen-Abnahme festgelegt.

### M8 — Native App

Capacitor, Android-Test, iOS-Build/TestFlight und erst dann native Features
wie Live Activities bei der Dynamic Island. Technischer Weg (Codemagic ohne
eigenen Mac, App Store Connect API Signing) und Voraussetzungen-Checkliste
stehen in ADR-0015 (`docs/DECISIONS.md`); die vorbereitbaren Konto-Schritte
sind in `TODO.md` gelistet und blockieren M4.1/M6/M7 nicht.

## Grundsätze

- Eine Hand, Hochformat, keine Werbung und keine In-App-Käufe.
- Kinderfeedback entscheidet vor Annahmen im Code.
- Erst ein stabiles gemeinsames Profil, dann Freunde, Ranked und Push.
- Jede konkrete Aufgabe, Entscheidung und Priorität gehört in die
  [`TODO.md`](../TODO.md).
