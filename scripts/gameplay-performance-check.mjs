import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';

const port = 5210;
const url = `http://localhost:${port}/?skipAuth=1`;
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
let browser;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* Server startet noch. */
    }
    if (i > 100) throw new Error('Vite startet nicht');
    await new Promise((r) => setTimeout(r, 300));
  }
  browser = await chromium.launch({
    args: ['--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])],
  });
  const context = await browser.newContext({
    ...devices['iPhone 16'],
    viewport: devices['iPhone 16'].screen,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    window.localStorage.setItem(
      'isihunt.save.v1',
      JSON.stringify({
        version: 9,
        level: 100,
        effectsQuality: 'full',
        soundEnabled: false,
        hapticsEnabled: false,
      }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.isiHunt?.scene.isActive('Menu'), null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const g = window.isiHunt;
    for (const scene of g.scene.getScenes(true)) g.scene.stop(scene.scene.key);
    g.scene.start('Game', { mode: 'solo', worldId: 'silberhain' });
    // Dieser Check erzwingt die Senkung spaeter gezielt, unabhaengig von CI-GPU-Tempo.
    g.scene.getScene('Game').frameGuard.sample = () => false;
  });
  await page.waitForFunction(() => window.isiHunt.scene.getScene('Game').phase === 'running');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const game = window.isiHunt.scene.getScene('Game'),
      hud = window.isiHunt.scene.getScene('Hud');
    const timer = hud.timerText,
      old = timer.updateText;
    window.__perfCheck = { timerRedraws: 0, maskUpdates: 0, frames: 0 };
    timer.updateText = function (...args) {
      window.__perfCheck.timerRedraws++;
      return old.apply(this, args);
    };
    const mask = game.collectionEffects.clip.filter,
      update = mask.updateDynamicTexture;
    mask.updateDynamicTexture = function (...args) {
      window.__perfCheck.maskUpdates++;
      return update.apply(this, args);
    };
    game.events.on('postupdate', () => window.__perfCheck.frames++);
  });
  await page.waitForTimeout(1500);
  const stable = await page.evaluate(() => window.__perfCheck);
  assert(stable.frames >= 3, 'Echte Frames fehlen');
  assert(stable.timerRedraws <= 3, `Timer rastert ${stable.timerRedraws} Mal statt sekundenweise`);
  assert(stable.maskUpdates <= 2, `Statische Maske aktualisiert ${stable.maskUpdates} Mal`);
  const warnings = await page.evaluate(async () => {
    const hud = window.isiHunt.scene.getScene('Hud'),
      { Palette } = await import('/src/ui/theme.ts');
    hud.onTimer({ remainingMs: 5000, totalMs: 90000 });
    const critical = hud.timerText.style.color === Palette.danger;
    const count = window.__perfCheck.timerRedraws;
    hud.onTimer({ remainingMs: 5000, totalMs: 90000 });
    const repeated = window.__perfCheck.timerRedraws === count;
    hud.onTimer({ remainingMs: 20000, totalMs: 90000 });
    return critical && repeated && hud.timerText.style.color === Palette.ink;
  });
  assert(warnings, 'Timerfarbe/Schlussphase ist falsch');
  await page.evaluate(() => {
    window.__perfCheck.maskUpdates = 0;
    window.isiHunt.scene.getScene('Game').cameras.main.shake(160, 0.004);
  });
  await page.waitForFunction(
    () => !window.isiHunt.scene.getScene('Game').cameras.main.shakeEffect.isRunning,
  );
  const frameAfterShake = await page.evaluate(() => window.__perfCheck.frames);
  await page.waitForFunction((frame) => window.__perfCheck.frames >= frame + 2, frameAfterShake);
  assert(
    await page.evaluate(() => window.__perfCheck.maskUpdates >= 2),
    'Kamerawackler invalidiert Maske nicht',
  );
  await page.evaluate(() => (window.__perfCheck.maskUpdates = 0));
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => window.__perfCheck.maskUpdates),
    0,
    'Maske bleibt nach Shake dynamisch',
  );
  const motion = [];
  for (const reducedMotion of ['reduce', 'no-preference']) {
    await page.emulateMedia({ reducedMotion });
    motion.push(
      await page.evaluate(async () =>
        (await import('/src/systems/AccessibilitySystem.ts')).prefersReducedMotion(),
      ),
    );
  }
  assert.deepEqual(motion, [true, false], 'Gecachte Motion-Abfrage folgt OS-Wechsel nicht');
  const reduction = await page.evaluate(() => {
    const s = window.isiHunt.scene.getScene('Game');
    window.__runBefore = {
      scoring: s.scoring,
      player: s.player,
      objects: s.collectibles,
      backdrop: s.backdrop,
      remaining: s.remainingMs,
    };
    const sample = s.frameGuard.sample;
    s.frameGuard.sample = function () {
      s.frameGuard.sample = sample;
      return true;
    };
    return s.remainingMs;
  });
  await page.waitForTimeout(100);
  const lowered = await page.evaluate(async () => {
    const s = window.isiHunt.scene.getScene('Game'),
      b = window.__runBefore;
    return {
      quality: (await import('/src/systems/EffectsQualitySystem.ts')).current(),
      liveNebula: !!s.backdrop.livingNebula,
      distortion: !!s.backdrop.distortion,
      grading: !!s.grading,
      lighting: !!s.lighting,
      sameRun:
        b.scoring === s.scoring &&
        b.player === s.player &&
        b.objects === s.collectibles &&
        b.backdrop !== s.backdrop,
      remaining: s.remainingMs,
    };
  });
  assert.equal(lowered.quality, 'medium');
  assert(
    !lowered.liveNebula && !lowered.distortion && !lowered.grading && !lowered.lighting,
    'Schwere Effekte bleiben aktiv',
  );
  assert(
    lowered.sameRun && lowered.remaining <= reduction && reduction - lowered.remaining < 500,
    'Effektwechsel startet Run neu',
  );
  const stars = await page.evaluate(() =>
    window.isiHunt.scene
      .getScene('Game')
      .backdrop.stars.map((layer) =>
        layer.list.map((item) => ({ type: item.type, count: item.memberCount })),
      ),
  );
  assert(
    stars.every((layer) => layer.every((item) => item.type === 'SpriteGPULayer')),
    'Sterne bleiben Graphics',
  );
  assert.deepEqual(
    stars.map((layer) => layer.map((item) => item.count)),
    [[95], [48], [18, 4]],
    'Sternzahlen haben sich geaendert',
  );
  await page.evaluate(() => {
    const s = window.isiHunt.scene.getScene('Game');
    const sample = s.frameGuard.sample;
    s.frameGuard.sample = function () {
      s.frameGuard.sample = sample;
      return true;
    };
  });
  await page.waitForTimeout(100);
  const reduced = await page.evaluate(async () => {
    const s = window.isiHunt.scene.getScene('Game');
    return (
      (await import('/src/systems/EffectsQualitySystem.ts')).current() === 'reduced' &&
      s.removeBloom === null &&
      s.player === window.__runBefore.player &&
      s.scoring === window.__runBefore.scoring
    );
  });
  assert(reduced, 'Mittel zu sparsam behaelt Bloom oder startet Run neu');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ stable, warnings, motion, lowered, stars, physicalDevice: false }));
  console.log('Gameplay-Performance-Regressionen bestanden');
} finally {
  await browser?.close();
  server.kill();
}
