-- Phase 2.49: Bot-Siege an einen serverseitig gestarteten Lauf binden.
--
-- Phase 2.47 schuetzte nur gegen doppelte Match-IDs. Ein angemeldeter Client
-- konnte deshalb beliebige UUIDs erzeugen und alle 80 Sekunden eine Praemie
-- anfordern. Der Server kann den lokalen Spielverlauf weiterhin nicht sehen,
-- aber er stellt die Match-ID jetzt selbst aus, registriert den Startzeitpunkt
-- und akzeptiert den Claim erst nach der Mindestdauer einer Bot-Runde.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 47
     ) then
    raise exception 'Phase 2.47 muss vor Phase 2.49 ausgefuehrt werden';
  end if;
end;
$$;

create table if not exists public.bot_victory_matches (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now(),
  primary key (profile_id, match_id)
);

alter table public.bot_victory_matches enable row level security;
revoke all on public.bot_victory_matches from anon, authenticated;

create index if not exists bot_victory_matches_recent
  on public.bot_victory_matches (profile_id, started_at desc);

create or replace function public.start_bot_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_match uuid;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  -- Ein verlorener Client-Reply darf keinen zweiten aktiven Lauf erzeugen.
  -- Nach der Rundendauer darf derselbe offene Datensatz fuer den Retry wieder
  -- verwendet werden; der Claim bleibt durch die Match-ID idempotent.
  select match_id into next_match
  from public.bot_victory_matches
  where profile_id = uid
    and started_at > now() - interval '80 seconds'
  order by started_at desc
  limit 1;
  if next_match is not null then return next_match; end if;

  delete from public.bot_victory_matches
  where profile_id = uid and started_at < now() - interval '1 day';

  insert into public.bot_victory_matches (profile_id)
  values (uid)
  returning match_id into next_match;
  return next_match;
end;
$$;

revoke execute on function public.start_bot_match() from public, anon;
grant execute on function public.start_bot_match() to authenticated;

create or replace function public.claim_bot_victory_bonus(
  p_match_id uuid
)
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
  safe_bonus integer;
  safe_xp integer;
  current_total_xp bigint;
  next_total_xp bigint;
  current_level integer;
  next_level integer;
  next_xp integer;
  level_coins integer;
  point_interval integer;
  points_gained integer;
  started_at timestamptz;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_match_id is null then raise exception 'Ungueltiges Bot-Duell'; end if;

  select data, total_xp into current_data, current_total_xp
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if exists (
    select 1 from public.bot_victory_claims
    where profile_id = uid and match_id = p_match_id
  ) then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  select m.started_at into started_at
  from public.bot_victory_matches as m
  where m.profile_id = uid and m.match_id = p_match_id
  for update;
  if started_at is null then raise exception 'Bot-Duell nicht gestartet'; end if;
  if now() < started_at + public.bot_victory_cooldown() then
    raise exception 'Bot-Duell noch nicht beendet';
  end if;

  select max(claimed_at) into started_at
  from public.bot_victory_claims where profile_id = uid;
  if started_at is not null and now() < started_at + public.bot_victory_cooldown() then
    raise exception 'Bot-Duell zu schnell eingereicht';
  end if;

  safe_bonus := public.balance_coins_for_runs(
    (cfg->'economy'->'sources'->>'botVictoryRuns')::numeric
  );
  safe_xp := public.balance_xp_for_runs(
    (cfg->'progression'->'xp'->>'botVictoryRuns')::numeric
  );

  point_interval := greatest(1, (cfg->'talents'->>'levelsPerTalentPoint')::integer);
  current_level := greatest(1, coalesce((current_data->>'level')::integer, 1));
  next_total_xp := coalesce(current_total_xp, 0) + safe_xp;
  select level, xp into next_level, next_xp
  from public.profile_level_from_xp(next_total_xp);
  level_coins := public.balance_coins_for_runs(
    greatest(0, next_level - current_level)
      * (cfg->'economy'->'sources'->>'levelRewardRuns')::numeric
  );
  points_gained := greatest(
    0,
    floor(greatest(0, next_level - 1)::numeric / point_interval)::integer
      - floor(greatest(0, current_level - 1)::numeric / point_interval)::integer
  );

  insert into public.bot_victory_claims (profile_id, match_id) values (uid, p_match_id);
  delete from public.bot_victory_matches where profile_id = uid and match_id = p_match_id;

  next_data := current_data || jsonb_build_object(
    'level', next_level, 'xp', next_xp,
    'talentPoints', coalesce((current_data->>'talentPoints')::integer, 0) + points_gained,
    'coins', coalesce((current_data->>'coins')::integer, 0) + safe_bonus + level_coins,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + safe_bonus + level_coins,
    'version', public.save_version()
  );
  update public.profile_progress
  set data = next_data, total_xp = next_total_xp, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.claim_bot_victory_bonus(uuid) from public, anon;
grant execute on function public.claim_bot_victory_bonus(uuid) to authenticated;

update public.isihunt_schema_state
set schema_version = 49,
    migration_name = 'phase_2_49_bot_match_challenge.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
