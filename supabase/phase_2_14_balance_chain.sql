-- Zentrale Balance-Kette fuer Client und Online-Profil.
--
-- Die Rohwerte entsprechen src/config/balance-data.json. Der Client berechnet
-- daraus seine Werte direkt; diese Migration stellt dieselben Ableitungen fuer
-- serverseitige Level-, Tages- und Shop-Operationen bereit. Historische
-- Migrationen bleiben unveraendert, damit alte Spielstaende nicht neu bewertet
-- werden.

begin;

create or replace function public.balance_config()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select $json$
  {
    "run": {
      "expectedCatches": 183,
      "economyCatches": 133,
      "referenceComboMultiplier": 1.27
    },
    "rarities": {
      "poor": {
        "points": 3,
        "xp": 2,
        "weight": 34
      },
      "common": {
        "points": 5,
        "xp": 3,
        "weight": 28
      },
      "uncommon": {
        "points": 10,
        "xp": 8,
        "weight": 20
      },
      "rare": {
        "points": 25,
        "xp": 20,
        "weight": 11
      },
      "epic": {
        "points": 75,
        "xp": 55,
        "weight": 5.5
      },
      "legendary": {
        "points": 250,
        "xp": 130,
        "weight": 1.5
      }
    },
    "score": {
      "seriesRaisingMinRarityIndex": 2,
      "comboTiers": [
        {
          "minCombo": 0,
          "multiplier": 1
        },
        {
          "minCombo": 2,
          "multiplier": 1.2
        },
        {
          "minCombo": 4,
          "multiplier": 1.5
        },
        {
          "minCombo": 7,
          "multiplier": 1.9
        },
        {
          "minCombo": 11,
          "multiplier": 2.4
        },
        {
          "minCombo": 16,
          "multiplier": 3.2
        }
      ]
    },
    "worlds": {
      "silberhain": {
        "scoreMultiplier": 1,
        "xpMultiplier": 1
      },
      "frostzinne": {
        "scoreMultiplier": 1.04,
        "xpMultiplier": 1.02
      },
      "glutmark": {
        "scoreMultiplier": 1.08,
        "xpMultiplier": 1.04
      },
      "__LEERENBLÜTE__": {
        "scoreMultiplier": 1.12,
        "xpMultiplier": 1.06
      },
      "sonnenhort": {
        "scoreMultiplier": 1.16,
        "xpMultiplier": 1.08
      },
      "mondschmiede": {
        "scoreMultiplier": 1.2,
        "xpMultiplier": 1.11
      },
      "kristallbruch": {
        "scoreMultiplier": 1.26,
        "xpMultiplier": 1.15
      },
      "sturmgrenze": {
        "scoreMultiplier": 1.33,
        "xpMultiplier": 1.19
      },
      "lichtkern": {
        "scoreMultiplier": 1.39,
        "xpMultiplier": 1.22
      },
      "horizonttor": {
        "scoreMultiplier": 1.45,
        "xpMultiplier": 1.25
      }
    },
    "progression": {
      "maxLevel": 100,
      "xp": {
        "referencePerRun": 2146,
        "globalMultiplier": 1,
        "runsPerLevel": {
          "start": 0.5,
          "settled": 2.2,
          "max": 3,
          "rampEnd": 10
        },
        "dailyCompletionRuns": 0.3494874184529366,
        "dailyScoreTierRuns": 0.1164
      }
    },
    "economy": {
      "globalMultiplier": 1,
      "referenceCoinsPerRun": 50,
      "sources": {
        "runBaseCoins": 20,
        "levelRewardRuns": 0.4,
        "collection": {
          "stepSize": 25,
          "coinsPerStep": 3,
          "maxCoins": 18
        },
        "rarity": {
          "rareCatchesPerCoin": 5,
          "epicCatchesPerStep": 2,
          "epicCoinsPerStep": 2,
          "legendaryCoinsPerCatch": 3
        },
        "achievement": {
          "baseRuns": 0.4,
          "additionalRunsPerRank": 0.3
        },
        "daily": {
          "loginRuns": 0.5,
          "completionRuns": 1.8,
          "scoreTierRuns": 0.4,
          "scoreTierCount": 3
        }
      },
      "sinks": {
        "talentCosts": [],
        "talentResetRuns": 0,
        "shopPriceScale": true
      }
    },
    "talents": {
      "levelsPerTalentPoint": 2,
      "capstoneRankMultiplier": 1.25,
      "magnetRadiusCapstoneRankMultiplier": 1,
      "reachRadiusPerRank": 5,
      "swiftnessSpeedPerRank": 0.05,
      "magnetRadiusPerRank": 45,
      "magnetPullSpeedPerRank": 0.15,
      "enduranceSecondsPerRank": 3,
      "focusComboMsPerRank": 100,
      "prospectorPromotionChancePerRank": 0.03,
      "insightXpPerRank": 0.05,
      "fortuneScorePerRank": 0.05,
      "resonanceSeriesMultiplierPerRank": 0.05,
      "shieldObstacleResistancePerRank": 0.08,
      "maxRanks": {
        "reach": 5,
        "swiftness": 5,
        "magnetism": 4,
        "endurance": 4,
        "focus": 4,
        "prospector": 3,
        "insight": 5,
        "fortune": 5,
        "resonance": 3,
        "shield": 3
      }
    }
  }
  $json$::jsonb;
$$;

create or replace function public.balance_xp_for_runs(p_runs numeric)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  weight_total numeric;
  xp_per_catch numeric;
  current_xp_per_run numeric;
begin
  select sum((value->>'weight')::numeric) into weight_total
  from jsonb_each(cfg->'rarities');

  select sum(
    ((value->>'weight')::numeric / weight_total) * (value->>'xp')::numeric
  ) into xp_per_catch
  from jsonb_each(cfg->'rarities');

  current_xp_per_run := xp_per_catch
    * (cfg->'run'->>'expectedCatches')::numeric
    * (cfg->'progression'->'xp'->>'globalMultiplier')::numeric;

  return greatest(0, round(
    p_runs
    * (cfg->'progression'->'xp'->>'referencePerRun')::numeric
    * current_xp_per_run / 1883.985
  )::integer);
end;
$$;

create or replace function public.balance_coins_for_runs(p_runs numeric)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  weight_total numeric;
  current_coins_per_run numeric;
  collection_bonus numeric;
  rarity_bonus numeric;
begin
  select sum((value->>'weight')::numeric) into weight_total
  from jsonb_each(cfg->'rarities');

  collection_bonus := least(
    (cfg->'economy'->'sources'->'collection'->>'maxCoins')::numeric,
    (cfg->'run'->>'economyCatches')::numeric
      / (cfg->'economy'->'sources'->'collection'->>'stepSize')::numeric
      * (cfg->'economy'->'sources'->'collection'->>'coinsPerStep')::numeric
  );
  rarity_bonus :=
    ((cfg->'run'->>'economyCatches')::numeric * (cfg->'rarities'->'rare'->>'weight')::numeric
      / weight_total / (cfg->'economy'->'sources'->'rarity'->>'rareCatchesPerCoin')::numeric)
    + ((cfg->'run'->>'economyCatches')::numeric * (cfg->'rarities'->'epic'->>'weight')::numeric
      / weight_total / (cfg->'economy'->'sources'->'rarity'->>'epicCatchesPerStep')::numeric)
      * (cfg->'economy'->'sources'->'rarity'->>'epicCoinsPerStep')::numeric
    + ((cfg->'run'->>'economyCatches')::numeric * (cfg->'rarities'->'legendary'->>'weight')::numeric
      / weight_total) * (cfg->'economy'->'sources'->'rarity'->>'legendaryCoinsPerCatch')::numeric;

  current_coins_per_run := (
    (cfg->'economy'->'sources'->>'runBaseCoins')::numeric
    + collection_bonus + rarity_bonus
  ) * (cfg->'economy'->>'globalMultiplier')::numeric;

  return greatest(0, round(
    p_runs * (cfg->'economy'->>'referenceCoinsPerRun')::numeric
    * current_coins_per_run / 52.186
  )::integer);
end;
$$;

create or replace function public.balance_coin_cost(p_reference_cost numeric)
returns integer
language sql
immutable
set search_path = public
as $$
  select public.balance_coins_for_runs(p_reference_cost / 50.0);
$$;

create or replace function public.balance_score_for_runs(p_runs numeric)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  weight_total numeric;
  points_per_catch numeric;
  current_score_per_run numeric;
begin
  select sum((value->>'weight')::numeric) into weight_total
  from jsonb_each(cfg->'rarities');
  select sum(
    ((value->>'weight')::numeric / weight_total) * (value->>'points')::numeric
  ) into points_per_catch
  from jsonb_each(cfg->'rarities');
  current_score_per_run := points_per_catch
    * (cfg->'run'->>'economyCatches')::numeric
    * (cfg->'run'->>'referenceComboMultiplier')::numeric;
  return greatest(0, round(p_runs * 1500 * current_score_per_run / 1499.07625)::integer);
end;
$$;

create or replace function public.balance_xp_for_level(p_level integer)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  curve jsonb := cfg->'progression'->'xp'->'runsPerLevel';
  runs numeric;
begin
  if p_level >= (cfg->'progression'->>'maxLevel')::integer then return 0; end if;
  if p_level <= (curve->>'rampEnd')::numeric then
    runs := (curve->>'start')::numeric
      + (((curve->>'settled')::numeric - (curve->>'start')::numeric) * (p_level - 1))
        / ((curve->>'rampEnd')::numeric - 1);
  else
    runs := (curve->>'settled')::numeric
      + (((curve->>'max')::numeric - (curve->>'settled')::numeric)
        * (p_level - (curve->>'rampEnd')::numeric))
        / ((cfg->'progression'->>'maxLevel')::numeric - 1 - (curve->>'rampEnd')::numeric);
  end if;
  return public.balance_xp_for_runs(runs);
end;
$$;

create or replace function public.profile_level_from_xp(p_total_xp bigint)
returns table (level integer, xp integer)
language plpgsql
immutable
as $$
declare
  current_level integer := 1;
  remaining bigint := greatest(0, coalesce(p_total_xp, 0));
  required integer;
begin
  while current_level < 100 loop
    required := public.balance_xp_for_level(current_level);
    exit when remaining < required;
    remaining := remaining - required;
    current_level := current_level + 1;
  end loop;

  if current_level >= 100 then remaining := 0; end if;
  return query select current_level, remaining::integer;
end;
$$;

-- Die RPCs verwenden die abgeleiteten Werte statt eigener Zahlenkopien.
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
  current_coins integer;
  talent_cost integer;
  cost_index integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  max_rank := case p_talent_id
    when 'reach' then 5 when 'swiftness' then 5 when 'magnetism' then 4
    when 'endurance' then 4 when 'focus' then 4 when 'insight' then 5
    when 'fortune' then 5 else 0 end;
  if max_rank = 0 then raise exception 'Unbekanntes Talent'; end if;

  select data into current_data from public.profile_progress
  where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_rank := coalesce((current_data->'talents'->>p_talent_id)::integer, 0);
  current_coins := coalesce((current_data->>'coins')::integer, 0);
  if coalesce((current_data->>'version')::integer, 1) < 4 then
    current_coins := current_coins + coalesce((current_data->>'talentPoints')::integer, 0) * 10;
  end if;
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    current_coins := current_coins + greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20;
  end if;
  if current_rank >= max_rank then raise exception 'Talent bereits maximiert'; end if;

  cost_index := least(current_rank, jsonb_array_length(cfg->'economy'->'sinks'->'talentCosts') - 1);
  talent_cost := public.balance_coin_cost(
    ((cfg->'economy'->'sinks'->'talentCosts')->cost_index)::numeric
  );
  if current_coins < talent_cost then raise exception 'Nicht genug Coins'; end if;

  next_data := jsonb_set(current_data, array['talents', p_talent_id], to_jsonb(current_rank + 1), true);
  next_data := jsonb_set(next_data, '{coins}', to_jsonb(current_coins - talent_cost), true);
  next_data := jsonb_set(next_data, '{coinsSpent}', to_jsonb(coalesce((current_data->>'coinsSpent')::integer, 0) + talent_cost), true);
  next_data := jsonb_set(next_data, '{talentPoints}', '0'::jsonb, true);
  next_data := jsonb_set(next_data, '{version}', '8'::jsonb, true);
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
  current_coins integer;
  reset_cost integer := public.balance_coins_for_runs(
    (public.balance_config()->'economy'->'sinks'->>'talentResetRuns')::numeric
  );
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  select data into current_data from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;
  current_coins := coalesce((current_data->>'coins')::integer, 0);
  if current_coins < reset_cost then raise exception 'Nicht genug Coins fuer den Reset'; end if;

  next_data := jsonb_set(current_data, '{talents}', '{}'::jsonb, true);
  next_data := jsonb_set(next_data, '{coins}', to_jsonb(current_coins - reset_cost), true);
  next_data := jsonb_set(next_data, '{coinsSpent}', to_jsonb(coalesce((current_data->>'coinsSpent')::integer, 0) + reset_cost), true);
  next_data := jsonb_set(next_data, '{talentPoints}', '0'::jsonb, true);
  next_data := jsonb_set(next_data, '{version}', '8'::jsonb, true);
  update public.profile_progress set data = next_data, updated_at = now() where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

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
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not public.daily_key_is_plausible(p_daily_key) then raise exception 'Ungueltiger Tageslauf'; end if;
  safe_tier := least(
    (public.balance_config()->'economy'->'sources'->'daily'->>'scoreTierCount')::integer,
    floor(safe_score / public.balance_score_for_runs(1)::numeric)::integer
  );
  safe_bonus := public.balance_coins_for_runs(
    (public.balance_config()->'economy'->'sources'->'daily'->>'completionRuns')::numeric
      + safe_tier * (public.balance_config()->'economy'->'sources'->'daily'->>'scoreTierRuns')::numeric
  );
  safe_xp := public.balance_xp_for_runs(
    (public.balance_config()->'progression'->'xp'->>'dailyCompletionRuns')::numeric
      + safe_tier * (public.balance_config()->'progression'->'xp'->>'dailyScoreTierRuns')::numeric
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
  next_total_xp := current_total_xp + safe_xp;
  select level, xp into next_level, next_xp from public.profile_level_from_xp(next_total_xp);
  level_coins := public.balance_coins_for_runs(
    greatest(0, next_level - current_level)
      * (public.balance_config()->'economy'->'sources'->>'levelRewardRuns')::numeric
  );
  next_data := current_data || jsonb_build_object(
    'lastDailyKey', p_daily_key,
    'dailyBestScore', greatest(coalesce((current_data->>'dailyBestScore')::integer, 0), safe_score),
    'totalDailyRuns', coalesce((current_data->>'totalDailyRuns')::integer, 0) + 1,
    'level', next_level, 'xp', next_xp,
    'coins', coalesce((current_data->>'coins')::integer, 0) + safe_bonus + level_coins,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0) + safe_bonus + level_coins,
    'version', 8
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
    'version', 8
  );
  update public.profile_progress set data = next_data, updated_at = now()
  where profile_id = uid returning updated_at into current_updated_at;
  return jsonb_build_object('claimed', true, 'profile', jsonb_build_object(
    'data', next_data, 'total_xp', current_total_xp, 'updated_at', current_updated_at));
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
  safe_level integer := greatest(1, least(100, coalesce(p_level, 50)));
  safe_coins integer := greatest(0, coalesce(p_coins, 50000));
  target_total_xp bigint := 0;
  level_cursor integer := 1;
  current_data jsonb;
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

  while level_cursor < safe_level loop
    target_total_xp := target_total_xp + public.balance_xp_for_level(level_cursor);
    level_cursor := level_cursor + 1;
  end loop;

  current_data := current_data || jsonb_build_object(
    'level', safe_level, 'xp', 0, 'coins', safe_coins,
    'totalCoinsEarned', greatest(safe_coins, coalesce((current_data->>'totalCoinsEarned')::bigint, 0)),
    'version', 8
  );
  update public.profile_progress set data = current_data, total_xp = target_total_xp, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

-- Score-Plausibilitaet nutzt ebenfalls die zentralen Relikt- und Weltwerte.
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
  cfg jsonb := public.balance_config();
  item record;
  count_value integer;
  total_relics integer := 0;
  base_points numeric := 0;
  reward_multiplier numeric := coalesce((cfg->'worlds'->p_world_id->>'scoreMultiplier')::numeric, 0);
  combo_multiplier numeric := 1;
  tier jsonb;
begin
  if p_duration_ms < 60000 or p_duration_ms > 120000 or reward_multiplier = 0 then return 0; end if;
  for tier in select value from jsonb_array_elements(cfg->'score'->'comboTiers') loop
    if p_best_combo >= (tier->>'minCombo')::integer then combo_multiplier := (tier->>'multiplier')::numeric; end if;
  end loop;
  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary') then continue; end if;
    count_value := greatest(0, (item.value #>> '{}')::integer);
    total_relics := total_relics + count_value;
    base_points := base_points + count_value * (cfg->'rarities'->item.key->>'points')::numeric;
  end loop;
  if total_relics > ceil(p_duration_ms / 190.0)::integer then return 0; end if;
  if p_best_combo < 0 or p_best_combo > total_relics then return 0; end if;
  return least(10000000, ceil(base_points * combo_multiplier * 1.30 * reward_multiplier * 1.25 * 1.10)::integer);
end;
$$;

revoke execute on function public.balance_config() from public;
revoke execute on function public.balance_xp_for_runs(numeric) from public;
revoke execute on function public.balance_coins_for_runs(numeric) from public;
revoke execute on function public.balance_coin_cost(numeric) from public;
revoke execute on function public.balance_score_for_runs(numeric) from public;
revoke execute on function public.balance_xp_for_level(integer) from public;
grant execute on function public.balance_config() to authenticated;

commit;
notify pgrst, 'reload schema';
