# Grafik-Update: Punkt 2, Hauptmenü und gemeinsamer UI-Stil

Stand: 15. September 2026. Umsetzung auf Basis v0.1.315;
Commit, Push und Deployment anschließend vom Nutzer beauftragt. Die Aufnahmen
zeigen den Entwicklungsstand vor dem Versionssprung des Commit-Hooks.
Auslieferung bestätigt: Commit `2350294`, v0.1.316 live und GitHub-Deployment erfolgreich.

## Was umgesetzt wurde

Das Hauptmenü übernimmt die Entwurfsrichtung vom 14. September: ruhiger
Hintergrund, kompakter Profilblock, große vorhandene Planetentextur,
ausgerüstete Schiffsform und eine goldene Hauptaktion. Die weiteren Einstiege
bleiben in drei klaren Buttonreihen erreichbar. Es handelt sich um Punkt 2;
neue räumliche Welten und der 3D-Hangar folgen in ihren eigenen Etappen.

`MenuView` enthält die Darstellung. Navigation, Synchronisierung und Speicherung
bleiben in `MenuScene`. Das Layout rechnet zuerst mit tatsächlichen CSS-Pixeln:
mindestens 44 Pixel hohe Menübuttons, kleinere Kulisse auf kurzen Displays,
Platz für sicheren unteren Rand und iOS-Installationshinweis. Ein Updatehinweis
ersetzt den Kopfbereich. Lange Namen werden gekürzt; das Level hat einen eigenen
festen Bereich. Reduzierte Bewegung stoppt die Schiffsbewegung und Auraanimation.

Gemeinsame Buttons verwenden deckende dunkle Flächen, klare Konturen und einen
leichten Druckzustand. Die Trefferfläche bleibt beim Drücken unverändert.
Panels und Texteingaben verwenden die gemeinsame Palette.

## Beim Prüfen gefundene und korrigierte Probleme

- Unterste Menüreihe zu nah an der Versionsnummer: mehr Abstand zum unteren Rand.
- Möglicher Konflikt zwischen Aura und Welttitel im kleinen Layout: maximale
  Ausdehnung bei der Schiffshöhe berücksichtigt; durch einen Layouttest entdeckt.
- Eingabehinweis im Profil wurde vom Namensfeld verdeckt: beide Beschriftungen
  nach oben versetzt. In der 430er-Messung bleiben rund 6,6 CSS-Pixel zum Feld.
- Lange Profilnamen konnten das Level verdrängen: getrennte Textbereiche.
- Talentbeschreibungen überlappten mit Bonus/Rangmarkierungen. Beschreibung und
  Ausbau haben getrennte Spalten; Karten sind höher, Rangmarkierungen liegen
  unter dem Bonus, Kaufbuttons bleiben innerhalb der Karte. Die vorhandene
  Scrollfunktion macht die unteren Karten und die Reset-Zeile erreichbar.
- Beim Scrollen rutschten Karten hinter die feste Talentüberschrift. Eine
  Maske begrenzt jetzt die sichtbare Liste; außerhalb der Liste liegende
  Button-Trefferflächen sind ebenfalls gesperrt.

## Durchgeführte Prüfung

- `npm run verify`: 586 Tests in 40 Dateien sowie Typprüfung, Lint,
  Formatprüfung, Balance-/Scene-/Spielstandprüfungen und Produktionsbuild bestanden.
- Zehn Layouttests: fünf Canvasgrößen von 301,5 × 536 bis 560 × 996,
  jeweils mit und ohne Installationshinweis und mit 20 Pixel unterem Sicherheitsabstand.
- Browseraufnahmen des Hauptmenüs bei 320 × 568, 390 × 844 und 430 × 932.
  Die gleichnamigen JSON-Dateien enthalten tatsächliche Renderer-Messungen;
  Canvasgröße und Browsergröße unterscheiden sich durch Ticker und FIT-Skalierung.
- Langer Testname mit 16 W-Zeichen über das lokale Profil eingegeben und gespeichert.
  Im finalen 320er-Menü wird er als `WWWWWWWW…` dargestellt; `Level 1` bleibt sichtbar.
- Profil, Shop samt vorhandener Modellvorschau, Talente inklusive Scrollen,
  Einstellungen, Erfolge, Jagd-/Tageslauf-Weltinfo und Duell-Einstieg angesehen.
  Rückwege von Shop, Talenten, Einstellungen, Erfolgen und Weltinfo sowie
  Abbrechen aus dem Duell führen zurück ins Menü.
- Backend im lokalen Playtest deaktiviert: Rangliste deaktiviert dargestellt;
  keine echten Einladungen, Käufe oder Cloud-Änderungen im Rahmen dieser Prüfung.

Die Menü-Rechtecke lassen sich reproduzierbar auswerten:

```powershell
node docs/design/2026-09-15/check-layout.mjs
```

Die Auswertung prüft Text/Text, Button/Button, Text/fremder Button,
Schiff/Halo gegen Menütexte und Buttons, Canvasgrenzen und 44-Pixel-Touchflächen.
Eine Toleranz von 0,5 CSS-Pixel berücksichtigt Rundungen. Absichtliche
Überlagerungen von Planet, Hintergrund, Schiff und Leuchteffekt werden nicht
als Fehler gewertet. Dynamische Auraausdehnung wird zusätzlich im Layouttest
abgesichert. Das ist eine Geometrieprüfung, kein vollständiger Bildvergleich.

## Messwerkzeug und Nachweise

Im Entwicklungsbuild `?layoutAudit` öffnen, „Layoutprüfung“ aufklappen und
„Neu messen“ drücken. Die angezeigten Rechtecke stammen aus Phaser und werden
mit der Kameramatrix in CSS-Pixel umgerechnet. Für Screenshots die Anzeige
zuklappen; ihre kleine Beschriftung oben rechts ist nur das Prüfwerkzeug.
Es wird im Produktionsbuild nicht geladen.

Der Inspector liefert Objektgrenzen vor dem Abschneiden durch Scrollmasken.
Deshalb wird seine automatische Überschneidungsauswertung auf das unmaskierte
Hauptmenü angewandt; die gescrollte Talentliste wurde anhand der Screenshots geprüft.

Wichtige Aufnahmen:

- [Hauptmenü, final 430 × 932](menu-final-430x932.png)
- [Hauptmenü, langer Name](menu-long-name-430x932.png)
- [Kompaktes Hauptmenü, final mit langem Namen](menu-final-320x568.png)
- [Profil](profile-430x932.png)
- [Shop und Modellvorschau](shop-430x932.png)
- [Talentkarten](talents-430x932.png), [nach Scrollen](talents-scrolled-430x932.png)
- [Einstellungen](settings-430x932.png), [Erfolge](achievements-430x932.png)
- [Jagd-Weltinfo](hunt-info-430x932.png), [Tageslauf-Weltinfo](daily-info-430x932.png)
- [Duell-Einstieg](duel-430x932.png)

## Grenzen und nächste Etappe

Echte iOS-/Android-Geräte, Safe-Area-Verhalten mit Browserleisten und Tastatur,
Live-Login-/Sync-Dialoge, alle freigeschalteten Welten und Laufzeit-/Speicherwerte
sind noch offen. Unterseiten übernehmen den gemeinsamen Stil, haben aber noch
ihre bisherigen Schrift- und Touchgrößen; die 44-CSS-Pixel-Zusage gilt hier für
das neue Hauptmenü. Scrollinhalte außerhalb des sichtbaren Bereichs sind keine
Freigabe für sämtliche Zustände. Die Buildwarnung für große Phaser-/Three-Chunks
bleibt bestehen. Keine neue 3D-Engine oder Abhängigkeit hinzugefügt.

Punkt 3 setzt bei Welten und räumlichen Planeten fort. Den Gesamtplan in
`docs/GRAFIK_UPDATE_PLAN.md` während der weiteren Arbeit weiter aktualisieren;
die Geräte- und Laufzeitprüfungen bleiben ausdrücklich offen.
