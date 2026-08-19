// Waehlt anhand der geaenderten Dateien die passende Teststufe.
//
// Ein Volltest dauert rund 20 Minuten, weil er acht echte Runden a 90
// Sekunden spielt. Fuer eine Doku-Aenderung ist das reine Verschwendung, fuer
// einen Eingriff in GameScene ist er das Mindeste. Diese Datei entscheidet,
// was angemessen ist - damit die Wahl nachvollziehbar ist und nicht jedes Mal
// neu aus dem Bauch getroffen wird.
//
//   npm run test:scope            gegen den aktuellen Arbeitsstand
//   npm run test:scope -- HEAD~3  gegen einen anderen Vergleichspunkt
//   npm run test:scope -- --run   fuehrt die ermittelte Stufe gleich aus
import { execSync, spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const auchAusfuehren = argv.includes('--run');
const basis = argv.find((a) => !a.startsWith('--')) ?? null;

/**
 * Die vier Stufen.
 *
 * `suites: null` heisst "kein Browsertest noetig"; `suites: []` gibt es
 * bewusst nicht, damit der Unterschied zwischen "nichts noetig" und "noch
 * nichts entschieden" sichtbar bleibt.
 */
const STUFEN = {
  keine: {
    name: 'kein Codetest',
    dauer: '0 Min',
    suites: null,
    warum: 'nur Dokumentation, Textdateien oder Konfiguration ohne Laufzeitwirkung',
  },
  klein: {
    name: 'klein',
    dauer: '~2 Min',
    suites: ['screens', 'nav'],
    warum: 'die Seite startet, alle Bildschirme oeffnen, die Wege stimmen',
  },
  mittel: {
    name: 'mittel',
    dauer: '~5 Min',
    suites: ['screens', 'nav', 'controls', 'layout'],
    warum: 'zusaetzlich Bedienelemente und Layout ueber 19 Geraeteformate',
  },
  gross: {
    name: 'gross',
    dauer: '~11 Min',
    suites: ['screens', 'nav', 'controls', 'layout', 'progress', 'ios'],
    warum: 'zusaetzlich ein kompletter Run, Persistenz und echtes WebKit',
  },
  voll: {
    name: 'voll',
    dauer: '~20 Min',
    suites: ['screens', 'nav', 'controls', 'layout', 'ios', 'progress', 'modes'],
    warum: 'alle Spielmodi und Welten - acht echte Runden a 90 Sekunden',
  },
};

/**
 * Regeln von oben nach unten; die erste passende gewinnt.
 *
 * Bewusst grob: Lieber eine Stufe zu hoch als eine zu niedrig. Wer eine
 * Aenderung fuer harmloser haelt, als die Regel meint, kann die Stufe von
 * Hand waehlen - der umgekehrte Fall faellt dagegen erst auf dem Geraet auf.
 */
const REGELN = [
  // Alles, was den Spielablauf selbst betrifft.
  {
    re: /^src\/(scenes\/GameScene|systems\/(Spawn|Score|Progression|Challenge)System)/,
    stufe: 'voll',
    grund: 'Spielablauf, Punkte oder Fortschritt',
  },
  {
    re: /^src\/(config\/(GameConfig|worlds|rarities|talents|achievements|challenge)|entities\/)/,
    stufe: 'voll',
    grund: 'Balancing, Welten oder Spielobjekte',
  },

  // Rahmen und Ausspielung: betrifft jede Scene, aber nicht die Spiellogik.
  {
    re: /^(index\.html|src\/main\.ts|vite\.config\.ts|src\/core\/(viewport|display|orientation)\.ts)$/,
    stufe: 'gross',
    grund: 'Seitenrahmen, Canvas-Groesse oder Startpfad',
  },
  {
    re: /^src\/systems\/(Save|SafeArea|Auth|Cloud|ProgressSync)System\.ts$/,
    stufe: 'gross',
    grund: 'Persistenz, Konto oder Netz',
  },

  // Darstellung und Bedienung.
  { re: /^src\/ui\//, stufe: 'mittel', grund: 'gemeinsame Oberflaechenbausteine' },
  { re: /^src\/scenes\//, stufe: 'mittel', grund: 'ein Bildschirm' },
  { re: /^src\/input\//, stufe: 'mittel', grund: 'Eingabe' },

  // Restlicher Quellcode.
  { re: /^src\//, stufe: 'klein', grund: 'sonstiger Quellcode' },
  { re: /^scripts\/playtest\.mjs$/, stufe: 'klein', grund: 'der Playtest selbst' },

  // Ohne Laufzeitwirkung.
  { re: /\.md$/, stufe: 'keine', grund: 'Dokumentation' },
  {
    re: /^(scripts\/|\.githooks\/|\.github\/|eslint\.config\.js|\.gitignore|\.env)/,
    stufe: 'keine',
    grund: 'Werkzeuge und Konfiguration ohne Laufzeitwirkung',
  },
  {
    re: /^(package(-lock)?\.json|tsconfig.*\.json|vitest\.config\.ts)$/,
    stufe: 'keine',
    grund: 'Projektkonfiguration',
  },
];

const RANG = ['keine', 'klein', 'mittel', 'gross', 'voll'];

function geaenderteDateien() {
  const cmd = basis ? `git diff --name-only ${basis}` : 'git status --porcelain=v1';
  // Kein trim() auf die Gesamtausgabe: Porcelain beginnt jede Zeile mit
  // zwei Statuszeichen, bei unstaged Dateien ist das erste ein Leerzeichen.
  // Ein trim() wuerde es an der ersten Zeile abschneiden und den Pfad
  // um ein Zeichen verschieben - aus CHANGELOG.md wurde HANGELOG.md.
  const roh = execSync(cmd, { encoding: 'utf8' }).replace(/\s+$/, '');
  if (!roh) return [];
  return roh
    .split('\n')
    .map((zeile) => {
      if (basis) return zeile.trim();
      const pfad = zeile.slice(3);
      const pfeil = pfad.indexOf(' -> ');
      return (pfeil === -1 ? pfad : pfad.slice(pfeil + 4)).trim();
    })
    .map((z) => z.replace(/^"|"$/g, ''))
    .filter(Boolean);
}

const dateien = geaenderteDateien();

if (dateien.length === 0) {
  console.log('Keine Aenderungen gegenueber ' + (basis ?? 'dem letzten Commit') + '.');
  process.exit(0);
}

let hoechste = 'keine';
const begruendungen = new Map();

for (const datei of dateien) {
  const treffer = REGELN.find((r) => r.re.test(datei));
  // Unbekannte Pfade zaehlen als "klein": lieber einmal zu viel pruefen.
  const stufe = treffer?.stufe ?? 'klein';
  const grund = treffer?.grund ?? 'unbekannter Pfad';
  if (RANG.indexOf(stufe) > RANG.indexOf(hoechste)) hoechste = stufe;
  if (!begruendungen.has(grund)) begruendungen.set(grund, { stufe, datei });
}

const gewaehlt = STUFEN[hoechste];

console.log(`\nGeaenderte Dateien: ${dateien.length}`);
for (const [grund, info] of begruendungen) {
  console.log(`  ${info.stufe.padEnd(7)} ${grund} (z.B. ${info.datei})`);
}

console.log(`\nEmpfohlene Stufe: ${gewaehlt.name} (${gewaehlt.dauer})`);
console.log(`  ${gewaehlt.warum}`);

if (gewaehlt.suites === null) {
  console.log('\nKein Browsertest noetig. `npm run verify` genuegt.');
  process.exit(0);
}

const nurSuiten = `--only=${gewaehlt.suites.join(',')}`;
const befehl = `npm run playtest -- ${nurSuiten}`;
console.log(`\n  ${befehl}`);

// Die langen Stufen kosten ihre Zeit fast nur durch die 90-Sekunden-Runden.
// Wer waehrend der Arbeit eine schnelle Rueckmeldung braucht, faehrt sie
// simuliert; vor Release oder Audit bleibt der Lauf oben massgeblich.
const hatRunden = gewaehlt.suites.includes('modes') || gewaehlt.suites.includes('progress');
if (hatRunden) {
  console.log(`\n  Schneller waehrend der Arbeit (Runden gerechnet statt gespielt):`);
  console.log(`  ${befehl} --sim`);
  console.log(`  Ohne Rendering, Tweens und Bildrate - vor dem Ausliefern den Lauf oben.`);
}

if (auchAusfuehren) {
  console.log('');
  const r = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'playtest', '--', `--only=${gewaehlt.suites.join(',')}`],
    { stdio: 'inherit' },
  );
  process.exit(r.status ?? 1);
}
