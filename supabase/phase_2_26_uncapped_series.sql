-- Entfernt die kuenstliche Obergrenze des Serien-Multiplikators.
--
-- Die letzte konfigurierte Stufe bleibt der Startpunkt. Danach waechst der
-- Multiplikator mit derselben Formel wie im Client weiter, damit auch hohe
-- Serien bei der serverseitigen Score-Plausibilitaet akzeptiert werden.

begin;

-- Wiederholbar: Nach dem ersten Lauf existiert der Zielname bereits. Ein
-- blindes RENAME wuerde dann die gesamte Migration abbrechen.
do $$
begin
  if to_regprocedure('public.balance_config()') is not null
     and to_regprocedure('public.balance_config_score_capped()') is null then
    execute 'alter function public.balance_config() rename to balance_config_score_capped';
  end if;
end;
$$;

create or replace function public.balance_config()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_set(
    public.balance_config_score_capped(),
    '{score,comboMultiplierPerExtraSeries}',
    '0.25'::jsonb
  );
$$;

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
  extra_series_multiplier numeric := coalesce(
    (cfg->'score'->>'comboMultiplierPerExtraSeries')::numeric,
    0
  );
  last_tier_combo integer := 0;
  tier jsonb;
begin
  if p_duration_ms < 60000 or p_duration_ms > 120000 or reward_multiplier = 0 then return 0; end if;

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
  if p_best_combo < 0 or p_best_combo > total_relics then return 0; end if;
  return least(
    10000000::numeric,
    ceil(base_points * combo_multiplier * 1.30 * reward_multiplier * 1.25 * 1.10)
  )::integer;
end;
$$;

commit;
notify pgrst, 'reload schema';
