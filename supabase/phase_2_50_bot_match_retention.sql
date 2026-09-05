-- Phase 2.50: Offene Bot-Matches nach Anzahl statt nach Alter begrenzen.
--
-- Phase 2.49 raeumte bei jedem `start_bot_match()` alle offenen Match-IDs des
-- Kontos weg, die aelter als einen Tag waren. Das kollidierte mit der
-- Zusage der Client-Outbox, einen offline gewonnenen Bot-Sieg beliebig lange
-- nachzuliefern (AUDIT_2026-09-05_REAUDIT, Befund 3):
--
--   Tag 1  Spieler gewinnt offline ein Bot-Duell, die Match-ID wartet lokal.
--   Tag 2  Derselbe Spieler startet ein neues Duell -> der `delete` entfernt
--          den Datensatz von gestern.
--   Tag 2  Das Netz kommt zurueck, der Claim wird dauerhaft mit
--          'Bot-Duell nicht gestartet' abgelehnt. Die Praemie ist fort.
--
-- Es braucht dafuer kein zweites Geraet: der Loeschlauf gehoert zum eigenen
-- Duellstart. Ein Handy, das ueber 24 Stunden keine Verbindung bekommt
-- (Urlaub, Flugmodus, defektes WLAN), reicht aus.
--
-- ## Warum das Aufraeumen selbst bleiben muss
--
-- Jeder Duellstart legt eine Zeile an, aber nur ein *gewonnenes* Duell raeumt
-- sie ueber `claim_bot_victory_bonus()` wieder ab. Jedes verlorene Bot-Duell
-- hinterlaesst eine Karteileiche. Ohne Begrenzung waechst
-- `bot_victory_matches` unbegrenzt.
--
-- ## Anzahl statt Alter
--
-- Eine laengere Frist (30 Tage statt einer) haette den Konflikt nur
-- verschoben und die Tabelle dabei dreissigfach wachsen lassen - es gaebe
-- weiterhin ein Zeitfenster, das ein Offline-Geraet verpassen kann.
--
-- Deshalb begrenzt dieser Stand nach Anzahl: pro Konto bleiben die
-- `bot_match_retention_count()` juengsten offenen Matches erhalten, aeltere
-- fallen weg. Damit gibt es fuer den Nachzuegler **kein Zeitfenster mehr**,
-- und die Tabelle ist pro Konto hart gedeckelt - schaerfer als es jede Frist
-- leisten kann.
--
-- Die Zahl 24 ist bewusst groesser als `BOT_VICTORY_MAX_PENDING = 16` in
-- `src/systems/ProgressSyncSystem.ts`: der Client reiht nie mehr als 16 Siege
-- ein, und der Puffer deckt die dazwischenliegenden *verlorenen* Duelle mit
-- ab. Wer 24 Duelle spielt, ohne dass ein einziger Claim durchkommt, hat kein
-- Praemien- sondern ein Verbindungsproblem.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 49
     ) then
    raise exception 'Phase 2.49 muss vor Phase 2.50 ausgefuehrt werden';
  end if;
end;
$$;

-- Wie viele offene Bot-Matches ein Konto gleichzeitig halten darf.
-- Muss >= BOT_VICTORY_MAX_PENDING des Clients bleiben (dort 16).
create or replace function public.bot_match_retention_count()
returns integer
language sql
immutable
as $$ select 24 $$;

revoke execute on function public.bot_match_retention_count() from public, anon, authenticated;

-- `bot_victory_claims` waechst ebenfalls unbegrenzt: jeder gebuchte Sieg legt
-- dort dauerhaft eine Zeile ab. Gebraucht wird sie nur fuer zwei Pruefungen
-- in `claim_bot_victory_bonus()` - die Doppelbuchungssperre und den
-- 80-Sekunden-Cooldown. Beide interessieren sich ausschliesslich fuer die
-- juengste Vergangenheit.
--
-- **Warum das die Doppelbuchungssperre nicht aushebelt.** Ein geloeschter
-- Nachweis erlaubt eine zweite Buchung nur dann, wenn die zugehoerige Zeile
-- in `bot_victory_matches` noch existiert. Genau die loescht
-- `claim_bot_victory_bonus()` aber beim Buchen (phase_2_49, Zeile 150). Ein
-- erneuter Claim scheitert deshalb an 'Bot-Duell nicht gestartet' - die
-- Match-Tabelle traegt die Sperre, der Claim-Nachweis ist nur ihre schnelle
-- Abkuerzung fuer den haeufigen Wiederholungsfall.
create or replace function public.prune_bot_victory_claims(p_profile_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bot_victory_claims as stale
  where stale.profile_id = p_profile_id
    and stale.match_id not in (
      select recent.match_id
      from public.bot_victory_claims as recent
      where recent.profile_id = p_profile_id
      order by recent.claimed_at desc
      limit public.bot_match_retention_count()
    );
$$;

revoke execute on function public.prune_bot_victory_claims(uuid) from public, anon, authenticated;

create or replace function public.start_bot_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_match uuid;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  -- Ein verlorener Client-Reply darf keinen zweiten aktiven Lauf erzeugen.
  -- Nach der Rundendauer darf derselbe offene Datensatz fuer den Retry wieder
  -- verwendet werden; der Claim bleibt durch die Match-ID idempotent.
  select match_id into next_match
  from public.bot_victory_matches
  where profile_id = uid
    and started_at > now() - public.bot_victory_cooldown()
  order by started_at desc
  limit 1;
  if next_match is not null then return next_match; end if;

  insert into public.bot_victory_matches (profile_id)
  values (uid)
  returning match_id into next_match;

  -- Erst nach dem Einfuegen begrenzen, damit der soeben angelegte Datensatz
  -- garantiert erhalten bleibt. Nach Anzahl, nicht nach Alter: ein offline
  -- gewonnenes Duell darf nicht durch blossen Zeitablauf verfallen.
  delete from public.bot_victory_matches
  where profile_id = uid
    and match_id not in (
      select match_id
      from public.bot_victory_matches
      where profile_id = uid
      order by started_at desc
      limit public.bot_match_retention_count()
    );

  -- Derselbe Anlass, dieselbe Grenze: die Claim-Nachweise eines Kontos
  -- wachsen sonst unbegrenzt weiter, obwohl nur die juengsten gebraucht
  -- werden. Bewusst hier und nicht in `claim_bot_victory_bonus()` - dort
  -- laege es mitten in der Praemienbuchung, hier gehoert es zum ohnehin
  -- laufenden Aufraeumen.
  perform public.prune_bot_victory_claims(uid);

  return next_match;
end;
$$;

revoke execute on function public.start_bot_match() from public, anon;
grant execute on function public.start_bot_match() to authenticated;

-- Bestandsdaten: bereits vorhandene Ueberhaenge einmalig auf dieselbe Grenze
-- bringen. Ohne das bliebe ein Konto, das unter 2.49 viele Karteileichen
-- angesammelt hat, bis zu seinem naechsten Duellstart darueber.
delete from public.bot_victory_matches as stale
where stale.match_id not in (
  select recent.match_id
  from public.bot_victory_matches as recent
  where recent.profile_id = stale.profile_id
  order by recent.started_at desc
  limit public.bot_match_retention_count()
);

update public.isihunt_schema_state
set schema_version = 50,
    migration_name = 'phase_2_50_bot_match_retention.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
