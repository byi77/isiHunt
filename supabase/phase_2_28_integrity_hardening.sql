-- Phase 2.28: Outbox-, Save-, Tagesbonus- und Duell-Integritaet.
--
-- Diese Migration ist wiederholbar und loescht keine produktiven Daten.
-- Sie ersetzt bewusst nur alte RPC-Signaturen, deren Client-Argumente eine
-- fremde Identitaet, einen frei waehlbaren Tages-Score oder einen parallelen
-- Save-Stand vortaeuschen konnten.

begin;

-- ============================================================================
-- 1. Tageslauf: Bonus an das serverseitig validierte Event binden
-- ============================================================================

alter table public.profile_progress_events
  add column if not exists daily_key text;

create index if not exists profile_progress_events_daily_idx
  on public.profile_progress_events (profile_id, daily_key, created_at);

-- Die alte Funktion bleibt intern als validierender Run-Importer erhalten,
-- ist aber kein oeffentlicher RPC mehr. Die neue Fassung unten setzt den
-- Tagesmarker nur bei einem erstmaligen Event und kann einen normalen Run
-- nicht nachtraeglich in einen Tageslauf umetikettieren.
revoke execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]
) from public, anon, authenticated;

drop function if exists public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], text
);

create or replace function public.submit_progress_event(
  p_event_id uuid,
  p_world_id text,
  p_score integer,
  p_best_combo integer,
  p_xp_gained integer,
  p_coins_gained integer,
  p_duration_ms integer,
  p_talent_points_gained integer,
  p_collected jsonb,
  p_achievement_ids text[],
  p_daily_key text
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_daily_key text;
begin
  if p_daily_key is not null and not public.daily_key_is_plausible(p_daily_key) then
    raise exception 'Ungueltiger Tageslauf';
  end if;

  select daily_key into existing_daily_key
  from public.profile_progress_events
  where event_id = p_event_id and profile_id = auth.uid();

  if found then
    if existing_daily_key is distinct from p_daily_key then
      raise exception 'Ereignis-ID bereits mit anderem Lauf-Typ verwendet';
    end if;
    return query select * from public.submit_progress_event(
      p_event_id, p_world_id, p_score, p_best_combo, p_xp_gained,
      p_coins_gained, p_duration_ms, p_talent_points_gained,
      p_collected, p_achievement_ids
    );
    return;
  end if;

  return query select * from public.submit_progress_event(
    p_event_id, p_world_id, p_score, p_best_combo, p_xp_gained,
    p_coins_gained, p_duration_ms, p_talent_points_gained,
    p_collected, p_achievement_ids
  );

  update public.profile_progress_events
  set daily_key = p_daily_key
  where event_id = p_event_id
    and profile_id = auth.uid()
    and daily_key is null;
end;
$$;

revoke execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], text
) from public;
grant execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], text
) to authenticated;

-- Der Score kommt ausschliesslich aus dem zuvor plausibilisierten Event. Ein
-- RPC-Aufrufer kann weder den Score fuer die Belohnungsstufe erhoehen noch
-- eine fremde/mehrfach verwendete Event-ID als Tageslauf verwenden.
drop function if exists public.claim_daily_bonus(text, integer, uuid);
drop function if exists public.claim_daily_bonus(text, uuid);

create or replace function public.claim_daily_bonus(
  p_daily_key text,
  p_event_id uuid
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.balance_config();
  current_data jsonb;
  next_data jsonb;
  event_daily_key text;
  event_score integer;
  safe_bonus integer;
  safe_score integer;
  safe_tier integer;
  safe_xp integer;
  current_total_xp bigint;
  next_total_xp bigint;
  current_level integer;
  next_level integer;
  next_xp integer;
  level_coins integer;
  point_interval integer;
  points_gained integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not public.daily_key_is_plausible(p_daily_key) then
    raise exception 'Ungueltiger Tageslauf';
  end if;

  select daily_key, score
    into event_daily_key, event_score
  from public.profile_progress_events
  where event_id = p_event_id and profile_id = uid;
  if not found or event_daily_key is distinct from p_daily_key then
    raise exception 'Tageslauf noch nicht synchronisiert';
  end if;

  safe_score := greatest(0, coalesce(event_score, 0));
  point_interval := greatest(1, (cfg->'talents'->>'levelsPerTalentPoint')::integer);
  safe_tier := least(
    (cfg->'economy'->'sources'->'daily'->>'scoreTierCount')::integer,
    floor(safe_score / public.balance_score_for_runs(1)::numeric)::integer
  );
  safe_bonus := public.balance_coins_for_runs(
    (cfg->'economy'->'sources'->'daily'->>'completionRuns')::numeric
      + safe_tier * (cfg->'economy'->'sources'->'daily'->>'scoreTierRuns')::numeric
  );
  safe_xp := public.balance_xp_for_runs(
    (cfg->'progression'->'xp'->>'dailyCompletionRuns')::numeric
      + safe_tier * (cfg->'progression'->'xp'->>'dailyScoreTierRuns')::numeric
  );

  select data, total_xp into current_data, current_total_xp
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;
  if current_data->>'lastDailyKey' = p_daily_key then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  current_level := greatest(1, coalesce((current_data->>'level')::integer, 1));
  next_total_xp := coalesce(current_total_xp, 0) + safe_xp;
  select level, xp into next_level, next_xp
  from public.profile_level_from_xp(next_total_xp);
  level_coins := public.balance_coins_for_runs(
    greatest(0, next_level - current_level)
      * (cfg->'economy'->'sources'->>'levelRewardRuns')::numeric
  );
  points_gained := greatest(
    0,
    floor(greatest(0, next_level - 1)::numeric / point_interval)::integer
      - floor(greatest(0, current_level - 1)::numeric / point_interval)::integer
  );
  next_data := current_data || jsonb_build_object(
    'lastDailyKey', p_daily_key,
    'dailyBestScore', greatest(coalesce((current_data->>'dailyBestScore')::integer, 0), safe_score),
    'totalDailyRuns', coalesce((current_data->>'totalDailyRuns')::integer, 0) + 1,
    'level', next_level, 'xp', next_xp,
    'talentPoints', coalesce((current_data->>'talentPoints')::integer, 0) + points_gained,
    'coins', coalesce((current_data->>'coins')::integer, 0) + safe_bonus + level_coins,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + safe_bonus + level_coins,
    'version', public.save_version()
  );
  update public.profile_progress
  set data = next_data, total_xp = next_total_xp, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.claim_daily_bonus(text, uuid) from public;
grant execute on function public.claim_daily_bonus(text, uuid) to authenticated;

-- Der Login-Bonus verwendet ausschliesslich den Servertag. Der Client darf
-- keinen alten, morgigen oder beliebig gewechselten Tag mehr einreichen.
drop function if exists public.claim_daily_login_bonus(text);
drop function if exists public.claim_daily_login_bonus();

create or replace function public.claim_daily_login_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  server_daily_key text := to_char((now() at time zone 'UTC')::date, 'YYYY-MM-DD');
  current_data jsonb;
  next_data jsonb;
  current_total_xp bigint;
  current_updated_at timestamptz;
  login_coins integer := public.balance_coins_for_runs(
    (public.balance_config()->'economy'->'sources'->'daily'->>'loginRuns')::numeric
  );
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  select data, total_xp, updated_at
    into current_data, current_total_xp, current_updated_at
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if current_data->>'lastLoginBonusKey' = server_daily_key then
    return jsonb_build_object('claimed', false, 'profile', jsonb_build_object(
      'data', current_data, 'total_xp', current_total_xp, 'updated_at', current_updated_at));
  end if;

  next_data := current_data || jsonb_build_object(
    'lastLoginBonusKey', server_daily_key,
    'coins', coalesce((current_data->>'coins')::integer, 0) + login_coins,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0) + login_coins,
    'version', public.save_version()
  );
  update public.profile_progress set data = next_data, updated_at = now()
  where profile_id = uid returning updated_at into current_updated_at;
  return jsonb_build_object('claimed', true, 'profile', jsonb_build_object(
    'data', next_data, 'total_xp', current_total_xp, 'updated_at', current_updated_at));
end;
$$;

revoke execute on function public.claim_daily_login_bonus() from public;
grant execute on function public.claim_daily_login_bonus() to authenticated;

-- ============================================================================
-- 2. Anonyme Saves: Compare-and-Swap statt stilles Ueberschreiben
-- ============================================================================

drop function if exists public.upsert_save(uuid, jsonb, integer, integer, integer, text);
drop function if exists public.upsert_save(uuid, jsonb, integer, integer, integer, text, timestamptz);

create or replace function public.upsert_save(
  p_id uuid,
  p_data jsonb,
  p_level integer,
  p_best_score integer,
  p_total_runs integer,
  p_access_token text,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_hashes text[];
  existing_updated_at timestamptz;
  stored_updated_at timestamptz;
begin
  if p_id is null or p_access_token is null or length(p_access_token) < 32 then
    raise exception 'Ungueltiger Save-Zugriff';
  end if;

  select access_token_hashes, updated_at
    into existing_hashes, existing_updated_at
  from public.saves where id = p_id for update;

  if found then
    if cardinality(coalesce(existing_hashes, '{}')) = 0 then
      raise exception 'Legacy-Save braucht Sync-Code oder Login-Claim';
    end if;
    if md5(p_access_token) <> any(existing_hashes) then
      raise exception 'Save-Zugriffstoken ungueltig';
    end if;
    if p_expected_updated_at is null or existing_updated_at <> p_expected_updated_at then
      raise exception 'Save wurde auf einem anderen Geraet geaendert'
        using errcode = '40001';
    end if;
  end if;

  insert into public.saves (
    id, data, level, best_score, total_runs, access_token_hashes, updated_at
  ) values (
    p_id, coalesce(p_data, '{}'::jsonb), greatest(1, coalesce(p_level, 1)),
    greatest(0, coalesce(p_best_score, 0)), greatest(0, coalesce(p_total_runs, 0)),
    array[md5(p_access_token)], now()
  ) on conflict (id) do update
  set data = excluded.data, level = excluded.level,
      best_score = excluded.best_score, total_runs = excluded.total_runs,
      updated_at = excluded.updated_at
  where p_expected_updated_at is not null
    and public.saves.updated_at = p_expected_updated_at
  returning updated_at into stored_updated_at;

  if stored_updated_at is null then
    raise exception 'Save wurde auf einem anderen Geraet angelegt'
      using errcode = '40001';
  end if;
  return stored_updated_at;
end;
$$;

revoke execute on function public.upsert_save(
  uuid, jsonb, integer, integer, integer, text, timestamptz
) from public;
grant execute on function public.upsert_save(
  uuid, jsonb, integer, integer, integer, text, timestamptz
) to anon, authenticated;

-- ============================================================================
-- 3. Netzwerk-Duell: serverseitige Slot-Zuweisung fuer jede Aktion
-- ============================================================================

alter table public.duel_rooms
  add column if not exists host_token_hash text,
  add column if not exists guest_token_hash text;

-- Der alte Code-only-SELECT war fuer Realtime und fuer alle RPCs zu weit.
revoke all on public.duel_rooms from anon, authenticated;
drop policy if exists "Raumcode-Pruefung fuer Realtime-Autorisierung" on public.duel_rooms;

create or replace function public.duel_participant_slot(
  p_code text,
  p_participant_token text
)
returns integer
language sql
security definer
set search_path = public
as $$
  select case
    when p_participant_token is not null
      and p_participant_token ~ '^[a-f0-9]{64}$'
      and md5(p_participant_token) = host_token_hash then 0
    when p_participant_token is not null
      and p_participant_token ~ '^[a-f0-9]{64}$'
      and md5(p_participant_token) = guest_token_hash then 1
    else null
  end
  from public.duel_rooms
  where code = p_code and expires_at > now();
$$;

revoke execute on function public.duel_participant_slot(text, text) from public;

drop function if exists public.create_duel_room(text, text, text);
create or replace function public.create_duel_room(
  p_world_id text,
  p_code text,
  p_seed text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if p_world_id is null or char_length(trim(p_world_id)) = 0 then
    raise exception 'Ungueltige Welt';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then
    raise exception 'Ungueltiges Code-Format';
  end if;
  if p_seed is null or char_length(trim(p_seed)) = 0 then
    raise exception 'Ungueltiger Seed';
  end if;

  insert into public.duel_rooms (code, seed, world_id, host_token_hash)
  values (p_code, p_seed, p_world_id, md5(participant_token));
  return participant_token;
end;
$$;

revoke execute on function public.create_duel_room(text, text, text) from public;
grant execute on function public.create_duel_room(text, text, text) to anon, authenticated;

drop function if exists public.join_duel_room(text);
create or replace function public.join_duel_room(p_code text)
returns table (
  seed text,
  world_id text,
  participant_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  guest_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  select * into room from public.duel_rooms
  where code = p_code and expires_at > now() for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.guest_joined or room.guest_token_hash is not null then
    raise exception 'Raum bereits voll';
  end if;

  update public.duel_rooms
  set guest_joined = true, guest_token_hash = md5(guest_token)
  where code = p_code;
  return query select room.seed, room.world_id, guest_token;
end;
$$;

revoke execute on function public.join_duel_room(text) from public;
grant execute on function public.join_duel_room(text) to anon, authenticated;

drop function if exists public.mark_duel_ready(text, boolean);
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
    update public.duel_rooms set host_ready = true where code = p_code;
  else
    update public.duel_rooms set guest_ready = true where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.mark_duel_ready(text, text) from public;
grant execute on function public.mark_duel_ready(text, text) to anon, authenticated;

drop function if exists public.set_duel_start_time(text);
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
  computed_start timestamptz;
begin
  if public.duel_participant_slot(p_code, p_participant_token) is null then
    raise exception 'Duell-Teilnehmer nicht autorisiert';
  end if;
  select * into room from public.duel_rooms
  where code = p_code and expires_at > now() for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null then return room.start_at; end if;
  if not room.host_ready or not room.guest_ready then
    raise exception 'Noch nicht beide Spieler bereit';
  end if;

  computed_start := now() + interval '5 seconds';
  update public.duel_rooms set start_at = computed_start where code = p_code;
  return computed_start;
end;
$$;

revoke execute on function public.set_duel_start_time(text, text) from public;
grant execute on function public.set_duel_start_time(text, text) to anon, authenticated;

drop function if exists public.get_duel_room(text);
create or replace function public.get_duel_room(
  p_code text,
  p_participant_token text
)
returns table (
  seed text,
  world_id text,
  host_ready boolean,
  guest_ready boolean,
  guest_joined boolean,
  start_at timestamptz,
  host_result jsonb,
  guest_result jsonb
)
language sql
security definer
set search_path = public
as $$
  select seed, world_id, host_ready, guest_ready, guest_joined, start_at,
         host_result, guest_result
  from public.duel_rooms
  where code = p_code and expires_at > now()
    and public.duel_participant_slot(code, p_participant_token) is not null;
$$;

revoke execute on function public.get_duel_room(text, text) from public;
grant execute on function public.get_duel_room(text, text) to anon, authenticated;

drop function if exists public.submit_duel_result(text, boolean, jsonb);
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
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Ungueltiges Ergebnisformat';
  end if;
  if jsonb_typeof(p_result->'score') <> 'number'
     or jsonb_typeof(p_result->'bestCombo') <> 'number'
     or jsonb_typeof(p_result->'totalCollected') <> 'number' then
    raise exception 'Ergebnis unvollstaendig';
  end if;
  if (p_result->>'score')::numeric < 0
     or (p_result->>'score')::numeric > 1000000
     or (p_result->>'bestCombo')::numeric < 0
     or (p_result->>'totalCollected')::numeric < 0 then
    raise exception 'Ergebnis ausserhalb des Wertebereichs';
  end if;

  if slot = 0 then
    update public.duel_rooms set host_result = coalesce(host_result, p_result)
    where code = p_code;
  else
    update public.duel_rooms set guest_result = coalesce(guest_result, p_result)
    where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.submit_duel_result(text, text, jsonb) from public;
grant execute on function public.submit_duel_result(text, text, jsonb) to anon, authenticated;

-- Realtime bekommt keinen separaten Code-only-Pfad. Das private Topic lautet
-- jetzt CODE:TOKEN; die Policy ruft eine nicht lesbare Security-Definer-
-- Funktion auf und gibt weder Token-Hashes noch Seed per Tabelle frei.
create or replace function public.duel_channel_is_authorized(p_topic text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.duel_participant_slot(
    split_part(p_topic, ':', 1), split_part(p_topic, ':', 2)
  ) is not null;
$$;

revoke execute on function public.duel_channel_is_authorized(text) from public;
grant execute on function public.duel_channel_is_authorized(text) to anon, authenticated;

drop policy if exists "Duell-Raum-Teilnehmer duerfen den Kanal nutzen" on "realtime"."messages";
create policy "Duell-Raum-Teilnehmer duerfen den Kanal nutzen"
  on "realtime"."messages"
  for select
  to anon, authenticated
  using (
    public.duel_channel_is_authorized((select realtime.topic()))
    and realtime.messages.extension in ('broadcast', 'presence')
  );

drop policy if exists "Duell-Raum-Teilnehmer duerfen im Kanal senden" on "realtime"."messages";
create policy "Duell-Raum-Teilnehmer duerfen im Kanal senden"
  on "realtime"."messages"
  for insert
  to anon, authenticated
  with check (
    public.duel_channel_is_authorized((select realtime.topic()))
    and realtime.messages.extension in ('broadcast', 'presence')
  );

commit;
notify pgrst, 'reload schema';
