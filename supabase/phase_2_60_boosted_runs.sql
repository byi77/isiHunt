-- Phase 2.60: Servergebundene XP-Bonusrunden.
-- Start verbraucht eine Anwendung atomar. Finish ruft den bestehenden
-- Fortschrittsimport mit der beim Start fest vergebenen Event-ID auf.

begin;

do $$
begin
  if not exists (select 1 from public.isihunt_schema_state where singleton = true and schema_version in (59, 60)) then
    raise exception 'Phase 2.59 muss vor Phase 2.60 ausgefuehrt werden';
  end if;
end;
$$;

create table if not exists public.boost_run_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  boost_id uuid not null references public.profile_boosts(id) on delete restrict,
  event_id uuid not null unique,
  world_id text not null,
  mode text not null check (mode in ('solo')),
  factor numeric(4,2) not null check (factor in (1.25, 1.50, 2.00)),
  balance_schema_version integer not null,
  server_seed text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'settled', 'abandoned', 'expired')),
  finish_fingerprint text,
  base_xp integer,
  bonus_xp integer,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(profile_id, request_id)
);

create unique index if not exists boost_run_attempts_one_active_idx
  on public.boost_run_attempts(profile_id) where status = 'active';
create index if not exists boost_run_attempts_profile_idx
  on public.boost_run_attempts(profile_id, created_at desc);

alter table public.boost_run_attempts enable row level security;
revoke all on public.boost_run_attempts from anon, authenticated;
grant select on public.boost_run_attempts to authenticated;
create policy "Eigene Bonusversuche lesen" on public.boost_run_attempts
  for select to authenticated using (profile_id = auth.uid());

create or replace function public.reward_expire_boost_attempts(p_profile_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.boost_run_attempts set status = 'expired'
  where profile_id = p_profile_id and status = 'active' and expires_at <= now()
$$;

create or replace function public.start_boosted_run_internal(
  p_profile_id uuid, p_request_id uuid, p_world_id text, p_mode text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.boost_run_attempts%rowtype; selected_boost public.profile_boosts%rowtype;
  attempt_id uuid; event_id uuid := gen_random_uuid(); duration interval := interval '4 minutes';
begin
  perform public.reward_require_service();
  if p_profile_id is null or p_request_id is null or p_mode <> 'solo'
     or not (public.balance_config()->'worlds' ? p_world_id) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request', 'retryable', false);
  end if;
  perform public.reward_expire_boost_attempts(p_profile_id);
  select * into existing from public.boost_run_attempts
  where profile_id = p_profile_id and request_id = p_request_id for update;
  if found then
    return jsonb_build_object('ok', true, 'runId', existing.id, 'status', existing.status,
      'startedAt', existing.started_at, 'expiresAt', existing.expires_at, 'factor', existing.factor,
      'remainingApplications', (select coalesce(sum(remaining_applications), 0) from public.profile_boosts where profile_id = p_profile_id and status = 'active'));
  end if;
  if exists (select 1 from public.boost_run_attempts where profile_id = p_profile_id and status = 'active' for update) then
    return jsonb_build_object('ok', false, 'code', 'conflict', 'retryable', false);
  end if;
  select * into selected_boost from public.profile_boosts
  where profile_id = p_profile_id and status = 'active' and remaining_applications > 0
  order by created_at, id limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false); end if;
  update public.profile_boosts set remaining_applications = remaining_applications - 1,
    status = case when remaining_applications - 1 = 0 then 'exhausted' else 'active' end
  where id = selected_boost.id;
  insert into public.boost_run_attempts(profile_id, request_id, boost_id, event_id, world_id, mode, factor,
    balance_schema_version, server_seed, expires_at)
  values(p_profile_id, p_request_id, selected_boost.id, event_id, p_world_id, p_mode, selected_boost.factor,
    60, encode(gen_random_bytes(16), 'hex'), now() + duration)
  returning id into attempt_id;
  return jsonb_build_object('ok', true, 'runId', attempt_id, 'status', 'active', 'startedAt', now(),
    'expiresAt', now() + duration, 'factor', selected_boost.factor,
    'remainingApplications', (select coalesce(sum(remaining_applications), 0) from public.profile_boosts where profile_id = p_profile_id and status = 'active'));
end;
$$;

create or replace function public.abandon_boosted_run_internal(p_profile_id uuid, p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare attempt public.boost_run_attempts%rowtype;
begin
  perform public.reward_require_service();
  select * into attempt from public.boost_run_attempts where id = p_run_id and profile_id = p_profile_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false); end if;
  if attempt.status = 'active' and attempt.expires_at <= now() then
    update public.boost_run_attempts set status = 'expired' where id = attempt.id;
    attempt.status := 'expired';
  elsif attempt.status = 'active' then
    update public.boost_run_attempts set status = 'abandoned' where id = attempt.id;
    attempt.status := 'abandoned';
  end if;
  return jsonb_build_object('ok', true, 'runId', attempt.id, 'status', attempt.status);
end;
$$;

create or replace function public.reward_apply_bonus_xp(p_profile_id uuid, p_bonus_xp integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare progress public.profile_progress%rowtype; cfg jsonb := public.balance_config();
  current_level integer; next_level integer; next_xp integer; total_xp_value bigint;
  point_interval integer; points_gained integer; level_coins integer; next_data jsonb;
begin
  select * into progress from public.profile_progress where profile_id = p_profile_id for update;
  if not found then raise exception 'Profilstand nicht gefunden'; end if;
  select level into current_level from public.profile_level_from_xp(progress.total_xp);
  total_xp_value := progress.total_xp + greatest(0, p_bonus_xp);
  select level, xp into next_level, next_xp from public.profile_level_from_xp(total_xp_value);
  point_interval := greatest(1, (cfg->'talents'->>'levelsPerTalentPoint')::integer);
  points_gained := greatest(0, floor((next_level - 1)::numeric / point_interval)::integer - floor((current_level - 1)::numeric / point_interval)::integer);
  level_coins := public.balance_coins_for_runs(greatest(0, next_level - current_level) * (cfg->'economy'->'sources'->>'levelRewardRuns')::numeric);
  next_data := progress.data || jsonb_build_object('level', next_level, 'xp', next_xp,
    'talentPoints', coalesce((progress.data->>'talentPoints')::integer, 0) + points_gained,
    'coins', coalesce((progress.data->>'coins')::bigint, 0) + level_coins,
    'totalCoinsEarned', coalesce((progress.data->>'totalCoinsEarned')::bigint, 0) + level_coins,
    'version', public.save_version());
  update public.profile_progress set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = p_profile_id;
  return jsonb_build_object('bonusXp', greatest(0, p_bonus_xp), 'level', next_level, 'xp', next_xp,
    'talentPointsGained', points_gained, 'levelCoins', level_coins);
end;
$$;

create or replace function public.finish_boosted_run_internal(
  p_profile_id uuid, p_run_id uuid, p_score integer, p_best_combo integer,
  p_duration_ms integer, p_collected jsonb, p_achievement_ids text[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare attempt public.boost_run_attempts%rowtype; progress_result public.profile_progress%rowtype;
  event_xp integer; bonus integer; fingerprint text; bonus_result jsonb;
begin
  perform public.reward_require_service();
  select * into attempt from public.boost_run_attempts where id = p_run_id and profile_id = p_profile_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false); end if;
  fingerprint := encode(digest(jsonb_build_object('score', p_score, 'bestCombo', p_best_combo, 'durationMs', p_duration_ms,
    'collected', p_collected, 'achievementIds', coalesce(to_jsonb(p_achievement_ids), '[]'::jsonb))::text, 'sha256'), 'hex');
  if attempt.status = 'settled' then
    if attempt.finish_fingerprint = fingerprint then
      return jsonb_build_object('ok', true, 'runId', attempt.id, 'status', 'settled', 'baseXp', attempt.base_xp, 'bonusXp', attempt.bonus_xp);
    end if;
    return jsonb_build_object('ok', false, 'code', 'conflict', 'retryable', false);
  end if;
  if attempt.status <> 'active' or attempt.expires_at <= now() or now() < attempt.started_at + interval '60 seconds' then
    if attempt.status = 'active' and attempt.expires_at <= now() then update public.boost_run_attempts set status = 'expired' where id = attempt.id; end if;
    return jsonb_build_object('ok', false, 'code', 'unavailable', 'retryable', false);
  end if;
  if p_duration_ms not between 60000 and 120000 then return jsonb_build_object('ok', false, 'code', 'invalid_request', 'retryable', false); end if;
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  select * into progress_result from public.submit_progress_event(attempt.event_id, attempt.world_id, p_score, p_best_combo,
    0, 0, p_duration_ms, 0, p_collected, p_achievement_ids);
  select xp_gained into event_xp from public.profile_progress_events where event_id = attempt.event_id and profile_id = p_profile_id;
  bonus := greatest(0, round(event_xp * attempt.factor)::integer - event_xp);
  bonus_result := public.reward_apply_bonus_xp(p_profile_id, bonus);
  update public.boost_run_attempts set status = 'settled', finish_fingerprint = fingerprint, base_xp = event_xp,
    bonus_xp = bonus, settled_at = now() where id = attempt.id;
  return jsonb_build_object('ok', true, 'runId', attempt.id, 'status', 'settled', 'baseXp', event_xp,
    'bonusXp', bonus, 'profile', bonus_result);
end;
$$;

revoke all on function public.reward_expire_boost_attempts(uuid) from public, anon, authenticated;
revoke all on function public.start_boosted_run_internal(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.abandon_boosted_run_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reward_apply_bonus_xp(uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_boosted_run_internal(uuid, uuid, integer, integer, integer, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.start_boosted_run_internal(uuid, uuid, text, text) to service_role;
grant execute on function public.abandon_boosted_run_internal(uuid, uuid) to service_role;
grant execute on function public.finish_boosted_run_internal(uuid, uuid, integer, integer, integer, jsonb, text[]) to service_role;

update public.isihunt_schema_state set schema_version = 60,
  migration_name = 'phase_2_60_boosted_runs.sql', applied_at = now() where singleton = true;

commit;
notify pgrst, 'reload schema';
