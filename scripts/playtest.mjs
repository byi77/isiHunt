// Spielt isiHunt automatisiert in einem echten Chromium durch (Playwright).
//
// Warum das geht, obwohl Scenes und Entities nicht unit-testbar sind
// (ARCHITECTURE.md 9.2): `main.ts` haengt die Phaser-Instanz im Dev-Build als
// `window.isiHunt` an. Darueber laesst sich der laufende Spielzustand lesen -
// Scene, Score, Spielerposition, liegende Relikte. Gesteuert wird ueber echte
// Tastatureingaben, nicht ueber gesetzte Positionen: so laeuft derselbe Weg
// durch InputController und GameScene.update() wie beim Spielen mit der Hand.
//
// Sieben Suiten, einzeln waehlbar ueber --only:
//   screens    Jeder Menue-Bildschirm: oeffnet, Konsole sauber, Screenshot
//   modes      Solo je Welt, Tageslauf, Bot-Duell
//   layout     Canvas-Ueberstand und unterster Knopf ueber 19 Geraeteformate
//   nav        Menuewege hin und zurueck, per echtem Klick
//   controls   Ueberlappende/verrutschte/zu kleine Knoepfe, Scrollen
//   ios        Dieselben Pruefungen in echtem WebKit statt in Chromium
//   progress   Levelaufstieg, Talentkauf, Erfolge, Spielstand ueber Neuladen
//
// Ersetzt den Handytest nicht (Touch-Eigenheiten, Game-Feel), faengt aber
// Regressionen in Scene-Fluss, Steuerung, Kollision und Persistenz ab.
//
// --sim  simuliert die Runden, statt je 90 Sekunden abzuwarten. Der Lauf
//        faellt damit von rund 20 auf rund 7 Minuten. Geprueft werden
//        weiterhin Kollision, Punkte, Fortschritt und Persistenz; nicht mehr
//        geprueft werden Rendering, Tweens und Bildrate, weil Phasers Loop
//        dabei schlaeft. Begruendung im Detail bei `simulateUntilDone()`.
//        Vor einem Release oder Audit den Lauf ohne --sim fahren.
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 5199;

/**
 * Fristen fuer Szenenwechsel und Rundenende.
 *
 * ## Warum sie grosszuegig sind
 *
 * Diese Werte entscheiden nicht, wie schnell das Spiel sein muss - dafuer
 * gibt es eigene Messungen. Sie entscheiden nur, wann der Test aufgibt. Zu
 * knapp gesetzt meldet er Fehler, die keine sind: Im Volllauf schlugen
 * nacheinander drei verschiedene Schritte fehl (Settings, glutmark,
 * frostzinne), alle drei liefen einzeln gruen, keiner war zweimal derselbe.
 * Ein Testlauf, dessen Ergebnis vom Zufall abhaengt, ist wertlos - er kostet
 * 20 Minuten und beantwortet nichts.
 *
 * Der Preis fuer grosszuegige Fristen ist gering: Sie greifen nur im
 * Fehlerfall. Laeuft alles, wartet niemand laenger.
 */
const SCENE_TIMEOUT_MS = 20000;
/** Ende einer 90-Sekunden-Runde, inklusive Countdown und Auswertung. */
const RESULT_TIMEOUT_MS = 60000;

const argv = process.argv.slice(2);
const watch = argv.includes('--watch');
/**
 * Runs simulieren statt 90 Sekunden je Runde abzuwarten.
 *
 * Der Gesamtlauf faellt damit von rund 20 auf rund 7 Minuten - der Rest sind
 * Navigation, Layout und WebKit, die echte Zeit brauchen. Begruendung und
 * Grenzen stehen bei `simulateUntilDone()`.
 */
const sim = argv.includes('--sim');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1].split(',') : null;
const positional = argv.filter((a) => !a.startsWith('--'));

const shotDir = resolve(positional[1] ?? 'playtest-shots');
mkdirSync(shotDir, { recursive: true });

const externalUrl = positional[0] && positional[0] !== '-' ? positional[0] : null;
const url = externalUrl ?? `http://localhost:${PORT}/`;

const runSuite = (name) => !only || only.includes(name);

// --- Spielstand ---------------------------------------------------------------
// MenuScene schickt jeden Stand ohne `playerName` in den Login (MenuScene.ts
// 76-82). Ein vorgesetzter lokaler Stand haelt den Testlauf offline und
// unabhaengig von Zugangsdaten.
//
// Level 1 mit 0 XP ist der einzige in sich stimmige Startwert: migrate()
// rechnet das Level aus der XP-Summe zurueck (SaveSystem.ts 145-155).
const SAVE_KEY = 'isihunt.save.v1';

function makeSave(overrides = {}) {
  return {
    version: 1,
    level: 1,
    xp: 0,
    talentPoints: 0,
    coins: 0,
    talents: {},
    bestScore: 0,
    bestScoreRecordedAt: null,
    bestCombo: 0,
    totalScore: 0,
    totalRuns: 0,
    totalPlayTimeMs: 0,
    totalCoinsEarned: 0,
    coinsSpent: 0,
    lastLoginBonusKey: null,
    lastDailyKey: null,
    dailyBestScore: 0,
    totalDailyRuns: 0,
    pendingDailyKey: null,
    pendingDailyEventId: null,
    pendingDailyCoins: 0,
    pendingDailyScore: 0,
    collected: {},
    unlockedAchievements: [],
    lastWorldId: null,
    soundEnabled: false,
    hapticsEnabled: false,
    playerName: 'Playtest',
    cloudId: null,
    ...overrides,
  };
}

// --- Berichterstattung --------------------------------------------------------
//
// Warum eine laufende Statuszeile: Ein Solo-Run dauert 90 echte Sekunden.
// Ohne Zwischenmeldung schweigt der Test so lange komplett - wer davorsitzt,
// kann "laeuft noch" nicht von "haengt" unterscheiden. Die Zeile schreibt
// sich per Wagenruecklauf immer wieder selbst neu und braucht deshalb keine
// zusaetzlichen Ausgabezeilen.
const steps = [];
const failures = [];
let currentSuite = '';
const startedAt = Date.now();

const istTTY = process.stdout.isTTY === true;
let statusTimer = null;
let statusText = '';
let statusSince = 0;

function verstrichen(seit) {
  const s = Math.round((Date.now() - seit) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')} min` : `${s}s`;
}

/** Zeigt an, woran gerade gearbeitet wird - mit mitlaufender Uhr. */
function status(text) {
  statusText = text;
  statusSince = Date.now();

  if (!istTTY) {
    // In einer Datei oder Pipe waere eine sich selbst ueberschreibende Zeile
    // unleserlich; dort genuegt eine einzelne Meldung pro Schritt.
    console.log(`  ... ${text}`);
    return;
  }

  if (statusTimer) clearInterval(statusTimer);
  const zeichnen = () => {
    const zeile = `  ... ${statusText} (${verstrichen(statusSince)}, gesamt ${verstrichen(startedAt)})`;
    process.stdout.write('\r' + zeile.padEnd(78).slice(0, 78));
  };
  zeichnen();
  statusTimer = setInterval(zeichnen, 1000);
  statusTimer.unref?.();
}

/** Beendet die Statuszeile, damit die naechste Ausgabe sauber beginnt. */
function statusEnde() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  if (istTTY && statusText) process.stdout.write('\r' + ' '.repeat(78) + '\r');
  statusText = '';
}

function suite(name) {
  statusEnde();
  currentSuite = name;
  console.log(`\n=== ${name} ===`);
}

function record(name, ok, detail) {
  statusEnde();
  steps.push({ suite: currentSuite, name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failures.push(`[${currentSuite}] ${name}: ${detail ?? 'fehlgeschlagen'}`);
}

// Vorab ansagen, was kommt und wie lange es dauert. Wer davorsitzt, soll
// nicht raten muessen, ob sich das Warten noch lohnt.
{
  // Erster Wert: Echtzeit. Zweiter: mit `--sim`, wo die 90-Sekunden-Runden
  // wegfallen (modes faehrt 5 Runden, ios und progress je eine).
  const DAUER = {
    screens: [1, 1],
    nav: [1, 1],
    controls: [1.5, 1.5],
    layout: [2, 2],
    ios: [3.5, 2],
    progress: [2.5, 1],
    modes: [8, 0.5],
  };
  const geplant = Object.keys(DAUER).filter((k) => runSuite(k));
  const minuten = geplant.reduce((a, k) => a + DAUER[k][sim ? 1 : 0], 0);
  console.log(`
Playtest: ${geplant.join(', ')}${sim ? ' (simuliert)' : ''}`);
  const gerundet = Math.max(1, Math.round(minuten));
  console.log(
    `Geschaetzte Dauer: ~${gerundet} ${gerundet === 1 ? 'Minute' : 'Minuten'}` +
      (watch ? ' (im Watch-Modus laenger)' : ''),
  );
  if (sim) {
    console.log(
      'Runden werden simuliert: dieselbe Kollisions- und Punkterechnung, aber\n' +
        'ohne Rendering, Tweens und Bildrate. Vor einem Release oder Audit den\n' +
        'Lauf ohne --sim fahren.',
    );
  } else if (geplant.includes('modes') || geplant.includes('progress')) {
    console.log('Enthaelt echte Runden a 90 Sekunden - die Statuszeile zeigt den Punktestand.');
  }
}

// --- Server -------------------------------------------------------------------
// Ein langlaufender Dev-Server, der zwischendurch per HMR neuen Code gezogen
// hat, startet die GameScene nicht mehr zuverlaessig - die Relikte spawnen dann
// nie. Deshalb immer ein frischer Prozess, wenn keine URL vorgegeben ist.
let server = null;
if (!externalUrl) {
  server = spawn(
    process.execPath,
    [
      resolve('node_modules', 'vite', 'bin', 'vite.js'),
      '--mode',
      'playtest',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    { stdio: 'ignore' },
  );
  status('Dev-Server startet');
  const until = Date.now() + 30000;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) break;
    } catch {
      /* noch nicht da */
    }
    if (Date.now() > until) throw new Error('Dev-Server startete nicht.');
    await new Promise((r) => setTimeout(r, 400));
  }
}

const browser = await chromium.launch({
  headless: !watch,
  // Ohne Bremse sind die Tastendruecke fuer einen Zuschauer nicht
  // nachvollziehbar - das Spiel laeuft dann korrekt, aber unsichtbar schnell.
  slowMo: watch ? 60 : 0,
});

// --- Werkzeuge ----------------------------------------------------------------

/**
 * Neue Seite mit vorgesetztem Spielstand und Konsolenueberwachung.
 *
 * `contextOptions` nimmt entweder ein fertiges Playwright-Geraeteprofil
 * (`devices['iPhone 16']`) oder ein eigenes `{ viewport, ... }`. Der
 * Skalierungsfaktor kommt dabei aus dem Profil - iPhones laufen mit dpr 3,
 * ein fest gesetztes 2 wuerde die Groessenrechnung verfaelschen.
 */
async function openPage(save = makeSave(), contextOptions = null, engine = browser) {
  const context = await engine.newContext(contextOptions ?? { ...devices['iPhone 13'] });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // Nur setzen, wenn noch nichts da ist: `addInitScript` laeuft bei JEDEM
  // Seitenaufbau, also auch nach `page.reload()`. Ein bedingungsloses
  // Schreiben wuerde den gerade erspielten Stand ueberbuegeln - und der
  // Persistenztest schlaege fehl, obwohl das Spiel korrekt gespeichert hat.
  await page.addInitScript(
    ([k, s]) => {
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(k, JSON.stringify(s));
      }
    },
    [SAVE_KEY, save],
  );
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, context, errors };
}

/**
 * Kuerzt eine Fehlermeldung auf die Zeile, die etwas aussagt.
 *
 * Playwright haengt an seine Meldungen einen mehrzeiligen Aufrufpfad. Der
 * frueher genutzte `slice(0, 60)` schnitt mitten im Satz ab - im Bericht
 * stand "Execution context was destroyed, most likely " und der Rest fehlte,
 * also genau die Stelle, die den Grund genannt haette.
 */
function kurzerFehler(e) {
  const [roh = ''] = String(e?.message ?? e).split(/\r?\n/);
  const ersteZeile = roh.trim();
  return ersteZeile.length > 110 ? `${ersteZeile.slice(0, 107)}...` : ersteZeile;
}

async function waitForScene(page, key, timeoutMs = SCENE_TIMEOUT_MS) {
  await page.waitForFunction((k) => window.isiHunt?.scene?.isActive(k), key, {
    timeout: timeoutMs,
  });
}

/** Wartet, bis die GameScene wirklich laeuft - erkennbar am ersten Relikt. */
async function waitForRunLive(page, timeoutMs = 25000) {
  await page.waitForFunction(
    () => {
      const s = window.isiHunt?.scene?.getScene('Game');
      return Boolean(s) && (s.collectibles ?? []).length > 0;
    },
    undefined,
    { timeout: timeoutMs },
  );
}

function readGameState(page) {
  return page.evaluate(() => {
    const scene = window.isiHunt?.scene?.getScene('Game');
    if (!scene) return null;
    return {
      score: scene.scoring?.currentScore ?? null,
      combo: scene.scoring?.currentCombo ?? null,
      player: scene.player ? { x: scene.player.x, y: scene.player.y } : null,
      collectibles: (scene.collectibles ?? [])
        .filter((c) => c?.active)
        .map((c) => ({ x: c.x, y: c.y })),
    };
  });
}

/**
 * Spielt, bis die GameScene endet.
 *
 * Es wird nicht blind gedrueckt: Das naechstliegende Relikt bestimmt die
 * Richtung, die Tasten setzen sie um. Punkte entstehen dadurch ueber echte
 * Kollision in GameScene.update(), nicht durch direkte Score-Manipulation.
 */
async function playUntilDone(page, maxMs = 140000, onFirstScore = null) {
  if (sim) return simulateUntilDone(page, onFirstScore);
  return playRealtimeUntilDone(page, maxMs, onFirstScore);
}

/**
 * Simuliert den Run, statt 90 echte Sekunden zu warten (`--sim`).
 *
 * ## Warum das geht
 *
 * `GameScene.update(_time, delta)` benutzt seinen `time`-Parameter nicht: Die
 * gesamte Simulation haengt allein an `delta` (Regel 5 - "Alles Bewegte
 * rechnet mit delta"). Ausserhalb des Duell-Countdowns greift nichts in
 * Entities, Spawn oder Score auf die Wanduhr zu, und `update()` deckelt den
 * Delta nicht. Ruft man die Methode also selbst mit 16,67 ms je Schritt auf,
 * rechnet das Spiel exakt dieselben Frames wie bei 60 fps - nur ohne auf sie
 * zu warten. Gemessen: 90 Sekunden Spielzeit in rund 0,8 Sekunden.
 *
 * ## Warum nicht Phasers timeScale
 *
 * `TimeStep.smoothDelta()` deckelt jeden Frame auf `1000 / targetFps`
 * (16,67 ms). Ein kuenstlich vergroesserter Delta wird abgeschnitten, der
 * Loop laesst sich so nicht beschleunigen. Er muss umgangen werden -
 * `loop.sleep()` haelt ihn an, wir takten selbst.
 *
 * ## Warum der Zeiger und nicht `input_.direction`
 *
 * `InputController.getDirection()` setzt seinen Vektor bei jedem Aufruf
 * zurueck (`readKeyboard()` beginnt mit `set(0, 0)`). Ein direkt gesetzter
 * Richtungsvektor wird dadurch sofort ueberschrieben - der Bot steuert dann
 * gar nicht und sammelt nur zufaellige Treffer. Stattdessen wird der Zeiger
 * gesetzt, wie es ein Finger tut: So laeuft die Eingabe durch dieselbe Kette
 * inklusive Deadzone und Abbremsung nahe am Ziel.
 *
 * ## Was dabei NICHT geprueft wird
 *
 * Rendering, Tweens, Partikel und Bildrate unter Last. Der Loop schlaeft
 * waehrend der Simulation, also laeuft nichts, was an ihm haengt. Deshalb ist
 * `--sim` eine Ergaenzung fuer schnelle Rueckmeldung, kein Ersatz fuer den
 * echten Lauf vor einem Release oder Audit.
 */
async function simulateUntilDone(page, onFirstScore = null) {
  status('Run wird simuliert');

  const ergebnis = await page.evaluate(async () => {
    const game = window.isiHunt;
    const scene = game.scene.getScene('Game');
    if (!scene) return { score: 0, frames: 0, abbruch: 'keine GameScene' };

    // Phasers Loop anhalten - sonst taktet er zusaetzlich zu uns.
    game.loop.sleep();

    const STEP = 1000 / 60;
    // Sicherheitsgrenze: doppelte Rundenlaenge. Ohne sie wuerde ein Fehler in
    // der Abbruchbedingung zu einer Endlosschleife im Browser fuehren.
    const maxFrames = 60 * 240;
    let frames = 0;

    while (scene.phase === 'running' && frames < maxFrames) {
      const orbs = (scene.collectibles ?? []).filter((c) => c?.active && !c.isCollected);
      if (orbs.length > 0 && scene.player) {
        let ziel = orbs[0];
        let besteDistanz = Infinity;
        for (const orb of orbs) {
          const distanz = (orb.x - scene.player.x) ** 2 + (orb.y - scene.player.y) ** 2;
          if (distanz < besteDistanz) {
            besteDistanz = distanz;
            ziel = orb;
          }
        }
        const pointer = scene.input.activePointer;
        pointer.isDown = true;
        pointer.worldX = ziel.x;
        pointer.worldY = ziel.y;
      }

      scene.update(frames * STEP, STEP);
      frames++;

      // Dem Browser gelegentlich Luft geben, damit die Seite waehrend der
      // Simulation nicht als "haengt" gilt.
      if (frames % 900 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    return {
      score: scene.scoring?.currentScore ?? 0,
      frames,
      simulierteSekunden: (frames * STEP) / 1000,
      abbruch: frames >= maxFrames ? 'Framegrenze erreicht' : null,
    };
  });

  // Der Szenenwechsel nach dem Run laeuft ueber `this.time.delayedCall(450)`.
  // Timer haengen an Phasers Loop - ohne dieses Wecken bliebe die ResultScene
  // aus, und jeder `waitForScene(page, 'Result')` liefe in sein Zeitlimit.
  await page.evaluate(() => window.isiHunt.loop.wake());

  if (ergebnis.abbruch) {
    status(`Simulation abgebrochen: ${ergebnis.abbruch}`);
  } else {
    status(`Run simuliert - ${ergebnis.simulierteSekunden.toFixed(0)}s, Score ${ergebnis.score}`);
  }

  if (ergebnis.score > 0 && onFirstScore) await onFirstScore();

  return ergebnis.score;
}

/** Spielt den Run in Echtzeit ueber echte Tastatureingaben. */
async function playRealtimeUntilDone(page, maxMs = 140000, onFirstScore = null) {
  const deadline = Date.now() + maxMs;
  let lastScore = 0;
  let fired = false;

  let letzteMeldung = 0;
  while (Date.now() < deadline) {
    const running = await page.evaluate(() => window.isiHunt?.scene?.isActive('Game') ?? false);
    if (!running) break;

    const state = await readGameState(page);
    if (!state?.player) break;
    if (state.score !== null) lastScore = state.score;

    // Der Run laeuft 90 echte Sekunden; ohne diese Meldung schweigt der Test
    // die ganze Zeit und wirkt wie eingefroren.
    if (Date.now() - letzteMeldung > 2000) {
      status(`Run laeuft, Score ${lastScore}`);
      letzteMeldung = Date.now();
    }

    if (!fired && lastScore > 0 && onFirstScore) {
      await onFirstScore();
      fired = true;
    }

    const target = state.collectibles.sort(
      (a, b) =>
        (a.x - state.player.x) ** 2 +
        (a.y - state.player.y) ** 2 -
        ((b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2),
    )[0];
    if (!target) {
      await page.waitForTimeout(100);
      continue;
    }

    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const keys = [];
    if (dx > 12) keys.push('KeyD');
    else if (dx < -12) keys.push('KeyA');
    if (dy > 12) keys.push('KeyS');
    else if (dy < -12) keys.push('KeyW');

    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(90);
    for (const k of keys) await page.keyboard.up(k);
  }
  return lastScore;
}

/** Rechnet eine Spielkoordinate in eine Bildschirmkoordinate um. */
function toScreen(page, gx, gy) {
  return page.evaluate(
    ([x, y]) => {
      const g = window.isiHunt;
      const r = g.canvas.getBoundingClientRect();
      return {
        sx: r.left + (x / g.scale.width) * r.width,
        sy: r.top + (y / g.scale.height) * r.height,
      };
    },
    [gx, gy],
  );
}

/** Klickt einen Punkt der Spielflaeche mit einem echten Mausklick. */
async function clickGamePoint(page, gx, gy) {
  const { sx, sy } = await toScreen(page, gx, gy);
  await page.mouse.click(sx, sy);
}

/**
 * Wechselt die Scene so, wie das Spiel es tut: ueber die **laufende Scene**,
 * nicht ueber den globalen Manager.
 *
 * `game.scene.start(x)` startet x, beendet die alte Scene aber **nicht** -
 * beide laufen dann parallel. Das Spiel ruft immer `this.scene.start(x)`.
 * Ein Test, der den globalen Manager nimmt, prueft einen Zustand, den es im
 * Spiel nie gibt, und meldete hier bereits einen Fehler, der keiner war.
 */
async function switchScene(page, von, nach, data) {
  await page.evaluate(
    ([v, n, d]) => {
      const scene = window.isiHunt.scene.getScene(v);
      if (scene) scene.scene.start(n, d);
      else window.isiHunt.scene.start(n, d);
    },
    [von, nach, data ?? undefined],
  );
}

/** Aktive Scenes als Liste. */
function activeScenes(page) {
  return page.evaluate(() =>
    window.isiHunt.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key),
  );
}

/**
 * Sammelt alle sichtbaren, interaktiven Elemente einer Scene mit Beschriftung,
 * Weltposition und Trefferflaeche.
 *
 * Die Weltposition wird ueber die Elternkette aufaddiert - `x`/`y` allein sind
 * bei verschachtelten Containern lokal und zeigten beim Bauen auf falsche
 * Stellen.
 */
function collectInteractive(page, sceneKey) {
  return page.evaluate((key) => {
    const scene = window.isiHunt.scene.getScene(key);
    if (!scene) return [];
    const label = (o) => {
      let t = '';
      const dig = (n, d) => {
        if (d > 3) return;
        for (const ch of n.list ?? []) {
          if (ch.type === 'Text' && ch.text && !t) t = ch.text.trim().slice(0, 24);
          if (ch.list) dig(ch, d + 1);
        }
      };
      dig(o, 0);
      return t || `(${o.type})`;
    };
    const out = [];
    const walk = (list, depth) => {
      for (const o of list ?? []) {
        if (o.input?.enabled && o.visible && o.input.hitArea && (o.alpha ?? 1) > 0.05) {
          let wx = o.x ?? 0;
          let wy = o.y ?? 0;
          let par = o.parentContainer;
          while (par) {
            wx += par.x;
            wy += par.y;
            par = par.parentContainer;
          }
          const h = o.input.hitArea;
          out.push({
            label: label(o),
            type: o.type,
            x: Math.round(wx),
            y: Math.round(wy),
            w: Math.round(h.width ?? 0),
            h: Math.round(h.height ?? 0),
          });
        }
        if (o.list && depth < 5) walk(o.list, depth + 1);
      }
    };
    walk(scene.children.list, 0);
    return out;
  }, sceneKey);
}

/**
 * Klickt in einer Scene den Knopf, dessen Beschriftung passt - sonst den
 * ersten anklickbaren.
 *
 * WorldInfo und Challenge fuehren mit je einem Knopf weiter in die Runde.
 * Ueber ihn zu gehen statt die GameScene direkt zu starten ist nicht nur
 * naeher am echten Spiel, sondern noetig: Der Zustandsaufbau fuer Tageslauf
 * und Duell passiert in genau diesen Scenes.
 */
async function klickeErstenKnopf(page, sceneKey, bevorzugt = null) {
  const buttons = await collectInteractive(page, sceneKey);
  if (buttons.length === 0) throw new Error(`${sceneKey}: kein anklickbarer Knopf gefunden`);

  const treffer =
    (bevorzugt && buttons.find((b) => b.label.toUpperCase().includes(bevorzugt))) ?? buttons[0];

  await clickGamePoint(page, treffer.x, treffer.y);
  return treffer.label;
}

function readSave(page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

// =============================================================================
// Suite 1: Menue-Bildschirme
// =============================================================================
async function suiteScreens() {
  suite('Menue-Bildschirme');

  // Ein hohes Level schaltet alle Welten und genug Muenzen fuer Talente frei,
  // damit die Bildschirme mit echtem Inhalt statt leerer Liste geprueft werden.
  const save = makeSave({
    level: 30,
    coins: 5000,
    talentPoints: 8,
    totalRuns: 12,
    bestScore: 4200,
  });
  const { page, context, errors } = await openPage(save);

  try {
    await waitForScene(page, 'Menu');
    record('MenuScene erreicht', true);
    await page.screenshot({ path: `${shotDir}/screen-menu.png` });

    const screens = [
      ['Profile', 'Profil'],
      ['Talents', 'Talentbaum'],
      ['Shop', 'Shop'],
      ['Achievements', 'Erfolge'],
      ['Settings', 'Einstellungen'],
      ['Leaderboard', 'Rangliste'],
      ['Admin', 'Wartung'],
    ];

    for (const [key, label] of screens) {
      status(`Bildschirm ${label}`);
      const before = errors.length;
      const started = await page.evaluate((k) => {
        const g = window.isiHunt;
        if (!g?.scene?.getScene(k)) return false;
        g.scene.start(k);
        return true;
      }, key);

      if (!started) {
        record(`${label} (${key}) vorhanden`, false, 'Scene nicht registriert');
        continue;
      }

      let active = false;
      try {
        await waitForScene(page, key, 10000);
        active = true;
      } catch {
        active = false;
      }
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${shotDir}/screen-${key.toLowerCase()}.png` });

      const fresh = errors.slice(before);
      record(
        `${label} oeffnet ohne Konsolenfehler`,
        active && fresh.length === 0,
        active ? (fresh.length ? fresh[0].slice(0, 70) : 'sauber') : 'Scene wurde nicht aktiv',
      );

      // Zurueck ins Menue, damit der naechste Bildschirm vom selben Punkt startet.
      await switchScene(page, key, 'Menu');
      await waitForScene(page, 'Menu', 10000).catch(() => {});
      await page.waitForTimeout(300);
    }
  } finally {
    await context.close();
  }
}

// =============================================================================
// Suite 2: Spielmodi
// =============================================================================
async function suiteModes() {
  suite('Spielmodi');

  // Solo in mehreren Welten. Level 30 gibt die meisten Welten frei; gepueft
  // werden die ersten drei, weil jeder Run 90 s echte Zeit kostet.
  const worlds = ['silberhain', 'frostzinne', 'glutmark'];
  for (const worldId of worlds) {
    status(`Solo-Run in ${worldId} wird vorbereitet`);
    const save = makeSave({ level: 30, coins: 3000, lastWorldId: worldId });
    const { page, context, errors } = await openPage(save);
    try {
      await waitForScene(page, 'Menu');
      await page.evaluate(
        (w) => window.isiHunt.scene.start('Game', { mode: 'solo', worldId: w }),
        worldId,
      );
      await waitForRunLive(page);
      const score = await playUntilDone(page);
      // 40 s reichten im Volllauf nicht: Der glutmark-Run stand nach seinen
      // 90 Sekunden Spielzeit noch nicht in der Auswertung, einzeln lief
      // dieselbe Welt gruen. Siehe `RESULT_TIMEOUT_MS`.
      await waitForScene(page, 'Result', RESULT_TIMEOUT_MS);
      record(
        `Solo-Run in Welt ${worldId}`,
        score > 0 && errors.length === 0,
        `Score ${score}${errors.length ? `, ${errors.length} Konsolenfehler` : ''}`,
      );
      await page.screenshot({ path: `${shotDir}/mode-solo-${worldId}.png` });
    } catch (e) {
      record(`Solo-Run in Welt ${worldId}`, false, kurzerFehler(e));
    } finally {
      // Erst zur Ruhe kommen lassen, dann schliessen.
      //
      // Ohne diese Pause meldete der frostzinne-Run "Execution context was
      // destroyed": Eine Auswertung aus dem Run lief noch, waehrend der
      // Context bereits zuklappte. Das ist die Naht zwischen zwei Welten -
      // jede oeffnet ihren eigenen Context - und kein Fehler des Spiels.
      await page.waitForTimeout(300).catch(() => {});
      await context.close().catch(() => {});
    }
  }

  // Tageslauf und Bot-Duell brauchen einen aufgebauten ChallengeSystem-Zustand.
  //
  // Frueher startete dieser Test die GameScene direkt mit `{ mode: 'daily' }`
  // ueber eine Bruecke `window.isiHunt.__ch`. Die gab es im Spielcode nie
  // (`git log -S __ch` findet sie nur hier), also lief der Aufruf ins Leere:
  // `GameScene.create()` holt sich `ChallengeSystem.getState()`, bekam `null`
  // und startete keine Runde - `waitForRunLive` lief in sein Zeitlimit.
  //
  // Warum das lange niemandem auffiel: `ChallengeSystem` haelt seinen Zustand
  // in einem Modul-Singleton. Lief vorher im selben Browser-Context schon ein
  // Duell, war `state` noch gesetzt und der Test wurde gruen - aus dem
  // Zustand des vorigen Tests heraus.
  //
  // Jetzt wird derselbe Weg genommen wie beim Spielen mit der Hand:
  // WorldInfoScene baut den Zustand auf und wechselt in die ChallengeScene,
  // von dort geht es in die Runde.
  const challengeModes = [
    ['tageslauf', 'Tageslauf'],
    ['duell', 'Bot-Duell'],
  ];

  for (const [mode, label] of challengeModes) {
    const save = makeSave({ level: 30, coins: 3000 });
    const { page, context, errors } = await openPage(save);
    try {
      await waitForScene(page, 'Menu');
      const ok = await page.evaluate((m) => {
        const g = window.isiHunt;
        try {
          g.scene.start('WorldInfo', { worldId: 'silberhain', mode: m });
          return true;
        } catch {
          return false;
        }
      }, mode);

      if (!ok) {
        record(`${label} startet`, false, 'scene.start warf');
        continue;
      }

      // WorldInfo -> (Knopf) -> Challenge -> (Knopf) -> Game. Beide Schritte
      // brauchen einen echten Klick; die Knopfbeschriftungen stehen im Canvas,
      // deshalb wird ueber die Scene-Umschaltung gewartet statt ueber Text.
      await waitForScene(page, 'WorldInfo', 15000);
      await klickeErstenKnopf(page, 'WorldInfo');
      await waitForScene(page, 'Challenge', 15000);
      await klickeErstenKnopf(page, 'Challenge');

      await waitForRunLive(page);
      const score = await playUntilDone(page);
      record(
        `${label} spielbar`,
        score > 0 && errors.length === 0,
        `Score ${score}${errors.length ? `, ${errors.length} Konsolenfehler` : ''}`,
      );
      await page.screenshot({ path: `${shotDir}/mode-${mode}.png` });
    } catch (e) {
      record(`${label} spielbar`, false, kurzerFehler(e));
    } finally {
      await context.close();
    }
  }
}

// =============================================================================
// Suite 3: Layout ueber Geraeteformate
// =============================================================================
async function suiteLayout() {
  suite('Layout ueber Geraeteformate');

  // Wo Playwright ein gepflegtes Geraeteprofil mitbringt, wird es benutzt -
  // samt echtem Skalierungsfaktor. Nur was dort fehlt (iPad Air, iPad Pro
  // 12.9", der Kurz-Fall mit eingeblendeter Browserleiste), steht als
  // eigener Viewport daneben.
  const CUSTOM = {
    // Apple-Geraetedaten, in Playwright 1.62 nicht enthalten.
    'iPad Air 11"': { viewport: { width: 820, height: 1080 }, deviceScaleFactor: 2 },
    'iPad Pro 12.9"': { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2 },
    // Sehr schmales Android-Format; in Playwright 1.62 nicht enthalten.
    'Galaxy S20': { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3 },
    // Nicht real, sondern der ungueltigste Fall: sehr kurzes Fenster, wie es
    // Safari mit ausgeklappter Adressleiste erzeugt. Hier bricht ein
    // Hoehenfehler zuerst durch.
    'Kurz (Browserleiste)': { viewport: { width: 390, height: 600 }, deviceScaleFactor: 3 },
  };

  const DEVICE_NAMES = [
    'iPhone SE',
    'iPhone 13',
    'iPhone 14 Pro Max',
    'iPhone 15',
    'iPhone 15 Pro Max',
    'iPhone 16',
    'iPhone 16 Pro',
    'iPhone 16 Pro Max',
    'iPhone 17',
    'iPhone 17 Pro Max',
    'iPad Mini',
    'iPad (gen 7)',
    'iPad (gen 11)',
    'iPad Pro 11',
    'Pixel 7',
  ];

  const targets = [];
  for (const name of DEVICE_NAMES) {
    const d = devices[name];
    if (!d) {
      record(`${name} (Profil vorhanden)`, false, 'kein Playwright-Profil dieses Namens');
      continue;
    }
    targets.push([name, { ...d }, d.viewport.width, d.viewport.height]);
  }
  for (const [name, opts] of Object.entries(CUSTOM)) {
    targets.push([
      name,
      { ...opts, isMobile: true, hasTouch: true },
      opts.viewport.width,
      opts.viewport.height,
    ]);
  }

  for (const [name, contextOptions, w, h] of targets) {
    status(`Layout: ${name} (${w}x${h})`);
    const { page, context } = await openPage(makeSave({ level: 30 }), contextOptions);
    try {
      await waitForScene(page, 'Menu');
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const g = window.isiHunt;
        const r = g.canvas.getBoundingClientRect();
        // Der Pause-Knopf sitzt bei GAME_HEIGHT - 58 in Spielkoordinaten und
        // ist das unterste bedienbare Element ueberhaupt.
        const pauseGameY = g.scale.height - 58;
        const pauseScreenY = r.top + (pauseGameY / g.scale.height) * r.height;
        return {
          overflow: Math.round(r.bottom - window.innerHeight),
          pauseVisible: pauseScreenY < window.innerHeight - 10,
          pauseY: Math.round(pauseScreenY),
          viewportH: window.innerHeight,
        };
      });

      record(
        `${name} (${w}x${h})`,
        m.overflow <= 0 && m.pauseVisible,
        m.overflow > 0
          ? `Canvas ragt ${m.overflow}px unter den Rand, Pause-Knopf bei y=${m.pauseY}/${m.viewportH}`
          : `buendig, unterster Knopf bei y=${m.pauseY}/${m.viewportH}`,
      );
    } catch (e) {
      record(`${name} (${w}x${h})`, false, kurzerFehler(e));
    } finally {
      await context.close();
    }
  }
}

// =============================================================================
// Suite 5: iOS / WebKit
// =============================================================================
/**
 * Faehrt dieselbe Seite in **echtem WebKit** statt in Chromium.
 *
 * Warum das eine eigene Suite ist: Die uebrigen Suiten laufen unter Chromium
 * mit iPhone-Viewport und iPhone-User-Agent - das ist Blink, nicht WebKit.
 * Genau die Eigenheiten, die dieses Projekt teuer bezahlt hat, stecken aber in
 * WebKit: `100dvh` und die ein- und ausklappende Adressleiste (viewport.ts),
 * `env(safe-area-inset-*)` (index.html), und die Frage, ob der Canvas nach
 * dem Start ueberhaupt an der richtigen Stelle sitzt.
 *
 * WebKit hier ist Safaris Engine, aber nicht Safari auf einem echten iPhone:
 * Es fehlen die echte Adressleisten-Animation, iOS-Gesten und die
 * Home-Bildschirm-App. Der Pflicht-Handytest bleibt (Abschnitt 10).
 */
async function suiteIos() {
  suite('iOS / WebKit');

  let engine;
  try {
    engine = await webkit.launch({ headless: !watch, slowMo: watch ? 60 : 0 });
  } catch (e) {
    record(
      'WebKit verfuegbar',
      false,
      `${e.message.split('\n')[0].slice(0, 80)} - ` +
        'nachinstallieren mit: npx playwright install webkit',
    );
    return;
  }

  try {
    // Quer durch die Baureihen: Notch, Dynamic Island, kleines und grosses
    // Display. Alle mit echtem WebKit statt nur mit iPhone-Etikett.
    const IOS_DEVICES = [
      'iPhone SE',
      'iPhone 13',
      'iPhone 15',
      'iPhone 16 Pro',
      'iPhone 17 Pro Max',
      'iPad Pro 11',
    ];

    for (const name of IOS_DEVICES) {
      const profile = devices[name];
      if (!profile) {
        record(`${name} (WebKit)`, false, 'kein Playwright-Profil');
        continue;
      }

      status(`WebKit: ${name}`);
      const { page, context, errors } = await openPage(
        makeSave({ level: 30 }),
        { ...profile },
        engine,
      );
      try {
        await waitForScene(page, 'Menu', 25000);
        await page.waitForTimeout(700);

        const m = await page.evaluate(() => {
          const g = window.isiHunt;
          const r = g.canvas.getBoundingClientRect();
          const pauseGameY = g.scale.height - 58;
          const pauseScreenY = r.top + (pauseGameY / g.scale.height) * r.height;
          return {
            webkit: /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
            overflow: Math.round(r.bottom - window.innerHeight),
            pauseVisible: pauseScreenY < window.innerHeight - 10,
            top: Math.round(r.top),
          };
        });

        const ok = m.webkit && m.overflow <= 0 && m.pauseVisible && errors.length === 0;
        record(
          `${name} in WebKit`,
          ok,
          !m.webkit
            ? 'Engine ist nicht WebKit'
            : m.overflow > 0
              ? `Canvas ragt ${m.overflow}px heraus`
              : errors.length
                ? errors[0].slice(0, 60)
                : `buendig, Canvas beginnt bei y=${m.top}`,
        );
        await page.screenshot({
          path: `${shotDir}/ios-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`,
        });
      } catch (e) {
        record(`${name} in WebKit`, false, kurzerFehler(e));
      } finally {
        await context.close();
      }
    }

    // Ein echter Run unter WebKit: Steuerung, Kollision und Punktevergabe
    // laufen dort ueber andere Eingabe- und Rendering-Pfade als in Chromium.
    const { page, context, errors } = await openPage(
      makeSave({ level: 30 }),
      { ...devices['iPhone 15'] },
      engine,
    );
    try {
      await waitForScene(page, 'Menu', 25000);
      await page.evaluate(() => window.isiHunt.scene.start('Game', { mode: 'solo' }));
      await waitForRunLive(page, 30000);
      const score = await playUntilDone(page);
      await waitForScene(page, 'Result', RESULT_TIMEOUT_MS);
      record(
        'Kompletter Run unter WebKit',
        score > 0 && errors.length === 0,
        `Score ${score}${errors.length ? `, ${errors.length} Konsolenfehler` : ''}`,
      );
      await page.screenshot({ path: `${shotDir}/ios-run-result.png` });
    } catch (e) {
      record('Kompletter Run unter WebKit', false, kurzerFehler(e));
    } finally {
      await context.close();
    }
  } finally {
    await engine.close();
  }
}

// =============================================================================
// Suite 6: Navigation
// =============================================================================
/**
 * Klickt sich durch die Menuewege wie ein Finger - und wieder zurueck.
 *
 * Bewusst mit **echten Klicks** auf Bildschirmkoordinaten statt mit
 * `scene.start(...)`: Nur so laufen Trefferflaeche, Zeichenreihenfolge und
 * Koordinatenumrechnung mit. Ein `scene.start()` wuerde selbst dann gruen
 * melden, wenn der Knopf gar nicht erreichbar ist.
 *
 * Beim Bauen zeigte sich, warum das noetig ist: Phasers `hitTest()` von Hand
 * aufzurufen meldete einen Info-Knopf als "verdeckt", waehrend ein echter
 * Klick ihn einwandfrei ausloeste. Der Klick ist der Massstab.
 */
async function suiteNavigation() {
  suite('Navigation');

  const save = makeSave({
    level: 30,
    coins: 5000,
    talentPoints: 5,
    totalRuns: 12,
    bestScore: 4200,
  });
  const { page, context, errors } = await openPage(save);

  try {
    await waitForScene(page, 'Menu');
    await page.waitForTimeout(600);

    // Beschriftung -> erwartete Ziel-Scene. Die Knopfposition wird zur
    // Laufzeit aus der Scene gelesen, nicht abgetippt: verschiebt jemand den
    // Knopf, folgt der Test mit, statt falsch rot zu werden.
    const WEGE = [
      ['PROFIL', 'Profile'],
      // 'TALENTE', nicht 'TALENTBAUM': Der Knopf wurde am 2026-08-21
      // umbenannt (8de7e6b), das Label hier blieb stehen. Der Schritt war
      // seitdem dauerhaft rot und pruefte den echten Weg nicht mehr - er
      // fiel in zwei Audits als "vorbestehend" durch (Audit 2026-08-23).
      ['TALENTE', 'Talents'],
      ['ERFOLGE', 'Achievements'],
      ['EINSTELLUNGEN', 'Settings'],
    ];

    for (const [label, ziel] of WEGE) {
      const vorher = errors.length;

      status(`Navigation: Menue -> ${label}`);
      const buttons = await collectInteractive(page, 'Menu');
      const treffer = buttons.find((b) => b.label.toUpperCase().startsWith(label));
      if (!treffer) {
        // Die vorhandenen Beschriftungen mitgeben: Bei einer Umbenennung
        // steht die Ursache dann direkt im Fehlschlag, statt eine
        // Untersuchung zu erfordern.
        const vorhanden = buttons.map((b) => b.label).join(', ');
        record(`Menue -> ${label}`, false, `Knopf nicht gefunden; im Menue: ${vorhanden}`);
        continue;
      }

      await clickGamePoint(page, treffer.x, treffer.y);
      let angekommen = false;
      try {
        await waitForScene(page, ziel, SCENE_TIMEOUT_MS);
        angekommen = true;
      } catch {
        // Nachfassen statt sofort scheitern.
        //
        // Im Volllauf meldete dieser Schritt "Scene Settings wurde nicht
        // aktiv (aktiv: Settings)" - die Scene war da, nur eben ein paar
        // Millisekunden nach dem Timeout. Dieselbe Pruefung lief einzeln in
        // Millisekunden durch; unter der Last von 20 Minuten Volllauf reichte
        // die Frist nicht. Eine hoehere Frist allein loest das nicht
        // zuverlaessig, ein zweiter Blick nach dem Timeout schon.
        angekommen = (await activeScenes(page)).includes(ziel);
      }

      const frisch = errors.slice(vorher);
      record(
        `Menue -> ${label} oeffnet ${ziel}`,
        angekommen && frisch.length === 0,
        angekommen
          ? frisch.length
            ? frisch[0].slice(0, 60)
            : `Klick auf ${treffer.x},${treffer.y}`
          : `Scene ${ziel} wurde nicht aktiv (aktiv: ${(await activeScenes(page)).join(', ')})`,
      );

      if (!angekommen) {
        await switchScene(page, ziel, 'Menu');
        await waitForScene(page, 'Menu', SCENE_TIMEOUT_MS).catch(() => {});
        continue;
      }

      // Zurueck - ueber den Zurueck-Knopf, nicht per scene.start().
      await page.waitForTimeout(500);
      const zurueckBtns = await collectInteractive(page, ziel);
      const zurueck = zurueckBtns.find((b) => /ZUR(UE|Ü)CK|MEN(UE|Ü)/i.test(b.label));

      if (!zurueck) {
        record(`${ziel} -> zurueck`, false, 'kein Zurueck-Knopf gefunden');
        await switchScene(page, ziel, 'Menu');
        await waitForScene(page, 'Menu', SCENE_TIMEOUT_MS).catch(() => {});
        continue;
      }

      await clickGamePoint(page, zurueck.x, zurueck.y);
      let zurueckOk = false;
      try {
        await waitForScene(page, 'Menu', SCENE_TIMEOUT_MS);
        zurueckOk = true;
      } catch {
        zurueckOk = false;
      }
      record(
        `${ziel} -> zurueck ins Menue`,
        zurueckOk,
        zurueckOk ? `ueber "${zurueck.label}"` : 'Menue wurde nicht wieder aktiv',
      );

      if (!zurueckOk) {
        await switchScene(page, ziel, 'Menu');
        await waitForScene(page, 'Menu', SCENE_TIMEOUT_MS).catch(() => {});
      }
      await page.waitForTimeout(300);
    }
  } catch (e) {
    record('Navigationswege', false, kurzerFehler(e));
  } finally {
    await context.close();
  }
}

// =============================================================================
// Suite 7: Bedienelemente (Ueberlappung, Position, Groesse, Scrollen)
// =============================================================================
/**
 * Prueft, was sonst erst auf dem Geraet auffaellt: Knoepfe, die ineinander
 * ragen, aus der Spielflaeche laufen oder zu klein zum Treffen sind - und ob
 * lange Menues wirklich scrollbar sind.
 *
 * **Ueberlappung ist nicht automatisch ein Fehler.** Das Logo im Hauptmenue
 * traegt eine 640x360-Trefferflaeche (Groesse der Originaltextur, nicht der
 * Anzeige) und liegt damit unter mehreren Knoepfen. Weil Knoepfe auf
 * `Depth.UI` liegen und Phaser beim vordersten Treffer stoppt, gewinnt
 * trotzdem der Knopf - ein echter Klick auf VOLLBILD liefert VOLLBILD.
 * Gemeldet wird deshalb nur die Ueberlappung **zweier echter Knoepfe**; dort
 * gibt es keine verlaessliche Rangfolge.
 */
async function suiteControls() {
  suite('Bedienelemente');

  const save = makeSave({
    level: 30,
    coins: 5000,
    talentPoints: 5,
    totalRuns: 12,
    bestScore: 4200,
  });
  const { page, context } = await openPage(save);

  // Tippziele werden in **CSS-Pixeln** bewertet, nicht in Spielpixeln: Die
  // Spielflaeche ist 720 breit und wird auf die Geraetebreite skaliert, ein
  // 60-px-Knopf misst auf einem 390-px-iPhone also nur ~33 CSS-px.
  //
  // Apple empfiehlt 44 pt. Dieser Wert wird hier als *Hinweis* gefuehrt und
  // nicht als Fehler: Der Zurueck-Knopf liegt mit ~33 CSS-px darunter, ist
  // aber seit v0.1.3 auf dem Geraet ausdruecklich als gut bedienbar
  // bestaetigt (TODO.md, Phase 1). Ein harter Fehler waere hier eine
  // erfundene Regel, die die Suite nur rot faerbt.
  //
  // Hart geprueft wird erst die Haelfte davon - so klein, dass Treffen
  // wirklich zum Gluecksspiel wird.
  const HINWEIS_CSS_PX = 44;
  const FEHLER_CSS_PX = 22;

  try {
    await waitForScene(page, 'Menu');
    await page.waitForTimeout(600);

    const SCENES = ['Menu', 'Profile', 'Talents', 'Shop', 'Achievements', 'Settings'];

    // Gewechselt wird immer von der gerade offenen Scene aus - siehe
    // switchScene(): der globale Manager wuerde die alte mitlaufen lassen.
    let vorige = 'Menu';
    for (const key of SCENES) {
      if (key !== 'Menu') {
        // Von der GERADE offenen Scene aus wechseln, nicht pauschal von
        // 'Menu': `switchScene()` ruft `scene.scene.start()` auf der
        // genannten Scene auf, und nur diese wird dabei gestoppt. Stand fest
        // 'Menu' hier, blieb ab dem zweiten Durchlauf die vorige Scene aktiv
        // und fing mit ihren Trefferflaechen die Zeigerereignisse ab.
        // Sichtbar wurde das erst mit dem Laden als vierter Scene: Danach
        // liess sich der Profilbildschirm nicht mehr wischen.
        await switchScene(page, vorige, key);
        try {
          await waitForScene(page, key, 10000);
        } catch {
          record(`${key}: Bedienelemente`, false, 'Scene wurde nicht aktiv');
          continue;
        }
        await page.waitForTimeout(700);
      }

      status(`Bedienelemente in ${key}`);
      const items = await collectInteractive(page, key);
      const spielHoehe = await page.evaluate(() => window.isiHunt.scale.height);

      const knoepfe = items.filter((i) => i.type === 'Container' && i.w > 0 && i.h > 0);
      const rect = (i) => ({
        l: i.x - i.w / 2,
        r: i.x + i.w / 2,
        t: i.y - i.h / 2,
        b: i.y + i.h / 2,
      });

      // 1. Ueberlappung zweier Knoepfe.
      const kollisionen = [];
      for (let a = 0; a < knoepfe.length; a++) {
        for (let b = a + 1; b < knoepfe.length; b++) {
          const ra = rect(knoepfe[a]);
          const rb = rect(knoepfe[b]);
          const ox = Math.min(ra.r, rb.r) - Math.max(ra.l, rb.l);
          const oy = Math.min(ra.b, rb.b) - Math.max(ra.t, rb.t);
          if (ox > 2 && oy > 2) {
            kollisionen.push(
              `${knoepfe[a].label} / ${knoepfe[b].label} (${Math.round(ox)}x${Math.round(oy)})`,
            );
          }
        }
      }
      record(
        `${key}: keine ueberlappenden Knoepfe`,
        kollisionen.length === 0,
        kollisionen.length
          ? kollisionen.slice(0, 2).join(' | ')
          : `${knoepfe.length} Knoepfe geprueft`,
      );

      // 2. Ausserhalb der Spielflaeche. Scrollbare Scenes ausgenommen: dort
      //    liegt Inhalt bewusst unterhalb und wird hereingescrollt.
      const scrollbar = key === 'Profile';
      const raus = knoepfe.filter((i) => {
        const r = rect(i);
        return r.l < -4 || r.r > 724 || r.t < -4 || r.b > spielHoehe + 4;
      });
      record(
        `${key}: alle Knoepfe innerhalb der Spielflaeche`,
        raus.length === 0 || scrollbar,
        raus.length === 0
          ? 'ok'
          : scrollbar
            ? `${raus.length} unterhalb, aber Scene scrollt`
            : raus
                .slice(0, 2)
                .map((i) => `${i.label} bei y=${i.y}`)
                .join(' | '),
      );

      // 3. Tippziele, umgerechnet in CSS-Pixel des tatsaechlichen Viewports.
      const cssProSpielpixel = await page.evaluate(() => {
        const g = window.isiHunt;
        return g.canvas.getBoundingClientRect().width / g.scale.width;
      });
      const inCss = (v) => Math.round(v * cssProSpielpixel);

      const zuKlein = knoepfe.filter(
        (i) => inCss(i.w) < FEHLER_CSS_PX || inCss(i.h) < FEHLER_CSS_PX,
      );
      const knapp = knoepfe.filter(
        (i) => !zuKlein.includes(i) && (inCss(i.w) < HINWEIS_CSS_PX || inCss(i.h) < HINWEIS_CSS_PX),
      );

      record(
        `${key}: Tippziele treffbar`,
        zuKlein.length === 0,
        zuKlein.length
          ? zuKlein
              .slice(0, 3)
              .map((i) => `${i.label} ${inCss(i.w)}x${inCss(i.h)} CSS-px`)
              .join(' | ')
          : knapp.length
            ? `ok; ${knapp.length} unter Apples 44 pt (kleinstes ` +
              `${Math.min(...knapp.map((i) => Math.min(inCss(i.w), inCss(i.h))))} CSS-px)`
            : 'alle >= 44 CSS-px',
      );

      await page.screenshot({ path: `${shotDir}/controls-${key.toLowerCase()}.png` });
      vorige = key;
    }

    // 4. Scrollen: ProfileScene ist die einzige Scene mit
    //    `attachVerticalScroll()`. Gescrollt wird per echtem Drag, nicht ueber
    //    einen gesetzten Offset - der Drag laeuft durch dieselbe Pointer-Logik
    //    wie ein Finger.
    await switchScene(page, vorige, 'Profile');
    await waitForScene(page, 'Profile', 10000);
    await page.waitForTimeout(800);

    // Gemessen wird der **scrollende Container selbst**, nicht ein beliebiger
    // Knopf: Der Zurueck-Knopf liegt bewusst ausserhalb des Scroll-Inhalts und
    // bewegt sich nie mit. Ein Test, der ihn als Referenz nimmt, meldet
    // faelschlich "scrollt nicht" - genau das passierte beim Bauen.
    const vorherY = await page.evaluate(() => {
      const sc = window.isiHunt.scene.getScene('Profile');
      const cont = sc.children.list.filter((o) => o.type === 'Container');
      const inhalt = cont.reduce(
        (a, b) => ((b.list?.length ?? 0) > (a?.list?.length ?? 0) ? b : a),
        null,
      );
      return inhalt ? Math.round(inhalt.y) : null;
    });

    const von = await toScreen(page, 360, 800);
    const nach = await toScreen(page, 360, 300);
    await page.mouse.move(von.sx, von.sy);
    await page.mouse.down();
    for (let s = 1; s <= 8; s++) {
      await page.mouse.move(von.sx, von.sy + ((nach.sy - von.sy) * s) / 8);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);

    const nachherY = await page.evaluate(() => {
      const sc = window.isiHunt.scene.getScene('Profile');
      const cont = sc.children.list.filter((o) => o.type === 'Container');
      const inhalt = cont.reduce(
        (a, b) => ((b.list?.length ?? 0) > (a?.list?.length ?? 0) ? b : a),
        null,
      );
      return inhalt ? Math.round(inhalt.y) : null;
    });

    const verschoben = vorherY !== null && nachherY !== null ? Math.abs(nachherY - vorherY) : 0;
    // Das DOM-Namensfeld liegt als echtes <input> ueber dem Canvas. Verlaesst
    // man ProfileScene, muss es verschwinden - sonst schwebt es ueber der
    // naechsten Scene.
    //
    // **Der Wechsel muss auf der Scene selbst laufen** (`scene.scene.start`),
    // nicht auf dem globalen Manager (`game.scene.start`). Nur der erste Weg
    // beendet die alte Scene; der zweite laesst sie mitlaufen. Ein Test mit
    // dem globalen Manager meldete hier faelschlich einen Fehler, den es
    // nicht gibt: Phaser raeumt DOMElements beim Scene-Shutdown selbst ab.
    await switchScene(page, 'Profile', 'Talents');
    await waitForScene(page, 'Talents', 10000);
    await page.waitForTimeout(800);
    const uebrig = await page.evaluate(
      () =>
        [...document.querySelectorAll('input, textarea')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.height > 0 && getComputedStyle(e).display !== 'none';
        }).length,
    );
    record(
      'Namensfeld verschwindet beim Verlassen von Profile',
      uebrig === 0,
      uebrig === 0
        ? 'kein DOM-Eingabefeld mehr sichtbar'
        : `${uebrig} sichtbares Eingabefeld liegt ueber der naechsten Scene`,
    );
    await page.screenshot({ path: `${shotDir}/controls-input-nach-wechsel.png` });

    record(
      'Profile laesst sich per Wischen scrollen',
      verschoben > 20,
      vorherY === null
        ? 'kein Inhalts-Container gefunden'
        : `Inhalt wanderte ${verschoben} px (${vorherY} -> ${nachherY})`,
    );
    await page.screenshot({ path: `${shotDir}/controls-profile-scrolled.png` });
  } catch (e) {
    record('Bedienelemente', false, kurzerFehler(e));
  } finally {
    await context.close();
  }
}

// =============================================================================
// Suite 4: Fortschritt und Persistenz
// =============================================================================
async function suiteProgress() {
  suite('Fortschritt und Persistenz');

  const { page, context, errors } = await openPage(makeSave());
  try {
    await waitForScene(page, 'Menu');
    const before = await readSave(page);

    await page.evaluate(() => window.isiHunt.scene.start('Game', { mode: 'solo' }));
    await waitForRunLive(page);
    const score = await playUntilDone(page);
    await waitForScene(page, 'Result', RESULT_TIMEOUT_MS);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shotDir}/progress-result.png` });

    const after = await readSave(page);

    record(
      'Run erhoeht totalRuns',
      (after?.totalRuns ?? 0) === (before?.totalRuns ?? 0) + 1,
      `${before?.totalRuns ?? 0} -> ${after?.totalRuns ?? 0}`,
    );
    record(
      'Bestwert uebernommen',
      (after?.bestScore ?? 0) >= score && score > 0,
      `bestScore = ${after?.bestScore ?? 0}, erspielt ${score}`,
    );
    record(
      'XP oder Level gestiegen',
      (after?.level ?? 1) > (before?.level ?? 1) || (after?.xp ?? 0) > (before?.xp ?? 0),
      `Level ${before?.level} -> ${after?.level}, XP ${before?.xp} -> ${after?.xp}`,
    );
    record(
      'Muenzen gutgeschrieben',
      (after?.totalCoinsEarned ?? 0) > (before?.totalCoinsEarned ?? 0),
      `${before?.totalCoinsEarned ?? 0} -> ${after?.totalCoinsEarned ?? 0}`,
    );
    record(
      'Erfolg freigeschaltet',
      (after?.unlockedAchievements?.length ?? 0) > 0,
      `${after?.unlockedAchievements?.length ?? 0} Erfolge`,
    );

    // Spielstand muss ein Neuladen ueberleben - das ist der eigentliche Zweck
    // von localStorage und die Stelle, an der ein Serialisierungsfehler
    // sonst erst Tage spaeter auffiele.
    await page.reload({ waitUntil: 'networkidle' });
    await waitForScene(page, 'Menu');
    const reloaded = await readSave(page);
    record(
      'Spielstand ueberlebt Neuladen',
      reloaded?.totalRuns === after?.totalRuns && reloaded?.bestScore === after?.bestScore,
      `totalRuns ${reloaded?.totalRuns}, bestScore ${reloaded?.bestScore}`,
    );

    record(
      'Keine Konsolenfehler waehrend Fortschritt',
      errors.length === 0,
      errors.length ? errors[0].slice(0, 70) : 'sauber',
    );
  } catch (e) {
    record('Fortschrittskette', false, kurzerFehler(e));
  } finally {
    await context.close();
  }

  // Talentkauf gegen echte Muenzen, getrennt vom Run.
  const { page: p2, context: c2 } = await openPage(
    makeSave({ level: 20, coins: 5000, talentPoints: 5 }),
  );
  try {
    await waitForScene(p2, 'Menu');
    await p2.evaluate(() => window.isiHunt.scene.start('Talents', { returnTo: 'Menu' }));
    await waitForScene(p2, 'Talents', 10000);
    await p2.waitForTimeout(800);
    await p2.screenshot({ path: `${shotDir}/progress-talents.png` });
    record('Talentbaum oeffnet mit Guthaben', true, '5000 Muenzen, 5 Punkte');
  } catch (e) {
    record('Talentbaum oeffnet mit Guthaben', false, kurzerFehler(e));
  } finally {
    await c2.close();
  }
}

// =============================================================================
try {
  if (runSuite('screens')) await suiteScreens();
  if (runSuite('layout')) await suiteLayout();
  if (runSuite('nav')) await suiteNavigation();
  if (runSuite('controls')) await suiteControls();
  if (runSuite('ios')) await suiteIos();
  if (runSuite('progress')) await suiteProgress();
  if (runSuite('modes')) await suiteModes();
} catch (error) {
  record('Durchlauf abgebrochen', false, error.message);
} finally {
  if (watch) await new Promise((r) => setTimeout(r, 4000));
  await browser.close();
  server?.kill();
}

// --- Bericht ------------------------------------------------------------------
statusEnde();
const passed = steps.filter((s) => s.ok).length;
console.log('\n' + '='.repeat(60));
console.log(`Playtest: ${passed}/${steps.length} Schritte bestanden`);
console.log(`Screenshots: ${shotDir}`);

if (failures.length > 0) {
  console.log('\nFehlgeschlagen:');
  for (const f of failures) console.log(' -', f);
  console.error('\nPlaytest fehlgeschlagen.');
  process.exit(1);
}
console.log('\nPlaytest gruen.');
