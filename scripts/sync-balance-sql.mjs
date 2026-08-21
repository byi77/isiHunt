import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

if (nextSql !== sql) {
  writeFileSync(sqlPath, nextSql);
  console.log(`Balance-SQL aktualisiert: ${projectRoot}`);
} else {
  console.log('Balance-SQL ist bereits synchron.');
}
