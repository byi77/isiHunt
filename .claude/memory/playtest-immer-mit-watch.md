---
name: playtest-immer-mit-watch
description: "isiHunt-Playtests immer mit --watch starten, damit der Nutzer live zusehen kann"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6819f4d4-c402-4627-b14a-8c5abb226686
  modified: 2026-08-19T09:14:59.895Z
---

Automatisierte Tests an isiHunt ab sofort **immer** im Watch-Modus starten:
`npm run playtest -- --watch`. Nie headless, ohne dass ausdruecklich danach
gefragt wird.

**Why:** Der Nutzer will beim Testen zusehen koennen. Ein headless-Lauf
liefert nur eine Zeile "gruen" — der sichtbare Browser zeigt, was das Skript
tatsaechlich tut, und macht Fehlverhalten sichtbar, das kein Pruefschritt
abfragt (Layout, Ruckeln, falsche Scene).

**How to apply:** Bei jedem Aufruf von `npm run playtest` das Flag `--watch`
setzen. Headless nur, wenn der Nutzer es ausdruecklich verlangt oder der Lauf
in einer CI-Umgebung ohne Desktop-Sitzung stattfindet.

Bestaetigt am 2026-08-19: Der Nutzer sieht das Fenster tatsaechlich auf
seinem Desktop.
