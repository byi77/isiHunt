// Fuehrt einen echten Browser-Lauf gegen die mobilen Performance-Budgets aus.
// Ohne --sim laeuft die Render-Schleife 90 Sekunden in Echtzeit. --sim ist
// nur ein schnelles Integrations-Gate fuer die Simulations- und Objektzahlen.
import { chromium, devices } from 'playwright';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 5200;
const URL = `http://localhost:${PORT}/`;
const sim = process.argv.includes('--sim');
const SAVE_KEY = 'isihunt.save.v1';

function makeSave() {
  return {
    version: 9,
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
    lastWorldId: 'silberhain',
    ownedShipShapes: ['arrow'],
    ownedShipColors: ['world'],
    ownedShipAuras: ['none'],
    shipShape: 'arrow',
    shipColor: 'world',
    shipAura: 'none',
    soundEnabled: false,
    hapticsEnabled: false,
    playerName: 'Playtest',
    cloudId: null,
  };
}

let server;
let browser;
try {
  server = spawn(
    process.execPath,
    [
      resolve('node_modules', 'vite', 'bin', 'vite.js'),
      '--mode',
      'performance',
      '--port',
      String(PORT),
    ],
    { stdio: 'ignore' },
  );

  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      const response = await fetch(URL);
      if (response.ok) break;
    } catch {
      // Vite startet noch.
    }
    if (Date.now() > deadline) throw new Error('Performance-Dev-Server startete nicht.');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }

  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    // Im Simulationsmodus laufen keine Phaser-Timer fuer die Aufraeumung von
    // Partikeleffekten. Reduced Motion macht diesen schnellen Gate-Lauf daher
    // deterministisch; der echte Realtime-Lauf bleibt unveraendert.
    reducedMotion: sim ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('crash', () => errors.push('Browserseite abgestuerzt'));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(
    ([key, save]) => window.localStorage.setItem(key, JSON.stringify(save)),
    [SAVE_KEY, makeSave()],
  );
  // Vite mantiene die HMR-Verbindung offen; networkidle waere im
  // Performance-Gate deshalb kein stabiler Startpunkt.
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => Boolean(window.isiHunt), undefined, { timeout: 25_000 });
  } catch (error) {
    console.error('Performance-Browserfehler vor Phaser-Start:', errors);
    throw error;
  }
  // BootScene startet Menu nach dem Auth-Check asynchron. Erst danach darf der
  // direkte Game-Start erfolgen, sonst kann BootScene ihn wieder überschreiben.
  await page.waitForFunction(() => window.isiHunt?.scene?.isActive('Menu') === true, undefined, {
    timeout: 25_000,
  });
  await page.evaluate(() => {
    window.isiHunt.scene.start('Game', { mode: 'solo', worldId: 'silberhain' });
  });
  await page.waitForFunction(
    () => window.isiHunt?.scene?.getScene('Game')?.scene?.isActive() === true,
    undefined,
    { timeout: 25_000, polling: 250 },
  );
  await page.waitForFunction(
    () => window.isiHunt?.scene?.getScene('Game')?.phase === 'running',
    undefined,
    // Phaser's mobile emulation can suspend requestAnimationFrame while the
    // countdown scene is being promoted. Interval polling keeps this gate
    // independent of that browser scheduling detail.
    { timeout: 25_000, polling: 250 },
  );

  let result;
  if (sim) {
    result = await page.evaluate(async () => {
      const game = window.isiHunt;
      const scene = game.scene.getScene('Game');
      const step = 1000 / 60;
      const maxFrames = 60 * 120;
      let frames = 0;

      game.loop.sleep();
      while (scene?.phase === 'running' && frames < maxFrames) {
        const orbs = (scene.collectibles ?? []).filter((orb) => orb?.active && !orb.isCollected);
        if (orbs.length > 0 && scene.player) {
          const target = orbs.reduce((nearest, orb) => {
            const distance = (orb.x - scene.player.x) ** 2 + (orb.y - scene.player.y) ** 2;
            const nearestDistance =
              (nearest.x - scene.player.x) ** 2 + (nearest.y - scene.player.y) ** 2;
            return distance < nearestDistance ? orb : nearest;
          });
          scene.input.activePointer.isDown = true;
          scene.input.activePointer.worldX = target.x;
          scene.input.activePointer.worldY = target.y;
        }
        scene.update(frames * step, step);
        frames += 1;
        if (frames % 900 === 0)
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
      }

      game.loop.wake();
      return {
        frames,
        report: scene?.getPerformanceReport?.() ?? null,
        phase: scene?.phase ?? 'missing',
      };
    });
  } else {
    const deadline = Date.now() + 120_000;
    let frames = 0;
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const scene = window.isiHunt?.scene?.getScene('Game');
        if (!scene) return { phase: 'missing' };
        const orbs = (scene.collectibles ?? []).filter((orb) => orb?.active && !orb.isCollected);
        if (orbs.length > 0 && scene.player) {
          const target = orbs.reduce((nearest, orb) => {
            const distance = (orb.x - scene.player.x) ** 2 + (orb.y - scene.player.y) ** 2;
            const nearestDistance =
              (nearest.x - scene.player.x) ** 2 + (nearest.y - scene.player.y) ** 2;
            return distance < nearestDistance ? orb : nearest;
          });
          scene.input.activePointer.isDown = true;
          scene.input.activePointer.worldX = target.x;
          scene.input.activePointer.worldY = target.y;
        }
        return { phase: scene.phase };
      });
      if (state.phase !== 'running') break;
      frames += 6;
      await page.waitForTimeout(100);
    }

    result = await page.evaluate(() => {
      const scene = window.isiHunt?.scene?.getScene('Game');
      return {
        frames: scene?.phase === 'ended' ? 0 : 0,
        report: scene?.getPerformanceReport?.() ?? null,
        phase: scene?.phase ?? 'missing',
      };
    });
    result.frames = frames;
  }

  if (!result.report) throw new Error('Kein Performance-Bericht aus der GameScene erhalten.');
  const resources = await page.evaluate(async () => {
    const memory = window.performance.memory?.usedJSHeapSize;
    let battery = null;
    if (typeof navigator.getBattery === 'function') {
      try {
        const value = await navigator.getBattery();
        battery = { level: value.level, charging: value.charging };
      } catch {
        battery = null;
      }
    }
    return {
      memoryUsedMb: Number.isFinite(memory) ? memory / (1024 * 1024) : null,
      battery,
      heatTelemetryAvailable: false,
    };
  });
  console.log(JSON.stringify({ mode: sim ? 'sim' : 'realtime', ...result, resources }, null, 2));
  if (errors.length > 0) throw new Error(`Browserfehler: ${errors.join(' | ')}`);
  if (!result.report.passed) process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
