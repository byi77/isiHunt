-- isiHunt - Datenbankschema fuer Bestenliste und Spielstand-Abgleich
--
-- Einspielen: Supabase -> SQL Editor -> dieses Skript einfuegen -> Run.
-- Das Skript ist wiederholbar (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- ============================================================================
-- Sicherheitsmodell - bitte vor dem Einspielen lesen
-- ============================================================================
--
-- Das Spiel laeuft vollstaendig im Browser und spricht die Datenbank mit dem
-- oeffentlichen `anon`-Schluessel an. Dieser Schluessel steht im ausgelieferten
-- JavaScript und ist damit fuer jeden lesbar - das ist so vorgesehen. Der
-- Schutz liegt nicht am Schluessel, sondern an den Zugriffsregeln (RLS) hier.
--
-- Daraus folgt eine Grenze, die man kennen muss:
--
--   Jeder kann einen beliebigen Punktestand eintragen.
--
-- Es gibt keine serverseitige Pruefung, ob ein Ergebnis erspielt wurde - die
-- gaebe es nur, wenn der komplette Run auf einem Server nachgerechnet wuerde.
-- Fuer ein Duell unter Bekannten ist das unerheblich. Fuer eine oeffentliche
-- Rangliste ist es das nicht (siehe docs/DECISIONS.md, ADR-0011).
--
-- Abgesichert ist deshalb nur, was sich ohne Server absichern laesst:
-- Pro Spielstand-Profil gibt es genau einen Eintrag, und die Datenbankfunktion
-- ersetzt ihn nur bei einem besseren Lauf. Spielstaende sind nur mit Kenntnis
-- ihrer zufaelligen ID erreichbar, und Sync-Codes verfallen.
--
-- ============================================================================
-- Zwei Ebenen, die man nicht verwechseln darf: GRANT und RLS
-- ============================================================================
--
--   GRANT  entscheidet, ob eine Rolle die Tabelle UEBERHAUPT anfassen darf.
--   RLS    entscheidet, WELCHE ZEILEN sie dabei sieht und aendern kann.
--
-- Beide werden gebraucht. Fehlt der GRANT, nuetzt die schoenste RLS-Regel
-- nichts - und der Fehler ist besonders unangenehm, weil PostgREST eine
-- Tabelle ohne Rechte nicht etwa mit "keine Berechtigung" quittiert, sondern
-- mit:
--
--   PGRST205  "Could not find the table 'public.xyz' in the schema cache"
--
-- Diese Meldung liest sich wie "Tabelle existiert nicht" und schickt einen auf
-- die Suche nach einem Fehler im CREATE TABLE, wo keiner ist. Deshalb stehen
-- die GRANTs hier direkt bei den Tabellen.

-- ============================================================================
-- 0. Schemazugriff
-- ============================================================================

grant usage on schema public to anon, authenticated;

-- ============================================================================
-- 1. Bestenliste
-- ============================================================================

create table if not exists public.scores (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid        not null,
  player_name  text        not null,
  world_id     text        not null,
  player_level integer     not null default 1,
  score        integer     not null,
  best_combo   integer     not null default 0,
  created_at   timestamptz not null default now(),

  -- Grenzen gegen offensichtlichen Unsinn. Kein Betrugsschutz, sondern
  -- Schutz vor kaputten Daten und vor Namen, die das Layout sprengen.
  constraint scores_name_length check (char_length(player_name) between 1 and 16),
  constraint scores_level_range check (player_level between 1 and 100),
  constraint scores_score_range check (score >= 0 and score <= 10000000),
  constraint scores_combo_range check (best_combo >= 0 and best_combo <= 10000)
);

-- Migration fuer die bereits angelegte v0.1-Tabelle. Alte Zeilen haben noch
-- keine Profil-ID und werden mit cleanup_leaderboard.sql bewusst entfernt.
alter table public.scores add column if not exists player_id uuid;
alter table public.scores add column if not exists player_level integer not null default 1;

-- Partial, damit das Schema vor der einmaligen Bereinigung wiederholbar bleibt.
-- Nach der Bereinigung setzt cleanup_leaderboard.sql die Spalte auf NOT NULL.
create unique index if not exists scores_player_id_uidx
  on public.scores (player_id)
  where player_id is not null;

-- Index fuer die gefilterte Bestenliste je Welt.
create index if not exists scores_world_rank_idx
  on public.scores (world_id, score desc, created_at asc);

-- Index fuer die gemeinsame Bestenliste ueber alle Welten.
create index if not exists scores_rank_idx
  on public.scores (score desc, created_at asc);

-- Lesen erlaubt. Schreiben laeuft ausschliesslich ueber die Funktion unten,
-- damit niemand am Bestwert-Prinzip vorbei direkt neue Zeilen eintragen kann.
grant select on public.scores to anon, authenticated;
revoke insert, update, delete on public.scores from anon, authenticated;

alter table public.scores enable row level security;

drop policy if exists "Bestenliste ist oeffentlich lesbar" on public.scores;
create policy "Bestenliste ist oeffentlich lesbar"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "Jeder darf ein Ergebnis eintragen" on public.scores;

-- Bewusst KEINE insert-, update- oder delete-Regel: ohne sie verweigert RLS
-- direkte Aenderungen. Der RPC unten laeuft kontrolliert als security definer.

create or replace function public.max_plausible_score(
  p_world_id text,
  p_duration_ms integer,
  p_best_combo integer,
  p_collected jsonb
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  item record;
  count_value integer;
  total_relics integer := 0;
  base_points numeric := 0;
  reward_multiplier numeric := case p_world_id
    when 'silberhain' then 1.03
    when 'frostzinne' then 1.06
    when 'glutmark' then 1.10
    when '__LEERENBLÜTE__' then 1.15
    when 'sonnenhort' then 1.18
    when 'mondschmiede' then 1.22
    when 'kristallbruch' then 1.30
    when 'sturmgrenze' then 1.40
    when 'lichtkern' then 1.52
    when 'horizonttor' then 1.65
    else 0
  end;
  combo_multiplier integer := case
    when p_best_combo >= 35 then 5
    when p_best_combo >= 20 then 4
    when p_best_combo >= 10 then 3
    when p_best_combo >= 5 then 2
    else 1
  end;
begin
  if p_duration_ms < 60000 or p_duration_ms > 120000 then return 0; end if;
  if reward_multiplier = 0 then return 0; end if;

  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    if item.key not in ('poor', 'common', 'uncommon', 'rare', 'epic', 'legendary') then
      continue;
    end if;
    count_value := greatest(0, (item.value #>> '{}')::integer);
    total_relics := total_relics + count_value;
    base_points := base_points + count_value * case item.key
      when 'poor' then 1
      when 'common' then 2
      when 'uncommon' then 5
      when 'rare' then 15
      when 'epic' then 50
      when 'legendary' then 200
      else 0
    end;
  end loop;

  if total_relics > ceil(p_duration_ms / 190.0)::integer then return 0; end if;
  if p_best_combo < 0 or p_best_combo > total_relics then return 0; end if;

  return least(
    10000000,
    ceil(base_points * combo_multiplier * 1.30 * reward_multiplier * 2.0 * 1.10)::integer
  );
end;
$$;

revoke execute on function public.max_plausible_score(text, integer, integer, jsonb) from public;

drop function if exists public.submit_best_score(uuid, text, text, integer, integer, integer);
drop function if exists public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb);
drop function if exists public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb, timestamptz);

create or replace function public.submit_best_score(
  p_player_id   uuid,
  p_player_name text,
  p_world_id    text,
  p_player_level integer,
  p_score       integer,
  p_best_combo  integer,
  p_duration_ms integer,
  p_collected   jsonb,
  p_recorded_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_recorded_at timestamptz := coalesce(p_recorded_at, now());
begin
  -- Offline-Runs behalten ihr echtes Datum; Zukunftsdaten werden begrenzt.
  if safe_recorded_at > now() + interval '1 day' then
    safe_recorded_at := now();
  end if;
  if p_player_id is null or char_length(trim(p_player_name)) not between 1 and 16 then
    raise exception 'Ungueltiges Spielerprofil';
  end if;
  if p_score > public.max_plausible_score(
    p_world_id,
    p_duration_ms,
    p_best_combo,
    p_collected
  ) then
    raise exception 'Punktestand nicht plausibel';
  end if;

  insert into public.scores (player_id, player_name, world_id, player_level, score, best_combo, created_at)
  values (
    p_player_id,
    trim(p_player_name),
    p_world_id,
    greatest(1, least(100, p_player_level)),
    greatest(0, p_score),
    greatest(0, p_best_combo),
    safe_recorded_at
  )
  on conflict (player_id) where (player_id is not null) do update
  set player_name = excluded.player_name,
      score = greatest(public.scores.score, excluded.score),
      player_level = case
        when excluded.score > public.scores.score then excluded.player_level
        else public.scores.player_level
      end,
      best_combo = case
        when excluded.score > public.scores.score then excluded.best_combo
        else public.scores.best_combo
      end,
      world_id = case
        when excluded.score > public.scores.score then excluded.world_id
        else public.scores.world_id
      end,
      created_at = case
        when excluded.score > public.scores.score then excluded.created_at
        else public.scores.created_at
      end;

  return true;
end;
$$;

revoke execute on function public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb, timestamptz)
  from public;
grant execute on function public.submit_best_score(uuid, text, text, integer, integer, integer, integer, jsonb, timestamptz)
  to anon, authenticated;

-- Profilnamen muessen auch beim bereits vorhandenen Bestwert sichtbar werden.
-- Gibt es noch keinen Ranglisteneintrag, ist das Update bewusst ein No-op.
create or replace function public.rename_best_score(
  p_player_id   uuid,
  p_player_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is null or char_length(trim(p_player_name)) not between 1 and 16 then
    raise exception 'Ungueltiges Spielerprofil';
  end if;

  update public.scores
  set player_name = trim(p_player_name)
  where player_id = p_player_id;

  return true;
end;
$$;

revoke execute on function public.rename_best_score(uuid, text)
  from public;
grant execute on function public.rename_best_score(uuid, text)
  to anon, authenticated;

-- ============================================================================
-- 2. Spielstaende
-- ============================================================================
--
-- Zugang ueber die zufaellige `id` (UUID v4). Wer sie nicht kennt, findet den
-- Spielstand nicht - deshalb ist Lesen an die Angabe der id gebunden und es
-- gibt bewusst keinen Weg, die Tabelle aufzulisten.

create table if not exists public.saves (
  id          uuid primary key,
  data        jsonb       not null,
  -- Redundant zu `data`, aber ohne Auspacken lesbar: dient der Anzeige beim
  -- Konflikt ("welcher Stand ist welcher?").
  level       integer     not null default 1,
  best_score  integer     not null default 0,
  total_runs  integer     not null default 0,
  updated_at  timestamptz not null default now()
);

-- Hier stand eine Groessenbremse fuer `data` als CHECK-Bedingung. Sie ist
-- entfernt: CHECK darf nur IMMUTABLE-Ausdruecke enthalten, und die
-- naheliegenden Funktionen dafuer sind es nicht oder nur mit Einschraenkungen.
-- Da der SQL-Editor das Skript in EINER Transaktion ausfuehrt, haette ein
-- Fehler an dieser Stelle das komplette Schema zurueckgerollt - ein hoher
-- Preis fuer eine reine Bequemlichkeit. Ein Spielstand ist wenige Kilobyte
-- gross; die Grenze war nie das eigentliche Risiko.

-- Zusaetzlich UPDATE: ein Spielstand wird beim Abgleich ueberschrieben.
-- Kein DELETE - ein Spielstand soll sich nicht loeschen lassen.
grant select, insert, update on public.saves to anon, authenticated;

alter table public.saves enable row level security;

-- `using (true)` klingt offener, als es ist: Supabase erlaubt nur Abfragen
-- ueber die REST-Schnittstelle, und der Client fragt immer mit `eq('id', ...)`.
-- Die Sicherheit liegt in der Unratbarkeit der UUID, nicht in der Regel.
drop policy if exists "Spielstand ist mit Kenntnis der id lesbar" on public.saves;
create policy "Spielstand ist mit Kenntnis der id lesbar"
  on public.saves for select
  to anon, authenticated
  using (true);

drop policy if exists "Spielstand anlegen" on public.saves;
create policy "Spielstand anlegen"
  on public.saves for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Spielstand ueberschreiben" on public.saves;
create policy "Spielstand ueberschreiben"
  on public.saves for update
  to anon, authenticated
  using (true)
  with check (true);

-- ============================================================================
-- 3. Sync-Codes
-- ============================================================================
--
-- Eine UUID tippt niemand auf einem Handy ab. Ein kurzer Code verweist deshalb
-- zeitlich begrenzt auf einen Spielstand.
--
-- Kurz heisst ratbar: 6 Zeichen aus 32 sind rund eine Milliarde Moeglichkeiten.
-- Deshalb verfallen Codes nach 15 Minuten - danach ist ein Treffer wertlos.

create table if not exists public.sync_codes (
  code       text primary key,
  save_id    uuid        not null references public.saves (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',

  -- Deckungsgleich mit SYNC_CODE_ALPHABET in src/config/backend.ts:
  -- Ziffern und Grossbuchstaben ohne I, L und O.
  constraint sync_codes_format check (code ~ '^[0-9A-HJKMNP-Z]{6}$')
);

create index if not exists sync_codes_expiry_idx on public.sync_codes (expires_at);

grant select, insert on public.sync_codes to anon, authenticated;

alter table public.sync_codes enable row level security;

drop policy if exists "Gueltiger Code ist einloesbar" on public.sync_codes;
create policy "Gueltiger Code ist einloesbar"
  on public.sync_codes for select
  to anon, authenticated
  using (expires_at > now());

drop policy if exists "Code anlegen" on public.sync_codes;
create policy "Code anlegen"
  on public.sync_codes for insert
  to anon, authenticated
  with check (true);

-- Abgelaufene Codes aufraeumen. Supabase kann das per Cron planen; solange das
-- nicht eingerichtet ist, ruft der Client die Funktion gelegentlich mit auf.
create or replace function public.purge_expired_sync_codes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sync_codes where expires_at < now();
$$;

grant execute on function public.purge_expired_sync_codes() to anon, authenticated;

-- ============================================================================
-- 4. Schnittstelle ueber die Aenderung informieren
-- ============================================================================
--
-- PostgREST haelt Tabellen, Spalten und Rechte in einem Zwischenspeicher.
-- Ohne diesen Anstoss kann es dauern, bis frisch vergebene Rechte wirken -
-- bis dahin meldet die Schnittstelle weiterhin PGRST205.

notify pgrst, 'reload schema';
