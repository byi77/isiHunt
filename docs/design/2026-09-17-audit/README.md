# Technische Abschlussprüfung des Grafik-Updates

Stand: 17. September 2026. Geprüfter Code: `b821357`, Version **0.1.322**.
Diese Nachprüfung ändert zunächst nur die Dokumentation, keine Spielregeln.

## Bestätigte Ergebnisse

- `npm run verify` erfolgreich: Typprüfung, Lint, Format, Balance-/Scene-/Save-Gates,
  611 Tests in 46 Dateien und Produktionsbuild. Vollständige Ausgabe: `verify.log`.
- `npm run deploy:check` erfolgreich: Live-Version und lokale Version **0.1.322**,
  ausgeliefertes Hauptbundle `index-BdM2PT0L.js`. Kein neuer Deploy ausgelöst.
- `npm run sql:check` erfolgreich: 23 transaktionale Integrity-Migrationen geprüft.
- `npm run ios:check` erfolgreich: konservative Bundle-Untergrenze **iOS 16.4**.
  Das ist eine statische Prüfung, kein Test auf einem iPhone oder in Safari.
- Vorhandene Progressionstests prüfen Kauf, Coin-Abbuchung, sofortiges Ausrüsten,
  unzureichendes Guthaben, doppelte Käufe, Besitzprüfung und kostenlosen Wechsel.
  Der komplette Kaufweg im neuen Hangar mit Guthaben bleibt separat offen.
- Die sechs Hangar-Geometrieberichte und fünf Öffnen-/Schließen-Zyklen der
  vorigen Etappe bleiben gültige Einzelprüfungen; siehe
  [Hangarbericht](../2026-09-17-hangar/README.md).

## Zusätzlicher Browserlauf und Messgrenze

Im lokalen Playtest-Modus ohne Backend wurde bei 390 × 844 über Hauptmenü und
Weltinfo eine Solo-Runde gestartet. Spiel und HUD erschienen; die abgefragten
Browserfehler waren leer (`browser-errors.json`). Die sichtbare Diagnoseausgabe
liegt in `runtime-sample.json`.

### Zusammenhang mit dem Deploy-Gate von v0.1.317

Dasselbe Symptom hat am 15. September den Deploy von v0.1.317 zum Scheitern
gebracht: `performance:check` brach mit `page.waitForFunction: Timeout 25000ms
exceeded` ab (`scripts/performance-check.mjs:128`, Warten auf
`phase === 'running'`). Ein unveränderter Wiederholungslauf war grün, der Fehler
ist also kein Codefehler, sondern ein Zeitproblem. Unbehoben ist er trotzdem.

Zwei lokale Messungen vom 15. September ordnen ihn ein: `startupMs` lag bei
14.215 ms auf v0.1.317 und bei 14.450 ms auf v0.1.316 — die Planeten aus Punkt 3
sind also **nicht** die Ursache; die lange Startzeit ist älter. Das Budget in
`PerformanceSystem.ts` steht auf 30.000 ms, das Playwright-Zeitlimit im Prüfskript
dagegen auf 25.000 ms. Das Skript kann damit abbrechen, bevor das Budget, das es
prüfen soll, überhaupt bewertet wird.

Unerklärt bleibt die Spanne selbst: Der Countdown dauert laut
`GameConfig.ts` 3 × 700 ms, gemessen werden rund 14 Sekunden zwischen
`reset()` und Run-Start. Wo die übrigen rund 12 Sekunden liegen, ist nicht
eingegrenzt.

Der Befund dieser Nachprüfung — stehender Countdown, leeres `performance`-Feld
bei registrierten Update-Listenern (je vier in Game und Hud, siehe
`runtime-sample.json`) — ist mit dem Gate-Abbruch gut vereinbar, beweist den
Zusammenhang aber nicht.

Der Lauf ist **keine abgeschlossene 90-Sekunden-Prüfung**: Zwischen den Aktionen
blieb die Countdownanzeige über mehrere Abfragen nahezu stehen. Der gesicherte
Bericht enthält Game/Hud, Countdown 1, 90 Sekunden Restzeit und noch keine
Performancewerte. Die Ursache wurde nicht abschließend eingegrenzt. Deshalb
werden weder FPS noch Speicherbaseline oder ein erfolgreicher Ergebnisübergang
aus diesem Versuch behauptet. Die Prüfsitzung wurde beendet und die temporäre
Browsergröße zurückgesetzt. Die Laufzeitprüfung braucht eine durchgehend aktive
Sitzung; die frühere kurze Stichprobe bleibt ebenfalls nur eine Stichprobe.

## Offene Abnahme

- Echte iOS-/Android-Geräte: Touch, Browserleisten, Safe Areas, Tastatur und Hitze.
- OS-Umschaltung auf reduzierte Bewegung; kein entsprechender Schalter in der
  verfügbaren Browser-Prüfoberfläche. Die implementierte Alternative ist noch
  nicht auf Betriebssystemebene abgenommen.
- Provozierter WebGL-Kontextverlust und automatischer Fallback. Die manuelle
  2D-Umschaltung ersetzt diesen Test nicht.
- Durchgängige Laufzeit- und GPU-/Speicher-Langzeitmessungen auf Zielgeräten.
- Vollständiger Kauf-/Ausrüstweg mit Testguthaben sowie Live-Netzwerkduelle mit
  mehreren Clients. Systemtests ersetzen diese Integrationsprüfungen nicht.
- Bekannt: große Phaser-/Three.js-Chunks erzeugen weiterhin eine Buildwarnung.

Die Häkchen für Gestaltungsschritte 1–3 wurden anhand der vorhandenen
Umsetzungsberichte und Commits aktualisiert. Die separate Abschlussabnahme bleibt
offen; „umgesetzt“ bedeutet keine pauschale Geräte- oder Performancefreigabe.
