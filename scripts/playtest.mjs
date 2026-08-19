// Spielt isiHunt automatisiert in einem echten Chromium durch (Playwright).
//
// Warum das geht, obwohl Scenes und Entities nicht unit-testbar sind
// (ARCHITECTURE.md 9.2): `main.ts` haengt die Phaser-Instanz im Dev-Build als
// `window.isiHunt` an. Darueber laesst sich der laufende Spielzustand lesen -
// Scene, Score, Spielerposition, liegende Relikte. Gesteuert wird ueber echte
// Tastatureingaben, nicht ueber gesetzte Positionen: so laeuft derselbe Weg
// durch InputController und GameScene.update() wie beim Spielen mit der Hand.
//
// Vier Suiten, einzeln waehlbar ueber --only:
//   screens    Jeder Menue-Bildschirm: oeffnet, Konsole sauber, Screenshot
//   modes      Solo je Welt, Tageslauf, lokales Duell, Bot-Duell
//   layout     Canvas-Ueberstand und Trefferflaechen ueber 7 Geraeteformate
//   progress   Levelaufstieg, Talentkauf, Erfolge, Spielstand ueber Neuladen
//
// Ersetzt den Handytest nicht (Touch-Eigenheiten, Game-Feel), faengt aber
// Regressionen in Scene-Fluss, Steuerung, Kollision und Persistenz ab.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 5199;

const argv = process.argv.slice(2);
const watch = argv.includes('--watch');
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
    playerName: 'Playtest',
    cloudId: null,
    ...overrides,
  };
}

// --- Berichterstattung --------------------------------------------------------
const steps = [];
const failures = [];
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log(`\n=== ${name} ===`);
}

function record(name, ok, detail) {
  steps.push({ suite: currentSuite, name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failures.push(`[${currentSuite}] ${name}: ${detail ?? 'fehlgeschlagen'}`);
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
    { stdio: 'ignore' }
  );
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

/** Neue Seite mit vorgesetztem Spielstand und Konsolenueberwachung. */
async function openPage(save = makeSave(), viewport = null) {
  const context = await browser.newContext(
    viewport
      ? { viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { ...devices['iPhone 13'] }
  );
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
    [SAVE_KEY, save]
  );
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, context, errors };
}

async function waitForScene(page, key, timeoutMs = 20000) {
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
    { timeout: timeoutMs }
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
  const deadline = Date.now() + maxMs;
  let lastScore = 0;
  let fired = false;

  while (Date.now() < deadline) {
    const running = await page.evaluate(
      () => window.isiHunt?.scene?.isActive('Game') ?? false
    );
    if (!running) break;

    const state = await readGameState(page);
    if (!state?.player) break;
    if (state.score !== null) lastScore = state.score;

    if (!fired && lastScore > 0 && onFirstScore) {
      await onFirstScore();
      fired = true;
    }

    const target = state.collectibles.sort(
      (a, b) =>
        (a.x - state.player.x) ** 2 +
        (a.y - state.player.y) ** 2 -
        ((b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2)
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
  const save = makeSave({ level: 30, coins: 5000, talentPoints: 8, totalRuns: 12, bestScore: 4200 });
  const { page, context, errors } = await openPage(save);

  try {
    await waitForScene(page, 'Menu');
    record('MenuScene erreicht', true);
    await page.screenshot({ path: `${shotDir}/screen-menu.png` });

    const screens = [
      ['Profile', 'Profil'],
      ['Talents', 'Talentbaum'],
      ['Achievements', 'Erfolge'],
      ['Settings', 'Einstellungen'],
      ['Leaderboard', 'Rangliste'],
      ['Admin', 'Wartung'],
    ];

    for (const [key, label] of screens) {
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
        active ? (fresh.length ? fresh[0].slice(0, 70) : 'sauber') : 'Scene wurde nicht aktiv'
      );

      // Zurueck ins Menue, damit der naechste Bildschirm vom selben Punkt startet.
      await page.evaluate(() => window.isiHunt.scene.start('Menu'));
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
    const save = makeSave({ level: 30, coins: 3000, lastWorldId: worldId });
    const { page, context, errors } = await openPage(save);
    try {
      await waitForScene(page, 'Menu');
      await page.evaluate(
        (w) => window.isiHunt.scene.start('Game', { mode: 'solo', worldId: w }),
        worldId
      );
      await waitForRunLive(page);
      const score = await playUntilDone(page);
      await waitForScene(page, 'Result', 40000);
      record(
        `Solo-Run in Welt ${worldId}`,
        score > 0 && errors.length === 0,
        `Score ${score}${errors.length ? `, ${errors.length} Konsolenfehler` : ''}`
      );
      await page.screenshot({ path: `${shotDir}/mode-solo-${worldId}.png` });
    } catch (e) {
      record(`Solo-Run in Welt ${worldId}`, false, e.message.slice(0, 60));
    } finally {
      await context.close();
    }
  }

  // Tageslauf und Bot-Duell laufen ueber ChallengeSystem statt direkt.
  const challengeModes = [
    ['daily', 'Tageslauf', (w) => `window.isiHunt.__ch.startDaily(${JSON.stringify(w)})`],
    ['bot', 'Bot-Duell', (w) => `window.isiHunt.__ch.startBot(${JSON.stringify(w)})`],
  ];

  for (const [mode, label] of challengeModes) {
    const save = makeSave({ level: 30, coins: 3000 });
    const { page, context, errors } = await openPage(save);
    try {
      await waitForScene(page, 'Menu');
      const ok = await page.evaluate((m) => {
        const g = window.isiHunt;
        try {
          g.scene.start('Game', { mode: m, worldId: 'silberhain' });
          return true;
        } catch {
          return false;
        }
      }, mode);

      if (!ok) {
        record(`${label} startet`, false, 'scene.start warf');
        continue;
      }

      await waitForRunLive(page);
      const score = await playUntilDone(page);
      record(
        `${label} spielbar`,
        score > 0 && errors.length === 0,
        `Score ${score}${errors.length ? `, ${errors.length} Konsolenfehler` : ''}`
      );
      await page.screenshot({ path: `${shotDir}/mode-${mode}.png` });
    } catch (e) {
      record(`${label} spielbar`, false, e.message.slice(0, 60));
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

  // Echte CSS-Viewports gaengiger Geraete im Hochformat.
  const VIEWPORTS = [
    ['iPhone SE 2022', 375, 667],
    ['iPhone 13 / 14', 390, 664],
    ['iPhone 14 Pro Max', 430, 745],
    ['Pixel 7', 412, 732],
    ['Galaxy S20', 360, 740],
    ['iPad mini', 768, 1024],
    ['Kurz (Browserleiste)', 390, 600],
  ];

  for (const [name, w, h] of VIEWPORTS) {
    const { page, context } = await openPage(makeSave({ level: 30 }), { width: w, height: h });
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
          : `buendig, unterster Knopf bei y=${m.pauseY}/${m.viewportH}`
      );
    } catch (e) {
      record(`${name} (${w}x${h})`, false, e.message.slice(0, 60));
    } finally {
      await context.close();
    }
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
    await waitForScene(page, 'Result', 40000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shotDir}/progress-result.png` });

    const after = await readSave(page);

    record(
      'Run erhoeht totalRuns',
      (after?.totalRuns ?? 0) === (before?.totalRuns ?? 0) + 1,
      `${before?.totalRuns ?? 0} -> ${after?.totalRuns ?? 0}`
    );
    record(
      'Bestwert uebernommen',
      (after?.bestScore ?? 0) >= score && score > 0,
      `bestScore = ${after?.bestScore ?? 0}, erspielt ${score}`
    );
    record(
      'XP oder Level gestiegen',
      (after?.level ?? 1) > (before?.level ?? 1) || (after?.xp ?? 0) > (before?.xp ?? 0),
      `Level ${before?.level} -> ${after?.level}, XP ${before?.xp} -> ${after?.xp}`
    );
    record(
      'Muenzen gutgeschrieben',
      (after?.totalCoinsEarned ?? 0) > (before?.totalCoinsEarned ?? 0),
      `${before?.totalCoinsEarned ?? 0} -> ${after?.totalCoinsEarned ?? 0}`
    );
    record(
      'Erfolg freigeschaltet',
      (after?.unlockedAchievements?.length ?? 0) > 0,
      `${after?.unlockedAchievements?.length ?? 0} Erfolge`
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
      `totalRuns ${reloaded?.totalRuns}, bestScore ${reloaded?.bestScore}`
    );

    record('Keine Konsolenfehler waehrend Fortschritt', errors.length === 0,
      errors.length ? errors[0].slice(0, 70) : 'sauber');
  } catch (e) {
    record('Fortschrittskette', false, e.message.slice(0, 70));
  } finally {
    await context.close();
  }

  // Talentkauf gegen echte Muenzen, getrennt vom Run.
  const { page: p2, context: c2 } = await openPage(
    makeSave({ level: 20, coins: 5000, talentPoints: 5 })
  );
  try {
    await waitForScene(p2, 'Menu');
    await p2.evaluate(() => window.isiHunt.scene.start('Talents', { returnTo: 'Menu' }));
    await waitForScene(p2, 'Talents', 10000);
    await p2.waitForTimeout(800);
    await p2.screenshot({ path: `${shotDir}/progress-talents.png` });
    record('Talentbaum oeffnet mit Guthaben', true, '5000 Muenzen, 5 Punkte');
  } catch (e) {
    record('Talentbaum oeffnet mit Guthaben', false, e.message.slice(0, 60));
  } finally {
    await c2.close();
  }
}

// =============================================================================
try {
  if (runSuite('screens')) await suiteScreens();
  if (runSuite('layout')) await suiteLayout();
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
