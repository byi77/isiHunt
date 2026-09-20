-- Phase 2.58: Belohnungscode-Katalog und atomare serverseitige Einloesung.
--
-- Klartextcodes werden nie gespeichert. Der Edge-Handler berechnet ihren
-- HMAC-Pruefwert und ruft ausschliesslich die interne Service-Role-RPC auf.

begin;

do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (57, 58)
  ) then
    raise exception 'Phase 2.57 muss vor Phase 2.58 ausgefuehrt werden';
  end if;
end;
$$;

create table if not exists public.reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  package jsonb not null,
  package_version integer not null check (package_version >= 1),
  status text not null default 'draft' check (status in ('draft', 'active', 'disabled', 'expired')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  global_limit integer not null check (global_limit between 1 and 1000000),
  account_limit integer not null check (account_limit between 1 and 100),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_catalog_cosmetics (
  cosmetic_type text not null check (cosmetic_type in ('ship_shape', 'ship_color', 'ship_aura')),
  cosmetic_id text not null check (cosmetic_id ~ '^[a-z0-9_-]{1,64}$'),
  active boolean not null default true,
  primary key (cosmetic_type, cosmetic_id)
);

insert into public.reward_catalog_cosmetics(cosmetic_type, cosmetic_id) values
  ('ship_shape','arrow'),('ship_shape','delta'),('ship_shape','sickle'),('ship_shape','ring'),
  ('ship_shape','star'),('ship_shape','wedge'),('ship_shape','saucer'),('ship_shape','probe'),
  ('ship_shape','glider'),('ship_shape','jet'),('ship_shape','prop'),('ship_shape','biplane'),
  ('ship_shape','rocket'),('ship_shape','flyingwing'),('ship_shape','astronaut'),('ship_shape','hero'),
  ('ship_shape','caped'),('ship_shape','winged'),('ship_shape','jetpack'),('ship_shape','swallow'),
  ('ship_shape','eagle'),('ship_shape','dragonfly'),('ship_shape','bat'),('ship_shape','quadcopter'),
  ('ship_shape','hexacopter'),('ship_shape','cc0-scout'),('ship_shape','cc0-3d-ship-1'),
  ('ship_shape','cc0-3d-ship-2'),('ship_shape','cc0-3d-ship-3'),('ship_shape','cc0-3d-ship-4'),
  ('ship_shape','cc0-3d-ship-5'),('ship_shape','cc0-3d-ship-6'),('ship_shape','cc0-3d-ship-7'),
  ('ship_shape','cc0-3d-ship-8'),('ship_shape','cc0-3d-ship-9'),
  ('ship_color','world'),('ship_color','gold'),('ship_color','ember'),('ship_color','crimson'),
  ('ship_color','ice'),('ship_color','azure'),('ship_color','teal'),('ship_color','forest'),
  ('ship_color','violet'),('ship_color','ruby'),('ship_color','snow'),('ship_color','onyx'),('ship_color','platinum'),
  ('ship_aura','none'),('ship_aura','prismasurge'),('ship_aura','wingbeat'),('ship_aura','heartbeat'),
  ('ship_aura','tumble'),('ship_aura','spin'),('ship_aura','phantom'),('ship_aura','prism'),
  ('ship_aura','starfire'),('ship_aura','singularity')
on conflict (cosmetic_type, cosmetic_id) do update set active = true;

create table if not exists public.reward_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.reward_campaigns(id) on delete restrict,
  code_digest text not null unique check (code_digest ~ '^[0-9a-f]{64}$'),
  key_version integer not null default 1 check (key_version >= 1),
  suffix text not null check (suffix ~ '^[0-9]{4}$'),
  status text not null default 'active' check (status in ('active', 'disabled', 'redeemed')),
  bound_profile_id uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((status <> 'redeemed') or (redeemed_at is not null and redeemed_by is not null))
);

create index if not exists reward_codes_campaign_status_idx
  on public.reward_codes(campaign_id, status);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.reward_campaigns(id) on delete restrict,
  code_id uuid not null references public.reward_codes(id) on delete restrict,
  request_id uuid not null,
  package_version integer not null,
  grants jsonb not null,
  profile_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (profile_id, request_id),
  unique (code_id)
);

create table if not exists public.reward_campaign_accounts (
  campaign_id uuid not null references public.reward_campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  redemption_count integer not null default 0 check (redemption_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, profile_id)
);

create table if not exists public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references public.reward_redemptions(id) on delete cascade,
  grant_type text not null check (grant_type in ('coins', 'cosmetic_grant', 'minimum_level', 'xp_run_boost')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_boosts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  redemption_id uuid not null references public.reward_redemptions(id) on delete restrict,
  factor numeric(4,2) not null check (factor in (1.25, 1.50, 2.00)),
  remaining_applications integer not null check (remaining_applications between 0 and 10),
  status text not null default 'active' check (status in ('active', 'exhausted', 'disabled')),
  created_at timestamptz not null default now()
);

create index if not exists profile_boosts_active_idx
  on public.profile_boosts(profile_id, status, created_at);

create table if not exists public.reward_code_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  network_hash text,
  attempted_at timestamptz not null default now(),
  successful boolean not null default false
);

create index if not exists reward_code_attempts_profile_idx
  on public.reward_code_attempts(profile_id, attempted_at desc);
create index if not exists reward_code_attempts_network_idx
  on public.reward_code_attempts(network_hash, attempted_at desc)
  where network_hash is not null;

create table if not exists public.reward_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('campaign_created', 'campaign_activated', 'campaign_disabled', 'codes_generated')),
  campaign_id uuid references public.reward_campaigns(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reward_campaigns enable row level security;
alter table public.reward_catalog_cosmetics enable row level security;
alter table public.reward_codes enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.reward_campaign_accounts enable row level security;
alter table public.reward_grants enable row level security;
alter table public.profile_boosts enable row level security;
alter table public.reward_code_attempts enable row level security;
alter table public.reward_admin_audit enable row level security;

revoke all on public.reward_campaigns, public.reward_catalog_cosmetics, public.reward_codes,
  public.reward_redemptions, public.reward_campaign_accounts, public.reward_grants,
  public.profile_boosts, public.reward_code_attempts, public.reward_admin_audit
  from anon, authenticated;
grant select on public.reward_redemptions, public.reward_grants, public.profile_boosts to authenticated;

create policy "Eigene Reward-Belege lesen" on public.reward_redemptions
  for select to authenticated using (profile_id = auth.uid());
create policy "Eigene Reward-Grants lesen" on public.reward_grants
  for select to authenticated using (exists (
    select 1 from public.reward_redemptions r where r.id = redemption_id and r.profile_id = auth.uid()
  ));
create policy "Eigene Bonusrechte lesen" on public.profile_boosts
  for select to authenticated using (profile_id = auth.uid());

create or replace function public.reward_require_service()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Interner Reward-Zugang erforderlich';
  end if;
end;
$$;

create or replace function public.reward_package_is_valid(p_package jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare grant_item jsonb; grant_type text;
begin
  if jsonb_typeof(p_package) <> 'object'
     or coalesce((p_package->>'version')::integer, 0) < 1
     or jsonb_typeof(p_package->'grants') <> 'array'
     or jsonb_array_length(p_package->'grants') not between 1 and 8 then
    return false;
  end if;
  for grant_item in select value from jsonb_array_elements(p_package->'grants') loop
    grant_type := grant_item->>'type';
    if grant_type = 'coins' then
      if coalesce((grant_item->>'amount')::integer, 0) not between 1 and 100000 then return false; end if;
    elsif grant_type = 'minimum_level' then
      if coalesce((grant_item->>'level')::integer, 0) not between 1 and 100 then return false; end if;
    elsif grant_type = 'xp_run_boost' then
      if coalesce((grant_item->>'factor')::numeric, 0) not in (1.25, 1.50, 2.00)
         or coalesce((grant_item->>'applications')::integer, 0) not between 1 and 10 then return false; end if;
    elsif grant_type = 'cosmetic_grant' then
      if not exists (
        select 1 from public.reward_catalog_cosmetics c
        where c.cosmetic_type = grant_item->>'cosmeticType'
          and c.cosmetic_id = grant_item->>'cosmeticId' and c.active
      ) then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.reward_total_xp_for_level(p_level integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare result bigint := 0; value integer;
begin
  for value in 1..greatest(0, least(100, p_level) - 1) loop
    result := result + public.balance_xp_for_level(value);
  end loop;
  return result;
end;
$$;

create or replace function public.redeem_reward_code_internal(
  p_profile_id uuid,
  p_code_digest text,
  p_suffix text,
  p_request_id uuid,
  p_network_hash text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.reward_redemptions%rowtype; code_row public.reward_codes%rowtype;
  campaign_row public.reward_campaigns%rowtype; progress_row public.profile_progress%rowtype;
  account_count integer; attempts_minute integer; attempts_hour integer; package_grants jsonb;
  grant_item jsonb; grant_type text; next_data jsonb; total_xp_value bigint;
  current_level integer; next_level integer; next_xp integer; target_xp bigint;
  point_interval integer; points_gained integer; redemption_id uuid; grant_result jsonb := '[]'::jsonb;
  cosmetic_key text; cosmetic_id text; existing_items jsonb; profile_changed_at timestamptz;
  boost_summary jsonb;
begin
  perform public.reward_require_service();
  if p_profile_id is null or p_request_id is null or coalesce(lower(p_code_digest), '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_suffix, '') !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request', 'retryable', false);
  end if;

  select * into existing from public.reward_redemptions
  where profile_id = p_profile_id and request_id = p_request_id for update;
  if found then
    return jsonb_build_object('ok', true, 'redemptionId', existing.id, 'requestId', existing.request_id,
      'packageVersion', existing.package_version, 'grants', existing.grants, 'profileRevision', existing.profile_updated_at);
  end if;

  select count(*) filter (where attempted_at >= now() - interval '1 minute'),
         count(*) filter (where attempted_at >= now() - interval '1 hour')
  into attempts_minute, attempts_hour from public.reward_code_attempts where profile_id = p_profile_id;
  if attempts_minute >= 5 or attempts_hour >= 20 then
    insert into public.reward_code_attempts(profile_id, network_hash) values (p_profile_id, p_network_hash);
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'retryable', true, 'retryAfterSeconds', 60);
  end if;

  select * into code_row from public.reward_codes
  where code_digest = lower(p_code_digest) for update;
  if not found or code_row.status <> 'active' or code_row.suffix <> p_suffix
     or (code_row.bound_profile_id is not null and code_row.bound_profile_id <> p_profile_id) then
    insert into public.reward_code_attempts(profile_id, network_hash) values (p_profile_id, p_network_hash);
    return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false);
  end if;

  select * into campaign_row from public.reward_campaigns where id = code_row.campaign_id for update;
  if not found or campaign_row.status <> 'active' or now() < campaign_row.starts_at or now() >= campaign_row.ends_at
     or campaign_row.redemption_count >= campaign_row.global_limit or not public.reward_package_is_valid(campaign_row.package) then
    insert into public.reward_code_attempts(profile_id, network_hash) values (p_profile_id, p_network_hash);
    return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false);
  end if;

  insert into public.reward_campaign_accounts(campaign_id, profile_id)
  values(campaign_row.id, p_profile_id) on conflict do nothing;
  select redemption_count into account_count from public.reward_campaign_accounts
  where campaign_id = campaign_row.id and profile_id = p_profile_id for update;
  if account_count >= campaign_row.account_limit then
    insert into public.reward_code_attempts(profile_id, network_hash) values (p_profile_id, p_network_hash);
    return jsonb_build_object('ok', false, 'code', 'already_redeemed', 'retryable', false);
  end if;

  select * into progress_row from public.profile_progress where profile_id = p_profile_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', true); end if;
  next_data := progress_row.data; total_xp_value := progress_row.total_xp; package_grants := campaign_row.package->'grants';
  redemption_id := gen_random_uuid();

  for grant_item in select value from jsonb_array_elements(package_grants) loop
    grant_type := grant_item->>'type';
    if grant_type = 'coins' then
      next_data := next_data || jsonb_build_object(
        'coins', coalesce((next_data->>'coins')::bigint, 0) + (grant_item->>'amount')::integer,
        'totalCoinsEarned', coalesce((next_data->>'totalCoinsEarned')::bigint, 0) + (grant_item->>'amount')::integer
      );
    elsif grant_type = 'cosmetic_grant' then
      cosmetic_key := case grant_item->>'cosmeticType' when 'ship_shape' then 'ownedShipShapes' when 'ship_color' then 'ownedShipColors' else 'ownedShipAuras' end;
      cosmetic_id := grant_item->>'cosmeticId'; existing_items := coalesce(next_data->cosmetic_key, '[]'::jsonb);
      if not exists (select 1 from jsonb_array_elements_text(existing_items) as value where value = cosmetic_id) then
        next_data := jsonb_set(next_data, array[cosmetic_key], existing_items || to_jsonb(cosmetic_id), true);
        next_data := jsonb_set(next_data, array['newCosmeticIds'], coalesce(next_data->'newCosmeticIds', '[]'::jsonb) || to_jsonb(cosmetic_id), true);
      end if;
    elsif grant_type = 'minimum_level' then
      target_xp := public.reward_total_xp_for_level((grant_item->>'level')::integer);
      total_xp_value := greatest(total_xp_value, target_xp);
    elsif grant_type = 'xp_run_boost' then
      insert into public.profile_boosts(profile_id, redemption_id, factor, remaining_applications)
      values (p_profile_id, redemption_id, (grant_item->>'factor')::numeric, (grant_item->>'applications')::integer);
    end if;
    grant_result := grant_result || grant_item;
  end loop;

  select level into current_level from public.profile_level_from_xp(progress_row.total_xp);
  select level, xp into next_level, next_xp from public.profile_level_from_xp(total_xp_value);
  point_interval := greatest(1, (public.balance_config()->'talents'->>'levelsPerTalentPoint')::integer);
  points_gained := greatest(0, floor((next_level - 1)::numeric / point_interval)::integer - floor((current_level - 1)::numeric / point_interval)::integer);
  next_data := next_data || jsonb_build_object('level', next_level, 'xp', next_xp,
    'talentPoints', coalesce((next_data->>'talentPoints')::integer, 0) + points_gained,
    'version', public.save_version());
  update public.profile_progress set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = p_profile_id returning updated_at into profile_changed_at;

  insert into public.reward_redemptions(id, profile_id, campaign_id, code_id, request_id, package_version, grants, profile_updated_at)
  values(redemption_id, p_profile_id, campaign_row.id, code_row.id, p_request_id, campaign_row.package_version, grant_result, profile_changed_at);
  insert into public.reward_grants(redemption_id, grant_type, payload)
  select redemption_id, value->>'type', value from jsonb_array_elements(grant_result);
  update public.reward_codes set status = 'redeemed', redeemed_at = now(), redeemed_by = p_profile_id where id = code_row.id;
  update public.reward_campaigns set redemption_count = redemption_count + 1, updated_at = now() where id = campaign_row.id;
  update public.reward_campaign_accounts set redemption_count = redemption_count + 1, updated_at = now()
  where campaign_id = campaign_row.id and profile_id = p_profile_id;
  insert into public.reward_code_attempts(profile_id, network_hash, successful) values (p_profile_id, p_network_hash, true);
  select coalesce(jsonb_agg(jsonb_build_object('applicationId', id, 'factor', factor,
    'remainingApplications', remaining_applications, 'sourcePackageVersion', campaign_row.package_version)), '[]'::jsonb)
  into boost_summary from public.profile_boosts b
  where b.redemption_id = (
    select r.id from public.reward_redemptions r
    where r.profile_id = p_profile_id and r.request_id = p_request_id
  );
  return jsonb_build_object('ok', true, 'redemptionId', redemption_id, 'requestId', p_request_id,
    'packageVersion', campaign_row.package_version, 'grants', grant_result,
    'profileRevision', profile_changed_at, 'boosts', boost_summary);
end;
$$;

revoke all on function public.reward_require_service() from public, anon, authenticated;
revoke all on function public.reward_package_is_valid(jsonb) from public, anon, authenticated;
revoke all on function public.reward_total_xp_for_level(integer) from public, anon, authenticated;
revoke all on function public.redeem_reward_code_internal(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_reward_code_internal(uuid, text, text, uuid, text) to service_role;

update public.isihunt_schema_state set schema_version = 58,
  migration_name = 'phase_2_58_reward_code_core.sql', applied_at = now() where singleton = true;

commit;
notify pgrst, 'reload schema';
