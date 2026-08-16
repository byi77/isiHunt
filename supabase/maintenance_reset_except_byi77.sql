-- ACHTUNG: DESTRUKTIV.
--
-- Loescht alle Spielerkonten ausser dem als Admin markierten Alias `byi77`.
-- Dabei werden Spielstaende, Ranglisteneintraege, Sync-Codes,
-- Fortschrittsereignisse und Erfolge entfernt. Der Admin-Spielstand wird
-- danach auf Level 1, 0 XP und 0 Coins gesetzt.
--
-- Dieses Skript niemals automatisch deployen.

begin;

do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from public.profiles
  where is_admin
    and lower(trim(coalesce(alias, ''))) = 'byi77'
  order by created_at asc
  limit 1;

  if admin_id is null then
    raise exception 'Adminprofil byi77 nicht gefunden oder nicht freigegeben';
  end if;

  delete from public.scores;
  delete from public.sync_codes;
  delete from public.saves;
  delete from public.profile_progress_events;
  delete from public.profile_progress where profile_id <> admin_id;
  delete from public.profiles where id <> admin_id;
  delete from auth.users where id <> admin_id;

  update public.profiles
  set player_name = 'byi77',
      alias = 'byi77',
      alias_normalized = 'byi77',
      is_admin = true,
      updated_at = now()
  where id = admin_id;

  insert into public.profile_progress (profile_id, data, total_xp, updated_at)
  values (
    admin_id,
    '{
      "version": 6, "level": 1, "xp": 0, "talentPoints": 0,
      "coins": 0, "talents": {}, "bestScore": 0,
      "bestScoreRecordedAt": null, "bestCombo": 0, "totalScore": 0,
      "totalRuns": 0, "totalPlayTimeMs": 0, "totalCoinsEarned": 0,
      "coinsSpent": 0, "lastLoginBonusKey": null, "lastDailyKey": null,
      "dailyBestScore": 0, "totalDailyRuns": 0,
      "pendingDailyKey": null, "pendingDailyEventId": null,
      "pendingDailyCoins": 0, "pendingDailyScore": 0,
      "collected": {
        "poor": 0, "common": 0, "uncommon": 0,
        "rare": 0, "epic": 0, "legendary": 0
      },
      "unlockedAchievements": [], "lastWorldId": "silberhain",
      "soundEnabled": true, "playerName": "byi77", "cloudId": null
    }'::jsonb,
    0,
    now()
  )
  on conflict (profile_id) do update
  set data = excluded.data, total_xp = 0, updated_at = now();
end;
$$;

commit;
notify pgrst, 'reload schema';
