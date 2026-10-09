# Nacharbeit zum sechsfachen Audit vom 09.10.2026

Der Auftrag umfasst Performance, Logik, Codeaufteilung, Layout und Bedienung sowie Versionierung, Dokumentation und Auslieferung. isiHunt ist eine Browseranwendung: Die Release-Version steht in package.json; eine Addon-TOC existiert hier nicht. Der bestehende Pre-Commit-Hook erhoeht die Patch-Version.

## Befunde und Nachweise

| Prio | Befund | Umsetzung / Regression |
| --- | --- | --- |
| P1 | Doppelter Start verbraucht Effektrechte mehrfach | Synchroner Start-Lock; kontogebundene persistierte Request-ID, einzelne Anfrage je Konto/Welt und bestaetigte Effekte bis zum Laufstart. RunStartSystem-, RewardEffectRunSession- und RewardEffectRunCloud-Tests. |
| P1 | Offline-Lauf nach 64 Eintraegen verworfen | Keine feste Anzahlgrenze. Speicherfehler bleiben als sichtbarer Sitzungspuffer erhalten, werden erneut gespeichert und warnen beim Verlassen. ProgressSyncSystem-Tests mit 65 Runs und Quota-Erholung. |
| P1 | Sehr kleine UI-Texte | Responsive DOM-Einstellungen und neu angeordnete CSS-basierte Talentkarten. Accessibility-Check prueft mindestens 12-Pixel-Beschreibungen und 44-Pixel-Ziele auf vier Bildschirmformaten. |
| P1 | Frame-Glaettung versteckt niedrige Bildrate | Raw-Delta fuer Messung/Herabstufung, Phaser-Delta fuer Simulation; verdeckte Tabs ausgeschlossen. FrameRateGuard-Regression prueft dauerhafte 300-ms-Frames. |
| P2 | Abgelaufene Relikte noch fangbar | RunUpdateSystem entscheidet Ablauf nach tick und vor Kollision; Grenzfall ist deterministisch getestet. |
| P2 | Leere Messungen bestehen | PerformanceSystem akzeptiert nur endliche positive Samples; keine Samples bedeutet nicht bestanden. |
| P2 | Menu laeuft neben Game im Browsercheck | Wechsel ueber vorherige Hauptszene bzw. explizites Stoppen aller alten Szenen; aktive Szenen werden geprueft. |
| P2 | Diagnose-JSON durch Abschneiden ungueltig | BoundedJsonSystem behaelt ganze Eintraege innerhalb des Zeichenlimits; eigene Tests und ProgressSyncSystem-Regression. |
| P2 | Node 26 ueberschattet jsdom-Speicher | Standard-Runner deaktiviert Node-Webstorage auch fuer Worker. Keine manuelle Umgebungsvariable erforderlich. |
| P2 | Nur eine Welt/sparsame Grafik gemessen | performance:matrix mit zehn Welten, drei Stufen und 2D-Jagd/3D-Hangar. Realtime-Einzelcheck verwendet volle Effekte. |
| P2 | Canvas ohne semantische Tastaturknoepfe | Native Buttons mit Namen, Enter/Space und Fokusrahmen; gesperrte, ausgeblendete, abgeschnittene und von Vollbild-Overlays verdeckte Ziele deaktiviert. PageUp/PageDown scrollen. |
| P3 | Materialtraversierung je Frame | Tint/Alpha nur bei Aenderung, wiederverwendete Kantenfarbe, Cache beim Modellwechsel ungueltig. Matrix prueft geladene Hangarmodelle. |
| P3 | Gemischte grosse Module | Gemeinsamer BackendTransport; separate Startkoordination, Effektsitzung, Relikt-Update und JSON-Grenzen. Bestehende Cloud-/Duelltests bleiben erhalten. |

## Reproduzierbare Pruefungen und Grenzen

- npm run verify: Typecheck, Lint, Format, Balance-/Scene-/Save-Gates, deterministische Tests, Produktionsbuild.
- npm run accessibility:check: 320x568, 360x640, 390x844, 768x1024; Schrift, Ziele, Enter/Space, Scrollen, DOM-Aufraeumen und Screenshots.
- npm run playtest -- --quality=reduced: alle Browser-Suiten ohne Simulation, mit ausdruecklich sparsamer Grafik fuer den Software-WebGL-Rechner. Ohne quality-Argument bleibt die volle Stufe Standard.
- npm run performance:matrix: echte Render-Loops, drei Sekunden Messzeit je Kombination nach einer Sekunde Aufwaermen; Budgetabweichungen bleiben sichtbar. --enforce macht Budgetabweichungen zusaetzlich zum fehlerhaften Exit-Code. Ausfuehrungsfehler oder leere Samples sind immer Fehler.
- npm run release:check: bestehende Auslieferungsgates; die simulierte Performance-Pruefung ist ein Integrations-Gate und keine reale Bildratenabnahme.
- npm run readability:check -- --headless --gpu: gesaete Kontrastmessung gegen die unveraenderte Basis. Readability-, Weltbalance- und Playtest-Simulationen setzen Raw-Delta nur fuer die Simulationsdauer und stellen es danach wieder her; alte Hauptszenen werden vor direkten Starts beendet. Der optionale GPU-Modus ist auch fuer performance:matrix verfuegbar; der tatsaechliche Renderer wird protokolliert.

Die Matrix misst 2D-Jagd und echte 3D-Hangarvorschau getrennt. Im Run verwendet das Projekt auch fuer 3D-Schiffe absichtlich eine transparente 2D-Textur. Deshalb prueft die 3D-Messung das vorhandene geladene Modell im Hangar.

Browseremulation auf Software-WebGL ist keine Freigabe fuer reale Handy-Bildraten, Energieverbrauch, Temperatur oder mobile Netzwechsel. Diese Abnahme bleibt in ROADMAP offen. Keine Backend-Migration oder produktive Testbuchung ist Teil dieser Aenderung.

Die Matrix bewertet Render-Budgets und kennzeichnet startupMeasured=false. Die separate Startzeitpruefung bleibt beim vorhandenen Performance-Einzelcheck.

## Verifizierter Browserlauf

Der vollstaendige Playtest ohne Simulation und mit expliziter Stufe reduced hat 90 von 90 Schritten bestanden, einschliesslich WebKit, Fortschritt/Persistenz, drei Solo-Welten, Tageslauf und Bot-Duell. Die Fokus-Geometrie bekommt einen separaten Kamerascroll-Regressionscheck (zuerst rot nachgewiesen); der Tastaturtest prueft auch einen echten Talentkauf.

## Render-Matrix am Entwicklungsrechner

Alle 60 Kombinationen haben gueltige Frame-Samples geliefert; jede 3D-Zeile hat ein tatsaechlich geladenes Modell geprueft. Der beobachtete Renderer ist ANGLE/Vulkan mit SwiftShader Device (Subzero), also Software-WebGL. Die Budgetbewertung ist fuer alle 60 Zeilen rot und wird nicht als bestandene Bildratenabnahme ausgegeben. Gemessen wurde mit drei Sekunden je Zeile; fuer laengere Messungen ist --sample-ms=30000 verfuegbar. Der JSON-Bericht liegt lokal ausserhalb des Release-Pakets.

Der erweiterte Accessibility-Check besteht auf allen vier Bildschirmformaten, einschliesslich Talentkauf und Kamerascroll-Fokus. Beschaedigte persistierte Effektstarts werden separat auf UUID-Form und nichtleere gueltige Effektrecords geprueft; unbekannte Daten fuehren zu keinem Netzaufruf.

Ein angemeldeter Start mit unbekannter Effektantwort bleibt bis zur Bestaetigung gesperrt. Das verhindert still verlorene oder mehrfach verwendete Effektrechte; der Spieler bekommt einen sichtbaren Fehler und kann denselben Start wiederholen. Der vorhandene lokale Fortschritt und seine Outbox werden dabei nicht verworfen.

Die Kontrastpruefung besteht fuer alle zehn Welten gegen die unveraenderte Basis; beobachteter Renderer: ANGLE mit NVIDIA GeForce RTX 5080 ueber Direct3D11. Der separate Simulationslauf besteht fuer fuenf Spielmodi; ein gezielter Weltbalance-Lauf liefert ein vollstaendiges Rundenergebnis. Die deterministische Pruefkette besteht mit 766 Tests in 70 Dateien.

Eine zweite Render-Matrix mit --gpu auf derselben RTX 5080 besteht fuer alle 60 Kombinationen auch die Frame-Budgets (p95 rund 16,7 bis 16,8 ms). Software- und Hardwareberichte bleiben getrennt; die Desktop-GPU-Messung gibt keine Aussage ueber reale Mobilgeraete. Beide lokalen JSON-Berichte bleiben ausserhalb des Release-Pakets.
