// Production-Gate fuer den gebauten dist/-Stand.
//
// Der Dev-Build stellt `window.isiHunt` fuer Playtests bereit; die Production
// darf dieses Diagnosefenster bewusst nicht exportieren. Dieser Check prueft
// deshalb den echten Preview-Build ueber die sichtbare Auslieferung: HTML,
// Manifest, Versionsmanifest, Canvas, feste Viewports, Screenshot-Artefakte
// und Browserfehler.

import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/`;
const outputDir = resolve(process.argv[2] ?? 'playtest-shots/production');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const expectedVersion = `v${packageJson.version}`;

mkdirSync(outputDir, { recursive: true });

async function waitForServer(url, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview startet noch.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('Vite-Preview startete nicht.');
}

const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(PORT),
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
const browser = await chromium.launch();
const results = [];

try {
  await waitForServer(URL);

  const versionResponse = await fetch(`${URL}version.json`);
  if (!versionResponse.ok) throw new Error(`version.json antwortet mit ${versionResponse.status}`);
  const versionManifest = await versionResponse.json();
  if (versionManifest.version !== packageJson.version) {
    throw new Error(
      `Versionsmanifest ${versionManifest.version} entspricht nicht package.json ${packageJson.version}`,
    );
  }

  const manifestResponse = await fetch(`${URL}manifest.webmanifest`);
  if (!manifestResponse.ok)
    throw new Error(`manifest.webmanifest antwortet mit ${manifestResponse.status}`);

  const viewports = [
    ['iphone13', { ...devices['iPhone 13'] }],
    ['desktop', { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }],
  ];

  for (const [name, contextOptions] of viewports) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    const response = await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(1_000);

    const title = await page.title();
    const version = await page.locator('#version').textContent();
    const canvasCount = await page.locator('canvas').count();
    const canvasBox = canvasCount > 0 ? await page.locator('canvas').boundingBox() : null;
    const screenshot = resolve(outputDir, `production-${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });

    const result = {
      viewport: name,
      httpStatus: response?.status() ?? 0,
      title,
      version,
      canvasCount,
      canvasBox,
      screenshot,
      errors,
    };
    results.push(result);

    if (
      result.httpStatus !== 200 ||
      result.title !== 'isiHunt' ||
      result.version !== expectedVersion ||
      result.canvasCount !== 1 ||
      !result.canvasBox ||
      result.canvasBox.width <= 0 ||
      result.canvasBox.height <= 0 ||
      errors.length > 0
    ) {
      throw new Error(`Production-Viewport ${name} fehlgeschlagen: ${JSON.stringify(result)}`);
    }

    await context.close();
  }

  const summaryPath = resolve(outputDir, 'production-check.json');
  writeFileSync(
    summaryPath,
    JSON.stringify({ packageVersion: packageJson.version, versionManifest, results }, null, 2) +
      '\n',
  );
  console.log(`Production-Gate OK: ${results.length} Viewports, Screenshots in ${outputDir}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
