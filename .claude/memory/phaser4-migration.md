---
name: phaser4-migration
description: Phaser-4.2.1-Migration geplant (2026-09-28) - Entscheidungen des Nutzers und Befunde aus dem Probelauf
metadata:
  node_type: memory
  type: project
  originSessionId: 7981c0a2-a229-48fa-aeca-3b17b431e3ba
  modified: 2026-09-28T20:08:50.980Z
---

Der Nutzer will isiHunt von Phaser 3.90 auf 4.2.1 heben und danach "volle
Huette" an Effekten (Bloom, Licht, Verzerrung, lebender Nebel ...). Plan in
`docs/ROADMAP.md`, Abschnitt "Engine - Phaser 4", Arbeit auf Branch
`feat/phaser4`.

Entscheidungen vom 2026-09-28:
1. **Kein Canvas mehr** - nur WebGL, bei fehlendem WebGL ein DOM-Hinweis.
2. **Effektstufen sparsam/mittel/voll, Standard voll**, automatisch nur
   abwaerts gestuft (Median ueber mehrere Sekunden, wirksam ab naechster
   Szene), Hinweis in den Einstellungen. Schwellwerte erst nach Messung auf
   echten Geraeten festlegen.
3. Weltaura/Triebwerk vorher auf v3 ausliefern, ohne vollen Playtest.

Probelauf-Befunde (Worktree mit 4.2.1): 30 Typfehler in 5 Dateien (meist
`strokePoints`/`fillPoints` wollen `Vector2[]`, dazu `preFX`), Tests gruen,
`ios:check` bleibt 16.4, Phaser-Bundle 1447 -> 1645 kB. **GeometryMask bricht
still** (nur noch Canvas): Talentbaum-Inhalt ragt unter den Zurueck-Knopf, der
Playtest bleibt trotzdem gruen. Masken: CollectionEffects, ResultView,
TalentScene. `camera.matrix` in `layoutAudit.ts` aendert die Bedeutung.

**Why:** Grafik-Offensive; der Nutzer hat gegen meine Empfehlung (jetzt nicht
upgraden) bewusst entschieden.
**How to apply:** Masken-Regressionstest per Pixelprobe vor dem Fix bauen und
rot sehen; Phase 1 muss optisch identisch zu v3 sein, bevor Effekte kommen.
