/**
 * Haelt die Claude-Memory zwischen mehreren Rechnern gleich.
 *
 * ## Warum es dieses Skript gibt
 *
 * Claude Code legt seine Erinnerungen unter
 * `~/.claude/projects/<pfad-slug>/memory/` ab - ausserhalb des Repos, also
 * rechnerlokal. Wer an zwei Rechnern arbeitet, hat dort zwei auseinander
 * laufende Staende: eine Korrektur, die auf dem einen Rechner gelernt wurde,
 * fehlt auf dem anderen, und Claude wiederholt dort denselben Fehler.
 *
 * Die Dateien sind winzig (wenige Kilobyte) und aendern sich selten. Sie
 * gehoeren deshalb in dasselbe Git, das ohnehin zwischen den Rechnern laeuft -
 * kein Cloud-Client, kein Symlink, kein Hintergrundprozess.
 *
 * Der Ordner `~/.claude/projects/<slug>/` enthaelt daneben die
 * Sitzungstranskripte (`.jsonl`, dreistellige Megabyte). Die bleiben bewusst
 * draussen: Sie sind Historie, kein Wissen, und Claude schreibt waehrend
 * laufender Sitzungen hinein.
 *
 * ## Aufruf
 *
 *     npm run memory:save          Repo  <- ~/.claude   (vor dem Commit)
 *     npm run memory:load          Repo  -> ~/.claude   (nach dem Klonen)
 *     npm run memory:check         nur melden, nichts schreiben
 *
 * Exit-Code 0 = in Ordnung. Bei `--check` bedeutet 1: die Staende weichen ab.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  statSync,
  rmSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Im Repo versioniert - reist mit jedem Klon mit. */
const IM_REPO = join(root, '.claude', 'memory');

/**
 * Claude bildet den Ordnernamen aus dem absoluten Projektpfad: Doppelpunkt und
 * Trennzeichen werden zu Bindestrichen (`C:\Git\isiHunt` -> `C--Git-isiHunt`).
 * Der Slug wird hier aus dem tatsaechlichen Pfad berechnet statt fest
 * verdrahtet, damit das Skript auch dann trifft, wenn das Repo woanders liegt.
 */
function slugFuer(pfad) {
  return pfad.replace(/[:\\/]/g, '-');
}

/**
 * Sucht den Memory-Ordner dieser Arbeitskopie.
 *
 * Windows unterscheidet die Gross-/Kleinschreibung des Laufwerksbuchstabens
 * nicht, Claude Code schreibt aber mal `C--Git-isiHunt` und mal
 * `c--Git-isiHunt` - je nachdem, wie die Sitzung gestartet wurde. Beide
 * Varianten werden geprueft; gefunden wird die, die existiert.
 */
function findeClaudeMemory() {
  const basis = join(homedir(), '.claude', 'projects');
  const kandidaten = [
    slugFuer(root),
    slugFuer(root.charAt(0).toUpperCase() + root.slice(1)),
    slugFuer(root.charAt(0).toLowerCase() + root.slice(1)),
  ];

  for (const kandidat of new Set(kandidaten)) {
    const pfad = join(basis, kandidat, 'memory');
    if (existsSync(pfad)) return pfad;
  }

  // Keiner existiert - den erstgenannten zurueckgeben, damit `load` ihn anlegen
  // kann. `save` faengt den leeren Fall separat ab.
  return join(basis, kandidaten[0], 'memory');
}

const IN_CLAUDE = findeClaudeMemory();

/** Liest einen Ordner als Map von Dateiname -> Inhalt. Fehlt er, ist er leer. */
function lies(ordner) {
  if (!existsSync(ordner)) return new Map();
  const dateien = readdirSync(ordner)
    .filter((n) => n.endsWith('.md'))
    .filter((n) => statSync(join(ordner, n)).isFile());
  return new Map(dateien.map((n) => [n, readFileSync(join(ordner, n), 'utf8')]));
}

/**
 * Schreibt `quelle` nach `ziel` und entfernt dort, was in der Quelle fehlt.
 *
 * Das Loeschen ist Absicht: Eine Memory, die als falsch erkannt und geloescht
 * wurde, muss auch auf dem anderen Rechner verschwinden. Ohne diesen Schritt
 * kaeme sie beim naechsten Sync aus dem Ziel zurueck.
 */
function schreibe(quelle, ziel, richtung) {
  mkdirSync(ziel, { recursive: true });

  const vorher = lies(ziel);
  const nachher = lies(quelle);
  let neu = 0;
  let geaendert = 0;
  let entfernt = 0;

  for (const [name, inhalt] of nachher) {
    const alt = vorher.get(name);
    if (alt === inhalt) continue;
    writeFileSync(join(ziel, name), inhalt, 'utf8');
    if (alt === undefined) neu++;
    else geaendert++;
  }

  for (const name of vorher.keys()) {
    if (nachher.has(name)) continue;
    rmSync(join(ziel, name));
    entfernt++;
  }

  const summe = neu + geaendert + entfernt;
  if (summe === 0) {
    console.log(`${richtung}: unveraendert (${nachher.size} Dateien).`);
  } else {
    const teile = [];
    if (neu) teile.push(`${neu} neu`);
    if (geaendert) teile.push(`${geaendert} geaendert`);
    if (entfernt) teile.push(`${entfernt} entfernt`);
    console.log(`${richtung}: ${teile.join(', ')} (${nachher.size} Dateien gesamt).`);
  }

  return summe;
}

/** Meldet Abweichungen, ohne etwas zu schreiben. */
function pruefe() {
  const repo = lies(IM_REPO);
  const claude = lies(IN_CLAUDE);

  const namen = new Set([...repo.keys(), ...claude.keys()]);
  const abweichungen = [];

  for (const name of [...namen].sort()) {
    const a = repo.get(name);
    const b = claude.get(name);
    if (a === b) continue;
    if (a === undefined) abweichungen.push(`  nur in ~/.claude : ${name}`);
    else if (b === undefined) abweichungen.push(`  nur im Repo     : ${name}`);
    else abweichungen.push(`  unterschiedlich : ${name}`);
  }

  if (abweichungen.length === 0) {
    console.log(`Memory ist gleich (${repo.size} Dateien).`);
    return 0;
  }

  console.log('Memory weicht ab:');
  console.log(abweichungen.join('\n'));
  console.log('');
  console.log('  npm run memory:save   uebernimmt den Stand aus ~/.claude ins Repo');
  console.log('  npm run memory:load   uebernimmt den Stand aus dem Repo nach ~/.claude');
  return 1;
}

const modus = process.argv[2];

if (modus === '--check') {
  process.exit(pruefe());
} else if (modus === '--load') {
  if (lies(IM_REPO).size === 0) {
    console.log('Im Repo liegt keine Memory - nichts zu laden.');
    process.exit(0);
  }
  schreibe(IM_REPO, IN_CLAUDE, `Repo -> ${IN_CLAUDE}`);
} else if (modus === '--save') {
  // Ein leerer Claude-Ordner darf die versionierte Memory nicht loeschen: Das
  // passiert auf einem frisch geklonten Rechner, auf dem `memory:load` noch
  // nicht lief - dort waere `save` ein stiller Datenverlust.
  if (lies(IN_CLAUDE).size === 0) {
    console.log(`Kein Memory-Ordner unter ${IN_CLAUDE} - nichts zu sichern.`);
    console.log('Auf einem neuen Rechner zuerst: npm run memory:load');
    process.exit(0);
  }
  schreibe(IN_CLAUDE, IM_REPO, `~/.claude -> Repo`);
} else {
  console.error('Aufruf: sync-memory.mjs --save | --load | --check');
  process.exit(2);
}
