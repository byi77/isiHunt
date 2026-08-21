# Roadmap — isiHunt

**Stand:** 2026-08-22 · Produktstand v0.1.227 · Die detaillierte und verbindliche Aufgabenreihenfolge
steht in [`TODO.md`](../TODO.md). Diese Datei zeigt nur den Produktweg.

## Bereits spielbar

### M0 — Fundament ✅

Das Browser-Spiel, Touch- und Tastatursteuerung, Persistenz, Tests, Build und
automatische Auslieferung stehen.

### M1 — Spielgefühl und Bedienung ✅

Menüs, Pause, Run verlassen, sichtbare iOS-Installationshilfe, einheitliche
Zurück-Navigation und große Touch-Trefferflächen sind umgesetzt. Emre und
Simay haben die Button- und Zurück-Navigation am Testgerät erneut als gut
funktionierend bestätigt.

### M2 — Profil und Fortschritt ✅

Profile, Charaktername, Level bis 100, XP, Erfolge, Weltenfreischaltung,
Bestwert und lokale Speicherung funktionieren. Ein angemeldetes Profil kann
seinen Namen ändern und wird im Hauptmenü gezeigt.

### M2.6 — Login und mehrere Geräte 🟡

Alias-Login mit PIN, gemeinsamer Fortschritt, Offline-Outbox und sichere
Zusammenführung sind implementiert.

**Noch zu bestätigen:** Das Supabase-SQL muss produktiv ausgeführt und ein
echter iPhone-/iPad-Test mit Offline-Runs und anschließender Verbindung
durchgeführt werden.

### M3 — Weltraumwelt ✅

Das Licht-Raumschiff ersetzt den Stern, Relikte sind Planeten, jede Raumzone
hat eigene Sternen-, Nebel- und Planetenansichten. Mit hohem Level werden
Raumschiff-Skins und schwierigere Welten freigeschaltet.

### M4 — Belohnung, Coins und Talente ✅

Punkte-Popups, Kettenbonus, Coins, Erfolge und die erste Coin-basierte
Talent-/Shop-Ansicht sind spielbar.

> Die Coin-basierte Talent-/Shop-Wirtschaft ist die geltende Entscheidung
> (ADR-0018). Als nächster Produkt-Schritt bleibt die Darstellung der sieben
> unabhängigen Talente; ein Talentpunkte-Umbau ist verworfen.

### M5 — Herausforderungen und Modi ✅

Normaler Solo-Run, Tages-Herausforderung, lokales Duell gegen eine zweite
Person oder einen Bot sowie Weltmodifikatoren und Hindernisse sind vorhanden.

**Noch offen:** Schwierigkeit und Belohnungen mit der Zielgruppe balancieren.

## Nächste Meilensteine

### M4.1 — Talentdarstellung und Profilidentität

- Coin-basierte Talente beibehalten; kein Talentpunkte-Umbau und keine
  Talentpunkte-Bestandsmigration.
- Die sieben unabhängigen Talent-Ränge als ehrliche, kindgerechte Liste
  verständlich darstellen und visuell weiter polieren.
- Bestehende Coin-, Talent- und Kosmetikstände erhalten und geräteübergreifend
  synchron halten.
- Profil-Icons, getrennten sichtbaren Spielernamen und Skin-Inventar
  weiterführen.

### M6 — Freunde, Wettbewerb und Realtime

- Live-Aktualisierung der Rangliste.
- Rekord-Ereignisse im Spiel und später optional Web-Push für installierte
  Apps.
- Serverseitige Laufprüfung als Grundlage für Ranked.
- Freundesliste mit Anfrage, Online-Status, Rekord und Coins.
- 1vs1-Einladung zuerst per Link zwischen zwei Geräten; Echtzeit danach.

### M7 — Prestige

Wiedergeburt als freiwilliger, geschützter Reset mit dauerhaftem Multiplikator.
Der genaue Reset-Umfang und die Belohnung werden erst nach validierter
Level-100-Kurve, Coin-Economy und Zielgruppen-Abnahme festgelegt.

### M8 — Native App

Capacitor, Android-Test, iOS-Build/TestFlight und erst dann native Features
wie Live Activities bei der Dynamic Island. Technischer Weg (Codemagic ohne
eigenen Mac, App Store Connect API Signing) und Voraussetzungen-Checkliste
stehen in ADR-0015 (`docs/DECISIONS.md`); die vorbereitbaren Konto-Schritte
sind in `TODO.md` gelistet und blockieren M4.1/M6/M7 nicht.

## Grundsätze

- Eine Hand, Hochformat, keine Werbung und keine In-App-Käufe.
- Kinderfeedback entscheidet vor Annahmen im Code.
- Erst ein stabiles gemeinsames Profil, dann Freunde, Ranked und Push.
- Jede konkrete Aufgabe, Entscheidung und Priorität gehört in die
  [`TODO.md`](../TODO.md).
