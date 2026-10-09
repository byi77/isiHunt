// Real rendering coverage. Frame budgets are reported separately from execution validity.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const port = 5204;
const url = `http://localhost:${port}/?skipAuth=1`;
const enforce = process.argv.includes('--enforce');
const sampleMs = Number(
  process.argv.find((arg) => arg.startsWith('--sample-ms='))?.slice(12) ?? 3000,
);
if (!Number.isSafeInteger(sampleMs) || sampleMs <= 0) throw new Error('Ungueltige Messdauer');
let browser;
const server = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    '--mode',
    'performance',
    '--port',
    String(port),
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
const rows = [];
try {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* Waiting for our server. */
    }
    if (Date.now() > deadline) throw new Error('Render-Matrix-Server startete nicht.');
    await new Promise((done) => setTimeout(done, 300));
  }
  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      ...(process.argv.includes('--gpu')
        ? ['--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])]
        : []),
    ],
  });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.isiHunt?.scene.isActive('Menu'), undefined, {
    timeout: 60000,
  });
  const inventory = await page.evaluate(async () => {
    const { WORLDS } = await import('/src/config/worlds.ts');
    const { SHIP_SHAPES } = await import('/src/config/shop.ts');
    const { threeDAssetForId } = await import('/src/ui/egoAssets.ts');
    const shape3d = SHIP_SHAPES.find((shape) => threeDAssetForId(shape.threeDAssetId));
    if (!shape3d) throw new Error('Keine verifizierte 3D-Form gefunden.');
    return { worlds: WORLDS.map((world) => world.id), shapes: ['arrow', shape3d.id] };
  });
  for (const worldId of inventory.worlds)
    for (const quality of ['full', 'medium', 'reduced'])
      for (const shape of inventory.shapes) {
        const before = errors.length;
        await page.evaluate(
          async ({ worldId, quality, shape }) => {
            const save = await import('/src/systems/SaveSystem.ts');
            const effects = await import('/src/systems/EffectsQualitySystem.ts');
            save.update((data) => {
              data.level = 100;
              data.lastWorldId = worldId;
              data.shipShape = shape;
              data.ownedShipShapes = [...new Set([...data.ownedShipShapes, shape])];
            });
            effects.setQuality(quality);
            const game = window.isiHunt;
            for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
            game.scene.start(shape === 'arrow' ? 'Game' : 'Shop', { mode: 'solo', worldId });
          },
          { worldId, quality, shape },
        );
        const sceneKey = shape === 'arrow' ? 'Game' : 'Shop';
        await page.waitForFunction((key) => window.isiHunt.scene.isActive(key), sceneKey, {
          timeout: 60000,
        });
        if (sceneKey === 'Shop') {
          await page.waitForFunction(
            () => !!window.isiHunt.scene.getScene('Shop').hangar?.preview?.model,
            undefined,
            { timeout: 60000 },
          );
        } else {
          // This focused rendering test skips the UI countdown, never the render loop.
          await page.evaluate(() => {
            const scene = window.isiHunt.scene.getScene('Game');
            scene.time.removeAllEvents();
            scene.startRun();
          });
        }
        await page.waitForTimeout(1000);
        await page.evaluate(async (key) => {
          const scene = window.isiHunt.scene.getScene(key);
          const { PerformanceMonitor, PERFORMANCE_BUDGETS } =
            await import('/src/systems/PerformanceSystem.ts');
          window.__matrixBudgets = PERFORMANCE_BUDGETS;
          const monitor = new PerformanceMonitor();
          monitor.markSetupDone();
          monitor.markRunStarted();
          window.__matrixMonitor = monitor;
          const record = () => {
            const game = window.isiHunt;
            if (document.visibilityState === 'visible' && game.loop.inFocus)
              monitor.recordFrame(
                game.loop.rawDelta,
                key === 'Game' ? scene.collectibles.length + scene.obstacles.length : 0,
                scene.children.list.filter((child) => child.type === 'ParticleEmitter').length,
              );
          };
          scene.events.on('postupdate', record);
          scene.events.once('shutdown', () => scene.events.off('postupdate', record));
        }, sceneKey);
        await page.waitForTimeout(sampleMs);
        const row = await page.evaluate(
          ({ worldId, quality, shape, sceneKey }) => {
            const game = window.isiHunt;
            const gl = game.renderer.gl;
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            const active = game.scene.getScenes(true).map((scene) => scene.scene.key);
            if (active.includes('Menu') || !active.includes(sceneKey))
              throw new Error(`Falsche aktive Szenen: ${active.join(', ')}`);
            const measurement = window.__matrixMonitor.getReport();
            const report = { ...measurement };
            delete report.startupMs;
            report.passed =
              report.frameCount > 0 &&
              report.frameP95Ms <= window.__matrixBudgets.frameP95Ms &&
              report.frameOverBudgetRatio <= window.__matrixBudgets.frameOverBudgetRatio &&
              report.peakDynamicObjects <= window.__matrixBudgets.dynamicObjects &&
              report.peakParticleGroups <= window.__matrixBudgets.particleGroups;
            return {
              worldId,
              quality,
              shape,
              sceneKey,
              active,
              gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
              report,
              startupMeasured: false,
            };
          },
          { worldId, quality, shape, sceneKey },
        );
        row.browserErrors = errors.slice(before);
        if (!row.report?.frameCount || row.browserErrors.length)
          throw new Error(`Ungueltige Messung: ${JSON.stringify(row)}`);
        rows.push(row);
        console.log(
          `${rows.length}/${inventory.worlds.length * 3 * inventory.shapes.length} ${worldId} ${quality} ${shape}: p95=${row.report.frameP95Ms.toFixed(1)} ms, budget=${row.report.passed ? 'ok' : 'ueberschritten'}`,
        );
      }
  const report = {
    mode: 'realtime-render-matrix',
    emulatedDevice: 'iPhone 13',
    physicalDevice: false,
    sampleMs,
    rows,
    budgetPassed: rows.every((row) => row.report.passed),
  };
  writeFileSync(
    resolve(
      process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
        'render-matrix-report.json',
    ),
    JSON.stringify(report, null, 2),
  );
  if (enforce && !report.budgetPassed) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
