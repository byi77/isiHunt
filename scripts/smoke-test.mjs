// Startet einen echten Chromium (Playwright) gegen einen laufenden Dev-Server,
// simuliert einen mobilen Viewport und prueft, ob die Seite ohne Konsolenfehler
// laedt. Ersetzt keinen Handytest (ARCHITECTURE.md 10) - schliesst nur die
// Luecke "nichts automatisiert sieht die Seite je in einem echten Browser".
import { chromium, devices } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173/';
const outPath = process.argv[3] ?? 'smoke-screenshot.png';

const browser = await chromium.launch();
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
await browser.close();

if (errors.length > 0) {
  console.error('Konsolenfehler gefunden:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log(`OK - keine Konsolenfehler. Screenshot: ${outPath}`);
