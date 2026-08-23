-- ============================================================================
-- Spielstand-Version: ein Anker statt vier abgetippter Zahlen
-- ============================================================================
--
-- ## Das Problem
--
-- `SAVE_VERSION` in `src/config/GameConfig.ts` stand auf 8, vier Stellen in
-- `phase_2_6_auth.sql` schrieben aber weiterhin `version: 6` in den
-- Spielstand. Zwei davon (`purchase_talent`, `reset_talents`) hat
-- `phase_2_14_balance_chain.sql` bereits per `create or replace` durch
-- Fassungen mit `8` ersetzt - die beiden anderen blieben stehen:
--
--   * `get_profile_progress`   (Nachverguetung fuer Profile mit version < 5)
--   * `submit_progress_event`  (Umrechnung fuer Profile mit version < 4)
--
-- ## Die Wirkung
--
-- Beide schreiben nur innerhalb ihrer Migrationszweige, treffen also
-- ausschliesslich **Altprofile**. Genau diese bekamen danach den Marker 6
-- statt 8 - und der Client wertet alles unter 7 als "XP-Kurve noch nicht
-- umgerechnet" (`SaveSystem.migrate`, `rawVersion < 7`). Die Umrechnung lief
-- damit ein zweites Mal ueber bereits umgerechnete XP. Gemessen: Stufe 30
-- wurde zu Stufe 23.
--
-- Kein fortlaufender Verlust - der Client persistiert die Migration sofort,
-- und der Server setzt den Marker je Profil nur einmal. Aber ein echter,
-- einmaliger Levelverlust fuer jeden Spielstand, der einen dieser beiden
-- Zweige durchlaeuft.
--
-- ## Warum eine eigene Funktion statt vier korrigierter Zahlen
--
-- Die Ursache war nicht der falsche Wert, sondern dass er an vier Stellen von
-- Hand stand. Eine spaetere Migration zog zwei davon hoch, die anderen zwei
-- widersprachen ihr ab sofort - und meldeten das nie. `save_version()` gibt
-- es ab jetzt genau einmal; wer die Version anhebt, aendert diese eine
-- Funktion (Audit 2026-08-23).
--
-- Die alten Migrationsdateien bleiben unveraendert: Sie sind bereits
-- ausgefuehrt, und eine nachtraeglich umgeschriebene Migration laesst Repo
-- und Datenbank auseinanderlaufen.
-- ============================================================================

-- 1. Der Anker. Muss mit `SAVE_VERSION` in src/config/GameConfig.ts
--    uebereinstimmen; `npm run save:version` prueft das bei jedem `verify`.
create or replace function public.save_version()
returns integer
language sql
immutable
as $$ select 8 $$;

comment on function public.save_version() is
  'Aktuelle Spielstand-Version. Gegenstueck zu SAVE_VERSION in src/config/GameConfig.ts.';

-- 2. `get_profile_progress` neu, mit `save_version()` statt der festen 6.
create or replace function public.get_profile_progress()
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_data jsonb;
  retro_coins integer;
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;

  select data into current_data
  from public.profile_progress where profile_id = uid for update;
  if current_data is null then return; end if;

  -- Einmalige Nachverguetung fuer Profile aus Version 4: Beim damaligen
  -- Wechsel auf Coins wurden Level-Coins noch nicht rueckwirkend vergeben.
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    retro_coins := greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20;
    current_data := jsonb_set(
      current_data,
      '{coins}',
      to_jsonb(coalesce((current_data->>'coins')::integer, 0) + retro_coins),
      true
    );
    current_data := jsonb_set(current_data, '{talentPoints}', '0'::jsonb, true);
    current_data := jsonb_set(
      current_data,
      '{version}',
      to_jsonb(public.save_version()),
      true
    );
    update public.profile_progress
    set data = current_data, updated_at = now()
    where profile_id = uid;
  end if;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;

-- 3. `submit_progress_event` neu, ebenfalls mit `save_version()`. Bis auf
--    diese eine Zeile unveraendert aus `phase_2_6_auth.sql` uebernommen.
create or replace function public.submit_progress_event(
  p_event_id             uuid,
  p_world_id             text,
  p_score                integer,
  p_best_combo           integer,
  p_xp_gained            integer,
  p_coins_gained         integer,
  p_duration_ms          integer,
  p_talent_points_gained integer,
  p_collected            jsonb,
  p_achievement_ids      text[]
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
  next_collected jsonb;
  next_achievements jsonb;
  total_xp_value bigint;
  next_level integer;
  next_xp integer;
  item record;
  safe_duration_ms integer := least(102000, greatest(0, coalesce(p_duration_ms, 0)));
begin
  if uid is null then raise exception 'Anmeldung erforderlich'; end if;
  if not exists (select 1 from public.profile_progress where profile_id = uid) then
    raise exception 'Profilstand noch nicht angelegt';
  end if;

  insert into public.profile_progress_events (
    event_id, profile_id, world_id, score, best_combo, xp_gained,
    duration_ms, coins_gained, talent_points_gained, collected, achievement_ids
  ) values (
    p_event_id, uid, p_world_id, greatest(0, p_score), greatest(0, p_best_combo),
    greatest(0, p_xp_gained), safe_duration_ms, greatest(0, p_coins_gained),
    greatest(0, p_talent_points_gained), coalesce(p_collected, '{}'::jsonb),
    to_jsonb(coalesce(p_achievement_ids, '{}'::text[]))
  ) on conflict (event_id) do nothing;

  if not found then
    return query select * from public.profile_progress where profile_id = uid;
    return;
  end if;

  select data, total_xp into current_data, total_xp_value
  from public.profile_progress where profile_id = uid for update;

  -- Auch bei einem direkten Offline-Upload darf ein altes Profil die
  -- einmalige Level-Coins-Nachvergütung nicht verlieren.
  if coalesce((current_data->>'version')::integer, 1) < 4 then
    current_data := jsonb_set(
      current_data,
      '{coins}',
      to_jsonb(
        coalesce((current_data->>'coins')::integer, 0)
        + coalesce((current_data->>'talentPoints')::integer, 0) * 10
      ),
      true
    );
  end if;
  if coalesce((current_data->>'version')::integer, 1) < 5 then
    current_data := jsonb_set(
      current_data,
      '{coins}',
      to_jsonb(
        coalesce((current_data->>'coins')::integer, 0)
        + greatest(0, coalesce((current_data->>'level')::integer, 1) - 1) * 20
      ),
      true
    );
    current_data := jsonb_set(current_data, '{talentPoints}', '0'::jsonb, true);
    current_data := jsonb_set(
      current_data,
      '{version}',
      to_jsonb(public.save_version()),
      true
    );
  end if;
  total_xp_value := total_xp_value + greatest(0, p_xp_gained);
  select level, xp into next_level, next_xp
  from public.profile_level_from_xp(total_xp_value);

  next_collected := coalesce(current_data->'collected', '{}'::jsonb);
  for item in select key, value from jsonb_each(coalesce(p_collected, '{}'::jsonb)) loop
    next_collected := jsonb_set(
      next_collected,
      array[item.key],
      to_jsonb(coalesce((next_collected->>item.key)::integer, 0) + (item.value #>> '{}')::integer),
      true
    );
  end loop;

  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into next_achievements
  from (
    select distinct value
    from jsonb_array_elements_text(
      coalesce(current_data->'unlockedAchievements', '[]'::jsonb)
      || to_jsonb(coalesce(p_achievement_ids, '{}'::text[]))
    ) as entries(value)
  ) unique_values;

  next_data := current_data || jsonb_build_object(
    'level', next_level,
    'xp', next_xp,
    'coins', coalesce((current_data->>'coins')::integer, 0)
      + greatest(0, p_coins_gained)
      + greatest(0, p_talent_points_gained) * 10,
    'talentPoints', 0,
    'bestScore', greatest(coalesce((current_data->>'bestScore')::integer, 0), p_score),
    'bestCombo', greatest(coalesce((current_data->>'bestCombo')::integer, 0), p_best_combo),
    'totalScore', coalesce((current_data->>'totalScore')::bigint, 0) + greatest(0, p_score),
    'totalRuns', coalesce((current_data->>'totalRuns')::integer, 0) + 1,
    'totalPlayTimeMs', coalesce((current_data->>'totalPlayTimeMs')::bigint, 0)
      + safe_duration_ms,
    'totalCoinsEarned', coalesce((current_data->>'totalCoinsEarned')::bigint, 0)
      + greatest(0, p_coins_gained)
      + greatest(0, p_talent_points_gained) * 10,
    'collected', next_collected,
    'unlockedAchievements', next_achievements,
    'lastWorldId', p_world_id
  );

  update public.profile_progress
  set data = next_data, total_xp = total_xp_value, updated_at = now()
  where profile_id = uid;

  return query select * from public.profile_progress where profile_id = uid;
end;
$$;
