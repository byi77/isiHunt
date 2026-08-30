-- Phase 2.44: Getrennte Duell-Rangliste fuer 2-, 3- und 4-Spieler-Matches.
--
-- Ein Match wird erst gewertet, wenn alle Teilnehmer ein serverseitig
-- plausibilisiertes Ergebnis abgegeben haben. Das Rating wird paarweise gegen
-- alle Mitspieler berechnet; Sieg/Niederlage/Unentschieden bleiben dagegen
-- Match-Werte und werden aus der Gesamtplatzierung abgeleitet.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 43
     ) then
    raise exception 'Phase 2.43 muss vor Phase 2.44 ausgefuehrt werden';
  end if;
end;
$$;

create table if not exists public.duel_leaderboard (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  rating      integer not null default 1000 check (rating between 100 and 5000),
  matches     integer not null default 0 check (matches >= 0),
  wins        integer not null default 0 check (wins >= 0),
  losses      integer not null default 0 check (losses >= 0),
  draws       integer not null default 0 check (draws >= 0),
  updated_at  timestamptz not null default now()
);

-- Die Momentaufnahme ist der Idempotenzschluessel. Sie haelt nur die fuer die
-- Wertung noetigen Profil-IDs und Scores; private Ergebnisdetails bleiben in
-- duel_room_participants und werden nicht Teil der Ranglistenabfrage.
create table if not exists public.duel_match_results (
  room_code      text not null,
  match_number   integer not null check (match_number > 0),
  player_results jsonb not null check (jsonb_typeof(player_results) = 'array'),
  played_at      timestamptz not null default now(),
  primary key (room_code, match_number)
);

create index if not exists duel_leaderboard_rank_idx
  on public.duel_leaderboard (rating desc, wins desc, matches asc, updated_at asc);

alter table public.duel_leaderboard enable row level security;
alter table public.duel_match_results enable row level security;
revoke all on public.duel_leaderboard from anon, authenticated;
revoke all on public.duel_match_results from anon, authenticated;

create or replace function public.record_duel_leaderboard_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_match_number integer;
  participant_count integer;
  linked_profile_count integer;
  distinct_profile_count integer;
  result_count integer;
  snapshot jsonb;
  player record;
begin
  select r.match_number into room_match_number
  from public.duel_rooms as r
  where r.code = new.room_code;

  if room_match_number is null then return new; end if;

  select count(*), count(p.profile_id), count(distinct p.profile_id), count(p.result),
         jsonb_agg(
           jsonb_build_object(
             'profileId', p.profile_id::text,
             'score', (p.result->>'score')::integer
           ) order by p.player_index
         )
    into participant_count, linked_profile_count, distinct_profile_count, result_count, snapshot
  from public.duel_room_participants as p
  where p.room_code = new.room_code;

  -- Anonyme Code-Raeume und unvollstaendige Matches bleiben ungewertet.
  if participant_count not between 2 and 4
     or linked_profile_count <> participant_count
     or distinct_profile_count <> participant_count
     or result_count <> participant_count then
    return new;
  end if;

  insert into public.duel_match_results (room_code, match_number, player_results)
  values (new.room_code, room_match_number, snapshot)
  on conflict (room_code, match_number) do nothing;

  -- Der zweite Triggerlauf (z. B. ein doppelter Submit) darf kein zweites
  -- Rating erzeugen.
  if not found then return new; end if;

  /*
   * Mehrspieler-Elo:
   * - Jede Person wird gegen jeden Mitspieler verglichen.
   * - Die durchschnittliche Paarabweichung wird mit K=32 bewertet, damit ein
   *   4er-Match nicht viermal so stark zaehlt wie ein 1-gegen-1.
   * - Alle Ratings in `ratings` sind der Stand vor diesem Match.
   */
  for player in
    with scores as (
      select
        (entry->>'profileId')::uuid as profile_id,
        (entry->>'score')::numeric as score
      from jsonb_array_elements(snapshot) as entry
    ),
    ratings as (
      select s.profile_id, s.score, coalesce(l.rating, 1000)::numeric as rating
      from scores as s
      left join public.duel_leaderboard as l on l.profile_id = s.profile_id
    ),
    deltas as (
      select
        a.profile_id,
        a.rating,
        round(
          32.0 * avg(
            case
              when a.score > b.score then 1.0
              when a.score < b.score then 0.0
              else 0.5
            end
            - 1.0 / (1.0 + power(10.0, (b.rating - a.rating) / 400.0))
          )
        )::integer as rating_delta
      from ratings as a
      join ratings as b on b.profile_id <> a.profile_id
      group by a.profile_id, a.rating
    ),
    top_score as (
      select max(score) as value
      from ratings
    ),
    top_count as (
      select count(*) as value
      from ratings as r
      cross join top_score as t
      where r.score = t.value
    )
    select
      d.profile_id,
      d.rating_delta,
      case when r.score = t.value and c.value = 1 then 1 else 0 end as wins,
      case when r.score < t.value then 1 else 0 end as losses,
      case when r.score = t.value and c.value > 1 then 1 else 0 end as draws
    from deltas as d
    join ratings as r on r.profile_id = d.profile_id
    cross join top_score as t
    cross join top_count as c
  loop
    insert into public.duel_leaderboard (
      profile_id, rating, matches, wins, losses, draws
    ) values (
      player.profile_id,
      least(5000, greatest(100, 1000 + player.rating_delta)),
      1,
      player.wins,
      player.losses,
      player.draws
    )
    on conflict (profile_id) do update
    set rating = least(
                  5000,
                  greatest(100, public.duel_leaderboard.rating + player.rating_delta)
                ),
        matches = public.duel_leaderboard.matches + 1,
        wins = public.duel_leaderboard.wins + player.wins,
        losses = public.duel_leaderboard.losses + player.losses,
        draws = public.duel_leaderboard.draws + player.draws,
        updated_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists duel_leaderboard_match_record on public.duel_room_participants;
create trigger duel_leaderboard_match_record
after update of result on public.duel_room_participants
for each row execute function public.record_duel_leaderboard_match();
revoke execute on function public.record_duel_leaderboard_match() from public, anon, authenticated;

-- Bereits abgeschlossene authentifizierte Matches werden einmalig durch den
-- gleichen idempotenten Pfad nachgetragen. Anonyme oder unvollstaendige
-- historische Raeume werden von der Funktion automatisch uebersprungen.
update public.duel_room_participants
set result = result
where result is not null;

create or replace function public.get_duel_leaderboard(p_limit integer default 50)
returns table (
  rank     integer,
  player_name text,
  rating   integer,
  matches  integer,
  wins     integer,
  losses   integer,
  draws    integer,
  is_own   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      row_number() over (
        order by l.rating desc, l.wins desc, l.matches asc, p.player_name asc, p.id asc
      )::integer as rank,
      p.player_name,
      l.rating,
      l.matches,
      l.wins,
      l.losses,
      l.draws,
      (p.id = auth.uid()) as is_own
    from public.duel_leaderboard as l
    join public.profiles as p on p.id = l.profile_id
    where l.matches > 0 and p.player_name <> ''
  )
  select rank, player_name, rating, matches, wins, losses, draws, is_own
  from ranked
  where rank <= greatest(1, least(100, coalesce(p_limit, 50)))
  order by rank;
$$;

revoke execute on function public.get_duel_leaderboard(integer) from public;
grant execute on function public.get_duel_leaderboard(integer) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 44,
    migration_name = 'phase_2_44_duel_leaderboard.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
