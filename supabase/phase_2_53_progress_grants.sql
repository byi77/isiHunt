-- ============================================================================
-- Phase 2.53 - Die Rechte an submit_progress_event wiederherstellen
-- ============================================================================
--
-- ## Was kaputt war
--
-- Seit v0.1.339 (phase_2_52_run_bonus.sql) kam kein einziger Run mehr im
-- Konto an. Die Bestenliste war nur das sichtbare Symptom: Ohne
-- Laufereignis findet der Trigger `enforce_authenticated_score_evidence`
-- (phase_2_31) keinen Beleg und lehnt jeden Bestwert ab mit
-- "Bestwert braucht ein bestaetigtes Laufereignis".
--
-- Belegt am Konto "Yavuz": Das juengste Laufereignis stammt vom 2026-09-19
-- um 20:43:38 - fuenf Runs danach (22:20 bis 22:28) fehlen vollstaendig,
-- obwohl jede serverseitige Pruefung sie durchgelassen haette (Laufdauer,
-- Reliktmenge, Combo, Plausibilitaetsdecke, Cooldown - alles im gruenen
-- Bereich, nachgerechnet gegen die echten Zahlen aus dem Debug-Report).
--
-- ## Die Ursache
--
-- `create or replace function` setzt in PostgreSQL die Ausfuehrungsrechte
-- auf den Standard zurueck. Phase 2.52 hat die 10-Parameter-Fassung
-- ersetzt, um die Abschlusspraemie einzubauen, und dabei zwei Dinge
-- veraendert, die niemand beabsichtigt hatte:
--
-- 1. Das `revoke ... from authenticated` aus Phase 2.28 war aufgehoben.
--    Die interne Fassung war damit wieder direkt aufrufbar - genau das,
--    was Phase 2.28 unterbunden hatte, weil ein Aufrufer darueber einen
--    Tageslauf umetikettieren koennte.
-- 2. Phase 2.52 setzte danach `revoke ... from public, anon`. Ein `revoke`
--    von `public` entzieht auch die Rechte, die ueber die Rolle `public`
--    vererbt werden - und der 11-Parameter-Wrapper aus Phase 2.28 ruft
--    genau diese Fassung auf.
--
-- Diese Migration stellt den Zustand von Phase 2.28 wieder her: die interne
-- Fassung ist fuer niemanden ausser dem Funktionseigentuemer aufrufbar, der
-- Wrapper traegt das Recht fuer `authenticated`, und weil er
-- `security definer` ist, erreicht er die interne Fassung.
--
-- ## Warum der Wrapper hier neu geschrieben wird
--
-- Er ist inhaltlich unveraendert gegenueber Phase 2.28. Er steht trotzdem
-- vollstaendig hier, weil eine Migration aus sich heraus lesbar sein muss:
-- Wer nachvollziehen will, was heute gilt, soll nicht drei Dateien
-- zusammensuchen muessen. Ein `grant` allein wuerde ausserdem nicht
-- auffallen, wenn eine spaetere Migration den Wrapper wegwirft.
--
-- Wiederholt ausfuehrbar.
-- ============================================================================

begin;

do $$
declare
  current_version integer;
begin
  select schema_version into current_version
  from public.isihunt_schema_state where singleton = true;
  if current_version is null then
    raise exception 'Schemastand unbekannt - phase_2_32_migration_state.sql fehlt.';
  end if;
  if current_version not in (52, 53) then
    raise exception 'Erwarteter Schemastand 52 oder 53, gefunden: %', current_version;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Die interne Fassung bleibt intern
-- ---------------------------------------------------------------------------
-- Wortgleich mit Phase 2.28: Sie ist der validierende Run-Importer, aber
-- kein oeffentlicher RPC. Nur der Wrapper unten darf sie erreichen.
revoke execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[]
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Der oeffentliche Wrapper mit Tagesmarker
-- ---------------------------------------------------------------------------
-- Inhaltlich unveraendert gegenueber Phase 2.28. Er setzt den Tagesmarker
-- nur bei einem erstmaligen Ereignis und kann einen normalen Run nicht
-- nachtraeglich in einen Tageslauf umetikettieren.
create or replace function public.submit_progress_event(
  p_event_id uuid,
  p_world_id text,
  p_score integer,
  p_best_combo integer,
  p_xp_gained integer,
  p_coins_gained integer,
  p_duration_ms integer,
  p_talent_points_gained integer,
  p_collected jsonb,
  p_achievement_ids text[],
  p_daily_key text
)
returns setof public.profile_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_daily_key text;
begin
  if p_daily_key is not null and not public.daily_key_is_plausible(p_daily_key) then
    raise exception 'Ungueltiger Tageslauf';
  end if;

  select daily_key into existing_daily_key
  from public.profile_progress_events
  where event_id = p_event_id and profile_id = auth.uid();

  if found then
    if existing_daily_key is distinct from p_daily_key then
      raise exception 'Ereignis-ID bereits mit anderem Lauf-Typ verwendet';
    end if;
    return query select * from public.submit_progress_event(
      p_event_id, p_world_id, p_score, p_best_combo, p_xp_gained,
      p_coins_gained, p_duration_ms, p_talent_points_gained,
      p_collected, p_achievement_ids
    );
    return;
  end if;

  return query select * from public.submit_progress_event(
    p_event_id, p_world_id, p_score, p_best_combo, p_xp_gained,
    p_coins_gained, p_duration_ms, p_talent_points_gained,
    p_collected, p_achievement_ids
  );

  update public.profile_progress_events
  set daily_key = p_daily_key
  where event_id = p_event_id
    and profile_id = auth.uid()
    and daily_key is null;
end;
$$;

revoke execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], text
) from public, anon;
grant execute on function public.submit_progress_event(
  uuid, text, integer, integer, integer, integer, integer, integer, jsonb, text[], text
) to authenticated;

update public.isihunt_schema_state
set schema_version = 53,
    migration_name = 'phase_2_53_progress_grants.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
