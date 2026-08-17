-- Phase 2.10: Direkten Tabellenzugriff auf saves und sync_codes schliessen.
--
-- Nach schema.sql (und allen frueheren phase_2_x-Skripten) im Supabase
-- SQL Editor ausfuehren. Wiederholbar, loescht keine Daten.
--
-- ============================================================================
-- Warum diese Migration noetig ist
-- ============================================================================
--
-- `saves` und `sync_codes` hatten bislang `select`/`insert`/`update` direkt
-- fuer anon/authenticated freigegeben, abgesichert nur durch `using (true)`.
-- Das schuetzt nichts: PostgREST erlaubt ungefilterte Abfragen wie
-- `GET /rest/v1/saves?select=*` oder `GET /rest/v1/sync_codes?select=*`, und
-- RLS filtert dabei keine Zeile heraus, weil die Policy jede Zeile erlaubt.
-- Wer den oeffentlichen anon-Key kennt - jeder Browser, der das Spiel laedt -
-- kann damit alle Spielstaende lesen und ueberschreiben sowie alle gueltigen
-- Sync-Codes samt zugehoeriger save_id auflisten, ganz ohne die 6-stellige
-- Rateschranke zu benoetigen.
--
-- Die Kommentare in schema.sql beschrieben das als durch die Unratbarkeit der
-- UUID abgesichert. Das stimmt nur fuer den eigenen Client, der brav mit
-- `eq('id', ...)` fragt - nicht fuer die Schnittstelle selbst.
--
-- Fix, konsistent mit dem bereits fuer `scores` verwendeten Muster: keine
-- direkten Tabellenrechte fuer anon/authenticated, stattdessen
-- security-definer-RPCs, die die id/den code als Argument nehmen.

begin;

-- ============================================================================
-- 1. Direkte Tabellenrechte entziehen
-- ============================================================================

revoke select, insert, update, delete on public.saves from anon, authenticated;
revoke select, insert, update, delete on public.sync_codes from anon, authenticated;

drop policy if exists "Spielstand ist mit Kenntnis der id lesbar" on public.saves;
drop policy if exists "Spielstand anlegen" on public.saves;
drop policy if exists "Spielstand ueberschreiben" on public.saves;

drop policy if exists "Gueltiger Code ist einloesbar" on public.sync_codes;
drop policy if exists "Code anlegen" on public.sync_codes;

-- ============================================================================
-- 2. Spielstand nur noch ueber RPCs mit id als Argument
-- ============================================================================

create or replace function public.get_save(p_id uuid)
returns table (
  data        jsonb,
  level       integer,
  best_score  integer,
  total_runs  integer,
  updated_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select data, level, best_score, total_runs, updated_at
  from public.saves
  where id = p_id;
$$;

revoke execute on function public.get_save(uuid) from public;
grant execute on function public.get_save(uuid) to anon, authenticated;

create or replace function public.upsert_save(
  p_id         uuid,
  p_data       jsonb,
  p_level      integer,
  p_best_score integer,
  p_total_runs integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null then
    raise exception 'Ungueltige Spielstand-ID';
  end if;

  insert into public.saves (id, data, level, best_score, total_runs, updated_at)
  values (
    p_id,
    p_data,
    greatest(1, coalesce(p_level, 1)),
    greatest(0, coalesce(p_best_score, 0)),
    greatest(0, coalesce(p_total_runs, 0)),
    now()
  )
  on conflict (id) do update
  set data       = excluded.data,
      level      = excluded.level,
      best_score = excluded.best_score,
      total_runs = excluded.total_runs,
      updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke execute on function public.upsert_save(uuid, jsonb, integer, integer, integer) from public;
grant execute on function public.upsert_save(uuid, jsonb, integer, integer, integer) to anon, authenticated;

-- ============================================================================
-- 3. Sync-Codes nur noch ueber RPCs mit code als Argument
-- ============================================================================
--
-- `create_sync_code` legt den Code direkt zum eigenen Spielstand an, statt
-- Insert-Rechte auf die Tabelle zu vergeben. `redeem_sync_code` loest Code und
-- Spielstand in einem Aufruf gemeinsam auf, damit `sync_codes` fuer den
-- Client an keiner Stelle mehr direkt lesbar sein muss.

create or replace function public.create_sync_code(
  p_save_id uuid,
  p_code    text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_save_id is null then
    raise exception 'Ungueltige Spielstand-ID';
  end if;
  if p_code !~ '^[0-9A-HJKMNP-Z]{6}$' then
    raise exception 'Ungueltiges Code-Format';
  end if;
  if not exists (select 1 from public.saves where id = p_save_id) then
    raise exception 'Spielstand nicht gefunden';
  end if;

  insert into public.sync_codes (code, save_id) values (p_code, p_save_id);
  return true;
end;
$$;

revoke execute on function public.create_sync_code(uuid, text) from public;
grant execute on function public.create_sync_code(uuid, text) to anon, authenticated;

create or replace function public.redeem_sync_code(p_code text)
returns table (
  save_id     uuid,
  data        jsonb,
  level       integer,
  best_score  integer,
  total_runs  integer,
  updated_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.data, s.level, s.best_score, s.total_runs, s.updated_at
  from public.sync_codes as c
  join public.saves as s on s.id = c.save_id
  where c.code = p_code
    and c.expires_at > now();
$$;

revoke execute on function public.redeem_sync_code(text) from public;
grant execute on function public.redeem_sync_code(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
