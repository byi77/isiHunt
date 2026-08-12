# Art Style Guide — isiHunt

**Stand:** 2026-08-12

---

## 1. Leitbild

> **Dunkler Hintergrund, leuchtende Objekte.**

Der Name traegt es schon: _isi_ ist türkisch für Licht (_ışık_). Alles, was
wichtig ist, leuchtet. Alles, was nicht leuchtet, ist Kulisse.

Drei Konsequenzen:

1. **Hintergruende sind dunkel und gesaettigt** — nie mittelhell, sonst
   verlieren die Relikte ihren Kontrast.
2. **Spielrelevantes hat einen Lichtschein** (`Glow`-Textur, additiv
   gemischt). Was keinen Schein hat, kann man nicht einsammeln.
3. **Farbe ist Information, nicht Dekoration.** Die Seltenheitsfarben sind
   unantastbar.

## 2. Farbsystem

### 2.1 Seltenheiten — unveraenderlich

Diese sechs Farben sind die Sprache des Spiels. Sie werden **nie** fuer etwas
anderes benutzt — kein UI-Element, kein Hintergrund, keine Welt darf Lila
verwenden, wenn es nicht "episch" bedeutet.

| Stufe         | Hex       |        |
| ------------- | --------- | ------ |
| Schlicht      | `#9d9d9d` | Grau   |
| Gewoehnlich   | `#ffffff` | Weiss  |
| Ungewoehnlich | `#1eff00` | Gruen  |
| Selten        | `#0070dd` | Blau   |
| Episch        | `#a335ee` | Lila   |
| Legendaer     | `#ff8000` | Orange |

### 2.2 Welten

Jede Welt hat einen Verlauf (oben → unten) und **eine** Leitfarbe. Die
Leitfarbe faerbt Figur-Aura, HUD-Akzente und Schwebepartikel.

| Welt         | Oben      | Unten     | Leitfarbe |
| ------------ | --------- | --------- | --------- |
| Silberhain   | `#123021` | `#061410` | `#4ade80` |
| Frostzinne   | `#11294d` | `#050d1c` | `#7dd3fc` |
| Glutmark     | `#431407` | `#1a0703` | `#fb923c` |
| Leerenbluete | `#2e1065` | `#0f0524` | `#c084fc` |
| Sonnenhort   | `#4a3308` | `#1a1103` | `#fcd34d` |

**Regel fuer neue Welten:** Der Hintergrund darf nie heller als etwa 25 %
Helligkeit sein, und die Leitfarbe muss sich von allen sechs
Seltenheitsfarben klar unterscheiden.

### 2.3 Oberflaeche

| Zweck               | Wert      |
| ------------------- | --------- |
| Grundton            | `#0b1020` |
| Panel               | `#101733` |
| Text                | `#f4f1e8` |
| Text gedaempft      | `#9aa3bd` |
| Hervorhebung / Gold | `#ffd479` |
| Warnung             | `#ff6b6b` |
| Erfolg              | `#7ee787` |

Definiert in `src/ui/theme.ts`. Scenes definieren **keine** eigenen Farben.

## 3. Formensprache

- **Kreise und Sterne, keine Rechtecke.** Alles Spielbare ist rund oder
  strahlenfoermig. Rechtecke sind der Oberflaeche vorbehalten.
- **Die Figur ist ein vierzackiger Stern** mit rotierendem Ring. Der Ring hat
  exakt den Radius, in dem eingesammelt wird — das Feedback muss ehrlich sein.
- **Relikte sind Kugeln** mit Glanzpunkt oben links und Ring aussen.
- **Weiche Ecken** in der Oberflaeche: Radius 12–14 px.

## 4. Bewegung

Bewegung ist Sprache — sie sagt dem Spieler, was passiert ist.

| Ereignis                   | Bewegung                                                           | Dauer                    |
| -------------------------- | ------------------------------------------------------------------ | ------------------------ |
| Relikt erscheint           | Skalierung 0 → 1, `Back.Out`                                       | 220 ms                   |
| Relikt laeuft ab           | Alpha + Skalierung sinken                                          | letzte 700 ms            |
| Fang                       | Relikt zieht sich zusammen, Splitter, Schockwelle, Zahl steigt auf | 160 / 480 / 420 / 750 ms |
| Seltener Fang (ab episch)  | zusaetzlich Kamera-Ruckler + Aufblitzen, groessere Schockwelle     | 180 ms                   |
| Punktestand aendert sich   | kurzer Pop auf 112 %                                               | 180 ms                   |
| Figur im Stillstand        | Pulsieren 94 % ↔ 106 %                                             | 1100 ms                  |
| Figur in Bewegung          | Lichtspur ab 60 px/s                                               | 420 ms Nachleuchten      |
| Seltenes Relikt liegt da   | Strahlenkranz dreht gegenlaeufig zum Relikt                        | endlos                   |
| Vorlage im Duell ueberholt | _UEBERHOLT!_ blendet auf und wieder aus                            | 240 ms + 700 ms          |

**Zwei Schwellen steuern die Aufmerksamkeit**, beide in `GameConfig.ts`:

| Schwelle                   | Ab          | Wirkung                                           |
| -------------------------- | ----------- | ------------------------------------------------- |
| `RARITY_RAYS_MIN_POINTS`   | selten (15) | Strahlenkranz, staerkeres Pulsieren               |
| `RARITY_IMPACT_MIN_POINTS` | episch (50) | Kamera-Ruckler, Aufblitzen, doppelte Splitterzahl |

Der Abstand ist Absicht: **Sehen darf man Seltenes oft, spueren selten.**
Bekaeme jedes Relikt einen Strahlenkranz, hoerte er auf, Seltenheit zu
bedeuten.

**Grenze:** Kein Effekt darf laenger als **800 ms** dauern. Bei einem Run von
60 Sekunden ist alles Laengere im Weg.

## 5. Schrift

v0.1 nutzt System-Fonts (`Trebuchet MS`, `Segoe UI`, `system-ui`). Kein
Webfont-Laden, kein Layoutsprung, funktioniert offline.

| Rolle               | Groesse |
| ------------------- | ------- |
| Titel / Punktestand | 68 px   |
| Ueberschrift        | 40 px   |
| Gross               | 34 px   |
| Fliesstext          | 26 px   |
| Klein               | 21 px   |
| Winzig / Label      | 17 px   |

Labels in Grossbuchstaben mit **6–8 px Laufweite** — das ist der
"UI-Rahmen"-Look, der die Anzeige von Spielinhalten trennt.

## 6. Aktuelle Assets: prozedural

**Es gibt keine Bilddateien im Spiel.** Alle Texturen entstehen beim Start in
`src/ui/textures.ts`.

Einzige Ausnahme sind die **App-Icons** fuer Manifest und iOS-Home-Bildschirm:
Dort verlangt das Betriebssystem echte PNG-Dateien. Sie werden von
`scripts/generate-icons.mjs` gezeichnet — derselbe vierzackige Stern in Gold
auf dem Grundton, nur vorab statt zur Laufzeit. Wer das Motiv aendert, aendert
eine Zahl im Skript und laesst `npm run icons` laufen.

Der Stern nimmt bewusst nur 30 % der Icon-Breite ein: Android schneidet
"maskable" Icons zu einem Kreis zu und garantiert nur die inneren 80 % der
Flaeche.

| Key               | Was                                                             | Groesse |
| ----------------- | --------------------------------------------------------------- | ------- |
| `tex-pixel`       | 1×1 weiss, Basis fuer Flaechen und Balken                       | 1×1     |
| `tex-orb`         | Relikt als geschliffener Stein: acht Facetten, Kern, Glanzpunkt | 64×64   |
| `tex-glow`        | weicher Lichtschein (konzentrische Kreise)                      | 128×128 |
| `tex-spark`       | rundes Partikel fuer Schwebestaub                               | 16×16   |
| `tex-shard`       | vierzackiger Splitter fuer Fang-Explosionen                     | 24×24   |
| `tex-rays`        | Strahlenkranz hinter seltenen Relikten                          | 160×160 |
| `tex-ring`        | Ring fuer die Schockwelle beim Fang                             | 128×128 |
| `tex-vignette`    | radiale Randabdunklung                                          | 256×256 |
| `tex-player-core` | zwei ineinander gedrehte vierzackige Sterne                     | 96×96   |
| `tex-player-halo` | Ring mit vier Segmenten und Markern                             | 128×128 |

**Alles wird weiss gezeichnet und zur Laufzeit getintet.** Deshalb bedient
eine Textur alle Seltenheiten und Welten.

### 6.1 Warum Facetten und Splitter

Zwei Formentscheidungen mit Absicht dahinter:

- **Das Relikt hat Facetten statt einer glatten Kugel.** Eine glatte Kugel
  sieht gedreht identisch aus — die Rotation waere unsichtbar. Acht Segmente
  mit wechselnder Helligkeit machen die Drehung lesbar und lassen das Relikt
  wie geschliffen wirken.
- **Fang-Partikel sind spitz, Hintergrundstaub ist rund.** Rundes liest sich
  als Rauch oder Nebel, Spitzes als Splitter. Ein zerspringendes Relikt soll
  splittern.

### 6.2 Hintergrund in Schichten

Ein Verlauf allein wirkt wie ein Plakat. Der Hintergrund besteht deshalb aus
fuenf Ebenen (Reihenfolge in `src/ui/depth.ts`):

| Ebene                | Zweck                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Grundverlauf         | Farbstimmung der Welt                                                                             |
| Horizontschein       | die Lichtquelle der Welt, oberes Drittel                                                          |
| Farbwolken           | vier weiche Flecken in **fester** Anordnung — jede Welt bleibt wiedererkennbar                    |
| Zwei Parallax-Ebenen | die hintere kleiner, dunkler, langsamer; der Geschwindigkeitsunterschied _ist_ der Tiefeneindruck |
| Lichtstaub           | steigt auf, traegt die Stimmung                                                                   |

Darueber liegt eine **Vignette**, die den Blick zur Bildmitte zieht.

## 7. Regeln fuer echte Assets (ab M4)

Wenn Platzhalter durch echte Grafiken ersetzt werden:

1. **Texture-Keys bleiben gleich.** Nur `textures.ts` aendert sich, kein
   Spielcode.
2. **Weiss oder graustufig liefern**, damit das Tinting weiter funktioniert.
   Farbige Assets brechen das Seltenheitssystem.
3. **Zweifache Aufloesung** (`@2x`) fuer scharfe Darstellung auf modernen
   Displays.
4. **Quelldateien** (`.aseprite`, `.psd`) gehoeren nach `art-source/` und
   werden nicht eingecheckt — nur die Exporte.
5. **Transparente Raender**: mindestens 2 px Luft, sonst schneidet die
   Skalierung Kanten ab.

### Wo man Assets bekommt

- [Kenney.nl](https://kenney.nl/) — CC0, riesig, sofort nutzbar
- [itch.io Game Assets](https://itch.io/game-assets/free) — viel Fantasy
- [OpenGameArt](https://opengameart.org/) — Lizenz je Werk pruefen

**Lizenzen immer pruefen und in einer `CREDITS.md` festhalten**, bevor etwas
eingecheckt wird.

## 8. Barrierefreiheit

Offen fuer M4, hier schon notiert:

- Die Seltenheitsfarben Grau/Weiss und Gruen/Orange sind fuer manche
  Farbsehschwaechen schwer zu trennen. **Loesung:** zusaetzlich die Form
  variieren (Zacken je Stufe), nicht nur die Farbe.
- Kamera-Ruckler und Aufblitzen brauchen einen Ausschalter
  (`prefers-reduced-motion` respektieren).
- Mindestgroesse fuer Tippziele: 44 × 44 px. Alle Knoepfe liegen deutlich
  darueber.
