-- Phase 2.42: Erstes Online-Duell - Talentphase vor dem Rundenstart.
--
-- Der bisherige Host-Start setzte sofort start_at und die Clients wechselten
-- direkt in GameScene. Die bereits vorhandene Talent-Build-Logik wurde dadurch
-- beim ersten Duell nie erreicht; sie war nur fuer Rematches eingebunden.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 41
     ) then
    raise exception 'Phase 2.41 muss vor Phase 2.42 ausgefuehrt werden';
  end if;
end;
$$;

alter table public.duel_rooms
  add column if not exists talent_draft_started_at timestamptz;

-- Setzt die persistente Talentphase zurueck, wenn ein Rematch eine neue
-- Generation oeffnet. Der bestehende Rematch-RPC setzt start_at auf NULL.
create or replace function public.reset_duel_talent_draft_marker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.start_at is not null and new.start_at is null then
    new.talent_draft_started_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists duel_talent_draft_marker_reset on public.duel_rooms;
create trigger duel_talent_draft_marker_reset
before update of start_at on public.duel_rooms
for each row execute function public.reset_duel_talent_draft_marker();
revoke execute on function public.reset_duel_talent_draft_marker() from public, anon, authenticated;

create or replace function public.start_duel_talent_draft(
  p_code text,
  p_participant_token text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
  participant_count integer;
  started_at timestamptz;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  if slot <> 0 then raise exception 'Nur der Host darf die Talentphase starten'; end if;

  select r.* into room
  from public.duel_rooms as r
  where r.code = p_code and r.expires_at > now()
  for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null then raise exception 'Duell ist bereits gestartet'; end if;

  select count(*) into participant_count
  from public.duel_room_participants as p
  where p.room_code = p_code;
  if participant_count < 2 then raise exception 'Mindestens zwei Spieler benoetigt'; end if;

  started_at := coalesce(room.talent_draft_started_at, now());
  update public.duel_rooms as r
  set talent_draft_started_at = started_at
  where r.code = p_code;
  return started_at;
end;
$$;

revoke execute on function public.start_duel_talent_draft(text, text) from public, anon;
grant execute on function public.start_duel_talent_draft(text, text) to anon, authenticated;

drop function if exists public.set_duel_start_time(text, text);
create or replace function public.set_duel_start_time(
  p_code text,
  p_participant_token text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
  participant_count integer;
  talent_ready_count integer;
  computed_start timestamptz;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  if slot <> 0 then raise exception 'Nur der Host darf das Duell starten'; end if;

  select r.* into room
  from public.duel_rooms as r
  where r.code = p_code and r.expires_at > now()
  for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null then return room.start_at; end if;
  if room.talent_draft_started_at is null then
    raise exception 'Talentphase wurde noch nicht gestartet';
  end if;

  select count(*) into participant_count
  from public.duel_room_participants as p
  where p.room_code = p_code;
  if participant_count < 2 then raise exception 'Mindestens zwei Spieler benoetigt'; end if;

  select count(*) into talent_ready_count
  from public.duel_room_participants as p
  where p.room_code = p_code and p.talent_ready;
  if talent_ready_count < participant_count then
    raise exception 'Alle Spieler muessen ihren Talent-Build bestaetigen';
  end if;

  computed_start := now() + interval '5 seconds';
  update public.duel_rooms as r
  set start_at = computed_start
  where r.code = p_code;
  return computed_start;
end;
$$;

revoke execute on function public.set_duel_start_time(text, text) from public;
grant execute on function public.set_duel_start_time(text, text) to anon, authenticated;

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
  guest_result jsonb,
  player_count integer,
  max_players integer,
  player_results jsonb,
  talent_draft_started_at timestamptz,
  talent_ready_count integer
)
language sql
security definer
set search_path = public
as $$
  select r.seed, r.world_id, r.match_number, r.host_ready, r.guest_ready,
         r.guest_joined, r.host_talent_ready, r.guest_talent_ready,
         r.host_talent_draft, r.guest_talent_draft, r.start_at,
         r.host_result, r.guest_result,
         (select count(*)::integer from public.duel_room_participants as p
          where p.room_code = r.code),
         r.max_players,
         coalesce((select jsonb_agg(coalesce(p.result, 'null'::jsonb)
                                    order by p.player_index)
                   from public.duel_room_participants as p
                   where p.room_code = r.code), '[]'::jsonb),
         r.talent_draft_started_at,
         (select count(*)::integer from public.duel_room_participants as p
          where p.room_code = r.code and p.talent_ready)
  from public.duel_rooms as r
  where r.code = p_code and r.expires_at > now()
    and public.duel_participant_slot(r.code, p_participant_token) is not null;
$$;

revoke execute on function public.get_duel_room(text, text) from public;
grant execute on function public.get_duel_room(text, text) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 42,
    migration_name = 'phase_2_42_duel_initial_talent_draft.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
