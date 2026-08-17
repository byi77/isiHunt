-- Phase 2.11: Netzwerk-Duell - Raeume fuer synchronisierten Start ueber zwei
-- Geraete (ADR-0010 Schritt 2, "Echtzeit").
--
-- Nach schema.sql und allen frueheren phase_2_x-Skripten im Supabase SQL
-- Editor ausfuehren. Wiederholbar, loescht keine Daten.
--
-- ============================================================================
-- Was dieses Skript baut
-- ============================================================================
--
-- Zwei Geraete sollen gleichzeitig dieselbe 90-Sekunden-Runde spielen. Der
-- Seed sorgt schon heute (SpawnSystem) fuer identische Relikt-Reihenfolge -
-- was fehlt, ist die Verbindung der beiden Geraete: ein kurzlebiger Raum,
-- ueber den sie sich finden, "bereit" melden und eine gemeinsame Startzeit
-- erhalten.
--
-- Sicherheitsmodell konsistent mit phase_2_10_lock_saves_access.sql: keine
-- direkten Tabellenrechte fuer anon/authenticated, ausschliesslich
-- security-definer-RPCs. Zusaetzlich noetig fuer den laufenden Kanalbetrieb
-- (Score-Broadcast in Phase 2, Ready-Signale hier): eine RLS-Policy auf
-- `realtime.messages`, weil Realtime Broadcast/Presence ein eigener
-- Autorisierungsweg neben PostgREST ist. Kein Login noetig - Zugriff ist an
-- die Kenntnis des Raum-Codes gebunden, genau wie bei sync_codes.
--
-- ============================================================================
-- Warum eine eigene Tabelle statt sync_codes
-- ============================================================================
--
-- sync_codes ist fuer Spielstand-Merges gedacht (15 Minuten Gueltigkeit,
-- "vielleicht spaeter einloesen"). Ein Duell-Beitritt ist ein aktiver,
-- unmittelbarer Vorgang - kuerzere Gueltigkeit (10 Minuten), andere Felder
-- (Seed, Ready-Flags, Startzeit statt einer save_id).

begin;

-- ============================================================================
-- 1. Tabelle
-- ============================================================================

create table if not exists public.duel_rooms (
  code          text primary key,
  seed          text        not null,
  world_id      text        not null,
  host_ready    boolean     not null default false,
  guest_ready   boolean     not null default false,
  guest_joined  boolean     not null default false,
  start_at      timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '10 minutes',

  -- Deckungsgleich mit SYNC_CODE_ALPHABET in src/config/backend.ts:
  -- Ziffern und Grossbuchstaben ohne I, L und O.
  constraint duel_rooms_format check (code ~ '^[0-9A-HJKMNP-Z]{6}$')
);

create index if not exists duel_rooms_expiry_idx on public.duel_rooms (expires_at);

alter table public.duel_rooms enable row level security;

-- Bewusst KEINE Policy und KEIN GRANT fuer anon/authenticated: siehe
-- Kommentar oben. Ohne Policy verweigert RLS jeden direkten Zugriff; die
-- RPCs unten stellen den Zugang kontrolliert wieder her.

-- ============================================================================
-- 2. Raum erzeugen und beitreten
-- ============================================================================

create or replace function public.create_duel_room(
  p_world_id text,
  p_code     text,
  p_seed     text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_world_id is null or char_length(trim(p_world_id)) = 0 then
    raise exception 'Ungueltige Welt';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then
    raise exception 'Ungueltiges Code-Format';
  end if;
  if p_seed is null or char_length(trim(p_seed)) = 0 then
    raise exception 'Ungueltiger Seed';
  end if;

  insert into public.duel_rooms (code, seed, world_id) values (p_code, p_seed, p_world_id);
  return true;
end;
$$;

revoke execute on function public.create_duel_room(text, text, text) from public;
grant execute on function public.create_duel_room(text, text, text) to anon, authenticated;

-- Liefert Seed und Welt, damit der Gast dieselbe Runde spielt. Ein bereits
-- belegter Raum (zweiter Gast) wird abgewiesen - ein Raum ist fuer genau
-- zwei Spieler gedacht (Abschnitt "Bewusst nicht geloest": mehr als zwei
-- Spieler ist ausserhalb des Scopes).
create or replace function public.join_duel_room(p_code text)
returns table (
  seed     text,
  world_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
begin
  select * into room from public.duel_rooms where code = p_code and expires_at > now();
  if room is null then
    raise exception 'Raum nicht gefunden oder abgelaufen';
  end if;
  if room.guest_joined then
    raise exception 'Raum bereits voll';
  end if;

  update public.duel_rooms set guest_joined = true where code = p_code;
  return query select room.seed, room.world_id;
end;
$$;

revoke execute on function public.join_duel_room(text) from public;
grant execute on function public.join_duel_room(text) to anon, authenticated;

-- ============================================================================
-- 3. Bereit-Status und Startzeit
-- ============================================================================
--
-- Ready-Flags laufen ueber die Tabelle statt ueber Broadcast, weil sie
-- selten und persistent sind (ein Client, der kurz die Verbindung verliert,
-- kann den Stand per get_duel_room erneut abfragen - ein verpasster
-- Broadcast waere dagegen unwiederbringlich). Score-Updates waehrend des
-- Runs (Phase 2) laufen dagegen ueber Broadcast, weil sie haeufig und
-- kurzlebig sind - siehe Planungsnotiz zu diesem Feature.

create or replace function public.mark_duel_ready(
  p_code       text,
  p_is_host    boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.duel_rooms where code = p_code and expires_at > now()) then
    raise exception 'Raum nicht gefunden oder abgelaufen';
  end if;

  if p_is_host then
    update public.duel_rooms set host_ready = true where code = p_code;
  else
    update public.duel_rooms set guest_ready = true where code = p_code;
  end if;
  return true;
end;
$$;

revoke execute on function public.mark_duel_ready(text, boolean) from public;
grant execute on function public.mark_duel_ready(text, boolean) to anon, authenticated;

-- Serverseitige Zeit, nicht Client-Zeit - ein verzoegerter Client darf keine
-- falsche Startzeit einsetzen. 5 Sekunden Vorlauf sind grosszuegig genug
-- fuer normale Mobilfunklatenz und lassen beiden Spielern Zeit, das Handy
-- vom Bildschirm wegzunehmen.
create or replace function public.set_duel_start_time(p_code text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  room record;
  computed_start timestamptz;
begin
  select * into room from public.duel_rooms where code = p_code and expires_at > now();
  if room is null then
    raise exception 'Raum nicht gefunden oder abgelaufen';
  end if;
  if not room.host_ready or not room.guest_ready then
    raise exception 'Noch nicht beide Spieler bereit';
  end if;

  computed_start := now() + interval '5 seconds';
  update public.duel_rooms set start_at = computed_start where code = p_code;
  return computed_start;
end;
$$;

revoke execute on function public.set_duel_start_time(text) from public;
grant execute on function public.set_duel_start_time(text) to anon, authenticated;

-- Fuer den Fall, dass ein Client den Postgres-Changes-Broadcast der obigen
-- Funktion verpasst (kurzer Verbindungsabriss): Stand per erneutem Aufruf
-- nachholen, statt auf einen einmaligen Broadcast angewiesen zu sein.
create or replace function public.get_duel_room(p_code text)
returns table (
  seed         text,
  world_id     text,
  host_ready   boolean,
  guest_ready  boolean,
  guest_joined boolean,
  start_at     timestamptz
)
language sql
security definer
set search_path = public
as $$
  select seed, world_id, host_ready, guest_ready, guest_joined, start_at
  from public.duel_rooms
  where code = p_code and expires_at > now();
$$;

revoke execute on function public.get_duel_room(text) from public;
grant execute on function public.get_duel_room(text) to anon, authenticated;

-- Liefert die Serverzeit fuer die client-seitige Uhr-Offset-Messung
-- (NetworkDuelSystem.measureClockOffset). Ohne diese Funktion liesse sich nur
-- die Roundtrip-Zeit einer beliebigen RPC messen, nicht der tatsaechliche
-- Versatz zwischen Client- und Serveruhr - eine reine Latenzmessung waere
-- keine Uhr-Synchronisation.
create or replace function public.get_server_time()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  select now();
$$;

grant execute on function public.get_server_time() to anon, authenticated;

-- Abgelaufene Raeume aufraeumen, gleiches Muster wie purge_expired_sync_codes.
create or replace function public.purge_expired_duel_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.duel_rooms where expires_at < now();
$$;

grant execute on function public.purge_expired_duel_rooms() to anon, authenticated;

-- ============================================================================
-- 4. Realtime-Autorisierung fuer den Duell-Kanal
-- ============================================================================
--
-- Ohne diese Policy verweigert Realtime jedem anon-Client den Beitritt zu
-- einem privaten Kanal (private: true im Client-Config). Der Kanalname
-- (Topic) ist direkt der Raum-Code - kein Praefix, weil Sonderzeichen im
-- Topic-Namen laut Supabase-Doku nicht dokumentiert sind und die Vermeidung
-- einfacher ist als das Risiko einzugehen. Zugriff ist an die Kenntnis des
-- Codes gebunden, kein Login noetig - konsistent mit dem Rest des Projekts
-- (ADR-0011, "keine Anmeldung noetig").

drop policy if exists "Duell-Raum-Teilnehmer duerfen den Kanal nutzen" on "realtime"."messages";
create policy "Duell-Raum-Teilnehmer duerfen den Kanal nutzen"
  on "realtime"."messages"
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duel_rooms
      where code = (select realtime.topic())
        and expires_at > now()
    )
    and realtime.messages.extension = 'broadcast'
  );

commit;

notify pgrst, 'reload schema';
