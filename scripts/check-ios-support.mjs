// Ermittelt die iOS-Mindestversion aus dem GEBAUTEN Bundle.
//
// Warum aus dem Bundle und nicht aus dem Quellcode: Vite transpiliert auf
// `target: es2022` und laesst alles darueber unangetastet. Was am Ende im
// Bundle steht - auch aus Abhaengigkeiten wie Phaser oder supabase-js -
// entscheidet, ob ein iPhone die Datei ueberhaupt parsen kann. Ein Blick in
// `src/` wuerde genau die Faelle uebersehen, die von aussen hereinkommen.
//
// Der Check ist bewusst konservativ: Er meldet die hoechste gefundene
// Anforderung. Ein Treffer heisst "diese Funktion ist im Bundle", nicht
// zwingend "sie wird auf jedem Pfad ausgefuehrt" - fuer eine Mindestversion
// ist das die richtige Richtung, weil ein Syntaxfehler die ganze Datei
// killt, egal ob die Zeile je liefe.
//
// Aufruf: npm run ios:check   (setzt einen Build in dist/ voraus)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist/assets';

/**
 * Merkmale mit der iOS-Fassung, ab der Safari sie beherrscht.
 *
 * `syntax: true` bedeutet: Fehlt die Unterstuetzung, scheitert schon das
 * Parsen und die Seite bleibt weiss. Alles andere faellt erst zur Laufzeit
 * auf und nur dann, wenn der Pfad wirklich betreten wird.
 */
const MARKERS = [
  { name: 'Optional Chaining (?.)', ios: '13.4', syntax: true, re: /\?\.[a-zA-Z_[(]/ },
  { name: 'Nullish Coalescing (??)', ios: '13.4', syntax: true, re: /\?\?[^=]/ },
  { name: 'Logical Assignment (??=, ||=)', ios: '14.0', syntax: true, re: /\?\?=|\|\|=|&&=/ },
  {
    name: 'Private Klassenfelder (#x)',
    ios: '14.5',
    syntax: true,
    re: /[^\w#]#[a-zA-Z_]\w*\s*[=;,)]/,
  },
  { name: 'Error cause', ios: '15.0', syntax: false, re: /,\s*\{\s*cause:/ },
  { name: 'Array.prototype.at()', ios: '15.4', syntax: false, re: /\.at\(\s*-?\d/ },
  { name: 'Object.hasOwn()', ios: '15.4', syntax: false, re: /Object\.hasOwn\(/ },
  { name: 'structuredClone()', ios: '15.4', syntax: false, re: /\bstructuredClone\(/ },
  { name: 'Array.findLast()', ios: '15.4', syntax: false, re: /\.findLast(Index)?\(/ },
  // Kein Muster fuer RegExp-Match-Indices (/d): In minifiziertem Code ist ein
  // Regex-Literal nicht zuverlaessig von einer Division zu unterscheiden.
  // Ein Versuch lieferte ausschliesslich Treffer der Form `1/d` aus Phasers
  // Easing-Rechnungen - also nur Rauschen.
  { name: 'Static Init Blocks', ios: '16.4', syntax: true, re: /\bstatic\s*\{/ },
  {
    name: 'Array.toSorted/toReversed',
    ios: '16.4',
    syntax: false,
    re: /\.to(Sorted|Reversed|Spliced)\(/,
  },
  // `console.group(` ausgenommen - das ist seit jeher verfuegbar und war der
  // einzige Treffer, den ein einfaches `.group(` in Phaser fand.
  { name: 'Array.group()', ios: '17.4', syntax: false, re: /(?<!console)\.group(ToMap)?\(/ },
  { name: 'Promise.withResolvers()', ios: '17.4', syntax: false, re: /Promise\.withResolvers/ },
];

/** CSS-Merkmale. Alle mit @supports abgesichert = kein harter Ausschluss. */
const CSS_MARKERS = [
  { name: 'env(safe-area-inset-*)', ios: '11.0', re: /env\(\s*safe-area-inset/ },
  { name: 'dynamische Viewporthoehe (dvh)', ios: '15.4', re: /\ddvh/ },
  { name: 'color-mix()', ios: '16.2', re: /color-mix\(/ },
  { name: ':has()', ios: '15.4', re: /:has\(/ },
];

function cmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

if (!existsSync(DIST)) {
  console.error(`Kein Build gefunden (${DIST}). Zuerst: npm run build`);
  process.exit(1);
}

const files = readdirSync(DIST);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));

const hits = [];

for (const file of js) {
  const source = readFileSync(join(DIST, file), 'utf8');
  for (const m of MARKERS) {
    if (m.re.test(source)) hits.push({ ...m, file, kind: 'JS' });
  }
}
for (const file of css) {
  const source = readFileSync(join(DIST, file), 'utf8');
  for (const m of CSS_MARKERS) {
    if (m.re.test(source)) hits.push({ ...m, file, kind: 'CSS', syntax: false });
  }
}
// Die Seite selbst traegt das CSS inline, deshalb zusaetzlich index.html.
if (existsSync('dist/index.html')) {
  const source = readFileSync('dist/index.html', 'utf8');
  for (const m of CSS_MARKERS) {
    if (m.re.test(source)) hits.push({ ...m, file: 'index.html', kind: 'CSS', syntax: false });
  }
}

// Je Merkmal nur einmal, mit der Datei des ersten Treffers.
const unique = [];
for (const h of hits) {
  if (!unique.some((u) => u.name === h.name)) unique.push(h);
}
unique.sort((a, b) => cmp(b.ios, a.ios));

const blocking = unique.filter((h) => h.syntax);
const runtime = unique.filter((h) => !h.syntax);

const hardMin = blocking.reduce((acc, h) => (cmp(h.ios, acc) > 0 ? h.ios : acc), '0');
const softMin = unique.reduce((acc, h) => (cmp(h.ios, acc) > 0 ? h.ios : acc), '0');

console.log('\nisiHunt - iOS-Mindestversion aus dem gebauten Bundle\n');
console.log(`Geprueft: ${js.length} JS-Datei(en), ${css.length + 1} Stylesheet(s)\n`);

console.log('Blockierend (Syntax - ohne diese bleibt die Seite weiss):');
for (const h of blocking) {
  console.log(`  iOS ${h.ios.padEnd(6)} ${h.name.padEnd(32)} ${h.file}`);
}
if (!blocking.length) console.log('  keine');

console.log('\nZur Laufzeit (faellt nur auf dem betroffenen Pfad auf):');
for (const h of runtime) {
  console.log(`  iOS ${h.ios.padEnd(6)} ${h.name.padEnd(32)} ${h.file}`);
}
if (!runtime.length) console.log('  keine');

console.log('\n' + '-'.repeat(62));
console.log(`Laedt ueberhaupt ab:      iOS ${hardMin}`);
console.log(`Vollstaendig nutzbar ab:  iOS ${softMin}`);
console.log('-'.repeat(62));
console.log(
  '\nMassgeblich ist die zweite Zahl. `structuredClone()` sitzt in\n' +
    'SaveSystem.update() und laeuft damit bei jedem Run-Ende: Zwischen den\n' +
    'beiden Zahlen wuerde das Spiel zwar starten, aber beim ersten Speichern\n' +
    'abbrechen - schlechter als gar nicht erst zu laden.',
);

// Die Grenze wird bewusst festgeschrieben. Steigt sie, weil eine neue
// Abhaengigkeit etwas Moderneres mitbringt, soll das auffallen und nicht
// still passieren - deshalb bricht der Check dann ab.
const ERWARTET = '16.4';
if (cmp(softMin, ERWARTET) > 0) {
  console.error(
    `\nDie Mindestversion ist auf iOS ${softMin} gestiegen (erwartet: ${ERWARTET}).\n` +
      'Entweder die neue Abhaengigkeit ersetzen oder ERWARTET in\n' +
      'scripts/check-ios-support.mjs anheben und die Doku nachziehen.',
  );
  process.exit(1);
}

console.log(`\nUnveraendert bei iOS ${ERWARTET} oder darunter.`);
