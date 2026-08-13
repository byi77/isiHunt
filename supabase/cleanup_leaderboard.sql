-- Einmalige Bereinigung fuer den Wechsel auf "ein bester Lauf je Profil".
--
-- Dieses Skript ist absichtlich NICHT Teil von schema.sql: Es loescht alle
-- bisherigen Bestenlisten-Eintraege und darf nur nach ausdruecklicher
-- Bestaetigung im Supabase SQL Editor ausgefuehrt werden.
--
-- Vorher schema.sql einspielen, damit `player_id` existiert.

begin;

delete from public.scores;

alter table public.scores
  alter column player_id set not null;

commit;

notify pgrst, 'reload schema';
