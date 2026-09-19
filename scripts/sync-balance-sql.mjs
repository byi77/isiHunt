/**
 * Traegt `balance-data.json` in die Supabase-Migration ein - oder prueft nur.
 *
 * ## Warum es den Pruefmodus gibt
 *
 * Der Server rechnet Talentkosten und Coin-Preise aus seiner **eigenen**
 * Kopie der Balance-Daten (`balance_config()`, gelesen von `purchase_talent`).
 * Der Client rechnet mit `balance-data.json`. Laufen die beiden auseinander,
 * zeigt der Laden einen Preis und der Server bucht einen anderen ab.
 *
 * Welche Migration die geltende Fassung traegt, ermittelt das Skript selbst -
 * siehe `findeAktuellsteBalanceConfig()`.
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

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NUR_PRUEFEN = process.argv.includes('--check');
const dataPath = fileURLToPath(new URL('../src/config/balance-data.json', import.meta.url));
const sqlDir = fileURLToPath(new URL('../supabase', import.meta.url));

/**
 * Die zuletzt gueltige Definition von `balance_config()` finden.
 *
 * Frueher stand hier fest `phase_2_14_balance_chain.sql`. Das war richtig,
 * solange nur diese eine Datei die Funktion definierte - inzwischen
 * ueberschreiben sie acht. Der Sync schrieb weiter in die aelteste, die
 * spaetere Migration setzte ihre eigene Fassung darueber, und der Server
 * rechnete mit Zahlen, die niemand mehr gepflegt hatte. Aufgefallen ist es,
 * als `runBonus` in der Konfiguration fehlte und die serverseitige
 * Praemienrechnung daraufhin stumm null lieferte.
 *
 * Phase 2.14 darf ausserdem gar nicht erneut ausgefuehrt werden: Sie enthaelt
 * ueberholte RPC-Definitionen (siehe Kopf von `phase_2_51_luck_balance.sql`).
 * Eine Aenderung dort waere also nicht nur wirkungslos, sondern gefaehrlich.
 *
 * Die Reihenfolge ergibt sich aus der Phasennummer, nicht aus dem
 * Dateinamen als Zeichenkette: `phase_2_9` kommt vor `phase_2_14`.
 */
function findeAktuellsteBalanceConfig() {
  const kandidaten = readdirSync(sqlDir)
    .filter((name) => /^phase_2_\d+_.*\.sql$/.test(name))
    .filter((name) =>
      readFileSync(resolve(sqlDir, name), 'utf8').includes(
        'create or replace function public.balance_config',
      ),
    )
    .map((name) => ({ name, phase: Number(/^phase_2_(\d+)_/.exec(name)[1]) }))
    .sort((a, b) => a.phase - b.phase);

  if (kandidaten.length === 0) {
    throw new Error('Keine Migration definiert `balance_config()`.');
  }
  return kandidaten[kandidaten.length - 1].name;
}

const sqlDatei = findeAktuellsteBalanceConfig();
const sqlPath = resolve(sqlDir, sqlDatei);

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
  console.log(`Balance-SQL OK (${sqlDatei}): Client und Server nennen dieselben Zahlen.`);
} else if (NUR_PRUEFEN) {
  console.error('\nBalance-Daten laufen auseinander:\n');
  console.error('  src/config/balance-data.json');
  console.error(`  supabase/${sqlDatei}\n`);
  console.error('Der Server rechnet Talentkosten und Preise aus SEINER Kopie');
  console.error('(`balance_config()`), der Client aus der JSON. Eine Drift laesst den');
  console.error('Laden einen Preis zeigen und den Server einen anderen abbuchen.\n');
  console.error('Uebertragen mit:\n');
  console.error('    npm run balance:sync\n');
  console.error('Die geaenderte SQL-Datei gehoert in denselben Commit.\n');
  process.exit(1);
} else {
  writeFileSync(sqlPath, nextSql);
  console.log(`Balance-SQL aktualisiert: supabase/${sqlDatei}`);
}
