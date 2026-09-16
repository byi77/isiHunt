# Grafik-Update: Punkt 4 – Schiffe, Flugbewegung und Aura

Stand: 16. September 2026, lokale Umsetzung auf v0.1.318.
Noch nicht committed, gepusht oder deployed.

## Umsetzung

- Die ersten 13 Raumjäger behalten ihre individuellen Umrisse und stabilen IDs.
  Cockpits und Innenflächen sind durch neutrale, weiterhin einfärbbare Schatten
  besser erkennbar. Pfeil erhält zusätzlich Flügelpaneele und Triebwerksfassungen.
  Figuren-, Tier- und Fantasieformen behalten ihre bestehende Identität.
- Seitliche Neigung ist auf 0,32 rad begrenzt. Beschleunigen und Bremsen erzeugen
  einen geglätteten Impuls bis ±0,18: Stauchung/Streckung in 2D, echtes Kippen in 3D.
  Die Glättung ist zeitbasiert und bei 30/60/120 Hz getestet.
- Partikel entstehen am transformierten Heck und bleiben im Weltkoordinatensystem.
  An einer blockierenden Spielfeldkante wird ohne tatsächliche Bewegung nicht emittiert.
  Die bestehende Serienlinie bleibt als eigene Spielrückmeldung erhalten.
- Ausgerüstete Auren erhalten einen schwachen hinteren und helleren vorderen
  elliptischen Bogen. Menü, Shop und Spiel nutzen dieselbe 2D-Darstellung.
  Bei echten 3D-Modellen übernimmt ein Ring mit Tiefentest die Verdeckung.
- 3D-Modelle drehen um einen zentrierten Pivot. Im Spiel ersetzt die Flugpose die
  automatische Shopdrehung. Reduzierte Bewegung hält Pose und Overlay-Frames an.
- Die Shop-Anprobe bleibt beim Reiterwechsel erhalten, sodass sich Formen,
  Farben und Auren gemeinsam prüfen lassen, ohne sie zu kaufen oder auszurüsten.

Position, Steuerung, Serienbeweglichkeit (`cc1c6dc`), Sammelradius, Preise,
Kosmetik-IDs und Spielstandformat wurden nicht geändert. Der Sammelkreis wird
nicht geneigt oder gestaucht. Der interaktive Hangar bleibt Punkt 7.

## Sicht- und Geometrieprüfung

Lokaler Playtest-Modus ohne Backend, Edge-Browser mit CSS-Viewportvorgaben.
PNG-Aufnahmen und JSON-Messungen des sichtbaren Layoutprüfers liegen hier.
Messungen sind Momentaufnahmen, keine vollständige Freigabe aller Animationen.

| Ansicht | Ergebnis |
| --- | --- |
| Menü 320 × 568 | 38,05 CSS-px zwischen Schiff-Bildgrenze und Welttitel; aktive Buttons mindestens 44 px hoch |
| Menü 390 × 844 | 77,95 CSS-px zwischen Schiff-Bildgrenze und Welttitel; aktive Buttons mindestens 44 px hoch |
| 2D-Aura im Shop 320 × 568 | Vorder-/Hinterbogen sichtbar, Vorschautitel frei |
| 3D-Modell im Shop 320 × 568 | Modell innerhalb des Vorschaufensters; kein Konflikt mit Beschriftung |
| 3D-Modell + Flügelschlag 390 × 844 | Kombinierte Anprobe und Ring sichtbar, langer Vorschautitel bleibt einzeilig |
| Jagd 390 × 844 | Nach Countdown mit Richtungswechseln geprüft; Figur und HUD getrennt, Aufnahme bei laufendem Timer |

Die Datei `shop-3d-320x568` zeigt das 3D-Modell ohne ausgewählte Aura.
Die nachfolgende 390er Aufnahme belegt die korrigierte kombinierte Anprobe.
Die Shoptexte sind auf sehr kleinen Displays weiterhin klein; ein allgemeines
Shop-Layout-Update gehört nicht zu dieser Etappe.

## Technische Prüfung

`npm run verify` erfolgreich: 599 Tests in 42 Dateien, TypeScript, ESLint,
Prettier, Balance-Inventur/-SQL, Scene-Guards, Save-Version und Produktionsbuild.
Fünf neue Tests prüfen Frameratenunabhängigkeit, Extremwerte, Richtungswechsel,
Stillstand/reduzierte Bewegung und den Heckversatz. Browserkonsole der
Shopprüfung ohne Fehler. Bestehende Canvas-Hinweise in jsdom sowie Vite-Hinweise
zu großen Bibliothekschunks bleiben bestehen.

Offen: echte Mobilgeräte, OS-Umschaltung auf reduzierte Bewegung, sämtliche
110 Skins/10 Auren in Kombination und langfristiger GPU-/Speicherverbrauch.
Die Menüvorschau für importierte 3D-Skins bleibt wie zuvor eine 2D-Silhouette;
interaktive 3D-Menü-/Hangardarstellung folgt erst in Punkt 7.

## Wiedereinstieg

Nächster Gestaltungsschritt: Punkt 5, Spielanzeige. Dabei insbesondere die
bestehende kleine Pause-Trefferfläche im Spiel prüfen. Für Punkt 4 bei Bedarf
Gerätetests ergänzen; die vorhandenen Bilder/Messungen nicht als universelle
Freigabe aller Geräte oder Skinkombinationen behandeln.
