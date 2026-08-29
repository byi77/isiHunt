-- Phase 2.34: einheitliche Regel fuer sichtbare Spielernamen.
--
-- Sichtbare Namen bestehen aus ASCII-Buchstaben und Ziffern, enthalten
-- hoechstens vier Ziffern und beginnen - wenn der erste Buchstabe ist - mit
-- einem Grossbuchstaben. Alte Login-Aliase bleiben unangetastet, damit kein
-- bestehendes Konto durch die Anzeige-Normalisierung ausgesperrt wird.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 33
     ) then
    raise exception 'Phase 2.33 muss vor Phase 2.34 ausgefuehrt werden';
  end if;
end;
$$;

-- ============================================================================
-- 1. Gemeinsame serverseitige Normalisierung
-- ============================================================================

create or replace function public.normalize_player_name(p_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned_name text := regexp_replace(trim(coalesce(p_name, '')), '[^A-Za-z0-9]', '', 'g');
  safe_name text := '';
  current_character text;
  digit_count integer := 0;
  i integer;
begin
  if cleaned_name = '' then return ''; end if;

  for i in 1..char_length(cleaned_name) loop
    current_character := substr(cleaned_name, i, 1);
    if current_character ~ '^[0-9]$' then
      digit_count := digit_count + 1;
      if digit_count > 4 then continue; end if;
    end if;
    safe_name := safe_name || current_character;
  end loop;

  if safe_name ~ '^[a-z]' then
    safe_name := upper(left(safe_name, 1)) || substr(safe_name, 2);
  end if;
  return left(safe_name, 16);
end;
$$;

revoke execute on function public.normalize_player_name(text) from public, anon, authenticated;

-- ============================================================================
-- 2. Bestandsdaten normalisieren
-- ============================================================================

-- Nach dem Entfernen von Sonderzeichen koennen zwei alte Namen kollidieren.
-- Der juengere Eintrag erhaelt dann einen gueltigen vierstelligen Ziffern-
-- suffix. Vier Ziffern bleiben die Obergrenze; der alte Login-Alias wird dabei
-- nicht veraendert.
create temporary table isihunt_player_name_migration (
  profile_id uuid primary key,
  player_name text not null
) on commit drop;

with normalized as (
  select
    id,
    created_at,
    public.normalize_player_name(player_name) as base_name
  from public.profiles
), ranked as (
  select
    id,
    base_name,
    row_number() over (
      partition by lower(base_name)
      order by created_at asc, id asc
    ) as duplicate_rank
  from normalized
)
insert into isihunt_player_name_migration (profile_id, player_name)
select
  id,
  case
    when base_name = '' then ''
    when duplicate_rank = 1 then base_name
    else public.normalize_player_name(
      coalesce(nullif(left(regexp_replace(base_name, '[0-9]', '', 'g'), 12), ''), 'Player')
        || lpad(duplicate_rank::text, 4, '0')
    )
  end
from ranked;

update public.profiles as p
set player_name = m.player_name,
    updated_at = now()
from isihunt_player_name_migration as m
where p.id = m.profile_id
  and p.player_name is distinct from m.player_name;

update public.profile_progress as pp
set data = jsonb_set(pp.data, '{playerName}', to_jsonb(m.player_name), true),
    updated_at = now()
from isihunt_player_name_migration as m
where pp.profile_id = m.profile_id
  and pp.data->>'playerName' is distinct from m.player_name;

-- Die bisherige eindeutige Namensindexierung wird waehrend der Umbenennung
-- ausgesetzt, damit die Zielnamen als Ganzes berechnet werden koennen.
drop index if exists public.scores_player_name_normalized_uidx;

-- Scores eines bekannten Profils uebernehmen dessen neuen Anzeigenamen.
update public.scores as s
set player_name = m.player_name
from isihunt_player_name_migration as m
where s.player_id = m.profile_id
  and m.player_name <> ''
  and s.player_name is distinct from m.player_name;

create temporary table isihunt_score_name_migration (
  score_id uuid primary key,
  player_name text not null
) on commit drop;

with normalized as (
  select
    id,
    score,
    created_at,
    public.normalize_player_name(player_name) as base_name
  from public.scores
), ranked as (
  select
    id,
    base_name,
    row_number() over (
      partition by lower(base_name)
      order by score desc, created_at asc, id asc
    ) as duplicate_rank
  from normalized
)
insert into isihunt_score_name_migration (score_id, player_name)
select
  id,
  case
    when base_name <> '' and duplicate_rank = 1 then base_name
    else public.normalize_player_name(
      coalesce(nullif(left(regexp_replace(base_name, '[0-9]', '', 'g'), 12), ''), 'Player')
        || lpad(duplicate_rank::text, 4, '0')
    )
  end
from ranked;

update public.scores as s
set player_name = m.player_name
from isihunt_score_name_migration as m
where s.id = m.score_id
  and s.player_name is distinct from m.player_name;

create unique index if not exists scores_player_name_normalized_uidx
  on public.scores (lower(trim(player_name)));

update public.saves as s
set data = jsonb_set(
      s.data,
      '{playerName}',
      to_jsonb(public.normalize_player_name(s.data->>'playerName')),
      true
    ),
    updated_at = now()
where jsonb_typeof(s.data->'playerName') = 'string';

alter table public.profiles drop constraint if exists profiles_player_name_format;
alter table public.profiles add constraint profiles_player_name_format
  check (
    player_name = ''
    or (
      char_length(player_name) between 1 and 16
      and player_name ~ '^[A-Za-z0-9]+$'
      and length(regexp_replace(player_name, '[^0-9]', '', 'g')) <= 4
      and left(player_name, 1) !~ '^[a-z]'
    )
  );

alter table public.scores drop constraint if exists scores_player_name_format;
alter table public.scores add constraint scores_player_name_format
  check (
    char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9]+$'
    and length(regexp_replace(player_name, '[^0-9]', '', 'g')) <= 4
    and left(player_name, 1) !~ '^[a-z]'
  );

-- ============================================================================
-- 3. Neue Schreibpfade serverseitig absichern
-- ============================================================================

create or replace function public.is_player_name_available(
  p_player_name text,
  p_player_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text := trim(coalesce(p_player_name, ''));
  safe_name text;
begin
  if char_length(raw_name) not between 1 and 16
     or raw_name !~ '^[A-Za-z0-9]+$'
     or length(regexp_replace(raw_name, '[^0-9]', '', 'g')) > 4 then
    return false;
  end if;
  safe_name := public.normalize_player_name(raw_name);

  return not exists (
    select 1 from public.profiles
    where lower(trim(player_name)) = lower(safe_name)
      and (p_player_id is null or id <> p_player_id)
  ) and not exists (
    select 1 from public.scores
    where lower(trim(player_name)) = lower(safe_name)
      and (p_player_id is null or player_id <> p_player_id)
  );
end;
$$;

revoke execute on function public.is_player_name_available(text, uuid) from public;
revoke execute on function public.is_player_name_available(text, uuid) from anon;
grant execute on function public.is_player_name_available(text, uuid) to authenticated;

create or replace function public.initialize_profile_progress(
  p_data jsonb,
  p_total_xp bigint
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  raw_name text := trim(coalesce(p_data->>'playerName', ''));
  safe_name text;
  alias_name text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(raw_name) not between 1 and 16
     or raw_name !~ '^[A-Za-z0-9]+$'
     or length(regexp_replace(raw_name, '[^0-9]', '', 'g')) > 4 then
    raise exception 'Ungueltiger Spielername';
  end if;
  safe_name := public.normalize_player_name(raw_name);
  alias_name := lower(safe_name);
  if not public.is_player_name_available(safe_name, uid) then
    raise exception 'Spielername bereits vergeben';
  end if;

  insert into public.profiles (id, player_name, alias, alias_normalized)
  values (uid, safe_name, alias_name, alias_name)
  on conflict (id) do nothing;

  insert into public.profile_progress (profile_id, data, total_xp)
  values (
    uid,
    jsonb_build_object(
      'version', public.save_version(), 'level', 1, 'xp', 0,
      'talentPoints', 0, 'coins', 0, 'talents', '{}'::jsonb,
      'bestScore', 0, 'bestScoreRecordedAt', null, 'bestCombo', 0,
      'totalScore', 0, 'totalRuns', 0, 'totalPlayTimeMs', 0,
      'totalCoinsEarned', 0, 'coinsSpent', 0,
      'lastLoginBonusKey', null, 'lastDailyKey', null,
      'dailyBestScore', 0, 'totalDailyRuns', 0,
      'pendingDailyKey', null, 'pendingDailyEventId', null,
      'pendingDailyCoins', 0, 'pendingDailyScore', 0,
      'collected', jsonb_build_object(
        'poor', 0, 'common', 0, 'uncommon', 0,
        'rare', 0, 'epic', 0, 'legendary', 0
      ),
      'unlockedAchievements', '[]'::jsonb, 'lastWorldId', 'silberhain',
      'ownedShipShapes', jsonb_build_array('arrow'),
      'ownedShipColors', jsonb_build_array('world'),
      'ownedShipAuras', jsonb_build_array('none'),
      'shipShape', 'arrow', 'shipColor', 'world', 'shipAura', 'none',
      'newCosmeticIds', '[]'::jsonb, 'lastPurchasedCosmetic', null,
      'soundEnabled', true, 'hapticsEnabled', true,
      'playerName', safe_name, 'pendingPlayerName', null
    ),
    0
  )
  on conflict (profile_id) do nothing;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.initialize_profile_progress(jsonb, bigint) from public;
grant execute on function public.initialize_profile_progress(jsonb, bigint) to authenticated;

create or replace function public.update_profile_identity(p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  raw_name text := trim(coalesce(p_name, ''));
  safe_name text;
  alias_name text;
  current_email text;
  email_domain text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(raw_name) not between 3 and 16
     or raw_name !~ '^[A-Za-z0-9]+$'
     or length(regexp_replace(raw_name, '[^0-9]', '', 'g')) > 4 then
    raise exception 'Name: 3-16 Zeichen, nur Buchstaben/Zahlen und hoechstens 4 Zahlen';
  end if;
  safe_name := public.normalize_player_name(raw_name);
  alias_name := lower(safe_name);

  if exists (
    select 1 from public.profiles
    where alias_normalized = alias_name and id <> uid
  ) or not public.is_player_name_available(safe_name, uid) then
    raise exception 'Dieser Name ist bereits vergeben';
  end if;

  insert into public.profiles (id, player_name, alias, alias_normalized)
  values (uid, safe_name, alias_name, alias_name)
  on conflict (id) do update
    set player_name = excluded.player_name,
        alias = excluded.alias,
        alias_normalized = excluded.alias_normalized,
        updated_at = now();

  select email into current_email from auth.users where id = uid;
  if current_email is not null and position('@' in current_email) > 0 then
    email_domain := split_part(current_email, '@', 2);
    if split_part(current_email, '@', 1) <> alias_name then
      update auth.users
      set email = alias_name || '@' || email_domain,
          raw_user_meta_data = jsonb_set(
            coalesce(raw_user_meta_data, '{}'::jsonb), '{alias}', to_jsonb(alias_name), true
          )
      where id = uid;
    end if;
  end if;

  update public.profile_progress
  set data = jsonb_set(data, '{playerName}', to_jsonb(safe_name), true), updated_at = now()
  where profile_id = uid;
  update public.scores set player_name = safe_name where player_id = uid;
  return true;
end;
$$;

revoke execute on function public.update_profile_identity(text) from public;
grant execute on function public.update_profile_identity(text) to authenticated;

create or replace function public.submit_best_score(
  p_player_id uuid,
  p_player_name text,
  p_world_id text,
  p_player_level integer,
  p_score integer,
  p_best_combo integer,
  p_duration_ms integer,
  p_collected jsonb,
  p_access_token text default null,
  p_recorded_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  raw_name text := trim(coalesce(p_player_name, ''));
  safe_name text;
  safe_recorded_at timestamptz := coalesce(p_recorded_at, now());
  safe_level integer := greatest(1, least(100, coalesce(p_player_level, 1)));
  save_hashes text[];
  save_exists boolean := false;
begin
  if p_player_id is null
     or char_length(raw_name) not between 1 and 16
     or raw_name !~ '^[A-Za-z0-9]+$'
     or length(regexp_replace(raw_name, '[^0-9]', '', 'g')) > 4 then
    raise exception 'Ungueltiges Spielerprofil';
  end if;
  safe_name := public.normalize_player_name(raw_name);
  if uid is not null and p_player_id <> uid then
    raise exception 'Spielerprofil gehoert nicht zur Sitzung';
  end if;
  if uid is null then
    if p_access_token is null or length(p_access_token) < 32 then
      raise exception 'Save-Zugriffstoken fehlt';
    end if;
    select access_token_hashes into save_hashes from public.saves
    where id = p_player_id for update;
    save_exists := found;
    if save_exists and (
      cardinality(coalesce(save_hashes, '{}')) = 0
      or md5(p_access_token) <> any(save_hashes)
    ) then
      raise exception 'Save-Zugriffstoken ungueltig';
    end if;
    if not save_exists then
      insert into public.saves (id, data, access_token_hashes)
      values (
        p_player_id,
        jsonb_build_object('version', public.save_version(), 'playerName', safe_name),
        array[md5(p_access_token)]
      );
    end if;
  else
    select greatest(1, least(100, coalesce((data->>'level')::integer, 1)))
      into safe_level
    from public.profile_progress where profile_id = uid;
    safe_level := coalesce(safe_level, 1);
  end if;
  if safe_recorded_at > now() + interval '1 day' then safe_recorded_at := now(); end if;
  if p_score > public.max_plausible_score(
    p_world_id, p_duration_ms, p_best_combo, p_collected
  ) then
    raise exception 'Punktestand nicht plausibel';
  end if;

  if not public.is_player_name_available(safe_name, p_player_id) then
    raise exception 'Spielername bereits vergeben';
  end if;

  insert into public.scores (
    player_id, player_name, world_id, player_level, score, best_combo, created_at
  ) values (
    p_player_id, safe_name, p_world_id, safe_level,
    greatest(0, coalesce(p_score, 0)), greatest(0, coalesce(p_best_combo, 0)),
    safe_recorded_at
  ) on conflict (player_id) where (player_id is not null) do update
  set player_name = excluded.player_name,
      score = greatest(public.scores.score, excluded.score),
      player_level = case when excluded.score > public.scores.score
        then excluded.player_level else public.scores.player_level end,
      best_combo = case when excluded.score > public.scores.score
        then excluded.best_combo else public.scores.best_combo end,
      world_id = case when excluded.score > public.scores.score
        then excluded.world_id else public.scores.world_id end,
      created_at = case when excluded.score > public.scores.score
        then excluded.created_at else public.scores.created_at end;
  return true;
end;
$$;

revoke execute on function public.submit_best_score(
  uuid, text, text, integer, integer, integer, integer, jsonb, text, timestamptz
) from public;
grant execute on function public.submit_best_score(
  uuid, text, text, integer, integer, integer, integer, jsonb, text, timestamptz
) to authenticated;

create or replace function public.rename_best_score(
  p_player_id uuid, p_player_name text, p_access_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  raw_name text := trim(coalesce(p_player_name, ''));
  safe_name text;
begin
  if p_player_id is null
     or char_length(raw_name) not between 1 and 16
     or raw_name !~ '^[A-Za-z0-9]+$'
     or length(regexp_replace(raw_name, '[^0-9]', '', 'g')) > 4 then
    raise exception 'Ungueltiges Spielerprofil';
  end if;
  safe_name := public.normalize_player_name(raw_name);
  if uid is not null and p_player_id <> uid then
    raise exception 'Spielerprofil gehoert nicht zur Sitzung';
  end if;
  if uid is null and not exists (
    select 1 from public.saves
    where id = p_player_id and p_access_token is not null
      and md5(p_access_token) = any(coalesce(access_token_hashes, '{}'::text[]))
  ) then
    raise exception 'Save-Zugriffstoken ungueltig';
  end if;
  if not public.is_player_name_available(safe_name, p_player_id) then
    raise exception 'Spielername bereits vergeben';
  end if;
  update public.scores set player_name = safe_name where player_id = p_player_id;
  return true;
end;
$$;

revoke execute on function public.rename_best_score(uuid, text, text) from public;
grant execute on function public.rename_best_score(uuid, text, text) to anon, authenticated;

-- Auch direkte anonyme Save-Updates koennen keinen alten oder ungueltigen
-- playerName-Wert mehr neu in der JSON-Nutzlast ablegen.
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
  safe_data jsonb := coalesce(p_data, '{}'::jsonb);
begin
  if p_id is null or p_access_token is null or length(p_access_token) < 32 then
    raise exception 'Ungueltiger Save-Zugriff';
  end if;
  if jsonb_typeof(safe_data->'playerName') = 'string' then
    safe_data := jsonb_set(
      safe_data,
      '{playerName}',
      to_jsonb(public.normalize_player_name(safe_data->>'playerName')),
      true
    );
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
    p_id, safe_data, greatest(1, coalesce(p_level, 1)),
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
-- 4. Migrationsmarker
-- ============================================================================

update public.isihunt_schema_state
set schema_version = 34,
    migration_name = 'phase_2_34_player_name_rules.sql',
    applied_at = now()
where singleton = true;

commit;

notify pgrst, 'reload schema';
