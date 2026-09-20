-- Phase 2.55: Mehrspieler-Lobby atomar gegen parallele Einladungen sichern.
--
-- Phase 2.39 pruefte participant_count + pending_count, sperrte den
-- invite-only-Raum dabei aber nicht. Zwei nahezu gleichzeitige Einladungen
-- konnten deshalb beide dieselbe freie Kapazitaet sehen. Ausserdem blieben
-- offene Einladungen beim Start der Talentphase formal gueltig.
--
-- Diese Migration ist additiv und wiederholbar. Sie aendert keine historischen
-- Raeume und fuehrt keine Buchung fuer Spieler aus.

begin;

do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (54, 55)
  ) then
    raise exception 'Phase 2.54 muss vor Phase 2.55 ausgefuehrt werden';
  end if;
end;
$$;

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
  where lower(player_name) = lower(target_name) and player_name <> '';
  if target_id is null then raise exception 'Spieler nicht gefunden'; end if;
  if target_id = uid then raise exception 'Du kannst dich nicht selbst einladen'; end if;

  select player_name into inviter_name from public.profiles where id = uid;
  if inviter_name is null or inviter_name = '' then
    raise exception 'Spielername fuer Einladungen fehlt';
  end if;

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
    ) and not exists (
      select 1 from public.duel_room_participants as p
      where p.room_code = r.code and p.player_index > 0
    );

  if exists (
    select 1 from public.duel_room_participants as p
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

  -- Kritischer Unterschied zu Phase 2.39: Der Raum bleibt bis zum Ende der
  -- Kapazitaetspruefung gesperrt. Annahmen sperren denselben Raum ebenfalls.
  select r.* into host_room
  from public.duel_rooms as r
  where r.host_profile_id = uid
    and r.expires_at > now()
    and r.start_at is null
    and r.invite_only
  order by r.created_at desc
  limit 1
  for update;

  if found then
    select count(*) into participant_count
    from public.duel_room_participants as p
    where p.room_code = host_room.code;
    select count(*) into pending_count
    from public.duel_invitations as i
    where i.room_code = host_room.code
      and i.status = 'pending' and i.expires_at > now();
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

create or replace function public.start_duel_talent_draft(
  p_code text,
  p_participant_token text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer := public.duel_participant_slot(p_code, p_participant_token);
  participant_count integer;
  started_at timestamptz;
begin
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;
  if slot <> 0 then raise exception 'Nur der Host darf die Talentphase starten'; end if;

  select r.* into room
  from public.duel_rooms as r
  where r.code = p_code and r.expires_at > now()
  for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.start_at is not null then raise exception 'Duell ist bereits gestartet'; end if;

  select count(*) into participant_count
  from public.duel_room_participants as p
  where p.room_code = p_code;
  if participant_count < 2 then raise exception 'Mindestens zwei Spieler benoetigt'; end if;

  started_at := coalesce(room.talent_draft_started_at, now());

  -- Ab diesem atomar gesperrten Raumzustand sind keine weiteren Beitritte
  -- oder Einladungsannahmen mehr vorgesehen. Bereits eingeladene Spieler
  -- sehen beim naechsten Listing einen eindeutigen Abschlussstatus.
  update public.duel_invitations
  set status = 'cancelled', responded_at = now()
  where room_code = p_code and status = 'pending';

  update public.duel_rooms as r
  set talent_draft_started_at = started_at
  where r.code = p_code;
  return started_at;
end;
$$;

revoke execute on function public.start_duel_talent_draft(text, text) from public, anon;
grant execute on function public.start_duel_talent_draft(text, text) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 55,
    migration_name = 'phase_2_55_duel_lobby_atomicity.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
