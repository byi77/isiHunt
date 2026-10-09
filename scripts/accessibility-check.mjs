import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const port = 5205;
const url = `http://localhost:${port}/?skipAuth=1`;
const output = resolve(process.argv[2] ?? 'playtest-shots/accessibility');
mkdirSync(output, { recursive: true });
let browser;
const server = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    '--mode',
    'playtest',
    '--port',
    String(port),
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* Server startup. */
    }
    if (Date.now() > deadline) throw new Error('Accessibility server did not start');
    await new Promise((done) => setTimeout(done, 300));
  }
  browser = await chromium.launch();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'isihunt.save.v1',
        JSON.stringify({ effectsQuality: 'reduced', soundEnabled: false, talentPoints: 10 }),
      ),
    );
    await page.goto(url);
    await page.waitForFunction(() => window.isiHunt?.scene.isActive('Menu'), undefined, {
      timeout: 60000,
    });
    await page.waitForTimeout(1000);
    const options = page.getByRole('button', { name: 'Optionen', exact: true });
    await options.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.isiHunt.scene.isActive('Settings'));
    const sizes = await page.locator('.isihunt-settings').evaluate((root) => ({
      fonts: [...root.querySelectorAll('p')].map((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
      buttons: [...root.querySelectorAll('button')].map(
        (element) => element.getBoundingClientRect().height,
      ),
      overflow: root.scrollWidth > root.clientWidth,
    }));
    assert(
      sizes.fonts.every((size) => size >= 12),
      'Settings font below 12 CSS px',
    );
    assert(
      sizes.buttons.every((size) => size >= 44),
      'Settings target below 44 CSS px',
    );
    assert(!sizes.overflow, 'Settings overflow horizontally');
    await page.screenshot({ path: resolve(output, `settings-${viewport.width}.png`) });
    const settingsDesign = await page.locator('.isihunt-settings').evaluate((root) => {
      const button = getComputedStyle(root.querySelector('button'));
      const card = getComputedStyle(root.querySelector('section'));
      const heading = getComputedStyle(root.querySelector('h2'));
      return {
        font: button.fontFamily,
        background: button.backgroundColor,
        radius: button.borderRadius,
        border: button.borderTopColor,
        card: card.backgroundColor,
        cardRadius: card.borderRadius,
        heading: heading.color,
      };
    });

    const sound = page.getByRole('button', { name: 'TON: AUS', exact: true });
    await sound.focus();
    await page.keyboard.press('Space');
    assert(
      (await page.getByRole('button', { name: 'TON: AN', exact: true }).count()) === 1,
      'Space did not toggle sound',
    );
    await page.getByRole('button', { name: 'ZURÜCK', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.isiHunt.scene.isActive('Menu'));
    assert(
      (await page.locator('.isihunt-settings').count()) === 0,
      'Settings DOM leaked after exit',
    );
    await page.getByRole('button', { name: 'Shop', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.isiHunt.scene.isActive('Shop'));
    const hangarDesign = await page.locator('.isihunt-hangar').evaluate((root) => {
      const button = getComputedStyle(root.querySelector('footer button:last-child'));
      const card = getComputedStyle(root.querySelector('.hangar-content'));
      const heading = getComputedStyle(root.querySelector('h1'));
      return {
        font: button.fontFamily,
        background: button.backgroundColor,
        radius: button.borderRadius,
        border: button.borderTopColor,
        card: card.backgroundColor,
        cardRadius: card.borderRadius,
        heading: heading.color,
      };
    });
    assert(
      JSON.stringify(settingsDesign) === JSON.stringify(hangarDesign),
      'Hangar and Settings do not share typography, surfaces and controls',
    );
    await page.screenshot({ path: resolve(output, `hangar-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Zum Menü', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.isiHunt.scene.isActive('Menu'));
    assert((await page.locator('.isihunt-hangar').count()) === 0, 'Hangar DOM leaked after exit');
    await page.evaluate(async () => {
      const save = await import('/src/systems/SaveSystem.ts');
      save.update((data) => {
        data.talentPoints = 5;
      });
    });
    await page.getByRole('button', { name: 'Talente', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.isiHunt.scene.isActive('Talents'));
    await page.waitForTimeout(500);
    const talent = await page.evaluate(() => {
      const scene = window.isiHunt.scene.getScene('Talents');
      const canvas = window.isiHunt.canvas.getBoundingClientRect();
      const texts = scene.children.list
        .flatMap((object) => object.list ?? [object])
        .filter((object) => object.type === 'Text' && object.text);
      const cards = texts.filter(
        (text) => text.text.startsWith('Deine Figur') || text.text.startsWith('Verlängert'),
      );
      return {
        fonts: cards.map((text) => (parseFloat(text.style.fontSize) * canvas.width) / 720),
        offset: scene.scrollOffset,
      };
    });
    assert(
      talent.fonts.length > 0 && talent.fonts.every((size) => size >= 11.9),
      'Talent descriptions too small',
    );
    await page.screenshot({ path: resolve(output, `talents-${viewport.width}.png`) });
    const purchase = page.getByRole('button', { name: '1 PUNKT', exact: true }).first();
    await purchase.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(async () => {
      const save = await import('/src/systems/SaveSystem.ts');
      return save.load().talents.swiftness === 1 && save.load().talentPoints === 4;
    });
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const { createButton } = await import('/src/ui/widgets.ts');
      const scene = window.isiHunt.scene.getScene('Talents');
      window.__cameraTestButton = createButton(scene, 360, 650, 'Camera focus check', () => {}, {
        width: 240,
        height: 100,
      });
    });
    await page.waitForTimeout(300);
    const cameraButton = page.getByRole('button', { name: 'Camera focus check', exact: true });
    const beforeCamera = await cameraButton.boundingBox();
    const cssScale = await page.evaluate(
      () => window.isiHunt.canvas.getBoundingClientRect().height / window.isiHunt.scale.height,
    );
    await page.evaluate(() =>
      window.isiHunt.scene.getScene('Talents').cameras.main.setScroll(0, 40),
    );
    await page.waitForTimeout(300);
    const afterCamera = await cameraButton.boundingBox();
    assert(
      beforeCamera && afterCamera && Math.abs(beforeCamera.y - afterCamera.y - 40 * cssScale) < 1,
      'Focus target did not follow camera scrolling',
    );
    await page.evaluate(() => {
      window.isiHunt.scene.getScene('Talents').cameras.main.setScroll(0, 0);
      window.__cameraTestButton.container.destroy();
    });

    await page.keyboard.press('PageDown');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.isiHunt.scene.getScene('Talents').scrollOffset);
    assert(after > talent.offset, 'PageDown did not scroll talent list');
    assert(errors.length === 0, errors.join(' | '));
    console.log(
      `Accessibility ${viewport.width}x${viewport.height}: fonts, targets, Enter/Space, scrolling, cleanup OK`,
    );
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
