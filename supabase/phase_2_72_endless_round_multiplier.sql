-- Phase 2.72: Endlos-Runde N zaehlt Punkte N-fach, die Serie laeuft weiter.
--
-- Der Client multipliziert jeden Punkt in Endlos-Runde N mit N (vorher
-- 1 + (N - 1) * 0,02) und hebt das Rundenziel um denselben Faktor. Die
-- Plausibilitaetsgrenze und das nachgerechnete Vorrunden-Gate ziehen hier mit,
-- sonst lehnte der Server ab Runde 2 jede ehrliche Runde ab.
--
-- Die Serie wird ueber den Checkpoint mitgenommen. Die beste Serie einer Runde
-- darf deshalb die Zahl ihrer Faenge um die mitgenommene Serie uebersteigen.
-- Diese ist hoechstens die beste Serie der Vorrunde (die Endserie kann nicht
-- ueber der besten liegen), und genau die liest die Pruefung aus dem Beleg.
--
-- `max_plausible_score` bleibt unveraendert - Solo, Tageslauf und Duell rufen
-- sie mit vier Argumenten auf. Die Endlos-Variante ist eine eigene Funktion,
-- damit keine zweite Ueberladung Aufrufe mehrdeutig macht.
--
-- Bereits gebuchte Runden bleiben unveraendert. Die Rangliste wird nicht
-- zurueckgesetzt.
begin;

do $$ begin
  if not exists (select 1 from public.isihunt_schema_state
                 where singleton = true and schema_version in (71, 72)) then
    raise exception 'Phase 2.71 muss vor Phase 2.72 ausgefuehrt werden';
  end if;
end $$;

create or replace function public.max_plausible_endless_score(
  p_world_id text,
  p_duration_ms integer,
  p_best_combo integer,
  p_carried_combo integer,
  p_collected jsonb
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  item record;
  count_value integer;
  total_relics integer := 0;
  base_points numeric := 0;
  reward_multiplier numeric := coalesce((cfg->'worlds'->p_world_id->>'scoreMultiplier')::numeric, 0);
  combo_multiplier numeric := 1;
  extra_series_multiplier numeric := coalesce(
    (cfg->'score'->>'comboMultiplierPerExtraSeries')::numeric,
    0
  );
  last_tier_combo integer := 0;
  tier jsonb;
  bonus_points integer := 0;
begin
  if p_duration_ms < 30000 or p_duration_ms > 120000 or reward_multiplier = 0 then return 0; end if;

  for tier in select value from jsonb_array_elements(cfg->'score'->'comboTiers') loop
    if p_best_combo >= (tier->>'minCombo')::integer then
      last_tier_combo := (tier->>'minCombo')::integer;
      combo_multiplier := (tier->>'multiplier')::numeric;
    end if;
  end loop;
  if p_best_combo > last_tier_combo then
    combo_multiplier := combo_multiplier
      + (p_best_combo - last_tier_combo) * extra_series_multiplier;
  end if;

  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary') then continue; end if;
    count_value := greatest(0, (item.value #>> '{}')::integer);
    total_relics := total_relics + count_value;
    base_points := base_points + count_value * (cfg->'rarities'->item.key->>'points')::numeric;
  end loop;
  if total_relics > ceil(p_duration_ms / 190.0)::integer then return 0; end if;
  if p_best_combo < 0 or p_best_combo > total_relics + greatest(0, coalesce(p_carried_combo, 0)) then
    return 0;
  end if;

  select bonus_score into bonus_points from public.run_bonus(p_best_combo, p_collected);

  return least(
    10000000::numeric,
    ceil(base_points * combo_multiplier * 1.30 * reward_multiplier * 1.25 * 1.10)
      + coalesce(bonus_points, 0)
  )::integer;
end;
$$;

revoke execute on function public.max_plausible_endless_score(
  text, integer, integer, integer, jsonb
) from public;

create or replace function public.submit_endless_round(
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
  p_round integer,
  p_session_id uuid,
  p_talents jsonb
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
  current_xp integer;
  next_level integer;
  next_xp integer;
  point_interval integer;
  points_gained integer;
  item record;
  achievement_id text;
  valid_achievement_ids text[] := '{}'::text[];
  total_collected integer := 0;
  count_value integer;
  talent_item record;
  total_talent_ranks integer := 0;
  previous_score bigint;
  previous_talents jsonb;
  previous_gate integer;
  previous_best_combo integer := 0;
  previous_rank integer;
  next_rank integer;
  talent_delta integer := 0;
  world_ids text[] := array['silberhain', 'frostzinne', 'glutmark', '__LEERENBL' || chr(220) || 'TE__', 'sonnenhort', 'mondschmiede', 'kristallbruch', 'sturmgrenze', 'lichtkern', 'horizonttor'];
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
  if safe_duration_ms <> 30000 then
    raise exception 'Ungueltige Endlos-Rundendauer';
  end if;
  if p_session_id is null then
    raise exception 'Endlos-Serienkennung fehlt';
  end if;
  if p_round is null or p_round < 1 or p_round > 1000
     or p_world_id <> world_ids[least(10, ((p_round - 1) / 2) + 1)] then
    raise exception 'Ungueltige Endlos-Runde oder Welt';
  end if;
  if jsonb_typeof(coalesce(p_talents, '{}'::jsonb)) <> 'object' then
    raise exception 'Ungueltige Endlos-Talente';
  end if;
  for talent_item in select key, value from jsonb_each(coalesce(p_talents, '{}'::jsonb)) loop
    if talent_item.key = 'endurance'
       or not (cfg->'talents'->'maxRanks' ? talent_item.key)
       or jsonb_typeof(talent_item.value) <> 'number'
       or (talent_item.value #>> '{}') !~ '^[0-9]+$'
       or (talent_item.value #>> '{}')::integer >
          (cfg->'talents'->'maxRanks'->>talent_item.key)::integer then
      raise exception 'Ungueltiger Endlos-Talentrang';
    end if;
    total_talent_ranks := total_talent_ranks + (talent_item.value #>> '{}')::integer;
  end loop;
  if total_talent_ranks > p_round - 1 + floor((p_round - 1)::numeric / 4)::integer then
    raise exception 'Zu viele Endlos-Talente';
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
  if p_round > 1 then
    select endless_talents into previous_talents
    from public.profile_progress_events
    where profile_id = uid and endless_session_id = p_session_id
      and endless_round = p_round - 1;
    if not found then raise exception 'Vorheriger Checkpoint fehlt'; end if;
    select coalesce(sum(score), 0) into previous_score
    from public.profile_progress_events
    where profile_id = uid and endless_session_id = p_session_id
      and endless_round < p_round;
    select best_combo into previous_best_combo
    from public.profile_progress_events
    where profile_id = uid and endless_session_id = p_session_id
      and endless_round = p_round - 1;
    select sum(case gate.round_number
      when 1 then 500 when 2 then 700 when 3 then 900 when 4 then 1100
      else 1300 + (gate.round_number - 5) * 300 end * gate.round_number)::integer
    into previous_gate
    from generate_series(1, p_round - 1) as gate(round_number);
    if previous_score < previous_gate then
      raise exception 'Vorheriger Checkpoint nicht erreicht';
    end if;
    for talent_item in select key, value from jsonb_each(coalesce(p_talents, '{}'::jsonb)) loop
      previous_rank := coalesce((previous_talents->>talent_item.key)::integer, 0);
      next_rank := (talent_item.value #>> '{}')::integer;
      if next_rank < previous_rank then raise exception 'Endlos-Talent verloren'; end if;
      talent_delta := talent_delta + next_rank - previous_rank;
    end loop;
    for talent_item in select key, value from jsonb_each(coalesce(previous_talents, '{}'::jsonb)) loop
      if not coalesce(p_talents, '{}'::jsonb) ? talent_item.key
         and (talent_item.value #>> '{}')::integer > 0 then
        raise exception 'Endlos-Talent verloren';
      end if;
    end loop;
    if talent_delta > (case when (p_round - 1) % 4 = 0 then 2 else 1 end) then
      raise exception 'Zu viele Endlos-Talente am Checkpoint';
    end if;
  end if;
  if exists (select 1 from public.profile_progress_events
             where profile_id = uid and endless_session_id = p_session_id
               and endless_round = p_round) then
    raise exception 'Endlos-Runde bereits gebucht';
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
  if safe_best_combo > total_collected + coalesce(previous_best_combo, 0) then
    raise exception 'Combo groesser als Reliktmenge';
  end if;
  if safe_score > public.max_plausible_endless_score(
    p_world_id, safe_duration_ms, safe_best_combo, coalesce(previous_best_combo, 0), p_collected
  ) * greatest(1, p_round) then
    raise exception 'Punktestand nicht plausibel';
  end if;

  insight_rank := least(
    (cfg->'talents'->'maxRanks'->>'insight')::integer,
    greatest(0, coalesce((p_talents->>'insight')::integer, 0))
  );
  insight_bonus := (cfg->'talents'->>'insightXpPerRank')::numeric
    * case when insight_rank = (cfg->'talents'->'maxRanks'->>'insight')::integer
      then greatest(0, insight_rank - 1)
        + (cfg->'talents'->>'capstoneRankMultiplier')::numeric
      else insight_rank end;
  world_xp_multiplier := (cfg->'worlds'->p_world_id->>'xpMultiplier')::numeric;

  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    count_value := (item.value #>> '{}')::integer;
    safe_xp := safe_xp + round(
      count_value * (cfg->'rarities'->item.key->>'xp')::numeric
        * (1 + insight_bonus) * world_xp_multiplier
    )::integer;
  end loop;

  safe_xp := round(safe_xp * (1 + greatest(0, p_round - 1) * 0.04))::integer;

  safe_run_coins := round(
    (cfg->'economy'->'sources'->>'runBaseCoins')::numeric * global_multiplier / 3
  )::integer;
  safe_run_coins := safe_run_coins + greatest(0, p_round - 1) * 2;
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
    'level', next_level,
    'xp', next_xp,
    'talentPoints', coalesce((current_data->>'talentPoints')::integer, 0) + points_gained,
    'coins', coalesce((current_data->>'coins')::bigint, 0) + safe_run_coins + level_coins,
    'bestScore', greatest(coalesce((current_data->>'bestScore')::integer, 0), safe_score),
    'bestCombo', greatest(coalesce((current_data->>'bestCombo')::integer, 0), safe_best_combo),
    'totalScore', coalesce((current_data->>'totalScore')::bigint, 0) + safe_score,
    'totalRuns', coalesce((current_data->>'totalRuns')::bigint, 0) + 1,
    'totalPlayTimeMs', coalesce((current_data->>'totalPlayTimeMs')::bigint, 0) + safe_duration_ms,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + safe_run_coins + level_coins,
    'collected', next_collected,
    'lastWorldId', p_world_id,
    'version', public.save_version()
  );
  next_achievements := case
    when jsonb_typeof(current_data->'unlockedAchievements') = 'array'
      then current_data->'unlockedAchievements'
    else '[]'::jsonb end;

  foreach achievement_id in array coalesce(p_achievement_ids, '{}'::text[]) loop
    if achievement_id is null or next_achievements ? achievement_id then continue; end if;
    if public.progress_achievement_is_valid(
      achievement_id, next_data, p_collected, total_collected
    ) then
      valid_achievement_ids := valid_achievement_ids || achievement_id;
      next_achievements := next_achievements || to_jsonb(achievement_id);
      achievement_rank := public.progress_achievement_rank(achievement_id);
      achievement_coins := achievement_coins + public.balance_coins_for_runs(
        (cfg->'economy'->'sources'->'achievement'->>'baseRuns')::numeric
          + greatest(0, achievement_rank - 1)
            * (cfg->'economy'->'sources'->'achievement'->>'additionalRunsPerRank')::numeric
      );
    end if;
  end loop;

  next_data := next_data || jsonb_build_object(
    'unlockedAchievements', next_achievements,
    'coins', (next_data->>'coins')::bigint + achievement_coins,
    'totalCoinsEarned', (next_data->>'totalCoinsEarned')::bigint + achievement_coins
  );

  insert into public.profile_progress_events (
    event_id, profile_id, world_id, score, best_combo, xp_gained,
    duration_ms, coins_gained, talent_points_gained, collected, achievement_ids,
    endless_session_id, endless_round, endless_talents
  ) values (
    p_event_id, uid, p_world_id, safe_score, safe_best_combo, safe_xp,
    safe_duration_ms, safe_run_coins + level_coins + achievement_coins,
    points_gained, coalesce(p_collected, '{}'::jsonb), to_jsonb(valid_achievement_ids),
    p_session_id, p_round, coalesce(p_talents, '{}'::jsonb)
  );

  update public.profile_progress
  set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = uid;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.submit_endless_round(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], integer, uuid, jsonb
) from public, anon;
grant execute on function public.submit_endless_round(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], integer, uuid, jsonb
) to authenticated;

update public.isihunt_schema_state
set schema_version = 72,
    migration_name = 'phase_2_72_endless_round_multiplier.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
