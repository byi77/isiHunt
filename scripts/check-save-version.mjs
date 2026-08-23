/**
 * Haelt die Spielstand-Version auf beiden Seiten gleich.
 *
 * ## Warum es dieses Gate gibt
 *
 * `SAVE_VERSION` (TypeScript) und `save_version()` (Postgres) beschreiben
 * dieselbe Zahl. Sie stand vier Mal von Hand in den SQL-Migrationen; eine
 * spaetere Migration zog zwei Vorkommen auf 8 hoch, die anderen zwei blieben
 * bei 6 - und widersprachen ihr ab da, ohne sich je zu melden.
 *
 * Die Folge war ein echter Datenverlust: Der Client wertet alles unter 7 als
 * "XP-Kurve noch nicht umgerechnet" und rechnete bereits umgerechnete XP ein
 * zweites Mal um. Gemessen: Stufe 30 wurde zu Stufe 23 (Audit 2026-08-23).
 *
 * Ein zu niedriger Marker ist dabei die gefaehrliche Richtung: Er loest
 * Migrationen erneut aus. Deshalb prueft dieses Gate auf Gleichheit, nicht
 * nur auf Vorhandensein.
 *
 * ## Was ausdruecklich NICHT geprueft wird (deklarierte Grenzen)
 *
 * - **Nur der Anker `save_version()`**, nicht jede Stelle, die eine Version
 *   schreibt. Wer eine neue Zahl direkt hinschreibt statt die Funktion zu
 *   rufen, faellt durch das Raster - die Pruefung unten auf hartkodierte
 *   Versionsschreibvorgaenge faengt den haeufigen Fall ab, aber nicht jede
 *   denkbare Schreibweise.
 * - **Kein Abgleich mit der laufenden Datenbank.** Das Gate liest die
 *   Migrationsdateien im Repo. Ob sie ausgefuehrt wurden, beantwortet es
 *   nicht - dafuer gibt es `npm run deploy:wait` und den Debug-Bericht.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sqlDir = join(root, 'supabase');

const ts = readFileSync(join(root, 'src/config/GameConfig.ts'), 'utf8');
const tsTreffer = ts.match(/export const SAVE_VERSION\s*=\s*(\d+)/);
if (!tsTreffer) {
  console.error('SAVE_VERSION in src/config/GameConfig.ts nicht gefunden.');
  process.exit(1);
}
const tsVersion = Number(tsTreffer[1]);

const dateien = readdirSync(sqlDir).filter((n) => n.endsWith('.sql'));

// Der Anker: die zuletzt definierte Fassung gewinnt, wie in Postgres auch
// (`create or replace` in Migrationsreihenfolge).
let sqlVersion = null;
let ankerDatei = null;
for (const name of dateien.sort()) {
  const inhalt = readFileSync(join(sqlDir, name), 'utf8');
  // Eng gefasst: der Rumpf der Anker-Funktion selbst, nicht irgendein
  // `select` in ihrer Naehe. Ein zu weites Muster fand beim Selbsttest die
  // Zahl aus einer spaeteren Funktion und meldete Gleichheit, wo Divergenz
  // war - genau der Fehler, den dieses Gate verhindern soll.
  const treffer = [
    ...inhalt.matchAll(
      /create or replace function public\.save_version\s*\(\s*\)[\s\S]*?as\s+\$\$\s*select\s+(\d+)\s*\$\$/g,
    ),
  ];
  const letzter = treffer.at(-1);
  if (letzter) {
    sqlVersion = Number(letzter[1]);
    ankerDatei = name;
  }
}

if (sqlVersion === null) {
  console.error('Kein `save_version()` in supabase/*.sql gefunden.');
  console.error('Erwartet wird eine Funktion, die die aktuelle Spielstand-Version liefert.');
  process.exit(1);
}

if (sqlVersion !== tsVersion) {
  console.error('\nSpielstand-Version laeuft auseinander:\n');
  console.error(`  TypeScript  SAVE_VERSION      = ${tsVersion}   (src/config/GameConfig.ts)`);
  console.error(`  Postgres    save_version()    = ${sqlVersion}   (supabase/${ankerDatei})`);
  console.error('\nEin zu niedriger Marker in der Datenbank loest Client-Migrationen erneut aus');
  console.error('und kann dabei Level senken. Beide Seiten muessen dieselbe Zahl nennen.\n');
  process.exit(1);
}

// Zweite Ebene: neue Migrationen sollen die Funktion rufen, nicht eine Zahl
// hinschreiben. Die Altdateien sind ausgenommen - sie sind ausgefuehrt und
// werden bewusst nicht rueckwirkend geaendert; `phase_2_18` ersetzt ihre
// betroffenen Funktionen.
const ALTLASTEN = new Set(['phase_2_6_auth.sql', 'phase_2_14_balance_chain.sql']);
const hartkodiert = [];
for (const name of dateien) {
  if (ALTLASTEN.has(name)) continue;
  const inhalt = readFileSync(join(sqlDir, name), 'utf8');
  for (const [i, zeile] of inhalt.split(/\r?\n/).entries()) {
    if (/'\{version\}'\s*,\s*'\d+'::jsonb/.test(zeile)) {
      hartkodiert.push(`${relative(root, join(sqlDir, name)).replace(/\\/g, '/')}:${i + 1}`);
    }
  }
}

if (hartkodiert.length > 0) {
  console.error('\nHartkodierte Spielstand-Version in einer Migration:\n');
  for (const ort of hartkodiert) console.error(`  ${ort}`);
  console.error('\nStattdessen den Anker rufen:\n');
  console.error('    to_jsonb(public.save_version())\n');
  process.exit(1);
}

console.log(`Spielstand-Version OK: TypeScript und Postgres nennen beide ${tsVersion}.`);
