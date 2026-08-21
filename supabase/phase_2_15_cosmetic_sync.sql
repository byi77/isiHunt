-- Mehrgeraete-Sync fuer Besitz und Ausruestung der drei Kosmetiktypen.
-- Besitz wird vereinigt, nie ersetzt; die getragene Auswahl ist last-write-wins.

begin;

create or replace function public.sync_profile_cosmetics(
  p_owned_ship_shapes text[],
  p_owned_ship_colors text[],
  p_owned_ship_auras text[],
  p_ship_shape text,
  p_ship_color text,
  p_ship_aura text
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
  value text;
  next_shape text;
  next_color text;
  next_aura text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select data into current_data from public.profile_progress
  where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

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
    'version', 8
  );
  update public.profile_progress set data = current_data, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.sync_profile_cosmetics(text[], text[], text[], text, text, text)
  from public;
grant execute on function public.sync_profile_cosmetics(text[], text[], text[], text, text, text)
  to authenticated;

-- Der Wartungs-Reset setzt auch Auren, Ausruestung und lokale Kaufhinweise zurueck.
create or replace function public.admin_reset_user(p_alias text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  target_id uuid;
  safe_alias text := lower(trim(coalesce(p_alias, '')));
  current_data jsonb;
  reset_data jsonb;
begin
  if admin_id is null or not exists (
    select 1 from public.profiles where id = admin_id and is_admin
  ) then raise exception 'Wartungsrechte erforderlich'; end if;
  select id into target_id from public.profiles
  where alias_normalized = safe_alias
     or lower(trim(coalesce(alias, ''))) = safe_alias limit 1;
  if target_id is null then raise exception 'Profil nicht gefunden'; end if;
  select data into current_data from public.profile_progress
  where profile_id = target_id for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  delete from public.scores where player_id = target_id;
  delete from public.profile_progress_events where profile_id = target_id;
  reset_data := current_data || jsonb_build_object(
    'level', 1, 'xp', 0, 'talentPoints', 0, 'coins', 0,
    'talents', '{}'::jsonb, 'bestScore', 0, 'bestScoreRecordedAt', null,
    'bestCombo', 0, 'totalScore', 0, 'totalRuns', 0, 'totalPlayTimeMs', 0,
    'totalCoinsEarned', 0, 'coinsSpent', 0, 'lastLoginBonusKey', null,
    'lastDailyKey', null, 'dailyBestScore', 0, 'totalDailyRuns', 0,
    'pendingDailyKey', null, 'pendingDailyEventId', null,
    'pendingDailyCoins', 0, 'pendingDailyScore', 0,
    'collected', jsonb_build_object(
      'poor', 0, 'common', 0, 'uncommon', 0, 'rare', 0, 'epic', 0, 'legendary', 0
    ),
    'unlockedAchievements', '[]'::jsonb,
    'ownedShipShapes', '["arrow"]'::jsonb,
    'ownedShipColors', '["world"]'::jsonb,
    'ownedShipAuras', '["none"]'::jsonb,
    'shipShape', '"arrow"', 'shipColor', '"world"', 'shipAura', '"none"',
    'newCosmeticIds', '[]'::jsonb, 'lastPurchasedCosmetic', null, 'version', 8
  );
  update public.profile_progress set data = reset_data, total_xp = 0, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

revoke execute on function public.admin_reset_user(text) from public;
grant execute on function public.admin_reset_user(text) to authenticated;

commit;
notify pgrst, 'reload schema';
