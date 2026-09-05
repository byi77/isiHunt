-- Phase 2.47: Bot-Siegpraemie serverseitig gutschreiben.
--
-- AUDIT_2026-09-05, Befund 6 (P2):
-- `ChallengeSystem.awardBotVictory()` schrieb XP und Coins ausschliesslich in
-- den lokalen Spielstand. Ein Bot-Duell erzeugt kein Fortschrittsereignis,
-- also lief nie ein Upload. Beim naechsten erfolgreichen Profilabgleich
-- (z.B. `claim_daily_login_bonus`) uebernahm der Client den Serverstand -
-- und die nur lokal gutgeschriebene Praemie war wieder weg.
--
-- Korrektur: ein idempotenter RPC nach dem Vorbild von `claim_daily_bonus`.
--
--   * Der Server rechnet die Praemie selbst aus `balance_config()`. Der
--     Client nennt nur die Match-ID, nie einen Betrag.
--   * `bot_victory_claims` haelt jede Match-ID genau einmal fest. Ein zweiter
--     Aufruf mit derselben ID gibt den Profilstand unveraendert zurueck -
--     damit ist ein Retry nach einem Funkloch gefahrlos.
--   * Ein Cooldown verhindert, dass jemand in Serie Matches meldet: eine
--     Bot-Runde dauert 90 Sekunden, schneller kann keine echte kommen.
--
-- Was der Server hier NICHT pruefen kann: dass das Duell wirklich gewonnen
-- wurde. Ein Bot-Duell laeuft vollstaendig lokal, es gibt keinen zweiten
-- Teilnehmer und keinen Spielverlauf in der Datenbank. Der Cooldown begrenzt
-- deshalb die Rate, nicht die Echtheit - dieselbe Abwaegung wie beim
-- Tagesbonus, nur ohne dessen Ereignis-Anker.
--
-- Diese Migration ist wiederholbar.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 46
     ) then
    raise exception 'Phase 2.46 muss vor Phase 2.47 ausgefuehrt werden';
  end if;
end;
$$;

create table if not exists public.bot_victory_claims (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (profile_id, match_id)
);

alter table public.bot_victory_claims enable row level security;
revoke all on public.bot_victory_claims from anon, authenticated;

create index if not exists bot_victory_claims_recent
  on public.bot_victory_claims (profile_id, claimed_at desc);

-- Mindestabstand zwischen zwei gemeldeten Bot-Siegen. Knapp unter der
-- Rundendauer von 90 Sekunden, damit ein legitimes Match nie abgelehnt wird.
create or replace function public.bot_victory_cooldown()
returns interval
language sql
immutable
as $$ select interval '80 seconds' $$;

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
  last_claim timestamptz;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_match_id is null then raise exception 'Ungueltiges Bot-Duell'; end if;

  select data, total_xp into current_data, current_total_xp
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  -- Bereits gutgeschrieben: unveraendert zurueckgeben, damit ein
  -- wiederholter Aufruf nach einem Netzfehler nichts doppelt bucht.
  if exists (
    select 1 from public.bot_victory_claims
    where profile_id = uid and match_id = p_match_id
  ) then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  select max(claimed_at) into last_claim
  from public.bot_victory_claims where profile_id = uid;
  if last_claim is not null and now() < last_claim + public.bot_victory_cooldown() then
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

revoke execute on function public.bot_victory_cooldown() from public, anon, authenticated;
revoke execute on function public.claim_bot_victory_bonus(uuid) from public, anon;
grant execute on function public.claim_bot_victory_bonus(uuid) to authenticated;

update public.isihunt_schema_state
set schema_version = 47,
    migration_name = 'phase_2_47_bot_victory_bonus.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
