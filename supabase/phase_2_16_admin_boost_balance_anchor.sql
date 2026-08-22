-- Admin-Boost immer auf dem aktuellen Balance-Levelanker berechnen.
--
-- phase_2_7_admin_tools.sql verwendete die damals eingefrorene XP-Kurve.
-- Dadurch konnte ein Admin-Boost nach einer Balance-Aenderung einen
-- inkonsistenten total_xp-Wert schreiben. Diese Migration ersetzt nur die
-- Berechnung; bestehende Spielstaende werden nicht automatisch veraendert.

begin;

create or replace function public.balance_total_xp_for_level(p_level integer)
returns bigint
language plpgsql
immutable
set search_path = public
as $$
declare
  max_level integer := (public.balance_config()->'progression'->>'maxLevel')::integer;
  target_level integer := greatest(1, least(max_level, coalesce(p_level, 1)));
  level_cursor integer := 1;
  total_xp bigint := 0;
begin
  while level_cursor < target_level loop
    total_xp := total_xp + public.balance_xp_for_level(level_cursor)::bigint;
    level_cursor := level_cursor + 1;
  end loop;
  return total_xp;
end;
$$;

-- Auch die Zielauflösung verwendet die konfigurierten Maximalstufen statt
-- einer zweiten fest verdrahteten 100.
create or replace function public.profile_level_from_xp(p_total_xp bigint)
returns table (level integer, xp integer)
language plpgsql
immutable
as $$
declare
  max_level integer := (public.balance_config()->'progression'->>'maxLevel')::integer;
  current_level integer := 1;
  remaining bigint := greatest(0, coalesce(p_total_xp, 0));
  required integer;
begin
  while current_level < max_level loop
    required := public.balance_xp_for_level(current_level);
    exit when remaining < required;
    remaining := remaining - required;
    current_level := current_level + 1;
  end loop;

  if current_level >= max_level then remaining := 0; end if;
  return query select current_level, remaining::integer;
end;
$$;

create or replace function public.admin_boost_user(
  p_alias text,
  p_level integer default 50,
  p_coins integer default 50000
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  target_id uuid;
  safe_alias text := lower(trim(coalesce(p_alias, '')));
  safe_level integer := greatest(1, least(
    (public.balance_config()->'progression'->>'maxLevel')::integer,
    coalesce(p_level, 50)
  ));
  safe_coins integer := greatest(0, coalesce(p_coins, 50000));
  target_total_xp bigint := public.balance_total_xp_for_level(safe_level);
  current_data jsonb;
begin
  if admin_id is null or not exists (
    select 1 from public.profiles where id = admin_id and is_admin
  ) then raise exception 'Wartungsrechte erforderlich'; end if;

  select id into target_id from public.profiles
  where alias_normalized = safe_alias or lower(trim(coalesce(alias, ''))) = safe_alias
  limit 1;
  if target_id is null then raise exception 'Profil nicht gefunden'; end if;

  select data into current_data from public.profile_progress
  where profile_id = target_id for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  current_data := current_data || jsonb_build_object(
    'level', safe_level,
    'xp', 0,
    'coins', safe_coins,
    'totalCoinsEarned', greatest(safe_coins, coalesce((current_data->>'totalCoinsEarned')::bigint, 0)),
    'version', 8
  );
  update public.profile_progress set data = current_data, total_xp = target_total_xp, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

revoke execute on function public.balance_total_xp_for_level(integer) from public;
revoke execute on function public.admin_boost_user(text, integer, integer) from public;
grant execute on function public.admin_boost_user(text, integer, integer) to authenticated;

commit;
notify pgrst, 'reload schema';
