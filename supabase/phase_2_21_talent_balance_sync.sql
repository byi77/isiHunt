-- Synchronisiert die produktive Balance-Kette mit dem aktuellen Clientstand.
--
-- Die vorherigen Balance-Dateien wurden manuell im SQL-Editor eingespielt und
-- sind deshalb nicht in der Remote-Migrationshistorie registriert. Diese
-- Korrektur bleibt als eigene Migration nachvollziehbar.

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
      "poor": { "points": 3, "xp": 2, "weight": 34 },
      "common": { "points": 5, "xp": 3, "weight": 28 },
      "uncommon": { "points": 10, "xp": 8, "weight": 20 },
      "rare": { "points": 25, "xp": 20, "weight": 11 },
      "epic": { "points": 75, "xp": 55, "weight": 5.5 },
      "legendary": { "points": 250, "xp": 130, "weight": 1.5 }
    },
    "score": {
      "seriesRaisingMinRarityIndex": 2,
      "comboTiers": [
        { "minCombo": 0, "multiplier": 1 },
        { "minCombo": 2, "multiplier": 1.2 },
        { "minCombo": 4, "multiplier": 1.5 },
        { "minCombo": 7, "multiplier": 1.9 },
        { "minCombo": 11, "multiplier": 2.4 },
        { "minCombo": 16, "multiplier": 3.2 }
      ]
    },
    "worlds": {
      "silberhain": { "scoreMultiplier": 1, "xpMultiplier": 1 },
      "frostzinne": { "scoreMultiplier": 1.04, "xpMultiplier": 1.02 },
      "glutmark": { "scoreMultiplier": 1.08, "xpMultiplier": 1.04 },
      "__LEERENBLÜTE__": { "scoreMultiplier": 1.12, "xpMultiplier": 1.06 },
      "sonnenhort": { "scoreMultiplier": 1.16, "xpMultiplier": 1.08 },
      "mondschmiede": { "scoreMultiplier": 1.2, "xpMultiplier": 1.11 },
      "kristallbruch": { "scoreMultiplier": 1.26, "xpMultiplier": 1.15 },
      "sturmgrenze": { "scoreMultiplier": 1.33, "xpMultiplier": 1.19 },
      "lichtkern": { "scoreMultiplier": 1.39, "xpMultiplier": 1.22 },
      "horizonttor": { "scoreMultiplier": 1.45, "xpMultiplier": 1.25 }
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
        "talentCosts": [250, 350, 500, 650, 850],
        "talentResetRuns": 2,
        "shopPriceScale": true
      }
    },
    "talents": {
      "reachRadiusPerRank": 8,
      "swiftnessSpeedPerRank": 0.05,
      "magnetRadiusPerRank": 65,
      "magnetPullSpeedPerRank": 0.2,
      "enduranceSecondsPerRank": 4,
      "focusComboMsPerRank": 150,
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

-- Der Versionsanker fehlte in der produktiven Datenbank noch. Die Kauf-RPC
-- verwendet ihn, damit der Spielstand beim Kauf auf Version 8 steht.
create or replace function public.save_version()
returns integer
language sql
immutable
as $$ select 8 $$;

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
  max_rank := (cfg->'talents'->'maxRanks'->>p_talent_id)::integer;
  if max_rank is null or max_rank = 0 then raise exception 'Unbekanntes Talent'; end if;

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
  next_data := jsonb_set(next_data, '{version}', to_jsonb(public.save_version()), true);
  update public.profile_progress set data = next_data, updated_at = now() where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

commit;
notify pgrst, 'reload schema';
