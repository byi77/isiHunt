-- Phase 2.33: Bestenliste nur noch fuer authentifizierte Profile beschreibbar.
--
-- Anonyme Lesbarkeit bleibt erhalten. Anonyme Score-Submission war jedoch
-- trotz Save-Capability-Token beliebig plausibel faelschbar und konnte deshalb
-- nicht als belastbarer Wettbewerb gelten.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 32
     ) then
    raise exception 'Phase 2.32 muss vor Phase 2.33 ausgefuehrt werden';
  end if;
end;
$$;

revoke execute on function public.submit_best_score(
  uuid, text, text, integer, integer, integer, integer, jsonb, text, timestamptz
) from anon;
grant execute on function public.submit_best_score(
  uuid, text, text, integer, integer, integer, integer, jsonb, text, timestamptz
) to authenticated;

update public.isihunt_schema_state
set schema_version = 33,
    migration_name = 'phase_2_33_leaderboard_auth_only.sql',
    applied_at = now()
where singleton = true;

commit;

notify pgrst, 'reload schema';
