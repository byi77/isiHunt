-- Phase 2.63: Feste Admin-Vorlagen fuer Gameplay-Effekte und Shop-God-Modus.
-- Die Effekte sind kein Save-Patch: Typ, Faktor und Anwendungen sind eng begrenzt.

begin;

do $$
begin
  if not exists (select 1 from public.isihunt_schema_state where singleton = true and schema_version in (62, 63)) then
    raise exception 'Phase 2.62 muss vor Phase 2.63 ausgefuehrt werden';
  end if;
end;
$$;

alter table public.reward_grants drop constraint if exists reward_grants_grant_type_check;
alter table public.reward_grants add constraint reward_grants_grant_type_check
  check (grant_type in ('coins', 'cosmetic_grant', 'minimum_level', 'xp_run_boost', 'run_effect_boost', 'shop_god_mode'));
alter table public.profile_boosts drop constraint if exists profile_boosts_factor_check;
alter table public.profile_boosts add constraint profile_boosts_factor_check
  check (factor in (1.25, 1.30, 1.50, 2.00));

create table if not exists public.profile_run_effect_boosts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  redemption_id uuid not null references public.reward_redemptions(id) on delete restrict,
  effect text not null check (effect in ('speed', 'magnetism', 'combo_grace')),
  factor numeric(4,2) not null check (factor = 1.30),
  remaining_applications integer not null check (remaining_applications between 0 and 10),
  status text not null default 'active' check (status in ('active', 'exhausted', 'disabled')),
  created_at timestamptz not null default now()
);
create index if not exists profile_run_effect_boosts_active_idx
  on public.profile_run_effect_boosts(profile_id, effect, status, created_at);
alter table public.profile_run_effect_boosts enable row level security;
revoke all on public.profile_run_effect_boosts from anon, authenticated;
grant select on public.profile_run_effect_boosts to authenticated;
create policy "Eigene Lauf-Effektboni lesen" on public.profile_run_effect_boosts
  for select to authenticated using (profile_id = auth.uid());

create or replace function public.reward_package_is_valid(p_package jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare grant_item jsonb; grant_type text;
begin
  if jsonb_typeof(p_package) <> 'object' or coalesce((p_package->>'version')::integer, 0) < 1
     or jsonb_typeof(p_package->'grants') <> 'array' or jsonb_array_length(p_package->'grants') not between 1 and 8 then return false; end if;
  for grant_item in select value from jsonb_array_elements(p_package->'grants') loop
    grant_type := grant_item->>'type';
    if grant_type = 'coins' then
      if coalesce((grant_item->>'amount')::integer, 0) not between 1 and 100000 then return false; end if;
    elsif grant_type = 'minimum_level' then
      if coalesce((grant_item->>'level')::integer, 0) not between 1 and 100 then return false; end if;
    elsif grant_type = 'xp_run_boost' then
      if coalesce((grant_item->>'factor')::numeric, 0) not in (1.25, 1.30, 1.50, 2.00) or coalesce((grant_item->>'applications')::integer, 0) not between 1 and 10 then return false; end if;
    elsif grant_type = 'run_effect_boost' then
      if grant_item->>'effect' not in ('speed', 'magnetism', 'combo_grace') or coalesce((grant_item->>'factor')::numeric, 0) <> 1.30 or coalesce((grant_item->>'applications')::integer, 0) not between 1 and 10 then return false; end if;
    elsif grant_type = 'shop_god_mode' then
      if jsonb_object_length(grant_item) <> 1 then return false; end if;
    elsif grant_type = 'cosmetic_grant' then
      if not exists (select 1 from public.reward_catalog_cosmetics c where c.cosmetic_type = grant_item->>'cosmeticType' and c.cosmetic_id = grant_item->>'cosmeticId' and c.active) then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Die bestehende atomare Einloesung legt den Beleg zuerst an. Dieser Trigger
-- verarbeitet nur die neuen, fest typisierten Grants innerhalb derselben Transaktion.
create or replace function public.apply_special_reward_grants()
returns trigger language plpgsql security definer set search_path = public as $$
declare grant_item jsonb; key_name text; catalog_items jsonb;
begin
  for grant_item in select value from jsonb_array_elements(new.grants) loop
    if grant_item->>'type' = 'run_effect_boost' then
      insert into public.profile_run_effect_boosts(profile_id, redemption_id, effect, factor, remaining_applications)
      values (new.profile_id, new.id, grant_item->>'effect', (grant_item->>'factor')::numeric, (grant_item->>'applications')::integer);
    elsif grant_item->>'type' = 'shop_god_mode' then
      for key_name in select unnest(array['ship_shape', 'ship_color', 'ship_aura']) loop
        select coalesce(jsonb_agg(cosmetic_id order by cosmetic_id), '[]'::jsonb) into catalog_items
        from public.reward_catalog_cosmetics where cosmetic_type = key_name and active;
        update public.profile_progress set data = jsonb_set(
          data,
          array[case key_name when 'ship_shape' then 'ownedShipShapes' when 'ship_color' then 'ownedShipColors' else 'ownedShipAuras' end],
          catalog_items, true
        ), updated_at = now() where profile_id = new.profile_id;
      end loop;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists reward_redemptions_apply_special_grants on public.reward_redemptions;
create trigger reward_redemptions_apply_special_grants after insert on public.reward_redemptions
  for each row execute function public.apply_special_reward_grants();

revoke all on function public.apply_special_reward_grants() from public, anon, authenticated;
update public.isihunt_schema_state set schema_version = 63,
  migration_name = 'phase_2_63_reward_code_preset_grants.sql', applied_at = now() where singleton = true;
commit;
notify pgrst, 'reload schema';
