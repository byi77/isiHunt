-- Phase 2.31: Server-Seed fuer Duelle, Ergebnisvalidierung und
-- serverseitiger Nachweis fuer eingeloggte Bestenlistenwerte.

begin;

-- ============================================================================
-- 1. Duell-Seed kommt aus dem Server
-- ============================================================================

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
  participant_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  server_seed text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if p_world_id is null or not (public.balance_config()->'worlds' ? p_world_id) then
    raise exception 'Ungueltige Welt';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then
    raise exception 'Ungueltiges Code-Format';
  end if;
  if p_seed is null or char_length(trim(p_seed)) = 0 or char_length(p_seed) > 128 then
    raise exception 'Ungueltiger Seed';
  end if;

  insert into public.duel_rooms (code, seed, world_id, host_token_hash)
  values (p_code, server_seed, p_world_id, md5(participant_token));

  -- Text bleibt der Rueckgabetyp fuer alte Clients; neue Clients lesen das
  -- JSON und verwenden den Server-Seed statt ihres lokalen Vorschlags.
  return jsonb_build_object(
    'participantToken', participant_token,
    'seed', server_seed
  )::text;
end;
$$;

revoke execute on function public.create_duel_room(text, text, text) from public;
grant execute on function public.create_duel_room(text, text, text) to anon, authenticated;

-- ============================================================================
-- 2. Duell-Ergebnisse an Startzeit und plausible Statistik binden
-- ============================================================================

drop function if exists public.submit_duel_result(text, text, jsonb);
create or replace function public.submit_duel_result(
  p_code text,
  p_participant_token text,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  slot integer;
  safe_score numeric;
  safe_combo numeric;
  safe_collected numeric;
  collected_total numeric := 0;
  safe_duration integer := 90000;
  safe_collected_data jsonb;
  item record;
begin
  select public.duel_participant_slot(p_code, p_participant_token) into slot;
  if slot is null then raise exception 'Duell-Teilnehmer nicht autorisiert'; end if;

  select * into room
  from public.duel_rooms
  where code = p_code and expires_at > now()
  for update;
  if room is null then raise exception 'Duell nicht gefunden oder abgelaufen'; end if;
  if room.start_at is null or now() < room.start_at then
    raise exception 'Duell noch nicht gestartet';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Ungueltiges Ergebnisformat';
  end if;
  if pg_column_size(p_result) > 8192 then
    raise exception 'Ergebnis zu gross';
  end if;
  if jsonb_typeof(p_result->'score') <> 'number'
     or jsonb_typeof(p_result->'bestCombo') <> 'number'
     or jsonb_typeof(p_result->'totalCollected') <> 'number' then
    raise exception 'Ergebnis unvollstaendig';
  end if;

  safe_score := (p_result->>'score')::numeric;
  safe_combo := (p_result->>'bestCombo')::numeric;
  safe_collected := (p_result->>'totalCollected')::numeric;
  if safe_score <> trunc(safe_score)
     or safe_combo <> trunc(safe_combo)
     or safe_collected <> trunc(safe_collected)
     or safe_score < 0 or safe_score > 10000000
     or safe_combo < 0 or safe_collected < 0 then
    raise exception 'Ergebnis ausserhalb des Wertebereichs';
  end if;

  if p_result ? 'durationMs' then
    if jsonb_typeof(p_result->'durationMs') <> 'number'
       or (p_result->>'durationMs')::numeric <> trunc((p_result->>'durationMs')::numeric) then
      raise exception 'Ungueltige Rundendauer';
    end if;
    safe_duration := (p_result->>'durationMs')::integer;
  end if;
  if safe_duration < 60000 or safe_duration > 120000 then
    raise exception 'Ungueltige Rundendauer';
  end if;
  if safe_collected > ceil(safe_duration / 190.0)
     or safe_combo > safe_collected then
    raise exception 'Ergebnis nicht plausibel';
  end if;

  if p_result ? 'collected' then
    if jsonb_typeof(p_result->'collected') <> 'object' then
      raise exception 'Ungueltige Reliktstatistik';
    end if;
    safe_collected_data := p_result->'collected';
  else
    -- Kompatibilitaet mit alten Clients: die konservative Obergrenze nimmt
    -- an, dass alle Relikte legendär waren.
    safe_collected_data := jsonb_build_object('legendary', safe_collected::integer);
  end if;

  for item in select key, value from jsonb_each(safe_collected_data) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary')
       or jsonb_typeof(item.value) <> 'number'
       or (item.value #>> '{}')::numeric < 0
       or (item.value #>> '{}')::numeric <> trunc((item.value #>> '{}')::numeric) then
      raise exception 'Ungueltige Reliktstatistik';
    end if;
    collected_total := collected_total + (item.value #>> '{}')::numeric;
  end loop;
  if collected_total <> safe_collected then
    raise exception 'Reliktstatistik passt nicht zum Ergebnis';
  end if;
  if safe_score > public.max_plausible_score(
    room.world_id, safe_duration, safe_combo::integer, safe_collected_data
  ) then
    raise exception 'Ergebnis nicht plausibel';
  end if;

  if slot = 0 then
    update public.duel_rooms set host_result = coalesce(host_result, p_result)
    where code = p_code;
  else
    update public.duel_rooms set guest_result = coalesce(guest_result, p_result)
    where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.submit_duel_result(text, text, jsonb) from public;
grant execute on function public.submit_duel_result(text, text, jsonb) to anon, authenticated;

-- ============================================================================
-- 3. Eingeloggte Bestenlistenwerte muessen ein akzeptiertes Event haben
-- ============================================================================

create or replace function public.enforce_authenticated_score_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or new.player_id <> uid then return new; end if;
  if tg_op = 'UPDATE'
     and new.score <= old.score
     and new.best_combo = old.best_combo
     and new.world_id = old.world_id then
    return new;
  end if;
  if not exists (
    select 1
    from public.profile_progress_events
    where profile_id = uid
      and world_id = new.world_id
      and score >= new.score
      and best_combo >= new.best_combo
  ) then
    raise exception 'Bestwert braucht ein bestaetigtes Laufereignis';
  end if;
  return new;
end;
$$;

drop trigger if exists authenticated_score_evidence on public.scores;
create trigger authenticated_score_evidence
before insert or update on public.scores
for each row execute function public.enforce_authenticated_score_evidence();
revoke execute on function public.enforce_authenticated_score_evidence() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
