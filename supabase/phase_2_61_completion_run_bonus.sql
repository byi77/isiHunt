-- Phase 2.57: Run-Abschlussboni gemaess dem Phase-4-Balancebeschluss erhoehen.
-- Phase 2.61: Garantierter Abschlussbonus fuer jeden echten Solo-Run.
--
-- Die fuenf leistungsabhaengigen Abschlussboni bleiben erhalten. Zusaetzlich
-- wird die zentrale Balance um den sichtbaren Posten `completion` erweitert.

begin;

do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (60, 61)
  ) then
    raise exception 'Phase 2.60 muss vor Phase 2.61 ausgefuehrt werden';
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
            "scoreRuns": 0.12,
            "xpRuns": 0.06
          },
          {
            "minCount": 24,
            "scoreRuns": 0.2,
            "xpRuns": 0.1
          },
          {
            "minCount": 32,
            "scoreRuns": 0.32,
            "xpRuns": 0.16
          }
        ],
        "epic": [
          {
            "minCount": 9,
            "scoreRuns": 0.16,
            "xpRuns": 0.08
          },
          {
            "minCount": 13,
            "scoreRuns": 0.28,
            "xpRuns": 0.14
          },
          {
            "minCount": 18,
            "scoreRuns": 0.44,
            "xpRuns": 0.22
          }
        ],
        "legendary": [
          {
            "minCount": 3,
            "scoreRuns": 0.2,
            "xpRuns": 0.1
          },
          {
            "minCount": 5,
            "scoreRuns": 0.36,
            "xpRuns": 0.18
          },
          {
            "minCount": 8,
            "scoreRuns": 0.6,
            "xpRuns": 0.3
          }
        ]
      },
      "seriesTiers": [
        {
          "minCombo": 16,
          "scoreRuns": 0.16,
          "xpRuns": 0.06
        },
        {
          "minCombo": 25,
          "scoreRuns": 0.32,
          "xpRuns": 0.12
        },
        {
          "minCombo": 40,
          "scoreRuns": 0.56,
          "xpRuns": 0.2
        }
      ],
      "collectionTiers": [
        {
          "minCount": 150,
          "scoreRuns": 0.12,
          "xpRuns": 0.06
        },
        {
          "minCount": 190,
          "scoreRuns": 0.24,
          "xpRuns": 0.12
        },
        {
          "minCount": 230,
          "scoreRuns": 0.4,
          "xpRuns": 0.2
        }
      ],
      "maxScoreRuns": 2.2,
      "maxXpRuns": 1
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

-- Die bestehende Funktion bleibt die einzige serverseitige Rechenquelle.
-- Der feste Abschlussanteil wird erst nach dem validierten Relikt-Total
-- addiert; ein leerer oder manipuliert leer gemeldeter Lauf erhaelt nichts.
create or replace function public.run_bonus(
  p_best_combo integer,
  p_collected jsonb
)
returns table (bonus_score integer, bonus_xp integer)
language plpgsql
immutable
set search_path = public
as $$
declare
  cfg jsonb := public.balance_config();
  bonus_cfg jsonb := cfg->'runBonus';
  rarity_id text;
  tier jsonb;
  count_value integer;
  total_collected integer := 0;
  best_score_runs numeric;
  best_xp_runs numeric;
  sum_score_runs numeric := 0;
  sum_xp_runs numeric := 0;
  combo integer := greatest(0, coalesce(p_best_combo, 0));
begin
  if bonus_cfg is null then
    bonus_score := 0;
    bonus_xp := 0;
    return next;
    return;
  end if;

  for rarity_id in select jsonb_object_keys(bonus_cfg->'rarityTiers') loop
    count_value := greatest(0, coalesce((p_collected->>rarity_id)::integer, 0));
    best_score_runs := 0;
    best_xp_runs := 0;
    for tier in select value from jsonb_array_elements(bonus_cfg->'rarityTiers'->rarity_id) loop
      if count_value >= (tier->>'minCount')::integer then
        best_score_runs := (tier->>'scoreRuns')::numeric;
        best_xp_runs := (tier->>'xpRuns')::numeric;
      end if;
    end loop;
    sum_score_runs := sum_score_runs + best_score_runs;
    sum_xp_runs := sum_xp_runs + best_xp_runs;
  end loop;

  best_score_runs := 0;
  best_xp_runs := 0;
  for tier in select value from jsonb_array_elements(bonus_cfg->'seriesTiers') loop
    if combo >= (tier->>'minCombo')::integer then
      best_score_runs := (tier->>'scoreRuns')::numeric;
      best_xp_runs := (tier->>'xpRuns')::numeric;
    end if;
  end loop;
  sum_score_runs := sum_score_runs + best_score_runs;
  sum_xp_runs := sum_xp_runs + best_xp_runs;

  for rarity_id in select jsonb_object_keys(coalesce(p_collected, '{}'::jsonb)) loop
    if rarity_id not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary') then continue; end if;
    total_collected := total_collected
      + greatest(0, coalesce((p_collected->>rarity_id)::integer, 0));
  end loop;

  if total_collected > 0 then
    sum_score_runs := sum_score_runs + (bonus_cfg->'completion'->>'scoreRuns')::numeric;
    sum_xp_runs := sum_xp_runs + (bonus_cfg->'completion'->>'xpRuns')::numeric;
  end if;

  best_score_runs := 0;
  best_xp_runs := 0;
  for tier in select value from jsonb_array_elements(bonus_cfg->'collectionTiers') loop
    if total_collected >= (tier->>'minCount')::integer then
      best_score_runs := (tier->>'scoreRuns')::numeric;
      best_xp_runs := (tier->>'xpRuns')::numeric;
    end if;
  end loop;
  sum_score_runs := sum_score_runs + best_score_runs;
  sum_xp_runs := sum_xp_runs + best_xp_runs;

  bonus_score := public.balance_score_for_runs(
    least(sum_score_runs, (bonus_cfg->>'maxScoreRuns')::numeric)
  );
  bonus_xp := public.balance_xp_for_runs(
    least(sum_xp_runs, (bonus_cfg->>'maxXpRuns')::numeric)
  );
  return next;
end;
$$;

revoke execute on function public.run_bonus(integer, jsonb) from public, anon;

update public.isihunt_schema_state
set schema_version = 61,
    migration_name = 'phase_2_61_completion_run_bonus.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';


