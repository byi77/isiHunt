-- Read-only Inventur nach Phase 2.27.
-- Dieses Skript veraendert keine Daten. Ergebnisse als Audit-Artefakt sichern.

-- 1. Alte globale Admin-Flags: nur zur Kontrolle, nicht als Schreibpfad.
select count(*) as admin_profile_count
from public.profiles
where is_admin = true;

-- 2. Profilstaende, deren Versionsmarker noch vor v9 liegt.
select count(*) as legacy_profile_progress_count
from public.profile_progress
where coalesce((data->>'version')::integer, 1) < 9;

-- 3. Anonyme Saves ohne neues Capability-Token.
select count(*) as legacy_save_count,
       count(*) filter (
         where coalesce((data->>'version')::integer, 1) < 9
       ) as legacy_save_version_count
from public.saves
where cardinality(coalesce(access_token_hashes, '{}'::text[])) = 0;

-- 4. v8-Saves in der gesamten Save-Tabelle (inklusive bereits tokenisierter).
select count(*) as save_version_8_count
from public.saves
where coalesce((data->>'version')::integer, 1) = 8;

-- 5. Phase-2.23-Reset-Indikatoren: reine Lesekontrolle.
select count(*) as profile_events_total,
       count(distinct profile_id) as profiles_with_events
from public.profile_progress_events;

-- 6. Tages-Events muessen einen kanonischen Schluessel tragen; normale Runs
-- bleiben NULL. Nur Lesekontrolle fuer Phase 2.28.
select count(*) as daily_events_total,
       count(*) filter (where daily_key is null) as daily_key_missing_count,
       count(*) filter (where daily_key !~ '^\d{4}-\d{2}-\d{2}$') as daily_key_invalid_count
from public.profile_progress_events
where daily_key is not null;

-- 7. Neue sicherheitsrelevante RPC-Signaturen - insbesondere kein frei
-- einreichbarer Tages-Score, kein clientseitiges Duell-Rollenflag und CAS
-- fuer Saves.
select p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_daily_bonus', 'claim_daily_login_bonus', 'submit_progress_event',
    'upsert_save', 'create_duel_room', 'join_duel_room', 'mark_duel_ready',
    'set_duel_start_time', 'get_duel_room', 'submit_duel_result',
    'submit_duel_talent_draft', 'request_duel_rematch'
  )
order by routine_name, arguments;

select count(*) filter (
         where expires_at > now() and host_token_hash is null
       ) as active_duel_rooms_without_host_token,
       count(*) filter (
         where expires_at > now() and guest_joined and guest_token_hash is null
       ) as active_joined_rooms_without_guest_token,
       count(*) filter (
         where expires_at <= now()
           and (host_token_hash is null or (guest_joined and guest_token_hash is null))
       ) as expired_legacy_duel_rooms
from public.duel_rooms;

-- Erwartete Nachkontrolle fuer Phase 2.27: keine direkten Grants fuer
-- anon/authenticated auf privaten Tabellen, RPC-Grants separat pruefen.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'saves', 'sync_codes', 'scores')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
