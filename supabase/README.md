# Supabase-Migrationen

Diese Dateien beschreiben den Serverteil von isiHunt: Tabellen, Zugriffsregeln
und die RPC-Funktionen, über die das Spiel mit der Datenbank spricht.

**Warum es diese Datei gibt.** `docs/ARCHITECTURE.md` nannte lange nur
`schema.sql` — tatsächlich liegen hier einundzwanzig Dateien, die aufeinander
aufbauen. Wer die Datenbank neu aufsetzen musste, fand keine Reihenfolge
(Audit 2026-08-23).

## Reihenfolge

**Der Zahlenteil im Dateinamen ist die Reihenfolge, nicht die
alphabetische Sortierung.** `phase_2_6` läuft vor `phase_2_10`.

Auf einer leeren Datenbank in dieser Reihenfolge einspielen:

| #   | Datei                                        | Bringt                                                            |
| --- | -------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `schema.sql`                                 | Tabellen `scores`, `saves`, `sync_codes` samt RLS                 |
| 2   | `phase_2_6_auth.sql`                         | `profiles`, `profile_progress`, Anmeldung, Fortschritt            |
| 3   | `phase_2_7_admin_tools.sql`                  | `admin_reset_user`, `admin_boost_user` (prüfen `is_admin`)        |
| 4   | `phase_2_8_unify_identity.sql`               | Anonyme Ranglisteneinträge ans Login-Profil binden                |
| 5   | `phase_2_9_fix_auth_email_sync.sql`          | Korrektur der E-Mail-Synchronisation                              |
| 6   | `phase_2_10_lock_saves_access.sql`           | Direktzugriff auf `saves` sperren, nur noch über RPC              |
| 7   | `phase_2_11_duel_rooms.sql`                  | `duel_rooms`, Raumcodes, Realtime-Autorisierung                   |
| 8   | `phase_2_12_reset_shop.sql`                  | Ladenbesitz beim Reset mit abräumen                               |
| 9   | `phase_2_13_daily_key_window.sql`            | Zeitfenster des Tageslaufs                                        |
| 10  | `phase_2_14_balance_chain.sql`               | `balance_config()` und die Rechenfunktionen darauf                |
| 11  | `phase_2_15_cosmetic_sync.sql`               | Atomarer Geräteabgleich für Ladenkäufe                            |
| 12  | `phase_2_16_admin_boost_balance_anchor.sql`  | Admin-Boost rechnet über die Balance-Kette                        |
| 13  | `phase_2_17_duel_round_results.sql`          | Rundenergebnisse des Netzwerk-Duells                              |
| 14  | `phase_2_18_save_version_anchor.sql`         | `save_version()` als einzige Quelle der Spielstand-Version        |
| 15  | `phase_2_19_talent_max_rank_from_config.sql` | Maximalränge aus der Balance-Kette statt abgetippt                |
| 16  | `phase_2_20_duel_realtime_policies.sql`      | Duell-Kanal: Senden und Presence erlauben                         |
| 17  | `phase_2_21_talent_balance_sync.sql`         | Talent-Balance und Kauf-RPC synchronisieren                       |
| 18  | `phase_2_22_talent_power_balance.sql`        | Mathematisch begrenzte Talentwirkungen aktualisieren              |
| 19  | `phase_2_23_talent_points.sql`               | Kostenlose Levelpunkte, kostenloser Reset und Testprofil-Neustart |
| 20  | `phase_2_24_score_balance.sql`               | Hoehere Reliktpunkte und staerkere Serien-Jackpots                |
| 21  | `phase_2_25_cosmetic_coin_sync.sql`          | Shop-Ausgaben beim Kosmetik-Sync serverseitig nachbuchen          |
| 22  | `phase_2_26_uncapped_series.sql`             | Serien-Multiplikator wächst nach Serie 16 ohne Obergrenze         |
| 23  | `phase_2_27_security_hardening.sql`          | Admin-/Reward-/Save-/Leaderboard-Hardening                        |
| 24  | `phase_2_28_integrity_hardening.sql`         | Account-Outbox, Save-CAS, Tagesbonus- und Duell-Integrität        |
| 25  | `phase_2_29_exploit_hardening.sql`           | Tagesbonus-/Sync-Code-Replay und Progress-Farming begrenzen       |
| 26  | `phase_2_30_auth_catalog_limits.sql`         | Auth-/Shop-Härtung und Grenzen für öffentliche RPC-Payloads       |
| 27  | `phase_2_31_duel_leaderboard_outbox.sql`     | Server-Seed, Duell-Ergebnis- und Leaderboard-Nachweis             |
| 28  | `phase_2_32_migration_state.sql`             | Reproduzierbarer Marker fuer den ausgefuehrten Migrationsstand    |
| 29  | `phase_2_33_leaderboard_auth_only.sql`       | Bestenliste nur fuer authentifizierte Profile beschreibbar        |
| 30  | `phase_2_34_player_name_rules.sql`           | Spielernamen bereinigen und serverseitig begrenzen               |
| 31  | `phase_2_35_duel_talents_rematch.sql`        | Temporaere Duell-Talente und Rematch im selben Raum               |

`phase_2_23_talent_points.sql` enthält einen historischen globalen
Testdaten-Reset. Das Skript bricht ohne ausdrückliches Opt-in ab. Nur wenn
dieser Reset wirklich gewollt ist, vorher in derselben SQL-Editor-Sitzung
ausführen: `set app.isihunt_allow_test_reset = 'on';`.

## Wiederholbarkeit und Migrationshistorie

Die historischen Umbenennungen in `phase_2_24` und `phase_2_26` sind
idempotent geschützt: Ein zweiter Lauf überspringt ein bereits vollzogenes
`RENAME`, statt die ganze Migration an einem existierenden Zielnamen scheitern
zu lassen. Die inhaltliche Historie bleibt dabei erhalten.

Für neue Korrekturen gilt weiterhin: Eine bereits ausgeführte Migration nicht
inhaltlich umschreiben, sondern eine **neue** Migration anlegen, die die
betroffene Funktion per `create or replace` ersetzt.

`phase_2_23_talent_points.sql` ist die bewusste Ausnahme für einen
Sicherheits-Guard: Der historische Reset bleibt inhaltlich unverändert, läuft
aber ohne explizites Sitzungs-Opt-in nicht mehr an. Das kann bereits gelöschte
Daten nicht zurückholen; dafür ist die read-only Inventur vor dem Live-Run
verbindlich.

Das hat einen Preis, der zweimal zugeschlagen hat: `create or replace` ersetzt
genau die benannten Funktionen, **nicht die Datei**. Wer in einer neuen
Migration eine Konstante hochzieht, hat sie nur in den dort ersetzten
Funktionen hochgezogen — die übrigen Definitionen der Vorgängerdatei bleiben
unverändert aktiv und widersprechen ihr ab sofort. Genau so entstand der
Spielstand-Versionsfehler, den `phase_2_18` behebt.

**Beim Ersetzen einer Funktion deshalb prüfen:** Welche anderen Funktionen der
Vorgängerdatei teilen dieselbe Konstante?

## Einmalige Aufräumskripte

Nicht Teil der Reihenfolge, nur bei Bedarf und bewusst:

- `cleanup_leaderboard.sql` — Bestenliste leeren
- `cleanup_2026-08-17_test_leftovers.sql` — Testdaten eines konkreten Tages
- `maintenance_reset_except_byi77.sql` — alle Profile bis auf eines zurücksetzen
- `rename_leaderboard_name.sql` — einmalige Umbenennung

## Was von hier aus geprüft wird

| Gate                    | Hält gleich                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run save:version`  | `SAVE_VERSION` (TS) und `save_version()` (Postgres)    |
| `npm run balance:check` | `balance-data.json` und der JSON-Block in `phase_2_14` |
| `npm run sql:check`     | Verträge, Signaturen und Migrationsmarker              |

Alle drei laufen in den Release-Gates mit. `supabase/verify_migration_state.sql`
ist nach dem Live-Lauf zusätzlich im SQL-Editor auszuführen und zusammen mit
`verify_security_hardening.sql` als Abnahmebeleg zu sichern. Wer `balance-data.json` ändert, überträgt
mit `npm run balance:sync` und legt die geänderte SQL-Datei in denselben Commit.
