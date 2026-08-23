/**
 * Schuetzt Scenes davor, nach einem `await` auf zerstoerte Phaser-Objekte zu
 * schreiben.
 *
 * ## Warum es dieses Gate gibt
 *
 * Waehrend eines Netzaufrufs bleibt der Zurueck-Knopf bedienbar. Verlaesst
 * der Spieler die Scene, laeuft der Code nach dem `await` trotzdem weiter -
 * jetzt aber auf Objekten, die Phaser bereits abgeraeumt hat. Bei einem
 * `Text` gibt `preDestroy()` das Canvas an den `CanvasPool` zurueck, waehrend
 * `setText()` ueber `updateText()` weiter darauf zugreift: entweder ein
 * Fehler oder Text, der in ein fremdes Canvas gerendert wird. Ein
 * `scene.start()`/`restart()` holt den Spieler ungefragt zurueck.
 *
 * Gefunden im Audit 2026-08-23: 15 Stellen in fuenf Scenes. Die Lesepruefung
 * fand elf davon in ProfileScene, TalentScene und AdminUsersScene - die
 * restlichen vier in AccountScene und MenuScene brachte erst dieses Gate ans
 * Licht. Genau deshalb ist es ein Gate und keine Checkliste: SyncScene und
 * OnlineDuelScene machten es von Anfang an richtig, das Muster war da, nur
 * nicht ueberall angewandt.
 *
 * ## Was geprueft wird
 *
 * Innerhalb einer `async`-Methode einer Scene: Steht zwischen einem `await`
 * und dem naechsten Oberflaechenzugriff kein `scene.isActive()`, ist das ein
 * Verstoss.
 *
 * ## Was ausdruecklich NICHT geprueft wird (deklarierte Grenzen)
 *
 * - **Nur `src/scenes/`.** Systems halten keine Phaser-Objekte (Regel 6).
 * - **Nur die unten gelisteten Oberflaechen-Aufrufe.** Wer ein Phaser-Objekt
 *   ueber einen selbst benannten Helfer anfasst, faellt durch das Raster.
 * - **Keine Datenflussanalyse.** Die Pruefung ist zeilenbasiert innerhalb
 *   einer Methode; ein `await` in einer aufgerufenen Hilfsmethode sieht sie
 *   nicht.
 * - **Kein Anspruch auf Vollstaendigkeit bei Callbacks.** `.then(...)`-Ketten
 *   werden nicht verfolgt, nur `await`.
 * - **Guards ohne `return` gelten trotzdem als Entwarnung.** Die Pruefung
 *   sieht `this.scene.isActive()` und nimmt an, dass der Zweig die Methode
 *   verlaesst. Ein Guard, der nur protokolliert und weiterlaeuft, wuerde
 *   faelschlich entwarnen - im Bestand kommt das nicht vor (alle acht
 *   verschachtelten Guards enden mit `return`), geprueft am 2026-08-23.
 *
 * Die Blockgrenze selbst wird dagegen beachtet: Ein Guard innerhalb eines
 * `if`-Zweiges entwarnt nur dort und nicht fuer den Code dahinter. Dieser
 * blinde Fleck bestand im ersten Entwurf und ist geschlossen.
 *
 * Diese Grenzen sind Absicht: Ein Gate, das die haeufige Form zuverlaessig
 * findet, ist mehr wert als eines, das mit Fehlalarmen abgeschaltet wird.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/scenes/', import.meta.url));

/** Zugriffe, die eine lebende Scene voraussetzen. */
const UI_ZUGRIFF =
  /\b(?:setText|setLabel|setColor|setEnabled|setVisible)\s*\(|\bthis\.scene\.(?:start|restart|launch|stop)\s*\(|\bthis\.add\.[a-zA-Z]+\s*\(/;

/** Die Absicherung selbst - in beiden gebraeuchlichen Schreibweisen. */
const GUARD = /this\.scene\.isActive\s*\(\)|!this\.scene\.isActive\s*\(\)/;

const dateien = [];
for (const name of readdirSync(root)) {
  if (name.endsWith('.ts') && !name.endsWith('.test.ts')) dateien.push(join(root, name));
}

const verstoesse = [];

for (const datei of dateien) {
  const zeilen = readFileSync(datei, 'utf8').split(/\r?\n/);

  // Zustand je Methode: Sobald ein `await` faellt, ist die Scene ab da
  // ungewiss - bis ein Guard sie wieder bestaetigt.
  let nachAwait = false;
  let methodenTiefe = null;
  let tiefe = 0;
  // Klammertiefe, auf der die letzte Entwarnung galt. `null` = keine.
  let guardTiefe = null;
  // Ob seit dem letzten `await` ueberhaupt noch etwas ungewiss ist - noetig,
  // um beim Verlassen des Guard-Blocks wieder auf "ungewiss" zu schalten.
  let awaitOffen = false;

  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i];
    const ohneKommentar = zeile.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');

    // Methodengrenzen grob ueber die Klammertiefe: Eine neue `async`-Methode
    // startet mit frischem Zustand, damit ein `await` nicht in die naechste
    // Methode nachwirkt.
    if (/\basync\s+[a-zA-Z_]/.test(ohneKommentar) || /=\s*async\s*\(/.test(ohneKommentar)) {
      nachAwait = false;
      awaitOffen = false;
      guardTiefe = null;
      methodenTiefe = tiefe;
    }

    // Ein Guard entwarnt nur fuer den Block, in dem er steht.
    //
    // Vorher galt die Entwarnung global. Ein `if (!this.scene.isActive())
    // return;` innerhalb eines `if`-Zweiges liess damit auch den Code
    // DANACH als geprueft gelten - obwohl der Zweig gar nicht durchlaufen
    // worden sein muss. Die Entwarnung merkt sich deshalb ihre Klammertiefe
    // und verfaellt, sobald der Block verlassen wird (Audit 2026-08-23).
    if (GUARD.test(ohneKommentar)) {
      nachAwait = false;
      guardTiefe = tiefe;
    }

    if (nachAwait && UI_ZUGRIFF.test(ohneKommentar)) {
      verstoesse.push({
        datei: relative(process.cwd(), datei).replace(/\\/g, '/'),
        zeile: i + 1,
        text: zeile.trim().slice(0, 90),
      });
      // Nur der erste Zugriff je Block wird gemeldet - sonst erschlaegt eine
      // einzelne Ursache den Bericht mit Folgezeilen.
      nachAwait = false;
    }

    if (/\bawait\s/.test(ohneKommentar)) {
      nachAwait = true;
      awaitOffen = true;
      guardTiefe = null;
    }

    for (const zeichen of ohneKommentar) {
      if (zeichen === '{') tiefe++;
      else if (zeichen === '}') {
        tiefe--;
        // Guard-Block verlassen: Die Entwarnung galt nur dort drin.
        if (guardTiefe !== null && tiefe < guardTiefe) {
          guardTiefe = null;
          if (awaitOffen) nachAwait = true;
        }
        if (methodenTiefe !== null && tiefe <= methodenTiefe) {
          nachAwait = false;
          awaitOffen = false;
          guardTiefe = null;
          methodenTiefe = null;
        }
      }
    }
  }
}

if (verstoesse.length > 0) {
  console.error('\nOberflaechenzugriff nach `await` ohne `this.scene.isActive()`:\n');
  for (const v of verstoesse) {
    console.error(`  ${v.datei}:${v.zeile}`);
    console.error(`    ${v.text}`);
  }
  console.error(
    `\n${verstoesse.length} Stelle(n). Waehrend eines Netzaufrufs kann der Spieler die Scene`,
  );
  console.error(
    'verlassen - danach sind ihre Phaser-Objekte zerstoert. Vor dem Zugriff einfuegen:',
  );
  console.error('\n    if (!this.scene.isActive()) return;\n');
  process.exit(1);
}

console.log(`Scene-Guards OK: ${dateien.length} Scenes ohne ungeschuetzten Zugriff nach await.`);
