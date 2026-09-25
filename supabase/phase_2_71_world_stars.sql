-- Phase 2.71: Weltbeute, neue Weltfaktoren und drei Sterne je Welt.
--
-- Eine Messung vom 2026-09-25 (297 simulierte Runs, gleiche Bots, keine
-- Talente) ergab: Hoehere Welten zahlten WENIGER XP je Run als die Startwelt,
-- Horizonttor 66 bis 85 Prozent trotz +25 Prozent XP-Bonus. Die Welten
-- bekommen deshalb hoehere Faktoren und eine eigene Aufwertungschance
-- (`worlds.<id>.lootPromotion`, nur clientseitig beim Spawnen).
--
-- Neu sind die Sterne (`worldStars`): zwei Punkteschwellen und der
-- Weltauftrag je Welt, gebucht als Erfolge `star_<slug>_<1..3>`. Die
-- bisherige Erfolgspruefung kennt weder Welt noch Punkte noch Serie des Runs;
-- `submit_progress_event` ruft deshalb zusaetzlich
-- `progress_world_star_is_valid` auf. Die Schwellen liest sie aus
-- `balance_config()` - dieselben Zahlen wie der Client, per balance:check
-- abgeglichen.
--
-- Endlos-Runden (`submit_endless_round`) vergeben bewusst keine Sterne.

begin;

do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (70, 71)
  ) then
    raise exception 'Phase 2.70 muss vor Phase 2.71 ausgefuehrt werden';
  end if;
end;
$$;

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
        "points": 5,
        "xp": 2,
        "weight": 34
      },
      "common": {
        "points": 10,
        "xp": 3,
        "weight": 28
      },
      "uncommon": {
        "points": 25,
        "xp": 8,
        "weight": 20
      },
      "rare": {
        "points": 60,
        "xp": 20,
        "weight": 11
      },
      "epic": {
        "points": 150,
        "xp": 55,
        "weight": 5.5
      },
      "legendary": {
        "points": 400,
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
          "multiplier": 1.5
        },
        {
          "minCombo": 4,
          "multiplier": 2.2
        },
        {
          "minCombo": 7,
          "multiplier": 3.2
        },
        {
          "minCombo": 11,
          "multiplier": 4.5
        },
        {
          "minCombo": 16,
          "multiplier": 6
        }
      ],
      "comboMultiplierPerExtraSeries": 0.25,
      "seriesAgilityTiers": [
        {
          "minCombo": 5,
          "speedBonus": 0.04,
          "accelResponse": 15.5
        },
        {
          "minCombo": 10,
          "speedBonus": 0.08,
          "accelResponse": 17
        },
        {
          "minCombo": 20,
          "speedBonus": 0.12,
          "accelResponse": 19
        },
        {
          "minCombo": 35,
          "speedBonus": 0.15,
          "accelResponse": 21
        }
      ]
    },
    "runBonus": {
      "completion": {
        "scoreRuns": 0.5,
        "xpRuns": 0.25
      },
      "rarityTiers": {
        "rare": [
          {
            "minCount": 18,
            "scoreRuns": 0.24,
            "xpRuns": 0.12
          },
          {
            "minCount": 24,
            "scoreRuns": 0.4,
            "xpRuns": 0.2
          },
          {
            "minCount": 32,
            "scoreRuns": 0.64,
            "xpRuns": 0.32
          }
        ],
        "epic": [
          {
            "minCount": 9,
            "scoreRuns": 0.32,
            "xpRuns": 0.16
          },
          {
            "minCount": 13,
            "scoreRuns": 0.56,
            "xpRuns": 0.28
          },
          {
            "minCount": 18,
            "scoreRuns": 0.88,
            "xpRuns": 0.44
          }
        ],
        "legendary": [
          {
            "minCount": 3,
            "scoreRuns": 0.4,
            "xpRuns": 0.2
          },
          {
            "minCount": 5,
            "scoreRuns": 0.72,
            "xpRuns": 0.36
          },
          {
            "minCount": 8,
            "scoreRuns": 1.2,
            "xpRuns": 0.6
          }
        ]
      },
      "seriesTiers": [
        {
          "minCombo": 16,
          "scoreRuns": 0.32,
          "xpRuns": 0.12
        },
        {
          "minCombo": 25,
          "scoreRuns": 0.64,
          "xpRuns": 0.24
        },
        {
          "minCombo": 40,
          "scoreRuns": 1.12,
          "xpRuns": 0.4
        }
      ],
      "collectionTiers": [
        {
          "minCount": 150,
          "scoreRuns": 0.24,
          "xpRuns": 0.12
        },
        {
          "minCount": 190,
          "scoreRuns": 0.48,
          "xpRuns": 0.24
        },
        {
          "minCount": 230,
          "scoreRuns": 0.8,
          "xpRuns": 0.4
        }
      ],
      "maxScoreRuns": 5.2,
      "maxXpRuns": 2.3
    },
    "worlds": {
      "silberhain": {
        "scoreMultiplier": 1,
        "xpMultiplier": 1,
        "lootPromotion": 0
      },
      "frostzinne": {
        "scoreMultiplier": 1.25,
        "xpMultiplier": 1.18,
        "lootPromotion": 0.06
      },
      "glutmark": {
        "scoreMultiplier": 1.35,
        "xpMultiplier": 1.22,
        "lootPromotion": 0.08
      },
      "__LEERENBLÜTE__": {
        "scoreMultiplier": 1.4,
        "xpMultiplier": 1.25,
        "lootPromotion": 0.12
      },
      "sonnenhort": {
        "scoreMultiplier": 1.45,
        "xpMultiplier": 1.26,
        "lootPromotion": 0.02
      },
      "mondschmiede": {
        "scoreMultiplier": 1.65,
        "xpMultiplier": 1.4,
        "lootPromotion": 0.22
      },
      "kristallbruch": {
        "scoreMultiplier": 1.85,
        "xpMultiplier": 1.55,
        "lootPromotion": 0.25
      },
      "sturmgrenze": {
        "scoreMultiplier": 1.95,
        "xpMultiplier": 1.58,
        "lootPromotion": 0.28
      },
      "lichtkern": {
        "scoreMultiplier": 2.15,
        "xpMultiplier": 1.68,
        "lootPromotion": 0.14
      },
      "horizonttor": {
        "scoreMultiplier": 2.4,
        "xpMultiplier": 1.8,
        "lootPromotion": 0.38
      }
    },
    "worldStars": {
      "silberhain": {
        "slug": "sternenweide",
        "scores": [
          8000,
          16000
        ],
        "goal": {
          "metric": "collected",
          "target": 110
        },
        "rankOffset": 0
      },
      "frostzinne": {
        "slug": "eisring",
        "scores": [
          9000,
          18000
        ],
        "goal": {
          "metric": "combo",
          "target": 16
        },
        "rankOffset": 0
      },
      "glutmark": {
        "slug": "glutnebel",
        "scores": [
          10000,
          20000
        ],
        "goal": {
          "metric": "rarePlus",
          "target": 8
        },
        "rankOffset": 0
      },
      "__LEERENBLÜTE__": {
        "slug": "nullsektor",
        "scores": [
          10500,
          21000
        ],
        "goal": {
          "metric": "epicPlus",
          "target": 3
        },
        "rankOffset": 1
      },
      "sonnenhort": {
        "slug": "sonnenkrone",
        "scores": [
          11000,
          22000
        ],
        "goal": {
          "metric": "rarePlus",
          "target": 14
        },
        "rankOffset": 1
      },
      "mondschmiede": {
        "slug": "mondschmiede",
        "scores": [
          12000,
          23000
        ],
        "goal": {
          "metric": "combo",
          "target": 25
        },
        "rankOffset": 1
      },
      "kristallbruch": {
        "slug": "kristallbruch",
        "scores": [
          13000,
          26000
        ],
        "goal": {
          "metric": "collected",
          "target": 155
        },
        "rankOffset": 2
      },
      "sturmgrenze": {
        "slug": "sturmgrenze",
        "scores": [
          13500,
          27000
        ],
        "goal": {
          "metric": "epicPlus",
          "target": 5
        },
        "rankOffset": 2
      },
      "lichtkern": {
        "slug": "lichtkern",
        "scores": [
          14000,
          28000
        ],
        "goal": {
          "metric": "rarePlus",
          "target": 24
        },
        "rankOffset": 2
      },
      "horizonttor": {
        "slug": "horizonttor",
        "scores": [
          15000,
          30000
        ],
        "goal": {
          "metric": "score",
          "target": 40000
        },
        "rankOffset": 3
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
        "dailyScoreTierRuns": 0.1164,
        "botVictoryRuns": 1
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
        },
        "botVictoryRuns": 1
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
      "baseCritChance": 0.02,
      "luckCritChancePerRank": 0.02,
      "critMultiplier": 3,
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
        "shield": 3,
        "luck": 5
      }
    }
  }
  $json$::jsonb;
$$;

create or replace function public.progress_world_star_is_valid(
  p_id text,
  p_world_id text,
  p_score integer,
  p_best_combo integer,
  p_run_collected jsonb,
  p_run_total integer
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  star_def jsonb;
  prefix text;
  goal_value integer;
begin
  star_def := cfg->'worldStars'->p_world_id;
  if star_def is null or p_id is null then return false; end if;
  prefix := 'star_' || (star_def->>'slug') || '_';

  if p_id = prefix || '1' then
    return p_score >= (star_def->'scores'->>0)::integer;
  end if;
  if p_id = prefix || '2' then
    return p_score >= (star_def->'scores'->>1)::integer;
  end if;
  if p_id <> prefix || '3' then return false; end if;

  -- Der Client zaehlt beim Punkteauftrag ohne Abschlusspraemie; hier steht nur
  -- die Gesamtsumme zur Verfuegung. Die Pruefung ist damit hoechstens
  -- grosszuegiger als der Client, nie strenger.
  goal_value := case star_def->'goal'->>'metric'
    when 'collected' then p_run_total
    when 'rarePlus' then
      coalesce((p_run_collected->>'rare')::integer, 0)
        + coalesce((p_run_collected->>'epic')::integer, 0)
        + coalesce((p_run_collected->>'legendary')::integer, 0)
    when 'epicPlus' then
      coalesce((p_run_collected->>'epic')::integer, 0)
        + coalesce((p_run_collected->>'legendary')::integer, 0)
    when 'combo' then p_best_combo
    when 'score' then p_score
    else -1
  end;
  return goal_value >= (star_def->'goal'->>'target')::integer;
end;
$$;

revoke execute on function public.progress_world_star_is_valid(
  text, text, integer, integer, jsonb, integer
) from public;

create or replace function public.progress_achievement_rank(p_id text)
returns integer
language sql
immutable
as $$
  select case
    when p_id like 'star\_%' then coalesce((
      select right(p_id, 1)::integer + (star.value->>'rankOffset')::integer
      from jsonb_each(public.balance_config()->'worldStars') as star
      where p_id in (
        'star_' || (star.value->>'slug') || '_1',
        'star_' || (star.value->>'slug') || '_2',
        'star_' || (star.value->>'slug') || '_3'
      )
      limit 1
    ), 0)
    else case p_id
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
    end
  end;
$$;

revoke execute on function public.progress_achievement_rank(text) from public;

-- Unveraendert gegenueber Phase 2.56 bis auf die Sternpruefung im
-- Erfolgsblock.
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

  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    count_value := (item.value #>> '{}')::integer;
    safe_xp := safe_xp + round(
      count_value * (cfg->'rarities'->item.key->>'xp')::numeric
        * (1 + insight_bonus) * world_xp_multiplier
    )::integer;
  end loop;

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
    ) or public.progress_world_star_is_valid(
      achievement_id, p_world_id, safe_score, safe_best_combo, p_collected, total_collected
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
set schema_version = 71,
    migration_name = 'phase_2_71_world_stars.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
