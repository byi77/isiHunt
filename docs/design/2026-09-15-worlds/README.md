# Punkt 3: Welten, plastische Planeten und Hintergrundtiefe

Stand: 15. September 2026. Lokale Umsetzung auf Basis v0.1.316.
Punkt 2 wurde mit Commit `2350294` erfolgreich ausgeliefert; Live-Version und
GitHub-Deployment wurden vor Beginn dieser Etappe bestätigt.

## Gestaltung

Eisring war die erste Beispielwelt. Dieselbe Kugelprojektion trägt jetzt zehn
unterschiedliche Oberflächen. Die Lichtquelle bleibt links oben; Schattenseite
und Atmosphärenrand bleiben stehen, während die Oberfläche langsam rotiert.
Ringe werden in eine hintere und eine vordere Hälfte zerlegt. Beide liegen
zusammen mit Atmosphäre und Monden innerhalb des reservierten Durchmessers.

| Welt | Eigene Merkmale |
| --- | --- |
| Sternenweide | Kühlgrüne Kontinente und dunkle Wasserflächen |
| Eisring | Helle Eisstruktur, geneigter Ring mit Splittern |
| Glutnebel | Warme, gewellte Gasbänder |
| Nullsektor | Sehr dunkler Kern, schmale Risslinien und dünner Orbit |
| Sonnenkrone | Wolkige Sternoberfläche und zurückhaltende Korona |
| Mondschmiede | Kraterstruktur, Orbit und zwei kleine Monde |
| Kristallbruch | Abgestufte Facetten, anders geneigter Splitterring |
| Sturmgrenze | Verwirbelte Oberflächenbänder |
| Lichtkern | Helle, kleinteilige Konvektionsstruktur mit Korona |
| Horizonttor | Dunkle Kugel und mehrere feine Torringe |

Große Hintergrundplaneten verwenden dieselben Formen mit geringer Deckkraft
und statischer Oberfläche. Die zweite Weltenhälfte bekommt gespiegelte
Himmelskompositionen. Nebel driften langsam, entfernte Sterne langsamer als
nahe Sterne und Staub. Bei reduziertem Bewegungswunsch bleiben Sterne stehen,
statt vollständig zu verschwinden. Einsammelbare Planeten behalten ihre
hellen Leuchthöfe und Seltenheitsfarben; Spielregeln wurden nicht verändert.

## Technik und Ressourcen

- `worldVisuals.ts`: ausschließlich visuelle Profile.
- `planetSurface.ts`: deterministische Kugelprojektion und Oberflächenmuster.
- `spatialPlanet.ts`: Phaser-Ansicht, Ringhälften und Animation.
- 24 Rotationsphasen pro Welt, weich überblendet über 90 Sekunden.
- Texturen mit 128 Pixel Kugelauflösung, als 1024 × 384 Atlas angeordnet.
  Dadurch bleibt die Texturbreite auch unter einem 2048-Pixel-Limit.
- Ein animierter Atlas enthält 1,5 MiB RGBA-Pixeldaten; eine statische Kugel
  64 KiB. Alle zehn Welten zusammen maximal 15,625 MiB pro vollständiger Kopie
  der Pixeldaten. Das ist eine Rechnung, keine Heap-/GPU-Speichermessung;
  Browser und GPU können weitere Kopien und Verwaltungsdaten halten.
- Erzeugung erst bei Bedarf und Wiederverwendung innerhalb der Spielinstanz.
  Keine neuen Downloads, Abhängigkeiten oder zusätzlichen WebGL-Renderer.
- Bei reduziertem Bewegungswunsch oder gemeldeten höchstens 2 GB Gerätespeicher
  wird nur eine statische Phase erzeugt. Fehlende `deviceMemory`-Unterstützung
  wird nicht als Nachweis eines schwachen Geräts behandelt.
- Animationslistener und Nebel-Tweens werden beim Zerstören ihrer Ansicht entfernt.

## Prüfung und Nachweise

- Vollständiges `npm run verify` bestanden: 588 Tests in 41 Dateien,
  Typprüfung, Lint, Format, Projektprüfungen und Produktionsbuild. Die bekannte
  Größenwarnung für Phaser-/Three-Chunks bleibt bestehen.

- Alle zehn Welten im tatsächlichen Hauptmenü bei 390 × 844 angesehen und
  durch die Weltpfeile erreicht. PNG und gleichnamige JSON-Messung je Welt.
- Eisring zusätzlich bei 320 × 568: Canvas 301,5 × 536 wegen Ticker/FIT.
- Elf Menü-Messungen bestehen Text-/Button-/Planetengrenzenprüfung:

  ```powershell
  node docs/design/2026-09-15-worlds/check-layout.mjs
  ```

  Die Prüfung schließt den gesamten Planetendurchmesser inklusive Ring ein.
  Absichtliche Überlagerungen von Planet, Schiff und dessen Aura bleiben erlaubt.
- Neue Tests prüfen die nahtlose Rotationsperiode aller Oberflächen, Transparenz
  außerhalb der Kugel und die feste Beleuchtungsrichtung. Vorhandene zehn
  Menüabstandstests bestehen weiterhin.
- Ressourcenprüfung: von Eisring bis Horizonttor und zurück, 16 Weltwechsel.
  Die Zahl der Scene-Update-Listener blieb bei 5. Nach dem Besuch dieser neun
  Welten blieben 18 Texturen erhalten (je eine statische und eine animierte);
  auf dem Rückweg kamen keine hinzu. Siehe `resources-*.json`.
- Jagd über Weltinfo gestartet; tatsächliches Spielfeld mit HUD, Schiff und
  mehreren Sammelobjekten auf der Eisring-Kulisse angesehen.
  [Spielfeld in 320 × 568](game-eisring-320x568.png).
- Erste Laufzeit-Stichprobe aus dem vorhandenen PerformanceMonitor:
  Start 2100 ms, 583 erfasste Frames, P95 16,72 ms, Überbudget-Anteil 0,
  maximal 10 dynamische Objekte und 2 Partikelgruppen; vorhandenes Budget erfüllt.
  Siehe `performance-eisring.json`. Der vorhandene Getter speichert bei der
  ersten Abfrage einen Zwischenbericht; dies ist ausdrücklich keine Messung
  einer vollständigen 90-Sekunden-Runde oder eine Aussage über echte Mobilgeräte.

Die Weltvorschau verwendet im Entwicklungsbuild `?worldPreview=0` bis `9`.
Sie zeigt für die Navigation ein virtuelles Level 100, ohne den gespeicherten
Fortschritt zu ändern oder Welten freizuschalten. Die Bilder enthalten daher
einen Testnamen und dieses Vorschau-Level. `?layoutAudit` zeigt Geometrie,
Frames, Texturgrößen und Listenerzahlen über eine sichtbare Prüfanzeige.

Ausgewählte Bilder: [Eisring](menu-eisring-390x844.png),
[kleines Menü](menu-eisring-320x568.png), [Sonnenkrone](menu-sonnenkrone-390x844.png),
[Mondschmiede](menu-mondschmiede-390x844.png), [Horizonttor](menu-horizonttor-390x844.png).

## Grenzen und Fortsetzung

Echte Android-/iOS-Geräte, OS-Umschaltung auf reduzierte Bewegung, Geräte mit
wenig Speicher und Langzeit-/GPU-Speichermessungen bleiben offen. Keine
pauschale FPS- oder Gerätefreigabe aus Screenshots ableiten. Die automatischen
Browser-Simulationen früherer Releases ersetzen diese Prüfungen nicht.

Diese Etappe ist noch nicht committet oder gepusht. Nächster Gestaltungspunkt
ist Punkt 4: Schiffssilhouetten, Flugneigung und räumliche Aura. Die neue
Planetentechnik und die bestehenden Menüabstände dabei beibehalten.
