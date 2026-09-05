-- Phase 2.45: Namenskonflikt in `sync_profile_cosmetics` aufloesen.
--
-- AUDIT_2026-09-05, Befund 1 (P1, praktisch P0):
-- In phase_2_30 hiess sowohl die PL/pgSQL-Schleifenvariable als auch die
-- Ergebnisspalte von `jsonb_array_elements_text` `value`. PostgreSQL bricht
-- das mit `42702: column reference "value" is ambiguous` ab - und zwar bei
-- JEDEM Profil, denn schon der Startbestand `ownedShipShapes: ["arrow"]`
-- laeuft in die erste Besitzschleife. Der geraeteuebergreifende Abgleich von
-- Shopbesitz und Ausruestung war damit vollstaendig defekt.
--
-- Korrektur: Schleifenvariable heisst `cosmetic_id`, die Ergebnisspalte wird
-- als `element` benannt und explizit qualifiziert. Die Logik ist im Uebrigen
-- unveraendert - identische Preise, Grenzen und Rueckgabe wie phase_2_30.
--
-- Diese Migration ist wiederholbar.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 44
     ) then
    raise exception 'Phase 2.44 muss vor Phase 2.45 ausgefuehrt werden';
  end if;
end;
$$;

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
  applied_spend bigint := 0;
  item_cost bigint;
  -- Frueher `value` - kollidierte mit der Ergebnisspalte von
  -- `jsonb_array_elements_text` und machte die Funktion unaufrufbar.
  cosmetic_id text;
  next_shape text;
  next_color text;
  next_aura text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if coalesce(array_length(p_owned_ship_shapes, 1), 0) > 256
     or coalesce(array_length(p_owned_ship_colors, 1), 0) > 256
     or coalesce(array_length(p_owned_ship_auras, 1), 0) > 256 then
    raise exception 'Zu viele Kosmetik-Eintraege';
  end if;

  select data into current_data from public.profile_progress
  where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_coins := greatest(0, coalesce((current_data->>'coins')::bigint, 0));
  current_coins_spent := greatest(0, coalesce((current_data->>'coinsSpent')::bigint, 0));

  -- Bereits serverseitig bestaetigte Besitzrechte bleiben erhalten. Unbekannte
  -- oder clientseitig erfundene IDs werden nie in den Katalog uebernommen.
  if jsonb_typeof(current_data->'ownedShipShapes') = 'array' then
    for cosmetic_id in
      select element from jsonb_array_elements_text(current_data->'ownedShipShapes') as t(element)
    loop
      if exists (select 1 from public.cosmetic_catalog c
                 where c.category = 'shapes' and c.id = cosmetic_id)
         and array_length(merged_shapes, 1) < 256
         and not (cosmetic_id = any(merged_shapes)) then
        merged_shapes := array_append(merged_shapes, cosmetic_id);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipColors') = 'array' then
    for cosmetic_id in
      select element from jsonb_array_elements_text(current_data->'ownedShipColors') as t(element)
    loop
      if exists (select 1 from public.cosmetic_catalog c
                 where c.category = 'colors' and c.id = cosmetic_id)
         and array_length(merged_colors, 1) < 256
         and not (cosmetic_id = any(merged_colors)) then
        merged_colors := array_append(merged_colors, cosmetic_id);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipAuras') = 'array' then
    for cosmetic_id in
      select element from jsonb_array_elements_text(current_data->'ownedShipAuras') as t(element)
    loop
      if exists (select 1 from public.cosmetic_catalog c
                 where c.category = 'auras' and c.id = cosmetic_id)
         and array_length(merged_auras, 1) < 256
         and not (cosmetic_id = any(merged_auras)) then
        merged_auras := array_append(merged_auras, cosmetic_id);
      end if;
    end loop;
  end if;

  -- Neue IDs werden wie echte Kaeufe behandelt: Katalogpreis pruefen, Coins
  -- atomar abbuchen und nur bezahlte Eintraege uebernehmen. Der alte
  -- coinsSpent-Marker wird nicht mehr als Kaufbeleg akzeptiert.
  foreach cosmetic_id in array coalesce(p_owned_ship_shapes, '{}'::text[]) loop
    select c.cost into item_cost from public.cosmetic_catalog c
    where c.category = 'shapes' and c.id = cosmetic_id;
    if found and not (cosmetic_id = any(merged_shapes))
       and current_coins - applied_spend >= item_cost then
      merged_shapes := array_append(merged_shapes, cosmetic_id);
      applied_spend := applied_spend + item_cost;
    end if;
  end loop;
  foreach cosmetic_id in array coalesce(p_owned_ship_colors, '{}'::text[]) loop
    select c.cost into item_cost from public.cosmetic_catalog c
    where c.category = 'colors' and c.id = cosmetic_id;
    if found and not (cosmetic_id = any(merged_colors))
       and current_coins - applied_spend >= item_cost then
      merged_colors := array_append(merged_colors, cosmetic_id);
      applied_spend := applied_spend + item_cost;
    end if;
  end loop;
  foreach cosmetic_id in array coalesce(p_owned_ship_auras, '{}'::text[]) loop
    select c.cost into item_cost from public.cosmetic_catalog c
    where c.category = 'auras' and c.id = cosmetic_id;
    if found and not (cosmetic_id = any(merged_auras))
       and current_coins - applied_spend >= item_cost then
      merged_auras := array_append(merged_auras, cosmetic_id);
      applied_spend := applied_spend + item_cost;
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

update public.isihunt_schema_state
set schema_version = 45,
    migration_name = 'phase_2_45_fix_cosmetic_sync_ambiguity.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
