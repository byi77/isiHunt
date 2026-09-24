# Einbauplan: grafische Modernisierung

Stand: 24. September 2026 · lokale Umsetzung und Browserprüfung abgeschlossen;
Gerätefreigabe ausstehend.

## Umsetzungsstand am 24. September 2026

- **M1–M2:** Talentabstände und Gruppenpfade, Profil mit getrenntem XP-Block,
  Ergebnis-Kopf, kompaktes Menü, Hangar-Zustände, CSS-gemessene Tippziele,
  gemeinsame Vektor-Icons, Weltmerkmal, kürzere Tagline, einheitliche Rückwege
  und erklärender Ranglisten-Leerzustand sind eingebaut.
- **M3–M4:** Schärfere Relikt-Kontur, ruhigerer Glow und zehn Weltzeichen
  ergänzen die vorhandenen HUD-, Fang- und Weltkontur-Systeme. Erfolgsfilter,
  Hangar-Ausrüstimpuls und Talentpfade sind eingebaut.
- **M5:** Sammlungsalbum, Profilkarte, bestehendes Freischaltbild und lokaler
  Hangar-PNG-Export sind eingebaut.
- **Prüfung:** Browser-Playtest ohne Simulation 78/78, ergänzter Screenshot-
  und Touchtest mit PNG-Inhaltsprüfung 35/35, Navigation 8/8, simulierter
  Modustest 5/5 sowie `npm run release:check` mit Smoke-, Produktions-,
  Performance-, iOS- und SQL-Gate bestanden. Die
  [Sichtprüfung](design/2026-09-24-modernisierung/README.md) enthält
  Vergleichsbilder.
- **Offen:** Reale Geräte, alle kritischen Spielzustände, Graustufenprüfung
  aller zehn Welten, getrennte 2D/3D- und Effektstufenmessung, vollständige
  M0-Referenzmatrix sowie Formblätter für Partikel und Bewegungsrhythmen
  (M3.6). Die zehn Randzeichen erfüllen den ersten Teil von M5.1; ihre
  Ablenkung und Kosten sind auf Zielgeräten noch nicht geprüft.

Dieser Plan setzt die Vorschläge aus der UI-Durchsicht vom 24. September vollständig
in Arbeitspakete um. Die bestehende Weltraumoptik, die aktive Wortmarke, die
Spielregeln und das Balancing sind die Ausgangslage. Bereits vorhandene
Weltkonturen, Fang-Effekte, HUD-Spalten, Übergänge, 3D-Hangar und
Ergebnis-Scrollansicht werden gezielt verbessert, nicht erneut gebaut.

Die Produkt- und Freigabereihenfolge aus [`TODO.md`](../TODO.md) bleibt
verbindlich. Insbesondere ersetzen Screenshots keine dort geforderte
Geräte-, Backend- oder vollständige Spielabnahme. Neue Gestaltungswerte kommen
vor der Implementierung in [`ART_STYLE.md`](ART_STYLE.md); abgeschlossene
Pakete werden in [`ROADMAP.md`](ROADMAP.md) und `CHANGELOG.md` belegt.

## Zielbild und feste Regeln

- Pro Ansicht ist in drei Sekunden erkennbar: Wo bin ich, was ist der wichtigste
  Wert, was kann ich als Nächstes tun?
- Schiff, Relikte, Welt und Warnungen bleiben auf 320 × 568 CSS-Pixeln ohne
  Vergrößern unterscheidbar. Seltenheit und Zustände nutzen Form/Text zusätzlich
  zur Farbe.
- Primäraktionen behalten mindestens 44 × 44 CSS-Pixel Trefferfläche. Untere
  Safe Area, Browserleisten, Tastatur und kurze Displays gehören zur Prüfung.
- Animationen blockieren weder Eingaben noch den Run. `prefers-reduced-motion`,
  Pause, versteckter Tab und Effektstufe `SPARSAM` erhalten dieselbe Information.
- Neue Oberflächen und Effekte bekommen vor dem Rollout eine gemessene
  Startzeit-, Framezeit- und Speicherbaseline. Kein pauschales FPS-Versprechen
  aus simulierten Runs.
- Alle folgenden Punkte erhalten vor der Umsetzung einen kompakten Entwurf für
  320 und 390 CSS-Pixel. Nach jedem Paket folgen ein echter Render-Screenshot,
  Interaktionstest und ein Vergleich mit der Baseline.

## Reihenfolge und Freigaben

| Stufe | Inhalt                                          | Eintritt                 | Fertig, wenn                                                                  |
| ----- | ----------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| M0    | Referenzen, Stil- und Messgrundlage             | Aktueller lokaler Build  | Vergleichsbilder, offene Kollisionen und Baseline dokumentiert                |
| M1    | Talentbaum, Profil, Ergebnis und kurze Displays | M0                       | Die belegten Dichte-/Abstandsprobleme behoben; Inhalte vollständig erreichbar |
| M2    | Gemeinsame Typografie, Navigation und Hauptmenü | M1                       | Alle Kernseiten folgen derselben Hierarchie und Zustandslogik                 |
| M3    | Spielfeld, HUD und Weltwechsel                  | M0, M2-Tokens            | Spielinformation bleibt über allen zehn Welten lesbar                         |
| M4    | Hangar, Erfolge und Fortschritt                 | M1, M2                   | Besitz, Anprobe, Kauf und Fortschritt sind sofort erkennbar                   |
| M5    | Größere Zusatzansichten und Inszenierungen      | M3, M4, Gerätebefund     | Nur belegte Verbesserungen bestehen Geräte- und Leistungsprüfung              |
| M6    | Gesamtprüfung und Auslieferung                  | M1–M5, soweit beauftragt | Versionierter End-to-End-Nachweis auf Zielgeräten                             |

M1–M4 sind der Kern der Modernisierung. M5 enthält die ausdrücklich als
Nice-to-haves genannten Ergänzungen; seine Teilpakete können einzeln
ausgeliefert werden. Ein Paket wird erst abgehakt, wenn seine Abnahme belegt
ist. Bei jedem Schritt bleiben bestehende Navigation, Scrollposition,
Spielstand und Kaufregeln erhalten.

## M0 — Ausgangslage und Gestaltungssystem

**M0.1 Referenzmatrix.** Aktuellen Build und Versionsnummer festhalten.
Menü, Profil, Talentbaum, Shop/Hangar, Erfolge, Weltinfo, Duellwahl, Rangliste,
laufendes Spiel, Pause und Ergebnis bei 320 × 568, 390 × 844 und 430 × 932
aufnehmen; kritische Zustände (lange Namen, gesperrt, offline, viel Belohnung,
wenig Restzeit) ergänzen. Die vorhandenen Playtest-Bilder sind Vergleichsmaterial,
kein Nachweis für den neueren Build. Einstieg: `scripts/playtest.mjs`,
`src/ui/layoutAudit.ts`, `docs/design/`.

**M0.2 Lesbarkeitstests als Designwerkzeug.** Dieselben Motive als Graustufen-
Miniaturen und stark verkleinerte beziehungsweise unscharfe Bilder vergleichen.
Notieren, ob Hauptaktion, wichtigste Zahl, Schiff, Relikt und Welt noch zu erkennen
sind. Dies setzt die genannten Grau- und Blur-Tests um. Keine künstlichen
Pixelgrenzwerte als Ersatz für Sichtprüfung.

**M0.3 Tokens und Effektbudget.** In `src/ui/theme.ts` und `ART_STYLE.md` Regeln
für Schrifthierarchie, Panelabstände, Fokus, Zustände, Iconmaße und Akzentfarben
definieren. Gold ist zuerst Hauptaktion und echte Belohnung; die Weltfarbe
charakterisiert die Kulisse. Pro Szene festhalten, welche Glows, Schatten,
Partikel und Animationen sichtbar sein dürfen. Helle Objektkerne werden vor
größeren Leuchtflächen priorisiert. Die vorhandenen Seltenheitsfarben bleiben
Spielinformation.

**M0.4 Technikbaseline.** Startzeit, Framezeit, Speicher und aktive Renderer-
Ressourcen in Menü, Hangar, laufendem Spiel und Ergebnis messen. Volle und
sparsame Effekte sowie 2D-Fallback getrennt erfassen. Bestehende
`PerformanceSystem`-/Playtest-Werkzeuge verwenden; auffällige Countdown-Zeiten
aus früheren Berichten als offene Messunsicherheit behandeln.

**Abnahme M0:** Referenzordner mit Version, Viewport, Gerät/Browser und Zustand;
Stiltafel für Eisring und eine zweite kontrastierende Welt; dokumentierte
Lese- und Leistungsbaseline.

## M1 — Sichtbare Layoutprobleme zuerst

| ID   | Einbau                                       | Ansatz / Dateien                                                                                                                                                                         | Abnahme                                                                                                                      |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| M1.1 | Talentgruppen und Karten entflechten         | `src/scenes/TalentScene.ts`: Gruppenüberschrift samt Linie außerhalb der ersten Karte; Zeilenhöhe aus tatsächlichem Textbedarf; Name/Effekt vor Rang/Kauf.                               | Keine Kreuzung von Überschrift, Linie, Karte, Rangmarken oder Button bei 320/390/430; Scrollen und Käufe funktionieren.      |
| M1.2 | Profilkarte entlasten                        | `src/scenes/ProfileScene.ts`: XP als klar beschrifteter Fortschrittsblock; Abstand zu Namensfeld und Speichern; Statistik und Gerätebereich nach Bedeutung staffeln.                     | XP, Eingabe und Aktion sind getrennt; lange Namen, Tastatur und Offline-Status bleiben lesbar.                               |
| M1.3 | Ergebnis in zwei Informationsebenen gliedern | `src/ui/ResultView.ts`, `src/ui/resultContent.ts`: Kopf mit Punktzahl/Rekord/Gesamtbelohnung, scrollbare Details darunter; doppeltes „Run beendet“ entfernen; alle Belohnungen behalten. | Erste Ebene ohne Scrollen verständlich; Solo, Tageslauf, Bot und 2–4-Spieler-Duell verlieren keine Daten oder Aktionen.      |
| M1.4 | Kompaktes Menü bewusst komponieren           | `src/ui/menuLayout.ts`, `src/ui/MenuView.ts`: für kurze Displays Schiff und Weltbild neu gewichten, Nebenaktionen kompakter verteilen; kein bloßes Herunterskalieren.                    | Planet, Schiff, Weltname und Jagdstart sind bei 320 × 568 klar erkennbar; alle Ziele mindestens 44 CSS-Pixel.                |
| M1.5 | Hangar-Zustände trennen                      | `src/ui/HangarView.ts`, `src/ui/hangar.css`: „ausgerüstet“, „in Besitz“, „Anprobe“ und „gesperrt“ mit Wort/Symbol direkt an aktiver Kachel und Vorschau zeigen.                          | Ein dokumentierter kurzer Erkennungstest ordnet die vier Zustände ohne Erklärung korrekt zu; Tastatur/Fokus bleibt sichtbar. |

M1.5 ist ein Klarheitsumbau. Die bestehende 3D-Vorschau und die Kaufregeln bleiben
unberührt. Beim Ergebnis keine weitere künstliche Warte- oder Zählsequenz
einführen.

## M2 — Gemeinsame Oberfläche und Menü

| ID   | Einbau                                  | Ansatz / Dateien                                                                                                                                                                                                      | Abnahme                                                                                                |
| ---- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| M2.1 | Typografische Hierarchie                | `src/ui/theme.ts`, `src/ui/widgets.ts`, Szenen: Titel, Hauptzahl, Handlung, Erklärung und Metadatum einheitlich abstufen; längere Texte in normaler Schreibweise.                                                     | Jeder Screen besteht den Drei-Sekunden-Test; keine abgeschnittenen deutschen Texte bei 320 CSS-Pixeln. |
| M2.2 | Weniger Rahmen, gezieltes Gold          | `widgets.ts`, `hangar.css`, betroffene Views: Flächen durch Abstand/Helligkeit gruppieren; Konturen vor allem für aktive/fokussierte Elemente.                                                                        | Hauptaktion und echte Belohnung haben in Graustufe und Farbe die stärkste UI-Hierarchie.               |
| M2.3 | Einheitliches Iconset                   | Gemeinsame kleine Phaser-Formen/SVGs für Welt, Zeit, Coins, XP, Rang, Shop, Profil und Zurück; vorhandene Icons inventarisieren, Lizenz dokumentieren.                                                                | Gleiches optisches Gewicht in Phaser und DOM-Hangar; Symbole ohne Farbe unterscheidbar.                |
| M2.4 | Zurück-Navigation vereinheitlichen      | `src/ui/widgets.ts`, Unterseiten, `HangarView.ts`: Position, Pfeil, Beschriftung und Fokusfolge angleichen.                                                                                                           | Von jeder Unterseite ist der Rückweg auf 320/390/430 sichtbar und per Touch/Tastatur erreichbar.       |
| M2.5 | Weltwahl als Expeditionskarte           | `MenuView.ts`, `menuLayout.ts`: aktueller Planet, Weltname, Index, ein prägnantes Merkmal sowie Freischalt-/Gefahrenstatus als ein Block.                                                                             | Weltwahl ist ohne Tippen auf Info verständlich; keine Kollision mit Schiff oder Startaktion.           |
| M2.6 | Tagline und Menügruppen                 | Tagline unter der aktiven Wortmarke kürzer und ruhiger setzen; Spielmodi und Meta-Bereiche über Abstand/kleine Labels gruppieren. Verworfene Logoentwürfe bleiben verworfen.                                          | Menü bei 320 × 568 ohne gedrängte Kopfzeile; Jagdstart bleibt primär.                                  |
| M2.7 | Weltwechsel-Rückmeldung                 | Beim Wischen kurzer Wechsel von Name/Planet/Index; reduzierte Bewegung zeigt sofort denselben Endzustand.                                                                                                             | Schnelles mehrfaches Wischen, Tab-Wechsel und Resize führen zum richtigen Weltzustand.                 |
| M2.8 | Gesperrte und Offline-Aktionen erklären | Menü, Rangliste, Weltinfo und Shop: kurzer Grund direkt am Element oder im leeren Zustand; Text und Form statt bloß gedimmter Farbe.                                                                                  | Spieler erkennen, ob etwas gesperrt, offline, leer oder noch nicht freigeschaltet ist.                 |
| M2.9 | Leerraum sinnvoll nutzen                | `src/scenes/DuelSelectScene.ts`, `src/scenes/LeaderboardScene.ts`: bei leerem oder offline Datenstand eine passende Weltillustration mit einem knappen nächsten Schritt zeigen; Spielflächen und Buttons frei halten. | Leerzustände wirken absichtlich gestaltet und erklären die nächste mögliche Aktion bei 320/390/430.    |

Die aktiven Farben und die derzeitige Wortmarke bleiben Grundlage. Vor neuen
Icons oder Akzentwerten wird `ART_STYLE.md` aktualisiert.

## M3 — Spiel, HUD und Weltbild

| ID   | Einbau                           | Ansatz / Dateien                                                                                                                                                           | Abnahme                                                                                                               |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| M3.1 | Relikte bei 320 Pixeln schärfen  | `src/ui/textures.ts`, `CollectionEffects.ts`, relevante Spielobjekte: Silhouette/hellen Kern vor Radius und Glow anpassen.                                                 | Seltenheitsstufen und Hindernisse in Bewegung, Graustufe und voller Kulisse erkennbar; Kollisionsfläche unverändert.  |
| M3.2 | Schiff vom Hintergrund trennen   | `shipShapes.ts`, `textures.ts`, `GameScene.ts`: kontrollierte Außenkante und konsistente Tints in zehn Welten prüfen.                                                      | Schiff bleibt mit allen kaufbaren Formen, Farben und Auren bei kleinster Spielgröße lesbar.                           |
| M3.3 | Fangstufen fein abstimmen        | Vorhandene `CollectionEffects.ts`/`collectionMotion.ts` nutzen: häufig kurz, episch/legendär mit eindeutiger Form und Name; keine aufgestauten Effekte.                    | 50-Fang-Belastung, Restzeit, Pause und reduzierte Bewegung ohne verdeckte Eingaben oder verlorene Information.        |
| M3.4 | HUD im echten Run prüfen         | `HudScene.ts`, `hudLayout.ts`, `FinalSecondsWarning.ts`: Zeit vor Punkte/Combo priorisieren; Warnzustand lesbar statt dauerhaft dominant.                                  | Solo und Duell mit langen Namen, hohen Zahlen und letzten zehn Sekunden auf 320/390/430 sowie echten Geräten geprüft. |
| M3.5 | Bewegungsmuster vereinheitlichen | Übergang, Treffer und Belohnung bekommen unterscheidbare kurze Muster; bestehende Systeme `sceneTransition.ts`, `collectionMotion.ts`, `shipFlight.ts` weiterverwenden.    | Rückmeldung beim ersten Frame erkennbar; reduzierte Bewegung zeigt denselben Zustand ohne Animation.                  |
| M3.6 | Weltformen ausbauen              | Pro Welt Formblatt für Silhouette, Randkulisse, Partikelform und Bewegungsrhythmus; Eisring zuerst, dann andere Welten. Im Spielfeld weniger Details als im Menü/Ergebnis. | Zehn Welten in Graustufen-Miniatur unterscheidbar; keine Gefahr oder Relikte verdeckt.                                |

M3.3 und M3.6 erweitern ausdrücklich die schon eingebauten Fangstufen und
Weltkonturen. M3 benötigt nach jeder neuen Zeichnung die M0-Leistungsmessung
auf voller und sparsamer Effektstufe.

## M4 — Hangar, Erfolge und Fortschritt

| ID   | Einbau                                    | Ansatz / Dateien                                                                                                                     | Abnahme                                                                                                      |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| M4.1 | Hangarbühne polieren                      | `HangarView.ts`, `hangar.css`, `threeDShipPreview.ts`: kontrollierter Schatten, Lichtwechsel 2D/3D, kurzer Ausrüstimpuls.            | Form und Tint bleiben sichtbar; Fallback und schwache GPU zeigen den gleichen Auswahlzustand.                |
| M4.2 | Kaufdaten an die Vorschau                 | Preis, Levelvoraussetzung und fehlende Coins nahe am ausgewählten Schiff; längere Beschreibung darunter; feste Aktion erhalten.      | Ursache für deaktivierten Kauf ohne Scrollsuche verständlich; Kauf- und Ausrüstweg unverändert.              |
| M4.3 | Getragen und Anprobe ausdrücklich trennen | In Vorschau und Kachel zwei klare Zeilen/Marker für aktuell ausgerüstet und gerade angesehen.                                        | Wechsel zwischen Tabs, 2D/3D und Kauf verändert nur den korrekten Zustand.                                   |
| M4.4 | Erfolge nach Nähe sortierbar machen       | `AchievementsScene.ts`: „Bald geschafft“, offen, abgeschlossen; abgeschlossene Karten optional kompakter. Keine Änderung an Vergabe. | Fortschritt/Schwellen korrekt, Filter und Scrollposition konsistent; 62 Erfolge erreichbar.                  |
| M4.5 | Talentbaum als Baum zeigen                | Nach M1.1: Gruppenpfade/Verbindungen und kompakte Übersicht als visuelle Orientierung, ohne neue Abhängigkeiten oder Talentregeln.   | Reihenfolge und Zugehörigkeit aus der Übersicht verständlich; bei 320 Pixeln keine Linien über Text/Buttons. |

## M5 — Einzeln auswählbare Nice-to-haves

| ID   | Einbau                      | Voraussetzung und Umfang                                                                                                                        | Abnahme                                                                                                  |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| M5.1 | Weltbezogene Mikrodetails   | Nach M3.6: Eisring-Lichtbrechung, Glutnebel-Ströme, Nullsektor-Brüche; vorhandene prozedurale Mittel zuerst.                                    | Miniatur und Spielansicht konsistent, geringe Ablenkung und gemessene Kosten.                            |
| M5.2 | Visuelles Sammlungsalbum    | Neue Ansicht nur nach Navigations-/Inhaltsentwurf: entdeckte Relikte/Welten groß, unbekannte als Silhouette; vorhandene `save.collected` lesen. | Kein neuer Fortschrittszustand; gespeicherte und unbekannte Einträge korrekt, offline nutzbar.           |
| M5.3 | Expeditionskarte im Profil  | Schiff, Lieblingswelt nur wenn aus vorhandenen Daten eindeutig ableitbar, Bestwert und letzter belegter Meilenstein.                            | Keine erfundenen Statistiken; lange Namen und leere Spielstände sinnvoll dargestellt.                    |
| M5.4 | Einmaliger Freischaltmoment | Neue Welt/Optik mit einer kurzen, überspringbaren Hervorhebung im Ergebnis; bestehendes `unlockShowcase.ts` nutzen.                             | Nur einmal pro tatsächlicher Freischaltung, kein Blockieren von „Nochmal“, reduzierte Bewegung statisch. |
| M5.5 | Screenshot-Modus im Hangar  | UI ausblenden, Schiff zentrieren, vorhandene Weltkulisse wählen, Screenshot lokal erzeugen; Exportbedienung und Dateinamen entwerfen.           | Keine Profil-/Cloudänderung; 2D-Fallback, Safe Areas, Handy-Sharing und wiederhergestellte UI geprüft.   |

M5.2 und M5.5 sind neue Produktoberflächen. Vor deren Implementierung zusätzlich
`ARCHITECTURE.md`, bei einer neuen technischen Entscheidung `DECISIONS.md`
aktualisieren. Ein neues „Lieblingswelt“-Feld wird nicht ohne Daten- und
Produktentscheidung eingeführt.

## M6 — Prüf- und Auslieferungsmatrix

1. **Automatisch:** `npm run verify`; vorhandene Layout- und Playtest-Gates
   gezielt um geänderte Zustände erweitern. Tests nur für echte Layout-,
   Zustands- oder Navigationsrisiken ergänzen, nicht für reine Farbwerte.
2. **Sichtprüfung:** 320 × 568, 360 × 800, 390 × 844, 402 × 874 und
   430 × 932 CSS-Pixel; Menü, Profil, Talente, Hangar, Erfolge, Spiel, Pause,
   Ergebnis; lange Texte und große Zahlen. Grau-/Blur-Miniaturen wiederholen.
3. **Interaktion:** Touch, Tastatur/Fokus, Wischen, schneller Szenenwechsel,
   Größenwechsel, Offline-/Leer-/Fehlerzustände, Laden, Kauf, Ausrüsten und
   Rückweg. 44-CSS-Pixel-Ziele anhand tatsächlicher Canvas-Skalierung prüfen.
4. **Bewegung und Leistung:** OS-seitig reduzierte Bewegung, Tab-Wechsel,
   pausierter und durchgehender 90-Sekunden-Run; volle/sparsame Effekte,
   2D/3D-Fallback; Startzeit, Framezeit und Speicher gegen M0 vergleichen.
5. **Echte Geräte:** Mindestens ein kleines iPhone und ein Android-Gerät,
   Browserleisten, Safe Areas und Bildschirmtastatur. Hangar zusätzlich nach
   wiederholtem Öffnen/Schließen und längerer 3D-Nutzung prüfen.
6. **Freigabe:** Bilder und Messwerte mit Commit, Paket-/Live-Version und
   Gerät dokumentieren. Nach autorisiertem Push `npm run deploy:wait` ausführen
   und den ausgelieferten Stand erneut ansehen. Ungeprüfte Geräte oder Modi
   bleiben explizit offen.

## Vollständigkeitszuordnung der Vorschlagsliste

Die Nummern beziehen sich auf die letzte UI-Durchsicht. So geht kein Tipp in
einem allgemeinen Arbeitspaket verloren.

| Vorschlag                         | Paket          | Vorschlag                        | Paket      |
| --------------------------------- | -------------- | -------------------------------- | ---------- |
| 1 Weltwahl-Expeditionskarte       | M2.5           | 2 Tagline                        | M2.6       |
| 3 Sekundäraktionen gruppieren     | M2.6           | 4 Weltwechsel-Rückmeldung        | M2.7       |
| 5 Zurück-Navigation               | M2.4           | 6 Deaktivierte Aktionen erklären | M2.8       |
| 7 Weniger Vollversalien           | M2.1           | 8 Zahlenhierarchie               | M2.1       |
| 9 Panelrahmen reduzieren          | M2.2           | 10 Gold gezielter                | M0.3, M2.2 |
| 11 Zustand mit Form/Text          | M1.5, M2.8     | 12 Iconset                       | M2.3       |
| 13 Reliktsilhouetten              | M3.1           | 14 Fangstufen                    | M3.3       |
| 15 Schiffkontrast                 | M3.2           | 16 HUD unter Last                | M3.4       |
| 17 Bewegungsmuster                | M3.5           | 18 Hangarbühne                   | M4.1       |
| 19 Kaufdaten an Vorschau          | M4.2           | 20 Getragen/Anprobe              | M4.3       |
| 21 Erfolge sortieren              | M4.4           | 22 Talentbaum-Form               | M4.5       |
| Graustufentest                    | M0.2, M6       | Blur-Test                        | M0.2, M6   |
| Eine Akzentfarbe pro Blickbereich | M0.3, M2.2     | Kleinerer Glow, klarerer Kern    | M0.3, M3.1 |
| Leerraum gezielt einsetzen        | M1, M2.9, M4   | Screenshot-Matrix                | M0.1, M6   |
| Effektbudget pro Szene            | M0.3, M0.4, M3 | Welt-Mikrodetails                | M5.1       |
| Sammlungsalbum                    | M5.2           | Expeditionskarte im Profil       | M5.3       |
| Freischaltsequenz                 | M5.4           | Hangar-Screenshot-Modus          | M5.5       |
| Talentbaum-Abstände               | M1.1           | Profil-XP-Abstand                | M1.2       |
| Ergebnis-Hierarchie               | M1.3           | Kurzes Display                   | M1.4       |
| Hangar-Auswahlzustände            | M1.5           |                                  |            |

## Erste konkrete Umsetzungsscheibe

Nach M0 nur **M1.1 und M1.2** zusammen umsetzen: zwei klar belegte
Layoutprobleme, überschaubare Dateien, keine Spielregeländerung. Screenshots
und Geometriemessung bei 320/390/430, Tastatur im Profil und Talent-Scrollen
prüfen. Danach M1.3 Ergebnis, M1.4 Kurzdisplay und M1.5 Hangar-Zustände.
Erst diese sichtbaren Grundlagen freigeben, dann gemeinsame Stilwerte und
zusätzliche Effekte verbreiten.
