-- Tagesbonus und Tageslauf gegen ein vorgestelltes Geraetedatum absichern.
--
-- ## Warum diese Migration
--
-- `claim_daily_bonus()` und `claim_daily_login_bonus()` bekommen den Tag als
-- Text vom Client (`ChallengeSystem.dailyKeyForToday()`, gebildet aus
-- `new Date()` - also aus der **Geraetezeit**). Geprueft wurde bisher nur das
-- Format:
--
--     if p_daily_key !~ '^\d{4}-\d{2}-\d{2}$' then ...
--
-- `9999-12-31` besteht diese Pruefung. Beide Funktionen sperren einen zweiten
-- Bonus nur ueber `lastDailyKey` bzw. `lastLoginBonusKey` - ein **anderer**
-- Schluessel gilt als neuer Tag. Wer das Geraetedatum vorstellt, bekommt den
-- Bonus deshalb beliebig oft.
--
-- Kein Angriffsszenario bei zwei Kindern in einer Familie. Aber wer den Trick
-- findet, entwertet den Tageslauf dauerhaft - und der Tageslauf ist eine der
-- wenigen Mechaniken, die zum Wiederkommen einladen.
--
-- ## Warum ein Fenster und nicht der exakte Servertag
--
-- Ein strikter Vergleich gegen `to_char(now(), 'YYYY-MM-DD')` waere dichter,
-- wuerde aber echte Spieler aussperren. Drei Faelle, alle legitim:
--
-- 1. **Zeitzone.** `now()` liefert UTC. Zwischen 00:00 und 02:00 Uhr deutscher
--    Sommerzeit ist lokal bereits der naechste Tag, in UTC noch der
--    vorherige - genau die Zeit, zu der heimlich gespielt wird.
-- 2. **Mitternacht waehrend des Runs.** Ein Lauf, der um 23:59 beginnt und um
--    00:01 endet, traegt den Schluessel vom Start.
-- 3. **Nachgereichte Offline-Runs.** Ein Lauf von gestern wird heute
--    hochgeladen, sobald das Netz zurueck ist (`ProgressSyncSystem`-Outbox).
--    Bei striktem Vergleich waere er wertlos.
--
-- Das Fenster von einem Tag in beide Richtungen deckt alle drei ab und
-- schliesst den Missbrauch trotzdem: Wer aufs Jahr 2030 stellt, bekommt
-- nichts.
--
-- ## Was diese Migration NICHT leistet
--
-- **Ehrliche Grenze:** Wer das Geraetedatum jeden Tag um genau einen Tag
-- weiterstellt, kommt weiterhin durch - er muesste das Datum dann aber
-- dauerhaft falsch stehen lassen, mit allen Folgen fuer Kalender, Nachrichten
-- und Bildschirmzeit. Ein vollstaendiger Schutz braeuchte einen serverseitig
-- erzeugten Tagesschluessel; das ist ein groesserer Eingriff in den
-- Offline-Betrieb und hier bewusst nicht gemacht.
--
-- Ebenfalls unveraendert: Der Client bildet den Schluessel weiterhin aus der
-- lokalen Zeit. Das ist Absicht - der Spieler soll "sein" Datum sehen, nicht
-- UTC.

begin;

-- Gemeinsame Pruefung fuer beide Bonus-Funktionen: Format **und** Naehe zum
-- Servertag. Als eigene Funktion, damit die Regel an einer Stelle steht und
-- nicht in zwei Funktionen auseinanderlaufen kann.
create or replace function public.daily_key_is_plausible(p_daily_key text)
returns boolean
language plpgsql
-- `stable`, nicht `immutable`: Die Funktion liest `current_date`, und das
-- aendert sich taeglich. Bei `immutable` duerfte Postgres das Ergebnis ueber
-- Tagesgrenzen hinweg zwischenspeichern - die Pruefung liefe dann gegen ein
-- eingefrorenes Datum. `stable` erlaubt das Caching nur innerhalb einer
-- Anweisung, was hier genau richtig ist.
stable
set search_path = public
as $$
declare
  parsed date;
begin
  if p_daily_key !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;

  -- Das Format allein garantiert kein gueltiges Datum: '2026-02-30' passt auf
  -- den regulaeren Ausdruck. Ein Fehlschlag hier ist eine Ablehnung, kein
  -- Serverfehler.
  begin
    parsed := p_daily_key::date;
  exception
    when others then return false;
  end;

  return abs(parsed - current_date) <= 1;
end;
$$;

grant execute on function public.daily_key_is_plausible(text) to authenticated;

-- --- Tageslauf ---------------------------------------------------------------

create or replace function public.claim_daily_bonus(
  p_daily_key text,
  p_score integer,
  p_event_id uuid
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  safe_bonus integer;
  safe_score integer := greatest(0, p_score);
  safe_tier integer;
  safe_xp integer;
  current_total_xp bigint;
  next_total_xp bigint;
  current_level integer;
  next_level integer;
  next_xp integer;
  level_coins integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not public.daily_key_is_plausible(p_daily_key) then
    raise exception 'Ungültiger Tageslauf';
  end if;
  safe_tier := least(3, floor(safe_score / 1500.0)::integer);
  safe_bonus := 90 + safe_tier * 20;
  safe_xp := 750 + safe_tier * 250;

  select data, total_xp into current_data, current_total_xp
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if current_data->>'lastDailyKey' = p_daily_key then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  if p_event_id is null or not exists (
    select 1
    from public.profile_progress_events
    where event_id = p_event_id
      and profile_id = uid
  ) then
    raise exception 'Tageslauf noch nicht synchronisiert';
  end if;

  current_level := greatest(1, coalesce((current_data->>'level')::integer, 1));
  next_total_xp := current_total_xp + safe_xp;
  select level, xp into next_level, next_xp
  from public.profile_level_from_xp(next_total_xp);
  level_coins := greatest(0, next_level - current_level) * 20;

  next_data := current_data || jsonb_build_object(
    'lastDailyKey', p_daily_key,
    'dailyBestScore', greatest(coalesce((current_data->>'dailyBestScore')::integer, 0), safe_score),
    'totalDailyRuns', coalesce((current_data->>'totalDailyRuns')::integer, 0) + 1,
    'level', next_level,
    'xp', next_xp,
    'coins', coalesce((current_data->>'coins')::integer, 0) + safe_bonus + level_coins,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + safe_bonus + level_coins,
    'version', 6
  );

  update public.profile_progress
  set data = next_data, total_xp = next_total_xp, updated_at = now()
  where profile_id = uid;
  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

revoke execute on function public.claim_daily_bonus(text, integer, uuid) from public;
grant execute on function public.claim_daily_bonus(text, integer, uuid) to authenticated;

-- --- Login-Bonus -------------------------------------------------------------

create or replace function public.claim_daily_login_bonus(p_daily_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  next_data jsonb;
  current_total_xp bigint;
  current_updated_at timestamptz;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not public.daily_key_is_plausible(p_daily_key) then
    raise exception 'Ungültiger Login-Tag';
  end if;

  select data, total_xp, updated_at
  into current_data, current_total_xp, current_updated_at
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  if current_data->>'lastLoginBonusKey' = p_daily_key then
    return jsonb_build_object(
      'claimed', false,
      'profile', jsonb_build_object(
        'data', current_data,
        'total_xp', current_total_xp,
        'updated_at', current_updated_at
      )
    );
  end if;

  next_data := current_data || jsonb_build_object(
    'lastLoginBonusKey', p_daily_key,
    'coins', coalesce((current_data->>'coins')::integer, 0) + 25,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0) + 25,
    'version', 6
  );

  update public.profile_progress
  set data = next_data, updated_at = now()
  where profile_id = uid
  returning updated_at into current_updated_at;

  return jsonb_build_object(
    'claimed', true,
    'profile', jsonb_build_object(
      'data', next_data,
      'total_xp', current_total_xp,
      'updated_at', current_updated_at
    )
  );
end;
$$;

revoke execute on function public.claim_daily_login_bonus(text) from public;
grant execute on function public.claim_daily_login_bonus(text) to authenticated;

commit;
notify pgrst, 'reload schema';
