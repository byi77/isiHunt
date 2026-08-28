-- Kostenlose, levelgebundene Talentpunkte und kostenloser Talent-Reset.
--
-- Die bisherigen Profile sind reine Testdaten. Die Migration setzt deshalb
-- alle Profilfortschritte auf einen frischen Stand zurueck. Profilnamen und
-- lokale Einstellungen bleiben erhalten.

begin;

create or replace function public.save_version()
returns integer
language sql
immutable
as $$ select 9 $$;

comment on function public.save_version() is
  'Aktuelle Spielstand-Version. Gegenstueck zu SAVE_VERSION in src/config/GameConfig.ts.';

-- Die Balance-Funktion wird erneut verankert, weil phase_2_22 noch die alte
-- Talentkosten-Struktur als letzte Fassung eingesetzt hat.
create or replace function public.balance_config()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select $json${"run":{"expectedCatches":183,"economyCatches":133,"referenceComboMultiplier":1.27},"rarities":{"poor":{"points":3,"xp":2,"weight":34},"common":{"points":5,"xp":3,"weight":28},"uncommon":{"points":10,"xp":8,"weight":20},"rare":{"points":25,"xp":20,"weight":11},"epic":{"points":75,"xp":55,"weight":5.5},"legendary":{"points":250,"xp":130,"weight":1.5}},"score":{"seriesRaisingMinRarityIndex":2,"comboTiers":[{"minCombo":0,"multiplier":1},{"minCombo":2,"multiplier":1.2},{"minCombo":4,"multiplier":1.5},{"minCombo":7,"multiplier":1.9},{"minCombo":11,"multiplier":2.4},{"minCombo":16,"multiplier":3.2}]},"worlds":{"silberhain":{"scoreMultiplier":1,"xpMultiplier":1},"frostzinne":{"scoreMultiplier":1.04,"xpMultiplier":1.02},"glutmark":{"scoreMultiplier":1.08,"xpMultiplier":1.04},"__LEERENBLÜTE__":{"scoreMultiplier":1.12,"xpMultiplier":1.06},"sonnenhort":{"scoreMultiplier":1.16,"xpMultiplier":1.08},"mondschmiede":{"scoreMultiplier":1.2,"xpMultiplier":1.11},"kristallbruch":{"scoreMultiplier":1.26,"xpMultiplier":1.15},"sturmgrenze":{"scoreMultiplier":1.33,"xpMultiplier":1.19},"lichtkern":{"scoreMultiplier":1.39,"xpMultiplier":1.22},"horizonttor":{"scoreMultiplier":1.45,"xpMultiplier":1.25}},"progression":{"maxLevel":100,"xp":{"referencePerRun":2146,"globalMultiplier":1,"runsPerLevel":{"start":0.5,"settled":2.2,"max":3,"rampEnd":10},"dailyCompletionRuns":0.3494874184529366,"dailyScoreTierRuns":0.1164}},"economy":{"globalMultiplier":1,"referenceCoinsPerRun":50,"sources":{"runBaseCoins":20,"levelRewardRuns":0.4,"collection":{"stepSize":25,"coinsPerStep":3,"maxCoins":18},"rarity":{"rareCatchesPerCoin":5,"epicCatchesPerStep":2,"epicCoinsPerStep":2,"legendaryCoinsPerCatch":3},"achievement":{"baseRuns":0.4,"additionalRunsPerRank":0.3},"daily":{"loginRuns":0.5,"completionRuns":1.8,"scoreTierRuns":0.4,"scoreTierCount":3}},"sinks":{"talentCosts":[],"talentResetRuns":0,"shopPriceScale":true}},"talents":{"levelsPerTalentPoint":2,"capstoneRankMultiplier":1.25,"magnetRadiusCapstoneRankMultiplier":1,"reachRadiusPerRank":5,"swiftnessSpeedPerRank":0.05,"magnetRadiusPerRank":45,"magnetPullSpeedPerRank":0.15,"enduranceSecondsPerRank":3,"focusComboMsPerRank":100,"prospectorPromotionChancePerRank":0.03,"insightXpPerRank":0.05,"fortuneScorePerRank":0.05,"resonanceSeriesMultiplierPerRank":0.05,"shieldObstacleResistancePerRank":0.08,"maxRanks":{"reach":5,"swiftness":5,"magnetism":4,"endurance":4,"focus":4,"prospector":3,"insight":5,"fortune":5,"resonance":3,"shield":3}}}$json$::jsonb;
$$;

-- Bestehende Testprofile sauber auf Level 1 und die Standardkosmetik setzen.
-- Die zugehoerigen Ranglisten- und Eventreste gehoeren ebenfalls zum
-- Teststand und werden deshalb vollstaendig entfernt.
delete from public.scores;
delete from public.profile_progress_events;

update public.profile_progress
set data = data || jsonb_build_object(
  'version', public.save_version(),
  'level', 1, 'xp', 0, 'talentPoints', 0, 'coins', 0, 'talents', '{}'::jsonb,
  'bestScore', 0, 'bestScoreRecordedAt', null, 'bestCombo', 0,
  'totalScore', 0, 'totalRuns', 0, 'totalPlayTimeMs', 0,
  'totalCoinsEarned', 0, 'coinsSpent', 0,
  'lastLoginBonusKey', null, 'lastDailyKey', null,
  'dailyBestScore', 0, 'totalDailyRuns', 0,
  'pendingDailyKey', null, 'pendingDailyEventId', null,
  'pendingDailyCoins', 0, 'pendingDailyScore', 0,
  'collected', jsonb_build_object(
    'poor', 0, 'common', 0, 'uncommon', 0, 'rare', 0, 'epic', 0, 'legendary', 0
  ),
  'unlockedAchievements', '[]'::jsonb, 'lastWorldId', 'silberhain',
  'ownedShipShapes', '["arrow"]'::jsonb,
  'ownedShipColors', '["world"]'::jsonb,
  'ownedShipAuras', '["none"]'::jsonb,
  'shipShape', '"arrow"'::jsonb, 'shipColor', '"world"'::jsonb,
  'shipAura', '"none"'::jsonb, 'newCosmeticIds', '[]'::jsonb,
  'lastPurchasedCosmetic', 'null'::jsonb
), total_xp = 0, updated_at = now();

-- Falls ein altes anonymes Profil spaeter uebernommen wird, greift derselbe
-- Reset auch beim naechsten Profilabruf und bleibt nicht auf Version 8 stehen.
create or replace function public.get_profile_progress()
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  select data into current_data from public.profile_progress where profile_id = uid for update;
  if current_data is null then return; end if;

  if coalesce((current_data->>'version')::integer, 1) < public.save_version() then
    current_data := current_data || jsonb_build_object(
      'version', public.save_version(), 'level', 1, 'xp', 0,
      'talentPoints', 0, 'coins', 0, 'talents', '{}'::jsonb,
      'bestScore', 0, 'bestScoreRecordedAt', null, 'bestCombo', 0,
      'totalScore', 0, 'totalRuns', 0, 'totalPlayTimeMs', 0,
      'totalCoinsEarned', 0, 'coinsSpent', 0, 'lastLoginBonusKey', null,
      'lastDailyKey', null, 'dailyBestScore', 0, 'totalDailyRuns', 0,
      'pendingDailyKey', null, 'pendingDailyEventId', null,
      'pendingDailyCoins', 0, 'pendingDailyScore', 0,
      'collected', jsonb_build_object(
        'poor', 0, 'common', 0, 'uncommon', 0, 'rare', 0, 'epic', 0, 'legendary', 0
      ), 'unlockedAchievements', '[]'::jsonb, 'lastWorldId', 'silberhain',
      'ownedShipShapes', '["arrow"]'::jsonb, 'ownedShipColors', '["world"]'::jsonb,
      'ownedShipAuras', '["none"]'::jsonb, 'shipShape', '"arrow"'::jsonb,
      'shipColor', '"world"'::jsonb, 'shipAura', '"none"'::jsonb,
      'newCosmeticIds', '[]'::jsonb, 'lastPurchasedCosmetic', 'null'::jsonb
    );
    update public.profile_progress set data = current_data, total_xp = 0, updated_at = now()
    where profile_id = uid;
  end if;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

create or replace function public.purchase_talent(p_talent_id text)
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
  current_rank integer;
  max_rank integer;
  current_points integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  max_rank := (cfg->'talents'->'maxRanks'->>p_talent_id)::integer;
  if max_rank is null or max_rank <= 0 then raise exception 'Unbekanntes Talent'; end if;

  select data into current_data from public.profile_progress
  where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_rank := coalesce((current_data->'talents'->>p_talent_id)::integer, 0);
  current_points := coalesce((current_data->>'talentPoints')::integer, 0);
  if current_rank >= max_rank then raise exception 'Talent bereits maximiert'; end if;
  if current_points < 1 then raise exception 'Nicht genug Talentpunkte'; end if;

  next_data := jsonb_set(current_data, array['talents', p_talent_id], to_jsonb(current_rank + 1), true);
  next_data := jsonb_set(next_data, '{talentPoints}', to_jsonb(current_points - 1), true);
  next_data := jsonb_set(next_data, '{version}', to_jsonb(public.save_version()), true);
  update public.profile_progress set data = next_data, updated_at = now() where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

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
  invested_ranks integer;
  current_points integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  select data into current_data from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  select coalesce(sum(greatest(0, (value #>> '{}')::integer)), 0)
    into invested_ranks
  from jsonb_each(coalesce(current_data->'talents', '{}'::jsonb));
  if invested_ranks <= 0 then raise exception 'Keine investierten Talentpunkte'; end if;
  current_points := coalesce((current_data->>'talentPoints')::integer, 0);

  next_data := jsonb_set(current_data, '{talents}', '{}'::jsonb, true);
  next_data := jsonb_set(next_data, '{talentPoints}', to_jsonb(current_points + invested_ranks), true);
  next_data := jsonb_set(next_data, '{version}', to_jsonb(public.save_version()), true);
  update public.profile_progress set data = next_data, updated_at = now() where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

-- Tagesbonus: Levelaufstiege geben dieselben kostenlosen Talentpunkte wie Runs.
create or replace function public.claim_daily_bonus(
  p_daily_key text,
  p_score integer,
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
  safe_bonus integer;
  safe_score integer := greatest(0, p_score);
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
  if not public.daily_key_is_plausible(p_daily_key) then raise exception 'Ungueltiger Tageslauf'; end if;
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
    return query select * from public.profile_progress where profile_id = uid; return;
  end if;
  if p_event_id is null or not exists (
    select 1 from public.profile_progress_events where event_id = p_event_id and profile_id = uid
  ) then raise exception 'Tageslauf noch nicht synchronisiert'; end if;

  current_level := greatest(1, coalesce((current_data->>'level')::integer, 1));
  next_total_xp := coalesce(current_total_xp, 0) + safe_xp;
  select level, xp into next_level, next_xp from public.profile_level_from_xp(next_total_xp);
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
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0) + safe_bonus + level_coins,
    'version', public.save_version()
  );
  update public.profile_progress set data = next_data, total_xp = next_total_xp, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

create or replace function public.claim_daily_login_bonus(p_daily_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  current_total_xp bigint;
  current_updated_at timestamptz;
  login_coins integer := public.balance_coins_for_runs(
    (public.balance_config()->'economy'->'sources'->'daily'->>'loginRuns')::numeric
  );
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not public.daily_key_is_plausible(p_daily_key) then raise exception 'Ungueltiger Login-Tag'; end if;
  select data, total_xp, updated_at into current_data, current_total_xp, current_updated_at
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;
  if current_data->>'lastLoginBonusKey' = p_daily_key then
    return jsonb_build_object('claimed', false, 'profile', jsonb_build_object(
      'data', current_data, 'total_xp', current_total_xp, 'updated_at', current_updated_at));
  end if;

  next_data := current_data || jsonb_build_object(
    'lastLoginBonusKey', p_daily_key,
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

-- Progress-Events: Talentpunkte werden aus dem echten Levelsprung berechnet;
-- p_talent_points_gained bleibt nur als historische Event-Metadaten erhalten.
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
  point_interval integer;
  points_gained integer;
  item record;
  safe_duration_ms integer := least(102000, greatest(0, coalesce(p_duration_ms, 0)));
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
    greatest(0, p_xp_gained), safe_duration_ms, greatest(0, p_coins_gained),
    greatest(0, p_talent_points_gained), coalesce(p_collected, '{}'::jsonb),
    to_jsonb(coalesce(p_achievement_ids, '{}'::text[]))
  ) on conflict (event_id) do nothing;

  if not found then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  select data, total_xp into current_data, total_xp_value
  from public.profile_progress where profile_id = uid for update;
  total_xp_value := coalesce(total_xp_value, 0) + greatest(0, p_xp_gained);
  select level, xp into next_level, next_xp from public.profile_level_from_xp(total_xp_value);
  current_level := greatest(1, coalesce((current_data->>'level')::integer, 1));
  point_interval := greatest(1, (cfg->'talents'->>'levelsPerTalentPoint')::integer);
  points_gained := greatest(
    0,
    floor(greatest(0, next_level - 1)::numeric / point_interval)::integer
      - floor(greatest(0, current_level - 1)::numeric / point_interval)::integer
  );

  next_collected := coalesce(current_data->'collected', '{}'::jsonb);
  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    next_collected := jsonb_set(
      next_collected,
      array[item.key],
      to_jsonb(coalesce((next_collected->>item.key)::integer, 0) + greatest(0, (item.value #>> '{}')::integer)),
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
    'talentPoints', coalesce((current_data->>'talentPoints')::integer, 0) + points_gained,
    'coins', coalesce((current_data->>'coins')::integer, 0) + greatest(0, p_coins_gained),
    'bestScore', greatest(coalesce((current_data->>'bestScore')::integer, 0), p_score),
    'bestCombo', greatest(coalesce((current_data->>'bestCombo')::integer, 0), p_best_combo),
    'totalScore', coalesce((current_data->>'totalScore')::bigint, 0) + greatest(0, p_score),
    'totalRuns', coalesce((current_data->>'totalRuns')::integer, 0) + 1,
    'totalPlayTimeMs', coalesce((current_data->>'totalPlayTimeMs')::bigint, 0) + safe_duration_ms,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + greatest(0, p_coins_gained),
    'collected', next_collected,
    'unlockedAchievements', next_achievements,
    'lastWorldId', p_world_id,
    'version', public.save_version()
  );

  update public.profile_progress
  set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

-- Kosmetik-Sync darf die neue Save-Version nicht wieder auf 8 setzen.
create or replace function public.sync_profile_cosmetics(
  p_owned_ship_shapes text[], p_owned_ship_colors text[], p_owned_ship_auras text[],
  p_ship_shape text, p_ship_color text, p_ship_aura text
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  merged_shapes text[] := array['arrow']::text[];
  merged_colors text[] := array['world']::text[];
  merged_auras text[] := array['none']::text[];
  value text;
  next_shape text;
  next_color text;
  next_aura text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  select data into current_data from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if jsonb_typeof(current_data->'ownedShipShapes') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipShapes') loop
      if value <> '' and array_length(merged_shapes, 1) < 256 and not (value = any(merged_shapes)) then
        merged_shapes := array_append(merged_shapes, value);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipColors') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipColors') loop
      if value <> '' and array_length(merged_colors, 1) < 256 and not (value = any(merged_colors)) then
        merged_colors := array_append(merged_colors, value);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipAuras') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipAuras') loop
      if value <> '' and array_length(merged_auras, 1) < 256 and not (value = any(merged_auras)) then
        merged_auras := array_append(merged_auras, value);
      end if;
    end loop;
  end if;
  foreach value in array coalesce(p_owned_ship_shapes, '{}'::text[]) loop
    if value <> '' and array_length(merged_shapes, 1) < 256 and not (value = any(merged_shapes)) then
      merged_shapes := array_append(merged_shapes, value);
    end if;
  end loop;
  foreach value in array coalesce(p_owned_ship_colors, '{}'::text[]) loop
    if value <> '' and array_length(merged_colors, 1) < 256 and not (value = any(merged_colors)) then
      merged_colors := array_append(merged_colors, value);
    end if;
  end loop;
  foreach value in array coalesce(p_owned_ship_auras, '{}'::text[]) loop
    if value <> '' and array_length(merged_auras, 1) < 256 and not (value = any(merged_auras)) then
      merged_auras := array_append(merged_auras, value);
    end if;
  end loop;

  next_shape := case when p_ship_shape = any(merged_shapes) then p_ship_shape else coalesce(current_data->>'shipShape', 'arrow') end;
  next_color := case when p_ship_color = any(merged_colors) then p_ship_color else coalesce(current_data->>'shipColor', 'world') end;
  next_aura := case when p_ship_aura = any(merged_auras) then p_ship_aura else coalesce(current_data->>'shipAura', 'none') end;
  if not (next_shape = any(merged_shapes)) then next_shape := 'arrow'; end if;
  if not (next_color = any(merged_colors)) then next_color := 'world'; end if;
  if not (next_aura = any(merged_auras)) then next_aura := 'none'; end if;

  current_data := current_data || jsonb_build_object(
    'ownedShipShapes', to_jsonb(merged_shapes), 'ownedShipColors', to_jsonb(merged_colors),
    'ownedShipAuras', to_jsonb(merged_auras), 'shipShape', next_shape,
    'shipColor', next_color, 'shipAura', next_aura, 'version', public.save_version()
  );
  update public.profile_progress set data = current_data, updated_at = now() where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

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
  safe_level integer := greatest(1, least(
    (public.balance_config()->'progression'->>'maxLevel')::integer,
    coalesce(p_level, 50)
  ));
  safe_coins integer := greatest(0, coalesce(p_coins, 50000));
  target_total_xp bigint := public.balance_total_xp_for_level(safe_level);
  current_data jsonb;
  invested_ranks integer;
  point_interval integer := greatest(1, (public.balance_config()->'talents'->>'levelsPerTalentPoint')::integer);
begin
  if admin_id is null or not exists (
    select 1 from public.profiles where id = admin_id and is_admin
  ) then raise exception 'Wartungsrechte erforderlich'; end if;

  select id into target_id from public.profiles
  where alias_normalized = safe_alias or lower(trim(coalesce(alias, ''))) = safe_alias
  limit 1;
  if target_id is null then raise exception 'Profil nicht gefunden'; end if;

  select data into current_data from public.profile_progress
  where profile_id = target_id for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;
  select coalesce(sum(greatest(0, (value #>> '{}')::integer)), 0)
    into invested_ranks
  from jsonb_each(coalesce(current_data->'talents', '{}'::jsonb));

  current_data := current_data || jsonb_build_object(
    'level', safe_level,
    'xp', 0,
    'talentPoints', greatest(0, floor(greatest(0, safe_level - 1)::numeric / point_interval)::integer - invested_ranks),
    'coins', safe_coins,
    'totalCoinsEarned', greatest(safe_coins, coalesce((current_data->>'totalCoinsEarned')::bigint, 0)),
    'version', public.save_version()
  );
  update public.profile_progress set data = current_data, total_xp = target_total_xp, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

-- Auch der Admin-Reset schreibt den aktuellen Versionsanker.
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
  ) then raise exception 'Wartungsrechte erforderlich'; end if;
  select id into target_id from public.profiles
  where alias_normalized = safe_alias or lower(trim(coalesce(alias, ''))) = safe_alias limit 1;
  if target_id is null then raise exception 'Profil nicht gefunden'; end if;
  select data into current_data from public.profile_progress where profile_id = target_id for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  delete from public.scores where player_id = target_id;
  delete from public.profile_progress_events where profile_id = target_id;
  reset_data := current_data || jsonb_build_object(
    'version', public.save_version(), 'level', 1, 'xp', 0, 'talentPoints', 0,
    'coins', 0, 'talents', '{}'::jsonb, 'bestScore', 0, 'bestScoreRecordedAt', null,
    'bestCombo', 0, 'totalScore', 0, 'totalRuns', 0, 'totalPlayTimeMs', 0,
    'totalCoinsEarned', 0, 'coinsSpent', 0, 'lastLoginBonusKey', null,
    'lastDailyKey', null, 'dailyBestScore', 0, 'totalDailyRuns', 0,
    'pendingDailyKey', null, 'pendingDailyEventId', null, 'pendingDailyCoins', 0,
    'pendingDailyScore', 0, 'collected', jsonb_build_object(
      'poor', 0, 'common', 0, 'uncommon', 0, 'rare', 0, 'epic', 0, 'legendary', 0
    ), 'unlockedAchievements', '[]'::jsonb, 'ownedShipShapes', '["arrow"]'::jsonb,
    'ownedShipColors', '["world"]'::jsonb, 'ownedShipAuras', '["none"]'::jsonb,
    'shipShape', '"arrow"'::jsonb, 'shipColor', '"world"'::jsonb,
    'shipAura', '"none"'::jsonb, 'newCosmeticIds', '[]'::jsonb,
    'lastPurchasedCosmetic', 'null'::jsonb
  );
  update public.profile_progress set data = reset_data, total_xp = 0, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

revoke execute on function public.purchase_talent(text) from public;
grant execute on function public.purchase_talent(text) to authenticated;
revoke execute on function public.reset_talents() from public;
grant execute on function public.reset_talents() to authenticated;
revoke execute on function public.sync_profile_cosmetics(text[], text[], text[], text, text, text) from public;
grant execute on function public.sync_profile_cosmetics(text[], text[], text[], text, text, text) to authenticated;
revoke execute on function public.admin_reset_user(text) from public;
grant execute on function public.admin_reset_user(text) to authenticated;
revoke execute on function public.admin_boost_user(text, integer, integer) from public;
grant execute on function public.admin_boost_user(text, integer, integer) to authenticated;

commit;
notify pgrst, 'reload schema';
