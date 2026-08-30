-- Phase 2.39: Mehrere direkte Einladungen in denselben Duellraum.
--
-- Phase 2.36 konnte genau eine offene Einladung pro Gastgeber und Raum
-- speichern. Das passte zu einem 1-vs-1-Duell, aber nicht zur Lobby mit bis
-- zu vier Spielern: Nach der ersten Annahme durfte der Host keinen dritten
-- Spieler mehr einladen. Diese Migration macht Einladung und Annahme slot-
-- basiert, ohne den bestehenden Raum-/Ergebnisvertrag zu veraendern.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 38
     ) and not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 39
     ) then
    raise exception 'Phase 2.38 muss vor Phase 2.39 ausgefuehrt werden';
  end if;
end;
$$;

-- Ein Raum darf mehrere Einladungen enthalten. Ein Invitee und ein Host
-- bleiben weiterhin eindeutig geschuetzt; nur die alte Raum-/Host-Sperre
-- wird entfernt.
drop index if exists public.duel_invitations_room_uidx;
drop index if exists public.duel_invitations_one_pending_inviter_uidx;

create or replace function public.create_duel_invitation(
  p_world_id text,
  p_target_player_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_id uuid;
  target_name text := public.normalize_player_name(p_target_player_name);
  host_room record;
  room_code text;
  room_seed text;
  room_world_id text;
  host_token text;
  inviter_name text;
  invitation_id uuid := gen_random_uuid();
  invitation_expires_at timestamptz := now() + interval '90 seconds';
  code_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code_attempt integer;
  code_character integer;
  participant_count integer;
  pending_count integer;
  room_created boolean := false;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_world_id is null or not (public.balance_config()->'worlds' ? p_world_id) then
    raise exception 'Ungueltige Welt';
  end if;
  if target_name = '' then raise exception 'Ungueltiger Spielername'; end if;

  select id into target_id
  from public.profiles
  where lower(player_name) = lower(target_name)
    and player_name <> '';
  if target_id is null then raise exception 'Spieler nicht gefunden'; end if;
  if target_id = uid then raise exception 'Du kannst dich nicht selbst einladen'; end if;

  select player_name into inviter_name from public.profiles where id = uid;
  if inviter_name is null or inviter_name = '' then
    raise exception 'Spielername fuer Einladungen fehlt';
  end if;

  -- Abgelaufene Einladungen werden vor der Kapazitaetspruefung geschlossen.
  update public.duel_invitations
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at <= now()
    and (inviter_id = uid or invitee_id = uid or invitee_id = target_id);

  update public.duel_rooms as r
  set expires_at = least(r.expires_at, now())
  from public.duel_invitations as i
  where i.room_code = r.code and i.status = 'expired'
    and r.invite_only and not exists (
      select 1 from public.duel_invitations as other
      where other.room_code = r.code and other.status = 'pending'
        and other.expires_at > now()
    )
    and not exists (
      select 1 from public.duel_room_participants as p
      where p.room_code = r.code and p.player_index > 0
    );

  if exists (
    select 1
    from public.duel_room_participants as p
    join public.duel_rooms as r on r.code = p.room_code
    where p.profile_id = target_id and r.expires_at > now()
  ) or exists (
    select 1 from public.duel_rooms as r
    where r.expires_at > now()
      and (r.host_profile_id = target_id or r.guest_profile_id = target_id)
  ) then
    raise exception 'Spieler ist bereits in einem Duell';
  end if;

  if exists (
    select 1 from public.duel_invitations
    where status = 'pending' and expires_at > now() and invitee_id = target_id
  ) then
    raise exception 'Es gibt bereits eine offene Duell-Einladung';
  end if;

  -- Nach der ersten Annahme bleibt der invite-only-Raum offen. Der Host
  -- verwendet deshalb denselben Raum fuer Einladung Nummer zwei und drei.
  select r.* into host_room
  from public.duel_rooms as r
  where r.host_profile_id = uid
    and r.expires_at > now()
    and r.start_at is null
    and r.invite_only
  limit 1;

  if found then
    select count(*) into participant_count
    from public.duel_room_participants as p
    where p.room_code = host_room.code;
    select count(*) into pending_count
    from public.duel_invitations as i
    where i.room_code = host_room.code
      and i.status = 'pending'
      and i.expires_at > now();
    if participant_count + pending_count >= host_room.max_players then
      raise exception 'Die Duell-Lobby ist voll';
    end if;

    room_code := host_room.code;
    room_seed := host_room.seed;
    room_world_id := host_room.world_id;
    host_token := null;
  else
    if exists (
      select 1 from public.duel_rooms as r
      where r.expires_at > now()
        and (r.host_profile_id = uid or r.guest_profile_id = uid)
    ) then
      raise exception 'Du bist bereits in einem aktiven Duell';
    end if;

    room_seed := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    room_world_id := p_world_id;
    host_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

    for code_attempt in 1..8 loop
      room_code := '';
      for code_character in 1..6 loop
        room_code := room_code || substr(
          code_alphabet,
          1 + floor(random() * length(code_alphabet))::integer,
          1
        );
      end loop;

      begin
        insert into public.duel_rooms (
          code, seed, world_id, max_players, host_token_hash, host_profile_id,
          invite_only
        ) values (
          room_code, room_seed, p_world_id, 4, md5(host_token), uid, true
        );
        room_created := true;
        exit;
      exception when unique_violation then
        if code_attempt = 8 then
          raise exception 'Kein freier Duellraum gefunden';
        end if;
      end;
    end loop;

    if not room_created then raise exception 'Duellraum konnte nicht erstellt werden'; end if;
  end if;

  insert into public.duel_invitations (
    id, room_code, inviter_id, invitee_id, expires_at
  ) values (
    invitation_id, room_code, uid, target_id, invitation_expires_at
  );

  return jsonb_build_object(
    'invitationId', invitation_id,
    'inviterName', inviter_name,
    'code', room_code,
    'seed', room_seed,
    'worldId', room_world_id,
    'participantToken', host_token,
    'expiresAt', invitation_expires_at
  );
end;
$$;

revoke execute on function public.create_duel_invitation(text, text) from public, anon;
grant execute on function public.create_duel_invitation(text, text) to authenticated;

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

  update public.duel_invitations
  set status = 'expired', responded_at = now()
  where invitee_id = auth.uid() and status = 'pending' and expires_at <= now();

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

drop function if exists public.accept_duel_invitation(uuid);
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

  select * into room
  from public.duel_rooms
  where code = invitation.room_code and expires_at > now()
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

create or replace function public.decline_duel_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invitation_room_code text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select i.room_code into invitation_room_code
  from public.duel_invitations as i
  where id = p_invitation_id and invitee_id = uid and status = 'pending'
  for update;
  if invitation_room_code is null then return false; end if;

  update public.duel_invitations
  set status = 'declined', responded_at = now()
  where id = p_invitation_id;
  update public.duel_rooms as r
  set expires_at = least(r.expires_at, now())
  where r.code = invitation_room_code and r.invite_only
    and not exists (
      select 1 from public.duel_invitations as other
      where other.room_code = r.code and other.status = 'pending'
        and other.expires_at > now()
    )
    and not exists (
      select 1 from public.duel_room_participants as p
      where p.room_code = r.code and p.player_index > 0
    );
  return true;
end;
$$;

revoke execute on function public.decline_duel_invitation(uuid) from public, anon;
grant execute on function public.decline_duel_invitation(uuid) to authenticated;

create or replace function public.cancel_duel_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invitation_room_code text;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select i.room_code into invitation_room_code
  from public.duel_invitations as i
  where id = p_invitation_id and inviter_id = uid and status = 'pending'
  for update;
  if invitation_room_code is null then return false; end if;

  update public.duel_invitations
  set status = 'cancelled', responded_at = now()
  where id = p_invitation_id;
  update public.duel_rooms as r
  set expires_at = least(r.expires_at, now())
  where r.code = invitation_room_code and r.invite_only
    and not exists (
      select 1 from public.duel_invitations as other
      where other.room_code = r.code and other.status = 'pending'
        and other.expires_at > now()
    )
    and not exists (
      select 1 from public.duel_room_participants as p
      where p.room_code = r.code and p.player_index > 0
    );
  return true;
end;
$$;

revoke execute on function public.cancel_duel_invitation(uuid) from public, anon;
grant execute on function public.cancel_duel_invitation(uuid) to authenticated;

update public.isihunt_schema_state
set schema_version = 39,
    migration_name = 'phase_2_39_duel_lobby_multi_invites.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
