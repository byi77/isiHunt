# Punkt 8: Ergebnisse und Belohnungen

Stand: 17. September 2026. Ausgangsversion **0.1.320**, Commit `953ae9e`.
Diese Etappe ist lokal umgesetzt; noch nicht committed, gepusht oder deployed.
Punkt 7 (3D-Hangar) bleibt offen. Der Nutzer hat ausdrücklich Punkt 8 vorgezogen.

## Ziel und vorherige Probleme

Das Rundenende soll Punkte, XP, Coins und Fortschritt sofort verständlich zeigen.
Rekorde, Levelaufstiege und Freischaltungen sollen auffallen, ohne den nächsten
Start zu verzögern. Der vorherige Bildschirm kürzte Freischaltungen auf drei
beziehungsweise vier Zeilen und platzierte Ausbeute und Aktionen unabhängig
voneinander. Dadurch konnten zusätzliche Belohnungen verschwinden und lange
Inhalte in die unteren Buttons laufen.

## Umsetzung

- Gemeinsame `ResultView` für Solo, Tageslauf, lokale/Bot-Duelle und abgeschlossene
  Online-Duelle. Große Punktzahl im Solo/Tageslauf; Duell mit Siegerhinweis und
  klar zugeordneten Spielerständen.
- Fester Kopf und feste untere Aktionen; gemessene Kartenhöhen statt fester
  Textzeilenpositionen. Der Detailbereich hat eine rechteckige Maske und lässt
  sich per Wischen oder Mausrad scrollen. Ein Hinweis zeigt weitere Details an.
- Schriftgrößen und mindestens 44 Pixel hohe Trefferflächen beziehen sich auf
  CSS-Pixel. Größenwechsel bauen nur die Ansicht neu auf, nicht den Spielstand.
- XP, gesamte Coin-Gutschrift und Kontostand stehen zusammen. Level- und
  Erfolgs-Coins sind ausdrücklich als bereits enthalten gekennzeichnet.
- Jede neue Welt, Shop-Optik und jeder Erfolg erhält eine eigene Karte.
  Shop-Optiken werden als kaufbar, nicht als bereits gekauft bezeichnet.
- Rekordhinweis, Levelaufstieg, Talentpunkte, nächstes Ziel und alle sechs
  Seltenheitszähler bleiben verfügbar. Keine Kürzung der Belohnungsliste.
- 220 ms Einblendung über Deckkraft; keine skalierenden Texte, keine Wartezeit
  auf Zählanimationen. Bei reduzierter Bewegung entfällt diese Einblendung.
- Bestehende Vergabe, Cloud-Synchronisierung und Navigation bleiben in den
  Scenes. Nur lokal verbuchte Bot-Prämien tragen weiterhin ihren Hinweis.
  Während des Online-Verlassens bleiben Rückmeldung und gesperrte Aktionen sichtbar.
  Online-Rematch bleibt auf zwei Spieler begrenzt; größere Duelle benötigen
  weiterhin eine neue Lobby. Die Online-Wartephase wurde nicht umgebaut.

`ResultView` entfernt Input-/Resize-Listener und Masken beim Verlassen. Bei einem
Online-Rematch wird die Ansicht zusätzlich vor der Talentphase zerstört.
`resultContent.ts` bereitet bereits verbuchte Daten ohne Mutation auf.

## Prüfungen und Belege

`npm run verify` bestanden: **611 Tests in 46 Dateien**, Typprüfung, Lint,
Formatierung, Balance-/Scene-/Save-Prüfungen und Produktionsbuild.
Die bekannten jsdom-Canvas- und Vite-Chunkgrößenhinweise bleiben bestehen.

Zwei neue Tests prüfen vollständige Mehrfachbelohnungen ohne Mutation sowie
Spielerzuordnung, Tagesbonus und den Hinweis bei lokalen Bot-Prämien. Mit
absichtlich auf vier Karten gekürzter Liste wurde der erste Test rot; nach
Wiederherstellung der vollständigen Liste bestanden beide Tests.

| Fall | Format | Beleg |
| --- | --- | --- |
| Normaler Run | 320 × 568 | [Bild](normal-320.png), [Messung](normal-320.json) |
| Rekord | 390 × 844 | [Bild](record-390.png), [Messung](record-390.json) |
| Levelaufstieg | 430 × 932 | [Bild](level-430.png), [Messung](level-430.json) |
| Viele gleichzeitige Belohnungen | 320 × 568 | [Bild](multiple-320-top.png), [Messung](multiple-320-top.json) |
| Belohnungsliste nach Wischen | 390 × 844 | [Mitte](multiple-390-middle.json), [Ende](multiple-390-bottom.png), [Messung](multiple-390-bottom.json) |
| Vier Spieler und lange Namen | 390 × 844 | [Bild](duel-390-top.png), [Messung](duel-390-top.json) |
| Nur lokale Bot-Prämie | 320 × 568 | [Bild](bot-320.png), [Messung](bot-320.json) |
| Tageslauf | 430 × 932 | [Bild](daily-430.png), [Messung](daily-430.json) |
| Größenwechsel ohne Neuladen | 430 → 320 Pixel | [Messung](daily-resize-320.json) |

Die Vorschauen verwenden den produktiven Inhaltsaufbau und dieselbe View, aber
keine Fortschrittsvergabe oder Netzwerkzugriffe. Aufruf im Entwicklungsbuild:
`?resultPreview=normal|record|level|multiple|duel|bot|daily&layoutAudit`.
Die Beispiele sind Testdaten, keine tatsächlich erspielten Belohnungen.

Die Rechtecke stammen aus dem Renderer. `layoutAudit` berücksichtigt deklarierte
rechteckige Masken bei Textmessungen. `python docs/design/2026-09-17-results/analyze.py`
prüft sichtbare Textpaare, fremde Texte gegen Buttons, Buttonpaare,
Canvas-Seitenränder und Mindesthöhen mit 0,5 Pixel Kollisions-Toleranz.
Ergebnis: [geometry-summary.json](geometry-summary.json).
Zwölf gespeicherte Messungen ohne gemeldete Kollisionen; kleinste gemessene
Aktionshöhe 44 CSS-Pixel.
Dekorative Hintergrundplaneten und Lichtflächen sind bewusst ausgenommen;
sichtbare Kartengrenzen und Clipping wurden zusätzlich anhand der Bilder geprüft.

Ein früher Mausrad-Aufruf meldete einen Werkzeug-Timeout; seine Messung liegt als
`multiple-320-after-interrupted-scroll.json` bei. Er ist kein Nachweis für das
Listenende. Das Ende wurde später durch echte Wischgesten bei 390 Pixeln erreicht.
Die dortige Endmarkierung und sämtliche Ausbeutezeilen sind dokumentiert.

## Noch offen und nächster Einstieg

- Produktive Solo-Navigation: Menü → Weltinfo → GameScene → ResultScene über
  die vorhandene Debugtaste J geprüft. „Nochmal“ führt zurück zu GameScene/Hud.
  [Ergebnisbild](actual-result-320.png), [Messung](actual-result-320.json).
  Der Lauf wurde abgekürzt; kein Nachweis für eine vollständige 90-Sekunden-Runde.
  Der Countdown läuft unter Browserautomation verzögert. Die Menüaktion wurde
  separat aus der Vorschau ausgeführt; Rückkehr ins Menü bestätigt.
  Im abschließenden Browserprotokoll keine Fehler.
- Keine Freigabe für echte iOS-/Android-Geräte, schwache GPUs, OS-Umschaltung
  auf reduzierte Bewegung oder Langzeitstabilität.
- Kein Live-Netzwerkduell mit mehreren Geräten; die neue Ergebnisansicht ist
  anhand der gemeinsamen Darstellung geprüft, nicht anhand eines Servermatches.
- Der nächste ausstehende Grafikpunkt ist **Punkt 7: 3D-Hangar**. Nicht automatisch
  anfangen: zuerst den aktuellen Ergebnisstand auf Wunsch ansehen oder ausliefern.

Weiterarbeiten: diesen Bericht und `docs/GRAFIK_UPDATE_PLAN.md` lesen. Die
Ergebnisansicht nicht erneut aufbauen; offene Geräte-/Netzwerkprüfungen gezielt
nachholen. Bei weiteren Änderungen Bericht und Plan gemeinsam aktualisieren.
