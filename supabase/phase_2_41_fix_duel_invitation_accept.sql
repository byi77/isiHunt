-- Phase 2.41: Duell-Einladung - Raumspalten im Accept-RPC eindeutig machen.
--
-- Phase 2.39 hat accept_duel_invitation() um RETURNS TABLE erweitert. Dadurch
-- existiert im Funktionsrumpf auch die PL/pgSQL-Variable `code`. Die bisher
-- unqualifizierte Abfrage auf duel_rooms.code bricht deshalb mit 42702 ab,
-- bevor die Einladung angenommen werden kann.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 40
     ) and not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 41
     ) then
    raise exception 'Phase 2.40 muss vor Phase 2.41 ausgefuehrt werden';
  end if;
end;
$$;

create or replace function public.accept_duel_invitation(p_invitation_id uuid)
returns table (
  code text,
  seed text,
  world_id text,
  participant_token text,
  match_number integer,
  player_index integer,
  player_count integer,
  max_players integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invitation record;
  room record;
  guest_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  slot integer;
  current_count integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select * into invitation
  from public.duel_invitations
  where id = p_invitation_id and invitee_id = uid
  for update;
  if invitation is null then raise exception 'Einladung nicht gefunden'; end if;
  if invitation.status <> 'pending' then raise exception 'Einladung ist nicht mehr offen'; end if;
  if invitation.expires_at <= now() then
    update public.duel_invitations
    set status = 'expired', responded_at = now()
    where id = invitation.id;
    raise exception 'Einladung abgelaufen';
  end if;

  if exists (
    select 1
    from public.duel_room_participants as p
    join public.duel_rooms as r on r.code = p.room_code
    where p.profile_id = uid and r.expires_at > now()
  ) or exists (
    select 1 from public.duel_rooms as r
    where r.expires_at > now()
      and (r.host_profile_id = uid or r.guest_profile_id = uid)
  ) then
    raise exception 'Du bist bereits in einem aktiven Duell';
  end if;

  select r.* into room
  from public.duel_rooms as r
  where r.code = invitation.room_code and r.expires_at > now()
  for update;
  if room is null or room.start_at is not null then
    raise exception 'Duellraum ist nicht mehr verfuegbar';
  end if;

  select min(candidate) into slot
  from generate_series(1, room.max_players - 1) as candidate
  where not exists (
    select 1 from public.duel_room_participants as p
    where p.room_code = room.code and p.player_index = candidate
  );
  if slot is null then raise exception 'Die Duell-Lobby ist voll'; end if;

  insert into public.duel_room_participants (
    room_code, player_index, token_hash, profile_id
  ) values (
    room.code, slot, md5(guest_token), uid
  );

  -- Die Legacy-Spalten bleiben fuer alte Auswertungen gepflegt. Slot 2/3
  -- lebt ausschliesslich in duel_room_participants.
  if slot = 1 then
    update public.duel_rooms
    set guest_joined = true,
        guest_token_hash = md5(guest_token),
        guest_profile_id = uid
    where public.duel_rooms.code = room.code;
  end if;

  update public.duel_invitations
  set status = 'accepted', responded_at = now()
  where id = invitation.id;

  select count(*) into current_count
  from public.duel_room_participants as p
  where p.room_code = room.code;

  return query
  select room.code, room.seed, room.world_id, guest_token, room.match_number,
         slot, current_count, room.max_players;
end;
$$;

revoke execute on function public.accept_duel_invitation(uuid) from public, anon;
grant execute on function public.accept_duel_invitation(uuid) to authenticated;

update public.isihunt_schema_state
set schema_version = 41,
    migration_name = 'phase_2_41_fix_duel_invitation_accept.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
