-- Phase 2.9: Repariert einen Fehler in phase_2_8_unify_identity.sql.
--
-- Die vorherige Migration hat profiles.alias/alias_normalized geaendert,
-- aber NICHT die zugehoerige auth.users.email. Der Login baut die interne
-- Auth-Adresse direkt aus dem eingegebenen Alias (<alias>@<domain>) und
-- prueft sie gegen auth.users.email - nicht gegen profiles.alias. Nach der
-- Migration blieb auth.users.email auf dem alten Alias stehen (z.B.
-- "byi77@..."), waehrend der Login jetzt mit dem neuen Alias
-- ("yavuz@...") sucht. Ergebnis: Login schlaegt fehl, Konto ist ausgesperrt.
--
-- Diese Datei nach phase_2_8_unify_identity.sql im Supabase SQL Editor
-- ausfuehren. Sie ist wiederholbar und loescht keine Konten oder Spielstaende.
--
-- WICHTIG: Nur der lokale Teil vor dem "@" wird ersetzt - die Domain (das,
-- was aliasToAuthEmail() aus VITE_SUPABASE_URL bildet) bleibt unangetastet,
-- weil diese SQL-Datei die Client-Konfiguration nicht kennt.

begin;

update auth.users as u
set email = p.alias || '@' || split_part(u.email, '@', 2),
    raw_user_meta_data = jsonb_set(
      coalesce(u.raw_user_meta_data, '{}'::jsonb),
      '{alias}',
      to_jsonb(p.alias),
      true
    )
from public.profiles as p
where u.id = p.id
  and p.alias is not null
  and u.email is not null
  and position('@' in u.email) > 0
  and split_part(u.email, '@', 1) <> p.alias;

-- ============================================================================
-- update_profile_identity zog bisher nur profiles.alias/player_name nach,
-- nicht auth.users.email. Ohne diese Korrektur wuerde sich jeder Spieler, der
-- kuenftig seinen Namen aendert, beim naechsten Login selbst aussperren -
-- derselbe Fehler wie oben repariert, nur fuer zukuenftige Aenderungen statt
-- fuer den einmaligen Migrationslauf.
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
  current_email text;
  email_domain text;
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

  -- Die Login-Adresse traegt den Alias im lokalen Teil vor dem "@". Bleibt
  -- sie hier unangetastet, funktioniert der naechste Login mit dem neuen
  -- Namen nicht mehr, obwohl profiles.alias schon aktualisiert ist.
  select email into current_email from auth.users where id = uid;
  if current_email is not null and position('@' in current_email) > 0 then
    email_domain := split_part(current_email, '@', 2);
    if split_part(current_email, '@', 1) <> safe_name then
      update auth.users
      set email = safe_name || '@' || email_domain,
          raw_user_meta_data = jsonb_set(
            coalesce(raw_user_meta_data, '{}'::jsonb), '{alias}', to_jsonb(safe_name), true
          )
      where id = uid;
    end if;
  end if;

  update public.profile_progress
  set data = jsonb_set(data, '{playerName}', to_jsonb(safe_name), true), updated_at = now()
  where profile_id = uid;
  update public.scores set player_name = safe_name where player_id = uid;
  return true;
end;
$$;

revoke execute on function public.update_profile_identity(text) from public;
grant execute on function public.update_profile_identity(text) to authenticated;

commit;
