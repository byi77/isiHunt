# Grafik-Update: Punkt 5 – Spielanzeige

Stand: 16. September 2026. Lokale Umsetzung auf v0.1.319, noch nicht committed,
gepusht oder deployed. Punkt 4 ist inzwischen als `d2d0d23` committed.

## Was geändert wurde

- Drei feste Bereiche für Punkte, Restzeit und Serie/Multiplikator; Welt bzw.
  Spielername darüber, Zeitbalken darunter. Eine gemeinsame dunkle Unterlage
  schützt den Kontrast auf den unterschiedlichen Welten.
- Der Serienbonus steht klein unter dem Multiplikator. Gegnerstände stehen
  in eigenen Zeilen. Namen werden nach 14 Zeichen gekürzt; Punktestand und
  Status bleiben sichtbar. Außergewöhnlich große Zahlen passen sich ihrer Spalte an.
- Punkte und Serie erhalten kurzes Deckkraftfeedback statt größer zu werden.
  Multiplikatorhinweise sind kurz und begrenzt; beim Überholen wird die Zielzeile
  hervorgehoben. Reduzierte Bewegung unterdrückt dekorative Übergänge.
- Der Pauseknopf sowie Fortsetzen-/Verlassen-Buttons sind mindestens 44 CSS-Pixel
  hoch. Die Pauseansicht passt sich ihrer Inhaltshöhe an und wird bei einem
  Größenwechsel neu angeordnet. Sichere untere Ränder werden berücksichtigt.
- Lange Talentübersichten stehen vollständig in der Pauseansicht. Im laufenden
  Spiel bleibt ein kompakter Hinweis, damit die Jagdfläche frei bleibt.
- Netzwerk-, Duell- und Pauseregeln bleiben bestehen. Insbesondere läuft ein
  Duell während des Pausehinweises weiterhin. Spielphysik, Balancing und Saves
  wurden nicht geändert.

## Sicht- und Messprüfung

Lokaler Playtest-Modus ohne Backend, Edge mit vorgegebenen Viewportgrößen.
Die JSON-Dateien stammen aus dem sichtbaren Layoutprüfer, die PNGs sind
Browseraufnahmen. Die Vorschau `?hudPreview=duel&worldPreview=0&layoutAudit`
aktiviert nur im Entwicklungsbuild ein HUD ohne Runde oder Netzwerk.
`HUD-Testwerte` setzt neunstellige Punktzahlen, Serie 999, ×12,5, Tempobonus,
kritische Restzeit und drei Gegnerstände einschließlich langer Namen und Status.
`hudPreview=solo` bietet eine vollständige Talentliste zum Prüfen des Pausefensters.

| Prüfung | Befund |
| --- | --- |
| Alle zehn Welten, 390 × 844 | Kontrast und Hierarchie visuell geprüft; Bilder `world-0` bis `world-9` |
| Duellbelastung, 320 × 568 | Zahlen und Gegnerzeilen passen; Pausefläche 44 × 44 CSS-px |
| Solo-/Duell-Pause, 320 × 568 | Keine Konflikte zwischen Inhalt und Buttons; beide Dialogbuttons 44 CSS-px hoch |
| Größenwechsel 430 × 932 → 320 × 568 → 390 × 844 | Angezeigte Werte bleiben erhalten; finale Messungen unter `duel-final-*` |
| Echte lokale Jagd, 390 × 844 | Countdown, laufendes HUD, Unterbrechungsdialog und Fortsetzen geprüft; `live-pause-*` und `live-resumed-*` |

**Während der Prüfung korrigiert:** In den ersten Weltmessungen überlappen die
Rechtecke von Multiplikator und Tempohinweis um 0,54 CSS-Pixel. Der Hinweis
wurde um 3 Pixel, der Zeitbalken und nachfolgende Zeilen um 4 Pixel nach unten
versetzt. `world-checks.json` hält den ursprünglichen Fund fest; die finalen
Messungen belegen die Korrektur. Die zehn Weltbilder dokumentieren den
Kontrastvergleich vor dieser kleinen Abstandskorrektur, nicht die finale Geometrie.
`final-checks.json`: keine Textrechtecküberschneidungen in den drei finalen
Messungen, Pausehöhe jeweils 44 CSS-Pixel (numerische Rundung unter 0,001 Pixel).

Bei Größenwechseln behält Phaser seine interne Höhe; dadurch kann FIT seitliche
Ränder erzeugen. Deshalb immer die tatsächliche Canvasgröße in der JSON-Datei
beachten, nicht allein die nominelle Viewportbreite. Textüberschneidungen werden
an gerenderten Rechtecken geprüft; absichtlich verdeckte Hintergrundtexte unter
einem Modal sind keine Dialogüberschneidung.

## Technische Prüfung und Grenzen

`npm run verify` nach der Abstandskorrektur erfolgreich: **603 Tests in 43 Dateien**,
TypeScript, ESLint, Prettier, Balance-Inventur/-SQL, Scene-Guards, Save-Version
und Produktionsbuild. Vier neue Layouttests prüfen getrennte Spalten,
Mindesttouchgröße und sichere untere Ränder. Die Dev-Vorschau ist nicht im
Produktionsbundle enthalten. Bestehende jsdom-Canvas- und Vite-Chunkhinweise bleiben.
Die Browserkonsole der abschließenden lokalen Jagd enthält keine Fehler.
Beim Browserwechsel wurde die Jagd automatisch unterbrochen; der entsprechende
Dialog war lesbar und ließ sich über WEITER schließen, ohne die Runde zurückzusetzen.

Echte Mobilgeräte, OS-Umschaltung auf reduzierte Bewegung, Live-Netzwerkduelle
und eine vollständige 90-Sekunden-Runde unter realer Last sind noch separat zu prüfen.
Der Vier-Spieler-Nachweis hier ist eine Darstellungsprüfung mit Testdaten.

## Wiedereinstieg

Nächster Gestaltungspunkt: **Punkt 6, Sammel-Effekte**. Dazu diese HUD-Grenzen
beibehalten und neue Effekte auf unerwünschtes Überdecken prüfen. Offene
Gerätetests nicht mit einer bereits erfolgten Gerätefreigabe verwechseln.
