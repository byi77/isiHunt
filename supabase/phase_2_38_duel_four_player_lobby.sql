-- Phase 2.38: oeffentliche Duell-Lobby fuer zwei bis vier Spieler.
--
-- Ein Raum hat einen Host und bis zu drei weitere Teilnehmer. Der Host darf
-- ab zwei Teilnehmern starten; die Lobby wartet nicht mehr darauf, dass jeder
-- Spieler zuerst einen Ready-Button bestaetigt.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 37
     ) then
    raise exception 'Phase 2.37 muss vor Phase 2.38 ausgefuehrt werden';
  end if;
end;
$$;

-- Die alten host_/guest_-Spalten bleiben fuer bestehende Auswertungen und
-- alte Raeume erhalten. Die Teilnehmer-Tabelle ist die neue Quelle fuer Slots,
-- Builds und Ergebnisse und kann ohne weitere Spalten bis Slot 3 wachsen.
alter table public.duel_rooms
  add column if not exists max_players integer not null default 4;

alter table public.duel_rooms
  drop constraint if exists duel_rooms_max_players;
alter table public.duel_rooms
  add constraint duel_rooms_max_players check (max_players between 2 and 4);

create table if not exists public.duel_room_participants (
  room_code       text not null references public.duel_rooms (code) on delete cascade,
  player_index    integer not null check (player_index between 0 and 3),
  token_hash      text not null,
  profile_id      uuid references public.profiles (id) on delete set null,
  talent_draft    jsonb not null default '{}'::jsonb,
  talent_ready    boolean not null default false,
  rematch_ready   boolean not null default false,
  result          jsonb,
  joined_at       timestamptz not null default now(),
  primary key (room_code, player_index),
  unique (token_hash)
);

alter table public.duel_room_participants enable row level security;
revoke all on public.duel_room_participants from anon, authenticated;

create index if not exists duel_room_participants_token_idx
  on public.duel_room_participants (token_hash);

-- Oude, nog bruikbare Raeume bekommen ihre beiden vorhandenen Slots.
insert into public.duel_room_participants (room_code, player_index, token_hash, profile_id,
                                           talent_draft, talent_ready, rematch_ready, result)
select code, 0, host_token_hash, host_profile_id,
       coalesce(host_talent_draft, '{}'::jsonb), coalesce(host_talent_ready, false),
       coalesce(host_rematch_ready, false), host_result
from public.duel_rooms
where host_token_hash is not null
on conflict (room_code, player_index) do nothing;

insert into public.duel_room_participants (room_code, player_index, token_hash, profile_id,
                                           talent_draft, talent_ready, rematch_ready, result)
select code, 1, guest_token_hash, guest_profile_id,
       coalesce(guest_talent_draft, '{}'::jsonb), coalesce(guest_talent_ready, false),
       coalesce(guest_rematch_ready, false), guest_result
from public.duel_rooms
where guest_token_hash is not null
on conflict (room_code, player_index) do nothing;

-- Auch die bereits ausgefuehrten create-/invite-RPCs legen beim naechsten
-- Aufruf ihre Legacy-Token in der neuen Tabelle an. Der Trigger ist bewusst
-- idempotent: join_duel_room fuehrt danach noch ein INSERT fuer Slot 1 aus,
-- das bei einem bereits eingetragenen Legacy-Gast nur noch ein no-op ist.
create or replace function public.sync_duel_room_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.host_token_hash is not null then
    insert into public.duel_room_participants (room_code, player_index, token_hash, profile_id,
                                               talent_draft, talent_ready, rematch_ready, result)
    values (new.code, 0, new.host_token_hash, new.host_profile_id,
            coalesce(new.host_talent_draft, '{}'::jsonb), coalesce(new.host_talent_ready, false),
            coalesce(new.host_rematch_ready, false), new.host_result)
    on conflict (room_code, player_index) do nothing;
  end if;

  if new.guest_token_hash is not null then
    insert into public.duel_room_participants (room_code, player_index, token_hash, profile_id,
                                               talent_draft, talent_ready, rematch_ready, result)
    values (new.code, 1, new.guest_token_hash, new.guest_profile_id,
            coalesce(new.guest_talent_draft, '{}'::jsonb), coalesce(new.guest_talent_ready, false),
            coalesce(new.guest_rematch_ready, false), new.guest_result)
    on conflict (room_code, player_index) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists duel_room_participants_sync on public.duel_rooms;
create trigger duel_room_participants_sync
after insert or update of host_token_hash, guest_token_hash on public.duel_rooms
for each row execute function public.sync_duel_room_participants();
revoke execute on function public.sync_duel_room_participants() from public, anon, authenticated;

create or replace function public.duel_participant_slot(
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
    and r.expires_at > now()
  limit 1;
$$;

revoke execute on function public.duel_participant_slot(text, text) from public, anon, authenticated;

-- Die Signatur mit vier Argumenten ist der neue Pfad. Die Drei-Argument-
-- Fassung bleibt als Kompatibilitaetswrapper fuer alte Aufrufer bestehen.
drop function if exists public.create_duel_room(text, text, text);
create or replace function public.create_duel_room(
  p_world_id text,
  p_code text,
  p_seed text,
  p_max_players integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_id uuid;
  participant_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  server_seed text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if p_world_id is null or not (public.balance_config()->'worlds' ? p_world_id) then
    raise exception 'Ungueltige Welt';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then raise exception 'Ungueltiges Code-Format'; end if;
  if p_seed is null or char_length(trim(p_seed)) = 0 or char_length(p_seed) > 128 then
    raise exception 'Ungueltiger Seed';
  end if;
  if p_max_players < 2 or p_max_players > 4 then
    raise exception 'Ungueltige Spielerzahl';
  end if;

  select id into profile_id from public.profiles where id = uid;
  insert into public.duel_rooms (
    code, seed, world_id, max_players, host_token_hash, host_profile_id
  ) values (
    p_code, server_seed, p_world_id, p_max_players, md5(participant_token), profile_id
  );

  return jsonb_build_object(
    'participantToken', participant_token,
    'seed', server_seed,
    'playerIndex', 0,
    'playerCount', 1,
    'maxPlayers', p_max_players
  )::text;
end;
$$;

revoke execute on function public.create_duel_room(text, text, text, integer) from public;
grant execute on function public.create_duel_room(text, text, text, integer) to anon, authenticated;

create or replace function public.create_duel_room(
  p_world_id text,
  p_code text,
  p_seed text
)
returns text
language sql
security definer
set search_path = public
as $$
  select public.create_duel_room(p_world_id, p_code, p_seed, 4);
$$;

revoke execute on function public.create_duel_room(text, text, text) from public;
grant execute on function public.create_duel_room(text, text, text) to anon, authenticated;

drop function if exists public.join_duel_room(text);
create or replace function public.join_duel_room(p_code text)
returns table (
  seed text,
  world_id text,
  participant_token text,
  player_index integer,
  player_count integer,
  max_players integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_id uuid;
  room record;
  guest_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  slot integer;
  current_count integer;
begin
  select * into room from public.duel_rooms
  where code = p_code and expires_at > now()
  for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.invite_only then raise exception 'Dieser Raum ist nur ueber eine Einladung zugaenglich'; end if;
  if room.start_at is not null then raise exception 'Duell bereits gestartet'; end if;

  select min(candidate) into slot
  from generate_series(1, room.max_players - 1) as candidate
  where not exists (
    select 1 from public.duel_room_participants p
    where p.room_code = p_code and p.player_index = candidate
  );
  if slot is null then raise exception 'Raum bereits voll'; end if;

  select id into profile_id from public.profiles where id = uid;
  insert into public.duel_room_participants (room_code, player_index, token_hash, profile_id)
  values (p_code, slot, md5(guest_token), profile_id);

  if slot = 1 then
    update public.duel_rooms
    set guest_joined = true, guest_token_hash = md5(guest_token), guest_profile_id = profile_id
    where code = p_code;
  end if;

  select count(*) into current_count
  from public.duel_room_participants p where p.room_code = p_code;
  return query select room.seed, room.world_id, guest_token, slot, current_count, room.max_players;
end;
$$;

revoke execute on function public.join_duel_room(text) from public;
grant execute on function public.join_duel_room(text) to anon, authenticated;

-- Ready bleibt fuer alte Clients verfuegbar, ist aber kein Startkriterium mehr.
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
  update public.duel_room_participants set talent_ready = true
  where room_code = p_code and player_index = slot;
  if slot = 0 then
    update public.duel_rooms set host_talent_ready = true, host_ready = true where code = p_code;
  elsif slot = 1 then
    update public.duel_rooms set guest_talent_ready = true, guest_ready = true where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.mark_duel_ready(text, text) from public;
grant execute on function public.mark_duel_ready(text, text) to anon, authenticated;

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
  select * into room from public.duel_rooms
  where code = p_code and expires_at > now() for update;
  if room is null then raise exception 'Duell nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null then raise exception 'Talent-Build bereits gesperrt'; end if;

  update public.duel_room_participants
  set talent_draft = safe_draft, talent_ready = true
  where room_code = p_code and player_index = slot;

  if slot = 0 then
    update public.duel_rooms set host_talent_draft = safe_draft, host_talent_ready = true
    where code = p_code;
  elsif slot = 1 then
    update public.duel_rooms set guest_talent_draft = safe_draft, guest_talent_ready = true
    where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.submit_duel_talent_draft(text, text, jsonb) from public;
grant execute on function public.submit_duel_talent_draft(text, text, jsonb) to anon, authenticated;

-- Nur der Host startet. Ab zwei Teilnehmern ist der Raum startbereit; weitere
-- Spieler koennen bis zum Start noch beitreten.
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
  computed_start timestamptz;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  if slot <> 0 then raise exception 'Nur der Host darf das Duell starten'; end if;

  select * into room from public.duel_rooms
  where code = p_code and expires_at > now() for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null then return room.start_at; end if;

  select count(*) into participant_count
  from public.duel_room_participants p where p.room_code = p_code;
  if participant_count < 2 then raise exception 'Mindestens zwei Spieler benoetigt'; end if;

  computed_start := now() + interval '5 seconds';
  update public.duel_rooms set start_at = computed_start where code = p_code;
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
  player_results jsonb
)
language sql
security definer
set search_path = public
as $$
  select r.seed, r.world_id, r.match_number, r.host_ready, r.guest_ready,
         r.guest_joined, r.host_talent_ready, r.guest_talent_ready,
         r.host_talent_draft, r.guest_talent_draft, r.start_at,
         r.host_result, r.guest_result,
         (select count(*)::integer from public.duel_room_participants p
          where p.room_code = r.code),
         r.max_players,
         coalesce((select jsonb_agg(coalesce(p.result, 'null'::jsonb)
                                    order by p.player_index)
                   from public.duel_room_participants p
                   where p.room_code = r.code), '[]'::jsonb)
  from public.duel_rooms r
  where r.code = p_code and r.expires_at > now()
    and public.duel_participant_slot(r.code, p_participant_token) is not null;
$$;

revoke execute on function public.get_duel_room(text, text) from public;
grant execute on function public.get_duel_room(text, text) to anon, authenticated;

-- Dasselbe serverseitige Plausibilitaetsgate wie Phase 2.31, jetzt mit einem
-- Ergebnis je Teilnehmer-Slot statt nur host_result/guest_result.
drop function if exists public.submit_duel_result(text, text, jsonb);
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
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
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
  where code = p_code and expires_at > now() for update;
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

-- Rematches bleiben fuer klassische Zwei-Spieler-Raeume erhalten. Eine
-- Mehrspieler-Lobby kann nach dem Ergebnis neu erstellt werden, damit alle
-- Slots wieder frei und der Host eindeutig sind.
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
  participant_count integer;
  ready_count integer;
  next_seed text;
  next_match integer;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  select * into room from public.duel_rooms where code = p_code and expires_at > now() for update;
  if room is null then raise exception 'Duell nicht gefunden oder abgelaufen'; end if;
  select count(*) into participant_count from public.duel_room_participants p where p.room_code = p_code;
  if participant_count <> 2 then raise exception 'Rematch ist nur fuer zwei Spieler verfuegbar'; end if;
  if room.host_result is null or room.guest_result is null then
    raise exception 'Rematch erst nach beiden Ergebnissen moeglich';
  end if;

  update public.duel_room_participants
  set talent_draft = safe_draft, rematch_ready = true
  where room_code = p_code and player_index = slot;
  if slot = 0 then
    update public.duel_rooms set host_talent_draft = safe_draft, host_rematch_ready = true where code = p_code;
  else
    update public.duel_rooms set guest_talent_draft = safe_draft, guest_rematch_ready = true where code = p_code;
  end if;

  select count(*) into ready_count
  from public.duel_room_participants p where p.room_code = p_code and p.rematch_ready;
  if ready_count = participant_count then
    next_seed := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    next_match := room.match_number + 1;
    update public.duel_rooms
    set seed = next_seed, match_number = next_match,
        host_ready = false, guest_ready = false,
        host_talent_ready = false, guest_talent_ready = false,
        host_rematch_ready = false, guest_rematch_ready = false,
        start_at = null, host_result = null, guest_result = null
    where code = p_code;
    update public.duel_room_participants
    set talent_ready = false, rematch_ready = false, result = null
    where room_code = p_code;
    return jsonb_build_object('ready', true, 'matchNumber', next_match, 'seed', next_seed);
  end if;
  return jsonb_build_object('ready', true, 'matchNumber', room.match_number, 'seed', null);
end;
$$;

revoke execute on function public.request_duel_rematch(text, text, jsonb) from public;
grant execute on function public.request_duel_rematch(text, text, jsonb) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 38,
    migration_name = 'phase_2_38_duel_four_player_lobby.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
