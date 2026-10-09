# Performance-Audit: iPhone 16 / Home-Bildschirm-App

Stand: 10.10.2026, isiHunt **0.1.424**, Commit `2f5dc5744309c14d253329a0efcad3fa4b219501`.

## Ergebnis und Aussagegrenze

Der Benutzer meldet Ruckeln in mehreren Bereichen und startet isiHunt als
Home-Bildschirm-App. Das Audit weist vermeidbare Arbeit beim HUD-Timer und eine
verzögerte Entlastung durch die automatische Effektabsenkung nach. Welche dieser
Stellen das Ruckeln auf seinem iPhone verursacht, bleibt ohne Messung auf diesem
Gerät offen. Der Benutzer hat die Effektstufe **„voll“** bestätigt.
Die dort installierte Version, iOS-Version und der zeitliche Beginn des
Ruckelns sind nicht verifiziert.

Es wurden keine produktiven Runtime-Dateien geändert. Der Timer-Farbcache wurde
ausschließlich als temporärer Eingriff im Messbrowser getestet.

## Messverfahren

- Chromium mit aktivem WebGL auf einer **NVIDIA GeForce RTX 5080 / ANGLE D3D11**.
  Das Playwright-Profil „iPhone 16“ emuliert Abmessungen und Eingabemerkmale;
  es emuliert weder die Apple-GPU noch iOS-WebKit oder die Gerätegeschwindigkeit.
- Browserprofil: Viewport 393 × 659 CSS-Pixel, DPR 3; intern gemessener
  Phaser-Canvas **720 × 1280**. `preserveDrawingBuffer` war ausgeschaltet.
- Zusätzliches Home-Bildschirm-Modell: Viewport auf die im Playwright-Profil
  hinterlegten 393 × 852 CSS-Pixel erweitert und `navigator.standalone` gesetzt.
  iOS-Safe-Area, Systemleisten und der echte Web-App-Prozess werden damit nicht
  nachgebildet. Der interne Canvas maß in diesem Modell **720 × 1336**, also
  **4,375 % mehr Pixel** als im Browserprofil. Das sind keine verifizierten
  Canvas-Abmessungen des Benutzergeräts.
- Render-Matrix: zehn Welten × drei Effektstufen × zwei Schiffsdarstellungen,
  jeweils fünf Sekunden nach Aufwärmen. Die 3D-Darstellung wird im Shop gemessen;
  der Gameplay-Fall verwendet die 2D-Pfeilfigur.
- Aktives Gameplay in Silberhain: vier Szenarien mit jeweils 20 Sekunden echter
  Render-Schleife; automatisierte Bewegung zu Relikten alle 100 ms. Frischer
  Gastspielstand, Level 100, keine vergebenen Talente, Ton und Haptik aus.
- Sieben Oberflächen mit jeweils fünf Sekunden Messzeit auf „voll“ und
  „sparsam“. Zehn zusätzliche Navigationszyklen mit expliziter Garbage Collection.
- Framezeiten stammen aus `game.loop.rawDelta`. Text-Neuzeichnungen und WebGL-
  Uploads wurden instrumentiert. CDP-Task-Zeiten enthalten Browser- und
  Messwerkzeugaufwand und sind keine isolierte CPU-Profiler-Auswertung.

Die Tests sind kurze Desktop-Messungen. Sie decken keine thermische Belastung,
keine vollständigen 90-Sekunden-Runs, keine Online-Duelle, keine umfangreichen
Talentkombinationen und keine Audio-/Haptiklast auf dem iPhone ab. Zufällige
Reliktspawns sind zwischen den Szenarien nicht identisch.

## Bestätigte Befunde

### 1. Timer erzeugt unnötig Texturen pro Frame

`GameScene.updateTimer()` sendet pro Frame `TimerChanged`.
`HudScene.onTimer` setzt daraufhin die Textfarbe auch dann erneut, wenn sie
gleich bleibt (`src/scenes/HudScene.ts:1208–1223`). Phasers `TextStyle.setColor`
ruft ohne Gleichheitsprüfung `updateText()` auf; dieses zeichnet den Text-Canvas
neu und lädt ihn in WebGL hoch. Das unveränderte Sekundenlabel allein würde
wegen der Prüfung in `setText()` keine solche Neuzeichnung verlangen.

Im Browserprofil wurden auf „voll“ in rund 20 Sekunden **1.226 Timer-
Neuzeichnungen** gezählt. Mit einem temporären Gleichheitscheck vor `setColor`
waren es **20**. Die gemessenen gesamten Textur-Upload-Aufrufe sanken zwischen
diesen beiden Läufen von 1.588 auf 392; Text-Rasterzeit von 176,2 auf 29,9 ms.
Das sind Upload-Aufrufe, keine Messung der übertragenen Bytes.

Der Cache-Versuch hatte dennoch einen einzelnen 100-ms-Frame. Er belegt die
vermeidbare Arbeit, aber keinen vollständigen Stutter-Fix und keinen Gewinn auf
dem echten iPhone. Ein produktiver Fix muss die rote Schlussphasenfarbe und die
weiterhin flüssige Timerleiste erhalten.

Das Standalone-Modell bestätigte den Unterschied: 1.219 Timer-Neuzeichnungen
ohne Cache und 20 mit Cache. Auf „voll“ trat dort ein einzelner 116,7-ms-Frame
auf; dessen Ursache wurde nicht isoliert. Die übrigen drei Gameplay-Szenarien
hatten in dieser Stichprobe keine Frames über 25 ms.

### 2. Automatische Effektabsenkung entlastet den aktuellen Run nicht

Der Frame-Wächter wartet drei Sekunden, prüft dann zwei aufeinanderfolgende
Fünf-Sekunden-Fenster und reagiert erst auf einen Median über 25 ms
(`src/config/effectQuality.ts`, `src/systems/FrameRateGuard.ts`). Bei dauerhaft
langsamen Frames ist das erste Auslösen somit etwa nach 13 Sekunden möglich.
Einzelne Hänger bei ansonsten flüssigem Lauf lösen die Senkung bewusst nicht aus.
Die Schwelle ist im Quelltext ausdrücklich als noch nicht am Gerät kalibriert
gekennzeichnet.

Der Laufzeittest rief `lowerAutomatically()` direkt auf: Der gespeicherte Wert
wechselte von `full` zu `medium`; lebender Nebel, Verzerrung, Farbfilter und
Beleuchtung blieben im bereits aufgebauten Game aktiv. Diese Komponenten werden
beim Szenenaufbau gewählt. Der Wächter dokumentiert ausdrücklich die Wirkung
erst in der nächsten Szene. Das ist das vorhandene Design, kein nachgewiesener
Vertragsbruch.

Für ein ruckelndes laufendes Spiel bietet dieser Mechanismus deshalb weder
sofortige Entlastung noch eine Erkennung kurzer Frame-Spitzen. Eine Änderung
muss Effektabbau, Wiederaufbau und die gewünschte Reaktion auf Spitzen ausdrücklich
definieren und testen.

### 3. Hohe Effektstufe und größere Renderfläche brauchen Geräteprüfung

Die volle Stufe enthält unter anderem einen bildfüllenden animierten
NoiseSimplex3D-Nebel, Verzerrung, Beleuchtung, Farbfilter und Kamera-Bloom.
Bloom verwendet vier Blur-Schritte auf „voll“, zwei auf „mittel“ und ist auf
„sparsam“ aus (`src/ui/GameBackdrop.ts:130`, `src/ui/postFx.ts:17`,
`src/config/postFx.ts:12`).

Im aktiven Browserprofil wurden durchschnittlich 70,0 WebGL-Draw-Aufrufe pro
Frame auf „voll“, 59,5 auf „mittel“ und 52,6 auf „sparsam“ gemessen. Diese
Zählung misst keine GPU-Zeit; unterschiedliche Spawns verhindern einen exakt
kontrollierten Vergleich.

`configureGameHeight()` hält die interne Breite bei 720 und vergrößert die Höhe
entsprechend der verfügbaren Fläche (`src/config/GameConfig.ts:63`). Daher ist
die größere Fläche der Home-Bildschirm-App für den Vollbild-Effektaufwand
relevant. Eine tatsächliche GPU-Überlastung auf dem iPhone ist ungemessen.
Die Renderauflösung sollte erst nach einer Geräte-Messung begrenzt werden;
Schärfe, Eingabekoordinaten und Layout müssen dabei erhalten bleiben.

### 4. Erfolge und Talente benötigen mehr UI-Arbeit als Settings

Gemessene CDP-Task-Zeit pro aufgezeichnetem Frame im Browserprofil:

| Oberfläche      |    Voll | Sparsam |
| --------------- | ------: | ------: |
| Menü            | 1,93 ms | 1,66 ms |
| Settings        | 0,75 ms | 0,65 ms |
| Shop, 2D-Schiff | 0,83 ms | 0,75 ms |
| Erfolge         | 4,26 ms | 3,63 ms |
| Talente         | 3,61 ms | 3,09 ms |
| Profil          | 1,64 ms | 1,66 ms |
| Sammlung        | 2,37 ms | 2,40 ms |

Alle diese Stichproben hatten einen p95 zwischen 16,7 und 16,8 ms und keine
Frames über 25 ms. Die Task-Zeit ist ein Hinweis auf unterschiedlich viel Arbeit,
kein Nachweis einer bestimmten teuren Funktion oder eines iPhone-Problems.

Als weitere Profiling-Stellen wurden die Accessibility-Geometrieprüfung pro
`POST_UPDATE` und die DOM-Stilupdates des Hangars pro Frame identifiziert
(`src/ui/SceneAccessibility.ts:49`, `src/ui/HangarView.ts:730`). Ihre Kosten
wurden nicht einzeln isoliert. Barrierefreiheit darf bei einer Optimierung
nicht entfallen; Geometrie- und Stilupdates können bei nachgewiesenen Kosten
an tatsächliche Änderungen gebunden werden.

### 5. Produktion liefert noch keine ausreichende Frame-Diagnose

Der detaillierte `PerformanceMonitor` in Game ist an `DEBUG_ENABLED`, also
`import.meta.env.DEV`, gebunden (`src/scenes/GameScene.ts:275`,
`src/config/GameConfig.ts:542`). Der Produktions-Debugbericht enthält in seinem
State-Provider keine FPS-/p95-/Hängerstatistik (`src/main.ts:186`). Vorhandene
Ressourcendiagnose liefert ausdrücklich keine Wärme-Telemetrie.

Für die Geräteprüfung werden eine leichte Frame-Messung für Gameplay und Menüs,
die aktive Effektstufe, Canvas-Abmessungen, Sichtbarkeitszustand und Version
benötigt. Sichtbare Phasen sind getrennt von App-Hintergrundphasen zu erfassen.
Debug mit erhaltenem Drawing-Buffer darf den Vergleich nicht verfälschen.

## Gegenprüfungen und offene Fragen

- Die Render-Matrix bestand **60/60** Fälle auf dem Desktop. p95: 16,7–16,8 ms;
  höchster Anteil über 25 ms: 0,337 %. Das bestätigt keine iPhone-Performance.
- Nach zehn Menüwechsel-Zyklen: durchgehend 196 Texturen, ein Canvas und
  15 Accessibility-Buttons. Die grobe Browser-Heap-Anzeige blieb bei 77,6 MiB.
  Kein Wachstum in dieser Stichprobe; längere oder andere Pfade bleiben offen.
  Im separaten Standalone-Modell blieben 193 Texturen, ein Canvas und 14 Buttons
  ebenfalls über zehn Zyklen stabil.
- Kein gemeldeter JavaScript-Seitenfehler in den abgeschlossenen Stichproben.
- `SaveSystem.load()` verwendet einen Cache. Kein nachgewiesener
  `localStorage`-Lesezugriff pro Gameplay-Frame.
- Gameplay verwendet hier keinen laufenden Three.js-Renderer. Die echte
  3D-Vorschau betrifft den Shop; „3D-Schiff“ allein erklärt keine Last in allen
  Bereichen.
- Offen: Zeitpunkt des Ruckelns, tatsächliche
  Geräte-Framezeiten, GPU-Kosten, thermische Entwicklung und Einfluss des
  realen Spielstands. Ohne diese Daten bleibt die Ursachen-Zuordnung unresolved.

## Empfohlene Reihenfolge

1. Den nachgewiesenen redundanten Timer-Farbwechsel vermeiden und mit normaler
   Farbe, Schlussphasenfarbe und flüssiger Timerleiste verifizieren.
2. Leichte Produktions-Frame-Diagnose ergänzen und auf dem betroffenen iPhone
   PWA-Messungen in Settings, Erfolge, Shop und Gameplay durchführen.
3. Anhand dieser Daten sofort wirksame Effektabsenkung und gegebenenfalls ein
   mobiles Renderbudget festlegen. Grenzwerte nicht aus Desktop-FPS ableiten.
4. UI-Geometrieprüfung, Hangar und Listen gezielt profilieren; nur gemessene
   Kosten optimieren. Danach längere Runs und Navigation am Gerät wiederholen.

Messdaten: [Browser-Runtime](audits/2026-10-10/browser-runtime.json),
[Render-Matrix](audits/2026-10-10/render-matrix.json) und
[Standalone-Modell](audits/2026-10-10/standalone-runtime.json).
Alle Angaben dort sind instrumentierte lokale Browser-Messungen, keine
Telemetrie vom Benutzergerät.
