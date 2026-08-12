# Art Style Guide — isiHunt

**Stand:** 2026-08-12

---

## 1. Leitbild

> **Dunkler Hintergrund, leuchtende Objekte.**

Der Name traegt es schon: *isi* ist türkisch für Licht (*ışık*). Alles, was
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

| Stufe | Hex | |
|---|---|---|
| Schlicht | `#9d9d9d` | Grau |
| Gewoehnlich | `#ffffff` | Weiss |
| Ungewoehnlich | `#1eff00` | Gruen |
| Selten | `#0070dd` | Blau |
| Episch | `#a335ee` | Lila |
| Legendaer | `#ff8000` | Orange |

### 2.2 Welten

Jede Welt hat einen Verlauf (oben → unten) und **eine** Leitfarbe. Die
Leitfarbe faerbt Figur-Aura, HUD-Akzente und Schwebepartikel.

| Welt | Oben | Unten | Leitfarbe |
|---|---|---|---|
| Silberhain | `#123021` | `#061410` | `#4ade80` |
| Frostzinne | `#11294d` | `#050d1c` | `#7dd3fc` |
| Glutmark | `#431407` | `#1a0703` | `#fb923c` |
| Leerenbluete | `#2e1065` | `#0f0524` | `#c084fc` |
| Sonnenhort | `#4a3308` | `#1a1103` | `#fcd34d` |

**Regel fuer neue Welten:** Der Hintergrund darf nie heller als etwa 25 %
Helligkeit sein, und die Leitfarbe muss sich von allen sechs
Seltenheitsfarben klar unterscheiden.

### 2.3 Oberflaeche

| Zweck | Wert |
|---|---|
| Grundton | `#0b1020` |
| Panel | `#101733` |
| Text | `#f4f1e8` |
| Text gedaempft | `#9aa3bd` |
| Hervorhebung / Gold | `#ffd479` |
| Warnung | `#ff6b6b` |
| Erfolg | `#7ee787` |

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

| Ereignis | Bewegung | Dauer |
|---|---|---|
| Relikt erscheint | Skalierung 0 → 1, `Back.Out` | 220 ms |
| Relikt laeuft ab | Alpha + Skalierung sinken | letzte 700 ms |
| Fang | Relikt zieht sich zusammen, Partikel, Zahl steigt auf | 160 / 480 / 750 ms |
| Seltener Fang (ab episch) | zusaetzlich Kamera-Ruckler + Aufblitzen | 180 ms |
| Punktestand aendert sich | kurzer Pop auf 112 % | 180 ms |
| Figur im Stillstand | Pulsieren 94 % ↔ 106 % | 1100 ms |

**Grenze:** Kein Effekt darf laenger als **800 ms** dauern. Bei einem Run von
60 Sekunden ist alles Laengere im Weg.

## 5. Schrift

v0.1 nutzt System-Fonts (`Trebuchet MS`, `Segoe UI`, `system-ui`). Kein
Webfont-Laden, kein Layoutsprung, funktioniert offline.

| Rolle | Groesse |
|---|---|
| Titel / Punktestand | 68 px |
| Ueberschrift | 40 px |
| Gross | 34 px |
| Fliesstext | 26 px |
| Klein | 21 px |
| Winzig / Label | 17 px |

Labels in Grossbuchstaben mit **6–8 px Laufweite** — das ist der
"UI-Rahmen"-Look, der die Anzeige von Spielinhalten trennt.

## 6. Aktuelle Assets: prozedural

**Es gibt in v0.1 keine Bilddateien.** Alle Texturen entstehen beim Start in
`src/ui/textures.ts`.

| Key | Was | Groesse |
|---|---|---|
| `tex-pixel` | 1×1 weiss, Basis fuer Flaechen und Balken | 1×1 |
| `tex-orb` | Relikt-Kugel mit Glanz und Ring | 64×64 |
| `tex-glow` | weicher Lichtschein (konzentrische Kreise) | 128×128 |
| `tex-spark` | Partikel | 16×16 |
| `tex-player-core` | vierzackiger Stern | 96×96 |
| `tex-player-halo` | Ring mit vier Segmenten | 128×128 |

**Alles wird weiss gezeichnet und zur Laufzeit getintet.** Deshalb bedient
eine Textur alle Seltenheiten und Welten.

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
