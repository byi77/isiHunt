# Deploy-Runbook fuer Reward-Code-Vertraege

1. Migration und authentifizierten Handler kompatibel ausrollen.
2. Read-only SQL-Verifikation von Schema-, RPC-, RLS- und Versionsmarker
   ausfuehren.
3. Konkurrenzabnahme mit isolierten Konten aus
   `docs/REWARD_CODE_SQL_TEST_PLAN.md` abschliessen.
4. Client deployen und oeffentliche Version verifizieren.
5. Einloesungen erst fuer eine kleine Testaktion aktivieren.
6. Abbruchschalter fuer Einloesung, Start und Finish separat pruefen.
7. Nachkontrolle: keine Klartextcodes in Logs, keine doppelten Grants,
   keine offenen Versuche ohne Ablaufbehandlung.

Bei einem Fehler bleiben Grants und Auditbelege erhalten. Rollback bedeutet
nicht, Buchungsdaten zu loeschen; Korrekturen erfolgen als neue, auditierte
Vorwaertsbuchung.

Aktueller Stand: Dieses Runbook ist vorbereitet, aber nicht ausgefuehrt.
Reward-RPCs und die benoetigte Testdatenbank fehlen noch.
