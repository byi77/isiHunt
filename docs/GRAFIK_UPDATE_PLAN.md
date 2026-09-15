# isiHunt: Grafik-Update und 3D-Effekte

Stand: 15. September 2026

Status: Punkt 3 lokal umgesetzt und geprüft. Punkt 2 mit Commit `2350294`
als v0.1.316 live bestätigt. Der konkrete Prüfumfang und verbleibende Geräteprüfungen
stehen im [Arbeitsbericht zu den Welten](design/2026-09-15-worlds/README.md).

Aktueller Arbeitsstand mit Bildern, Messungen und technischen Befunden:
[Umsetzung Punkt 3](design/2026-09-15-worlds/README.md).
Vorherige Etappe: [Punkt 2](design/2026-09-15/README.md).
Die [Bestandsaufnahme und Entwürfe](design/2026-09-14/README.md) bleiben als Referenz erhalten.

## Gesprächskontext und Ziel

Gewünscht ist ein grafisches Update für isiHunt. Zunächst wurden fünf Bereiche
vorgeschlagen: Startbildschirm, unterscheidbare Welten, markantere Schiffe,
übersichtlichere Spielanzeige und besser inszenierte Belohnungen. Anschließend
kam der Wunsch nach 3D-Effekten hinzu. Dieser Plan enthält **alle fünf
ursprünglichen Punkte und alle sechs anschließend vorgeschlagenen 3D-Ideen**.

Als gestalterische Arbeitsrichtung dient ein atmosphärischer Weltraumlook:
dunkle Nebel, beleuchtete Planetenkanten, räumliche Tiefe, dezente Sterne und
warme goldene Bedienelemente. Das greift „Jage das Licht“ auf. Neon-Arcade und
eine weichere, illustrative Galaxie wurden als Alternativen genannt; sie sind
nicht die Grundlage dieses Plans. Die konkrete Gestaltung wird in Schritt 1
gemeinsam abgestimmt.

Das Spiel soll überwiegend einen **2,5D-Look** erhalten: räumlich wirkende
Objekte auf der vertrauten zweidimensionalen Spielfläche. Für den Hangar ist
eine echte, drehbare 3D-Darstellung vorgesehen. Steuerung, Spielregeln,
Balancing und Fortschritt sind nicht Gegenstand des grafischen Umbaus.

## Vereinbarte Arbeitsweise

- Jeden Punkt einzeln besprechen, umsetzen und im Spiel ansehen.
- Rückmeldungen und Anpassungen berücksichtigen, bevor der nächste Punkt folgt.
- Gemeinsame Grundlagen zuerst festlegen, damit die Bereiche zusammenpassen.
- Mit Hauptmenü und einer beispielhaften spielbaren Welt beginnen; die dort
  abgestimmte Gestaltung anschließend auf alle Welten und Bildschirme übertragen.
- Keine vollständige Neugestaltung aller Bereiche in einem unübersichtlichen Schritt.
- Nach jeder Etappe den tatsächlichen Stand, offene Fragen und nächste Schritte
  unten im Fortschrittsprotokoll festhalten.
- Bereits während jeder Änderung pixelgenaue Layoutprüfungen durchführen:
  Texte, Buttons, Modelle und andere Elemente dürfen sich nicht unbeabsichtigt
  überlappen, abgeschnitten werden oder verschieben. Details siehe Prüfverfahren unten.

Die grafischen Punkte sind teilweise verbunden, lassen sich aber einzeln
bearbeiten. Insbesondere hängt der Hangar von der Schiffsgestaltung ab; die
Sammel-Effekte sollten zu den fertigen Planeten und Schiffen passen.

## Vollständigkeit: die ursprünglichen fünf Punkte

| Ursprünglicher Vorschlag                       | Enthaltene Maßnahmen                                                                                     | Umsetzung        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| Startbildschirm als Blick in die gewählte Welt | Großer Planet, eigenes Schiff, klarer Startbutton, weniger Gewicht für Profil und Navigation             | Schritt 2        |
| Welten stärker unterscheiden                   | Eigene Formen, Kulissen und Bewegungen statt allein anderer Farben                                       | Schritt 3        |
| Schiffe mit klaren Silhouetten                 | Erkennbare Flügel, Cockpit und Triebwerke; unterscheidbare Skins auch in kleiner Darstellung             | Schritt 4        |
| Spielanzeige vereinfachen                      | Punkte, Restzeit und Combo gruppieren; einheitliche Symbole; weniger konkurrierende Rahmen               | Schritt 5        |
| Belohnungen besser inszenieren                 | Präzise Fang-Effekte, große Ergebniszahl, lesbarer Fortschritt, besondere Rekord- und Freischaltanzeigen | Schritte 6 und 8 |

## Vollständigkeit: die sechs 3D-Ideen

| 3D-Idee                         | Gewünschte Wirkung                                                                                 | Umsetzung        |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------- |
| Schiffe neigen sich beim Lenken | Seitliches Kippen, Neigung beim Beschleunigen, nachziehender Triebwerksschweif                     | Schritt 4        |
| Plastische Planeten             | Lichtseite, weiche Schattenseite, Atmosphärenrand und langsam rotierende Oberfläche                | Schritt 3        |
| Ringe mit Tiefenwirkung         | Teile von Planetenringen und Schiffsaura liegen vor, andere hinter dem Objekt                      | Schritte 3 und 4 |
| Mehrere Hintergrundebenen       | Ferne Sterne bewegen sich kaum, nähere Schichten stärker; große Planeten wirken weit entfernt      | Schritt 3        |
| Räumlicher Sammel-Effekt        | Lichtsplitter fliegen auf gekrümmten Bahnen zum Schiff; ein geneigter Energiering breitet sich aus | Schritt 6        |
| Echter 3D-Hangar                | Drehbares Schiff über beleuchteter Plattform mit sichtbaren Farben, Auren und Triebwerken          | Schritt 7        |

## Umsetzung im Detail

### Schritt 1: Stil und gemeinsame technische Grundlagen

**Ziel:** Eine verbindliche gestalterische Grundlage für alle weiteren Schritte.

- Farben, Schriftgrößen, Abstände, Buttons, Panels und Symbole abstimmen.
- Dunkle Flächen, warme goldene UI-Akzente und gezielt eingesetztes Licht kombinieren.
- Den vorhandenen Designleitfaden berücksichtigen und beschlossene Änderungen
  darin dokumentieren. Farbregeln für Seltenheit und Weltakzente eindeutig abstimmen.
- Einen zusammengehörigen visuellen Entwurf für Hauptmenü und laufendes Spiel erstellen.
- Vorhandene Three.js-Vorschau, Modelle und bisherige Animationen prüfen:
  Was ist schon nutzbar, was braucht eine Anpassung?
- Festlegen, welche Effekte über Phaser und 2,5D-Techniken entstehen und wo
  Three.js sinnvoll ist. Echte 3D-Darstellung ist zunächst für den Hangar vorgesehen.
- Qualitätsstufen und reduzierte Bewegung in die Effektgestaltung einplanen.
- Ausgangswerte für Ladezeit, Speicherverbrauch und Flüssigkeit erfassen,
  damit spätere Verbesserungen und Mehrkosten überprüfbar werden.

**Fertig, wenn:** Menü- und Spielentwurf zusammenpassen, die technische
Aufteilung feststeht und die gemeinsame Gestaltung konkret beurteilbar ist.

### Schritt 2: Hauptmenü und gemeinsame Oberfläche

**Ziel:** Ein atmosphärischer Einstieg mit klarer Bedienung auf dem Handy.

- Die ausgewählte Welt durch einen großen, beleuchteten Planeten präsentieren.
- Das eigene Schiff schwebend davor platzieren.
- „Jagd starten“ als wichtigste Aktion hervorheben.
- Profil, Weltenauswahl und Navigation übersichtlich anordnen und ihnen
  gegenüber dem Einstieg ins Spiel weniger visuelles Gewicht geben.
- Weltenwechsel mit passenden, kurzen Übergängen gestalten.
- Gemeinsame Buttons, Panels und Symbole anschließend auf Shop, Talente,
  Profil, Einstellungen, Bestenliste und Duellbildschirme übertragen.
- Weitere vorhandene Bildschirme beim Übertragen auf Konsistenz prüfen.

**Abhängigkeit:** Gemeinsame Gestaltung aus Schritt 1. Für den ersten Entwurf
können bestehende Planeten und Schiffe genutzt und später ersetzt werden.

**Fertig, wenn:** Der Start klar erkennbar ist, die Navigation funktioniert und
die Oberfläche auf kleinen wie großen Handyformaten lesbar und bedienbar bleibt.

### Schritt 3: Welten, plastische Planeten und Hintergrundtiefe

**Ziel:** Räumliche Tiefe und eine eigene visuelle Identität für jede Welt.

- Sterne, Nebel und Staub auf mehreren unterschiedlich bewegten Ebenen anordnen.
- Ferne Sterne sehr langsam, nähere Staubschichten stärker bewegen.
- Große Hintergrundplaneten durch zurückhaltenden Kontrast in der Ferne halten.
- Planeten mit Lichtseite, weicher Schattenseite und dünnem Atmosphärenrand versehen.
- Eine langsame Bewegung der Oberfläche als Rotation darstellen.
- Ringe in vordere und hintere Bereiche aufteilen, damit sie den Planeten umschließen.
- Zuerst eine Welt als vollständiges Beispiel umsetzen, danach auf alle vorhandenen
  Welten übertragen.
- Weltmerkmale gezielt entwickeln, beispielsweise:
  - Eisring: scharfkantige Eissplitter und Kristallringe.
  - Glutnebel: langsame Gasströmungen und heiße Nebelstrukturen.
  - Nullsektor: verzerrte Sternenfelder und Raumrisse.
  - Sonnenkrone: eine zurückhaltende Sonnenkorona.
  - Für die übrigen Welten passende eigene Merkmale festlegen.
- Einsammelbare Planeten eindeutig von Hintergrundplaneten unterscheiden.

**Abhängigkeit:** Stil und Effektbudget aus Schritt 1. Kann weitgehend unabhängig
von der Menüstruktur und der Spielanzeige umgesetzt werden.

**Fertig, wenn:** Die Beispielwelt räumlich wirkt, Sammelobjekte sofort erkennbar
bleiben und die anschließende Übertragung allen Welten eine eigene Identität gibt.

### Schritt 4: Schiffe, Flugbewegung und räumliche Aura

**Ziel:** Markante Schiffe mit lebendiger, gut nachvollziehbarer Bewegung.

- Silhouetten, Flügel, Cockpits und Triebwerke deutlicher ausarbeiten.
- Skins bereits bei der kleinen Darstellung im Spiel unterscheidbar machen.
- Das Schiff beim Lenken seitlich neigen und beim Beschleunigen leicht kippen.
- Übergänge und Richtungswechsel weich abfangen.
- Einen Triebwerksschweif ergänzen, der der tatsächlichen Bewegung nachzieht.
- Lichtspur und Aura so gestalten, dass sie die Schiffsform unterstützen.
- Teile der Aura hinter und andere vor dem Schiff darstellen.
- Vorschau im Menü, Darstellung im Spiel und spätere Hangaransicht visuell abstimmen.
- Neigung und Animation ausschließlich auf die Darstellung anwenden:
  Position, Steuerung und tatsächlicher Sammelradius bleiben zuverlässig.

**Abhängigkeit:** Schritt 1. Die Weltgestaltung ist hilfreich für die Lichtabstimmung,
muss aber noch nicht für alle Welten fertig sein.

**Fertig, wenn:** Flugbewegung und Skins klar erkennbar sind und die sichtbare
Animation keine falsche Erwartung an Position oder Sammelreichweite erzeugt.

### Schritt 5: Spielanzeige

**Ziel:** Wichtige Informationen schnell erfassen und die Spielfläche freihalten.

- Punkte, Restzeit und Combo klar gruppieren und hierarchisch gewichten.
- Einheitliche Symbole und weniger konkurrierende Rahmen verwenden.
- Duellstände und wichtige Hinweise platzsparend integrieren.
- Kontrast auf jeder Welt prüfen; gegebenenfalls eine ruhige Unterlage verwenden.
- Animationen bei Punkte- und Comboänderungen kurz und nachvollziehbar halten.
- Touchflächen, sichere Bildschirmränder und vorhandene Bedienfunktionen erhalten.

**Abhängigkeit:** Gemeinsame UI-Grundlagen. Weitgehend unabhängig von Hangar
und Schiffstechnik; auf den neuen Welthintergründen abschließend prüfen.

**Fertig, wenn:** Zeit, Punkte, Combo und Duellstände auch während einer vollen
Spielrunde gut lesbar sind und die Spielfläche wenig verdecken.

### Schritt 6: Sammel-Effekte

**Ziel:** Präzises und befriedigendes Feedback mit räumlichem Eindruck.

- Beim Fang Lichtsplitter auf gekrümmten Bahnen zum Schiff ziehen lassen.
- Einen kurzen, geneigten Energiering am Fangort ausbreiten lassen.
- Fang, Punkteanzeige und vorhandenen Ton zeitlich aufeinander abstimmen.
- Gewöhnliche Fänge kompakt halten; seltene Fänge gezielt stärker inszenieren.
- Seltenheitsfarben erhalten und die Unterschiede nicht allein über Farbe vermitteln.
- Gleichzeitige Partikel und Effekte begrenzen.
- Bestehende Vorgaben zu kurzen Effekten berücksichtigen; reduzierte Bewegung
  durch eine ruhige Alternative unterstützen.

**Abhängigkeit:** Möglichst nach Schritten 3 und 4, damit Größe, Licht und Bewegung
zu den fertigen Planeten und Schiffen passen. Mit Schritt 5 abstimmen.

**Fertig, wenn:** Fänge räumlich und unmittelbar wirken, ohne Ziele oder Gefahren
zu verdecken oder bei vielen gleichzeitigen Fängen die Flüssigkeit zu beeinträchtigen.

### Schritt 7: Echter 3D-Hangar

**Ziel:** Die eigenen Schiffe und kosmetischen Anpassungen interaktiv präsentieren.

- Das ausgewählte Schiff über einer beleuchteten Plattform schweben lassen.
- Drehen per Finger oder Maus ermöglichen.
- Farben, Auren und Triebwerke direkt am Modell sichtbar machen.
- Schiffsauswahl, Besitzstatus und Freischaltinformationen integrieren.
- Vorhandene Modelle und Vorschau wiederverwenden, soweit die technische Prüfung
  ihre Eignung bestätigt.
- 3D-Inhalte bedarfsgerecht laden; Rendering und Ressourcen beim Verlassen beenden
  beziehungsweise freigeben.
- Eine passende 2D-Vorschau bei fehlender 3D-Unterstützung vorsehen.
- Wiederholtes Öffnen und Schließen sowie Bedienung auf dem Handy prüfen.

**Abhängigkeit:** Technische Prüfung aus Schritt 1 und Schiffsgestaltung aus Schritt 4.
Die Sammel-Effekte müssen dafür nicht fertig sein.

**Fertig, wenn:** Die Vorschau flüssig bedienbar ist, die ausgewählte Kosmetik
zutreffend zeigt und beim Verlassen keine laufenden Renderer oder Ressourcen anhäuft.

### Schritt 8: Ergebnisse und Belohnungen

**Ziel:** Jede Runde mit einem klaren und befriedigenden Ergebnis abschließen.

- Die erreichte Punktzahl prominent präsentieren.
- XP-Zuwachs, Coins und Fortschritt übersichtlich zusammenfassen.
- Rekorde, Levelaufstiege und Freischaltungen jeweils gezielt hervorheben.
- Kurze Animationen verwenden, die Belohnungen verständlich machen.
- Den nächsten Start beziehungsweise eine weitere Duellrunde leicht erreichbar halten.
- Normales Ergebnis, Rekord, Levelaufstieg und neue Freischaltung prüfen;
  mehrere gleichzeitig auftretende Belohnungen müssen übersichtlich bleiben.

**Abhängigkeit:** Gemeinsame Oberfläche aus Schritt 1 und 2. Kann bei Bedarf
früher umgesetzt werden; benötigt keinen fertigen Hangar.

**Fertig, wenn:** Ergebnis und Fortschritt sofort verständlich sind, besondere
Erfolge auffallen und Animationen den nächsten Spielstart nicht unnötig verzögern.

## Abhängigkeiten und sinnvolle Reihenfolge

| Bereich               | Benötigt vor allem                     | Unabhängig davon möglich               |
| --------------------- | -------------------------------------- | -------------------------------------- |
| Gemeinsame Grundlagen | Bestehendes Design und Technik prüfen  | Alle weiteren Bereiche noch offen      |
| Hauptmenü             | Gemeinsame Grundlagen                  | Finale Schiffe und alle Welteffekte    |
| Welten und Planeten   | Stil, technische Effektgrundlage       | Hangar und Ergebnisbildschirm          |
| Schiffe               | Stil, Animationsgrundlage              | Fertigstellung aller Welten            |
| Spielanzeige          | UI-Grundlagen                          | Hangar und Fang-Effekte                |
| Sammel-Effekte        | Abgestimmte Planeten und Schiffe       | Hangar                                 |
| Hangar                | Schiffsgestaltung, geprüfte 3D-Technik | Sammel-Effekte und Ergebnisse          |
| Ergebnisse            | UI-Grundlagen                          | Hangar und vollständige Weltgestaltung |

Empfohlene Reihenfolge: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**.
Das ist eine Arbeitsreihenfolge, keine starre technische Kette. Insbesondere
Spielanzeige und Ergebnisse können vorgezogen werden.

## Prüfung und Optimierung: in jeder Etappe und zum Abschluss

### Verbindliche Layoutprüfung während des Umbaus

Ausdrücklicher Nutzerwunsch vom 14. September 2026: Bereits während des Umbaus
pixelgenau prüfen, ob sich Texte, Buttons, Modelle und andere Elemente
überschneiden oder ungewollt verschieben. Diese Prüfung ist Teil jeder
Umsetzungsetappe und wird nicht erst am Ende nachgeholt.

- Vor einer Änderung Referenz-Screenshots der betroffenen Ansichten bei festgelegten
  Bildschirmgrößen aufnehmen. Bildschirmgröße, Skalierung und Spielzustand festhalten.
- Nach der Änderung Screenshots unter denselben Bedingungen aufnehmen und visuell
  prüfen; kritische Bereiche vergrößert und bei Bedarf als Bildvergleich untersuchen.
- Tatsächlich gerenderte Text- und Objektgrenzen sowie Abstände in Bildschirmkoordinaten
  prüfen. Canvas-Skalierung, Kameratransformationen und sichere Bildschirmränder
  berücksichtigen; reine Sollkoordinaten im Code reichen nicht aus.
- Texte auf abgeschnittene Zeichen, Zeilenumbrüche, Überlauf und Kollisionen prüfen.
  Auch lange Spielernamen, große Punktestände, mehrstellige Level und dynamische
  Statusmeldungen einbeziehen.
- Buttons auf sichtbare Überlappungen und passende Touch-/Klickflächen prüfen.
  Keine unsichtbare Trefferfläche darf eine andere Aktion unbeabsichtigt verdecken.
- Schiffe, 3D-Modelle, Auren und Partikeleffekte auf unerwünschtes Überdecken von
  Texten, Bedienelementen und Spielfeldanzeigen prüfen. Absichtliche Tiefenüberdeckungen,
  beispielsweise bei Planetenringen, sind Teil der Gestaltung.
- Nicht nur den ruhenden Zustand betrachten: Neigung, Schweben, Skalierungsanimationen,
  Welt- und Schiffwechsel, Pop-ups, Belohnungen und Szenenwechsel überprüfen.
  Bei Bedarf mehrere Animationsphasen aufnehmen und die gesamte Bewegungsfläche prüfen.
- Größenänderungen, unterschiedliche Seitenverhältnisse, Safe Areas und die
  Browserleisten auf mobilen Geräten auf ungewollte Layoutverschiebungen prüfen.
- Bewegte Hintergründe für reproduzierbare Bildvergleiche möglichst kontrollieren
  oder getrennt bewerten, damit beabsichtigte Bewegung nicht als Layoutfehler gilt.
- Gefundene Layoutfehler innerhalb der laufenden Etappe korrigieren und die betroffenen
  Ansichten erneut prüfen, bevor die Etappe als fertig dokumentiert wird.
- Pro Etappe geprüfte Bildschirmgrößen, Ansichten, Zustände, Screenshot-Ablage und
  verbleibende Probleme festhalten. Nicht geprüfte Geräte ausdrücklich benennen.

Pixelgenau bedeutet hier die Prüfung der tatsächlichen Darstellung und Geometrie
in den dokumentierten Testumgebungen. Unterschiede der Schriftglättung zwischen
Browsern sind gesondert zu bewerten; ein Test auf einigen Bildschirmgrößen ersetzt
keine Prüfung auf weiteren Geräten.

### Funktions- und Leistungsprüfung

- Kleine und große Handyformate sowie Desktop prüfen.
- iOS/Safari und installierte Darstellung mit sicheren Bildschirmrändern berücksichtigen.
- Vollständige Solo- und Duellrunden prüfen, einschließlich intensiver Situationen
  mit vielen Objekten und Effekten.
- Ladezeiten, Speicherverbrauch und Flüssigkeit mit den Ausgangswerten vergleichen.
- Qualitätsstufen und reduzierte Bewegung tatsächlich ausprobieren.
- Lesbarkeit, Touchflächen und Unterscheidbarkeit von Kulisse und Spielobjekten prüfen.
- Für Änderungen passende vorhandene Prüfungen nutzen; keine Tests für reine
  Gestaltungsdetails schreiben, die lediglich die Implementierung nachbilden.
- Vor einer späteren Auslieferung die im Repository vorgeschriebenen Checks durchführen.
- Gestaltungsentscheidungen im Art Style Guide und gegebenenfalls technische
  Entscheidungen in Architektur/ADRs dokumentieren; abgeschlossene Features in
  Roadmap und Changelog festhalten.

Eine feste Leistungszusage oder Aufwandsschätzung wurde im Gespräch nicht
getroffen. Konkrete Grenzen werden nach der Prüfung des Ausgangsstands festgelegt.

## Vorhandene Anknüpfungspunkte im Repository

Diese Liste dient der Orientierung für die nächste Sitzung. Die Three.js-Vorschau
wurde inzwischen im Code untersucht und im Shop visuell geprüft. Details,
Wiederverwendung und offene Punkte stehen im verlinkten Arbeitsstand.

| Bereich                           | Dateien / Verzeichnisse                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Designleitfaden                   | `docs/ART_STYLE.md`                                                            |
| Spielkonzept und Architektur      | `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`             |
| Gemeinsame Gestaltung und Widgets | `src/ui/theme.ts`, `src/ui/widgets.ts`                                         |
| Texturen und Schiffsanimationen   | `src/ui/textures.ts`, `src/ui/shipShapes.ts`, `src/ui/shipAnimations.ts`       |
| 3D-Vorschau und Modelle           | `src/ui/threeDShipPreview.ts`, `public/assets/ego3d/cc0-spaceships/`           |
| Welten                            | `src/config/worlds.ts`                                                         |
| Menü und Spiel                    | `src/scenes/MenuScene.ts`, `src/scenes/GameScene.ts`, `src/scenes/HudScene.ts` |
| Spielobjekte                      | `src/entities/Player.ts`, `src/entities/Collectible.ts`                        |
| Shop und Ergebnisse               | `src/scenes/ShopScene.ts`, `src/scenes/ResultScene.ts`                         |
| Barrierefreiheit und Performance  | `src/systems/AccessibilitySystem.ts`, `src/systems/PerformanceSystem.ts`       |
| Vorhandene Bilddateien            | `public/assets/`                                                               |

## Fortschritt und Wiedereinstieg

### Aktive Etappe: Punkt 3 — Welten und räumliche Planeten

- Deployment von Punkt 2 erfolgreich; Live-Bundle v0.1.316 geprüft.
- Beispielwelt Eisring: Kugelbeleuchtung, langsame Oberflächenrotation und geteilter Ring.
- Anschließend zehn unterschiedliche Oberflächen und Weltmerkmale; keine Änderung an Regeln.
- Effektbudget: wiederverwendete Texturen, wenige feste Ebenen,
  statische Alternative bei reduzierter Bewegung und schwachen Geräten.
- Menü-Geometrie bleibt verbindlich; gesamte Planetenausdehnung inklusive Ring
  wird innerhalb des bisherigen Planetenbereichs gehalten.
- Zehn Weltansichten bei 390 × 844 und Eisring zusätzlich bei 320 × 568 geprüft;
  elf Menü-Messungen ohne Text-/Button-/Planetenkonflikte. Eisring-Spielfeld angesehen.
- 16 Weltwechsel: unverändert 5 Aktualisierungslistener; Texturcache auf dem Rückweg stabil.
- `npm run verify` bestanden: 588 Tests in 41 Dateien, Typen, Lint, Format,
  Projektprüfungen und Produktionsbuild.
- Erste Laufzeit-Stichprobe: 583 Frames, P95 16,72 ms, keine Frames über Budget,
  Start 2,1 s. Keine Langzeit- oder Mobilgerätefreigabe daraus ableiten.
- Offen bleiben echte Mobilgeräte, OS-Umschaltung auf reduzierte Bewegung,
  Geräte mit wenig Speicher und belastbare Langzeit-/GPU-Speichermessungen.
- Noch kein Commit/Push dieser Etappe. Nächster Gestaltungspunkt: Punkt 4,
  Schiffe, Flugbewegung und räumliche Aura. Bericht und Messungen nicht erneut erstellen.

### Abgeschlossene Umsetzung: 15. September 2026, Punkt 2

- Vorheriger Zwischenstand: Commit `28562cf` gepusht; Deployment v0.1.315 bestätigt.
- Der Nutzer hat die Fortsetzung mit Punkt 2 beauftragt; die Entwurfsrichtung wird umgesetzt.
- Hauptmenü in `MenuView` ausgelagert; `MenuScene` behält Navigation, Sync und Persistenz.
- Kompakter Profilblock, große vorhandene Planetentextur und ausgerüstete Schiffsform.
- Einzelne goldene Hauptaktion; alle bisherigen Menüwege bleiben erhalten.
- Gemeinsame Buttons/Paneloberflächen überarbeitet; bestehende Unterseiten übernehmen den Stil.
- Menügrößen berücksichtigen CSS-Pixel und sicheren unteren Rand; Update-Hinweis ersetzt den Kopfbereich.
- Abstand der untersten Menüreihe zur Versionsnummer bereits korrigiert.
- Zusätzlicher Abstandstest hat einen möglichen Aura-/Welttitelkonflikt im kleinen Format
  gefunden; die Schiffshöhe berücksichtigt jetzt ihre maximale animierte Ausdehnung.
- Zehn Layouttests bestanden; Typprüfung und gezielte Lintprüfung bestanden.
- Vollständiges `npm run verify`: 586 Tests in 40 Dateien, Typprüfung, Lint,
  Formatprüfung, Projektprüfungen und Produktionsbuild erfolgreich.
- Profil: Hinweis vom Eingabefeld getrennt; Level bleibt neben langen Namen sichtbar.
- Talentseite: überlappende Beschreibungen, Bonus und Rangmarkierungen getrennt;
  höhere Karten nutzen die bestehende Scrollfunktion. Reset-Zeile durch Scrollen erreicht.
  Listenmaske verhindert das Überdecken der festen Überschrift; abgeschnittene
  Button-Trefferflächen sind gesperrt.
- Opt-in-Messwerkzeug unter `?layoutAudit` ergänzt: tatsächliche Text-/Bildrechtecke
  und rechteckige Button-Trefferflächen aus dem Renderer. Produktionsbuild lädt es nicht.
- Screenshots und Messungen dieser Etappe liegen unter `docs/design/2026-09-15/`.
- Commit, Push und Deployment dieser Umsetzung am 15. September beauftragt.
  Der Commit-Hook erhöht die Version; der Push startet die geprüfte Auslieferung.
  Maßgeblich für deren Ergebnis sind Git-/CI-Historie und `npm run deploy:wait`.
- Noch offen: echte iOS-/Android-Geräte, Live-Login-/Sync-Dialoge, alle freigeschalteten
  Welten und eine belastbare Laufzeit-/Speicherbaseline. Diese Freigaben werden nicht
  aus statischen Screenshots abgeleitet.

**Nächster Einstieg:** Den Arbeitsbericht dieser Etappe und die dort gespeicherten
Menüaufnahmen ansehen. Anschließend Punkt 3 (Welten und räumliche Planeten) einzeln
bearbeiten und die offenen Geräteprüfungen weiterführen. Punkt 2 nicht erneut aufbauen.

Die folgenden Notizen vom 14. September bleiben als Historie der Vorbereitung erhalten.

### Versionierung dieses Zwischenstands

Am 14. September 2026 wurde Commit und Push dieses Dokumentations- und
Entwurfspakets beauftragt. Referenzaufnahmen und Größenmessungen beziehen sich
weiterhin auf v0.1.314; der Commit-Hook erhöht die Paketversion für die Auslieferung.
Bei der Vorbereitung wurden fehlende explizite Node-Imports in den beiden
Entwurfsskripten korrigiert. Die neue Spielgrafik bleibt ein Entwurf; Schritt 2
ist mit dieser Versionierung noch nicht umgesetzt.

Die vollständige Prüf-, Push- und Deploymentbestätigung erfolgt im zugehörigen
Arbeitsabschluss und in der Git-/CI-Historie; dieser Abschnitt nimmt deren
Ergebnis nicht vorweg.

- [x] Vollständigen Plan aus dem Gespräch dokumentiert.
- [x] Referenzmenüs in 320 × 568, 390 × 844 und 430 × 932 gesichert.
- [x] Countdown/HUD im kleinen Format und Spielbeginn im großen Format angesehen.
- [x] Vorhandene 3D-Vorschau und neun OBJ-Modelle untersucht; Shopvorschau angesehen.
- [x] Menü- und Spielentwürfe in normalem und kompaktem Format erstellt.
- [x] Vier Entwurfsansichten visuell und anhand gemessener Text-/Buttonrechtecke geprüft.
- [x] Ersten Abstandskonflikt zwischen Schiffsschweif und Welttitel im Entwurf korrigiert.
- [x] Ausgangsbuild einschließlich Typprüfung erfolgreich; Chunkgrößen dokumentiert.
- [ ] Belastbare Laufzeit-/Speicherbaseline mit durchgehend aktivem Spiel nachholen.
- [ ] Schritt 1: Stil und technische Grundlagen abgestimmt.
- [ ] Schritt 2: Hauptmenü und gemeinsame Oberfläche umgesetzt und angesehen.
- [ ] Schritt 3: Welten und räumliche Planeten umgesetzt und angesehen.
- [ ] Schritt 4: Schiffe und Flugbewegung umgesetzt und angesehen.
- [ ] Schritt 5: Spielanzeige umgesetzt und angesehen.
- [ ] Schritt 6: Sammel-Effekte umgesetzt und angesehen.
- [ ] Schritt 7: 3D-Hangar umgesetzt und angesehen.
- [ ] Schritt 8: Ergebnisse und Belohnungen umgesetzt und angesehen.
- [ ] Abschließende Geräte-, Funktions- und Performanceprüfung abgeschlossen.

### Historischer Stand: 14. September 2026

Die Arbeit an Schritt 1 wurde begonnen. Unter `docs/design/2026-09-14/` liegen
Referenzbilder, vier statische SVG-/PNG-Entwürfe, gemessene Geometrie, eine
reproduzierbare Auswertung und der ausführliche Befundbericht. Die neue Gestaltung
ist noch nicht in Runtime-Dateien umgesetzt; kein Deployment durchgeführt.

Wesentliche Erkenntnisse: Kleine Beschriftungen schrumpfen im 320er-Format auf
rechnerisch rund 7 CSS-Pixel; die bisherige Touch-Mindestgröße wird vor der
Canvas-Skalierung angewandt. Der Entwurf erhält deshalb eine eigene kompakte
Anordnung und mindestens 44 CSS-Pixel hohe Buttonflächen. Alle vorhandenen
Menüeinstiege bleiben vorgesehen. Die vorhandene 3D-Darstellung funktioniert,
braucht für den Hangar aber eine eigene Kamera und Drehbedienung sowie eine
Alternative bei reduziertem Bewegungswunsch.

Die vier statischen Entwürfe wurden bereits pixelbezogen geprüft: keine gemeldeten
Text-/Buttonüberlappungen in den gespeicherten Messungen. Dies ist keine Freigabe
für dynamische Spielzustände. FPS, Startzeit und Speicher sind noch offen, weil
der Countdown unter Browsersteuerung zwischen Eingaben auffällig langsam lief.
Die Ursache ist ungeklärt; echte Mobilgeräte und iOS wurden noch nicht geprüft.

**Nächster konkreter Schritt:** Den [Menüentwurf](design/2026-09-14/concept-menu-390x844.png)
und seine [kompakte Variante](design/2026-09-14/concept-menu-320x568.png) gemeinsam
durchsehen. Die offene Laufzeitbaseline ergänzen, dann Schritt 2 am Hauptmenü
umsetzen. Die übrigen Punkte weiterhin einzeln bearbeiten und ansehen.

Möglicher Einstieg nächste Woche:

> Lies `docs/GRAFIK_UPDATE_PLAN.md`. Wir wollen das Grafik-Update Punkt für Punkt
> umsetzen. Lies auch den verlinkten Arbeitsstand mit den Entwürfen und setze
> beim dokumentierten nächsten Schritt fort; wiederhole keine erledigte Bestandsaufnahme.
