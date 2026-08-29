import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sqlDir = resolve(root, 'supabase');
const migration = readFileSync(resolve(sqlDir, 'phase_2_28_integrity_hardening.sql'), 'utf8');
const exploitMigration = readFileSync(resolve(sqlDir, 'phase_2_29_exploit_hardening.sql'), 'utf8');
const authCatalogMigration = readFileSync(
  resolve(sqlDir, 'phase_2_30_auth_catalog_limits.sql'),
  'utf8',
);
const duelLeaderboardMigration = readFileSync(
  resolve(sqlDir, 'phase_2_31_duel_leaderboard_outbox.sql'),
  'utf8',
);
const migrationState = readFileSync(resolve(sqlDir, 'phase_2_32_migration_state.sql'), 'utf8');
const leaderboardAuthMigration = readFileSync(
  resolve(sqlDir, 'phase_2_33_leaderboard_auth_only.sql'),
  'utf8',
);
const playerNameMigration = readFileSync(
  resolve(sqlDir, 'phase_2_34_player_name_rules.sql'),
  'utf8',
);
const duelTalentMigration = readFileSync(
  resolve(sqlDir, 'phase_2_35_duel_talents_rematch.sql'),
  'utf8',
);
const duelLobbyMigration = readFileSync(
  resolve(sqlDir, 'phase_2_36_duel_lobby_invitations.sql'),
  'utf8',
);
const verification = readFileSync(resolve(sqlDir, 'verify_security_hardening.sql'), 'utf8');
const migrationVerification = readFileSync(resolve(sqlDir, 'verify_migration_state.sql'), 'utf8');

const failures = [];
function requireText(text, fragment, label) {
  if (!text.includes(fragment)) failures.push(`${label}: fehlt "${fragment}"`);
}

requireText(migration, 'add column if not exists daily_key text', 'Tages-Event-Spalte');
requireText(migration, 'daily_key is distinct from p_daily_key', 'Tages-Event-Identitaet');
requireText(
  migration,
  'drop function if exists public.claim_daily_bonus(text, integer, uuid)',
  'alter Tagesbonus-Signatur',
);
requireText(
  migration,
  'create or replace function public.claim_daily_bonus(\n  p_daily_key text,\n  p_event_id uuid',
  'neue Tagesbonus-Signatur',
);
requireText(migration, 'event_daily_key is distinct from p_daily_key', 'Tagesbonus-Eventbindung');
requireText(
  migration,
  "server_daily_key text := to_char((now() at time zone 'UTC')::date",
  'serverseitiger Login-Tag',
);
requireText(
  migration,
  'create or replace function public.claim_daily_login_bonus()',
  'Loginbonus ohne Client-Tag',
);
requireText(migration, 'p_expected_updated_at timestamptz', 'Save-CAS-Parameter');
requireText(migration, "using errcode = '40001'", 'Save-CAS-Konflikt');
requireText(migration, 'add column if not exists host_token_hash text', 'Duell-Host-Token');
requireText(migration, 'add column if not exists guest_token_hash text', 'Duell-Gast-Token');
requireText(migration, 'p_participant_token text', 'Duell-Teilnehmer-Token');
requireText(migration, 'duel_channel_is_authorized', 'Duell-Realtime-Bindung');
requireText(
  migration,
  'revoke all on public.duel_rooms from anon, authenticated',
  'Duell-Tabellenschutz',
);
requireText(exploitMigration, 'daily_bonus_claims', 'Einmaliger Tagesbonus');
requireText(exploitMigration, 'redeemed_at', 'Einmaliger Sync-Code');
requireText(exploitMigration, 'profile_progress_event_cooldown', 'Progress-Drosselung');
requireText(authCatalogMigration, 'cosmetic_catalog', 'Kosmetik-Katalog');
requireText(authCatalogMigration, 'save_payload_limits', 'Save-Payload-Grenze');
requireText(authCatalogMigration, 'duel_room_limits', 'Duell-Payload-Grenze');
requireText(duelLeaderboardMigration, 'server_seed', 'Server-Duell-Seed');
requireText(duelLeaderboardMigration, 'max_plausible_score', 'Duell-Ergebnispruefung');
requireText(duelLeaderboardMigration, 'authenticated_score_evidence', 'Leaderboard-Nachweis');
requireText(migrationState, 'isihunt_schema_state', 'Migrationsmarker-Tabelle');
requireText(migrationState, 'schema_version, migration_name', 'Migrationsmarker-Version');
requireText(
  migrationState,
  'Migrationsstand unvollstaendig',
  'Migrationsstand-Vollstaendigkeitspruefung',
);
requireText(leaderboardAuthMigration, 'from anon', 'Anonyme Bestenlisten-Sperre');
requireText(leaderboardAuthMigration, 'schema_version = 33', 'Migrationsmarker Phase 2.33');
requireText(playerNameMigration, 'normalize_player_name', 'Spielernamen-Normalisierung');
requireText(
  playerNameMigration,
  "regexp_replace(raw_name, '[^0-9]', '', 'g')) > 4",
  'Spielernamen-Ziffernlimit',
);
requireText(playerNameMigration, 'schema_version = 34', 'Migrationsmarker Phase 2.34');
requireText(duelTalentMigration, 'submit_duel_talent_draft', 'Duell-Talent-Build-RPC');
requireText(duelTalentMigration, 'request_duel_rematch', 'Duell-Rematch-RPC');
requireText(duelTalentMigration, 'schema_version = 35', 'Migrationsmarker Phase 2.35');
requireText(duelLobbyMigration, 'duel_invitations', 'Duell-Einladungstabelle');
requireText(duelLobbyMigration, 'create_duel_invitation', 'Duell-Einladungserzeuger');
requireText(duelLobbyMigration, 'accept_duel_invitation', 'Duell-Einladungsannahme');
requireText(duelLobbyMigration, 'invite_only', 'Invite-only-Raumzugriff');
requireText(duelLobbyMigration, 'schema_version = 36', 'Migrationsmarker Phase 2.36');

const migrationFiles = readdirSync(sqlDir).filter((name) =>
  /^phase_2_(2[89]|30|31|32|33|34|35|36)_.*\.sql$/.test(name),
);
for (const file of migrationFiles) {
  const content = readFileSync(resolve(sqlDir, file), 'utf8').toLowerCase();
  if (!content.includes('begin;') || !content.includes('commit;')) {
    failures.push(`${file}: Migration muss BEGIN/COMMIT enthalten`);
  }
}

requireText(verification, 'daily_key', 'Live-Verifikation Tagesbonus');
requireText(verification, 'upsert_save', 'Live-Verifikation Save-CAS');
requireText(verification, 'duel_rooms', 'Live-Verifikation Duell');
requireText(migrationVerification, 'schema_version', 'Live-Verifikation Migrationsmarker');

if (failures.length > 0) {
  console.error('SQL-Vertragspruefung fehlgeschlagen:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `SQL-Vertrag OK: ${migrationFiles.length} transaktionale Integrity-Migration geprueft.`,
  );
}
