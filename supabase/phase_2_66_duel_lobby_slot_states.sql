-- Phase 2.66: Vier eindeutige serverautoritative Lobby-Slotzustände.
-- Offene Einladungen reservieren bereits Kapazität; hier werden sie
-- deterministisch auf die niedrigsten freien Slots abgebildet.

begin;

do $$
begin
  if not exists (
    select 1 from public.isihunt_schema_state
    where singleton = true and schema_version in (65, 66)
  ) then
    raise exception 'Phase 2.65 muss vor Phase 2.66 ausgefuehrt werden';
  end if;
end;
$$;

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
      with free_slots as (
        select slots.player_index,
               row_number() over (order by slots.player_index) as free_rank
        from generate_series(0, room.max_players - 1) as slots(player_index)
        left join public.duel_room_participants as occupied
          on occupied.room_code = room.code
         and occupied.player_index = slots.player_index
        where occupied.player_index is null
      ), pending_slots as (
        select i.invitee_id,
               row_number() over (order by i.created_at, i.id) as pending_rank
        from public.duel_invitations as i
        where i.room_code = room.code
          and i.status = 'pending'
          and i.expires_at > now()
      )
      select jsonb_agg(jsonb_build_object(
        'index', slots.player_index,
        'state', case
          when occupied.player_index is not null and occupied.talent_ready then 'ready'
          when occupied.player_index is not null then 'connected'
          when pending.invitee_id is not null then 'invited'
          else 'free'
        end,
        'playerName', case
          when occupied.player_index is not null then occupied_profile.player_name
          when pending.invitee_id is not null then invited_profile.player_name
          else null
        end,
        'talentReady', coalesce(occupied.talent_ready, false)
      ) order by slots.player_index)
      from generate_series(0, room.max_players - 1) as slots(player_index)
      left join public.duel_room_participants as occupied
        on occupied.room_code = room.code
       and occupied.player_index = slots.player_index
      left join free_slots
        on free_slots.player_index = slots.player_index
      left join pending_slots as pending
        on pending.pending_rank = free_slots.free_rank
      left join public.profiles as occupied_profile
        on occupied_profile.id = occupied.profile_id
      left join public.profiles as invited_profile
        on invited_profile.id = pending.invitee_id
    ), '[]'::jsonb),
    'pendingInvitations', case when local_slot = 0 then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'inviteeName', p.player_name,
        'expiresAt', i.expires_at
      ) order by i.created_at, i.id)
      from public.duel_invitations as i
      join public.profiles as p on p.id = i.invitee_id
      where i.room_code = room.code and i.status = 'pending'
        and i.expires_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke execute on function public.get_duel_lobby_state(text, text)
  from public, anon;
grant execute on function public.get_duel_lobby_state(text, text) to authenticated;

update public.isihunt_schema_state
set schema_version = 66,
    migration_name = 'phase_2_66_duel_lobby_slot_states.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
