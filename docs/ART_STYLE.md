# Art Style Guide — isiHunt

## Grafische Modernisierung: Informationsansichten (24.09.2026)

Ein tatsächlicher Ausrüstwechsel setzt einen kurzen Lichtimpuls an der
Hangar-Vorschau. Der Weltwechsel blendet den neuen Planeten kurz ein. Bei
reduzierter Bewegung stehen beide Zustände ohne Animation bereit. Das Album
zeigt zu jeder Reliktstufe dieselbe Anzahl Rangpunkte wie im Spiel, damit
Seltenheit auch ohne Farbe lesbar ist.

Welt, Zeit, Coins, XP, Rang, Shop, Profil und Zurück teilen eine selbst
gezeichnete Monoline-Geometrie in `src/ui/iconography.ts`. Phaser und
DOM-Hangar zeichnen daraus dieselben Konturen mit zwei Einheiten Strichstärke
auf einem 24er Raster. Ein Icon ergänzt immer Text oder eine Zahl.

Talentgruppen erhalten einen eigenen Abstand vor der ersten Karte. Karten
bekommen sichtbare Zwischenräume; Gruppenlinien dürfen weder Karten noch Text
kreuzen. Im Profil stehen Eingabe, XP-Fortschritt und Speichern als drei
getrennte Zeilen. Ergebnisse zeigen Punktzahl, Rekord und Belohnungssumme im
ersten Blick; Detailkarten behalten alle Buchungen und Freischaltungen.

Zustände im Hangar tragen neben einer Farbe eine kurze Bezeichnung: ausgerüstet,
in Besitz, Anprobe oder gesperrt. Die aktuell betrachtete Optik und die
ausgerüstete Optik werden separat genannt. Zusätzliche Leuchtflächen dürfen
den Schiffsrumpf oder seine Binnenzeichnung nicht verdecken.

Die Mindesthöhe von 44 CSS-Pixeln gilt nach der Canvas-Skalierung auch für
gemeinsame Phaser-Buttons. Logische Spielkoordinaten allein reichen für diese
Zusage nicht aus.

Die Erfolgsseite trennt alle, offene, fast erreichte und abgeschlossene Ziele
über beschriftete Filter. Ein Filter ohne Treffer erklärt seinen leeren Zustand.
Leere Ranglisten zeigen eine ruhige Weltillustration und einen konkreten
nächsten Schritt in der Inhaltsfläche, statt nur eine Fehlermeldung im Fuß.
Die Menükopfzeile verwendet einen kurzen Leitspruch, damit die Wortmarke
und die Hauptaktion visuell führen.

Das Sammlungsalbum zeigt Reliktstufen als sechs große Karten und Welten mit
ihren vorhandenen Planetenmotiven. Unbekannte Welten erscheinen als gedämpfte
Silhouette mit Freischaltstufe. Die Ansicht liest nur vorhandene Fortschrittsdaten.

Der Hangar-Fotoexport setzt das ausgewählte Schiff als statisches 2D-Bild vor
eine wählbare, bereits freigeschaltete Weltkulisse. Der Export enthält keine
Bedienelemente und keine Profil- oder Kontodaten. Eine 3D-Aufnahme ist nicht
Voraussetzung, damit der Export auch ohne WebGL funktioniert.

Das kompakte Hauptmenü gibt Planet und Schiff mehr Platz, indem die Abstände
zwischen den unteren Menüzeilen geringer sind. Ihre Trefferflächen bleiben
bei mindestens 44 CSS-Pixeln; der iPhone-Installationshinweis bleibt sichtbar.

Im Talentbaum zeigen drei kurze Gruppennamen den Pfad. Feine Verbindungen
zwischen den Karten machen den Zusammenhang sichtbar, liegen hinter den
Kartenflächen und kreuzen keine Beschriftung.

Relikte behalten ihren Sammelradius. Ein kleinerer diffuser Schein und eine
schärfere Kontur lassen ihren Planetenkern im mobilen Spielfeld klarer wirken.

Jede der zehn Welten erhält am äußeren Spielfeldrand ein kleines statisches
Erkennungszeichen: Sterne, Eisbruch, Glutfunken, Raumriss, Strahlenfächer,
Krater, Kristallgabel, Sturmblitz, Lichtwellen oder Torbogen. Die Zeichen
entstehen einmal beim Szenenstart und bleiben außerhalb des Fangbereichs.

Die Profilkarte nennt neben Schiff, Level und Bestwert auch die zuletzt
gewählte Welt. Sie bezeichnet diese ausdrücklich als letzte Welt, nicht als
Lieblingswelt; ein solcher Wert wird nicht gespeichert.

## Schiffs-Modernisierung: technische Lackierung und Metallfacetten

Kaufbare Fluggeraete erhalten neben ihrer individuellen Silhouette ein
gemeinsames Technikvokabular: gebrochene Fluegelstreifen, Wartungsluken,
Kuehlschlitze und Kennpunkte. Die Markierungen bleiben in Graustufen und
werden mit der Rumpffarbe getintet; Glas und Triebwerke behalten ihre dunklen
beziehungsweise hellen Kontraststufen. Prozedurale Markierungen werden nur
auf den Fluggeraeten eingesetzt, nicht auf Figuren, Tieren oder Drohnen.

Die Low-Poly-3D-Schiffe zeigen im Hangar zusaetzlich lichtgefasste
Kantenflaechen und einen abgesetzten Triebwerksring. Die Kanten verwenden
einen Winkel-Schwellenwert, damit flache Dreieckskanten nicht als Drahtgitter
erscheinen. Metall bleibt matt genug, dass die ausgeruestete Farbe erkennbar
bleibt; die Linienebene wird beim Modellwechsel gemeinsam mit dem Modell
freigegeben.

Für die neun Orbital-Modelle gilt zusätzlich: Der Raumschiffcharakter muss
auch aus der Draufsicht sofort lesbar sein. Kanzelglas, ein klarer Mittelrumpf,
abgesetzte Flügelpanzerung und sichtbare Heckdüsen durchbrechen die reine
Dreiecksfläche. Die vom OBJ abgeleiteten SVGs tragen dieselben Details in
Shop, Menü und Ergebnis; ihre Kontur bleibt das CC0-Modell. Die ersten
Raumjäger-Silhouetten nutzen breite, abgestufte Flügel und mehrere Triebwerke.
Kontrastreiche Metalltöne dürfen die gewählte Schiffstönung nicht verdrängen.

## Grafikrunde 3: Expedition und gezeichnete Welten

Die Folgefassung bewahrt die dunkle Weltraumatmosphäre und ergänzt eine
zurückhaltende, illustrative Linienzeichnung. Weltkonturen entstehen
prozedural in Phaser und bleiben in den Randzonen des Spielfelds. Eiswelten
verwenden offene Kristallkanten, Gas- und Sonnenwelten geschichtete Ströme,
Raumrisse gebrochene Rahmen und ruhigere Welten topografische Bahnen. Die
Linien sind Kulisse; Relikte, Hindernisse, Schiff und HUD behalten Vorrang.

Das Cockpit-Gefühl entsteht durch eine feine Skala am HUD-Schleier, nicht
durch zusätzliche deckende Karten. Seltene Relikte erhalten zusätzliche
geometrische Facetten. Das Schiff bleibt in jeder Szene an seiner
ausgerüsteten Form und Farbe erkennbar; die Solo-Ergebnisansicht zeigt es als
kleines Abzeichen.

Neue Kulissenzeichnung muss einmalig beim Szenenaufbau entstehen, in der
Spielmitte ruhig bleiben und auf kleinen Displays hinter den Spielelementen
lesbar sein. Externe Texturen sind dafür nicht erforderlich.

## Gemeinsame Gestaltungsgrundlage — Phase 5, 20.09.2026

Diese Ebene ist der verbindliche Rahmen vor weiteren Einzelumbauten. Sie
bewahrt die vorhandene Weltraumatmosphaere und legt nur gemeinsame Regeln
fest; Menue, Logo und einzelne Oberflaechen bleiben Aufgaben der Folgephasen.

### Tokens

| Zweck                | Wert                                                        |
| -------------------- | ----------------------------------------------------------- |
| Hintergrund          | `#0b1020`                                                   |
| Panel                | `#13212c`                                                   |
| Button               | `#172734`                                                   |
| Button-Kontur        | `#344753`                                                   |
| Haupttext            | `#f4f1e8`                                                   |
| Sekundaertext        | `#b8c0d9`                                                   |
| Primaeraktion / Gold | `#ffd479`                                                   |
| Warnung              | `#ff6b6b`                                                   |
| Erfolg               | `#7ee787`                                                   |
| Radien               | 12–14 px fuer Standardflaechen, 20–24 px fuer grosse Karten |
| Abstufungen          | 8 px Grundraster; 16/24/32 px fuer groessere Gruppen        |

Die Tokens liegen in `src/ui/theme.ts`. Szenen definieren keine eigenen
Oberflaechenfarben. Seltenheitsfarben bleiben ausschliesslich Spielinformation
und werden nicht fuer allgemeine Navigation wiederverwendet.

### Typografie und Informationshierarchie

`FONT_FAMILY` bleibt der robuste System-Stack aus `theme.ts`; dadurch gibt es
keine Webfont-Ladezeit und keinen Layoutsprung im Offline-Spiel.

1. Seitentitel: ein kurzer Titel, `FontSize.title` oder `heading`.
2. Hauptwert: groesser und kontrastreich, nur fuer den wichtigsten Wert.
3. Zeilentitel: `body`/`small`, fett nur fuer die Orientierung.
4. Beschreibung und Metadaten: `small`/`tiny`, gedämpft aber lesbar.

Laengere Erklaerungen werden nicht in Vollversalien gesetzt. Zahlen erhalten
deutsche Formatierung und bleiben mit ihrer Einheit oder Bedeutung verbunden.

### Interaktion und Zustaende

Jede relevante Ansicht beschreibt mindestens diese Zustaende mit Text und
einem passenden Icon oder einer Form: Laden, Offline, Fehler, leer, Erfolg,
gesperrt und aktiv. Farbe allein ist nie die einzige Zustandsinformation.

Primaeraktionen verwenden Gold mit dunkler Beschriftung. Sekundaeraktionen
bleiben auf Buttonflaeche und Kontur. Fokus, Hover und deaktivierte Zustände
veraendern Kontrast oder Kontur, nicht nur die Helligkeit.

Alle nativen oder DOM-basierten Aktionen erhalten mindestens 44 × 44 CSS-Pixel
Trefferflaeche. Phaser-Koordinaten werden dafuer ueber die tatsaechliche
Canvas-Skalierung bewertet. Scrollbereiche enthalten nur Details; Kopfzeile,
Zuruecknavigation und die wichtigste Aktion bleiben fest erreichbar.

### Responsive Pruefmatrix

| Breite | Erwartung                                                                      |
| -----: | ------------------------------------------------------------------------------ |
| 360 px | Grundaktion und Zurueckweg sichtbar; Kulisse schrumpft zuerst                  |
| 390 px | Referenzbreite fuer Karten, Listen und Standardabstaende                       |
| 402 px | Zusatzbreite darf Luft geben, aber keine neue Informationshierarchie erzwingen |

Die bestehende Layout-Pruefung (`src/ui/layoutAudit.ts`) misst sichtbare
Text-, Bild- und Trefferflaechen in CSS-Pixeln. Vor einer breiten UI-Aenderung
wird eine Musterseite an allen drei Breiten dokumentiert.

### Technikentscheidung

Phaser bleibt die gemeinsame Oberflaeche fuer Spiel- und Menueszenen; native
DOM-Elemente werden nur fuer Eingaben, Systemdialoge und nachweislich bessere
Accessibility verwendet. Es wird keine zweite allgemeine UI-Bibliothek
eingefuehrt. Animationen fragen `prefers-reduced-motion` ab und stoppen bei
verborgenem Tab, soweit sie nicht spielmechanisch erforderlich sind.

### Vor Phase 6

Die Grundlage ist mit `Palette`, `FontSize`, `textStyle`, `layoutAudit` und den
vorhandenen Layout-/Reduced-Motion-Tests im Code verankert. Browser-Screenshots
an 360/390/402 px bleiben bis zur ausdruecklichen Browserfreigabe offen.

**Grafik-Update Runde 2, 24.09.2026:**

- **Hindernisse sind Schatten, nicht Licht.** Dunkler Zackenkoerper
  (`Palette.obstacleBody`), eine farbige Warnkontur, ein gestrichelter
  Innenring und ein aufrechtes Symbol - Sanduhr fuer Zeitstrafe
  (`obstaclePenaltyHex`, dieselbe Warnfarbe wie die kritische Restzeit),
  Doppelwinkel fuer Bremse (`obstacleBrakeHex`, kaltes Stahlgrau). Kein
  additiver Schein: Vorher trugen sie ein Leuchten und lila Zacken und lasen
  sich damit wie ein episches Relikt - gegen 1.2 und 2.1. Die aufsteigenden
  Texte beim Treffer tragen dieselben Farben. Die Kontur pulsiert nur in der
  Deckkraft; reduzierte Bewegung haelt sie still.
- **Restzeitbogen.** Ein duenner Bogen in Seltenheitsfarbe ausserhalb der
  Rangmarken leert sich wie ein Uhrzeiger von zwoelf Uhr aus; im letzten
  Viertel wird er breiter und kraeftiger. Er ist Spielinformation und gilt
  deshalb auch bei reduzierter Bewegung und sparsamen Effekten.
- **Vorblitz ab blau (selten).** Rund 420 ms vor dem Relikt erscheint am
  tatsaechlichen Spawnort ein winziger Stern in Seltenheitsfarbe. Er blitzt
  auf und zerfaellt in kleine Lichtsplitter. Bei reduzierter Bewegung und
  sparsamen Effekten bleibt ein ruhiger Stern als Spielhinweis sichtbar.
- **Lichtriss ab episch.** Beim Erscheinen oeffnet sich ein senkrechter
  Lichtspalt in Seltenheitsfarbe (180 ms auf, 60 ms stehen, 160 ms zu) mit
  einem sich weitenden Ring. Er laeuft gleichzeitig mit dem Aufspringen des
  Relikts. Der separate Vorblitz liegt davor; beide Duellanten erhalten
  denselben Spawnplan. Der Lichtriss entfaellt bei reduzierter Bewegung und
  sparsamen Effekten.
- **Leuchtshader.** Figur (Weltfarbe) sowie epische und legendaere Relikte
  bekommen einen `preFX`-Glow - nur unter WebGL, nur bei voller Effektstufe
  (ADR-0027). Bewusst nicht fuer jedes Relikt: Jeder Shader ist ein eigener
  Renderdurchgang.
- **Warnrand der Schlussphase.** Ab 10 s Restzeit - dieselbe Schwelle, an der
  Timer und Zeitbalken rot werden - legt sich ein roter Randschein additiv
  ueber das Feld und schlaegt bei jedem Sekundenwechsel an (Deckkraft 0,16
  Grund, bis 0,46 auf der Spitze, weich abklingend). Kein Aufblitzen, und die
  erste Warnsekunde blendet ein. Reduzierte Bewegung zeigt den Grundwert
  still. Die Vorlage `tex-edge-glow` ist ein Canvas-Radialverlauf bis in die
  Ecken; ein Rahmen aus Rechtecken zeigte gestreckt Streifen und Diagonalnaehte.
- **HUD-Schleier ohne Doppelzeilen.** Die Stufen des Kopfschleiers stossen
  buendig aneinander (2 px). Vorher ueberlappten 16 Streifen je um 1 px; die
  doppelt gedeckten Zeilen waren ueber dem roten Warnrand als Linien sichtbar.
- **Szenenwechsel.** Game, Result, Challenge, WorldInfo, HUD und Menue blenden
  aus dem Grundton ein (240 ms). Der Start einer Jagd faehrt die Kamera
  leicht heran und blendet aus (260 ms, Zoom 1,1); andere Wechsel blenden in
  200 ms aus. Am Rundenende liegt die Blende innerhalb der bisherigen 450 ms.
  Reduzierte Bewegung wechselt ohne Blende.
- **Erfolgsabzeichen.** Medaille mit Beleuchtung von links oben, dunklem Kern,
  einem Emblem je Kategorie (Blitz, Stein, Stern, Planet, Uhr, Knoten, Sonne,
  vierzackiger Stern) und ein bis sieben Rangmarken am unteren Rand. Gesperrt
  grau, aber an Emblem und Rang erkennbar. Metalltoene in `Palette.medal*`.
  Der Rangrahmen der Karte folgt der gemessenen Schriftbreite; wird die Zeile
  eng, schrumpft die Kategoriebeschriftung.
- **Freischaltungen im Ergebnis.** Karten fuer neue Welt, neue Optik und Erfolg
  tragen links ein Bild (Planet mit Weltschein, Halo mit Schiff, Abzeichen),
  das sich einmal aufdreht: aus der Kante in die Flaeche, 460 ms, mehrere
  versetzt um 120 ms. Nur beim ersten Aufbau, nicht bei Resize; statisch bei
  reduzierter Bewegung.

**Schiffe und Figuren, 24.09.2026:**

- **Dreifache Aufloesung.** Die Fluggestalten entstehen weiter im 96-px-
  Koordinatensystem, die Textur aber in 288 px (`SHIP_TEXTURE_RESOLUTION`).
  Vorher wurden sie auf Handys mit Pixelverhaeltnis 3 rund 1,6-fach
  hochgezogen und wirkten weich. Anzeigestellen, die nicht per
  `setDisplaySize` einpassen, rechnen ueber `shipDisplayScale()` zurueck.
- **Beleuchtung aus Kanten** (`textures.createShipTexture`): dunkle Kontur um
  die Silhouette (bleibt beim Einfaerben dunkel und traegt den Kontrast auf
  jeder Welt), Licht von links oben, Fase - helle Kante oben links, dunkle
  unten rechts, aus Silhouette minus versetzter Kopie - und ein Glanzpunkt.
- **Binnenzeichnung in vier Grautoenen**: Rumpf weiss, `RUMPF_MITTEL` fuer
  abgesetzte Paneele, `RUMPF_TIEF` fuer Vertiefungen, `NAHT` fuer Linien,
  dazu dunkles Kanzelglas mit hellem Reflex und Triebwerke mit Gehaeuse und
  Duesenkern. Beim Einfaerben entsteht daraus eine zweifarbige Lackierung.
  Die 18 Raumschiffe und Flugzeuge sind neu gezeichnet, Figuren, Tiere und
  Drohnen tragen Gesichter oder Visiere, Guertel, Stiefel, Umhangfalten,
  Federn, Rotoren. Die Umrisse sind unveraendert - Wiedererkennung vor Neuheit.
- **Hangar zeigt die Zeichnung.** Das Schiff lag dort nur als einfarbige
  CSS-Maske - ein Scherenschnitt. Jetzt liegt die Textur zusaetzlich als
  Hintergrund darunter und wird per `background-blend-mode: multiply` mit
  der Farbe verrechnet, also wie Tint im Spiel. 3D-Modelle behalten ihre
  Vorschau-Silhouette.
- **Kopfzeile des Menues.** Der Vollbildknopf sitzt links, CODE rechts, das
  Logo bleibt mittig und wird so schmal, dass es zwischen die breitere Seite
  passt; die Hoehe folgt der Breite (vorher gestaucht und vom Knopf verdeckt).
- **Emojis und Buchstabenabstand.** Phaser zerlegt Text mit Abstand in
  UTF-16-Einheiten und zerreisst Emojis ausserhalb der Grundebene.
  `ui/letterSpacingGuard.ts` zeichnet solche Texte ohne Abstand.

**Relikte, 19.09.2026:** Ein schmaler Seltenheitsrand ersetzt den dominanten
Lichtnebel. Eine feste Lichtkante links oben und eine schattige Nachtseite
geben den rotierenden Oberflaechen Tiefe. Ein bis sechs kleine Rangmarken
unter dem Relikt ergaenzen die unveraenderten Seltenheitsfarben. Oberflaeche
und Strahlen drehen langsamer; reduzierte Bewegung friert diese Dekoration ein.

**Schiffe, 19.09.2026:** Die 2D-Ruempfe erhalten eine feste Beleuchtung von
links oben, eine helle Rumpffacette und dunklere Heckflaechen. Cockpits tragen
eine klare Glasreflexion. Ein weissblauer Triebwerkskern mit schmalem,
tempoabhaengigem Schweif sitzt am mitgeneigten Heck. Bei reduzierter Bewegung
bleibt seine Laenge konstant. Die 3D-Spielansicht nutzt weniger Umgebungslicht,
damit die vorhandene gerichtete Beleuchtung die Rumpfform deutlicher zeigt.

**Spielfeld, 19.09.2026:** Die Jagd bekommt eine eigene tiefblaue, dunkle
Raumkulisse. Strukturierte Nebelbaender greifen die Weltfarben auf, drei
feine Sternlagen reagieren mit sanfter Parallaxe auf die Schiffsposition.
Ein grosser angeschnittener Kulissenplanet am Rand vermittelt Massstab.
Die Spielfeldmitte bleibt ruhig; Kulisse hat keine Sammelmarkierungen.
Reduzierte Bewegung stellt Sterne und Nebel statisch dar.

**Fang-Anzeigen, 19.09.2026:** Die Punktzahl steht in der Seltenheitsfarbe;
ab epischen Relikten bleibt das Seltenheitssymbol sichtbar. Glückstreffer
zeigen eine grössere goldene Zahl mit x3-Hinweis und stärkerer Ausdehnung.
Serienbonus bleibt im HUD; mit Einsicht erscheint dort zusätzlich die
laufende XP-Summe statt einzelner XP-Zeilen am Fang.

Grafik-Update Punkt 7: Der Hangar nutzt eine schräge orthografische Kamera,
eine dunkle Plattform mit goldener Leuchtkante und einen kleinen Triebwerksschweif.
Manuelles Drehen ersetzt die automatische Shop-Rotation; nur das Schweben bewegt
sich leicht. Reduzierte Bewegung friert Schweben und Aura auf ihr bestehendes
Ruhebild ein; manuelles Drehen bleibt möglich. Rumpffarbe und Aura kommen aus
den vorhandenen Kosmetikdefinitionen. Weltfarbe zeigt einen hellen Rumpf.
Native Bedienelemente bleiben mindestens 44 CSS-Pixel hoch; Details scrollen,
Kauf-/Ausrüstaktion und Rückweg bleiben fest erreichbar.

Grafik-Update Punkt 8: grosse feste Punktzahl, eigener Rekordhinweis, dunkle
Belohnungskarten mit goldenen Ueberschriften. XP-Fortschritt erscheint sofort;
220 ms Deckkraft-Einblendung ohne Skalierung, bei reduzierter Bewegung statisch.
Details scrollen unter einer Maske; die goldene Hauptaktion bleibt fest erreichbar.

**Punkte-Druckwelle, 19.09.2026:** Eine Punktzahl schnellt hervor, dehnt sich
**durchgehend weiter** aus und verblasst dabei — sie verschwindet groß, nicht
klein, wie eine Rauchwolke, die sich auf dem Weg nach oben auflöst.

Die Bewegung gibt es an **zwei** Stellen, mit gleicher Wirkung und
unterschiedlicher Umsetzung:

| Wo                      | Was                         | Umsetzung                                                                |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `CollectionEffects`     | Fänge (Planeten einsammeln) | pro Frame aus dem Alter gerechnet, ohne Tween — bis zu acht gleichzeitig |
| `widgets.floatingScore` | Strafen, Hindernisse, XP    | ein Tween je Anzeige                                                     |

Gemessen beim Fang: 0,40 → 1,57 über 630 ms, 3,9-faches Wachstum, 46 px
Aufstieg, Deckkraft 1,0 → 0,16. Der Aufschlag sitzt in den ersten 90 ms.

**Drei Anläufe, weil zweimal die falsche Annahme getestet wurde.** Erst ein
gleichmäßiges Wachsen von 0,96 auf 1,0 — vier Prozent sind keine Bewegung.
Dann ein Überschießen mit Rückkehr auf die Ausgangsgröße per `yoyo`: messbar,
aber es hob sich selbst auf. _Eine Bewegung wird gesehen, wenn sie sich
summiert, nicht wenn sie groß ist._ Und beide Male an der falschen Stelle —
die Fänge laufen über `CollectionEffects`, nicht über `floatingScore`. Ein
Test hält die Bewegung jetzt fest (`CollectionEffects.test.ts`); der ältere
Test dort prüfte nur den Zweig für reduzierte Bewegung und war deshalb blind
dafür. Bei reduzierter Bewegung bleibt es beim statischen Text.

**Talente in der Pause, 19.09.2026:** Die aktiven Verstärkungen stehen als
zweispaltige Liste — Name und Rang links, Wirkung rechtsbündig grün. Vorher war
es ein einziger, mit „·" verketteter Absatz, der bei zehn Talenten mitten im
Wort umbrach. Zahlen vergleicht man senkrecht; genau das ist die Frage in der
Pause.

**Grafik-Update Punkt 6, 17.09.2026:** Kurze, gebogene Lichtsplitter zum Schiff
und geneigte Energieringe ersetzen Explosion und Vollbildblitz beim Fang.
Normale Fänge bleiben klein; epische/legendäre Fänge bekommen zwei Ringe und
mehr Splitter. Die bekannten Farben und Seltenheitssymbole bleiben erhalten.
Weiße, dunkel konturierte Punkteblöcke enthalten Bonus und XP gemeinsam.
Fangdarstellung maximal 700 ms, acht aktive Fänge, höchstens 56 Splitter.
Reduzierte Bewegung zeigt statische kleine Ringe und Texte. Diese Festlegung
ersetzt die ältere Fang-/Kamerablitzbeschreibung in der Animationstabelle unten.

**Grafik-Update Punkt 5, 16.09.2026:** Das HUD verwendet drei feste Spalten
für Punkte, Zeit und Serie/Multiplikator. Zahlen sind hell, Multiplikatoren gold,
kritische Restzeit rot mit sichtbarer Sekundenangabe. ~~Eine gemeinsame dunkle
Unterlage (`Palette.panel`, 94 % Deckkraft) schützt den Kontrast auf allen
Welten.~~ **Überholt am 19.09.2026:** Die Unterlage verdeckte das Spielfeld und
ist einem nach unten auslaufenden Schleier gewichen (max. 55 % oben, 0 % unten);
den Kontrast trägt jetzt eine Kontur an den Zahlen selbst. Der Zeitbalken sitzt
am oberen Bildschirmrand statt unter den Zahlen.
Gegner bekommen eigene Zeilen; Namen werden gekürzt, Status bleibt als Text sichtbar.
Kurzes Deckkraftfeedback ersetzt wachsende Zahlen. Lange Talentlisten stehen
vollständig im Pausefenster; im HUD bleibt eine kompakte Hinweiszeile.
Pause und Dialogbuttons sind mindestens 44 CSS-Pixel hoch. Dialoghöhe folgt dem
Inhalt; sichere untere Bildschirmränder werden berücksichtigt.

**Grafik-Update Punkt 4, 16.09.2026:** Raumjäger behalten ihre stabilen Silhouetten
und Skin-IDs. Cockpits und Innenflächen erhalten neutrale Schatten (`#536579`),
damit sie auch über einem weißen Rumpf sichtbar und weiterhin einfärbbar bleiben.
Pfeil erhält abgesetzte Flügelpaneele und Triebwerksfassungen. Andere Figurtypen
werden nicht pauschal mit einem Cockpit übermalt. Flugneigung: maximal 0,32 rad
seitlich und 0,18 rad Beschleunigungsimpuls, exponentiell geglättet. Der 2D-Pfad
übersetzt den Impuls in Rumpfstauchung; der 3D-Pfad kippt das Modell.
Eine ausgerüstete Aura erhält einen dünnen elliptischen Ring, hinten schwächer,
vorne heller. Der separate Sammelkreis bleibt unverformt. Reduzierte Bewegung
setzt die Flugpose auf neutral und hält Overlay-Frames sowie 3D-Drehung an.

**Stand:** 2026-08-30 · Produktstand siehe `package.json`/`version.json`

**Laufende Designarbeit (14.09.2026):** Das geplante Grafik-Update mit 2,5D-Effekten
und 3D-Hangar wird im [Grafik-Update-Plan](GRAFIK_UPDATE_PLAN.md) geführt.
[Erste Entwürfe und Messungen](design/2026-09-14/README.md) liegen zur Durchsicht vor.
Seit 15.09.2026 wird Punkt 2 umgesetzt: gemeinsamer ruhiger Button-/Panelstil
und ein anhand von CSS-Pixeln berechnetes Hauptmenü. Der folgende ältere
Leitfaden wird durch diese konkrete Festlegung ergänzt:

- Panels verwenden `#13212c`, Buttons `#172734` mit Kontur `#344753`.
- Eine explizite primäre Aktion erhält Gold mit dunkler Beschriftung; normale
  Buttons erhalten keinen ausgedehnten Halo mehr. Ihre Trefferflächen bleiben stabil.
- Im Hauptmenü werden die Buttonhöhen vor der Umrechnung in Phaser-Koordinaten
  auf mindestens 44 CSS-Pixel ausgelegt. Auf kurzen Displays schrumpft zuerst die Kulisse.
- Das vorhandene Logo, die vorhandenen Planeten und die ausgerüstete Schiffsform
  bleiben die Assets dieser Etappe. Neuer Hangar und räumliche Spielfeld-Effekte folgen später.
- Profilzeilen bekommen feste Textgrenzen mit Auslassung statt Überlaufen in den Nachbarbutton.

Punkt 3: Große Kulissenplaneten bekommen eine feste Lichtquelle links oben,
eine dunkle Nachtseite und einen schmalen Atmosphärenrand. Die Oberfläche
wandert unabhängig vom Licht. Ringe werden hinter und vor der Kugel gezeichnet.
Sternenweide: Kontinente; Eisring: Eis und Splitterring; Glutnebel: Gasbänder;
Nullsektor: dunkler Kern mit Riss; Sonnenkrone: Korona; Mondschmiede: Krater
und Monde; Kristallbruch: Facetten; Sturmgrenze: Wirbel; Lichtkern: helle
Konvektionszellen; Horizonttor: Doppelring. Kulissen bleiben kontrastarm und
ohne Sammelmarkierung; Seltenheitsfarben und Sammelobjekte bleiben unverändert.

---

## 1. Leitbild

> **Dunkler Hintergrund, leuchtende Objekte.**

Der Name traegt es schon: _isi_ ist türkisch für Licht (_ışık_). Alles, was
wichtig ist, leuchtet. Alles, was nicht leuchtet, ist Kulisse.

Drei Konsequenzen:

1. **Hintergruende sind dunkel und gesaettigt** — nie mittelhell, sonst
   verlieren die Relikte ihren Kontrast.
2. **Spielrelevantes hat einen Lichtschein** (`Glow`-Textur, additiv
   gemischt). Was keinen Schein hat, kann man nicht einsammeln.
3. **Farbe ist Information, nicht Dekoration.** Die Seltenheitsfarben sind
   unantastbar.

## 2. Farbsystem

### 2.1 Seltenheiten — unveraenderlich

Diese sechs Farben sind die Sprache des Spiels. Sie werden **nie** fuer etwas
anderes benutzt — kein UI-Element, kein Hintergrund, keine Welt darf Lila
verwenden, wenn es nicht "episch" bedeutet.

| Stufe         | Hex       |        |
| ------------- | --------- | ------ |
| Schlicht      | `#9d9d9d` | Grau   |
| Gewoehnlich   | `#ffffff` | Weiss  |
| Ungewoehnlich | `#1eff00` | Gruen  |
| Selten        | `#0070dd` | Blau   |
| Episch        | `#a335ee` | Lila   |
| Legendaer     | `#ff8000` | Orange |

### 2.2 Welten

Jede Welt hat einen Verlauf (oben → unten) und **eine** Leitfarbe. Die
Leitfarbe faerbt Figur-Aura, HUD-Akzente und Schwebepartikel.

| Welt         | Oben      | Unten     | Leitfarbe |
| ------------ | --------- | --------- | --------- |
| Sternenweide | `#123021` | `#061410` | `#4ade80` |
| Eisring      | `#11294d` | `#050d1c` | `#7dd3fc` |
| Glutnebel    | `#431407` | `#1a0703` | `#fb923c` |
| Nullsektor   | `#2e1065` | `#0f0524` | `#c084fc` |
| Sonnenkrone  | `#4a3308` | `#1a1103` | `#fcd34d` |

**Regel fuer neue Welten:** Der Hintergrund darf nie heller als etwa 25 %
Helligkeit sein, und die Leitfarbe muss sich von allen sechs
Seltenheitsfarben klar unterscheiden.

### 2.3 Oberflaeche

| Zweck               | Wert      |
| ------------------- | --------- |
| Grundton            | `#0b1020` |
| Panel               | `#13212c` |
| Text                | `#f4f1e8` |
| Text gedaempft      | `#b8c0d9` |
| Hervorhebung / Gold | `#ffd479` |
| Warnung             | `#ff6b6b` |
| Erfolg              | `#7ee787` |
| Hindernis: Strafe   | `#ff6b6b` |
| Hindernis: Bremse   | `#a9bfd6` |
| Hinderniskoerper    | `#0a0e18` |

Definiert in `src/ui/theme.ts`. Scenes definieren **keine** eigenen Farben.

**"Text gedaempft" am 2026-08-17 aufgehellt** (vorher `#9aa3bd`): Fuer
Zielgruppen mit reduzierter Kontrastwahrnehmung (u. a. aeltere Spieler) war
der alte Wert auf den dunklen Hintergruenden zu knapp. Spielrelevante
Live-Anzeigen ohne Panel-Unterlage - der Rundentimer und das Duell-Zielscore
im HUD (`src/scenes/HudScene.ts`) - nutzen seither den hellen Standardton
`Text` statt "gedaempft", weil sie auf jedem der Welt-Hintergruende lesbar
bleiben muessen, nicht nur auf dunklen Panels.

## 3. Formensprache

Phase 3 ersetzt die Fantasy-Symbole durch eine tintbare Weltraum-Sprache:
Die Figur ist ein Licht-Raumschiff, Relikte werden als Planeten mit
Atmosphaerenrand und Orbit gelesen. Die Texture-Keys bleiben dabei stabil.

- **Kreise und Sterne, keine Rechtecke.** Alles Spielbare ist rund oder
  strahlenfoermig. Rechtecke sind der Oberflaeche vorbehalten.
- **Die Figur ist ein Licht-Raumschiff** mit rotierendem Ring. Der Ring hat
  exakt den Radius, in dem eingesammelt wird — das Feedback muss ehrlich sein.
- **Planeten sind Relikte** mit Atmosphaerenrand, Kontinenten und Orbit.
- **Weiche Ecken** in der Oberflaeche: Radius 12–14 px.

## 4. Bewegung

Bewegung ist Sprache — sie sagt dem Spieler, was passiert ist.

| Ereignis                    | Bewegung                                                           | Dauer                    |
| --------------------------- | ------------------------------------------------------------------ | ------------------------ |
| Relikt erscheint            | Skalierung 0 → 1, `Back.Out`                                       | 220 ms                   |
| Blaues oder hoeheres Relikt | Winziger Stern blitzt am Spawnort auf und zerfaellt                | bis 420 ms vor Spawn     |
| Relikt laeuft ab            | Alpha + Skalierung sinken                                          | letzte 700 ms            |
| Fang                        | Relikt zieht sich zusammen, Splitter, Schockwelle, Zahl steigt auf | 160 / 480 / 420 / 750 ms |
| Seltener Fang (ab episch)   | zusaetzlich Kamera-Ruckler + Aufblitzen, groessere Schockwelle     | 180 ms                   |
| Punktestand aendert sich    | kurzer Pop auf 112 %                                               | 180 ms                   |
| Figur im Stillstand         | Pulsieren 94 % ↔ 106 %                                             | 1100 ms                  |
| Figur in Bewegung           | Lichtspur ab 60 px/s                                               | 420 ms Nachleuchten      |
| Seltenes Relikt liegt da    | Strahlenkranz dreht gegenlaeufig zum Relikt                        | endlos                   |
| Vorlage im Duell ueberholt  | _UEBERHOLT!_ blendet auf und wieder aus                            | 240 ms + 700 ms          |
| Glueckstreffer              | _KRITISCH_ schlaegt ein, steht, reisst auf und verweht             | 90 + 110 + 220 ms        |
| Serie erreicht 16           | Farbstoss in Weltfarbe ueber das ganze Bild, hoechstens 28 %       | 40 + 260 ms              |
| Serienfenster laeuft aus    | Serienspalte wird rot, Balken laeuft leer                          | ab 25 % Restfenster      |
| Ergebnis mit Praemie        | Kopfzahl zaehlt hoch, `Cubic.easeOut`, dann kurzer Pop auf 112 %   | 260 + 1100 + 240 ms      |
| Update liegt bereit         | Goldener Balken in der Kopfzeile, Glimmen pulsiert 35 % ↔ 100 %    | 900 ms, endlos           |
| Seltenes Relikt erscheint   | Lichtriss oeffnet und schliesst sich, Ring weitet sich (ab episch) | 180 + 60 + 160 ms        |
| Letzte 10 Sekunden          | Roter Randschein schlaegt je Sekunde an und klingt ab              | 1000 ms Takt             |
| Szenenwechsel               | Ausblenden bzw. Heranfahren, Einblenden aus dem Grundton           | 200/260 + 240 ms         |
| Freischaltung im Ergebnis   | Bild dreht sich aus der Kante auf                                  | 460 ms, je +120 ms       |

**Der Update-Hinweis darf aus dem Raster fallen.** Bis v0.1.341 war er ein
gewoehnlicher Sekundaerknopf in der Kopfzeile - dieselbe graue Flaeche,
dieselbe Hoehe und dieselbe Form wie die acht Menueknoepfe darunter. Er war
sichtbar und wurde trotzdem uebersehen, weil nichts ihn von Navigation
unterschied. Jetzt traegt er die goldene Primaerfarbe, steht hoeher als eine
Menuezeile und liegt in einem pulsierenden Glimmen. Das ist der einzige
Dauerpuls im Menue, und er ist es wert: Eine verpasste Aktualisierung macht
jede Rueckmeldung vom Geraet wertlos (`docs/CODE_STYLE.md` 1.9). Bei
`prefersReducedMotion` bleibt das Glimmen stehen statt zu pulsieren - die
Farbe allein traegt den Hinweis dann.

**Die Kopfzahl zaehlt nur hoch, wenn sie etwas zu erzaehlen hat.** Ohne
Abschlusspraemie faellt die Bewegung ganz aus: Ein Zaehlwerk, das bei seinem
Startwert beginnt und dort endet, ist keine Belohnung, sondern Wartezeit vor
einer Zahl, die schon feststeht. Der Massstab der Schrift haengt am Endwert,
nicht am gerade gezeigten Zwischenstand - sonst zappelte die Zahl mit jeder
neuen Stelle. Bei `prefersReducedMotion` steht das Ergebnis sofort.

**Zwei Schwellen steuern die Aufmerksamkeit**, beide in `GameConfig.ts`:

| Schwelle                   | Ab          | Wirkung                                           |
| -------------------------- | ----------- | ------------------------------------------------- |
| `RARITY_RAYS_MIN_POINTS`   | selten (15) | Strahlenkranz, staerkeres Pulsieren               |
| `RARITY_IMPACT_MIN_POINTS` | episch (50) | Kamera-Ruckler, Aufblitzen, doppelte Splitterzahl |

Der Abstand ist Absicht: **Sehen darf man Seltenes oft, spueren selten.**
Bekaeme jedes Relikt einen Strahlenkranz, hoerte er auf, Seltenheit zu
bedeuten.

**Grenze:** Kein Effekt darf laenger als **800 ms** dauern. Bei einem Run von
90 Sekunden ist alles Laengere im Weg.

### Der Glueckstreffer-Schriftzug darf als einziger das Feld ueberlagern

_KRITISCH_ steht gross auf 30 % der Bildhoehe, mitten im Spielfeld — eine
Ausnahme von der Regel, dass Anzeigen sich aus dem Feld heraushalten. Sie ist
begruendet: Der Glueckstreffer ist das einzige Ereignis, das rein zufaellig
eintritt. Alles andere, was das Spiel meldet, hat der Spieler selbst getan und
deshalb kommen sehen; der Glueckstreffer nicht. Wird er nur als groessere Zahl
am Fangort angezeigt, verschwindet er zwischen den anderen Zahlen.

Weil er ueberlagert, muss er kurz und selten sein — beides ist abgesichert:

- **Kurz:** 420 ms insgesamt, die knappste Zeit, in der ein Wort lesbar
  einschlaegt und wieder verschwindet.
- **Selten:** mindestens 1,5 Sekunden Abstand zwischen zwei Schriftzuegen. Mit
  Glueckstreffer auf Rang 5 faellt rechnerisch alle vier Sekunden ein Krit;
  ohne diese Sperre stuende der Schriftzug fast dauernd im Bild. Punkte und
  Feld-Anzeige bleiben in der Sperre unberuehrt — nur der Schriftzug entfaellt.
- **Allein:** Der Serien-Multiplikator weicht fuer seine Dauer. Beide sind
  gold und erscheinen an fast derselben Stelle; ein Krit faellt oft genau dann,
  wenn die Serie eine Stufe steigt.

Das Feld-Label traegt beim Glueckstreffer **nur noch die Zahl**. Groesse und
Farbe sagen dort, dass etwas Besonderes passiert ist; der Name steht oben.
Dieselbe Auskunft zweimal im selben Augenblick zwingt zum Lesen, waehrend das
Spiel weiterlaeuft.

## 4.1 Ton

Ton ist Rueckmeldung, kein Dauerteppich. Die Klaenge sind vorgerendert
(`scripts/render-sfx.mjs`, ADR-0029) und in C-Dur-Pentatonik gestimmt, damit
alles, was gleichzeitig klingt, zueinander passt. Dateien und Lizenzen:
`docs/SOUND_ASSETS.md`.

| Ereignis          | Klangidee                                                                          |
| ----------------- | ---------------------------------------------------------------------------------- |
| Button            | weicher Tap mit kurzem Transienten; Zurueck tiefer und fallend                     |
| Umschalter        | zwei Blips, steigend fuer an, fallend fuer aus                                     |
| Weltwechsel       | Swoosh plus Glocke, die je Welt hoeher gestimmt ist                                |
| Countdown         | Sprachansage "Drei - Zwei - Eins - Los geht's!" (Thorsten-Stimme, CC0)             |
| Reliktfang        | Grau dumpf, Glas-Pling, Kristall, Glocken-Arpeggio, Chor-Pad, Legendaer mit Sub-Drop und Glitzer; Grau/Gewoehnlich leicht in der Tonhoehe gestreut |
| Combo-Stufe       | Riser in eine Glocke, je Stufe hoeher, ab Stufe 4 mit Glitzer                      |
| Hindernis         | Bremse als "Tape-Stop", Strafe als digitaler Glitch                                |
| Relikt verblasst  | leiser Hauch nach unten, nur ab Selten                                             |
| Pause / Weiter    | Filterfahrt nach unten bzw. oben ("Einfrieren", "Auftauen")                        |
| Run-Ende          | warmer Akkord; Levelaufstieg bekommt eine Brass-Fanfare mit Glocken                |
| Erfolg            | Glissando in eine helle Glocke, 1,2 s nach dem Run-Ende-Klang                      |

Die sechs Seltenheitsfarben bleiben visuell unantastbar; Ton ergaenzt sie nur.
Der Ton ist in den Einstellungen abschaltbar und wird im Spielstand gespeichert.
Auf iOS wird der AudioContext erst nach der ersten Nutzergeste entsperrt.

Der Ergebnisbildschirm verstärkt einen Levelaufstieg nicht mit mehr Partikeln,
sondern mit Hierarchie: `LEVEL-UP!`, erreichte Stufe, XP-Restwert,
Level-Coins, aktuelle Coins und unmittelbare Freischaltungen stehen in einem
gemeinsamen Belohnungspanel. Die Levelaufstieg-Fanfare ueberschreitet mit
ihrem Nachhall die fruehere 800-ms-Grenze bewusst (Hoertest 2026-09-24); ihr
Kern ist nach rund einer Sekunde vorbei. Fremde Audio-Assets brauchen weiterhin
einen Lizenzeintrag in `docs/SOUND_ASSETS.md`.

## 5. Schrift

v0.1 nutzt System-Fonts (`Trebuchet MS`, `Segoe UI`, `system-ui`). Kein
Webfont-Laden, kein Layoutsprung, funktioniert offline.

| Rolle               | Groesse |
| ------------------- | ------- |
| Titel / Punktestand | 68 px   |
| Ueberschrift        | 40 px   |
| Gross               | 34 px   |
| Fliesstext          | 26 px   |
| Klein               | 21 px   |
| Winzig / Label      | 17 px   |

Labels in Grossbuchstaben mit **6–8 px Laufweite** — das ist der
"UI-Rahmen"-Look, der die Anzeige von Spielinhalten trennt.

## 6. Aktuelle Assets: prozedural und rasterbasiert

Spielrelevante Relikte, Raumschiffe und UI-Grundformen entstehen weiterhin
beim Start in `src/ui/textures.ts`. Die grossen Hintergrundplaneten und das
Logo sind dagegen echte Bilddateien in `public/assets/`, weil Oberflaechen-
details und die Markenform davon profitieren.

Weitere Rasterassets sind die **App-Icons** fuer Manifest und iOS-Home-Bildschirm:
Dort verlangt das Betriebssystem echte PNG-Dateien. Sie werden von
`scripts/generate-icons.mjs` gezeichnet — derselbe vierzackige Stern in Gold
auf dem Grundton, nur vorab statt zur Laufzeit. Wer das Motiv aendert, aendert
eine Zahl im Skript und laesst `npm run icons` laufen.

Der Stern nimmt bewusst nur 30 % der Icon-Breite ein: Android schneidet
"maskable" Icons zu einem Kreis zu und garantiert nur die inneren 80 % der
Flaeche.

Die weiteren Rasterassets liegen unter `public/assets/`: `isihunt-logo-v2.png`
und je eine Planetentextur fuer Sternenweide, Eisring, Glutnebel, Nullsektor
und Sonnenkrone. Sie werden im `BootScene` vor dem Menue geladen.

Die Planeten sind **256×256 WebP** (zusammen rund 119 KB). Sie lagen zuvor als
512×512 PNG bei 2,0 MB vor — bei einer groessten Darstellung von 300 px und
einer Deckkraft von 7 bis 10 % im Hintergrund war das ohne sichtbaren Gegenwert
der groesste Einzelposten des Kaltstarts.

Wer die Groesse erneut aendert, muss **nichts** im Code nachziehen: alle
Zeichenstellen setzen `setDisplaySize()` in Bildschirmpixeln, nicht
`setScale()`. Ein frueher hartkodiertes `planetTextureRadius = 256` in
`Collectible` war genau die Kopplung, die das verhindert hat.

Die einsammelbaren Relikte verwenden diese echten Planetensprites passend zur
Welt. Die Seltenheitsfarbe kommt ueber Glow, Strahlenkranz und Fang-Effekte
hinzu, damit die sechs Seltenheitsfarben eindeutig bleiben.

| Key               | Was                                                    | Groesse |
| ----------------- | ------------------------------------------------------ | ------- |
| `tex-pixel`       | 1×1 weiss, Basis fuer Flaechen und Balken              | 1×1     |
| `tex-orb`         | Planet als Relikt: Atmosphaerenrand, Kontinente, Orbit | 64×64   |
| `tex-glow`        | weicher Lichtschein (konzentrische Kreise)             | 128×128 |
| `tex-spark`       | rundes Partikel fuer Schwebestaub                      | 16×16   |
| `tex-shard`       | vierzackiger Splitter fuer Fang-Explosionen            | 24×24   |
| `tex-rays`        | Strahlenkranz hinter seltenen Relikten                 | 160×160 |
| `tex-ring`        | Ring fuer die Schockwelle beim Fang                    | 128×128 |
| `tex-vignette`    | radiale Randabdunklung                                 | 256×256 |
| `tex-edge-glow`   | weisser Randschein zum Einfaerben (Warnrand)           | 256×256 |
| `tex-player-core` | Licht-Raumschiff mit Cockpit, Fluegeln und Triebwerken | 96×96   |
| `tex-player-halo` | Ring mit vier Segmenten und Markern                    | 128×128 |

**Alles wird weiss gezeichnet und zur Laufzeit getintet.** Deshalb bedient
eine Textur alle Seltenheiten und Welten.

Das gilt fuer die tintbaren Spielobjekte. Die Hintergrundplaneten bleiben
farbig und sehr transparent; sie sind Kulisse und keine Relikte. Beim Boot
werden Logo und Planetentexturen vor dem Menue geladen.

Die sechs Raumschiff-Skins werden ebenfalls prozedural aus derselben weissen
Grundform gebaut. Sie schalten bei Level 5, 15, 30, 50, 75 und 100 zusätzliche
Silhouetten-Details frei und behalten dadurch die klare Lesbarkeit im Spiel.

### 6.1 Warum Facetten und Splitter

Zwei Formentscheidungen mit Absicht dahinter:

- **Das Relikt hat Facetten statt einer glatten Kugel.** Eine glatte Kugel
  sieht gedreht identisch aus — die Rotation waere unsichtbar. Acht Segmente
  mit wechselnder Helligkeit machen die Drehung lesbar und lassen das Relikt
  wie geschliffen wirken.
- **Fang-Partikel sind spitz, Hintergrundstaub ist rund.** Rundes liest sich
  als Rauch oder Nebel, Spitzes als Splitter. Ein zerspringendes Relikt soll
  splittern.

### 6.2 Hintergrund in Schichten

Ein Verlauf allein wirkt wie ein Plakat. Der Hintergrund besteht deshalb aus
fuenf Ebenen (Reihenfolge in `src/ui/depth.ts`):

| Ebene                | Zweck                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Grundverlauf         | Farbstimmung der Welt                                                                             |
| Horizontschein       | die Lichtquelle der Welt, oberes Drittel                                                          |
| Hintergrundplaneten  | zwei sehr transparente Planeten als feste Himmelsmarken je Welt                                   |
| Farbwolken           | vier weiche Flecken in **fester** Anordnung je Welt — jede Welt bleibt wiedererkennbar            |
| Zwei Parallax-Ebenen | die hintere kleiner, dunkler, langsamer; der Geschwindigkeitsunterschied _ist_ der Tiefeneindruck |
| Lichtstaub           | steigt auf, traegt die Stimmung                                                                   |

Darueber liegt eine **Vignette**, die den Blick zur Bildmitte zieht.

## 7. Regeln fuer weitere echte Assets

Wenn Platzhalter durch echte Grafiken ersetzt werden:

1. **Texture-Keys bleiben gleich.** Nur `textures.ts` aendert sich, kein
   Spielcode.
2. **Weiss oder graustufig liefern**, damit das Tinting weiter funktioniert.
   Farbige Assets brechen das Seltenheitssystem.
3. **Zweifache Aufloesung** (`@2x`) fuer scharfe Darstellung auf modernen
   Displays.
4. **Quelldateien** (`.aseprite`, `.psd`) gehoeren nach `art-source/` und
   werden nicht eingecheckt — nur die Exporte.
5. **Transparente Raender**: mindestens 2 px Luft, sonst schneidet die
   Skalierung Kanten ab.

### Wo man Assets bekommt

- [Kenney.nl](https://kenney.nl/) — CC0, riesig, sofort nutzbar
- [itch.io Game Assets](https://itch.io/game-assets/free) — viel Fantasy
- [OpenGameArt](https://opengameart.org/) — Lizenz je Werk pruefen

**Lizenzen immer pruefen und in einer `CREDITS.md` festhalten**, bevor etwas
eingecheckt wird.

## 8. Barrierefreiheit

Offen fuer M4, hier schon notiert:

- Die Seltenheitsfarben Grau/Weiss und Gruen/Orange sind fuer manche
  Farbsehschwaechen schwer zu trennen. **Loesung:** zusaetzlich die Form
  variieren (Zacken je Stufe), nicht nur die Farbe.
- Kamera-Ruckler und Aufblitzen brauchen einen Ausschalter
  (`prefers-reduced-motion` respektieren).
- Mindestgroesse fuer Tippziele: 44 × 44 px. Alle Knoepfe liegen deutlich
  darueber.
- **Gesten brauchen einen Knopf-Fallback.** Das Weltenwheel im Menue
  (`MenuScene.buildWorldList`) liess sich zunaechst nur per Wisch-Geste mit
  Geschwindigkeitsschwelle bedienen - fuer motorisch weniger sichere Finger
  (Kinder, aeltere Spieler) ist das unzuverlaessig, und ein misslungener
  Swipe gibt kein Feedback ausser dem Zurueckschnappen. Seit 2026-08-17
  ergaenzen zwei Pfeil-Knoepfe denselben Auswahlpfad (`selectWorld`) als
  zuverlaessiger Zweitweg. Wer eine neue Wisch-Geste einbaut, sollte pruefen,
  ob ein Knopf-Fallback noetig ist.

### 8.1 Die Trefferflaeche deckt den Knopf — nicht mehr, nicht weniger

> **Ein Knopf reagiert genau dort, wo er ist.**

Das klingt selbstverstaendlich und hat drei Anlaeufe gekostet. Zwei Irrwege,
damit sie nicht wiederholt werden:

**Irrweg 1: Trefferflaeche ueber den Lichtschein hinaus vergroessern.** Klingt
grosszuegig, erzeugt aber unsichtbare Flaeche. Bei zwei Knoepfen nebeneinander
ueberlappen sie sich, und dann gewinnt in Phaser das **zuletzt erzeugte**
Objekt (`InputPlugin.sortGameObjects`) — nicht das naeherliegende. Man tippt
sichtbar auf den linken Knopf und bekommt den rechten.

**Irrweg 2: Der Ursprung der Trefferflaeche.** Siehe 8.3 — das war der
eigentliche Fehler.

Wer die Flaeche doch einmal vergroessern will, muss vorher nachrechnen, dass
sich keine zwei Flaechen beruehren. Im Menue liegen zwischen zwei Knoepfen nur
10 px.

### 8.2 Druckzustaende skalieren das Bild, nie die Trefferflaeche

Ein Knopf, der sich beim Druecken staucht, **darf dabei nicht kleiner werden,
als er anfassbar ist**. Phaser rechnet die Trefferflaeche in der Skalierung des
Objekts, an dem sie haengt — ein `setScale(0.96)` auf dem interaktiven Container
verkleinert also beides zugleich, und zwar in dem Moment, in dem der Finger
schon aufliegt. Ein Tipp am Rand loest dann `pointerdown` aus, faellt aus der
geschrumpften Flaeche heraus und bekommt nie ein `pointerup`. Der Knopf blinkt
und tut nichts.

> **Regel:** Sichtbares und Anfassbares sind zwei Objekte. Animiert wird immer
> das innere, interaktiv ist immer das aeussere.

Das gilt fuer jede Druck-, Hover- oder Pulsanimation, die an einem
interaktiven Objekt haengt — nicht nur fuer Knoepfe.

**Dazu:** Ein Tipp gilt, solange er auf demselben Element endet, auf dem er
begonnen hat. Ein Daumen wandert zwischen Aufsetzen und Abheben ein paar Pixel;
das darf einen Tipp nicht verschlucken. Nur wer bewusst wegzieht und ausserhalb
abhebt, bricht ab.

### 8.4 Das Spielfeld haelt sich aus den sicheren Raendern heraus

`viewport-fit=cover` laesst den Welt-Hintergrund bis hinter Statusleiste und
Home-Indicator reichen, damit dort nichts Fremdes durchblitzt. Text und Canvas
bleiben dagegen unter Dynamic Island, Uhr und Systemblur.

Nach `safe-area-inset-top` folgt auf iPhones ein 32-px-Schutzbereich gegen den
nach unten auslaufenden Systemblur und danach die 32-px-Laufzeile. Dieser
Schutzbereich ist transparent und zeigt den Welt-Hintergrund; nur die
eigentliche Laufzeile hat den dunklen Balken. So entsteht kein blaues Leerfeld.
Seitliche Raender nutzen weiterhin `env(safe-area-inset-*)`. Unten reicht der
Canvas bis zum Displayrand; die Bedienelemente halten ihren Sicherheitsabstand
innerhalb des Spiels.

**Warum das nie am Schreibtisch auffaellt:** Ein Browser-Simulator kann
iPhone-Groessen nachstellen, aber **keine sicheren Raender** — die entstehen
erst durch echte Notch-Hardware. Diese Klasse Fehler ist nur auf dem Geraet zu
finden; deshalb zeigt der Wartungsbildschirm die gemessenen Werte an
(`core/layoutReport.ts`).

**Und:** Jedes DOM-Element ueber dem Canvas — Eingabefelder, die
Versionsnummer — braucht **mindestens 60 Spielpixel Abstand** zu allem
Bedienbaren. Solche Elemente kennen Phasers Zeichenreihenfolge nicht, liegen
immer obenauf und werden bei offener Systemtastatur zusaetzlich verschoben.
Zweimal hat das bereits einen Knopf unbedienbar gemacht: den Zurueck-Knopf der
Bestenliste und "CODE EINLOESEN" im Spielstand-Bildschirm.

### 8.3 Der Ursprung einer Trefferflaeche liegt bei (0,0) — auch im Container

Die teuerste Falle dieses Projekts, deshalb ausfuehrlich.

Ein `Container` zeichnet seine Kinder **um** den Mittelpunkt herum: Sie liegen
bei `-width/2` bis `+width/2`. Die naheliegende Trefferflaeche ist also

```ts
new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height); // FALSCH
```

und genau die ist falsch. Phaser normalisiert den Testpunkt vorher auf den
Ursprung (`InputManager.pointWithinInteractiveObject`):

```js
x += gameObject.displayOriginX; // beim Container immer width * 0.5
```

Der Punkt kommt also **bereits verschoben** an. Ein bei `-width/2` beginnendes
Rechteck liegt dadurch eine halbe Knopfbreite zu weit rechts.

**Der Haken:** `displayOriginX` ist `width * 0.5` — aber nur, wenn `setSize()`
gelaufen ist. Vorher ist `width` gleich 0 und der Versatz ebenfalls. Dieselbe
Rechteck-Definition ist also je nach Aufrufreihenfolge mal richtig und mal um
eine halbe Breite daneben. Genau daher kamen die wechselnden Fehlerbilder
("rechts geht nicht" / "links geht nicht").

**Deshalb wird nicht gerechnet, sondern gemessen.** `makeAlignedHitArea()` in
`ui/widgets.ts` fragt das Objekt nach seinem Ursprung und legt das Rechteck
darum:

```ts
const hitArea = makeAlignedHitArea(container, width, height);
container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
```

Das bleibt richtig, unabhaengig davon, wie Phaser intern normalisiert — heute
und nach dem naechsten Update. **Neue interaktive Container benutzen diese
Funktion**, nicht ein selbst gebautes Rechteck.

**Warum die Falle so leicht zu uebersehen ist:** Bei einem `Image` stimmen
Texturkoordinaten und `displayOrigin` ueberein — dort funktioniert die
naheliegende Rechnung. Nur beim `Container` fallen Zeichenkoordinaten
(um 0 herum) und Trefferflaechenkoordinaten (ab 0) auseinander.

**Gegenprobe bei jeder Aenderung:** `?hitboxes` an die Adresse haengen
(`src/ui/hitDebug.ts`). Das Werkzeug zeichnet jede Trefferflaeche, markiert
jeden Tipp und meldet `<<< WIDERSPRUCH`, wenn Phaser ein anderes Objekt liefert,
als die Geometrie hergibt.
