# SQL- und Konkurrenzabnahme fuer Belohnungscodes

Diese Abnahme ist erst moeglich, wenn die Reward-Tabellen, der
authentifizierte Handler und die atomare Einloese-/Run-Transaktion produktiv
implementiert sind. Eine Sequenz aus zwei RPC-Aufrufen ersetzt keine
Nebenlaeufigkeitspruefung.

## Isolierte Konten

- Konto A und Konto B mit getrennten Auth-Sessions
- eine Kampagne mit Limit 1 und ein letzter Code
- ein Konto mit parallelem Profil-/Talentkauf
- ein Konto mit fertigem Outbox-Ereignis
- Admin- und Nichtadminkonto

## Pflichtfaelle

1. A und B loesen denselben letzten Code gleichzeitig ein: genau eine Vergabe.
2. Dieselbe Request-ID wird wiederholt: derselbe Beleg, keine zweite Vergabe.
3. Dieselbe Request-ID mit anderem Code: Konflikt, keine Vergabe.
4. Finish und Abandon derselben Lauf-ID gleichzeitig: genau ein Endzustand.
5. Finish nach Ablauf oder Abandon: keine XP und keine Verbrauchserstattung.
6. Profiländerung während einer Einlösung: kein veralteter Save-Blob darf
   neueren Fortschritt überschreiben.
7. Nichtadmin ruft Verwaltungsfunktionen direkt auf: jede Änderung ablehnen.

## Nachweis

Jeder Fall braucht getrennte Datenbankverbindungen, die SQL-Antwort,
Transaktionszustand, Grants, Verbrauchszähler, Auditbeleg und Profilrevision
prüfen. Ergebnisse gehören in den Release-Report; Codes, Tokens und Secrets
werden nur maskiert dokumentiert.
