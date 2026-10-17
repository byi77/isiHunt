---
name: phaser4-migration
description: Phaser 4.2.1 + Effektstufen + Phase-3-Effekte seit 2026-09-29 live (v0.1.420) - was offen ist und welche Fallen es gab
metadata:
  node_type: memory
  type: project
  originSessionId: 7981c0a2-a229-48fa-aeca-3b17b431e3ba
  modified: 2026-09-28T23:19:53.965Z
---

isiHunt laeuft seit 2026-09-29 auf Phaser 4.2.1, nur WebGL, mit Effektstufen
sparsam/mittel/voll und elf Effekten auf VOLL (ADR-0035, ARCHITECTURE
"Phaser 4 und Effektstufen"). Live ab v0.1.420. Nutzer-Entscheidungen: kein
Canvas, Standard VOLL mit automatischem Herabstufen nur abwaerts.

Offen (ROADMAP "Engine - Phaser 4"): Bildrate auf echten Handys je Stufe
messen und `FRAME_GUARD.slowFrameMs` (vorlaeufig 25 ms) festlegen; voller
Playtest ueber die Effekte (vom Nutzer zweimal uebersprungen); Duell mit zwei
Geraeten; Lichtkern hat den knappsten Relikt-Kontrast.

Fallen, die aufgetreten sind:
- `GeometryMask` bricht in v4/WebGL still - `ClipMask` + Pixelprobe.
- Filter rechnen mit GL-Ausrichtung (Schatten y negativ = nach unten).
- Licht ohne Normal-Map braucht hohes `z`, sonst unsichtbar.
- CI-Runner rendert ohne GPU; der Countdown zaehlt Frames. Mit vollen
  Effekten lief `performance:check` in 90 s nicht durch - das Gate laeuft
  jetzt auf `reduced`. Neue schwere Effekte koennen andere CI-Gates mit
  echtem Rendering genauso treffen.

**Why:** Grafik-Offensive des Nutzers, gegen meine urspruengliche Empfehlung.
**How to apply:** Effektaenderungen immer gegen `npm run readability:check`
pruefen; bei CI-Timeouts zuerst an Software-Rendering denken.
