## Was aendert sich?

<!-- Ein bis drei Saetze. Was kann man danach, was vorher nicht ging? -->

## Warum?

<!-- Verweis auf Issue, Roadmap-Punkt oder Designentscheidung. -->

## Wie getestet?

- [ ] Auf einem echten Handy gespielt (Modell: ______)
- [ ] Am PC mit Tastatur getestet
- [ ] Keine neuen Konsolenfehler

## Checkliste

- [ ] `npm run typecheck` ohne Fehler
- [ ] `npm run lint` ohne Fehler
- [ ] `npm run build` erfolgreich
- [ ] Neue Zahlen stehen in `src/config/`, nicht im Spielcode
- [ ] Jeder neue `onEvent` hat ein `offEvent` im `SHUTDOWN`-Handler
- [ ] Bewegung rechnet mit `delta`
- [ ] Betroffene Dokumentation im selben Commit aktualisiert
- [ ] `CHANGELOG.md` ergaenzt (bei nutzbaren Aenderungen)

<!-- Details zu allen Punkten: docs/CODE_STYLE.md -->
