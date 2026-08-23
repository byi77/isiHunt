/**
 * Prueft, ob der aktuelle Stand wirklich beim Spieler angekommen ist.
 *
 * ## Warum es dieses Skript gibt
 *
 * Vier Runden Fehlersuche liefen gegen einen Stand, den das Testgeraet nie
 * geladen hatte: lokal v0.1.1, auf dem Handy v0.1.0. Jede Rueckmeldung
 * beschrieb korrekt den alten Code und schickte die Suche in eine neue falsche
 * Richtung.
 *
 * Die Ursache war nicht ein einzelner Fehler, sondern eine Kette ohne
 * Rueckmeldung:
 *
 *     Aenderung -> commit -> push -> Actions -> Pages -> Handy
 *
 * Jedes Glied kann reissen, und keines meldet sich von selbst. Dieses Skript
 * schliesst die Kette: Es fragt den Server, welche Version dort liegt, und
 * vergleicht sie mit der lokalen.
 *
 * ## Aufruf
 *
 *     npm run deploy:check          einmal pruefen
 *     npm run deploy:wait           warten, bis der Deploy durch ist
 *
 * Exit-Code 0 = live und aktuell. Alles andere = nicht ausgeliefert.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version: lokal } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const SEITE = process.env.DEPLOY_URL ?? 'https://byi77.github.io/isiHunt/';
const WARTEN = process.argv.includes('--wait');
const MAX_VERSUCHE = WARTEN ? 40 : 1;
const PAUSE_MS = 15_000;

/** Laedt eine Datei ohne Cache - sonst prueft man den eigenen Zwischenspeicher. */
async function hole(url) {
  const antwort = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status} fuer ${url}`);
  return antwort.text();
}

/**
 * Liest die ausgelieferte Version.
 *
 * Der Weg fuehrt ueber die index.html zum gehashten JS-Bundle - genau den Weg
 * geht auch der Browser. Eine gecachte index.html zeigt auf ein altes Bundle,
 * und genau das soll hier auffallen.
 */
async function liveVersion() {
  const html = await hole(SEITE);

  const treffer = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  if (!treffer) throw new Error('Kein index-Bundle in der index.html gefunden.');

  const js = await hole(new URL(`assets/${treffer[1]}`, SEITE).href);

  // Die Version steht als Zeichenkette im Bundle (vite `define`).
  //
  // **Warum nicht einfach der erste Treffer.** Genau das stand hier bis zum
  // Audit 2026-08-23: `match(/\d+\.\d+\.\d+/g)` und davon der erste. Im
  // Bundle stehen aber neun solcher Zeichenketten - Supabase-Version,
  // Browser-Kennungen, interne Zaehler. Dass die App-Version zufaellig an
  // erster Stelle stand, war Glueck: Eine neue Abhaengigkeit im selben Chunk
  // haette den Deploy-Check gegen eine Fremdversion vergleichen lassen. Er
  // haette dann entweder falsch gemeldet oder vierzig Versuche lang
  // gewartet - und das an der Stelle, die genau diese Art Fehler
  // ausschliessen soll.
  //
  // `Et` ist der minifizierte Name der Konstante; er wechselt bei jedem
  // Build, das Muster drumherum nicht. `main.ts` bzw. `BootScene` geben die
  // Version so aus, und Vite ersetzt `__APP_VERSION__` vorher durch ein
  // String-Literal - der Anker ueberlebt die Minifizierung.
  const anker = js.match(/isiHunt v\$\{(\w+)\}/);
  let version = null;

  if (anker) {
    // Die Zuweisung derselben Variablen: `Et="0.1.247"`.
    //
    // Anfuehrungszeichen bewusst als `.` statt als Zeichenklasse: Ein
    // `["']` im Muster kostete beim Bauen eine Viertelstunde Fehlersuche,
    // weil das einfache Anfuehrungszeichen im Template-Literal kollidierte -
    // der Ausdruck uebersetzte sich still falsch und fand nichts.
    const zuweisung = new RegExp(`\\b${anker[1]}\\s*=\\s*.(\\d+\\.\\d+\\.\\d+).`);
    version = js.match(zuweisung)?.[1] ?? null;
  }

  if (!version) {
    // Rueckfall auf den alten Weg, falls sich die Ausgabezeile aendert.
    // Bewusst mit Hinweis: Ein stiller Rueckfall auf ein bekannt
    // unzuverlaessiges Muster waere schlimmer als eine laute Warnung.
    console.warn('[check-deploy] Versionsanker im Bundle nicht gefunden - nutze ersten Treffer.');
    version = js.match(/\b\d+\.\d+\.\d+\b/g)?.[0] ?? null;
  }

  if (!version) throw new Error('Keine Versionsnummer im Bundle gefunden.');

  return { version, bundle: treffer[1] };
}

for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
  try {
    const { version, bundle } = await liveVersion();

    if (version === lokal) {
      console.log(`OK  live v${version} == lokal v${lokal}  (${bundle})`);
      process.exit(0);
    }

    console.log(
      `[${versuch}/${MAX_VERSUCHE}] live v${version}, lokal v${lokal} - noch nicht ausgeliefert`,
    );
  } catch (fehler) {
    console.log(`[${versuch}/${MAX_VERSUCHE}] ${fehler.message}`);
  }

  if (versuch < MAX_VERSUCHE) await new Promise((r) => setTimeout(r, PAUSE_MS));
}

console.error('');
console.error(`  NICHT AUSGELIEFERT: lokal v${lokal} liegt nicht auf ${SEITE}`);
console.error('');
console.error('  Pruefreihenfolge:');
console.error('    1. git status          - ist alles committet?');
console.error('    2. git log origin/main - ist der Commit gepusht?');
console.error('    3. gh run list         - sind CI UND Deploy gruen?');
console.error('    4. Auf dem Geraet hart neu laden');
console.error('');
console.error('  Solange das nicht stimmt, ist jede Rueckmeldung vom Geraet wertlos.');
console.error('  Hintergrund: docs/CODE_STYLE.md 1.9');
console.error('');
process.exit(1);
