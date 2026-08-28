-- Synchronisiert lokale Shop-Ausgaben atomar mit dem Kosmetik-Sync.
--
-- Der alte RPC vereinigte nur Besitzlisten. Ein Kauf wurde zuerst lokal
-- abgebucht, aber der anschliessende Serverstand enthielt noch die alten
-- Coins. Beim Rueckuebernehmen dieses Stands wurde der Kauf sichtbar
-- rueckgaengig gemacht - besonders auffaellig bei Admin-Boosts auf 50000.
-- `coinsSpent` ist ein monotoner Marker: Der Server verbucht nur den
-- zusaetzlichen Betrag seit seinem letzten Stand und kann dadurch keine
-- Coins aus einer Client-Nutzlast gutgeschrieben bekommen.

begin;

create or replace function public.sync_profile_cosmetics(
  p_owned_ship_shapes text[],
  p_owned_ship_colors text[],
  p_owned_ship_auras text[],
  p_ship_shape text,
  p_ship_color text,
  p_ship_aura text,
  p_coins_spent bigint
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
  current_coins bigint;
  current_coins_spent bigint;
  requested_coins_spent bigint := greatest(0, coalesce(p_coins_spent, 0));
  additional_spend bigint;
  applied_spend bigint;
  value text;
  next_shape text;
  next_color text;
  next_aura text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select data into current_data from public.profile_progress
  where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_coins := greatest(0, coalesce((current_data->>'coins')::bigint, 0));
  current_coins_spent := greatest(0, coalesce((current_data->>'coinsSpent')::bigint, 0));
  additional_spend := greatest(0, requested_coins_spent - current_coins_spent);
  applied_spend := least(additional_spend, current_coins);

  if jsonb_typeof(current_data->'ownedShipShapes') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipShapes') loop
      if value <> '' and array_length(merged_shapes, 1) < 256
        and not (value = any(merged_shapes)) then
        merged_shapes := array_append(merged_shapes, value);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipColors') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipColors') loop
      if value <> '' and array_length(merged_colors, 1) < 256
        and not (value = any(merged_colors)) then
        merged_colors := array_append(merged_colors, value);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipAuras') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipAuras') loop
      if value <> '' and array_length(merged_auras, 1) < 256
        and not (value = any(merged_auras)) then
        merged_auras := array_append(merged_auras, value);
      end if;
    end loop;
  end if;

  foreach value in array coalesce(p_owned_ship_shapes, '{}'::text[]) loop
    if value <> '' and array_length(merged_shapes, 1) < 256
      and not (value = any(merged_shapes)) then
      merged_shapes := array_append(merged_shapes, value);
    end if;
  end loop;
  foreach value in array coalesce(p_owned_ship_colors, '{}'::text[]) loop
    if value <> '' and array_length(merged_colors, 1) < 256
      and not (value = any(merged_colors)) then
      merged_colors := array_append(merged_colors, value);
    end if;
  end loop;
  foreach value in array coalesce(p_owned_ship_auras, '{}'::text[]) loop
    if value <> '' and array_length(merged_auras, 1) < 256
      and not (value = any(merged_auras)) then
      merged_auras := array_append(merged_auras, value);
    end if;
  end loop;

  next_shape := case when p_ship_shape = any(merged_shapes) then p_ship_shape
    else coalesce(current_data->>'shipShape', 'arrow') end;
  next_color := case when p_ship_color = any(merged_colors) then p_ship_color
    else coalesce(current_data->>'shipColor', 'world') end;
  next_aura := case when p_ship_aura = any(merged_auras) then p_ship_aura
    else coalesce(current_data->>'shipAura', 'none') end;
  if not (next_shape = any(merged_shapes)) then next_shape := 'arrow'; end if;
  if not (next_color = any(merged_colors)) then next_color := 'world'; end if;
  if not (next_aura = any(merged_auras)) then next_aura := 'none'; end if;

  current_data := current_data || jsonb_build_object(
    'ownedShipShapes', to_jsonb(merged_shapes),
    'ownedShipColors', to_jsonb(merged_colors),
    'ownedShipAuras', to_jsonb(merged_auras),
    'shipShape', next_shape,
    'shipColor', next_color,
    'shipAura', next_aura,
    'coins', current_coins - applied_spend,
    'coinsSpent', current_coins_spent + applied_spend,
    'version', public.save_version()
  );
  update public.profile_progress set data = current_data, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.sync_profile_cosmetics(
  text[], text[], text[], text, text, text, bigint
) from public;
grant execute on function public.sync_profile_cosmetics(
  text[], text[], text[], text, text, text, bigint
) to authenticated;

commit;
notify pgrst, 'reload schema';
