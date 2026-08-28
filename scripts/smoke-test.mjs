// Startet einen echten Chromium (Playwright) gegen einen laufenden Dev-Server,
// simuliert einen mobilen Viewport und prueft, ob die Seite ohne Konsolenfehler
// laedt. Ersetzt keinen Handytest (ARCHITECTURE.md 10) - schliesst nur die
// Luecke "nichts automatisiert sieht die Seite je in einem echten Browser".
import { chromium, devices } from 'playwright';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const suppliedUrl = process.argv[2];
const url = suppliedUrl ?? 'http://127.0.0.1:5173/';
const outPath = process.argv[3] ?? 'smoke-screenshot.png';

let server = null;
let browser = null;

async function waitForServer(targetUrl, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return;
    } catch {
      // Dev-Server startet noch.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('Dev-Server startete nicht.');
}

try {
  if (!suppliedUrl) {
    server = spawn(
      process.execPath,
      [resolve('node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173'],
      { stdio: 'ignore' },
    );
    await waitForServer(url);
  }

  browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outPath });

  if (errors.length > 0) {
    console.error('Konsolenfehler gefunden:');
    for (const e of errors) console.error(' -', e);
    process.exitCode = 1;
  } else {
    console.log(`OK - keine Konsolenfehler. Screenshot: ${outPath}`);
  }
} finally {
  await browser?.close();
  server?.kill();
}
