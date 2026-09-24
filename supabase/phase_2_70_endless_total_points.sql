-- Endlos-Rangliste nennt neben der besten Serie auch alle angenommenen
-- Endlos-Punkte des Profils. Beide Werte stammen aus denselben Rundenbelegen.
begin;

do $$ begin
  if not exists (select 1 from public.isihunt_schema_state
                 where singleton = true and schema_version in (69, 70)) then
    raise exception 'Phase 2.69 muss vor Phase 2.70 ausgefuehrt werden';
  end if;
end $$;

drop function if exists public.get_endless_leaderboard(integer);
create function public.get_endless_leaderboard(p_limit integer default 50)
returns table (
  rank integer, player_name text, score bigint, rounds integer,
  total_score bigint, created_at timestamptz, is_own boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sessions as (
    select e.profile_id, e.endless_session_id,
      sum(e.score)::bigint as score,
      max(e.endless_round)::integer as rounds,
      max(e.created_at) as created_at
    from public.profile_progress_events e
    where e.endless_session_id is not null
    group by e.profile_id, e.endless_session_id
  ), totals as (
    select profile_id, sum(score)::bigint as total_score
    from sessions
    group by profile_id
  ), best as (
    select s.*, row_number() over (
      partition by s.profile_id
      order by s.score desc, s.rounds desc, s.created_at asc
    ) as own_rank
    from sessions s
  ), ranked as (
    select row_number() over (
      order by b.score desc, b.rounds desc, b.created_at asc, b.profile_id
    )::integer as rank,
      p.player_name, b.score, b.rounds, t.total_score, b.created_at,
      coalesce(b.profile_id = auth.uid(), false) as is_own
    from best b
    join totals t on t.profile_id = b.profile_id
    join public.profiles p on p.id = b.profile_id
    where b.own_rank = 1 and coalesce(p.player_name, '') <> ''
  )
  select rank, player_name, score, rounds, total_score, created_at, is_own
  from ranked
  where rank <= greatest(1, least(100, coalesce(p_limit, 50)))
  order by rank;
$$;

revoke execute on function public.get_endless_leaderboard(integer) from public;
grant execute on function public.get_endless_leaderboard(integer) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 70, migration_name = 'phase_2_70_endless_total_points.sql', applied_at = now()
where singleton = true;
commit;
notify pgrst, 'reload schema';
