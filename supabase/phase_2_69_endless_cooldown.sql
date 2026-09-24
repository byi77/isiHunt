-- 30-Sekunden-Endlosrunden duerfen nicht am 60-Sekunden-Cooldown fuer
-- Einzelruns scheitern. Nachgelieferte Runden derselben Serie kommen zudem
-- gebuendelt an; ihre Reihenfolge und Gates prueft submit_endless_round.
begin;

do $$ begin
  if not exists (select 1 from public.isihunt_schema_state
                 where singleton = true and schema_version in (68, 69)) then
    raise exception 'Phase 2.68 muss vor Phase 2.69 ausgefuehrt werden';
  end if;
end $$;

create or replace function public.enforce_progress_event_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_created_at timestamptz;
  required_gap interval;
begin
  if new.endless_session_id is not null and new.endless_round is not null then
    return new;
  end if;

  select created_at into previous_created_at
  from public.profile_progress_events
  where profile_id = new.profile_id
  order by created_at desc
  limit 1;

  if previous_created_at is null then return new; end if;

  required_gap := make_interval(
    secs => greatest(
      60::double precision,
      least(120::double precision,
        ceil(greatest(coalesce(new.duration_ms, 60000), 60000) / 1000.0)
      )::double precision
    )
  );
  if new.created_at < previous_created_at + required_gap then
    raise exception 'Fortschrittslauf zu schnell eingereicht';
  end if;
  return new;
end;
$$;

update public.isihunt_schema_state
set schema_version = 69, migration_name = 'phase_2_69_endless_cooldown.sql', applied_at = now()
where singleton = true;
commit;
notify pgrst, 'reload schema';
