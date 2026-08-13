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
-- Eintraege sind unveraenderlich (kein UPDATE, kein DELETE), Spielstaende sind
-- nur mit Kenntnis ihrer zufaelligen ID erreichbar, und Sync-Codes verfallen.
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
  player_name  text        not null,
  world_id     text        not null,
  score        integer     not null,
  best_combo   integer     not null default 0,
  created_at   timestamptz not null default now(),

  -- Grenzen gegen offensichtlichen Unsinn. Kein Betrugsschutz, sondern
  -- Schutz vor kaputten Daten und vor Namen, die das Layout sprengen.
  constraint scores_name_length check (char_length(player_name) between 1 and 16),
  constraint scores_score_range check (score >= 0 and score <= 10000000),
  constraint scores_combo_range check (best_combo >= 0 and best_combo <= 10000)
);

-- Index fuer die gefilterte Bestenliste je Welt.
create index if not exists scores_world_rank_idx
  on public.scores (world_id, score desc, created_at asc);

-- Index fuer die gemeinsame Bestenliste ueber alle Welten.
create index if not exists scores_rank_idx
  on public.scores (score desc, created_at asc);

-- Lesen und Eintragen erlaubt, Aendern und Loeschen nicht - schon auf der
-- Rechteebene, unabhaengig von den Regeln darunter.
grant select, insert on public.scores to anon, authenticated;

alter table public.scores enable row level security;

drop policy if exists "Bestenliste ist oeffentlich lesbar" on public.scores;
create policy "Bestenliste ist oeffentlich lesbar"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "Jeder darf ein Ergebnis eintragen" on public.scores;
create policy "Jeder darf ein Ergebnis eintragen"
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- Bewusst KEINE update- oder delete-Regel: ohne sie verweigert RLS beides.
-- Ein eingetragenes Ergebnis ist damit unveraenderlich.

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
