import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFile(resolve(root, file), 'utf8');

const [packageJson, gameConfig, balance, migrationCheck, fixtures] = await Promise.all([
  read('package.json').then(JSON.parse),
  read('src/config/GameConfig.ts'),
  read('src/config/balance.ts'),
  read('supabase/verify_migration_state.sql'),
  read('scripts/p0-a-regression-fixtures.json').then(JSON.parse),
]);

const saveVersion = Number(gameConfig.match(/SAVE_VERSION\s*=\s*(\d+)/)?.[1]);
const expectedSchema = Number(migrationCheck.match(/schema_version\s*=\s*(\d+)/)?.[1]);
const baselineDate = balance.match(/capturedAt:\s*'([^']+)'/)?.[1] ?? 'unbekannt';
const fixture = fixtures.cases?.[0];
const collectedTotal = Object.values(fixture?.collected ?? {}).reduce(
  (sum, value) => sum + value,
  0,
);

const checks = [
  ['App-Version vorhanden', typeof packageJson.version === 'string'],
  ['Spielstand-Version vorhanden', Number.isInteger(saveVersion)],
  ['Schema-Erwartungsstand vorhanden', Number.isInteger(expectedSchema)],
  ['Balance-Baseline datiert', baselineDate !== 'unbekannt'],
  ['Regression-Fixture anonymisiert', fixtures.source === 'TODO_2026-09-20.md P0-00'],
  ['Relikt-Summe 207', collectedTotal === fixture.expected.mustPreserveCollectedTotal],
];

for (const [label, ok] of checks) console.log(`${ok ? 'OK' : 'FEHLER'}: ${label}`);
console.log(`App-Version: ${packageJson.version}`);
console.log(`Spielstand-Version: ${saveVersion}`);
console.log(`Schema-Erwartung aus verify_migration_state.sql: ${expectedSchema}`);
console.log(`Balance-Baseline: ${baselineDate}`);
console.log(`Fixture-Fälle: ${fixtures.cases?.length ?? 0}`);

if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
