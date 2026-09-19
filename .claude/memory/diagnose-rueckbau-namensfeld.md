---
name: diagnose-rueckbau-namensfeld
description: Befristete Debug-Ausgabe im Namensfeld (isiHunt) muss nach der Messung wieder raus
metadata: 
  node_type: memory
  type: project
  originSessionId: 0e6fafe1-84dc-4052-b14d-b2cbc0274858
  modified: 2026-09-19T07:36:38.687Z
---

Am 2026-09-19 wurde in isiHunt eine **befristete** Diagnose eingebaut, um den
wiederkehrenden Bug "erstes 'a' laesst sich im Namensfeld nicht eingeben"
endlich zu messen statt zu raten. Sie protokolliert jede Eingabe mit
Composition-Status ueber `DebugSystem.pushProtectedLogEntry`.

Zwei Stellen, beide mit dem Kommentar "DIAGNOSE (befristet)" markiert:

- `src/scenes/ProfileScene.ts` - Label `name:input` (Namensfeld im Profil)
- `src/scenes/AccountScene.ts` - Label `alias:input`, Methode
  `attachAliasDiagnostics()` (Alias bei Registrierung/Login)

**Nach der Messung auf dem Geraet ersatzlos entfernen**, inklusive der dann
ungenutzten `DebugSystem`-Importe in beiden Dateien.

Der Zweck der zwei Stellen ist die Unterscheidung: Das Alias-Feld
normalisiert waehrend des Tippens gar nicht, das Profil-Namensfeld schon
(`sanitizePlayerName` schreibt beim ersten Buchstaben gross und weist dabei
`input.value` neu zu). Tritt der Verlust nur im Profilfeld auf, ist die
Normalisierung schuld; tritt er in beiden auf, liegt es an der Tastatur bzw.
am DOM-Element.

**Zum Messen wird ein Login gebraucht.** Seit ADR-0026 fuehrt der Start ohne
Supabase-Session in die AccountScene - das Alias-Feld ist also sofort da, das
Profil-Namensfeld erst nach dem Einloggen.

Verwandt: [[playtest-immer-mit-watch]]
