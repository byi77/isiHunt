-- Phase 2.40: Duell-Einladungen - Spaltenreferenz im Listing-RPC eindeutig machen.
--
-- Phase 2.39 hat die offene Einladungsliste als RETURNS TABLE-Funktion ersetzt.
-- Dadurch existiert im Funktionsrumpf auch eine PL/pgSQL-Variable `expires_at`.
-- Die unqualifizierte Ablaufpruefung kollidiert mit duel_invitations.expires_at
-- und bricht mit 42702 ab, bevor eine Einladung an den Client zurueckkommt.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 39
     ) and not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 40
     ) then
    raise exception 'Phase 2.39 muss vor Phase 2.40 ausgefuehrt werden';
  end if;
end;
$$;

create or replace function public.list_duel_invitations()
returns table (
  id uuid,
  inviter_name text,
  world_id text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;

  update public.duel_invitations as i
  set status = 'expired', responded_at = now()
  where i.invitee_id = auth.uid() and i.status = 'pending' and i.expires_at <= now();

  update public.duel_rooms as r
  set expires_at = least(r.expires_at, now())
  from public.duel_invitations as i
  where i.room_code = r.code and i.invitee_id = auth.uid()
    and i.status = 'expired' and r.invite_only
    and not exists (
      select 1 from public.duel_invitations as other
      where other.room_code = r.code and other.status = 'pending'
        and other.expires_at > now()
    )
    and not exists (
      select 1 from public.duel_room_participants as p
      where p.room_code = r.code and p.player_index > 0
    );

  return query
  select i.id, p.player_name, r.world_id, i.expires_at
  from public.duel_invitations as i
  join public.profiles as p on p.id = i.inviter_id
  join public.duel_rooms as r on r.code = i.room_code
  where i.invitee_id = auth.uid()
    and i.status = 'pending'
    and i.expires_at > now()
    and r.expires_at > now()
  order by i.created_at asc;
end;
$$;

revoke execute on function public.list_duel_invitations() from public, anon;
grant execute on function public.list_duel_invitations() to authenticated;

update public.isihunt_schema_state
set schema_version = 40,
    migration_name = 'phase_2_40_fix_duel_invitation_listing.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
