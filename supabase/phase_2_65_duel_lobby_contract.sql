-- Phase 2.65: Serverautoritativer Lobbystatus und idempotente Einladungannahme.
--
-- Phase 2.55 sperrt den Raum bereits atomar, aber eine verlorene Antwort nach
-- accept_duel_invitation() macht den Gast bisher handlungsunfähig: Der zweite
-- Aufruf sieht status = accepted und der ursprüngliche Token ist nur gehasht
-- gespeichert. Der Token wird deshalb deterministisch aus Einladung, Konto
-- und Raumseed abgeleitet; er wird weiterhin nie als Klartext gespeichert.
--
-- Der neue Lobby-RPC liefert nur bereinigte Slot-/Einladungsdaten. Der Client
-- liest weder Tabellen noch Realtime-Payloads als Quelle für Kapazität.

begin;

do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (64, 65)
  ) then
    raise exception 'Phase 2.64 muss vor Phase 2.65 ausgefuehrt werden';
  end if;
end;
$$;

create or replace function public.duel_invitation_participant_token(
  p_invitation_id uuid,
  p_profile_id uuid,
  p_room_seed text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(
    p_invitation_id::text || ':' || p_profile_id::text || ':' || p_room_seed,
    'sha256'
  ), 'hex');
$$;

revoke execute on function public.duel_invitation_participant_token(uuid, uuid, text)
  from public, anon, authenticated;

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
  existing_participant record;
  guest_token text;
  slot integer;
  current_count integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select * into invitation
  from public.duel_invitations
  where id = p_invitation_id and invitee_id = uid
  for update;
  if invitation is null then raise exception 'Einladung nicht gefunden'; end if;

  select * into room
  from public.duel_rooms as r
  where r.code = invitation.room_code and r.expires_at > now()
  for update;
  if room is null then raise exception 'Duellraum ist nicht mehr verfuegbar'; end if;

  -- Idempotenter Wiederholungsfall: der erste Commit war erfolgreich, nur die
  -- Antwort ging verloren. Der deterministische Token hat denselben Hash.
  if invitation.status = 'accepted' then
    select p.* into existing_participant
    from public.duel_room_participants as p
    where p.room_code = room.code and p.profile_id = uid;
    if existing_participant is null then
      raise exception 'Einladung ist angenommen, aber kein Teilnehmer gefunden';
    end if;
    guest_token := public.duel_invitation_participant_token(
      invitation.id, uid, room.seed
    );
    return query
    select room.code, room.seed, room.world_id, guest_token, room.match_number,
           existing_participant.player_index,
           (select count(*)::integer from public.duel_room_participants p
            where p.room_code = room.code), room.max_players;
    return;
  end if;

  if invitation.status <> 'pending' then
    raise exception 'Einladung ist nicht mehr offen';
  end if;
  if invitation.expires_at <= now() then
    update public.duel_invitations
    set status = 'expired', responded_at = now()
    where id = invitation.id;
    raise exception 'Einladung abgelaufen';
  end if;
  if room.start_at is not null or room.talent_draft_started_at is not null then
    raise exception 'Die Duell-Lobby ist bereits geschlossen';
  end if;

  if exists (
    select 1 from public.duel_room_participants as p
    join public.duel_rooms as r on r.code = p.room_code
    where p.profile_id = uid and r.expires_at > now()
  ) or exists (
    select 1 from public.duel_rooms as r
    where r.expires_at > now()
      and (r.host_profile_id = uid or r.guest_profile_id = uid)
  ) then
    raise exception 'Du bist bereits in einem aktiven Duell';
  end if;

  select min(candidate) into slot
  from generate_series(1, room.max_players - 1) as candidate
  where not exists (
    select 1 from public.duel_room_participants as p
    where p.room_code = room.code and p.player_index = candidate
  );
  if slot is null then raise exception 'Die Duell-Lobby ist voll'; end if;

  guest_token := public.duel_invitation_participant_token(invitation.id, uid, room.seed);
  insert into public.duel_room_participants (
    room_code, player_index, token_hash, profile_id
  ) values (
    room.code, slot, md5(guest_token), uid
  );

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

create or replace function public.get_duel_lobby_state(
  p_code text,
  p_participant_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  local_slot integer := public.duel_participant_slot(p_code, p_participant_token);
  phase text;
begin
  if local_slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;

  select r.* into room
  from public.duel_rooms as r
  where r.code = p_code and r.expires_at > now();
  if room is null then raise exception 'Duellraum nicht gefunden oder abgelaufen'; end if;

  phase := case
    when room.start_at is not null then 'started'
    when room.talent_draft_started_at is not null then 'talent'
    else 'open'
  end;

  return jsonb_build_object(
    'code', room.code,
    'phase', phase,
    'playerCount', (select count(*)::integer from public.duel_room_participants p
                    where p.room_code = room.code),
    'maxPlayers', room.max_players,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'index', slots.player_index,
        'state', case when p.player_index is null then 'free' else 'connected' end,
        'playerName', case when p.player_index is null then null else pr.player_name end,
        'talentReady', coalesce(p.talent_ready, false)
      ) order by slots.player_index)
      from generate_series(0, room.max_players - 1) as slots(player_index)
      left join public.duel_room_participants as p
        on p.room_code = room.code and p.player_index = slots.player_index
      left join public.profiles as pr on pr.id = p.profile_id
    ), '[]'::jsonb),
    'pendingInvitations', case when local_slot = 0 then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'inviteeName', p.player_name,
        'expiresAt', i.expires_at
      ) order by i.created_at)
      from public.duel_invitations as i
      join public.profiles as p on p.id = i.invitee_id
      where i.room_code = room.code and i.status = 'pending'
        and i.expires_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke execute on function public.get_duel_lobby_state(text, text) from public, anon;
grant execute on function public.get_duel_lobby_state(text, text) to authenticated;

update public.isihunt_schema_state
set schema_version = 65,
    migration_name = 'phase_2_65_duel_lobby_contract.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
