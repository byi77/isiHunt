-- Phase 2.30: Auth-/Shop-Haertung und harte Grenzen fuer oeffentliche RPCs.
--
-- Diese Migration ist wiederholbar. Die bestehenden RPC-Signaturen bleiben
-- kompatibel; neue Besitzrechte werden aber nur noch gegen den serverseitigen
-- Cosmetic-Katalog und vorhandene Coins akzeptiert.

begin;

-- ============================================================================
-- 1. Spielernamen-Oracle fuer anonyme Aufrufer schliessen
-- ============================================================================

revoke execute on function public.is_player_name_available(text, uuid) from anon;
grant execute on function public.is_player_name_available(text, uuid) to authenticated;

-- ============================================================================
-- 2. Server-Katalog fuer Kosmetik
-- ============================================================================

create table if not exists public.cosmetic_catalog (
  category text not null check (category in ('shapes', 'colors', 'auras')),
  id text not null,
  cost bigint not null check (cost >= 0 and cost <= 1000000),
  primary key (category, id)
);

alter table public.cosmetic_catalog enable row level security;
revoke all on public.cosmetic_catalog from anon, authenticated;

insert into public.cosmetic_catalog (category, id, cost)
select 'shapes', key, value::bigint
from jsonb_each_text(
  '{
    "arrow":0,"delta":300,"sickle":500,"ring":700,"twin":900,"star":1100,
    "crown":1300,"quadwing":1500,"podfighter":1700,"wedge":1900,"saucer":2100,
    "probe":2300,"funnel":2500,"glider":600,"jet":800,"prop":1000,"biplane":1200,
    "rocket":1400,"flyingwing":1600,"astronaut":1800,"hero":2000,"caped":2200,
    "winged":2400,"jetpack":2600,"swallow":900,"eagle":1000,"dragonfly":1300,
    "bat":1500,"quadcopter":1100,"hexacopter":1700,"heroine":2000,"masked":2100,
    "caped_heroine":2200,"titan":2300,"starlight":2600,"armored":2400,"bolt":2500,
    "shieldmaiden":2400,"archer":2300,"lancer":2200,"princess":1900,"fairy":2000,
    "sorceress":2400,"queen":2700,"wingfairy":2200,"nightfairy":2300,"mermaid":2100,
    "knight":2200,"dragon":2900,"unicorn":2800,"ghost":1800,"kraken":2000,
    "crescent":1400,"manta":1500,"spear":1300,"beetle":1400,"anchor":1600,
    "twindisc":1700,"comb":1500,"spiral":1900,"cube":1600,"claw":1800,"sail":1500,
    "torus":1700,"arrowhead":1400,"tower":1600,"crystal":2000,"pyramid":1500,
    "portal":2600,"deepkraken":2700,"seaplane":1200,"helicopter":1400,"hangglider":1000,
    "zeppelin":1300,"balloon":1100,"paperplane":800,"racecar":1500,"submarine":1600,
    "butterfly":1300,"owl":1400,"hummingbird":1500,"stork":1400,"ray":1300,
    "jellyfish":1200,"wasp":1600,"octocopter":2000,"tricopter":1300,"satellite":1700,
    "telescope":1500,"compass":1400,"key":1200,"gear":1300,"robot":1900,
    "snowflake":1800,"flame":1700,"droplet":1000,"heart":1200,"flower":1300,
    "hourglass":1500,"eye":1600,"cc0-scout":2200,"cc0-3d-ship-1":2400,
    "cc0-3d-ship-2":2450,"cc0-3d-ship-3":2500,"cc0-3d-ship-4":2550,
    "cc0-3d-ship-5":2600,"cc0-3d-ship-6":2650,"cc0-3d-ship-7":2700,
    "cc0-3d-ship-8":2750,"cc0-3d-ship-9":2800
  }'::jsonb
)
on conflict (category, id) do update set cost = excluded.cost;

insert into public.cosmetic_catalog (category, id, cost)
select 'colors', key, value::bigint
from jsonb_each_text(
  '{
    "world":0,"gold":200,"sand":200,"amber":200,"peach":250,"ember":300,
    "crimson":300,"rust":300,"ice":200,"steel":200,"azure":250,"teal":250,
    "mint":250,"deepsea":300,"midnight":400,"forest":250,"lime":250,"toxic":300,
    "violet":350,"orchid":350,"rose":350,"magenta":400,"ash":250,"snow":300,
    "onyx":500,"copper":600,"emerald":700,"sapphire":700,"ruby":700,"platinum":900
  }'::jsonb
)
on conflict (category, id) do update set cost = excluded.cost;

insert into public.cosmetic_catalog (category, id, cost)
select 'auras', key, value::bigint
from jsonb_each_text(
  '{
    "none":0,"prismasurge":25000,"wingbeat":4000,"heartbeat":4500,"tumble":5000,
    "spin":6000,"phantom":6500,"prism":7500,"starfire":9000,"singularity":10000
  }'::jsonb
)
on conflict (category, id) do update set cost = excluded.cost;

drop function if exists public.sync_profile_cosmetics(
  text[], text[], text[], text, text, text, bigint
);
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
  value text;
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
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipShapes') loop
      if exists (select 1 from public.cosmetic_catalog where category = 'shapes' and id = value)
         and array_length(merged_shapes, 1) < 256
         and not (value = any(merged_shapes)) then
        merged_shapes := array_append(merged_shapes, value);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipColors') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipColors') loop
      if exists (select 1 from public.cosmetic_catalog where category = 'colors' and id = value)
         and array_length(merged_colors, 1) < 256
         and not (value = any(merged_colors)) then
        merged_colors := array_append(merged_colors, value);
      end if;
    end loop;
  end if;
  if jsonb_typeof(current_data->'ownedShipAuras') = 'array' then
    for value in select value from jsonb_array_elements_text(current_data->'ownedShipAuras') loop
      if exists (select 1 from public.cosmetic_catalog where category = 'auras' and id = value)
         and array_length(merged_auras, 1) < 256
         and not (value = any(merged_auras)) then
        merged_auras := array_append(merged_auras, value);
      end if;
    end loop;
  end if;

  -- Neue IDs werden wie echte Kaeufe behandelt: Katalogpreis pruefen, Coins
  -- atomar abbuchen und nur bezahlte Eintraege uebernehmen. Der alte
  -- coinsSpent-Marker wird nicht mehr als Kaufbeleg akzeptiert.
  foreach value in array coalesce(p_owned_ship_shapes, '{}'::text[]) loop
    select cost into item_cost from public.cosmetic_catalog
    where category = 'shapes' and id = value;
    if found and not (value = any(merged_shapes))
       and current_coins - applied_spend >= item_cost then
      merged_shapes := array_append(merged_shapes, value);
      applied_spend := applied_spend + item_cost;
    end if;
  end loop;
  foreach value in array coalesce(p_owned_ship_colors, '{}'::text[]) loop
    select cost into item_cost from public.cosmetic_catalog
    where category = 'colors' and id = value;
    if found and not (value = any(merged_colors))
       and current_coins - applied_spend >= item_cost then
      merged_colors := array_append(merged_colors, value);
      applied_spend := applied_spend + item_cost;
    end if;
  end loop;
  foreach value in array coalesce(p_owned_ship_auras, '{}'::text[]) loop
    select cost into item_cost from public.cosmetic_catalog
    where category = 'auras' and id = value;
    if found and not (value = any(merged_auras))
       and current_coins - applied_spend >= item_cost then
      merged_auras := array_append(merged_auras, value);
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

-- ============================================================================
-- 3. Payload-Grenzen fuer Saves und Duell-Raeume
-- ============================================================================

create or replace function public.enforce_save_payload_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(new.data, '{}'::jsonb)) <> 'object' then
    raise exception 'Ungueltiges Save-Format';
  end if;
  if pg_column_size(coalesce(new.data, '{}'::jsonb)) > 65536 then
    raise exception 'Save zu gross';
  end if;
  if new.level < 1 or new.level > 100
     or new.best_score < 0 or new.best_score > 10000000
     or new.total_runs < 0 or new.total_runs > 100000000 then
    raise exception 'Save-Werte ausserhalb des Bereichs';
  end if;
  return new;
end;
$$;

drop trigger if exists save_payload_limits on public.saves;
create trigger save_payload_limits
before insert or update on public.saves
for each row execute function public.enforce_save_payload_limits();
revoke execute on function public.enforce_save_payload_limits() from public, anon, authenticated;

create or replace function public.enforce_duel_room_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.balance_config()->'worlds' ? new.world_id) then
    raise exception 'Ungueltige Welt';
  end if;
  if char_length(new.world_id) > 32 then
    raise exception 'Weltkennung zu lang';
  end if;
  if char_length(new.seed) > 128 then
    raise exception 'Seed zu lang';
  end if;
  if (select count(*) from public.duel_rooms where expires_at > now()) >= 10000 then
    raise exception 'Zu viele aktive Duelle';
  end if;
  return new;
end;
$$;

drop trigger if exists duel_room_limits on public.duel_rooms;
create trigger duel_room_limits
before insert or update on public.duel_rooms
for each row execute function public.enforce_duel_room_limits();
revoke execute on function public.enforce_duel_room_limits() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
