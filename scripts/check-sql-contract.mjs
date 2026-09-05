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
const duelLeaderboardRankingMigration = readFileSync(
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
const duelSharedTopicMigration = readFileSync(
  resolve(sqlDir, 'phase_2_37_duel_shared_realtime_topic.sql'),
  'utf8',
);
const duelFourPlayerMigration = readFileSync(
  resolve(sqlDir, 'phase_2_38_duel_four_player_lobby.sql'),
  'utf8',
);
const duelMultiInviteMigration = readFileSync(
  resolve(sqlDir, 'phase_2_39_duel_lobby_multi_invites.sql'),
  'utf8',
);
const duelInvitationListingFixMigration = readFileSync(
  resolve(sqlDir, 'phase_2_40_fix_duel_invitation_listing.sql'),
  'utf8',
);
const duelInvitationAcceptFixMigration = readFileSync(
  resolve(sqlDir, 'phase_2_41_fix_duel_invitation_accept.sql'),
  'utf8',
);
const duelInitialTalentDraftMigration = readFileSync(
  resolve(sqlDir, 'phase_2_42_duel_initial_talent_draft.sql'),
  'utf8',
);
const duelRoomLeaveMigration = readFileSync(
  resolve(sqlDir, 'phase_2_43_duel_room_leave.sql'),
  'utf8',
);
const duelLeaderboardMigration = readFileSync(
  resolve(sqlDir, 'phase_2_44_duel_leaderboard.sql'),
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
requireText(duelLeaderboardRankingMigration, 'server_seed', 'Server-Duell-Seed');
requireText(duelLeaderboardRankingMigration, 'max_plausible_score', 'Duell-Ergebnispruefung');
requireText(
  duelLeaderboardRankingMigration,
  'authenticated_score_evidence',
  'Leaderboard-Nachweis',
);
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
requireText(
  duelSharedTopicMigration,
  'duel_channel_is_authorized',
  'Gemeinsamer Duell-Realtime-Kanal',
);
requireText(duelSharedTopicMigration, "seed = split_part(p_topic, ':', 2)", 'Realtime-Seedbindung');
requireText(duelSharedTopicMigration, 'schema_version = 36', 'Migrationsguard Phase 2.37');
requireText(duelSharedTopicMigration, 'schema_version = 37', 'Migrationsmarker Phase 2.37');
requireText(duelFourPlayerMigration, 'duel_room_participants', 'Mehrspieler-Teilnehmertabelle');
requireText(duelFourPlayerMigration, 'p_max_players integer', 'Mehrspieler-Raumkapazitaet');
requireText(duelFourPlayerMigration, 'set_duel_start_time', 'Host-Start-RPC');
requireText(duelFourPlayerMigration, 'schema_version = 37', 'Migrationsguard Phase 2.38');
requireText(duelFourPlayerMigration, 'schema_version = 38', 'Migrationsmarker Phase 2.38');
requireText(duelMultiInviteMigration, 'duel_invitations_room_uidx', 'Alte Raum-Eindeutigkeit');
requireText(duelMultiInviteMigration, 'duel_room_participants', 'Einladungs-Slot-Pruefung');
requireText(duelMultiInviteMigration, 'schema_version = 38', 'Migrationsguard Phase 2.39');
requireText(duelMultiInviteMigration, 'schema_version = 39', 'Migrationsmarker Phase 2.39');
requireText(
  duelInvitationListingFixMigration,
  'update public.duel_invitations as i',
  'Eindeutige Ablaufspalte im Einladungslisting',
);
requireText(
  duelInvitationListingFixMigration,
  'i.expires_at <= now()',
  'Qualifizierte Ablaufpruefung im Einladungslisting',
);
requireText(duelInvitationListingFixMigration, 'schema_version = 39', 'Migrationsguard Phase 2.40');
requireText(
  duelInvitationListingFixMigration,
  'schema_version = 40',
  'Migrationsmarker Phase 2.40',
);
requireText(
  duelInvitationAcceptFixMigration,
  'from public.duel_rooms as r',
  'Qualifizierte Raumabfrage im Einladungsaccept',
);
requireText(
  duelInvitationAcceptFixMigration,
  'where r.code = invitation.room_code and r.expires_at > now()',
  'Eindeutige Raumspalten im Einladungsaccept',
);
requireText(duelInvitationAcceptFixMigration, 'schema_version = 40', 'Migrationsguard Phase 2.41');
requireText(duelInvitationAcceptFixMigration, 'schema_version = 41', 'Migrationsmarker Phase 2.41');
requireText(
  duelInitialTalentDraftMigration,
  'add column if not exists talent_draft_started_at timestamptz',
  'Persistenter Start der Talentphase',
);
requireText(
  duelInitialTalentDraftMigration,
  'start_duel_talent_draft',
  'RPC zum Start der Talentphase',
);
requireText(
  duelInitialTalentDraftMigration,
  'talent_ready_count',
  'Mehrspieler-Talentbereitschaft',
);
requireText(
  duelInitialTalentDraftMigration,
  'Alle Spieler muessen ihren Talent-Build bestaetigen',
  'Servergate vor dem Duellstart',
);
requireText(duelInitialTalentDraftMigration, 'schema_version = 41', 'Migrationsguard Phase 2.42');
requireText(duelInitialTalentDraftMigration, 'schema_version = 42', 'Migrationsmarker Phase 2.42');
requireText(duelRoomLeaveMigration, 'leave_duel_room', 'Duellraum sofort verlassen');
requireText(duelRoomLeaveMigration, 'schema_version = 42', 'Migrationsguard Phase 2.43');
requireText(duelRoomLeaveMigration, 'schema_version = 43', 'Migrationsmarker Phase 2.43');
requireText(duelLeaderboardMigration, 'duel_leaderboard', 'Mehrspieler-Duellrangliste');
requireText(duelLeaderboardMigration, 'record_duel_leaderboard_match', 'Duellwertungstrigger');
requireText(duelLeaderboardMigration, 'get_duel_leaderboard', 'Duellranglisten-RPC');
requireText(duelLeaderboardMigration, 'schema_version = 43', 'Migrationsguard Phase 2.44');
requireText(duelLeaderboardMigration, 'schema_version = 44', 'Migrationsmarker Phase 2.44');

const cosmeticFixMigration = readFileSync(
  resolve(sqlDir, 'phase_2_45_fix_cosmetic_sync_ambiguity.sql'),
  'utf8',
);
const duelResultGraceMigration = readFileSync(
  resolve(sqlDir, 'phase_2_46_duel_result_grace.sql'),
  'utf8',
);
const botVictoryMigration = readFileSync(
  resolve(sqlDir, 'phase_2_47_bot_victory_bonus.sql'),
  'utf8',
);

requireText(cosmeticFixMigration, 'cosmetic_id', 'Kosmetik-Schleifenvariable ohne Namenskonflikt');
requireText(cosmeticFixMigration, 'schema_version = 44', 'Migrationsguard Phase 2.45');
requireText(cosmeticFixMigration, 'schema_version = 45', 'Migrationsmarker Phase 2.45');
requireText(
  duelResultGraceMigration,
  'duel_result_slot',
  'Ergebnisannahme getrennt vom Lobby-Ablauf',
);
requireText(duelResultGraceMigration, 'duel_result_grace', 'Abschlussfenster fuer Duellergebnisse');
requireText(duelResultGraceMigration, 'schema_version = 45', 'Migrationsguard Phase 2.46');
requireText(duelResultGraceMigration, 'schema_version = 46', 'Migrationsmarker Phase 2.46');
requireText(botVictoryMigration, 'claim_bot_victory_bonus', 'Serverseitige Bot-Siegpraemie');
requireText(botVictoryMigration, 'bot_victory_claims', 'Doppelbuchungsschutz fuer Bot-Siege');
requireText(botVictoryMigration, 'schema_version = 46', 'Migrationsguard Phase 2.47');
requireText(botVictoryMigration, 'schema_version = 47', 'Migrationsmarker Phase 2.47');

/*
 * AUDIT_2026-09-05, Befund 1: In phase_2_30 hiess eine PL/pgSQL-Variable wie
 * die Ergebnisspalte von `jsonb_array_elements_text`. PostgreSQL bricht das
 * zur Laufzeit mit 42702 ab - die Funktion war fuer JEDES Profil unaufrufbar,
 * und dieses Gate blieb trotzdem gruen, weil es nur Textfragmente sucht.
 *
 * Diese Pruefung ist die kleinstmoegliche Abhilfe ohne Datenbank: Eine
 * `declare`-Variable, die genauso heisst wie eine unqualifizierte
 * Ergebnisspalte im selben Rumpf, ist immer ein Fehler. Sie ersetzt keinen
 * echten Integrationstest gegen PostgreSQL - siehe
 * docs/ARCHITECTURE.md 9.2.
 */
const AMBIGUOUS_COLUMN_NAMES = ['value', 'key', 'id', 'name'];

/*
 * Geprueft wird nur die JEWEILS LETZTE Definition einer Funktion.
 *
 * Migrationen sind ein Verlauf: `sync_profile_cosmetics` trug diesen Fehler
 * von Phase 2.15 bis 2.30 und wird in 2.45 korrigiert. Die alten Dateien
 * bleiben unveraendert - was zaehlt, ist die Definition, die am Ende in der
 * Datenbank steht.
 */
const latestDefinition = new Map();
const migrationOrder = readdirSync(sqlDir)
  .filter((name) => name.endsWith('.sql'))
  .sort((a, b) => {
    const phase = (name) => {
      const match = /^phase_2_(\d+)_/.exec(name);
      return match ? Number(match[1]) : -1;
    };
    return phase(a) - phase(b) || a.localeCompare(b);
  });

for (const file of migrationOrder) {
  const content = readFileSync(resolve(sqlDir, file), 'utf8').toLowerCase();
  // Jeden Funktionsrumpf einzeln fassen: eine Datei definiert oft mehrere.
  const pattern = /create or replace function\s+(public\.[a-z_]+)\s*\(([\s\S]*?)\n\$\$;/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    latestDefinition.set(match[1], { file, body: match[2] });
  }
}

for (const [functionName, { file, body }] of latestDefinition) {
  for (const name of AMBIGUOUS_COLUMN_NAMES) {
    const declared = new RegExp(
      String.raw`^\s*${name}\s+(text|jsonb|integer|bigint|numeric)\b`,
      'm',
    );
    const usedAsColumn = new RegExp(String.raw`select\s+${name}\s+from\s+jsonb_`, 'm');
    if (declared.test(body) && usedAsColumn.test(body)) {
      failures.push(
        `${file}: ${functionName} - Variable "${name}" kollidiert mit einer ` +
          'Ergebnisspalte (PostgreSQL 42702)',
      );
    }
  }
}

const migrationFiles = readdirSync(sqlDir).filter((name) =>
  /^phase_2_(2[89]|3[0-9]|4[0-7])_.*\.sql$/.test(name),
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
