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
| Sternenweide | `#123021` | `#061410` | `#4ade80` |
| Eisring      | `#11294d` | `#050d1c` | `#7dd3fc` |
| Glutnebel    | `#431407` | `#1a0703` | `#fb923c` |
| Nullsektor   | `#2e1065` | `#0f0524` | `#c084fc` |
| Sonnenkrone  | `#4a3308` | `#1a1103` | `#fcd34d` |

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

Phase 3 ersetzt die Fantasy-Symbole durch eine tintbare Weltraum-Sprache:
Die Figur ist ein Licht-Raumschiff, Relikte werden als Planeten mit
Atmosphaerenrand und Orbit gelesen. Die Texture-Keys bleiben dabei stabil.

- **Kreise und Sterne, keine Rechtecke.** Alles Spielbare ist rund oder
  strahlenfoermig. Rechtecke sind der Oberflaeche vorbehalten.
- **Die Figur ist ein Licht-Raumschiff** mit rotierendem Ring. Der Ring hat
  exakt den Radius, in dem eingesammelt wird — das Feedback muss ehrlich sein.
- **Planeten sind Relikte** mit Atmosphaerenrand, Kontinenten und Orbit.
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
90 Sekunden ist alles Laengere im Weg.

## 4.1 Ton

Ton ist Rueckmeldung, kein Dauerteppich. `src/systems/SoundSystem.ts` erzeugt
kurze WebAudio-Oszillator-Toene ohne Audiodateien:

| Ereignis    | Klangidee                                                                    |
| ----------- | ---------------------------------------------------------------------------- |
| Button      | kurzer, trockener Dreieckston                                                |
| Reliktfang  | steigende Tonhoehe je Seltenheit; seltene Relikte bekommen einen zweiten Ton |
| Combo-Stufe | zweistufiger, hoeherer Signalton                                             |
| Run-Start   | kurzer Aufwaertston                                                          |
| Run-Ende    | ruhiger Abschluss; Levelaufstieg bekommt eine eigene Aufwaertfolge           |

Die sechs Seltenheitsfarben bleiben visuell unantastbar; Ton ergaenzt sie nur.
Der Ton ist in den Einstellungen abschaltbar und wird im Spielstand gespeichert.
Auf iOS wird der AudioContext erst nach der ersten Nutzergeste entsperrt.

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

## 6. Aktuelle Assets: prozedural und rasterbasiert

Spielrelevante Relikte, Raumschiffe und UI-Grundformen entstehen weiterhin
beim Start in `src/ui/textures.ts`. Die grossen Hintergrundplaneten und das
Logo sind dagegen echte PNG-Assets in `public/assets/`, weil Oberflaechen-
details und die Markenform davon profitieren.

Weitere Rasterassets sind die **App-Icons** fuer Manifest und iOS-Home-Bildschirm:
Dort verlangt das Betriebssystem echte PNG-Dateien. Sie werden von
`scripts/generate-icons.mjs` gezeichnet — derselbe vierzackige Stern in Gold
auf dem Grundton, nur vorab statt zur Laufzeit. Wer das Motiv aendert, aendert
eine Zahl im Skript und laesst `npm run icons` laufen.

Der Stern nimmt bewusst nur 30 % der Icon-Breite ein: Android schneidet
"maskable" Icons zu einem Kreis zu und garantiert nur die inneren 80 % der
Flaeche.

Die weiteren Rasterassets liegen unter `public/assets/`: `isihunt-logo-v2.png`
und je eine Planetentextur fuer Sternenweide, Eisring, Glutnebel, Nullsektor
und Sonnenkrone. Sie werden im `BootScene` vor dem Menue geladen.

Die einsammelbaren Relikte verwenden diese echten Planetensprites passend zur
Welt. Die Seltenheitsfarbe kommt ueber Glow, Strahlenkranz und Fang-Effekte
hinzu, damit die sechs Seltenheitsfarben eindeutig bleiben.

| Key               | Was                                                    | Groesse |
| ----------------- | ------------------------------------------------------ | ------- |
| `tex-pixel`       | 1×1 weiss, Basis fuer Flaechen und Balken              | 1×1     |
| `tex-orb`         | Planet als Relikt: Atmosphaerenrand, Kontinente, Orbit | 64×64   |
| `tex-glow`        | weicher Lichtschein (konzentrische Kreise)             | 128×128 |
| `tex-spark`       | rundes Partikel fuer Schwebestaub                      | 16×16   |
| `tex-shard`       | vierzackiger Splitter fuer Fang-Explosionen            | 24×24   |
| `tex-rays`        | Strahlenkranz hinter seltenen Relikten                 | 160×160 |
| `tex-ring`        | Ring fuer die Schockwelle beim Fang                    | 128×128 |
| `tex-vignette`    | radiale Randabdunklung                                 | 256×256 |
| `tex-player-core` | Licht-Raumschiff mit Cockpit, Fluegeln und Triebwerken | 96×96   |
| `tex-player-halo` | Ring mit vier Segmenten und Markern                    | 128×128 |

**Alles wird weiss gezeichnet und zur Laufzeit getintet.** Deshalb bedient
eine Textur alle Seltenheiten und Welten.

Das gilt fuer die tintbaren Spielobjekte. Die Hintergrundplaneten bleiben
farbig und sehr transparent; sie sind Kulisse und keine Relikte. Beim Boot
werden Logo und Planetentexturen vor dem Menue geladen.

Die sechs Raumschiff-Skins werden ebenfalls prozedural aus derselben weissen
Grundform gebaut. Sie schalten bei Level 5, 15, 30, 50, 75 und 100 zusätzliche
Silhouetten-Details frei und behalten dadurch die klare Lesbarkeit im Spiel.

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
| Hintergrundplaneten  | zwei sehr transparente Planeten als feste Himmelsmarken je Welt                                   |
| Farbwolken           | vier weiche Flecken in **fester** Anordnung je Welt — jede Welt bleibt wiedererkennbar            |
| Zwei Parallax-Ebenen | die hintere kleiner, dunkler, langsamer; der Geschwindigkeitsunterschied _ist_ der Tiefeneindruck |
| Lichtstaub           | steigt auf, traegt die Stimmung                                                                   |

Darueber liegt eine **Vignette**, die den Blick zur Bildmitte zieht.

## 7. Regeln fuer weitere echte Assets

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

### 8.1 Die Trefferflaeche deckt den Knopf — nicht mehr, nicht weniger

> **Ein Knopf reagiert genau dort, wo er ist.**

Das klingt selbstverstaendlich und hat drei Anlaeufe gekostet. Zwei Irrwege,
damit sie nicht wiederholt werden:

**Irrweg 1: Trefferflaeche ueber den Lichtschein hinaus vergroessern.** Klingt
grosszuegig, erzeugt aber unsichtbare Flaeche. Bei zwei Knoepfen nebeneinander
ueberlappen sie sich, und dann gewinnt in Phaser das **zuletzt erzeugte**
Objekt (`InputPlugin.sortGameObjects`) — nicht das naeherliegende. Man tippt
sichtbar auf den linken Knopf und bekommt den rechten.

**Irrweg 2: Der Ursprung der Trefferflaeche.** Siehe 8.3 — das war der
eigentliche Fehler.

Wer die Flaeche doch einmal vergroessern will, muss vorher nachrechnen, dass
sich keine zwei Flaechen beruehren. Im Menue liegen zwischen zwei Knoepfen nur
10 px.

### 8.2 Druckzustaende skalieren das Bild, nie die Trefferflaeche

Ein Knopf, der sich beim Druecken staucht, **darf dabei nicht kleiner werden,
als er anfassbar ist**. Phaser rechnet die Trefferflaeche in der Skalierung des
Objekts, an dem sie haengt — ein `setScale(0.96)` auf dem interaktiven Container
verkleinert also beides zugleich, und zwar in dem Moment, in dem der Finger
schon aufliegt. Ein Tipp am Rand loest dann `pointerdown` aus, faellt aus der
geschrumpften Flaeche heraus und bekommt nie ein `pointerup`. Der Knopf blinkt
und tut nichts.

> **Regel:** Sichtbares und Anfassbares sind zwei Objekte. Animiert wird immer
> das innere, interaktiv ist immer das aeussere.

Das gilt fuer jede Druck-, Hover- oder Pulsanimation, die an einem
interaktiven Objekt haengt — nicht nur fuer Knoepfe.

**Dazu:** Ein Tipp gilt, solange er auf demselben Element endet, auf dem er
begonnen hat. Ein Daumen wandert zwischen Aufsetzen und Abheben ein paar Pixel;
das darf einen Tipp nicht verschlucken. Nur wer bewusst wegzieht und ausserhalb
abhebt, bricht ab.

### 8.4 Das Spielfeld haelt sich aus den sicheren Raendern heraus

`viewport-fit=cover` laesst die Seite bis zum Home-Indicator reichen — das ist
fuer den **Hintergrund** richtig, damit dort nichts durchblitzt. Oben nutzt die
installierte iOS-App dagegen eine undurchsichtige schwarze Statusleiste: Uhr
und Dynamic Island bleiben im Systembereich, und dessen Blur liegt nicht ueber
dem Lauftext.

Der Web-Viewport beginnt dadurch bereits unter dem Systembereich. Dort folgen
direkt 32 px fuer Laufband beziehungsweise Restzeit; ein weiteres
`safe-area-inset-top`-Padding waere doppelt und ist im iOS-Standalone-Modus
deshalb 0. Seitliche Raender nutzen weiterhin `env(safe-area-inset-*)`. Unten
reicht der Canvas bis zum Displayrand; die Bedienelemente halten ihren
Sicherheitsabstand innerhalb des Spiels.

**Warum das nie am Schreibtisch auffaellt:** Ein Browser-Simulator kann
iPhone-Groessen nachstellen, aber **keine sicheren Raender** — die entstehen
erst durch echte Notch-Hardware. Diese Klasse Fehler ist nur auf dem Geraet zu
finden; deshalb zeigt der Wartungsbildschirm die gemessenen Werte an
(`core/layoutReport.ts`).

**Und:** Jedes DOM-Element ueber dem Canvas — Eingabefelder, die
Versionsnummer — braucht **mindestens 60 Spielpixel Abstand** zu allem
Bedienbaren. Solche Elemente kennen Phasers Zeichenreihenfolge nicht, liegen
immer obenauf und werden bei offener Systemtastatur zusaetzlich verschoben.
Zweimal hat das bereits einen Knopf unbedienbar gemacht: den Zurueck-Knopf der
Bestenliste und "CODE EINLOESEN" im Spielstand-Bildschirm.

### 8.3 Der Ursprung einer Trefferflaeche liegt bei (0,0) — auch im Container

Die teuerste Falle dieses Projekts, deshalb ausfuehrlich.

Ein `Container` zeichnet seine Kinder **um** den Mittelpunkt herum: Sie liegen
bei `-width/2` bis `+width/2`. Die naheliegende Trefferflaeche ist also

```ts
new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height); // FALSCH
```

und genau die ist falsch. Phaser normalisiert den Testpunkt vorher auf den
Ursprung (`InputManager.pointWithinInteractiveObject`):

```js
x += gameObject.displayOriginX; // beim Container immer width * 0.5
```

Der Punkt kommt also **bereits verschoben** an. Ein bei `-width/2` beginnendes
Rechteck liegt dadurch eine halbe Knopfbreite zu weit rechts.

**Der Haken:** `displayOriginX` ist `width * 0.5` — aber nur, wenn `setSize()`
gelaufen ist. Vorher ist `width` gleich 0 und der Versatz ebenfalls. Dieselbe
Rechteck-Definition ist also je nach Aufrufreihenfolge mal richtig und mal um
eine halbe Breite daneben. Genau daher kamen die wechselnden Fehlerbilder
("rechts geht nicht" / "links geht nicht").

**Deshalb wird nicht gerechnet, sondern gemessen.** `makeAlignedHitArea()` in
`ui/widgets.ts` fragt das Objekt nach seinem Ursprung und legt das Rechteck
darum:

```ts
const hitArea = makeAlignedHitArea(container, width, height);
container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
```

Das bleibt richtig, unabhaengig davon, wie Phaser intern normalisiert — heute
und nach dem naechsten Update. **Neue interaktive Container benutzen diese
Funktion**, nicht ein selbst gebautes Rechteck.

**Warum die Falle so leicht zu uebersehen ist:** Bei einem `Image` stimmen
Texturkoordinaten und `displayOrigin` ueberein — dort funktioniert die
naheliegende Rechnung. Nur beim `Container` fallen Zeichenkoordinaten
(um 0 herum) und Trefferflaechenkoordinaten (ab 0) auseinander.

**Gegenprobe bei jeder Aenderung:** `?hitboxes` an die Adresse haengen
(`src/ui/hitDebug.ts`). Das Werkzeug zeichnet jede Trefferflaeche, markiert
jeden Tipp und meldet `<<< WIDERSPRUCH`, wenn Phaser ein anderes Objekt liefert,
als die Geometrie hergibt.
