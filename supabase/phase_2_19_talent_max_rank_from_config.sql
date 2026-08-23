-- ============================================================================
-- Maximalraenge aus der Balance-Kette statt aus einer abgetippten Liste
-- ============================================================================
--
-- `purchase_talent()` trug die Maximalraenge als `case`-Liste im Quelltext:
--
--     max_rank := case p_talent_id
--       when 'reach' then 5 when 'swiftness' then 5 ... end;
--
-- Dieselben Zahlen stehen laengst in `balance-data.json` unter
-- `talents.maxRanks` - und damit auch im JSON-Block dieser Migrationskette,
-- den `npm run balance:sync` dort eintraegt. Es gab also drei Kopien, von
-- denen eine von Hand gepflegt werden musste.
--
-- Sie stimmten alle ueberein (geprueft am 2026-08-23). Aber genau diese Form
-- - dieselbe Zahl an mehreren Stellen, eine davon handgepflegt - hat in
-- diesem Projekt schon zweimal zugeschlagen: bei der CI-Schrittliste und
-- beim Spielstand-Versionsmarker. Ein neues Talent oder ein geaenderter
-- Maximalrang haette hier still auseinanderlaufen koennen, mit der Wirkung,
-- dass der Laden einen Rang anbietet, den der Server verweigert.
--
-- `balance_config()` ist bereits die Quelle fuer Kosten und Level; die
-- Maximalraenge kommen jetzt aus derselben Stelle.
-- ============================================================================

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
  -- Aus der Balance-Kette statt aus einer abgetippten Liste. Ein unbekanntes
  -- Talent liefert NULL und faellt damit in dieselbe Ablehnung wie zuvor 0.
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
  -- Ueber den Anker statt als feste Zahl: Genau diese Doppelpflege hat den
  -- Versionsfehler erzeugt, den `phase_2_18` behebt.
  next_data := jsonb_set(next_data, '{version}', to_jsonb(public.save_version()), true);
  update public.profile_progress set data = next_data, updated_at = now() where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;
