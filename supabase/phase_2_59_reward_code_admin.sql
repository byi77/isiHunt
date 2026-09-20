-- Phase 2.59: Interne Adminfunktionen fuer Kampagnen und Code-Pruefwerte.
-- Der Edge-Handler erzeugt Klartextcodes und uebergibt nur HMAC-Pruefwerte.

begin;

do $$
begin
  if not exists (select 1 from public.isihunt_schema_state where singleton = true and schema_version in (58, 59)) then
    raise exception 'Phase 2.58 muss vor Phase 2.59 ausgefuehrt werden';
  end if;
end;
$$;

create or replace function public.reward_require_admin(p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.reward_require_service();
  if p_actor is null or not exists (select 1 from public.profiles where id = p_actor and is_admin) then
    raise exception 'Adminberechtigung erforderlich';
  end if;
end;
$$;

create or replace function public.admin_create_reward_campaign_internal(
  p_actor uuid, p_name text, p_description text, p_package jsonb,
  p_starts_at timestamptz, p_ends_at timestamptz, p_global_limit integer,
  p_account_limit integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare campaign_id uuid; package_version integer;
begin
  perform public.reward_require_admin(p_actor);
  if not public.reward_package_is_valid(p_package) then raise exception 'Ungueltiges Belohnungspaket'; end if;
  package_version := (p_package->>'version')::integer;
  insert into public.reward_campaigns(name, description, package, package_version, starts_at, ends_at, global_limit, account_limit, created_by)
  values(trim(p_name), coalesce(p_description, ''), p_package, package_version, p_starts_at, p_ends_at, p_global_limit, p_account_limit, p_actor)
  returning id into campaign_id;
  insert into public.reward_admin_audit(actor_profile_id, action, campaign_id, details)
  values(p_actor, 'campaign_created', campaign_id, jsonb_build_object('packageVersion', package_version));
  return campaign_id;
end;
$$;

create or replace function public.admin_set_reward_campaign_status_internal(
  p_actor uuid, p_campaign_id uuid, p_status text
)
returns void language plpgsql security definer set search_path = public as $$
declare previous_status text;
begin
  perform public.reward_require_admin(p_actor);
  if p_status not in ('active', 'disabled') then raise exception 'Ungueltiger Kampagnenstatus'; end if;
  select status into previous_status from public.reward_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Kampagne nicht gefunden'; end if;
  if p_status = 'active' and not public.reward_package_is_valid((select package from public.reward_campaigns where id = p_campaign_id)) then
    raise exception 'Kampagnenpaket nicht freigabefaehig';
  end if;
  update public.reward_campaigns set status = p_status, updated_at = now() where id = p_campaign_id;
  insert into public.reward_admin_audit(actor_profile_id, action, campaign_id, details)
  values(p_actor, case when p_status = 'active' then 'campaign_activated' else 'campaign_disabled' end, p_campaign_id,
    jsonb_build_object('previousStatus', previous_status));
end;
$$;

create or replace function public.admin_create_reward_codes_internal(
  p_actor uuid, p_campaign_id uuid, p_codes jsonb, p_bound_profile_id uuid default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare item jsonb; inserted_count integer := 0;
begin
  perform public.reward_require_admin(p_actor);
  if jsonb_typeof(p_codes) <> 'array' or jsonb_array_length(p_codes) not between 1 and 1000 then
    raise exception 'Ungueltige Codeliste';
  end if;
  if not exists (select 1 from public.reward_campaigns where id = p_campaign_id) then raise exception 'Kampagne nicht gefunden'; end if;
  if p_bound_profile_id is not null and not exists (select 1 from public.profiles where id = p_bound_profile_id) then
    raise exception 'Gebundenes Profil nicht gefunden';
  end if;
  for item in select value from jsonb_array_elements(p_codes) loop
    if coalesce(item->>'digest', '') !~ '^[0-9a-f]{64}$' or coalesce(item->>'suffix', '') !~ '^[0-9]{4}$'
       or coalesce((item->>'keyVersion')::integer, 0) < 1 then
      raise exception 'Ungueltiger Codepruefwert';
    end if;
    insert into public.reward_codes(campaign_id, code_digest, key_version, suffix, bound_profile_id)
    values(p_campaign_id, item->>'digest', (item->>'keyVersion')::integer, item->>'suffix', p_bound_profile_id);
    inserted_count := inserted_count + 1;
  end loop;
  insert into public.reward_admin_audit(actor_profile_id, action, campaign_id, details)
  values(p_actor, 'codes_generated', p_campaign_id, jsonb_build_object('count', inserted_count, 'bound', p_bound_profile_id is not null));
  return inserted_count;
end;
$$;

revoke all on function public.reward_require_admin(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_reward_campaign_internal(uuid, text, text, jsonb, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_set_reward_campaign_status_internal(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_create_reward_codes_internal(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.admin_create_reward_campaign_internal(uuid, text, text, jsonb, timestamptz, timestamptz, integer, integer) to service_role;
grant execute on function public.admin_set_reward_campaign_status_internal(uuid, uuid, text) to service_role;
grant execute on function public.admin_create_reward_codes_internal(uuid, uuid, jsonb, uuid) to service_role;

update public.isihunt_schema_state set schema_version = 59,
  migration_name = 'phase_2_59_reward_code_admin.sql', applied_at = now() where singleton = true;

commit;
notify pgrst, 'reload schema';
