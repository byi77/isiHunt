/**
 * Richtet diese Arbeitskopie so ein, dass hier gearbeitet werden kann.
 *
 * ## Warum es dieses Skript gibt
 *
 * Zwischen "Repo geklont" und "arbeitsfaehig" liegen acht Handgriffe, die sich
 * nirgends von selbst ergeben: Git-Hooks aktivieren, Abhaengigkeiten holen,
 * zwei Playwright-Browser nachinstallieren, die Claude-Erinnerungen
 * einspielen, die globale Claude-Konfiguration nach `~/.claude` legen, eine
 * `.env` anlegen. Wird einer vergessen, faellt das erst Stunden spaeter auf -
 * meist als roter Test oder als Deploy, der auf dem Geraet nicht ankommt.
 *
 * Das Skript ist **wiederholbar**: Was schon sitzt, wird nicht angefasst.
 * Zweimal fahren aendert nichts.
 *
 * ## Zwei Phasen, und warum
 *
 * Die Einrichtung laeuft in zwei Laeufen mit einem Sitzungsneustart dazwischen:
 *
 *     npm run setup:global    nur ~/.claude fuellen  -> Neustart noetig
 *     npm run setup           alles uebrige
 *
 * Grund: In `.claude/global/settings.json` steht `bypassPermissions`. Solange
 * die Datei nicht in `~/.claude` liegt, fragt Claude vor jedem Schritt der
 * Einrichtung nach - acht Bestaetigungen fuer einen Vorgang, dem der Nutzer
 * mit `/start` bereits zugestimmt hat. Ebenso greift die globale `CLAUDE.md`
 * (Arbeitsregeln, Shell-Praeferenz) erst nach einem Neustart: Der laengere
 * Teil der Einrichtung liefe sonst ohne sie.
 *
 * Ein Neustart ist ohnehin faellig, damit die Konfiguration greift. Die
 * Aufteilung nutzt ihn, statt ihn hinterher nachzuschieben.
 *
 * ## Aufruf
 *
 *     npm run setup:global    Phase 1 - nur die globale Claude-Konfiguration
 *     npm run setup           Phase 2 - alles uebrige
 *     npm run setup:check     nur pruefen, nichts schreiben
 *
 * Exit-Code 0 = alles sitzt. 1 = es fehlt etwas (bei `--check`).
 * Exit-Code 2 = Phase 1 hat etwas eingespielt, Sitzungsneustart noetig.
 */

import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NUR_PRUEFEN = process.argv.includes('--check');
const NUR_GLOBAL = process.argv.includes('--global');
const claudeHeim = join(homedir(), '.claude');
const globalImRepo = join(root, '.claude', 'global');

/** Wurde in Phase 1 etwas nach ~/.claude geschrieben? Dann ist ein Neustart faellig. */
let neustartNoetig = false;

/** Sammelt, was am Ende berichtet wird. */
const erledigt = [];
const offen = [];
const uebersprungen = [];

function melde(zustand, text, hinweis) {
  const zeile = hinweis ? `${text} - ${hinweis}` : text;
  if (zustand === 'ok') uebersprungen.push(zeile);
  else if (zustand === 'neu') erledigt.push(zeile);
  else offen.push(zeile);
}

/** Fuehrt einen Befehl aus und gibt true zurueck, wenn er durchlief. */
function fahre(befehl, optionen = {}) {
  try {
    execSync(befehl, { cwd: root, stdio: optionen.leise ? 'pipe' : 'inherit', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

/** Liest die Ausgabe eines Befehls, oder null wenn er fehlschlaegt. */
function ausgabe(befehl) {
  try {
    return execSync(befehl, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

/** Prueft, ob ein Programm im PATH steht. */
function vorhanden(programm) {
  return ausgabe(`${programm} --version`) !== null;
}

/** Gibt aus, was eingerichtet wurde, was schon sass und was offen blieb. */
function bericht() {
  console.log('\n' + '='.repeat(60));

  if (erledigt.length) {
    console.log('\nEingerichtet:');
    for (const z of erledigt) console.log(`  + ${z}`);
  }
  if (uebersprungen.length) {
    console.log('\nSass schon:');
    for (const z of uebersprungen) console.log(`  . ${z}`);
  }
  if (offen.length) {
    console.log('\nOffen:');
    for (const z of offen) console.log(`  ! ${z}`);
  }

  console.log('');
}

console.log(NUR_PRUEFEN ? '=== Pruefung ===\n' : '=== Einrichtung ===\n');

// --- 1. Werkzeuge --------------------------------------------------------
//
// Fehlt eines, kann das Skript selbst nicht viel tun: `npm ci` braucht Node,
// die Hooks brauchen Git. Deshalb wird hier nur gemeldet - installiert wird
// per winget aus dem Skill heraus, weil danach eine neue Shell noetig ist,
// damit der PATH stimmt.
const werkzeuge = [
  ['node', 'Node 24', 'winget install OpenJS.NodeJS.LTS'],
  ['git', 'Git', 'winget install Git.Git'],
  ['gh', 'GitHub CLI', 'winget install GitHub.cli'],
];

for (const [programm, name, befehl] of werkzeuge) {
  if (vorhanden(programm)) {
    melde('ok', `${name} vorhanden`, ausgabe(`${programm} --version`)?.split('\n')[0]);
  } else {
    melde('fehlt', `${name} fehlt`, befehl);
  }
}

// Node-Hauptversion pruefen: unter 22 laedt jsdom nicht, die Tests brechen ab.
const nodeVersion = process.versions.node;
const nodeHaupt = Number(nodeVersion.split('.')[0]);
if (nodeHaupt < 22) {
  melde('fehlt', `Node ${nodeVersion} ist zu alt`, 'mindestens 22.22.2, empfohlen 24');
}

// --- 2. Globale Claude-Konfiguration -------------------------------------
//
// Kommt vor allem anderen: Sie enthaelt `bypassPermissions`, ohne das jeder
// folgende Schritt einzeln bestaetigt werden muesste, und die globalen
// Arbeitsanweisungen. Beides greift erst nach einem Sitzungsneustart - deshalb
// bricht `--global` danach ab.
//
// Liegt versioniert unter .claude/global/ und wird nach ~/.claude gespiegelt.
// Eine bereits vorhandene Datei wird NICHT ueberschrieben: Auf dem
// Hauptrechner steht dort der gewachsene Stand, und den still zu ersetzen
// waere ein Datenverlust. Wer bewusst angleichen will, loescht sie vorher.
const globaleDateien = [
  ['CLAUDE.md', 'globale Arbeitsanweisungen'],
  ['settings.json', 'Claude-Einstellungen'],
];

for (const [datei, was] of globaleDateien) {
  const quelle = join(globalImRepo, datei);
  const ziel = join(claudeHeim, datei);

  if (!existsSync(quelle)) {
    melde('fehlt', `${datei} fehlt im Repo`, 'unerwartet - .claude/global/ pruefen');
    continue;
  }

  if (existsSync(ziel)) {
    const gleich = readFileSync(quelle, 'utf8') === readFileSync(ziel, 'utf8');
    melde('ok', `~/.claude/${datei} vorhanden`, gleich ? undefined : 'weicht vom Repo ab');
    continue;
  }

  if (NUR_PRUEFEN) {
    melde('fehlt', `~/.claude/${datei} fehlt`, was);
    continue;
  }

  mkdirSync(claudeHeim, { recursive: true });
  copyFileSync(quelle, ziel);
  melde('neu', `~/.claude/${datei} eingespielt`);
  neustartNoetig = true;
}

// Die beiden globalen Skills. Fehlende werden ergaenzt, vorhandene bleiben.
const skillsQuelle = join(globalImRepo, 'skills');
const skillsZiel = join(claudeHeim, 'skills');

if (existsSync(skillsQuelle)) {
  for (const skill of readdirSync(skillsQuelle)) {
    const ziel = join(skillsZiel, skill);
    if (existsSync(ziel)) {
      melde('ok', `Skill ${skill} vorhanden`);
    } else if (NUR_PRUEFEN) {
      melde('fehlt', `Skill ${skill} fehlt`);
    } else {
      mkdirSync(skillsZiel, { recursive: true });
      cpSync(join(skillsQuelle, skill), ziel, { recursive: true });
      melde('neu', `Skill ${skill} eingespielt`);
      neustartNoetig = true;
    }
  }
}

// --- Phase 1 endet hier ---------------------------------------------------
//
// `--global` spielt nur die Konfiguration ein. Alles Weitere braucht die neue
// Sitzung, sonst laeuft es ohne die eben eingespielten Regeln und mit einer
// Rueckfrage je Schritt.
if (NUR_GLOBAL) {
  bericht();

  if (neustartNoetig) {
    console.log('  PHASE 1 VON 2 FERTIG - /start laeuft beim ersten Mal zweimal.');
    console.log('');
    console.log('  Jetzt:  1. Claude-Sitzung neu starten');
    console.log('          2. erneut /start sagen');
    console.log('');
    console.log('  Der zweite Lauf macht den Rest und braucht keine Rueckfragen mehr.');
    console.log('  Ohne den Neustart greift die eben eingespielte Konfiguration nicht.');
    process.exit(2);
  }

  console.log('Die globale Konfiguration sass schon. Weiter mit: npm run setup');
  process.exit(0);
}

// --- 3. Git-Hooks --------------------------------------------------------
//
// Der Schritt, der am ehesten vergessen wird: `.git/hooks` wird nicht
// mitgeklont. Ohne ihn zaehlt keine Version hoch und kein verify laeuft vor
// dem Push.
const hooksPfad = ausgabe('git config core.hooksPath');
if (hooksPfad === '.githooks') {
  melde('ok', 'Git-Hooks aktiv');
} else if (NUR_PRUEFEN) {
  melde('fehlt', 'Git-Hooks nicht aktiv', 'git config core.hooksPath .githooks');
} else if (fahre('git config core.hooksPath .githooks', { leise: true })) {
  melde('neu', 'Git-Hooks aktiviert');
} else {
  melde('fehlt', 'Git-Hooks liessen sich nicht aktivieren');
}

// --- 4. Abhaengigkeiten --------------------------------------------------
const habenModule = existsSync(join(root, 'node_modules', 'phaser'));
if (habenModule) {
  melde('ok', 'Abhaengigkeiten installiert');
} else if (NUR_PRUEFEN) {
  melde('fehlt', 'node_modules fehlt', 'npm ci');
} else {
  console.log('\nAbhaengigkeiten installieren (npm ci) ...\n');
  if (fahre('npm ci')) melde('neu', 'Abhaengigkeiten installiert');
  else melde('fehlt', 'npm ci fehlgeschlagen');
}

// --- 5. Playwright-Browser -----------------------------------------------
//
// chromium fuer die meisten Suiten, webkit fuer die ios-Suite. Ohne webkit
// bricht `npm run playtest -- --only=ios` ab.
const browserHeim =
  process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), 'AppData', 'Local', 'ms-playwright');

for (const [name, praefix] of [
  ['chromium', 'chromium-'],
  ['webkit', 'webkit-'],
]) {
  let da = false;
  try {
    da = existsSync(browserHeim) && readdirSync(browserHeim).some((d) => d.startsWith(praefix));
  } catch {
    da = false;
  }

  if (da) {
    melde('ok', `Playwright ${name} vorhanden`);
  } else if (NUR_PRUEFEN) {
    melde('fehlt', `Playwright ${name} fehlt`, `npx playwright install ${name}`);
  } else {
    console.log(`\nPlaywright ${name} installieren ...\n`);
    if (fahre(`npx playwright install ${name}`)) melde('neu', `Playwright ${name} installiert`);
    else melde('fehlt', `Playwright ${name} liess sich nicht installieren`);
  }
}

// --- 6. Claude-Erinnerungen ----------------------------------------------
if (!NUR_PRUEFEN) {
  const aus = ausgabe('node scripts/sync-memory.mjs --load');
  if (aus) {
    melde(aus.includes('unveraendert') ? 'ok' : 'neu', 'Claude-Erinnerungen', aus.split(': ')[1]);
  } else {
    melde('fehlt', 'Erinnerungen liessen sich nicht einspielen');
  }
} else {
  const gleich = ausgabe('node scripts/sync-memory.mjs --check');
  melde(gleich?.includes('gleich') ? 'ok' : 'fehlt', 'Claude-Erinnerungen', gleich?.split('\n')[0]);
}

// --- 7. Umgebungsvariablen -----------------------------------------------
//
// Ohne .env laeuft das Spiel vollstaendig - nur Bestenliste und
// Spielstand-Abgleich blenden sich aus. Die Vorlage wird angelegt, die Werte
// traegt der Nutzer ein (der Skill fragt danach).
const envPfad = join(root, '.env');
const envVorlage = join(root, '.env.example');

if (existsSync(envPfad)) {
  const inhalt = readFileSync(envPfad, 'utf8');
  const platzhalter = inhalt.includes('dein-projekt') || inhalt.includes('sb_publishable_...');
  melde(
    platzhalter ? 'fehlt' : 'ok',
    '.env vorhanden',
    platzhalter ? 'enthaelt noch Platzhalter - Werte eintragen' : undefined,
  );
} else if (NUR_PRUEFEN) {
  melde('fehlt', '.env fehlt', 'aus .env.example anlegen');
} else {
  copyFileSync(envVorlage, envPfad);
  melde('neu', '.env aus Vorlage angelegt', 'Werte muessen noch eingetragen werden');
}

// --- Bericht -------------------------------------------------------------
bericht();

if (offen.length === 0) {
  console.log('Alles eingerichtet. Naechster Schritt: npm run verify');
  process.exit(0);
}

console.log(`${offen.length} Punkt(e) offen - siehe oben.`);
process.exit(NUR_PRUEFEN ? 1 : 0);
