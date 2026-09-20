# Release-Gates fuer Belohnungscodes und Bonusrunden

Die Belohnungscode-Funktion bleibt bis zum produktiven Serververtrag deaktiviert.
Ein gruener Client-Build ist kein Nachweis fuer atomare Buchung oder
Nebenlaeufigkeit.

## Reihenfolge

1. Kompatible Datenbank-/Handler-Migration mit RLS, Authbindung, Idempotenz,
   Audit und serverseitigen Limits ausrollen.
2. SQL-Vertrag und konkurrierende Sessions gegen isolierte Testkonten pruefen.
3. Client mit den gemeinsamen Vertrags-Typen und Retry-IDs deployen.
4. Erst danach begrenzte Testaktion aktivieren; XP-Bonuscodes bleiben bis zum
   vollstaendigen Start-/Finish-Vertrag gesperrt.
5. Live-Schema, Handler-Version, oeffentliche Clientversion und Metriken
   nachkontrollieren.

## Abschaltbarkeit

Einloesungen, Starts und Finishes muessen getrennt abschaltbar sein. Ein
Rollback entfernt keine bereits vergebenen Grants oder Auditbelege; eine
Korrektur erfolgt vorwaerts und nachvollziehbar.

## Geheimnisse und Metriken

Klartextcodes, HMAC-Schluessel, Tokens und vollstaendige Requestdaten gehoeren
nicht in Logs. Beobachtet werden nur maskierte Einloesungsfehler, Retry- und
Konfliktraten, offene/abgelaufene Versuche und Client-/Serverdifferenzen.
