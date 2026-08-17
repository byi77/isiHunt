-- Phase 2.8: Alias (Login) und Spielername (Anzeige) zu einer Identitaet
-- zusammenlegen.
--
-- Grund: Beide Felder liefen unabhaengig auseinander (z.B. alias "byi77",
-- player_name "Yavuz"). Das Wartungswerkzeug zeigt player_name im Dashboard,
-- sucht bei Boost/Reset aber nur nach alias - ohne Verbindung zwischen
-- beiden war ein gemeldeter Spielername dort nicht wiederzufinden.
--
-- Diese Datei nach phase_2_7_admin_tools.sql im Supabase SQL Editor
-- ausfuehren. Sie ist wiederholbar und loescht keine Spielstaende.

begin;

-- ============================================================================
-- 1. Bestandsprofile: player_name gewinnt, alias wird daraus abgeleitet.
--
-- player_name erlaubt Zeichen, die als Alias ungueltig sind (Grossschreibung,
-- Leerzeichen, Sonderzeichen). Die Normalisierung entfernt alles ausser
-- a-z/0-9/-/_ und kuerzt auf ALIAS_MAX_LENGTH (16). Kollidieren zwei Profile
-- nach der Normalisierung (z.B. "Emre" und "emre!!"), erhaelt das juengere
-- Profil einen Zahlen-Suffix, damit kein Alias verloren geht oder ueberschrieben
-- wird.
-- ============================================================================

with normalized as (
  select
    id,
    created_at,
    left(
      regexp_replace(lower(trim(coalesce(player_name, ''))), '[^a-z0-9_-]', '', 'g'),
      16
    ) as base_alias
  from public.profiles
),
padded as (
  -- Kuerzer als 3 Zeichen (Alias-Mindestlaenge) wird mit der Profil-ID aufgefuellt,
  -- leer bleibt so nie ohne gueltigen Alias.
  select
    id,
    created_at,
    case
      when char_length(base_alias) >= 3 then base_alias
      else left(base_alias || replace(id::text, '-', ''), 16)
    end as base_alias
  from normalized
),
deduplicated as (
  select
    id,
    base_alias,
    row_number() over (partition by base_alias order by created_at asc, id asc) as duplicate_rank
  from padded
)
update public.profiles as p
set
  alias = case
    when deduplicated.duplicate_rank = 1 then deduplicated.base_alias
    else left(deduplicated.base_alias, 12) || '_' || deduplicated.duplicate_rank::text
  end,
  alias_normalized = case
    when deduplicated.duplicate_rank = 1 then deduplicated.base_alias
    else left(deduplicated.base_alias, 12) || '_' || deduplicated.duplicate_rank::text
  end,
  updated_at = now()
from deduplicated
where p.id = deduplicated.id
  and (p.alias is null or p.alias_normalized is null or p.alias <> deduplicated.base_alias);

-- ============================================================================
-- 2. Eine Funktion fuer beides: setzt Alias UND Anzeigename gleichzeitig auf
-- denselben Wert. Ersetzt die bisher getrennten update_profile_name/
-- update_profile_alias fuer neue Aenderungen; die alten Funktionen bleiben
-- als Kompatibilitaetshuelle bestehen (falls ein noch nicht aktualisierter
-- Client sie aufruft), delegieren aber intern hierher.
-- ============================================================================

create or replace function public.update_profile_identity(p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  safe_name text := lower(trim(coalesce(p_name, '')));
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if safe_name !~ '^[a-z0-9_-]{3,16}$' then
    raise exception 'Name: 3-16 Zeichen, nur a-z, 0-9, - und _';
  end if;

  if exists (
    select 1 from public.profiles
    where alias_normalized = safe_name and id <> uid
  ) then
    raise exception 'Dieser Name ist bereits vergeben';
  end if;
  if not public.is_player_name_available(safe_name, uid) then
    raise exception 'Dieser Name ist bereits vergeben';
  end if;

  insert into public.profiles (id, player_name, alias, alias_normalized)
  values (uid, safe_name, safe_name, safe_name)
  on conflict (id) do update
    set player_name = excluded.player_name,
        alias = excluded.alias,
        alias_normalized = excluded.alias_normalized,
        updated_at = now();

  update public.profile_progress
  set data = jsonb_set(data, '{playerName}', to_jsonb(safe_name), true), updated_at = now()
  where profile_id = uid;
  update public.scores set player_name = safe_name where player_id = uid;
  return true;
end;
$$;

revoke execute on function public.update_profile_identity(text) from public;
grant execute on function public.update_profile_identity(text) to authenticated;

-- Kompatibilitaetshuellen: leiten auf die vereinheitlichte Funktion um, damit
-- ein Client-Rollout keine harte Reihenfolge mit dieser Migration braucht.
create or replace function public.update_profile_name(p_player_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.update_profile_identity(p_player_name);
$$;

create or replace function public.update_profile_alias(p_alias text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.update_profile_identity(p_alias);
$$;

commit;
notify pgrst, 'reload schema';
