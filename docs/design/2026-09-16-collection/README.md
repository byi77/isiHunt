# Grafik-Update: Punkt 6 – Sammel-Effekte

Begonnen am 16., abgeschlossen am 17. September 2026 auf v0.1.319.
Lokale Umsetzung; zusammen mit Punkt 5 noch nicht committed, gepusht oder deployed.

## Umsetzung

- Lichtsplitter fliegen auf quadratischen Kurven vom Fangort zur aktuellen
  Schiffsposition. Gewöhnliche Fänge haben wenige Splitter, höhere Seltenheiten
  mehr. Die Flugzeit beträgt 320–520 ms.
- Ein geneigter elliptischer Ring dehnt sich für 360 ms aus; epische und
  legendäre Fänge erhalten zwei Ringe. Seltenheitsfarben bleiben erhalten.
- Punktehinweise nutzen zusätzlich die bereits vorhandenen Seltenheitssymbole.
  Episch/Legendär werden benannt. Serienbonus und Talent-XP stehen im selben
  Textblock statt in konkurrierenden Einzelanimationen.
- Höchstens acht aktive Fänge, maximal sieben Splitter pro Fang: höchstens
  56 gezeichnete Splitter, zwei feste Graphics-Objekte und acht Textobjekte.
  Neue Fänge ersetzen bei vollem Budget den ältesten dekorativen Effekt.
  Wertung, Combo und Ton werden dadurch niemals ausgelassen.
- Alle Fangdarstellungen enden spätestens nach 700 ms aktiver Simulationszeit.
  Ein pausiertes Spiel pausiert auch diese Uhr. Am Rundenende werden sie weiter
  abgearbeitet; beim Szenenwechsel werden Texte, Graphics und Maske zerstört.
- Bei reduzierter Bewegung bleiben kleine Ringe und Punktehinweise statisch.
  Ein Wechsel auf reduzierte Bewegung wirkt auch auf bereits aktive Fänge.
- Die alte Explosion, expandierende Reliktkopie und der Vollbildblitz/Kameraruckler
  beim seltenen Fang entfallen. Am Schiff läuft höchstens ein Fangimpuls zugleich.

## Schutz der Darstellung

Die dekorative Ebene liegt unter lebenden Relikten, Hindernissen und Schiff.
Eine rechteckige Maske schließt HUD, Seitenrand und Fußbereich aus. Der HUD-Rand
wird aus Punkt 5 übernommen; Spawn- und Kollisionsgrenzen ändern sich nicht.

Punkteblöcke erhalten freie Positionen neben dem Fangort. Ihre Rechtecke werden
gegen den Schiffskörper, andere Fangtexte und die erlaubte Fläche geprüft.
Bereits platzierte Texte bleiben stehen; zieht das Schiff darüber, werden sie
vorübergehend verborgen. Fehlt Platz, wird nur der lokale Text weggelassen:
der zentrale Punktestand bleibt korrekt und wird sofort aktualisiert.

## Synchronisation und Spielregeln

`GameScene.collect()` registriert den Fang, startet seine Darstellung und sendet
wie zuvor `Collected`, `ScoreChanged` und `ComboChanged` unmittelbar im selben
Aufruf. `SoundSystem` hängt weiterhin an `Collected`. Die Splitterankunft löst
keine zweite Wertung und keinen verzögerten Ton aus. Steuerung, Sammelradius,
Punkteformeln, XP, Seltenheitsverteilung und Save-Format bleiben unverändert.

## Prüfung und Belege

Lokaler Playtest-Modus ohne Backend, Edge, 320 × 568 und 390 × 844.
Die Dev-Vorschau `?hudPreview=solo&collectionPreview&worldPreview=0&layoutAudit`
erlaubt sechs Seltenheiten, 50 unmittelbare Fänge, 120-ms-Zeitschritte,
eine ruhige Variante und einen Randfang. Sie verändert keine Spielstände.

- `six-120ms-*` / `six-240ms-*`: gekrümmte Bahnen und Ringe in zwei Phasen;
  frühe Aufnahme vor Ergänzung der Seltenheitssymbole im Text.
- `burst-120ms-*`: 50 ausgelöste Fänge, höchstens acht aktive Effekte, finale Symbole.
- `burst-expired-720ms-*`: keine Fangtexte mehr nach Ablauf des Budgets.
- `quiet-*`: statische Alternative, ausdrücklich über die Vorschau erzwungen;
  kein Nachweis einer OS-Umschaltung.
- `edge-*`: Punkteblock bleibt außerhalb des HUDs und innerhalb des Bildschirms;
  Dekoration außerhalb des erlaubten Bereichs wird abgeschnitten.
- `checks.json`: keine Überschneidung zwischen den Textrechtecken der sechs Aufnahmen.
- `live-collected-390x844`: echter Fang eines per vorhandener Debugtaste erzeugten
  legendären Relikts in der lokalen Jagd. Unmittelbar beobachtet: 400 Punkte und
  Serie 1. Die gespeicherte Nachmessung zeigt nach Ablauf des Serienfensters
  weiterhin 400 Punkte, Serie 0 und 89s. Browserkonsole ohne Fehler.

`npm run verify` erfolgreich: **609 Tests in 45 Dateien**, Typprüfung, ESLint,
Prettier, Projektprüfungen und Produktionsbuild. Sechs neue Tests prüfen
Kurvenendpunkte, den Nullabstand zum Schiff, Randplatzierung, belegte Flächen,
fehlenden Platz sowie Budget, Ablauf und Freigabe der Maske nach 50 Fängen.

Offen bleiben echte schwache Mobilgeräte, längere GPU-/Speichermessungen,
OS-Umschaltung auf reduzierte Bewegung und hörbare Audio-Latenz auf Geräten.
Die feste Objektgrenze ist keine gemessene FPS-Freigabe. Weitere Welten und
reale volle Spielrunden müssen ergänzend geprüft werden.

## Wiedereinstieg

Nächster Gestaltungspunkt: **Punkt 7 – echter 3D-Hangar**. Die Änderungen von
Punkt 5 und 6 liegen gemeinsam uncommitted vor und müssen erhalten bleiben.
Budgetwerte stehen in `src/config/collectionVisuals.ts`; sie sind rein visuell.
