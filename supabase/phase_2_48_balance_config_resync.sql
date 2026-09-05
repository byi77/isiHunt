-- Phase 2.48: `balance_config()` auf den Stand von `balance-data.json` ziehen.
--
-- Beim Einspielen der Migrationen 2.45-2.47 am 2026-09-05 fiel auf, dass die
-- live laufende `balance_config()` den Schluessel `botVictoryRuns` nicht
-- kannte - weder unter `economy.sources` noch unter `progression.xp`. Die
-- neue Funktion `claim_bot_victory_bonus` (Phase 2.47) las dort `null` und
-- schrieb daraufhin einen Bonus von 0 gut.
--
-- Ursache: `phase_2_14_balance_chain.sql` **enthaelt** die Werte (der
-- `balance:sync`-Lauf hat sie dort eingetragen), die Datei wurde nach dieser
-- Ergaenzung aber nie erneut gegen die Datenbank gefahren. `npm run
-- balance:check` vergleicht `balance-data.json` mit dem JSON-Block in der
-- Datei - nicht mit dem, was tatsaechlich in der Datenbank steht. Diese
-- Luecke bleibt bestehen; sie ist in docs/AUDIT_2026-09-05.md vermerkt.
--
-- Warum eine eigene Migration und nicht einfach `phase_2_14` erneut fahren:
-- Jene Datei definiert auch `claim_daily_bonus` und `claim_daily_login_bonus`,
-- die spaeter in `phase_2_28`/`phase_2_29` gehaertet wurden. Ein erneuter
-- Komplettlauf haette diese Haertungen zurueckgedreht.
--
-- Der Funktionsrumpf unten ist eine woertliche Kopie aus `phase_2_14`. Wird
-- die Balance erneut geaendert, erzeugt `npm run balance:sync` den neuen
-- Block dort - diese Datei muss dann mitgezogen werden.
--
-- Diese Migration ist wiederholbar und aendert den Schemastand nicht: sie
-- korrigiert Daten, nicht die Struktur.

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
      "comboMultiplierPerExtraSeries": 0.25
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

commit;
notify pgrst, 'reload schema';
