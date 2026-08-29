-- Phase 2.35: temporaere Duell-Talente und Rematch im bestehenden Raum.
--
-- Der Build ist kein Teil des Spielstands. Er wird nur bis zum Ablauf des
-- Duell-Raums gespeichert und bei einem Rematch in derselben Code-Verbindung
-- wieder vorgeschlagen. Jede Duell-Generation bekommt einen neuen Seed.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 34
     ) then
    raise exception 'Phase 2.34 muss vor Phase 2.35 ausgefuehrt werden';
  end if;
end;
$$;

alter table public.duel_rooms
  add column if not exists host_talent_draft jsonb not null default '{}'::jsonb,
  add column if not exists guest_talent_draft jsonb not null default '{}'::jsonb,
  add column if not exists host_talent_ready boolean not null default false,
  add column if not exists guest_talent_ready boolean not null default false,
  add column if not exists host_rematch_ready boolean not null default false,
  add column if not exists guest_rematch_ready boolean not null default false,
  add column if not exists match_number integer not null default 1;

-- Ein einziger Server-Validator fuer initiale Builds und Rematches. Damit
-- bleiben Talent-IDs, Maximalraenge und das 10-Punkte-Limit serverseitig
-- verbindlich, obwohl die Spieloberflaeche die +-Logik lokal ausfuehrt.
create or replace function public.normalize_duel_talent_draft(p_draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed jsonb := public.balance_config()->'talents'->'maxRanks';
  safe_draft jsonb := coalesce(p_draft, '{}'::jsonb);
  normalized jsonb := '{}'::jsonb;
  spent integer := 0;
  item record;
  rank_value integer;
  max_rank integer;
begin
  if jsonb_typeof(safe_draft) <> 'object' or pg_column_size(safe_draft) > 4096 then
    raise exception 'Ungueltiger Talent-Build';
  end if;

  for item in select key, value from jsonb_each(safe_draft) loop
    if not (allowed ? item.key)
       or jsonb_typeof(item.value) <> 'number'
       or (item.value #>> '{}')::numeric <> trunc((item.value #>> '{}')::numeric) then
      raise exception 'Ungueltiger Talent-Build';
    end if;

    rank_value := (item.value #>> '{}')::integer;
    max_rank := (allowed->>item.key)::integer;
    if rank_value < 0 or rank_value > max_rank then
      raise exception 'Talent-Rang ausserhalb des Wertebereichs';
    end if;
    spent := spent + rank_value;
    normalized := normalized || jsonb_build_object(item.key, rank_value);
  end loop;

  if spent > 10 then
    raise exception 'Talent-Build ueberschreitet das Punktebudget';
  end if;
  return normalized;
end;
$$;

revoke execute on function public.normalize_duel_talent_draft(jsonb) from public, anon, authenticated;

-- Speichert die Auswahl, bevor der bisherige Ready-Schritt die Startfreigabe
-- setzt. Ein leerer Build ist erlaubt und entspricht "keine Talente".
create or replace function public.submit_duel_talent_draft(
  p_code text,
  p_participant_token text,
  p_draft jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
  safe_draft jsonb := public.normalize_duel_talent_draft(p_draft);
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;

  select * into room
  from public.duel_rooms
  where code = p_code and expires_at > now()
  for update;
  if room is null then raise exception 'Duell nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null or room.host_result is not null or room.guest_result is not null then
    raise exception 'Talent-Build fuer dieses Duell ist bereits gesperrt';
  end if;

  if slot = 0 then
    update public.duel_rooms
    set host_talent_draft = safe_draft, host_talent_ready = true
    where code = p_code;
  else
    update public.duel_rooms
    set guest_talent_draft = safe_draft, guest_talent_ready = true
    where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.submit_duel_talent_draft(text, text, jsonb) from public;
grant execute on function public.submit_duel_talent_draft(text, text, jsonb) to anon, authenticated;

-- Der alte Ready-RPC bleibt die letzte Startfreigabe. Alte Clients ohne
-- Talent-UI werden als leerer Build behandelt; neue Clients speichern ihre
-- Auswahl vorher über submit_duel_talent_draft.
create or replace function public.mark_duel_ready(
  p_code text,
  p_participant_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  if slot = 0 then
    update public.duel_rooms
    set host_talent_ready = true, host_ready = true
    where code = p_code;
  else
    update public.duel_rooms
    set guest_talent_ready = true, guest_ready = true
    where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.mark_duel_ready(text, text) from public;
grant execute on function public.mark_duel_ready(text, text) to anon, authenticated;

drop function if exists public.get_duel_room(text, text);
create or replace function public.get_duel_room(
  p_code text,
  p_participant_token text
)
returns table (
  seed text,
  world_id text,
  match_number integer,
  host_ready boolean,
  guest_ready boolean,
  guest_joined boolean,
  host_talent_ready boolean,
  guest_talent_ready boolean,
  host_talent_draft jsonb,
  guest_talent_draft jsonb,
  start_at timestamptz,
  host_result jsonb,
  guest_result jsonb
)
language sql
security definer
set search_path = public
as $$
  select seed, world_id, match_number, host_ready, guest_ready, guest_joined,
         host_talent_ready, guest_talent_ready, host_talent_draft,
         guest_talent_draft, start_at, host_result, guest_result
  from public.duel_rooms
  where code = p_code and expires_at > now()
    and public.duel_participant_slot(code, p_participant_token) is not null;
$$;

revoke execute on function public.get_duel_room(text, text) from public;
grant execute on function public.get_duel_room(text, text) to anon, authenticated;

-- Beide Spieler bestaetigen im selben Raum ihr Rematch. Der zweite Aufruf
-- erzeugt atomar den neuen Seed und setzt die laufende Generation zurueck.
create or replace function public.request_duel_rematch(
  p_code text,
  p_participant_token text,
  p_draft jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
  safe_draft jsonb := public.normalize_duel_talent_draft(p_draft);
  next_seed text;
  next_match integer;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;

  select * into room
  from public.duel_rooms
  where code = p_code and expires_at > now()
  for update;
  if room is null then raise exception 'Duell nicht gefunden oder abgelaufen'; end if;
  if room.host_result is null or room.guest_result is null then
    raise exception 'Rematch erst nach beiden Ergebnissen moeglich';
  end if;

  if slot = 0 then
    update public.duel_rooms
    set host_talent_draft = safe_draft, host_rematch_ready = true
    where code = p_code;
  else
    update public.duel_rooms
    set guest_talent_draft = safe_draft, guest_rematch_ready = true
    where code = p_code;
  end if;

  select * into room from public.duel_rooms where code = p_code for update;
  if room.host_rematch_ready and room.guest_rematch_ready then
    next_seed := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    next_match := room.match_number + 1;
    update public.duel_rooms
    set seed = next_seed,
        match_number = next_match,
        host_ready = false,
        guest_ready = false,
        host_talent_ready = false,
        guest_talent_ready = false,
        host_rematch_ready = false,
        guest_rematch_ready = false,
        start_at = null,
        host_result = null,
        guest_result = null
    where code = p_code;
    return jsonb_build_object(
      'ready', true,
      'matchNumber', next_match,
      'seed', next_seed
    );
  end if;

  return jsonb_build_object(
    'ready', true,
    'matchNumber', room.match_number,
    'seed', null
  );
end;
$$;

revoke execute on function public.request_duel_rematch(text, text, jsonb) from public;
grant execute on function public.request_duel_rematch(text, text, jsonb) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 35,
    migration_name = 'phase_2_35_duel_talents_rematch.sql',
    applied_at = now()
where singleton = true;

commit;

notify pgrst, 'reload schema';
