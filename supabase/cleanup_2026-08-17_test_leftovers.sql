-- Einmaliges Aufraeumen zweier Testdatensaetze aus TODO.md ("PRIO HOCH —
-- Testdaten aus der Produktions-Supabase-Datenbank loeschen", 2026-08-17).
--
-- Hintergrund: Ein ungemockter CloudSystem-Testlauf schrieb versehentlich
-- gegen die echte Produktionsdatenbank (lokale .env enthielt echte
-- Zugangsdaten). Der Code-Fehler ist behoben (CloudSystem.test.ts mockt
-- @/config/backend seither fest); dieses Skript entfernt nur die dabei
-- entstandenen Altdatensaetze.
--
-- Direkter DELETE ueber den anon-Key ist fuer saves/sync_codes nicht
-- vorgesehen (schema.sql: "Kein DELETE - ein Spielstand soll sich nicht
-- loeschen lassen", seit phase_2_10_lock_saves_access.sql zusaetzlich ganz
-- ohne direkte Tabellenrechte). Dieses Skript muss deshalb im Supabase
-- SQL Editor mit den vollen Rechten des Projekt-Owners laufen, nicht ueber
-- die App.
--
-- ============================================================================
-- Schritt 1: erst ansehen, nichts loeschen
-- ============================================================================
-- Vor dem eigentlichen Loeschen pruefen, ob es sich wirklich um die hier
-- beschriebenen Testdatensaetze handelt (created_at/updated_at sollte auf
-- 2026-08-17 kurz vor dem ersten Cleanup-Commit liegen, kein plausibler
-- playerName, keine Verbindung zu einem echten Auth-Profil).

select id, level, best_score, total_runs, updated_at
from public.saves
where id = 'b91ec0c5-999f-4408-8cc7-587bb0c065c5';

select code, save_id, created_at, expires_at
from public.sync_codes
where code = '67N0B2';

-- Der zugehoerige Ranglisteneintrag ist im TODO-Text nicht mit eigener ID
-- benannt ("der Score-Eintrag hat keinen plausiblen playerName") - diese
-- Abfrage findet ihn ueber dieselbe id, falls sie als player_id verwendet
-- wurde. Ergebnis vor dem Loeschen pruefen statt blind zu vertrauen.
select id, player_id, player_name, world_id, score, created_at
from public.scores
where player_id = 'b91ec0c5-999f-4408-8cc7-587bb0c065c5';

-- ============================================================================
-- Schritt 2: SELECT-Ergebnisse am 2026-08-17 gegengeprueft
-- ============================================================================
-- saves:      1 Zeile, level=1/best_score=0/total_runs=0, updated_at 07:01:12
--             UTC - unbespielter Testdatensatz, wie erwartet.
-- sync_codes: 1 Zeile, code=67N0B2, save_id passt zur obigen saves-Zeile,
--             created_at 07:01:13 UTC - eine Sekunde nach dem saves-Eintrag.
-- scores:     keine Zeile - kein verknuepfter Ranglisteneintrag vorhanden,
--             der TODO-Hinweis "Score-Eintrag" liess sich nicht bestaetigen.
--             Nur zwei DELETEs noetig, nicht drei.

delete from public.sync_codes where code = '67N0B2';
delete from public.saves where id = 'b91ec0c5-999f-4408-8cc7-587bb0c065c5';
