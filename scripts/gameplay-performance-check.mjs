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
        effectsDefaultRevision: 1,
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
    // Countdown ohne Shaderkosten; die folgenden Pruefschritte rendern wirklich.
    g.loop.sleep();
    g.loop.rawDelta = 1000 / 60;
    window.__checkTime = window.performance.now();
    for (let i = 0; i < 300 && g.scene.getScene('Game').phase !== 'running'; i++) {
      window.__checkTime += 1000 / 60;
      g.headlessStep(window.__checkTime, 1000 / 60);
    }
  });
  assert(await page.evaluate(() => window.isiHunt.scene.getScene('Game').phase === 'running'));
  const renderFrames = async (frames) => {
    await page.evaluate((count) => {
      const g = window.isiHunt;
      for (let i = 0; i < count; i++) {
        window.__checkTime += 1000 / 60;
        g.step(window.__checkTime, 1000 / 60);
      }
    }, frames);
  };
  await renderFrames(2);
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
  await renderFrames(8);
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
  await renderFrames(14);
  assert(
    await page.evaluate(
      () => !window.isiHunt.scene.getScene('Game').cameras.main.shakeEffect.isRunning,
    ),
    'Kamerawackler endet nicht',
  );
  assert(
    await page.evaluate(() => window.__perfCheck.maskUpdates >= 2),
    'Kamerawackler invalidiert Maske nicht',
  );
  await page.evaluate(() => (window.__perfCheck.maskUpdates = 0));
  await renderFrames(3);
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
  await renderFrames(1);
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
    !lowered.liveNebula && !lowered.distortion && !lowered.lighting,
    'Schwere Effekte bleiben aktiv',
  );
  // Die Farbstimmung gehoert seit ADR-0040 zur mittleren Stufe: Beim Herabstufen
  // von voll auf mittel wird sie neu aufgebaut, nicht entfernt.
  assert(lowered.grading, 'Farbstimmung fehlt nach dem Herabstufen auf mittel');
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
  await renderFrames(1);
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
