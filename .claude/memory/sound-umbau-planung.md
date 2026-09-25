---
name: sound-umbau-planung
description: "Stand der Sound-Ueberarbeitung - umgesetzt 2026-09-24 (ADR-0029), offen: Geraete-Abhoeren, \"Letzte Chance\", Musik"
metadata:
  node_type: memory
  type: project
  originSessionId: 1fe2cde8-7922-4458-ab57-99ccadb3ccc1
  modified: 2026-09-24T16:09:13.134Z
---

Sound-Ueberarbeitung von isiHunt, umgesetzt am 2026-09-24 (ADR-0029, docs/SOUND_ASSETS.md).

- Alle Effekte vorgerendert aus `scripts/render-sfx.mjs` (deterministisch), SampleBank + Summenbus, Oszillator-Toene als Fallback.
- Countdown-Stimme: Piper + Thorsten emotional, Sprecher "neutral", roh - Nutzerurteil "war ok" (nicht begeistert). ElevenLabs Starter bleibt Option fuer mehr Hype. Eigene Stimme nur im Notfall.
- Countdown-Variante a (nur Stimme, ohne Klangunterlage) umgesetzt - Nutzer hat a/b nie ausdruecklich beantwortet, a war seine letzte explizite Wahl.
- Zurueckgestellt (Nutzerwunsch): Ansage "Letzte Chance!" bei 10 s, Musik (ganz hinten).
- Ausgeliefert als v0.1.383; erster Handy-Test 2026-09-24: "sehen erstmal gut aus". Lautstaerken in `src/config/audio.ts` noch nicht gezielt nachgestimmt; voller Playtest nach dem Umbau wurde auf Nutzerwunsch uebersprungen.

**Why:** Entscheidungen aus Planung + Hoertests, damit spaetere Sitzungen nicht neu verhandeln.
**How to apply:** Bei Klang-Nachbesserungen `render-sfx.mjs` aendern, neu rendern, Hashes in SOUND_ASSETS.md nachtragen.
