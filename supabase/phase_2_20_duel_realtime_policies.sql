-- Phase 2.20: Netzwerk-Duell - Realtime-Policies fuer Senden und Presence.
--
-- Nach phase_2_11_duel_rooms.sql (und allen frueheren phase_2_x-Skripten) im
-- Supabase SQL Editor ausfuehren. Wiederholbar, loescht keine Daten.
--
-- ============================================================================
-- Warum dieses Skript existiert
-- ============================================================================
--
-- Der laufende Punktestand des Gegners kam waehrend eines Netzwerk-Duells nie
-- beim anderen Geraet an. Belegt ueber mehrere Zwei-Geraete-Berichte
-- (2026-08-23 bis 2026-08-28): beide Geraete meldeten `SUBSCRIBED`, beide
-- spielten ihre Runde durch, beide gaben ihr Ergebnis ab - aber die
-- Gegneranzeige stand die ganze Runde auf 0.
--
-- Die Policy aus phase_2_11_duel_rooms.sql Abschnitt 4 hat zwei Luecken:
--
--   1. Sie ist ausschliesslich `for select`. Supabase Realtime verlangt fuer
--      das SENDEN auf einem privaten Kanal eine eigene `for insert`-Policy;
--      ohne sie darf ein Client dem Kanal beitreten und mithoeren, aber
--      nichts hineinschreiben.
--
--   2. Sie beschraenkt auf `extension = 'broadcast'`. Presence ist damit
--      nicht abgedeckt - weder lesend noch schreibend. Das erklaert, warum in
--      den Berichten ueber ganze Runden hinweg kein einziges
--      Presence-Ereignis auftauchte: nicht weil Presence ausfiel, sondern
--      weil die Policy es nie durchliess.
--
-- ============================================================================
-- Warum das so lange unentdeckt blieb
-- ============================================================================
--
-- `channel.send()` loeste ohne die Option `broadcast.ack` sofort mit "ok"
-- auf, sobald die Nachricht lokal in der Warteschlange lag - eine
-- serverseitige Ablehnung wurde dabei still verworfen. Die eigens eingebaute
-- Sendeprotokollierung (`duel:send/live`, seit v0.1.250) meldete deshalb ueber
-- rund 225 Sendeversuche keinen einzigen Fehler, obwohl moeglicherweise keine
-- einzige Nachricht den Server passierte. Aus diesem Schweigen wurde faelsch-
-- licherweise auf einen funktionierenden Sendepfad geschlossen.
--
-- Der Client setzt deshalb seit v0.1.255 `broadcast: { ack: true }`
-- (`NetworkDuelSystem.subscribeToRoom`). Erst damit wird eine Ablehnung
-- sichtbar - und erst damit ist ueberpruefbar, ob dieses Skript gewirkt hat.
--
-- ============================================================================
-- Sicherheitsabwaegung
-- ============================================================================
--
-- Die Bedingung bleibt identisch zur bestehenden SELECT-Policy: Zugriff
-- ausschliesslich auf einen Kanal, dessen Topic-Name einem gueltigen,
-- nicht abgelaufenen Raum-Code entspricht. Wer den Code nicht kennt, kann
-- weder mithoeren noch senden. Kein Login noetig - konsistent mit ADR-0011
-- ("keine Anmeldung noetig") und mit der Begruendung in
-- phase_2_11_duel_rooms.sql Abschnitt 4.
--
-- Die Ausweitung auf `presence` erweitert den Zugriff nicht auf fremde
-- Raeume: dieselbe EXISTS-Subquery gegen `duel_rooms` gilt unveraendert. Sie
-- erlaubt lediglich, im BEREITS autorisierten Kanal die Anwesenheit zu melden
-- und zu lesen.
--
-- Die INSERT-Policy gibt kein Schreibrecht auf Spieldaten: `realtime.messages`
-- traegt fluechtige Kanalnachrichten, keinen Spielstand. Der Spielstand bleibt
-- ueber die security-definer-RPCs geschuetzt (phase_2_10_lock_saves_access.sql),
-- und das Rundenergebnis laeuft weiterhin ueber `submit_duel_result`
-- (phase_2_17), nicht ueber den Kanal.

begin;

-- ============================================================================
-- 1. Lesende Policy: Broadcast UND Presence
-- ============================================================================
--
-- Ersetzt die Policy aus phase_2_11_duel_rooms.sql. Gleicher Name, damit kein
-- verwaister Doppelgaenger zurueckbleibt - `drop policy if exists` macht das
-- Skript wiederholbar.

drop policy if exists "Duell-Raum-Teilnehmer duerfen den Kanal nutzen" on "realtime"."messages";
create policy "Duell-Raum-Teilnehmer duerfen den Kanal nutzen"
  on "realtime"."messages"
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duel_rooms
      where code = (select realtime.topic())
        and expires_at > now()
    )
    and realtime.messages.extension in ('broadcast', 'presence')
  );

-- ============================================================================
-- 2. Schreibende Policy: ohne sie kommt kein Zwischenstand beim Gegner an
-- ============================================================================
--
-- Die eigentliche Luecke. Bis hierher durfte jeder Teilnehmer zuhoeren, aber
-- niemand senden.

drop policy if exists "Duell-Raum-Teilnehmer duerfen im Kanal senden" on "realtime"."messages";
create policy "Duell-Raum-Teilnehmer duerfen im Kanal senden"
  on "realtime"."messages"
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.duel_rooms
      where code = (select realtime.topic())
        and expires_at > now()
    )
    and realtime.messages.extension in ('broadcast', 'presence')
  );

commit;

notify pgrst, 'reload schema';
