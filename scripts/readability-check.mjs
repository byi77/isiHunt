// Lesbarkeitspruefung: Heben sich Relikte und Hindernisse von der Kulisse ab?
//
// Warum es das gibt: Mit Phaser 4 kommen Bloom, Licht und Farbstimmung
// (ADR-0035, Phase 3). Je mehr die Kulisse leuchtet, desto leichter
// verschwimmen genau die Dinge, die man fangen oder meiden muss - und kein
// bestehender Test sieht das. Diese Pruefung misst es im echten Bild.
//
// Wie: Je Welt startet ein Run in der echten GameScene. Zu mehreren
// Zeitpunkten wird die Spielflaeche fotografiert. Fuer jedes Relikt und
// Hindernis vergleicht die Pruefung die mittlere Leuchtdichte seines Kerns
// (bis 0,45 Radius) mit einem Ring um es herum (1,9 bis 2,5 Radius, ohne
// Stellen nahe anderer Objekte) als WCAG-Kontrastverhaeltnis. Je Welt zaehlt
// der Median ueber alle Objekte - einzelne Ausreisser (ein Relikt direkt auf
// dem hellen Randplaneten) sollen die Pruefung nicht kippen.
//
// Die Schwelle ist keine Schaetzung: `--update` misst den aktuellen Stand und
// schreibt ihn nach scripts/readability-baseline.json. Danach gilt: Keine
// Welt darf mehr als TOLERANZ unter ihre Basis fallen.
//
//   npm run readability:check              gegen die Basis pruefen
//   npm run readability:check -- --update  Basis neu messen und schreiben

import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const PORT = 5197;
const update = process.argv.includes('--update');
const BASELINE = resolve(root, 'scripts', 'readability-baseline.json');
/** Zeitpunkte nach Rundenstart, zu denen fotografiert wird. */
const SHOTS_MS = [2500, 5000, 7500, 10000, 12500, 15000, 17500, 20000];
/** Fester Takt beim Selbsttakten - wie `playtest --sim`. */
const STEP_MS = 1000 / 60;
/**
 * Erlaubter Abfall gegenueber der Basis. Gemessen am 2026-09-28: Mit
 * gesaetem Spawn und selbst getaktetem Spiel wichen zwei Kontrolllaeufe
 * hoechstens 1,5 Prozent von der Basis ab (vorher, mit Wanduhr und
 * ungesaetem Zufall, bis zu 24 Prozent). 5 Prozent ist gut das Dreifache.
 */
const TOLERANZ = 0.05;

const balance = JSON.parse(readFileSync(resolve(root, 'src/config/balance-data.json'), 'utf8'));
const WORLD_IDS = Object.keys(balance.worlds);

const server = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/vite/bin/vite.js'),
    '--mode',
    'playtest',
    '--port',
    String(PORT),
    '--strictPort',
  ],
  { cwd: root, stdio: 'ignore' },
);
const url = `http://localhost:${PORT}/?skipAuth=1`;
for (const until = Date.now() + 30000; ;) {
  try {
    if ((await fetch(url)).ok) break;
  } catch {
    /* noch nicht da */
  }
  if (Date.now() > until) throw new Error('Dev-Server startete nicht.');
  await new Promise((r) => setTimeout(r, 400));
}

const save = {
  version: 1,
  level: 99,
  playerName: 'Lesbarkeit',
  soundEnabled: false,
  hapticsEnabled: false,
  effectsQuality: 'full',
};

// Sichtbar statt headless: Wer die Pruefung startet, soll zusehen koennen.
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(
  ([k, s]) => window.localStorage.setItem(k, JSON.stringify(s)),
  ['isihunt.save.v1', save],
);

/** Misst im Browser die Kontraste aller Objekte auf einem Bildschirmfoto. */
async function measure(png) {
  return page.evaluate(async (data) => {
    const scene = window.isiHunt.scene.getScene('Game');
    const objects = [...scene.collectibles, ...scene.obstacles]
      .filter((o) => o.active && o.visible && o.alpha > 0.6)
      .map((o) => ({ x: o.x, y: o.y, r: o.radius }));
    const image = new window.Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    const k = image.width / window.isiHunt.scale.width;
    const channel = (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminanceAt = (px, py) => {
      const i = (py * image.width + px) * 4;
      return (
        0.2126 * channel(pixels[i]) +
        0.7152 * channel(pixels[i + 1]) +
        0.0722 * channel(pixels[i + 2])
      );
    };
    const results = [];
    for (const o of objects) {
      let core = 0;
      let coreN = 0;
      let ring = 0;
      let ringN = 0;
      const outer = o.r * 2.5;
      for (let gy = Math.floor(o.y - outer); gy <= o.y + outer; gy += 2) {
        for (let gx = Math.floor(o.x - outer); gx <= o.x + outer; gx += 2) {
          const px = Math.round(gx * k);
          const py = Math.round(gy * k);
          if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
          const d = Math.hypot(gx - o.x, gy - o.y);
          if (d <= o.r * 0.45) {
            core += luminanceAt(px, py);
            coreN++;
          } else if (d >= o.r * 1.9 && d <= outer) {
            const nearOther = objects.some(
              (p) => p !== o && Math.hypot(gx - p.x, gy - p.y) < p.r * 1.3,
            );
            if (nearOther) continue;
            ring += luminanceAt(px, py);
            ringN++;
          }
        }
      }
      if (coreN < 10 || ringN < 20) continue;
      const a = core / coreN;
      const b = ring / ringN;
      results.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
    }
    return results;
  }, png.toString('base64'));
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length === 0 ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const measured = {};
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.isiHunt?.scene?.isActive('Menu'), undefined, {
    timeout: 30000,
  });
  for (const worldId of WORLD_IDS) {
    await page.evaluate((w) => {
      window.isiHunt.loop.wake();
      window.isiHunt.scene.start('Game', { mode: 'solo', worldId: w });
    }, worldId);
    // Gleiche Spawns in jedem Lauf: Solo-Runs sind ungeseedet, und zwei Laeufe
    // mit 8 Aufnahmen streuten trotzdem um bis zu 24 Prozent. Gesaet wird
    // waehrend des Countdowns - Spawns beginnen erst mit `running`.
    await page.waitForFunction(
      () => window.isiHunt.scene.getScene('Game')?.phase === 'countdown',
      undefined,
      { timeout: 30000 },
    );
    await page.evaluate(
      (w) => window.isiHunt.scene.getScene('Game').spawner.rng.sow([`lesbarkeit-${w}`]),
      worldId,
    );
    await page.waitForFunction(
      () => window.isiHunt.scene.getScene('Game')?.phase === 'running',
      undefined,
      { timeout: 30000 },
    );
    // Ab hier taktet das Skript selbst: gleiche Spielzeit bis zu jeder
    // Aufnahme, unabhaengig davon, wie schnell der Rechner gerade ist.
    await page.evaluate(() => window.isiHunt.loop.sleep());
    let playedMs = 0;
    const ratios = [];
    for (const at of SHOTS_MS) {
      const frames = Math.round((at - playedMs) / STEP_MS);
      await page.evaluate(
        ([n, step]) => {
          const game = window.isiHunt;
          for (let i = 0; i < n; i++) {
            game.__lesbarkeitZeit = (game.__lesbarkeitZeit ?? window.performance.now()) + step;
            game.step(game.__lesbarkeitZeit, step);
          }
        },
        [frames, STEP_MS],
      );
      playedMs += frames * STEP_MS;
      const png = await page.locator('canvas').first().screenshot();
      ratios.push(...(await measure(png)));
    }
    await page.evaluate(() => window.isiHunt.loop.wake());
    measured[worldId] = { median: median(ratios), objects: ratios.length };
    console.log(
      `${worldId.padEnd(16)} Median-Kontrast ${measured[worldId].median.toFixed(2)} (${ratios.length} Objekte)`,
    );
  }
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.log(`Seitenfehler: ${errors[0]}`);
  process.exit(1);
}

if (update) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ measuredAt: new Date().toISOString(), worlds: measured }, null, 2)}\n`,
  );
  console.log(`Basis geschrieben: ${BASELINE}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.log('Keine Basis - zuerst mit --update messen.');
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).worlds;
let failed = false;
for (const worldId of WORLD_IDS) {
  const base = baseline[worldId]?.median;
  const now = measured[worldId]?.median ?? 0;
  if (!base) continue;
  const floor = base * (1 - TOLERANZ);
  const ok = now >= floor;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${worldId.padEnd(16)} ${now.toFixed(2)} (Basis ${base.toFixed(2)}, Grenze ${floor.toFixed(2)})`,
  );
}
process.exit(failed ? 1 : 0);
