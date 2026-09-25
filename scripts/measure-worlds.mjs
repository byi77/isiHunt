// Misst den Ertrag je Welt: dieselben Bots, keine Talente, echte GameScene.
//
// Warum es das gibt: Am 2026-09-25 zeigte diese Messung, dass hoehere Welten
// WENIGER XP je Run zahlten als die Startwelt - Horizonttor 66 bis 85 Prozent
// trotz +25 Prozent XP-Bonus (ADR-0034). Die Konfiguration sah nach Belohnung
// aus, die Fangzahl sprach dagegen. Welt-Balancing wird deshalb gemessen, nicht
// aus den Faktoren geschaetzt.
//
// Wie: Wie `playtest --sim` taktet das Skript `GameScene.update()` selbst,
// 90 Sekunden Spielzeit in rund einer Sekunde. Drei Bot-Profile steuern ueber
// den Zeiger:
//   nah     fliegt immer das naechste Relikt an (der Playtest-Bot)
//   wert    waehlt nach Punkten geteilt durch Entfernung
//   mensch  wie `wert`, entscheidet aber nur alle 300 ms neu und bemerkt
//           ein Relikt erst nach 250 ms
// Keiner weicht Hindernissen aus, und alle sehen blinkende Relikte weiter.
// Die Zahlen sind deshalb ein Vergleich zwischen Welten, keine Vorhersage
// fuer echte Spieler.
//
// Gemessen wird gegen eine eingefrorene Kopie des Projekts: Ein Dev-Server
// auf dem Arbeitsverzeichnis laedt bei jeder gespeicherten Datei neu und
// bricht die Messung mitten im Lauf ab.
//
//   npm run balance:worlds                        je 8 Runs, Bots wert+mensch
//   npm run balance:worlds -- --runs=10 --bots=nah,wert,mensch
//   npm run balance:worlds -- --worlds=silberhain,horizonttor
//
// Ergebnis: Tabelle relativ zur ersten gemessenen Welt, Rohdaten in
// .cache/measure-worlds.json. Die Streuung ist gross (Standardfehler 5 bis
// 8 Prozent bei 8 bis 10 Runs); einzelne Ausreisser nicht wegbalancieren.

import { chromium, devices } from 'playwright';
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const PORT = 5198;
const argv = process.argv.slice(2);
const option = (name, fallback) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const RUNS = Number(option('runs', '8'));
const BOTS = option('bots', 'wert,mensch').split(',');
// Die Welt-Reihenfolge steht in balance-data.json wie in worlds.ts; die
// TypeScript-Datei laesst sich ohne Bundler nicht laden.
const balance = JSON.parse(readFileSync(resolve(root, 'src/config/balance-data.json'), 'utf8'));
const WORLD_IDS =
  option('worlds', 'all') === 'all'
    ? Object.keys(balance.worlds)
    : option('worlds', 'all').split(',');

// --- Eingefrorene Kopie ----------------------------------------------------------
const snapshot = resolve(root, '.cache', 'measure-worlds-snapshot');
rmSync(snapshot, { recursive: true, force: true });
mkdirSync(snapshot, { recursive: true });
for (const entry of ['src', 'public'])
  cpSync(resolve(root, entry), resolve(snapshot, entry), { recursive: true });
for (const file of [
  'index.html',
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  '.env.playtest',
]) {
  cpSync(resolve(root, file), resolve(snapshot, file));
}
symlinkSync(resolve(root, 'node_modules'), resolve(snapshot, 'node_modules'), 'junction');

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
  { cwd: snapshot, stdio: 'ignore' },
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

// Level 99, damit jede Welt offen ist; keine Talente, damit nur die Welt wirkt.
const save = {
  version: 1,
  level: 99,
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
  playerName: 'Messung',
  cloudId: null,
};

// Sichtbar statt headless: Wer die Messung startet, soll zusehen koennen.
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(
  ([k, s]) => window.localStorage.setItem(k, JSON.stringify(s)),
  ['isihunt.save.v1', save],
);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.isiHunt?.scene?.isActive('Menu'), undefined, {
  timeout: 30000,
});

const results = [];
try {
  for (const worldId of WORLD_IDS) {
    for (const bot of BOTS) {
      for (let i = 0; i < RUNS; i++) {
        // Der Countdown haengt an Phasers Timern, also an der Wanduhr: Er
        // laeuft mit wachem Loop ab, simuliert wird erst ab `running`.
        let started = false;
        for (let attempt = 0; attempt < 3 && !started; attempt++) {
          await page.evaluate((w) => {
            window.isiHunt.loop.wake();
            window.isiHunt.scene.start('Game', { mode: 'solo', worldId: w });
          }, worldId);
          started = await page
            .waitForFunction(
              () => {
                const s = window.isiHunt.scene.getScene('Game');
                return s && window.isiHunt.scene.isActive('Game') && s.phase === 'running';
              },
              undefined,
              { timeout: 20000 },
            )
            .then(
              () => true,
              () => false,
            );
        }
        if (!started) {
          console.log(`${worldId} ${bot} #${i + 1}: Start fehlgeschlagen`);
          continue;
        }
        const run = await page.evaluate(simulateRun, bot);
        results.push({ worldId, bot, ...run });
        console.log(
          `${worldId} ${bot} #${i + 1}: ${run.error ?? `Score ${run.score}, XP ${run.xp}, Faenge ${run.caught}`}`,
        );
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}

/** Laeuft im Browser. Faengt das Rundenergebnis ab, bevor es gebucht wird. */
async function simulateRun(bot) {
  const game = window.isiHunt;
  const scene = game.scene.getScene('Game');
  let captured = null;
  // Kein Szenenwechsel, keine Buchung: Nur die Zahlen des Runs zaehlen.
  scene.leaveRun = (_key, data) => {
    captured = data ?? null;
  };
  game.loop.sleep();
  const STEP = 1000 / 60;
  const seen = new WeakMap();
  let target = null;
  let frame = 0;
  while (scene.phase !== 'ended' && frame < 60 * 240) {
    if (scene.phase === 'running' && scene.player) {
      const orbs = (scene.collectibles ?? []).filter((c) => c?.active && !c.isCollected);
      for (const orb of orbs) if (!seen.has(orb)) seen.set(orb, frame);
      const retarget =
        bot !== 'mensch' || frame % 18 === 0 || !target?.active || target.isCollected;
      if (retarget) {
        let best = null;
        let bestValue = -Infinity;
        for (const orb of orbs) {
          if (bot === 'mensch' && frame - seen.get(orb) < 15) continue;
          const distance = Math.hypot(orb.x - scene.player.x, orb.y - scene.player.y);
          const value = bot === 'nah' ? -distance : (orb.rarity?.points ?? 1) / (distance + 150);
          if (value > bestValue) {
            bestValue = value;
            best = orb;
          }
        }
        target = best;
      }
      if (target) {
        const pointer = scene.input.activePointer;
        pointer.isDown = true;
        pointer.worldX = target.x;
        pointer.worldY = target.y;
      }
    }
    scene.update(frame * STEP, STEP);
    frame++;
    if (frame % 900 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  game.loop.wake();
  const stats = captured?.stats;
  if (!stats) return { error: `kein Ergebnis (phase=${scene.phase})` };
  return {
    score: stats.score,
    xp: stats.xpGained,
    caught: stats.totalCollected,
    bestCombo: stats.bestCombo,
    collected: stats.collected,
  };
}

mkdirSync(resolve(root, '.cache'), { recursive: true });
writeFileSync(
  resolve(root, '.cache', 'measure-worlds.json'),
  JSON.stringify({ measuredAt: new Date().toISOString(), runs: RUNS, errors, results }, null, 1),
);

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
for (const bot of BOTS) {
  const base = results.filter((r) => r.worldId === WORLD_IDS[0] && r.bot === bot && !r.error);
  if (base.length === 0) continue;
  const baseXp = mean(base.map((r) => r.xp));
  const baseScore = mean(base.map((r) => r.score));
  console.log(`\nBot ${bot} (relativ zu ${WORLD_IDS[0]})`);
  console.log('Welt                n   XP/Run  XP rel   Score/Run  Score rel  Faenge');
  for (const worldId of WORLD_IDS) {
    const rows = results.filter((r) => r.worldId === worldId && r.bot === bot && !r.error);
    if (rows.length === 0) continue;
    const xp = mean(rows.map((r) => r.xp));
    const score = mean(rows.map((r) => r.score));
    console.log(
      `${worldId.padEnd(18)} ${String(rows.length).padStart(2)}  ${String(Math.round(xp)).padStart(7)}  ${((xp / baseXp) * 100).toFixed(0).padStart(4)} %  ${String(Math.round(score)).padStart(9)}  ${((score / baseScore) * 100).toFixed(0).padStart(6)} %  ${Math.round(mean(rows.map((r) => r.caught)))}`,
    );
  }
}
if (errors.length > 0) console.log(`\nSeitenfehler: ${errors.length}`, errors.slice(0, 5));
