-- Phase 2.46: Ergebnisannahme vom Lobby-Ablauf entkoppeln.
--
-- AUDIT_2026-09-05, Befund 5 (P2):
-- `leave_duel_room` zieht das Ablaufdatum des gesamten Raums auf `now()` vor,
-- sobald EIN Teilnehmer zurueck ins Menue geht. `duel_participant_slot`
-- verlangt aber `expires_at > now()` - danach gilt niemand mehr als
-- berechtigt. Wer als Erster fertig war und zurueckging, sperrte damit alle
-- anderen aus: ihr `submit_duel_result` scheiterte mit
-- "Duell-Teilnehmer nicht autorisiert", das Match fehlte in der Rangliste.
--
-- Das trifft den Normalfall, nicht nur den Fehlerfall: unterschiedliche
-- Ausdauer-Talente erzeugen unterschiedliche Endzeiten.
--
-- Korrektur: Zwei getrennte Fragen, zwei getrennte Funktionen.
--
--   * "Ist die Lobby noch offen?"       -> `duel_participant_slot` (unveraendert)
--     Steuert Beitritt, Einladungen und Start. Ein verlassener Raum ist hier
--     sofort zu, damit `create_duel_invitation` neue Einladungen zulaesst -
--     genau der Zweck von Phase 2.43.
--
--   * "Darf dieses Ergebnis noch rein?" -> `duel_result_slot` (neu)
--     Gilt zusaetzlich fuer bereits gestartete Runden innerhalb eines
--     Abschlussfensters. Nur `submit_duel_result` benutzt sie.
--
-- Das Fenster laeuft ab `start_at`, nicht ab `expires_at`: es haengt damit an
-- der Rundendauer und nicht daran, wann jemand das Menue gedrueckt hat.
-- 10 Minuten decken die 90-Sekunden-Runde plus Nachreichen nach einem
-- Funkloch ab und bleiben knapp genug, dass ein Ergebnis nicht beliebig
-- spaet nachgeschoben werden kann.
--
-- Diese Migration ist wiederholbar.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 45
     ) then
    raise exception 'Phase 2.45 muss vor Phase 2.46 ausgefuehrt werden';
  end if;
end;
$$;

-- Abschlussfenster ab Rundenstart, in dem Ergebnisse noch angenommen werden.
create or replace function public.duel_result_grace()
returns interval
language sql
immutable
as $$ select interval '10 minutes' $$;

/*
 * Berechtigung zum Einreichen eines Ergebnisses.
 *
 * Unterschied zu `duel_participant_slot`: ein abgelaufener Raum ist hier noch
 * gueltig, solange die Runde gestartet ist und das Abschlussfenster laeuft.
 * Ein Raum, der NIE gestartet wurde, faellt weiterhin sofort mit dem Ablauf
 * heraus - ohne `start_at` gibt es kein Ergebnis zu retten.
 */
create or replace function public.duel_result_slot(
  p_code text,
  p_participant_token text
)
returns integer
language sql
security definer
set search_path = public
as $$
  select p.player_index
  from public.duel_room_participants p
  join public.duel_rooms r on r.code = p.room_code
  where p.room_code = p_code
    and p.token_hash = md5(p_participant_token)
    and (
      r.expires_at > now()
      or (r.start_at is not null and now() < r.start_at + public.duel_result_grace())
    )
  limit 1;
$$;

revoke execute on function public.duel_result_slot(text, text) from public, anon, authenticated;
revoke execute on function public.duel_result_grace() from public, anon, authenticated;

/*
 * Wie phase_2_38, mit zwei Aenderungen:
 *   1. `duel_result_slot` statt `duel_participant_slot`.
 *   2. Der Raum wird im Abschlussfenster auch dann geladen, wenn er bereits
 *      abgelaufen ist. Alle Plausibilitaetspruefungen bleiben unveraendert -
 *      das Fenster lockert die Berechtigung, nicht die Wertepruefung.
 */
create or replace function public.submit_duel_result(
  p_code text,
  p_participant_token text,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer := public.duel_result_slot(p_code, p_participant_token);
  safe_score numeric;
  safe_combo numeric;
  safe_collected numeric;
  collected_total numeric := 0;
  safe_duration integer := 90000;
  safe_collected_data jsonb;
  item record;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  select * into room from public.duel_rooms
  where code = p_code
    and (
      expires_at > now()
      or (start_at is not null and now() < start_at + public.duel_result_grace())
    )
  for update;
  if room is null then raise exception 'Duell nicht gefunden oder abgelaufen'; end if;
  if room.start_at is null or now() < room.start_at then raise exception 'Duell noch nicht gestartet'; end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then raise exception 'Ungueltiges Ergebnisformat'; end if;
  if pg_column_size(p_result) > 8192 then raise exception 'Ergebnis zu gross'; end if;
  if jsonb_typeof(p_result->'score') <> 'number'
     or jsonb_typeof(p_result->'bestCombo') <> 'number'
     or jsonb_typeof(p_result->'totalCollected') <> 'number' then
    raise exception 'Ergebnis unvollstaendig';
  end if;

  safe_score := (p_result->>'score')::numeric;
  safe_combo := (p_result->>'bestCombo')::numeric;
  safe_collected := (p_result->>'totalCollected')::numeric;
  if safe_score <> trunc(safe_score) or safe_combo <> trunc(safe_combo)
     or safe_collected <> trunc(safe_collected) or safe_score < 0
     or safe_score > 10000000 or safe_combo < 0 or safe_collected < 0 then
    raise exception 'Ergebnis ausserhalb des Wertebereichs';
  end if;

  if p_result ? 'durationMs' then
    if jsonb_typeof(p_result->'durationMs') <> 'number'
       or (p_result->>'durationMs')::numeric <> trunc((p_result->>'durationMs')::numeric) then
      raise exception 'Ungueltige Rundendauer';
    end if;
    safe_duration := (p_result->>'durationMs')::integer;
  end if;
  if safe_duration < 60000 or safe_duration > 120000 then raise exception 'Ungueltige Rundendauer'; end if;
  if safe_collected > ceil(safe_duration / 190.0) or safe_combo > safe_collected then
    raise exception 'Ergebnis nicht plausibel';
  end if;

  if p_result ? 'collected' then
    if jsonb_typeof(p_result->'collected') <> 'object' then raise exception 'Ungueltige Reliktstatistik'; end if;
    safe_collected_data := p_result->'collected';
  else
    safe_collected_data := jsonb_build_object('legendary', safe_collected::integer);
  end if;
  for item in select key, value from jsonb_each(safe_collected_data) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary')
       or jsonb_typeof(item.value) <> 'number'
       or (item.value #>> '{}')::numeric < 0
       or (item.value #>> '{}')::numeric <> trunc((item.value #>> '{}')::numeric) then
      raise exception 'Ungueltige Reliktstatistik';
    end if;
    collected_total := collected_total + (item.value #>> '{}')::numeric;
  end loop;
  if collected_total <> safe_collected then raise exception 'Reliktstatistik passt nicht zum Ergebnis'; end if;
  if safe_score > public.max_plausible_score(
    room.world_id, safe_duration, safe_combo::integer, safe_collected_data
  ) then raise exception 'Ergebnis nicht plausibel'; end if;

  update public.duel_room_participants
  set result = coalesce(result, p_result)
  where room_code = p_code and player_index = slot;
  if slot = 0 then
    update public.duel_rooms set host_result = coalesce(host_result, p_result) where code = p_code;
  elsif slot = 1 then
    update public.duel_rooms set guest_result = coalesce(guest_result, p_result) where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.submit_duel_result(text, text, jsonb) from public;
grant execute on function public.submit_duel_result(text, text, jsonb) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 46,
    migration_name = 'phase_2_46_duel_result_grace.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
