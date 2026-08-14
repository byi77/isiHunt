-- Einmalige Bereinigung fuer den Wechsel auf "ein bester Lauf je Profil".
--
-- Dieses Skript ist absichtlich NICHT Teil von schema.sql: Es loescht alle
-- bisherigen Bestenlisten-Eintraege und darf nur nach ausdruecklicher
-- Bestaetigung im Supabase SQL Editor ausgefuehrt werden.
--
-- Vorher schema.sql oder phase_2_6_auth.sql einspielen, damit player_id und
-- player_level existieren.

begin;

delete from public.scores;

alter table public.scores
  add column if not exists player_level integer not null default 1;

alter table public.scores
  alter column player_id set not null;

commit;

notify pgrst, 'reload schema';
