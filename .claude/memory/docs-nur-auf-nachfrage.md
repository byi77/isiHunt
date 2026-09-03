---
name: docs-nur-auf-nachfrage
description: Doku-Dateien erst nach Abschluss eines Tasks aktualisieren und vorher immer nachfragen - nicht automatisch im selben Commit
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 16aba07b-c958-4785-8270-54956c3779b3
  modified: 2026-08-12T11:20:34.411Z
---

Markdown-Dokumentation (GAME_DESIGN, ARCHITECTURE, DECISIONS, ROADMAP,
ART_STYLE, CHANGELOG) **nicht** automatisch waehrend der Arbeit mitpflegen.
Erst wenn ein Task komplett fertig ist, und dann **immer vorher nachfragen**,
ob die Doku jetzt nachgezogen werden soll.

**Why:** Yavuz hat das am 2026-08-12 explizit angesagt, nachdem ich Doku und
Code in einem Zug aktualisiert hatte. Doku-Updates mitten in laufender Arbeit
beschreiben einen Stand, der sich noch aendert - und sie blaehen den Umfang
einer Aenderung auf, bevor klar ist, ob sie so bleibt.

**How to apply:** Code fertigstellen, Ergebnis melden, dann fragen "soll ich
die Doku nachziehen?" und die betroffenen Dateien benennen. Das steht im
Widerspruch zur Regel "Kein Code ohne Dokument - im selben Commit" in
`C:\Git\isiHunt\CLAUDE.md`; die Nutzeransage geht vor. Bei Gelegenheit
anbieten, CLAUDE.md entsprechend anzupassen, damit die Datei nicht laenger
das Gegenteil behauptet.
