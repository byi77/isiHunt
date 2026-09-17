# Punkt 7: 3D-Hangar

Stand: 17. September 2026. Ausgangsversion **0.1.321**, Commit `22c2e99`.
Die Umsetzung ist lokal; keine Veröffentlichung beauftragt. Punkt 8 ist bereits
committed. Der Nutzer hat danach ausdrücklich die Fortsetzung mit Punkt 7 gewünscht.

## Ziel und Aufbau

Der bisherige Shop wird zum Hangar. Die vorhandenen neun OBJ-Schiffe schweben
über einer beleuchteten Plattform; Finger, Maus und Pfeiltasten drehen die
Vorschau. Eine Schaltfläche zentriert die Ansicht. Farben und Auren werden am
ausgewählten Schiff anprobiert. Ein Triebwerkslicht ergänzt die Darstellung.

Die Kaufregeln bleiben unverändert: Anprobieren kauft nichts. Kauf und Ausrüsten
laufen weiterhin über `ProgressionSystem`; der aktive Reiter bestimmt, welches
einzelne Objekt die Aktion betrifft. Besitzstatus, fehlende Coins und Levelhürden
bleiben sichtbar. „Anprobe“ unterscheidet die Auswahl von der getragenen Kombination.
Alle bisherigen Schiffs-, Farb- und Auraeinträge bleiben über die Auswahl erreichbar.

`HangarView.ts` und `hangar.css` stellen die native Oberfläche bereit. Texte
bestimmen ihre Höhe; der Inhalt scrollt zwischen Canvas-Kopf und festem Fußbereich.
Buttons und Auswahl bleiben mindestens 44 CSS-Pixel hoch. Die drei Kategorien
behalten ihre Anprobe, ohne Renderer oder Scene neu zu starten.

`threeDShipPreview.ts` verwendet einen optionalen Hangarmodus: schräge
orthografische Kamera, Plattform und manuelle Rotation. Der Spielmodus behält
seine Draufsicht. Three.js und OBJ-Modelle werden weiterhin erst bei Bedarf geladen.
Materialfarben werden aktualisiert, ohne in jedem Frame neue Materialien anzulegen.

## Alternativen und Ressourcen

- Für reine 2D-Schiffe werden die vorhandenen Texturen verwendet. Die neun
  OBJ-Schiffe haben passende SVG-Draufsichten für fehlendes WebGL und die
  manuelle 2D-Umschaltung. `node scripts/generate-ship-previews.mjs` erzeugt sie
  erneut; nur tatsächlich von Flächen verwendete Vertices bestimmen die Größe.
  `egoAssets.ts` verknüpft die SVGs über `previewUrl`. Keine zusätzlichen Fremdassets.
- Die Aura nutzt dieselben Zeitfunktionen und Assetframes wie das Spiel.
  Die schwarzen Hintergründe additiver Aura-Assets werden per Luminanzmaske
  ausgespart; die zuerst beobachtete deckende Farbfläche ist korrigiert.
- Reduzierte Bewegung verwendet das vorhandene Aura-Ruhebild und unterbindet
  das Schweben. Manuelles Drehen bleibt möglich.
- Phaser liefert den Takt. Versteckte Tabs und herausgescrollte Vorschauen
  pausieren die Hangar-Aktualisierung; kein zweiter Animationsloop.
- Beim Verlassen werden DOM, Observer, Input-/Resize-Listener, Masken-URLs,
  Meshes, Materialien, Renderer und der zusätzliche WebGL-Kontext freigegeben.
  Späte Modellantworten bleiben über die vorhandene Generationserkennung ungültig.

## Prüfstand

Die lokale Umsetzung und Browserprüfung sind abgeschlossen:

- Alle neun 3D-Modelle bei 390 Pixeln visuell geprüft (`orbital-1-390.png` bis
  `orbital-9-390.png`), einschließlich manueller Drehung, Gold und Pfeiltasten.
- Passende 2D-Silhouetten für Orbital-01, -06 und -09 geprüft
  (`silhouette-*-390.png`); der bereits getragene 2D-Pfeil ebenfalls geprüft.
- 320 × 640 frisch geladen, 390 × 844 und Größenwechsel auf 430 × 932 geprüft.
  Lange Prismaflut-Texte, Level-50-Sperre und fehlende Coins bleiben lesbar;
  Inhalt scrollt bei geringer Höhe absichtlich, die Aktionen bleiben fest stehen.
- Sechs gespeicherte Geometrieberichte (`initial-390.json`, `owned-2d-390.json`,
  `fallback-390.json`, `fallback-320.json`, `prisma-320.json`, `prisma-430.json`):
  keine Überschneidungen sichtbarer Texte/Bedienelemente, Buttons und Auswahl
  mindestens 44 CSS-Pixel hoch. Modelle zusätzlich anhand der Bilder kontrolliert.
- Fünf vollständige Öffnen-/Schließen-Zyklen: geöffnet jeweils ein Hangar mit
  zwei Canvas-Elementen, geschlossen kein Hangar und nur der Spiel-Canvas.
  Einzelwerte: [cycles.json](cycles.json). Das ist keine GPU-Speichermessung.
- `npm run verify`: 611 Tests in 46 Dateien bestanden, Typprüfung und Lint bestanden.
  Der SVG-Generator wurde nach der Größenkorrektur erneut ausgeführt und gelintet.
- Abschließender Produktionsbuild bestanden; die bekannte Warnung zu großen
  Three.js-/Phaser-Chunks bleibt bestehen. Alle sechs Berichte zusätzlich auf
  horizontale Überläufe geprüft: keine gefunden.

Aktuelle Bilder: [320 Pixel, gescrollt](prisma-320.png),
[430 Pixel, 3D](prisma-430.png), [2D-Alternative](fallback-390.png).
`prisma-320-resize.png` ist ein früheres Zwischenbild, kein Abnahmebild.

Offen bleiben echte Mobilgeräte, GPU-/Speicher-Langzeitmessungen und die
OS-Umschaltung auf reduzierte Bewegung. Browseremulation ersetzt diese Prüfungen nicht.
Ein Kauf mit echtem Kontoguthaben ist nicht Teil dieser lokalen Darstellungsprüfung.
Die manuelle 2D-Umschaltung wurde geprüft; ein echter WebGL-Ausfall wurde nicht
provoziert. Browsermessungen belegen keine Freigabe auf allen Mobilgeräten.

Nächster Einstieg: diesen Bericht und `docs/GRAFIK_UPDATE_PLAN.md` lesen;
offene Gerätechecks durchführen und Rückmeldungen zum Hangar einarbeiten.
Punkte 1–8 sind damit lokal umgesetzt; Commit, Push und Deployment dieser Etappe
sind noch nicht erfolgt.
