-- Phase 2.27: Sicherheits-Hardening fuer Identitaet, Fortschritt und Saves.
--
-- Diese Migration ersetzt keine Serverhistorie. Sie schliesst die aktuell
-- offenen Schreib-/Lesepfade:
--   * is_admin kann nicht mehr per eigenem Profil-Update gesetzt werden.
--   * XP, Coins, Talentpunkte und neue Achievements werden serverseitig aus
--     einem plausibilisierten Run berechnet; Client-Rewards sind Metadaten.
--   * anonyme Saves brauchen ein lokales Capability-Token, nicht nur die UUID.
--   * die oeffentliche Rangliste gibt keine player_id mehr heraus.
--   * ein Login uebernimmt keinen unverifizierbaren Browser-Fortschritt.
--
-- Nachher pruefen: supabase/verify_security_hardening.sql. Besonders alte
-- Saves ohne Token koennen nur ueber Sync-Code oder den authentifizierten
-- Legacy-Claim migriert werden.

begin;

-- ============================================================================
-- 1. Admin-Selbsteskalation schliessen
-- ============================================================================

revoke all on public.profiles, public.saves, public.sync_codes, public.scores
from anon, authenticated;

create or replace function public.prevent_profile_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.is_admin is distinct from old.is_admin then
    raise exception 'Adminstatus darf nicht selbst geaendert werden';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_escalation on public.profiles;
create trigger profiles_prevent_admin_escalation
before update on public.profiles
for each row execute function public.prevent_profile_admin_escalation();

revoke execute on function public.prevent_profile_admin_escalation() from public;

-- ============================================================================
-- 2. Vertrauenswuerdigen Initialstand fuer Auth-Profile erzeugen
-- ============================================================================

create or replace function public.profile_default_data(p_player_name text default '')
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
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
    'playerName', left(trim(coalesce(p_player_name, '')), 16),
    'pendingPlayerName', null
  );
$$;

revoke execute on function public.profile_default_data(text) from public;

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
  safe_name text := left(trim(coalesce(p_data->>'playerName', '')), 16);
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(safe_name) not between 1 and 16 then
    raise exception 'Ungueltiger Spielername';
  end if;
  if safe_name !~ '^[a-z0-9_-]+$' then
    raise exception 'Ungueltiger Spielername';
  end if;
  if not public.is_player_name_available(safe_name, uid) then
    raise exception 'Spielername bereits vergeben';
  end if;

  insert into public.profiles (id, player_name, alias, alias_normalized)
  values (uid, safe_name, safe_name, safe_name)
  on conflict (id) do nothing;

  -- p_data und p_total_xp sind absichtlich nicht die Progressionsquelle.
  -- Ein Browser kann beide Werte beliebig veraendern.
  insert into public.profile_progress (profile_id, data, total_xp)
  values (uid, public.profile_default_data(safe_name), 0)
  on conflict (profile_id) do nothing;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.initialize_profile_progress(jsonb, bigint) from public;
grant execute on function public.initialize_profile_progress(jsonb, bigint) to authenticated;

-- Der alte anonyme Save wird nur noch als Besitznachweis fuer einen Claim
-- behandelt. Unverifizierbarer Browser-Fortschritt darf nicht in das
-- serverautorisierte Profil uebernommen werden.
drop function if exists public.claim_cloud_profile(uuid, bigint);
create or replace function public.claim_cloud_profile(
  p_cloud_id uuid,
  p_access_token text
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  save_exists boolean := false;
  legacy_save boolean := false;
  old_data jsonb;
  old_token_hashes text[];
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  if p_cloud_id is not null then
    select data, coalesce(access_token_hashes, '{}')
      into old_data, old_token_hashes
    from public.saves
    where id = p_cloud_id
    for update;
    save_exists := found;

    if save_exists then
      legacy_save := cardinality(old_token_hashes) = 0;
      if not legacy_save and (
        p_access_token is null or md5(p_access_token) <> any(old_token_hashes)
      ) then
        raise exception 'Save-Zugriffstoken ungueltig';
      end if;
      -- Legacy-Saves koennen nicht rueckwirkend mit einem geheimen Token
      -- versehen werden. Der einmalige Bridge-Pfad ist nur authentifiziert
      -- erreichbar und loescht den alten Save nach dem Claim.
    end if;
  end if;

  insert into public.profiles (id)
  values (uid)
  on conflict (id) do nothing;

  insert into public.profile_progress (profile_id, data, total_xp)
  values (uid, public.profile_default_data(''), 0)
  on conflict (profile_id) do nothing;

  -- Bestenlisten-Eintrag des anonymen Save mit dem Login-Profil verbinden.
  if save_exists and p_cloud_id <> uid then
    if exists (select 1 from public.scores where player_id = uid)
       and exists (select 1 from public.scores where player_id = p_cloud_id) then
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

  -- Der unverifizierbare anonyme Save und seine Codes sind nach dem Claim
  -- erledigt. Das verhindert spaetere Zugriffe ueber alte UUIDs.
  if save_exists then delete from public.saves where id = p_cloud_id; end if;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.claim_cloud_profile(uuid, text) from public;
grant execute on function public.claim_cloud_profile(uuid, text) to authenticated;

-- ============================================================================
-- 3. Progress-Events: Rewards und Achievements nur aus Serverdaten
-- ============================================================================

create or replace function public.progress_achievement_rank(p_id text)
returns integer
language sql
immutable
as $$
  select case p_id
    when 'first_hunt' then 1
    when 'combo_10' then 1 when 'combo_25' then 2 when 'combo_50' then 3
    when 'combo_75' then 4 when 'combo_100' then 5
    when 'combo_125' then 6 when 'combo_150' then 7
    when 'first_rare' then 1 when 'rare_10' then 2 when 'rare_50' then 3
    when 'rare_100' then 4 when 'rare_250' then 5
    when 'first_epic' then 1 when 'epic_10' then 2 when 'epic_25' then 3
    when 'epic_50' then 4 when 'epic_100' then 5
    when 'first_legendary' then 1 when 'legendary_3_run' then 2
    when 'legendary_10' then 3 when 'legendary_25' then 4
    when 'legendary_50' then 5
    when 'score_1000' then 1 when 'score_5000' then 2
    when 'score_15000' then 3 when 'score_30000' then 4
    when 'score_60000' then 5 when 'score_100000' then 6
    when 'score_150000' then 7
    when 'level_5' then 1 when 'level_10' then 2 when 'level_20' then 3
    when 'level_35' then 4 when 'level_50' then 5 when 'level_75' then 6
    when 'level_100' then 7
    when 'collector_500' then 1 when 'collector_2000' then 2
    when 'collector_5000' then 3 when 'collector_10000' then 4
    when 'collector_25000' then 5 when 'collector_50000' then 6
    when 'clean_run_50' then 1 when 'clean_run_75' then 2
    when 'clean_run_100' then 3 when 'clean_run_125' then 4
    when 'clean_run_150' then 5
    when 'runs_10' then 1 when 'runs_50' then 2 when 'runs_150' then 3
    when 'runs_500' then 4
    when 'playtime_hour' then 1 when 'playtime_five_hours' then 2
    when 'playtime_ten_hours' then 3
    when 'talents_5' then 1 when 'talents_15' then 2 when 'talents_30' then 3
    when 'world_traveller' then 1 when 'world_traveller_5' then 2
    when 'world_traveller_8' then 3 when 'world_traveller_10' then 4
    else 0
  end;
$$;

create or replace function public.progress_achievement_is_valid(
  p_id text,
  p_data jsonb,
  p_run_collected jsonb,
  p_run_total integer
)
returns boolean
language plpgsql
immutable
as $$
declare
  total_collected bigint := 0;
  talent_ranks bigint := 0;
begin
  select coalesce(sum(greatest(0, (value #>> '{}')::bigint)), 0)
    into total_collected
  from jsonb_each(coalesce(p_data->'collected', '{}'::jsonb));
  select coalesce(sum(greatest(0, (value #>> '{}')::bigint)), 0)
    into talent_ranks
  from jsonb_each(coalesce(p_data->'talents', '{}'::jsonb));

  return case p_id
    when 'first_hunt' then (p_data->>'totalRuns')::bigint >= 1
    when 'combo_10' then (p_data->>'bestCombo')::integer >= 10
    when 'combo_25' then (p_data->>'bestCombo')::integer >= 25
    when 'combo_50' then (p_data->>'bestCombo')::integer >= 50
    when 'combo_75' then (p_data->>'bestCombo')::integer >= 75
    when 'combo_100' then (p_data->>'bestCombo')::integer >= 100
    when 'combo_125' then (p_data->>'totalDailyRuns')::integer >= 7
    when 'combo_150' then (p_data->>'totalDailyRuns')::integer >= 30
    when 'first_rare' then (p_data->'collected'->>'rare')::bigint >= 1
    when 'rare_10' then (p_data->'collected'->>'rare')::bigint >= 10
    when 'rare_50' then (p_data->'collected'->>'rare')::bigint >= 50
    when 'rare_100' then (p_data->'collected'->>'rare')::bigint >= 100
    when 'rare_250' then (p_data->'collected'->>'rare')::bigint >= 250
    when 'first_epic' then (p_data->'collected'->>'epic')::bigint >= 1
    when 'epic_10' then (p_data->'collected'->>'epic')::bigint >= 10
    when 'epic_25' then (p_data->'collected'->>'epic')::bigint >= 25
    when 'epic_50' then (p_data->'collected'->>'epic')::bigint >= 50
    when 'epic_100' then (p_data->'collected'->>'epic')::bigint >= 100
    when 'first_legendary' then (p_data->'collected'->>'legendary')::bigint >= 1
    when 'legendary_3_run' then (p_run_collected->>'legendary')::integer >= 3
    when 'legendary_10' then (p_data->'collected'->>'legendary')::bigint >= 10
    when 'legendary_25' then (p_data->'collected'->>'legendary')::bigint >= 25
    when 'legendary_50' then (p_data->'collected'->>'legendary')::bigint >= 50
    when 'score_1000' then (p_data->>'bestScore')::integer >= 1000
    when 'score_5000' then (p_data->>'bestScore')::integer >= 3000
    when 'score_15000' then (p_data->>'bestScore')::integer >= 6000
    when 'score_30000' then (p_data->>'bestScore')::integer >= 10000
    when 'score_60000' then (p_data->>'bestScore')::integer >= 16000
    when 'score_100000' then (p_data->>'bestScore')::integer >= 24000
    when 'score_150000' then (p_data->>'bestScore')::integer >= 35000
    when 'level_5' then (p_data->>'level')::integer >= 5
    when 'level_10' then (p_data->>'level')::integer >= 10
    when 'level_20' then (p_data->>'level')::integer >= 20
    when 'level_35' then (p_data->>'level')::integer >= 35
    when 'level_50' then (p_data->>'level')::integer >= 50
    when 'level_75' then (p_data->>'level')::integer >= 75
    when 'level_100' then (p_data->>'level')::integer >= 100
    when 'collector_500' then total_collected >= 500
    when 'collector_2000' then total_collected >= 2000
    when 'collector_5000' then total_collected >= 5000
    when 'collector_10000' then total_collected >= 10000
    when 'collector_25000' then total_collected >= 25000
    when 'collector_50000' then total_collected >= 50000
    when 'clean_run_50' then p_run_total >= 50
    when 'clean_run_75' then p_run_total >= 75
    when 'clean_run_100' then p_run_total >= 100
    when 'clean_run_125' then p_run_total >= 125
    when 'clean_run_150' then p_run_total >= 150
    when 'runs_10' then (p_data->>'totalRuns')::bigint >= 10
    when 'runs_50' then (p_data->>'totalRuns')::bigint >= 50
    when 'runs_150' then (p_data->>'totalRuns')::bigint >= 150
    when 'runs_500' then (p_data->>'totalRuns')::bigint >= 500
    when 'playtime_hour' then (p_data->>'totalPlayTimeMs')::bigint >= 3600000
    when 'playtime_five_hours' then (p_data->>'totalPlayTimeMs')::bigint >= 18000000
    when 'playtime_ten_hours' then (p_data->>'totalPlayTimeMs')::bigint >= 36000000
    when 'talents_5' then talent_ranks >= 5
    when 'talents_15' then talent_ranks >= 15
    when 'talents_30' then talent_ranks >= 30
    when 'world_traveller' then (p_data->>'level')::integer >= 6
    when 'world_traveller_5' then (p_data->>'level')::integer >= 15
    when 'world_traveller_8' then (p_data->>'level')::integer >= 40
    when 'world_traveller_10' then (p_data->>'level')::integer >= 75
    else false
  end;
end;
$$;

revoke execute on function public.progress_achievement_rank(text) from public;
revoke execute on function public.progress_achievement_is_valid(text, jsonb, jsonb, integer) from public;

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
  p_achievement_ids text[]
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
  next_collected jsonb;
  next_achievements jsonb;
  total_xp_value bigint;
  current_level integer;
  next_level integer;
  next_xp integer;
  current_xp integer;
  point_interval integer;
  points_gained integer;
  item record;
  achievement_id text;
  valid_achievement_ids text[] := '{}'::text[];
  total_collected integer := 0;
  count_value integer;
  safe_score integer := greatest(0, coalesce(p_score, 0));
  safe_best_combo integer := greatest(0, coalesce(p_best_combo, 0));
  safe_duration_ms integer := coalesce(p_duration_ms, 0);
  safe_xp integer := 0;
  safe_run_coins integer := 0;
  level_coins integer := 0;
  achievement_coins integer := 0;
  achievement_rank integer;
  insight_rank integer;
  insight_bonus numeric;
  world_xp_multiplier numeric;
  global_multiplier numeric := (cfg->'economy'->>'globalMultiplier')::numeric;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_event_id is null then raise exception 'Ereignis-ID fehlt'; end if;
  if p_world_id is null or not (cfg->'worlds' ? p_world_id) then
    raise exception 'Unbekannte Welt';
  end if;
  if safe_duration_ms < 60000 or safe_duration_ms > 120000 then
    raise exception 'Ungueltige Laufdauer';
  end if;
  if cardinality(coalesce(p_achievement_ids, '{}'::text[])) > 64 then
    raise exception 'Zu viele Achievements';
  end if;
  if jsonb_typeof(coalesce(p_collected, '{}'::jsonb)) <> 'object' then
    raise exception 'Ungueltige Reliktstatistik';
  end if;

  select data, total_xp into current_data, total_xp_value
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if exists (
    select 1 from public.profile_progress_events
    where event_id = p_event_id and profile_id = uid
  ) then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;
  if exists (select 1 from public.profile_progress_events where event_id = p_event_id) then
    raise exception 'Ereignis-ID bereits verwendet';
  end if;

  next_collected := coalesce(current_data->'collected', '{}'::jsonb);
  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary') then
      raise exception 'Unbekannte Reliktart';
    end if;
    if jsonb_typeof(item.value) <> 'number'
       or (item.value #>> '{}') !~ '^[0-9]+$'
       or (item.value #>> '{}')::numeric > 632 then
      raise exception 'Ungueltige Reliktmenge';
    end if;
    count_value := (item.value #>> '{}')::integer;
    total_collected := total_collected + count_value;
    next_collected := jsonb_set(
      next_collected, array[item.key],
      to_jsonb(coalesce((next_collected->>item.key)::integer, 0) + count_value), true
    );
  end loop;
  if total_collected > ceil(safe_duration_ms / 190.0)::integer then
    raise exception 'Reliktmenge fuer Laufdauer nicht plausibel';
  end if;
  if safe_best_combo > total_collected then
    raise exception 'Combo groesser als Reliktmenge';
  end if;
  if safe_score > public.max_plausible_score(
    p_world_id, safe_duration_ms, safe_best_combo, p_collected
  ) then
    raise exception 'Punktestand nicht plausibel';
  end if;

  insight_rank := least(
    (cfg->'talents'->'maxRanks'->>'insight')::integer,
    greatest(0, coalesce((current_data->'talents'->>'insight')::integer, 0))
  );
  insight_bonus := (cfg->'talents'->>'insightXpPerRank')::numeric
    * case when insight_rank = (cfg->'talents'->'maxRanks'->>'insight')::integer
      then greatest(0, insight_rank - 1)
        + (cfg->'talents'->>'capstoneRankMultiplier')::numeric
      else insight_rank end;
  world_xp_multiplier := (cfg->'worlds'->p_world_id->>'xpMultiplier')::numeric;

  -- Gleiche Rundung wie der Client, aber mit serverseitiger Balance und
  -- serverseitigem Talentstand.
  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    count_value := (item.value #>> '{}')::integer;
    safe_xp := safe_xp + round(
      count_value * (cfg->'rarities'->item.key->>'xp')::numeric
        * (1 + insight_bonus) * world_xp_multiplier
    )::integer;
  end loop;

  safe_run_coins := round(
    (cfg->'economy'->'sources'->>'runBaseCoins')::numeric * global_multiplier
  )::integer;
  safe_run_coins := safe_run_coins + least(
    round((cfg->'economy'->'sources'->'collection'->>'maxCoins')::numeric * global_multiplier)::integer,
    floor(total_collected / (cfg->'economy'->'sources'->'collection'->>'stepSize')::numeric)::integer
      * round((cfg->'economy'->'sources'->'collection'->>'coinsPerStep')::numeric * global_multiplier)::integer
  );
  safe_run_coins := safe_run_coins
    + floor((coalesce((p_collected->>'rare')::integer, 0)
      / (cfg->'economy'->'sources'->'rarity'->>'rareCatchesPerCoin')::numeric))::integer
    + floor((coalesce((p_collected->>'epic')::integer, 0)
      / (cfg->'economy'->'sources'->'rarity'->>'epicCatchesPerStep')::numeric))::integer
        * round((cfg->'economy'->'sources'->'rarity'->>'epicCoinsPerStep')::numeric * global_multiplier)::integer
    + coalesce((p_collected->>'legendary')::integer, 0)
        * round((cfg->'economy'->'sources'->'rarity'->>'legendaryCoinsPerCatch')::numeric * global_multiplier)::integer;

  select level, xp into current_level, current_xp
  from public.profile_level_from_xp(greatest(0, coalesce(total_xp_value, 0)));
  total_xp_value := greatest(0, coalesce(total_xp_value, 0)) + safe_xp;
  select level, xp into next_level, next_xp
  from public.profile_level_from_xp(total_xp_value);
  point_interval := greatest(1, (cfg->'talents'->>'levelsPerTalentPoint')::integer);
  points_gained := greatest(
    0,
    floor(greatest(0, next_level - 1)::numeric / point_interval)::integer
      - floor(greatest(0, current_level - 1)::numeric / point_interval)::integer
  );
  level_coins := public.balance_coins_for_runs(
    greatest(0, next_level - current_level)
      * (cfg->'economy'->'sources'->>'levelRewardRuns')::numeric
  );

  next_data := current_data || jsonb_build_object(
    'level', next_level, 'xp', next_xp,
    'talentPoints', coalesce((current_data->>'talentPoints')::integer, 0) + points_gained,
    'coins', coalesce((current_data->>'coins')::bigint, 0) + safe_run_coins + level_coins,
    'bestScore', greatest(coalesce((current_data->>'bestScore')::integer, 0), safe_score),
    'bestCombo', greatest(coalesce((current_data->>'bestCombo')::integer, 0), safe_best_combo),
    'totalScore', coalesce((current_data->>'totalScore')::bigint, 0) + safe_score,
    'totalRuns', coalesce((current_data->>'totalRuns')::bigint, 0) + 1,
    'totalPlayTimeMs', coalesce((current_data->>'totalPlayTimeMs')::bigint, 0) + safe_duration_ms,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + safe_run_coins + level_coins,
    'collected', next_collected, 'lastWorldId', p_world_id,
    'version', public.save_version()
  );
  next_achievements := case
    when jsonb_typeof(current_data->'unlockedAchievements') = 'array'
      then current_data->'unlockedAchievements'
    else '[]'::jsonb end;

  foreach achievement_id in array coalesce(p_achievement_ids, '{}'::text[]) loop
    if achievement_id is null or next_achievements ? achievement_id then continue; end if;
    if public.progress_achievement_is_valid(
      achievement_id, next_data, coalesce(p_collected, '{}'::jsonb), total_collected
    ) then
      achievement_rank := public.progress_achievement_rank(achievement_id);
      if achievement_rank > 0 then
        next_achievements := next_achievements || jsonb_build_array(achievement_id);
        valid_achievement_ids := array_append(valid_achievement_ids, achievement_id);
        achievement_coins := achievement_coins + public.balance_coins_for_runs(
          (cfg->'economy'->'sources'->'achievement'->>'baseRuns')::numeric
            + greatest(0, achievement_rank - 1)
              * (cfg->'economy'->'sources'->'achievement'->>'additionalRunsPerRank')::numeric
        );
      end if;
    end if;
  end loop;

  next_data := next_data || jsonb_build_object(
    'coins', (next_data->>'coins')::bigint + achievement_coins,
    'totalCoinsEarned', (next_data->>'totalCoinsEarned')::bigint + achievement_coins,
    'unlockedAchievements', next_achievements
  );

  insert into public.profile_progress_events (
    event_id, profile_id, world_id, score, best_combo, xp_gained,
    duration_ms, coins_gained, talent_points_gained, collected, achievement_ids
  ) values (
    p_event_id, uid, p_world_id, safe_score, safe_best_combo, safe_xp,
    safe_duration_ms, safe_run_coins + level_coins + achievement_coins,
    points_gained, coalesce(p_collected, '{}'::jsonb), to_jsonb(valid_achievement_ids)
  );

  update public.profile_progress
  set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]) from public;
grant execute on function public.submit_progress_event(uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]) to authenticated;

-- ============================================================================
-- 4. Capability-Tokens fuer anonyme Saves und Sync-Codes
-- ============================================================================

alter table public.saves
  add column if not exists access_token_hashes text[] not null default '{}'::text[];

revoke select, insert, update, delete on public.saves from anon, authenticated;
revoke select, insert, update, delete on public.sync_codes from anon, authenticated;

drop function if exists public.get_save(uuid);
create or replace function public.get_save(p_id uuid, p_access_token text)
returns table (
  data jsonb, level integer, best_score integer, total_runs integer, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select data, level, best_score, total_runs, updated_at
  from public.saves
  where id = p_id
    and p_access_token is not null
    and md5(p_access_token) = any(coalesce(access_token_hashes, '{}'::text[]));
$$;

revoke execute on function public.get_save(uuid, text) from public;
grant execute on function public.get_save(uuid, text) to anon, authenticated;

drop function if exists public.upsert_save(uuid, jsonb, integer, integer, integer);
create or replace function public.upsert_save(
  p_id uuid,
  p_data jsonb,
  p_level integer,
  p_best_score integer,
  p_total_runs integer,
  p_access_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_hashes text[];
begin
  if p_id is null or p_access_token is null or length(p_access_token) < 32 then
    raise exception 'Ungueltiger Save-Zugriff';
  end if;
  select access_token_hashes into existing_hashes
  from public.saves where id = p_id for update;

  if found then
    if cardinality(coalesce(existing_hashes, '{}')) = 0 then
      raise exception 'Legacy-Save braucht Sync-Code oder Login-Claim';
    end if;
    if md5(p_access_token) <> any(existing_hashes) then
      raise exception 'Save-Zugriffstoken ungueltig';
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
      updated_at = excluded.updated_at;
  return true;
end;
$$;

revoke execute on function public.upsert_save(uuid, jsonb, integer, integer, integer, text) from public;
grant execute on function public.upsert_save(uuid, jsonb, integer, integer, integer, text) to anon, authenticated;

drop function if exists public.create_sync_code(uuid, text);
create or replace function public.create_sync_code(
  p_save_id uuid, p_code text, p_access_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_save_id is null or p_access_token is null or length(p_access_token) < 32 then
    raise exception 'Ungueltiger Save-Zugriff';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then
    raise exception 'Ungueltiges Code-Format';
  end if;
  if not exists (
    select 1 from public.saves
    where id = p_save_id
      and md5(p_access_token) = any(coalesce(access_token_hashes, '{}'::text[]))
  ) then
    raise exception 'Save-Zugriffstoken ungueltig';
  end if;
  insert into public.sync_codes (code, save_id) values (p_code, p_save_id);
  return true;
end;
$$;

revoke execute on function public.create_sync_code(uuid, text, text) from public;
grant execute on function public.create_sync_code(uuid, text, text) to anon, authenticated;

drop function if exists public.redeem_sync_code(text);
create or replace function public.redeem_sync_code(p_code text)
returns table (
  save_id uuid, access_token text, data jsonb, level integer,
  best_score integer, total_runs integer, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  found_save public.saves%rowtype;
  transfer_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  select s.* into found_save
  from public.sync_codes c
  join public.saves s on s.id = c.save_id
  where c.code = p_code and c.expires_at > now()
  for update of s;
  if not found then return; end if;

  update public.saves
  set access_token_hashes = array_append(
    coalesce(access_token_hashes, '{}'::text[]), md5(transfer_token)
  )
  where id = found_save.id;

  return query select found_save.id, transfer_token, found_save.data,
    found_save.level, found_save.best_score, found_save.total_runs, found_save.updated_at;
end;
$$;

revoke execute on function public.redeem_sync_code(text) from public;
grant execute on function public.redeem_sync_code(text) to anon, authenticated;

-- ============================================================================
-- 5. Rangliste ohne stabile Spieler-ID und mit autorisiertem Schreiben
-- ============================================================================

drop policy if exists "Bestenliste ist oeffentlich lesbar" on public.scores;
revoke select on public.scores from anon, authenticated;

drop function if exists public.get_public_leaderboard(text, text, integer);
create or replace function public.get_public_leaderboard(
  p_world_id text default null,
  p_access_token text default null,
  p_limit integer default 100
)
returns table (
  player_name text, player_level integer, score integer, best_combo integer,
  created_at timestamptz, world_id text, is_own boolean
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select s.*, row_number() over (
      partition by s.player_id order by s.score desc, s.created_at asc
    ) as duplicate_rank
    from public.scores s
    where p_world_id is null or s.world_id = p_world_id
  )
  select player_name, player_level, score, best_combo, created_at, world_id,
    (
      player_id = auth.uid()
      or (p_access_token is not null and exists (
        select 1 from public.saves sv
        where sv.id = player_id
          and md5(p_access_token) = any(coalesce(sv.access_token_hashes, '{}'::text[]))
      ))
    ) as is_own
  from ranked
  where duplicate_rank = 1
  order by score desc, created_at asc
  limit greatest(1, least(100, coalesce(p_limit, 100)));
$$;

revoke execute on function public.get_public_leaderboard(text, text, integer) from public;
grant execute on function public.get_public_leaderboard(text, text, integer) to anon, authenticated;

drop function if exists public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb, timestamptz);
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
  safe_recorded_at timestamptz := coalesce(p_recorded_at, now());
  safe_level integer := greatest(1, least(100, coalesce(p_player_level, 1)));
  save_hashes text[];
  save_exists boolean := false;
begin
  if p_player_id is null or char_length(trim(p_player_name)) not between 1 and 16
     or trim(p_player_name) !~ '^[a-z0-9_-]+$' then
    raise exception 'Ungueltiges Spielerprofil';
  end if;
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
      values (p_player_id, public.profile_default_data(trim(p_player_name)), array[md5(p_access_token)]);
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

  insert into public.scores (
    player_id, player_name, world_id, player_level, score, best_combo, created_at
  ) values (
    p_player_id, trim(p_player_name), p_world_id, safe_level,
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

revoke execute on function public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb, text, timestamptz) from public;
grant execute on function public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb, text, timestamptz) to anon, authenticated;

drop function if exists public.rename_best_score(uuid, text);
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
begin
  if p_player_id is null or trim(p_player_name) !~ '^[a-z0-9_-]{1,16}$' then
    raise exception 'Ungueltiges Spielerprofil';
  end if;
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
  update public.scores set player_name = trim(p_player_name) where player_id = p_player_id;
  return true;
end;
$$;

revoke execute on function public.rename_best_score(uuid, text, text) from public;
grant execute on function public.rename_best_score(uuid, text, text) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
