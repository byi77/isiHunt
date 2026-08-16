-- Phase 2.6: Login und gemeinsamer Fortschritt auf mehreren Geräten.
--
-- Dieses Skript nach schema.sql im Supabase SQL Editor ausführen.
-- Es ist wiederholbar und löscht keine bestehenden Spielstände.
--
-- Der bisherige Sync-Code bleibt bestehen. Ein vorhandenes anonymes Profil
-- kann nach dem Login über claim_cloud_profile übernommen werden.
--
-- Der sichtbare Login ist ein Alias. Supabase Auth erhält dafür intern eine
-- technische Adresse der Form <alias>@<supabase-projekt>.supabase.co; der PIN
-- wird technisch als Authentifizierungswert an Supabase übergeben.
-- Supabase erwartet dafür intern E-Mail oder Telefonnummer. Im
-- Supabase-Dashboard deshalb unter Authentication -> Providers -> Email die
-- Bestätigungspflicht deaktivieren; für diesen Login gibt es bewusst keine
-- E-Mail-Zustellung und zunächst auch keinen E-Mail-PIN-Reset.

begin;

-- Ranglisten-Erweiterung: das Level wird zusammen mit dem Bestwert gespeichert.
alter table public.scores add column if not exists player_level integer not null default 1;
alter table public.scores drop constraint if exists scores_level_range;
alter table public.scores add constraint scores_level_range
  check (player_level between 1 and 100);

-- Ein sichtbarer Spielername darf nur einmal in der Bestenliste vorkommen.
-- Vorhandene Doppelungen werden auf den jeweils besseren Bestwert reduziert.
with ranked_names as (
  select id,
         row_number() over (
           partition by lower(trim(player_name))
           order by score desc, created_at asc, id asc
         ) as duplicate_rank
  from public.scores
)
delete from public.scores as duplicate
using ranked_names
where duplicate.id = ranked_names.id
  and ranked_names.duplicate_rank > 1;

create unique index if not exists scores_player_name_normalized_uidx
  on public.scores (lower(trim(player_name)));

-- ============================================================================
-- 1. Auth-Profil und gemeinsamer Profilstand
-- ============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  player_name  text not null default '',
  alias        text,
  alias_normalized text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_name_length check (char_length(player_name) <= 16)
);

alter table public.profiles add column if not exists alias text;
alter table public.profiles add column if not exists alias_normalized text;
alter table public.profiles add column if not exists is_admin boolean not null default false;

create unique index if not exists profiles_alias_normalized_idx
  on public.profiles (alias_normalized)
  where alias_normalized is not null;

-- Verfügbarkeit wird zusätzlich in allen Schreibfunktionen geprüft. Ein
-- separater RPC erlaubt dem Client, Konflikte vor dem Speichern freundlich
-- anzuzeigen, ohne die Tabellen direkt freizugeben.
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
  safe_name text := lower(trim(coalesce(p_player_name, '')));
begin
  if char_length(safe_name) not between 1 and 16 then return false; end if;

  return not exists (
    select 1 from public.profiles
    where lower(trim(player_name)) = safe_name
      and (p_player_id is null or id <> p_player_id)
  ) and not exists (
    select 1 from public.scores
    where lower(trim(player_name)) = safe_name
      and (p_player_id is null or player_id <> p_player_id)
  );
end;
$$;

revoke execute on function public.is_player_name_available(text, uuid) from public;
grant execute on function public.is_player_name_available(text, uuid) to anon, authenticated;

create table if not exists public.profile_progress (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  data        jsonb not null,
  total_xp    bigint not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.profile_progress_events (
  event_id                 uuid primary key,
  profile_id               uuid not null references public.profiles (id) on delete cascade,
  world_id                 text not null,
  score                    integer not null default 0,
  best_combo               integer not null default 0,
  xp_gained                integer not null default 0,
  duration_ms              integer not null default 0,
  coins_gained             integer not null default 0,
  talent_points_gained     integer not null default 0,
  collected                jsonb not null default '{}'::jsonb,
  achievement_ids          jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now()
);

alter table public.profile_progress_events add column if not exists duration_ms integer not null default 0;

create index if not exists profile_progress_events_profile_idx
  on public.profile_progress_events (profile_id, created_at);

grant select, insert, update on public.profiles to authenticated;
grant select on public.profile_progress to authenticated;

alter table public.profiles enable row level security;
alter table public.profile_progress enable row level security;
alter table public.profile_progress_events enable row level security;

drop policy if exists "Eigenes Profil lesen" on public.profiles;
create policy "Eigenes Profil lesen"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Eigenes Profil anlegen" on public.profiles;
create policy "Eigenes Profil anlegen"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Eigenes Profil ändern" on public.profiles;
create policy "Eigenes Profil ändern"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Eigenen Profilstand lesen" on public.profile_progress;
create policy "Eigenen Profilstand lesen"
  on public.profile_progress for select to authenticated
  using (profile_id = auth.uid());

-- ============================================================================
-- 2. Fortschritt aus XP-Ereignissen berechnen
-- ============================================================================

create or replace function public.profile_level_from_xp(p_total_xp bigint)
returns table (level integer, xp integer)
language plpgsql
immutable
as $$
declare
  current_level integer := 1;
  remaining bigint := greatest(0, coalesce(p_total_xp, 0));
  required bigint;
begin
  while current_level < 100 loop
    required := floor(750 * sqrt(current_level::numeric));
    exit when remaining < required;
    remaining := remaining - required;
    current_level := current_level + 1;
  end loop;

  if current_level >= 100 then remaining := 0; end if;
  return query select current_level, remaining::integer;
end;
$$;

revoke execute on function public.profile_level_from_xp(bigint) from public;
grant execute on function public.profile_level_from_xp(bigint) to authenticated;

create or replace function public.get_profile_progress()
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  retro_coins integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select data into current_data
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then return; end if;

  -- Einmalige Nachvergütung für Profile aus Version 4: Beim damaligen
  -- Wechsel auf Coins wurden Level-Coins noch nicht rückwirkend vergeben.
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    retro_coins := greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20;
    current_data := jsonb_set(
      current_data,
      '{coins}',
      to_jsonb(coalesce((current_data->>'coins')::integer, 0) + retro_coins),
      true
    );
    current_data := jsonb_set(current_data, '{talentPoints}', '0'::jsonb, true);
    current_data := jsonb_set(current_data, '{version}', '5'::jsonb, true);
    update public.profile_progress
    set data = current_data, updated_at = now()
    where profile_id = uid;
  end if;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.get_profile_progress() from public;
grant execute on function public.get_profile_progress() to authenticated;

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
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  if not public.is_player_name_available(p_data->>'playerName', uid) then
    raise exception 'Spielername bereits vergeben';
  end if;

  insert into public.profiles (id, player_name)
  values (uid, left(trim(coalesce(p_data->>'playerName', '')), 16))
  on conflict (id) do nothing;

  insert into public.profile_progress (profile_id, data, total_xp)
  values (uid, p_data, greatest(0, coalesce(p_total_xp, 0)))
  on conflict (profile_id) do nothing;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.initialize_profile_progress(jsonb, bigint) from public;
grant execute on function public.initialize_profile_progress(jsonb, bigint) to authenticated;

-- Übernimmt den bisherigen anonymen Spielstand genau einmal in das Login-Profil.
create or replace function public.claim_cloud_profile(
  p_cloud_id uuid,
  p_total_xp bigint
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  old_data jsonb;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  insert into public.profiles (id)
  values (uid)
  on conflict (id) do nothing;

  select data into old_data from public.saves where id = p_cloud_id;
  if not exists (select 1 from public.profile_progress where profile_id = uid) then
    if old_data is not null then
      insert into public.profile_progress (profile_id, data, total_xp)
      values (uid, old_data, greatest(0, coalesce(p_total_xp, 0)));
    end if;
  end if;

  -- Auch wenn das Login-Profil bereits einen Stand besitzt, muss ein alter
  -- anonymer Ranglisteneintrag mit demselben Gerätprofil zusammengeführt
  -- werden. Sonst kann derselbe sichtbare Spielername zweimal auftauchen.
  if p_cloud_id is not null and p_cloud_id <> uid then
    if exists (select 1 from public.scores where player_id = uid) then
      update public.scores as current_score
      set score = greatest(current_score.score, old_score.score),
          player_level = case when old_score.score > current_score.score
            then old_score.player_level else current_score.player_level end,
          best_combo = case when old_score.score > current_score.score
            then old_score.best_combo else current_score.best_combo end,
          world_id = case when old_score.score > current_score.score
            then old_score.world_id else current_score.world_id end,
          created_at = case when old_score.score > current_score.score
            then old_score.created_at else current_score.created_at end
      from public.scores as old_score
      where current_score.player_id = uid
        and old_score.player_id = p_cloud_id;
      delete from public.scores where player_id = p_cloud_id;
    else
      update public.scores set player_id = uid where player_id = p_cloud_id;
    end if;
  end if;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.claim_cloud_profile(uuid, bigint) from public;
grant execute on function public.claim_cloud_profile(uuid, bigint) to authenticated;

create or replace function public.update_profile_name(p_player_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  safe_name text := trim(p_player_name);
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(safe_name) not between 1 and 16 then raise exception 'Ungültiger Name'; end if;
  if not public.is_player_name_available(safe_name, uid) then
    raise exception 'Spielername bereits vergeben';
  end if;

  update public.profiles set player_name = safe_name, updated_at = now() where id = uid;
  update public.profile_progress
  set data = jsonb_set(data, '{playerName}', to_jsonb(safe_name), true), updated_at = now()
  where profile_id = uid;
  update public.scores set player_name = safe_name where player_id = uid;
  return true;
end;
$$;

revoke execute on function public.update_profile_name(text) from public;
grant execute on function public.update_profile_name(text) to authenticated;

create or replace function public.update_profile_alias(p_alias text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  safe_alias text := lower(trim(p_alias));
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if safe_alias !~ '^[a-z0-9_-]{3,16}$' then
    raise exception 'Ungültiger Alias';
  end if;

  insert into public.profiles (id, alias, alias_normalized)
  values (uid, safe_alias, safe_alias)
  on conflict (id) do update
    set alias = excluded.alias,
        alias_normalized = excluded.alias_normalized,
        updated_at = now();
  return true;
end;
$$;

revoke execute on function public.update_profile_alias(text) from public;
grant execute on function public.update_profile_alias(text) to authenticated;

-- Ausschließlich serverseitig freigegebene Wartungsübersicht. Das lokale
-- Testprofil und seine PIN vergeben keinerlei Rechte: Ein Konto wird nur über
-- `profiles.is_admin` (manuell im SQL Editor) zum Wartungsadmin.
create or replace function public.get_admin_dashboard(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 200), 200));
begin
  if uid is null or not exists (
    select 1 from public.profiles where id = uid and is_admin
  ) then
    raise exception 'Wartungsrechte erforderlich';
  end if;

  return (
    with user_stats as (
      select
        p.player_name,
        coalesce((progress.data->>'level')::integer, 1) as level,
        coalesce((progress.data->>'totalRuns')::bigint, 0) as total_runs,
        coalesce((progress.data->>'totalPlayTimeMs')::bigint, 0) as total_play_time_ms,
        -- Alte Profile kannten totalCoinsEarned noch nicht. Der sichtbare
        -- Bestand plus alle Talent-/Resetkosten ergibt die tatsächlich
        -- verdienten Coins und repariert die Statistik rückwirkend.
        greatest(
          coalesce((progress.data->>'totalCoinsEarned')::bigint, 0),
          coalesce((progress.data->>'coins')::bigint, 0)
            + coalesce((progress.data->>'coinsSpent')::bigint, 0)
        ) as total_coins_earned,
        -- Nicht jedes historische Cloud-Profil besitzt bereits den aktuellen
        -- `coins`-Wert. Der verfuegbare Bestand laesst sich dann verlaesslich
        -- aus allen verdienten minus allen ausgegebenen Coins ableiten.
        greatest(
          coalesce((progress.data->>'coins')::bigint, 0),
          greatest(
            coalesce((progress.data->>'totalCoinsEarned')::bigint, 0),
            coalesce((progress.data->>'coins')::bigint, 0)
              + coalesce((progress.data->>'coinsSpent')::bigint, 0)
          ) - coalesce((progress.data->>'coinsSpent')::bigint, 0),
          0
        ) as current_coins,
        coalesce((progress.data->>'totalDailyRuns')::bigint, 0) as total_daily_runs,
        coalesce(progress.total_xp, 0) as total_xp,
        coalesce((progress.data->>'bestScore')::bigint, 0) as best_score,
        coalesce((progress.data->>'bestCombo')::integer, 0) as best_combo,
        coalesce(jsonb_array_length(progress.data->'unlockedAchievements'), 0) as achievement_count,
        progress.updated_at
      from public.profiles as p
      left join public.profile_progress as progress on progress.profile_id = p.id
    ),
    summary as (
      select
        count(*) as profile_count,
        count(*) filter (where total_runs > 0) as played_profile_count,
        coalesce(sum(total_runs), 0) as total_runs,
        coalesce(sum(total_play_time_ms), 0) as total_play_time_ms,
        coalesce(sum(total_coins_earned), 0) as total_coins_earned,
        coalesce(sum(current_coins), 0) as total_coins_held,
        coalesce(sum(total_daily_runs), 0) as total_daily_runs,
        coalesce(sum(total_xp), 0) as total_xp,
        coalesce(sum(achievement_count), 0) as total_achievements,
        coalesce(max(best_score), 0) as highest_score
      from user_stats
    ),
    top_users as (
      select * from user_stats
      order by total_runs desc, total_play_time_ms desc, updated_at desc nulls last
      limit safe_limit
    )
    select jsonb_build_object(
      'profileCount', summary.profile_count,
      'playedProfileCount', summary.played_profile_count,
      'totalRuns', summary.total_runs,
      'totalPlayTimeMs', summary.total_play_time_ms,
      'totalCoinsEarned', summary.total_coins_earned,
      'totalCoinsHeld', summary.total_coins_held,
      'totalDailyRuns', summary.total_daily_runs,
      'totalXp', summary.total_xp,
      'totalAchievements', summary.total_achievements,
      'highestScore', summary.highest_score,
      'users', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'playerName', coalesce(nullif(player_name, ''), 'Ohne Namen'),
            'level', level,
            'totalRuns', total_runs,
            'totalPlayTimeMs', total_play_time_ms,
            'totalCoinsEarned', total_coins_earned,
            'currentCoins', current_coins,
            'totalDailyRuns', total_daily_runs,
            'totalXp', total_xp,
            'bestScore', best_score,
            'bestCombo', best_combo,
            'achievementCount', achievement_count,
            'updatedAt', updated_at
          ) order by total_runs desc, total_play_time_ms desc, updated_at desc nulls last)
          from top_users
        ),
        '[]'::jsonb
      )
    )
    from summary
  );
end;
$$;

revoke execute on function public.get_admin_dashboard(integer) from public;
grant execute on function public.get_admin_dashboard(integer) to authenticated;

-- ============================================================================
-- 3. Talentbaum: atomare Käufe und kostenloser Reset
-- ============================================================================

create or replace function public.purchase_talent(p_talent_id text)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  current_rank integer;
  max_rank integer;
  current_coins integer;
  talent_cost integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  max_rank := case p_talent_id
    when 'reach' then 5
    when 'swiftness' then 5
    when 'magnetism' then 4
    when 'endurance' then 4
    when 'focus' then 4
    when 'insight' then 5
    when 'fortune' then 5
    else 0
  end;
  if max_rank = 0 then raise exception 'Unbekanntes Talent'; end if;

  select data into current_data
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_rank := coalesce((current_data->'talents'->>p_talent_id)::integer, 0);
  current_coins := coalesce((current_data->>'coins')::integer, 0);
  -- Alte Profilstände behalten ihren Wert: Talentpunkte werden einmalig
  -- mit dem historischen Kurs in Coins umgewandelt.
  if coalesce((current_data->>'version')::integer, 1) < 4 then
    current_coins := current_coins + coalesce((current_data->>'talentPoints')::integer, 0) * 10;
  end if;
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    current_coins := current_coins + greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20;
  end if;
  talent_cost := 400 + current_rank * 125;
  if current_coins < talent_cost then raise exception 'Nicht genug Coins'; end if;
  if current_rank >= max_rank then raise exception 'Talent bereits maximiert'; end if;

  next_data := jsonb_set(current_data, array['talents', p_talent_id], to_jsonb(current_rank + 1), true);
  next_data := jsonb_set(next_data, '{coins}', to_jsonb(current_coins - talent_cost), true);
  next_data := jsonb_set(
    next_data,
    '{coinsSpent}',
    to_jsonb(coalesce((current_data->>'coinsSpent')::integer, 0) + talent_cost),
    true
  );
  next_data := jsonb_set(next_data, '{talentPoints}', '0'::jsonb, true);
  next_data := jsonb_set(next_data, '{version}', '5'::jsonb, true);
  update public.profile_progress
  set data = next_data, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.purchase_talent(text) from public;
grant execute on function public.purchase_talent(text) to authenticated;

create or replace function public.reset_talents()
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  current_coins integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  select data into current_data
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_coins := coalesce((current_data->>'coins')::integer, 0);
  if coalesce((current_data->>'version')::integer, 1) < 4 then
    current_coins := current_coins + coalesce((current_data->>'talentPoints')::integer, 0) * 10;
  end if;
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    current_coins := current_coins + greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20;
  end if;
  if current_coins < 300 then raise exception 'Nicht genug Coins für den Reset'; end if;
  next_data := jsonb_set(current_data, '{talents}', '{}'::jsonb, true);
  next_data := jsonb_set(next_data, '{coins}', to_jsonb(current_coins - 300), true);
  next_data := jsonb_set(
    next_data,
    '{coinsSpent}',
    to_jsonb(coalesce((current_data->>'coinsSpent')::integer, 0) + 300),
    true
  );
  next_data := jsonb_set(next_data, '{talentPoints}', '0'::jsonb, true);
  next_data := jsonb_set(next_data, '{version}', '5'::jsonb, true);
  update public.profile_progress
  set data = next_data, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.reset_talents() from public;
grant execute on function public.reset_talents() to authenticated;

-- Ein Tageslauf kann pro Profil und Kalendertag nur einmal belohnt werden.
create or replace function public.claim_daily_bonus(
  p_daily_key text,
  p_score integer
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  safe_bonus integer;
  safe_score integer := greatest(0, p_score);
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_daily_key !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Ungültiger Tageslauf';
  end if;
  safe_bonus := 400 + least(100, floor(safe_score / 5000.0)::integer * 50);

  select data into current_data
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if current_data->>'lastDailyKey' = p_daily_key then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  next_data := current_data || jsonb_build_object(
    'lastDailyKey', p_daily_key,
    'dailyBestScore', greatest(coalesce((current_data->>'dailyBestScore')::integer, 0), safe_score),
    'totalDailyRuns', coalesce((current_data->>'totalDailyRuns')::integer, 0) + 1,
    'coins', coalesce((current_data->>'coins')::integer, 0) + safe_bonus,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0) + safe_bonus,
    'version', 5
  );

  update public.profile_progress
  set data = next_data, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.claim_daily_bonus(text, integer) from public;
grant execute on function public.claim_daily_bonus(text, integer) to authenticated;

drop function if exists public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, jsonb, text[]);

create or replace function public.submit_progress_event(
  p_event_id             uuid,
  p_world_id             text,
  p_score                integer,
  p_best_combo           integer,
  p_xp_gained            integer,
  p_coins_gained         integer,
  p_duration_ms          integer,
  p_talent_points_gained integer,
  p_collected            jsonb,
  p_achievement_ids      text[]
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  next_collected jsonb;
  next_achievements jsonb;
  total_xp_value bigint;
  next_level integer;
  next_xp integer;
  item record;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not exists (select 1 from public.profile_progress where profile_id = uid) then
    raise exception 'Profilstand noch nicht angelegt';
  end if;

  insert into public.profile_progress_events (
    event_id, profile_id, world_id, score, best_combo, xp_gained,
    duration_ms, coins_gained, talent_points_gained, collected, achievement_ids
  ) values (
    p_event_id, uid, p_world_id, greatest(0, p_score), greatest(0, p_best_combo),
    greatest(0, p_xp_gained), greatest(0, p_duration_ms), greatest(0, p_coins_gained),
    greatest(0, p_talent_points_gained), coalesce(p_collected, '{}'::jsonb),
    to_jsonb(coalesce(p_achievement_ids, '{}'::text[]))
  ) on conflict (event_id) do nothing;

  if not found then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  select data, total_xp into current_data, total_xp_value
  from public.profile_progress where profile_id = uid for update;

  -- Auch bei einem direkten Offline-Upload darf ein altes Profil die
  -- einmalige Level-Coins-Nachvergütung nicht verlieren.
  if coalesce((current_data->>'version')::integer, 1) < 4 then
    current_data := jsonb_set(
      current_data,
      '{coins}',
      to_jsonb(
        coalesce((current_data->>'coins')::integer, 0)
        + coalesce((current_data->>'talentPoints')::integer, 0) * 10
      ),
      true
    );
  end if;
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    current_data := jsonb_set(
      current_data,
      '{coins}',
      to_jsonb(
        coalesce((current_data->>'coins')::integer, 0)
        + greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20
      ),
      true
    );
    current_data := jsonb_set(current_data, '{talentPoints}', '0'::jsonb, true);
    current_data := jsonb_set(current_data, '{version}', '5'::jsonb, true);
  end if;
  total_xp_value := total_xp_value + greatest(0, p_xp_gained);
  select level, xp into next_level, next_xp
  from public.profile_level_from_xp(total_xp_value);

  next_collected := coalesce(current_data->'collected', '{}'::jsonb);
  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    next_collected := jsonb_set(
      next_collected,
      array[item.key],
      to_jsonb(coalesce((next_collected->>item.key)::integer, 0) + (item.value #>> '{}')::integer),
      true
    );
  end loop;

  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into next_achievements
  from (
    select distinct value
    from jsonb_array_elements_text(
      coalesce(current_data->'unlockedAchievements', '[]'::jsonb)
      || to_jsonb(coalesce(p_achievement_ids, '{}'::text[]))
    ) as entries(value)
  ) unique_values;

  next_data := current_data || jsonb_build_object(
    'level', next_level,
    'xp', next_xp,
    'coins', coalesce((current_data->>'coins')::integer, 0)
      + greatest(0, p_coins_gained)
      + greatest(0, p_talent_points_gained) * 10,
    'talentPoints', 0,
    'bestScore', greatest(coalesce((current_data->>'bestScore')::integer, 0), p_score),
    'bestCombo', greatest(coalesce((current_data->>'bestCombo')::integer, 0), p_best_combo),
    'totalScore', coalesce((current_data->>'totalScore')::bigint, 0) + greatest(0, p_score),
    'totalRuns', coalesce((current_data->>'totalRuns')::integer, 0) + 1,
    'totalPlayTimeMs', coalesce((current_data->>'totalPlayTimeMs')::bigint, 0)
      + greatest(0, p_duration_ms),
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + greatest(0, p_coins_gained)
      + greatest(0, p_talent_points_gained) * 10,
    'collected', next_collected,
    'unlockedAchievements', next_achievements,
    'lastWorldId', p_world_id
  );

  update public.profile_progress
  set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = uid;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]) from public;
grant execute on function public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]) to authenticated;

-- Plausibilitaetsgrenze fuer Bestenlistenlaeufe.
--
-- Ein Browser kann niemals vollstaendig vertrauenswuerdig sein: Ein Nutzer
-- kann JavaScript veraendern. Die Datenbank akzeptiert deshalb nicht mehr
-- blind den vom Client gelieferten Score, sondern prueft ihn gegen die
-- gemeldete Laufdauer, Reliktanzahl, Combo und die Spielregeln. Das ist kein
-- Replay-Schutz, verhindert aber offensichtlich gefaelschte Millionenwerte.
create or replace function public.max_plausible_score(
  p_world_id text,
  p_duration_ms integer,
  p_best_combo integer,
  p_collected jsonb
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  item record;
  count_value integer;
  total_relics integer := 0;
  base_points numeric := 0;
  reward_multiplier numeric := case p_world_id
    when 'silberhain' then 1.03
    when 'frostzinne' then 1.06
    when 'glutmark' then 1.10
    when '__LEERENBLÜTE__' then 1.15
    when 'sonnenhort' then 1.18
    when 'mondschmiede' then 1.22
    when 'kristallbruch' then 1.30
    when 'sturmgrenze' then 1.40
    when 'lichtkern' then 1.52
    when 'horizonttor' then 1.65
    else 0
  end;
  combo_multiplier integer := case
    when p_best_combo >= 5 then 5
    when p_best_combo >= 4 then 4
    when p_best_combo >= 3 then 3
    when p_best_combo >= 2 then 2
    else 1
  end;
begin
  if p_duration_ms < 60000 or p_duration_ms > 120000 then return 0; end if;
  if reward_multiplier = 0 then return 0; end if;

  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary') then
      continue;
    end if;

    count_value := greatest(0, (item.value #>> '{}')::integer);
    total_relics := total_relics + count_value;
    base_points := base_points + count_value * case item.key
      when 'poor' then 1
      when 'common' then 2
      when 'uncommon' then 5
      when 'rare' then 15
      when 'epic' then 50
      when 'legendary' then 200
      else 0
    end;
  end loop;

  -- Die Spawn-Logik kann bei 90-106 Sekunden Dauer keine beliebig grosse
  -- Reliktmenge erzeugen. Der Wert 190 ms ist absichtlich grosszuegig und
  -- erlaubt Schwankungen, bleibt aber eine endliche serverseitige Grenze.
  if total_relics > ceil(p_duration_ms / 190.0)::integer then return 0; end if;
  if p_best_combo < 0 or p_best_combo > total_relics then return 0; end if;

  -- 1.30 = maximaler Gunst-Bonus, world multiplier = Weltbonus,
  -- 2 = historischer Serienpuffer, 1.10 = Rundungspuffer.
  return least(
    10000000,
    ceil(base_points * combo_multiplier * 1.30 * reward_multiplier * 2.0 * 1.10)::integer
  );
end;
$$;

revoke execute on function public.max_plausible_score(text, integer, integer, jsonb) from public;

-- Authenticated leaderboard calls may only write their own profile row.
drop function if exists public.submit_best_score(uuid, text, text, integer, integer, integer);
drop function if exists public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb);

create or replace function public.submit_best_score(
  p_player_id   uuid,
  p_player_name text,
  p_world_id    text,
  p_player_level integer,
  p_score       integer,
  p_best_combo  integer,
  p_duration_ms integer,
  p_collected   jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and p_player_id <> auth.uid() then
    raise exception 'Fremdes Spielerprofil';
  end if;
  if p_player_id is null or char_length(trim(p_player_name)) not between 1 and 16 then
    raise exception 'Ungültiges Spielerprofil';
  end if;
  if not public.is_player_name_available(trim(p_player_name), p_player_id) then
    raise exception 'Spielername bereits vergeben';
  end if;
  if p_score > public.max_plausible_score(
    p_world_id,
    p_duration_ms,
    p_best_combo,
    p_collected
  ) then
    raise exception 'Punktestand nicht plausibel';
  end if;

  insert into public.scores (
    player_id, player_name, world_id, player_level, score, best_combo
  )
  values (
    p_player_id,
    trim(p_player_name),
    p_world_id,
    greatest(1, least(100, p_player_level)),
    greatest(0, p_score),
    greatest(0, p_best_combo)
  )
  on conflict (player_id) where (player_id is not null) do update
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

revoke execute on function public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb) from public;
grant execute on function public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb) to anon, authenticated;

create or replace function public.rename_best_score(
  p_player_id   uuid,
  p_player_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and p_player_id <> auth.uid() then
    raise exception 'Fremdes Spielerprofil';
  end if;
  if p_player_id is null or char_length(trim(p_player_name)) not between 1 and 16 then
    raise exception 'Ungültiger Spielername';
  end if;
  if not public.is_player_name_available(trim(p_player_name), p_player_id) then
    raise exception 'Spielername bereits vergeben';
  end if;
  update public.scores set player_name = trim(p_player_name) where player_id = p_player_id;
  return true;
end;
$$;

revoke execute on function public.rename_best_score(uuid, text) from public;
grant execute on function public.rename_best_score(uuid, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
