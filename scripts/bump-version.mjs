/**
 * Zieht die Patch-Version in package.json um eins hoch.
 *
 * Wird vom `pre-commit`-Hook aufgerufen (siehe .githooks/pre-commit), damit
 * jeder Commit eine eigene, im Spiel sichtbare Versionsnummer traegt.
 *
 * ## Warum ueberhaupt eine Versionsnummer im Spiel
 *
 * Beim Testen auf dem Handy ist die haeufigste Frage: "Ist das gerade der neue
 * Stand oder haengt noch der alte im Cache?" Ohne sichtbare Nummer laesst sich
 * das nicht beantworten - und ein Fehlerbericht zu einem alten Stand kostet
 * mehr Zeit als die Nummer je gekostet hat.
 *
 * ## Warum ein Skript und kein `npm version`
 *
 * `npm version` legt zusaetzlich einen Git-Tag an und committet selbst. Beides
 * ist in einem pre-commit-Hook falsch: Der Commit laeuft ja gerade, und Tags
 * fuer jeden einzelnen Commit waeren Laerm.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = join(root, 'package.json');

const raw = readFileSync(packagePath, 'utf8');
const pkg = JSON.parse(raw);

const [major, minor, patch] = String(pkg.version)
  .split('.')
  .map((part) => Number.parseInt(part, 10));

if ([major, minor, patch].some(Number.isNaN)) {
  console.error(`[bump-version] Unlesbare Version: ${pkg.version}`);
  process.exit(1);
}

const next = `${major}.${minor}.${patch + 1}`;

// Gezielt nur die erste "version"-Zeile ersetzen statt die Datei neu zu
// serialisieren: JSON.stringify wuerde Reihenfolge und Formatierung
// umschreiben und jeden Commit mit Rauschen fuellen.
const updated = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);

if (updated === raw) {
  console.error('[bump-version] Feld "version" nicht gefunden.');
  process.exit(1);
}

writeFileSync(packagePath, updated);
console.log(`[bump-version] ${pkg.version} -> ${next}`);
