-- Phase 2.6: Login und gemeinsamer Fortschritt auf mehreren Geräten.
--
-- Dieses Skript nach schema.sql im Supabase SQL Editor ausführen.
-- Es ist wiederholbar und löscht keine bestehenden Spielstände.
--
-- Der bisherige Sync-Code bleibt bestehen. Ein vorhandenes anonymes Profil
-- kann nach dem Login über claim_cloud_profile übernommen werden.
--
-- Der sichtbare Login ist ein Alias. Supabase Auth erhält dafür intern eine
-- interne Adresse der Form <alias>@<supabase-projekt>.supabase.co, weil der
-- Passwortlogin von Supabase direkt E-Mail oder Telefonnummer erwartet. Im
-- Supabase-Dashboard deshalb unter Authentication -> Providers -> Email die
-- Bestätigungspflicht deaktivieren; für diesen Login gibt es bewusst keine
-- E-Mail-Zustellung und zunächst auch keinen E-Mail-Passwort-Reset.

begin;

-- Ranglisten-Erweiterung: das Level wird zusammen mit dem Bestwert gespeichert.
alter table public.scores add column if not exists player_level integer not null default 1;
alter table public.scores drop constraint if exists scores_level_range;
alter table public.scores add constraint scores_level_range
  check (player_level between 1 and 100);

-- ============================================================================
-- 1. Auth-Profil und gemeinsamer Profilstand
-- ============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  player_name  text not null default '',
  alias        text,
  alias_normalized text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_name_length check (char_length(player_name) <= 16)
);

alter table public.profiles add column if not exists alias text;
alter table public.profiles add column if not exists alias_normalized text;

create unique index if not exists profiles_alias_normalized_idx
  on public.profiles (alias_normalized)
  where alias_normalized is not null;

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
  coins_gained             integer not null default 0,
  talent_points_gained     integer not null default 0,
  collected                jsonb not null default '{}'::jsonb,
  achievement_ids          jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now()
);

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

  if not exists (select 1 from public.profile_progress where profile_id = uid) then
    select data into old_data from public.saves where id = p_cloud_id;
    if old_data is not null then
      insert into public.profile_progress (profile_id, data, total_xp)
      values (uid, old_data, greatest(0, coalesce(p_total_xp, 0)));

      if exists (select 1 from public.scores where player_id = uid) then
        delete from public.scores where player_id = p_cloud_id;
      else
        update public.scores set player_id = uid where player_id = p_cloud_id;
      end if;
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
  talent_cost := 300 + current_rank * 100;
  if current_coins < talent_cost then raise exception 'Nicht genug Coins'; end if;
  if current_rank >= max_rank then raise exception 'Talent bereits maximiert'; end if;

  next_data := jsonb_set(current_data, array['talents', p_talent_id], to_jsonb(current_rank + 1), true);
  next_data := jsonb_set(next_data, '{coins}', to_jsonb(current_coins - talent_cost), true);
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
  if current_coins < 250 then raise exception 'Nicht genug Coins für den Reset'; end if;
  next_data := jsonb_set(current_data, '{talents}', '{}'::jsonb, true);
  next_data := jsonb_set(next_data, '{coins}', to_jsonb(current_coins - 250), true);
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

create or replace function public.submit_progress_event(
  p_event_id             uuid,
  p_world_id             text,
  p_score                integer,
  p_best_combo           integer,
  p_xp_gained            integer,
  p_coins_gained         integer,
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
    coins_gained, talent_points_gained, collected, achievement_ids
  ) values (
    p_event_id, uid, p_world_id, greatest(0, p_score), greatest(0, p_best_combo),
    greatest(0, p_xp_gained), greatest(0, p_coins_gained),
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

revoke execute on function public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, jsonb, text[]) from public;
grant execute on function public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, jsonb, text[]) to authenticated;

-- Authenticated leaderboard calls may only write their own profile row.
drop function if exists public.submit_best_score(uuid, text, text, integer, integer);

create or replace function public.submit_best_score(
  p_player_id   uuid,
  p_player_name text,
  p_world_id    text,
  p_player_level integer,
  p_score       integer,
  p_best_combo  integer
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

revoke execute on function public.submit_best_score(uuid, text, text, integer, integer, integer) from public;
grant execute on function public.submit_best_score(uuid, text, text, integer, integer, integer) to anon, authenticated;

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
  update public.scores set player_name = trim(p_player_name) where player_id = p_player_id;
  return true;
end;
$$;

revoke execute on function public.rename_best_score(uuid, text) from public;
grant execute on function public.rename_best_score(uuid, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
