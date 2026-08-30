-- Read-only Nachweis fuer den produktiven Migrationsstand.
-- Erwartet genau eine Zeile mit schema_version = 38.

select singleton, schema_version, migration_name, applied_at
from public.isihunt_schema_state;

select p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'submit_progress_event', 'claim_daily_bonus', 'redeem_sync_code',
    'upsert_save', 'submit_duel_result', 'submit_duel_talent_draft',
    'request_duel_rematch', 'create_duel_invitation', 'list_duel_invitations',
    'accept_duel_invitation', 'decline_duel_invitation', 'cancel_duel_invitation',
    'duel_participant_slot', 'set_duel_start_time', 'get_duel_room'
  )
order by routine_name, arguments;
