-- Phase 2.32: reproduzierbarer Nachweis des ausgefuehrten Migrationsstands.
--
-- Der Marker wird erst nach den Pruefungen geschrieben. Er kann daher nicht
-- versehentlich einen unvollstaendigen Serverstand als aktuell ausgeben. Das
-- Skript ist wiederholbar und veraendert keine Spiel- oder Kontodaten.

begin;

do $$
declare
  missing text[] := '{}'::text[];
begin
  if to_regclass('public.profiles') is null then
    missing := array_append(missing, 'profiles');
  end if;
  if to_regclass('public.profile_progress_events') is null then
    missing := array_append(missing, 'profile_progress_events');
  end if;
  if to_regclass('public.daily_bonus_claims') is null then
    missing := array_append(missing, 'daily_bonus_claims');
  end if;
  if to_regclass('public.cosmetic_catalog') is null then
    missing := array_append(missing, 'cosmetic_catalog');
  end if;
  if to_regclass('public.duel_rooms') is null then
    missing := array_append(missing, 'duel_rooms');
  end if;
  if to_regprocedure(
    'public.submit_progress_event(uuid,text,integer,integer,integer,integer,integer,integer,jsonb,text[],text)'
  ) is null then
    missing := array_append(missing, 'submit_progress_event(...,daily_key)');
  end if;
  if to_regprocedure('public.claim_daily_bonus(text,uuid)') is null then
    missing := array_append(missing, 'claim_daily_bonus(text,uuid)');
  end if;
  if to_regprocedure('public.redeem_sync_code(text)') is null then
    missing := array_append(missing, 'redeem_sync_code(text)');
  end if;
  if to_regprocedure('public.upsert_save(uuid,jsonb,integer,integer,integer,text,timestamptz)') is null then
    missing := array_append(missing, 'upsert_save(...,expected_updated_at)');
  end if;
  if to_regprocedure('public.submit_duel_result(text,text,jsonb)') is null then
    missing := array_append(missing, 'submit_duel_result(text,text,jsonb)');
  end if;

  if cardinality(missing) > 0 then
    raise exception 'Migrationsstand unvollstaendig; fehlend: %', array_to_string(missing, ', ');
  end if;
end;
$$;

create table if not exists public.isihunt_schema_state (
  singleton boolean primary key default true check (singleton),
  schema_version integer not null,
  migration_name text not null,
  applied_at timestamptz not null default now()
);

revoke all on public.isihunt_schema_state from anon, authenticated;

insert into public.isihunt_schema_state (singleton, schema_version, migration_name)
values (true, 32, 'phase_2_32_migration_state.sql')
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    migration_name = excluded.migration_name,
    applied_at = now();

commit;
