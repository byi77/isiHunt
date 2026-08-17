-- Phase 2.7: Sichere Admin-Werkzeuge fuer Benutzerprofile.
--
-- Dieses Skript legt nur geschuetzte RPCs an. Es loescht keine Daten.
-- Der echte Komplett-Reset liegt bewusst separat in
-- `maintenance_reset_except_byi77.sql`.

begin;

create or replace function public.admin_boost_user(
  p_alias text,
  p_level integer default 50,
  p_coins integer default 50000
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  target_id uuid;
  safe_alias text := lower(trim(coalesce(p_alias, '')));
  safe_level integer := greatest(1, least(100, coalesce(p_level, 50)));
  safe_coins integer := greatest(0, coalesce(p_coins, 50000));
  target_total_xp bigint := 0;
  level_cursor integer := 1;
  required_xp bigint;
  current_data jsonb;
begin
  if admin_id is null or not exists (
    select 1 from public.profiles where id = admin_id and is_admin
  ) then
    raise exception 'Wartungsrechte erforderlich';
  end if;

  select id into target_id
  from public.profiles
  where alias_normalized = safe_alias
     or lower(trim(coalesce(alias, ''))) = safe_alias
  limit 1;

  if target_id is null then raise exception 'Profil nicht gefunden'; end if;

  select data into current_data
  from public.profile_progress
  where profile_id = target_id
  for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  while level_cursor < safe_level loop
    required_xp := floor(
      750 * sqrt(level_cursor::numeric)
      + 8 * power(level_cursor::numeric, 1.25)
    );
    target_total_xp := target_total_xp + required_xp;
    level_cursor := level_cursor + 1;
  end loop;

  current_data := current_data || jsonb_build_object(
    'level', safe_level,
    'xp', 0,
    'coins', safe_coins,
    'totalCoinsEarned', greatest(
      safe_coins,
      coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
    ),
    'version', 6
  );

  update public.profile_progress
  set data = current_data, total_xp = target_total_xp, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

revoke execute on function public.admin_boost_user(text, integer, integer) from public;
grant execute on function public.admin_boost_user(text, integer, integer) to authenticated;

create or replace function public.admin_reset_user(p_alias text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  target_id uuid;
  safe_alias text := lower(trim(coalesce(p_alias, '')));
  current_data jsonb;
  reset_data jsonb;
begin
  if admin_id is null or not exists (
    select 1 from public.profiles where id = admin_id and is_admin
  ) then
    raise exception 'Wartungsrechte erforderlich';
  end if;

  select id into target_id
  from public.profiles
  where alias_normalized = safe_alias
     or lower(trim(coalesce(alias, ''))) = safe_alias
  limit 1;

  if target_id is null then raise exception 'Profil nicht gefunden'; end if;

  select data into current_data
  from public.profile_progress
  where profile_id = target_id
  for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  delete from public.scores where player_id = target_id;
  delete from public.profile_progress_events where profile_id = target_id;

  reset_data := current_data || jsonb_build_object(
    'level', 1,
    'xp', 0,
    'talentPoints', 0,
    'coins', 0,
    'talents', '{}'::jsonb,
    'bestScore', 0,
    'bestScoreRecordedAt', null,
    'bestCombo', 0,
    'totalScore', 0,
    'totalRuns', 0,
    'totalPlayTimeMs', 0,
    'totalCoinsEarned', 0,
    'coinsSpent', 0,
    'lastLoginBonusKey', null,
    'lastDailyKey', null,
    'dailyBestScore', 0,
    'totalDailyRuns', 0,
    'pendingDailyKey', null,
    'pendingDailyEventId', null,
    'pendingDailyCoins', 0,
    'pendingDailyScore', 0,
    'collected', jsonb_build_object(
      'poor', 0, 'common', 0, 'uncommon', 0,
      'rare', 0, 'epic', 0, 'legendary', 0
    ),
    'unlockedAchievements', '[]'::jsonb,
    'version', 6
  );

  update public.profile_progress
  set data = reset_data, total_xp = 0, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

revoke execute on function public.admin_reset_user(text) from public;
grant execute on function public.admin_reset_user(text) to authenticated;

commit;
notify pgrst, 'reload schema';
