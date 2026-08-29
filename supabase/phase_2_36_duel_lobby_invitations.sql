-- Phase 2.36: eingeloggte Duell-Lobby und direkte Einladungen.
--
-- Presence ist nur fuer den fluechtigen "wer ist gerade duellbereit?"-Stand
-- zustaendig. Die Einladung selbst liegt dauerhaft genug in der Datenbank,
-- damit ein verpasstes Realtime-Ereignis oder ein kurzer reconnect keinen
-- Duellstart verschluckt.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 35
     ) then
    raise exception 'Phase 2.35 muss vor Phase 2.36 ausgefuehrt werden';
  end if;
end;
$$;

-- Bestehende Code-Raeume bleiben anonym nutzbar. Nur Einladungsraeume tragen
-- zusaetzlich die authentifizierten Profile; dadurch kann der alte Code-Pfad
-- unveraendert weiterlaufen.
alter table public.duel_rooms
  add column if not exists host_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists guest_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists invited_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists invite_only boolean not null default false;

-- Auch normale Code-Raeume merken bei eingeloggten Spielern die Profile. Das
-- verhindert, dass ein bereits laufendes Code-Duell parallel eine Einladung
-- annimmt; anonyme Raeume bleiben weiterhin voll kompatibel.
drop function if exists public.create_duel_room(text, text, text);
create or replace function public.create_duel_room(
  p_world_id text,
  p_code text,
  p_seed text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_id uuid;
  participant_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  server_seed text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if p_world_id is null or not (public.balance_config()->'worlds' ? p_world_id) then
    raise exception 'Ungueltige Welt';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then raise exception 'Ungueltiges Code-Format'; end if;
  if p_seed is null or char_length(trim(p_seed)) = 0 or char_length(p_seed) > 128 then
    raise exception 'Ungueltiger Seed';
  end if;

  select id into profile_id from public.profiles where id = uid;
  insert into public.duel_rooms (code, seed, world_id, host_token_hash, host_profile_id)
  values (p_code, server_seed, p_world_id, md5(participant_token), profile_id);
  return jsonb_build_object(
    'participantToken', participant_token,
    'seed', server_seed
  )::text;
end;
$$;

revoke execute on function public.create_duel_room(text, text, text) from public;
grant execute on function public.create_duel_room(text, text, text) to anon, authenticated;

create index if not exists duel_rooms_host_profile_active_idx
  on public.duel_rooms (host_profile_id, expires_at);

create index if not exists duel_rooms_guest_profile_active_idx
  on public.duel_rooms (guest_profile_id, expires_at);

create table if not exists public.duel_invitations (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null references public.duel_rooms (code) on delete cascade,
  inviter_id  uuid not null references public.profiles (id) on delete cascade,
  invitee_id  uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 seconds',
  responded_at timestamptz,
  constraint duel_invitations_distinct_players check (inviter_id <> invitee_id)
);

create unique index if not exists duel_invitations_room_uidx
  on public.duel_invitations (room_code);

create unique index if not exists duel_invitations_one_pending_invitee_uidx
  on public.duel_invitations (invitee_id)
  where status = 'pending';

create unique index if not exists duel_invitations_one_pending_inviter_uidx
  on public.duel_invitations (inviter_id)
  where status = 'pending';

create index if not exists duel_invitations_invitee_pending_idx
  on public.duel_invitations (invitee_id, status, expires_at);

alter table public.duel_invitations enable row level security;
revoke all on public.duel_invitations from anon, authenticated;

-- Realtime-Presence fuer die globale Duell-Lobby. Es werden keine Profil- oder
-- Kontodaten aus der Tabelle gelesen; der Client uebertraegt nur den sichtbaren
-- Namen und den fluechtigen Bereitschaftsstatus. Die eigentliche Einladung
-- prueft ihren Empfaenger immer erneut ueber auth.uid().
drop policy if exists "Eingeloggte duerfen die Duell-Lobby nutzen" on "realtime"."messages";
create policy "Eingeloggte duerfen die Duell-Lobby nutzen"
  on "realtime"."messages"
  for select
  to authenticated
  using (
    (select realtime.topic()) = 'duel-lobby'
    and realtime.messages.extension in ('broadcast', 'presence')
  );

drop policy if exists "Eingeloggte duerfen in der Duell-Lobby senden" on "realtime"."messages";
create policy "Eingeloggte duerfen in der Duell-Lobby senden"
  on "realtime"."messages"
  for insert
  to authenticated
  with check (
    (select realtime.topic()) = 'duel-lobby'
    and realtime.messages.extension in ('broadcast', 'presence')
  );

-- Serverseitiger Raum- und Einladungserzeuger. Der Client liefert Welt und
-- Zielnamen, aber weder Seed noch Teilnehmer-Token als vertrauenswuerdige
-- Werte. Der Raum ist bis zur Annahme invite-only und kann daher nicht ueber
-- den normalen Code-Pfad vorzeitig uebernommen werden.
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
  room_code text;
  server_seed text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  host_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  inviter_name text;
  invitation_id uuid := gen_random_uuid();
  invitation_expires_at timestamptz := now() + interval '90 seconds';
  code_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code_attempt integer;
  code_character integer;
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

  update public.duel_invitations
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at <= now()
    and (inviter_id = uid or invitee_id = uid or invitee_id = target_id);
  update public.duel_rooms as r
  set expires_at = least(r.expires_at, now())
  from public.duel_invitations as i
  where i.room_code = r.code and i.status = 'expired'
    and r.guest_joined = false and r.invite_only;

  if exists (
    select 1 from public.duel_rooms
    where expires_at > now()
      and (
        host_profile_id = uid or guest_profile_id = uid
        or (invite_only and invited_profile_id = uid)
      )
  ) then
    raise exception 'Du bist bereits in einem aktiven Duell';
  end if;

  if exists (
    select 1 from public.duel_rooms
    where expires_at > now()
      and (
        host_profile_id = target_id or guest_profile_id = target_id
        or (invite_only and invited_profile_id = target_id)
      )
  ) then
    raise exception 'Spieler ist bereits in einem Duell';
  end if;

  if exists (
    select 1 from public.duel_invitations
    where status = 'pending' and expires_at > now()
      and (inviter_id = uid or invitee_id = target_id)
  ) then
    raise exception 'Es gibt bereits eine offene Duell-Einladung';
  end if;

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
        code, seed, world_id, host_token_hash, host_profile_id,
        invited_profile_id, invite_only
      ) values (
        room_code, server_seed, p_world_id, md5(host_token), uid,
        target_id, true
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

  insert into public.duel_invitations (
    id, room_code, inviter_id, invitee_id, expires_at
  ) values (
    invitation_id, room_code, uid, target_id, invitation_expires_at
  );

  return jsonb_build_object(
    'invitationId', invitation_id,
    'inviterName', inviter_name,
    'code', room_code,
    'seed', server_seed,
    'worldId', p_world_id,
    'participantToken', host_token,
    'expiresAt', invitation_expires_at
  );
end;
$$;

revoke execute on function public.create_duel_invitation(text, text) from public, anon;
grant execute on function public.create_duel_invitation(text, text) to authenticated;

-- Nur eigene offenen Einladungen werden sichtbar. Der Anzeigename kommt aus
-- dem Profil, nicht aus dem Realtime-Payload.
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
    and i.status = 'expired' and r.guest_joined = false and r.invite_only;

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

-- Der einzige Weg, einen invite-only Raum als Gast zu betreten. Der Token
-- wird nur dem an auth.uid() gebundenen Empfaenger ausgegeben.
create or replace function public.accept_duel_invitation(p_invitation_id uuid)
returns table (
  code text,
  seed text,
  world_id text,
  participant_token text,
  match_number integer
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
    update public.duel_rooms
    set expires_at = least(expires_at, now())
    where code = invitation.room_code and guest_joined = false;
    raise exception 'Einladung abgelaufen';
  end if;

  if exists (
    select 1 from public.duel_rooms
    where expires_at > now()
      and (host_profile_id = uid or guest_profile_id = uid)
  ) then
    raise exception 'Du bist bereits in einem aktiven Duell';
  end if;

  select * into room
  from public.duel_rooms
  where code = invitation.room_code and expires_at > now()
  for update;
  if room is null or not room.invite_only or room.invited_profile_id <> uid
     or room.guest_joined or room.guest_token_hash is not null then
    raise exception 'Duellraum ist nicht mehr verfuegbar';
  end if;

  update public.duel_rooms
  set guest_joined = true,
      guest_token_hash = md5(guest_token),
      guest_profile_id = uid,
      invite_only = false
  where public.duel_rooms.code = invitation.room_code;

  update public.duel_invitations
  set status = 'accepted', responded_at = now()
  where id = invitation.id;

  return query select room.code, room.seed, room.world_id, guest_token, room.match_number;
end;
$$;

revoke execute on function public.accept_duel_invitation(uuid) from public, anon;
grant execute on function public.accept_duel_invitation(uuid) to authenticated;

-- Der bisherige Code-Beitritt bleibt fuer normale Raeume unveraendert, darf
-- einen invite-only Raum aber nicht durch Erraten des sechsstelligen Codes
-- umgehen.
drop function if exists public.join_duel_room(text);
create or replace function public.join_duel_room(p_code text)
returns table (
  seed text,
  world_id text,
  participant_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
  guest_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  select * into room
  from public.duel_rooms
  where code = p_code and expires_at > now()
  for update;
  if room is null then raise exception 'Raum nicht gefunden oder abgelaufen'; end if;
  if room.invite_only then raise exception 'Dieser Raum ist nur ueber eine Einladung zugaenglich'; end if;
  if room.guest_joined or room.guest_token_hash is not null then
    raise exception 'Raum bereits voll';
  end if;

  update public.duel_rooms
  set guest_joined = true, guest_token_hash = md5(guest_token), guest_profile_id =
    case when exists (select 1 from public.profiles where id = uid) then uid else null end
  where code = p_code;
  return query select room.seed, room.world_id, guest_token;
end;
$$;

revoke execute on function public.join_duel_room(text) from public;
grant execute on function public.join_duel_room(text) to anon, authenticated;

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
  update public.duel_rooms
  set expires_at = least(expires_at, now())
  where code = invitation_room_code and guest_joined = false;
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
  update public.duel_rooms
  set expires_at = least(expires_at, now())
  where code = invitation_room_code and guest_joined = false;
  return true;
end;
$$;

revoke execute on function public.cancel_duel_invitation(uuid) from public, anon;
grant execute on function public.cancel_duel_invitation(uuid) to authenticated;

update public.isihunt_schema_state
set schema_version = 36,
    migration_name = 'phase_2_36_duel_lobby_invitations.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
