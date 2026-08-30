-- Phase 2.43: Einen bewusst verlassenen Duellraum sofort freigeben.
--
-- Presence kann einen Spieler nach dem Verlassen bereits wieder als verfuegbar
-- melden, waehrend duel_rooms noch bis zum Ablaufdatum aktiv bleibt. Dadurch
-- blockierte create_duel_invitation() eine neue Einladung mit "bereits in
-- einem aktiven Duell". Der Teilnehmer-Token bleibt die einzige Berechtigung.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 42
     ) then
    raise exception 'Phase 2.42 muss vor Phase 2.43 ausgefuehrt werden';
  end if;
end;
$$;

create or replace function public.leave_duel_room(
  p_code text,
  p_participant_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_slot integer := public.duel_participant_slot(p_code, p_participant_token);
begin
  -- Abgelaufene oder bereits geschlossene Raeume sind ein idempotenter No-op.
  if participant_slot is null then return false; end if;

  update public.duel_rooms as r
  set expires_at = least(r.expires_at, now())
  where r.code = p_code and r.expires_at > now();

  if not found then return false; end if;

  update public.duel_invitations as i
  set status = 'cancelled', responded_at = now()
  where i.room_code = p_code and i.status = 'pending';

  return true;
end;
$$;

revoke execute on function public.leave_duel_room(text, text) from public;
grant execute on function public.leave_duel_room(text, text) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 43,
    migration_name = 'phase_2_43_duel_room_leave.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
