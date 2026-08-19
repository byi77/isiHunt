import { chromium, devices } from 'playwright';
const SAVE_KEY = 'isihunt.save.v1';
const mk = (lvl) => ({
  version: 1,
  level: lvl,
  xp: 0,
  talentPoints: 0,
  coins: 3000,
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
  playerName: 'X',
  cloudId: null,
});
const b = await chromium.launch();
const res = [];
for (let i = 0; i < 4; i++) {
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([k, s]) => {
      if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(s));
    },
    [SAVE_KEY, mk(1)],
  );
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.isiHunt?.scene?.isActive('Menu'), null, {
    timeout: 25000,
  });
  await page.evaluate(() =>
    window.isiHunt.scene.start('Game', { mode: 'solo', worldId: 'silberhain' }),
  );
  await page.waitForFunction(
    () => window.isiHunt?.scene?.getScene('Game')?.phase === 'running',
    null,
    { timeout: 25000 },
  );
  const r = await page.evaluate(async () => {
    const g = window.isiHunt,
      sc = g.scene.getScene('Game');
    g.loop.sleep();
    const STEP = 1000 / 60;
    let f = 0;
    while (sc.phase === 'running' && f < 60 * 240) {
      const orbs = (sc.collectibles ?? []).filter((c) => c?.active && !c.isCollected);
      if (orbs.length > 0 && sc.player) {
        let z = orbs[0],
          bd = Infinity;
        for (const o of orbs) {
          const d = (o.x - sc.player.x) ** 2 + (o.y - sc.player.y) ** 2;
          if (d < bd) {
            bd = d;
            z = o;
          }
        }
        const p = sc.input.activePointer;
        p.isDown = true;
        p.worldX = z.x;
        p.worldY = z.y;
      }
      sc.update(f * STEP, STEP);
      f++;
      if (f % 900 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const st = sc.scoring.toRunStats('silberhain');
    return { score: st.score, xp: st.xpGained, faenge: st.totalCollected, bestCombo: st.bestCombo };
  });
  res.push(r);
  await ctx.close();
}
await b.close();
console.log('Lauf | Score | XP   | Faenge | beste Serie');
for (const [i, r] of res.entries())
  console.log(
    `  ${i + 1}  | ${String(r.score).padStart(5)} | ${String(r.xp).padStart(4)} | ${String(r.faenge).padStart(6)} | ${r.bestCombo}`,
  );
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
const mXp = avg(res.map((r) => r.xp));
console.log(
  '\nMittel: Score ' +
    avg(res.map((r) => r.score)) +
    ', XP ' +
    mXp +
    ', Faenge ' +
    avg(res.map((r) => r.faenge)),
);
console.log('\n=== Runs pro Level mit XP=' + mXp + ' ===');
const xpFor = (l) => (l >= 100 ? 0 : Math.floor(750 * Math.sqrt(l) + 8 * Math.pow(l, 1.25)));
for (const l of [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 99])
  console.log(
    'Lv ' +
      String(l).padEnd(3) +
      ' braucht ' +
      String(xpFor(l)).padStart(5) +
      ' XP = ' +
      (xpFor(l) / mXp).toFixed(1) +
      ' Runs',
  );
let tot = 0;
for (let l = 1; l < 100; l++) tot += xpFor(l);
console.log(
  '\nGesamt bis Lv100: ' +
    tot.toLocaleString() +
    ' XP = ' +
    Math.round(tot / mXp) +
    ' Runs = ' +
    (((tot / mXp) * 90) / 3600).toFixed(0) +
    ' h',
);
