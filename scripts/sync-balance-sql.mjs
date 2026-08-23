/**
 * Traegt `balance-data.json` in die Supabase-Migration ein - oder prueft nur.
 *
 * ## Warum es den Pruefmodus gibt
 *
 * Der Server rechnet Talentkosten und Coin-Preise aus seiner **eigenen**
 * Kopie der Balance-Daten (`balance_config()` in
 * `phase_2_14_balance_chain.sql`, gelesen von `purchase_talent`). Der Client
 * rechnet mit `balance-data.json`. Laufen die beiden auseinander, zeigt der
 * Laden einen Preis und der Server bucht einen anderen ab.
 *
 * Dieses Skript hielt sie synchron - aber nur, wenn jemand daran dachte, es
 * zu starten. Es lief nirgends verpflichtend, und die Absicherung war damit
 * Gewohnheit statt Mechanismus. Mit `--check` laeuft es jetzt in `verify`
 * mit und meldet die Drift, statt sie stillschweigend zu reparieren
 * (Audit 2026-08-23).
 *
 *     node scripts/sync-balance-sql.mjs           schreibt (npm run balance:sync)
 *     node scripts/sync-balance-sql.mjs --check   prueft   (npm run balance:check)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NUR_PRUEFEN = process.argv.includes('--check');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const dataPath = fileURLToPath(new URL('../src/config/balance-data.json', import.meta.url));
const sqlPath = fileURLToPath(new URL('../supabase/phase_2_14_balance_chain.sql', import.meta.url));

const balance = JSON.parse(readFileSync(dataPath, 'utf8'));
const sql = readFileSync(sqlPath, 'utf8');
const start = sql.indexOf('  select $json$');
const endMarker = '  $json$::jsonb;';
const end = sql.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('Balance-JSON-Block in der Supabase-Migration nicht gefunden.');
}

const json = JSON.stringify(balance, null, 2)
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n');
const replacement = `  select $json$\n${json}\n${endMarker}`;
const nextSql = sql.slice(0, start) + replacement + sql.slice(end + endMarker.length);

if (nextSql === sql) {
  console.log('Balance-SQL OK: Client und Server nennen dieselben Zahlen.');
} else if (NUR_PRUEFEN) {
  console.error('\nBalance-Daten laufen auseinander:\n');
  console.error('  src/config/balance-data.json');
  console.error('  supabase/phase_2_14_balance_chain.sql\n');
  console.error('Der Server rechnet Talentkosten und Preise aus SEINER Kopie');
  console.error('(`balance_config()`), der Client aus der JSON. Eine Drift laesst den');
  console.error('Laden einen Preis zeigen und den Server einen anderen abbuchen.\n');
  console.error('Uebertragen mit:\n');
  console.error('    npm run balance:sync\n');
  console.error('Die geaenderte SQL-Datei gehoert in denselben Commit.\n');
  process.exit(1);
} else {
  writeFileSync(sqlPath, nextSql);
  console.log(`Balance-SQL aktualisiert: ${projectRoot}`);
}
