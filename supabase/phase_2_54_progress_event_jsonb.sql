-- Phase 2.54: Laufbelege wieder atomar mit dem Fortschritt speichern.
-- Phase 2.52 uebergab text[] an achievement_ids (jsonb): SQLSTATE 42804.
-- Phase 2.53 behebt diesen Typfehler nicht. CREATE OR REPLACE FUNCTION
-- behaelt bestehende Rechte bei; der SECURITY-DEFINER-Wrapper war erreichbar.
-- Wiederholbar nach 2.53; keine historischen Spielstaende werden veraendert.

begin;
do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (53, 54)
  ) then
    raise exception 'Phase 2.53 muss vor Phase 2.54 ausgefuehrt werden';
  end if;
end;
$$;

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
  safe_bonus_xp integer := 0;
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

  -- Die Abschlusspraemie kommt ungewichtet oben drauf: Sie belohnt die
  -- Ausbeute des Runs, nicht den einzelnen Fang, und wird deshalb weder mit
  -- Insight noch mit dem Weltfaktor multipliziert. Der Client rechnet
  -- genauso (src/systems/RunBonusSystem.ts).
  select bonus_xp into safe_bonus_xp from public.run_bonus(safe_best_combo, p_collected);
  safe_xp := safe_xp + greatest(0, coalesce(safe_bonus_xp, 0));

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
      achievement_id, next_data, next_collected, safe_best_combo
    ) then
      valid_achievement_ids := valid_achievement_ids || achievement_id;
      next_achievements := next_achievements || to_jsonb(achievement_id);
      achievement_rank := public.progress_achievement_rank(achievement_id);
      achievement_coins := achievement_coins + public.balance_coins_for_runs(
        (cfg->'economy'->'sources'->'achievement'->>'baseRuns')::numeric
          + greatest(0, achievement_rank)
            * (cfg->'economy'->'sources'->'achievement'->>'additionalRunsPerRank')::numeric
      );
    end if;
  end loop;

  next_data := next_data || jsonb_build_object(
    'unlockedAchievements', next_achievements,
    'coins', (next_data->>'coins')::bigint + achievement_coins,
    'totalCoinsEarned', (next_data->>'totalCoinsEarned')::bigint + achievement_coins
  );

  -- Nur serverseitig validierte Werte als Laufbeleg speichern. Die Spalte
  -- achievement_ids ist JSONB; ein SQL-text[] bricht den gesamten RPC ab.
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

revoke execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]
) from public, anon, authenticated;

update public.isihunt_schema_state
set schema_version = 54,
    migration_name = 'phase_2_54_progress_event_jsonb.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
