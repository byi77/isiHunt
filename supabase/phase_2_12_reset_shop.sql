-- Wartungs-Reset loescht jetzt auch gekaufte Formen und Farben.
--
-- ## Warum diese Migration
--
-- `admin_reset_user()` setzte Level, Coins, Talente und Erfolge zurueck, liess
-- die Ladenkaeufe aber stehen: Ein zurueckgesetzter Spieler startete bei Stufe
-- 1 mit 0 Muenzen, trug aber weiterhin den Sternenkreuzer fuer 1 100 Muenzen.
--
-- Ausserdem stand hier fest `'version', 6`. Der Spielstand liegt inzwischen bei
-- 8; ein zurueckgesetzter Stand lief dadurch beim naechsten Laden erneut durch
-- die Migrationen 7 und 8 - was bei der XP-Kurve nichts schadete, aber
-- unnoetig ist und bei einer kuenftigen, nicht-idempotenten Migration schaden
-- wuerde.
--
-- ## Was der Reset NICHT erreicht
--
-- Die **getragene** Figur ist eine Geraete-Einstellung und liegt nur im
-- localStorage (siehe `vereinigeShopBesitz()` in SaveSystem.ts). Der Client
-- raeumt sie deshalb selbst auf, wenn er einen zurueckgesetzten Stand
-- uebernimmt.

begin;

create or replace function public.admin_reset_user(p_alias text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  target_id uuid;
  safe_alias text := lower(trim(coalesce(p_alias, '')));
  current_data jsonb;
  reset_data jsonb;
begin
  if admin_id is null or not exists (
    select 1 from public.profiles where id = admin_id and is_admin
  ) then
    raise exception 'Wartungsrechte erforderlich';
  end if;

  select id into target_id
  from public.profiles
  where alias_normalized = safe_alias
     or lower(trim(coalesce(alias, ''))) = safe_alias
  limit 1;

  if target_id is null then raise exception 'Profil nicht gefunden'; end if;

  select data into current_data
  from public.profile_progress
  where profile_id = target_id
  for update;
  if current_data is null then raise exception 'Profilstand noch nicht angelegt'; end if;

  delete from public.scores where player_id = target_id;
  delete from public.profile_progress_events where profile_id = target_id;

  reset_data := current_data || jsonb_build_object(
    'level', 1,
    'xp', 0,
    'talentPoints', 0,
    'coins', 0,
    'talents', '{}'::jsonb,
    'bestScore', 0,
    'bestScoreRecordedAt', null,
    'bestCombo', 0,
    'totalScore', 0,
    'totalRuns', 0,
    'totalPlayTimeMs', 0,
    'totalCoinsEarned', 0,
    'coinsSpent', 0,
    'lastLoginBonusKey', null,
    'lastDailyKey', null,
    'dailyBestScore', 0,
    'totalDailyRuns', 0,
    'pendingDailyKey', null,
    'pendingDailyEventId', null,
    'pendingDailyCoins', 0,
    'pendingDailyScore', 0,
    'collected', jsonb_build_object(
      'poor', 0, 'common', 0, 'uncommon', 0,
      'rare', 0, 'epic', 0, 'legendary', 0
    ),
    'unlockedAchievements', '[]'::jsonb,
    -- Ladenkaeufe zuruecksetzen: Der Pfeil und die Weltfarbe bleiben, weil
    -- ohne Schiff und ohne Farbe nicht gespielt werden kann. Beides ist
    -- ohnehin kostenlos.
    'ownedShipShapes', '["arrow"]'::jsonb,
    'ownedShipColors', '["world"]'::jsonb,
    'shipShape', '"arrow"',
    'shipColor', '"world"',
    'version', 8
  );

  update public.profile_progress
  set data = reset_data, total_xp = 0, updated_at = now()
  where profile_id = target_id;
  return true;
end;
$$;

revoke execute on function public.admin_reset_user(text) from public;
grant execute on function public.admin_reset_user(text) to authenticated;

commit;
notify pgrst, 'reload schema';
