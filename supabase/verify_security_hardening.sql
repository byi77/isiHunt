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

-- Erwartete Nachkontrolle fuer Phase 2.27: keine direkten Grants fuer
-- anon/authenticated auf privaten Tabellen, RPC-Grants separat pruefen.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'saves', 'sync_codes', 'scores')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
