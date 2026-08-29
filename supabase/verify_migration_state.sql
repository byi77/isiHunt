-- Read-only Nachweis fuer den produktiven Migrationsstand.
-- Erwartet genau eine Zeile mit schema_version = 33.

select singleton, schema_version, migration_name, applied_at
from public.isihunt_schema_state;

select routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'submit_progress_event', 'claim_daily_bonus', 'redeem_sync_code',
    'upsert_save', 'submit_duel_result'
  )
order by routine_name, arguments;
