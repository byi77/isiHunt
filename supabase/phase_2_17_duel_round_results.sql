-- Phase 2.17: Netzwerk-Duell - Rundenergebnisse persistent statt per Broadcast.
--
-- Nach phase_2_11_duel_rooms.sql (und allen frueheren phase_2_x-Skripten) im
-- Supabase SQL Editor ausfuehren. Wiederholbar, loescht keine Daten.
--
-- ============================================================================
-- Warum dieses Skript existiert
-- ============================================================================
--
-- Belegt durch einen Zwei-Geraete-Testbericht (v0.1.236, 2026-08-22): beide
-- Spieler beendeten ihre Runde und blieben anschliessend dauerhaft auf
-- "WARTE AUF ERGEBNIS" stehen. Das Rundenergebnis lief ausschliesslich ueber
-- einen einmaligen Realtime-Broadcast (`round-result`).
--
-- Das widerspricht der Regel, die in phase_2_11_duel_rooms.sql Abschnitt 3
-- bereits ausgeschrieben steht: seltene, dauerhafte Zustandsaenderungen
-- laufen ueber die Tabelle, haeufige und kurzlebige ueber Broadcast. Ein
-- Rundenergebnis ist selten (genau einmal pro Spieler) und dauerhaft (es
-- entscheidet das Duell) - es gehoert damit in die Tabelle. Der laufende
-- Zwischenstand waehrend des Runs bleibt korrekterweise Broadcast.
--
-- Entscheidend ist dabei nicht nur die Zustellsicherheit: bei einem
-- Netzwerk-Duell gibt es gar kein Zeitfenster, in dem beide Geraete
-- gleichzeitig zuhoeren. Wer zuerst fertig ist, sendet sein Ergebnis,
-- waehrend der andere noch spielt - ein Broadcast in diesem Moment hat
-- prinzipiell keinen Empfaenger, unabhaengig von der Verbindungsqualitaet.
-- Nur eine abfragbare Quelle loest das.

begin;

-- ============================================================================
-- 1. Spalten fuer die beiden Rundenergebnisse
-- ============================================================================
--
-- Feste Spalten je Spielerposition statt einer Zeile pro Ergebnis: es sind
-- garantiert genau zwei (CHALLENGE_PLAYER_COUNT), die Position ist
-- bedeutungstragend (Gastgeber = 0, Gast = 1, siehe
-- ChallengeSystem.submitOnlineRound), und der Raum ist ohnehin schon der
-- Datensatz, der dieses Duell repraesentiert. Eine Nebentabelle brauchte
-- einen Join fuer jeden Statusabruf, ohne etwas zu gewinnen.
--
-- `jsonb` statt drei Einzelspalten je Spieler: das Ergebnis ist eine
-- zusammengehoerige Einheit (score/bestCombo/totalCollected), die der Client
-- als Ganzes schreibt und als Ganzes liest. Ein `null` bedeutet damit
-- eindeutig "hat noch nicht abgegeben" - bei Einzelspalten waere "Punktzahl
-- 0" von "noch nichts da" nicht ohne zusaetzliches Flag unterscheidbar.
alter table public.duel_rooms
  add column if not exists host_result  jsonb,
  add column if not exists guest_result jsonb;

-- ============================================================================
-- 2. Ergebnis abgeben
-- ============================================================================
--
-- Idempotent per `coalesce`: ein wiederholter Aufruf (Netzwerk-Retry,
-- doppelter Scene-Wechsel) darf ein bereits abgegebenes Ergebnis NICHT
-- ueberschreiben. Sonst koennte ein zweiter Aufruf mit einem spaeteren,
-- unvollstaendigen Zustand ein gueltiges Resultat verfaelschen. Das erste
-- abgegebene Ergebnis zaehlt.
create or replace function public.submit_duel_result(
  p_code    text,
  p_is_host boolean,
  p_result  jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.duel_rooms where code = p_code and expires_at > now()) then
    raise exception 'Raum nicht gefunden oder abgelaufen';
  end if;

  -- Format pruefen, damit kein beliebiges JSON in der Tabelle landet: der
  -- Client liest diese Werte spaeter ungeprueft als Zahlen.
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Ungueltiges Ergebnisformat';
  end if;
  if jsonb_typeof(p_result->'score') <> 'number'
     or jsonb_typeof(p_result->'bestCombo') <> 'number'
     or jsonb_typeof(p_result->'totalCollected') <> 'number' then
    raise exception 'Ergebnis unvollstaendig';
  end if;

  if p_is_host then
    update public.duel_rooms
      set host_result = coalesce(host_result, p_result)
      where code = p_code;
  else
    update public.duel_rooms
      set guest_result = coalesce(guest_result, p_result)
      where code = p_code;
  end if;

  return true;
end;
$$;

revoke execute on function public.submit_duel_result(text, boolean, jsonb) from public;
grant execute on function public.submit_duel_result(text, boolean, jsonb) to anon, authenticated;

-- ============================================================================
-- 3. get_duel_room um die Ergebnisse erweitern
-- ============================================================================
--
-- Derselbe Weg, den die Lobby schon fuer die Startzeit nutzt: ein Client, der
-- den Broadcast verpasst hat (oder zum Sendezeitpunkt noch gar nicht
-- zuhoerte), holt den Stand per erneutem Aufruf nach.
--
-- `drop` vor `create`, weil sich die Rueckgabesignatur aendert - Postgres
-- lehnt ein `create or replace` mit geaenderter `returns table`-Struktur ab.
drop function if exists public.get_duel_room(text);

create or replace function public.get_duel_room(p_code text)
returns table (
  seed         text,
  world_id     text,
  host_ready   boolean,
  guest_ready  boolean,
  guest_joined boolean,
  start_at     timestamptz,
  host_result  jsonb,
  guest_result jsonb
)
language sql
security definer
set search_path = public
as $$
  select seed, world_id, host_ready, guest_ready, guest_joined, start_at,
         host_result, guest_result
  from public.duel_rooms
  where code = p_code and expires_at > now();
$$;

revoke execute on function public.get_duel_room(text) from public;
grant execute on function public.get_duel_room(text) to anon, authenticated;

commit;
