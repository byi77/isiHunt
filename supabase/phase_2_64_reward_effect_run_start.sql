-- Phase 2.64: Atomarer Verbrauch begrenzter Gameplay-Codeeffekte beim Solo-Start.
begin;
do $$ begin
  if not exists (select 1 from public.isihunt_schema_state where singleton = true and schema_version in (63, 64)) then
    raise exception 'Phase 2.63 muss vor Phase 2.64 ausgefuehrt werden';
  end if;
end $$;

create table if not exists public.reward_effect_run_attempts (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null, world_id text not null, effects jsonb not null, started_at timestamptz not null default now(),
  unique(profile_id, request_id)
);
alter table public.reward_effect_run_attempts enable row level security;
revoke all on public.reward_effect_run_attempts from anon, authenticated;
grant select on public.reward_effect_run_attempts to authenticated;
create policy "Eigene Effektstarts lesen" on public.reward_effect_run_attempts for select to authenticated using (profile_id = auth.uid());

create or replace function public.start_reward_effect_run_internal(p_profile_id uuid, p_request_id uuid, p_world_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.reward_effect_run_attempts%rowtype; item public.profile_run_effect_boosts%rowtype;
  effects jsonb := '{}'::jsonb; seen text[] := '{}'::text[]; remaining integer;
begin
  perform public.reward_require_service();
  if p_profile_id is null or p_request_id is null or not (public.balance_config()->'worlds' ? p_world_id) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request', 'retryable', false);
  end if;
  select * into existing from public.reward_effect_run_attempts where profile_id = p_profile_id and request_id = p_request_id for update;
  if found then return jsonb_build_object('ok', true, 'runId', existing.id, 'effects', existing.effects); end if;
  for item in select * from public.profile_run_effect_boosts
    where profile_id = p_profile_id and status = 'active' and remaining_applications > 0
    order by created_at, id for update loop
    if item.effect = any(seen) then continue; end if;
    remaining := item.remaining_applications - 1;
    update public.profile_run_effect_boosts set remaining_applications = remaining,
      status = case when remaining = 0 then 'exhausted' else 'active' end where id = item.id;
    effects := effects || jsonb_build_object(item.effect, item.factor);
    seen := array_append(seen, item.effect);
  end loop;
  if effects = '{}'::jsonb then return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false); end if;
  insert into public.reward_effect_run_attempts(profile_id, request_id, world_id, effects)
  values(p_profile_id, p_request_id, p_world_id, effects) returning id into existing.id;
  return jsonb_build_object('ok', true, 'runId', existing.id, 'effects', effects);
end;
$$;
revoke all on function public.start_reward_effect_run_internal(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_reward_effect_run_internal(uuid, uuid, text) to service_role;
update public.isihunt_schema_state set schema_version = 64, migration_name = 'phase_2_64_reward_effect_run_start.sql', applied_at = now() where singleton = true;
commit;
notify pgrst, 'reload schema';
