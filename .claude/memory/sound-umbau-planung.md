---
name: sound-umbau-planung
description: "Stand der Sound-Ueberarbeitung (Planungsphase, noch kein Code) - Countdown-Ansage, Stimmenwahl, Zurueckgestelltes"
metadata:
  node_type: memory
  type: project
  originSessionId: 1fe2cde8-7922-4458-ab57-99ccadb3ccc1
  modified: 2026-09-24T13:33:55.462Z
---

Sound-Ueberarbeitung von isiHunt, Planungsphase seit 2026-09-24 - Nutzer will ausdruecklich noch keine Codeaenderungen.

- Countdown-Ansage komplett deutsch: "Drei" - "Zwei" - "Eins" - "Los geht's!"; Bildschirmtext `LOS!` wird `LOS GEHT'S!` (GameScene, beide Countdown-Pfade).
- Stimme: Piper + Thorsten (CC0), Speaker "neutral" aus `de_DE-thorsten_emotional-medium`, **roh ohne FX-Nachbearbeitung** - Urteil des Nutzers: "war ok" (nicht begeistert; ElevenLabs Starter bleibt Option, falls mehr Hype gewuenscht).
- Eigene Stimme nur im Notfall.
- Zurueckgestellt: Ansage "Letzte Chance!" bei 10 s (kein Showstopper), Musik (ganz hinten).
- Online-Countdown tickt alle <=700 ms, Anzeige in ganzen Sekunden -> Stimme nur bei Zahlwechsel ausloesen.
- GameScene/HudScene/ResultScene werden parallel im Endlos-Modus-Chat geaendert -> Countdown-Hook erst nach dessen Commit.

**Why:** Entscheidungen aus der Planungsrunde, damit eine spaetere Sitzung nicht neu verhandelt.
**How to apply:** Beim Umsetzen diese Wahl uebernehmen; Hoerproben-Skript lag nur im Scratchpad (nicht versioniert), bei Bedarf neu erzeugen.
