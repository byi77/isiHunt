import { readdir, readFile } from 'node:fs/promises';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';

const directory = new URL('./', import.meta.url);
const overlaps = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
let failures = 0;
for (const name of (await readdir(directory)).filter(
  (name) => name.startsWith('menu-') && name.endsWith('.json'),
)) {
  const report = JSON.parse(await readFile(new URL(name, directory), 'utf8'));
  const issues = [];
  const { canvas, texts, buttons } = report;
  for (const item of [...texts, ...buttons]) {
    const r = item.rect;
    if (
      r.left < canvas.left - 0.5 ||
      r.right > canvas.right + 0.5 ||
      r.top < canvas.top - 0.5 ||
      r.bottom > canvas.bottom + 0.5
    )
      issues.push(`Außerhalb Canvas: ${item.text ?? item.label}`);
  }
  for (const button of buttons) {
    if (button.rect.width < 43.5 || button.rect.height < 43.5)
      issues.push(`Touchfläche zu klein: ${button.label}`);
    for (const text of texts) {
      if (text.text !== button.label && overlaps(text.rect, button.rect))
        issues.push(`Text/Button: ${text.text} / ${button.label}`);
    }
  }
  for (const items of [texts, buttons]) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (overlaps(items[i].rect, items[j].rect))
          issues.push(
            `Überlappung: ${items[i].text ?? items[i].label} / ${items[j].text ?? items[j].label}`,
          );
      }
    }
  }
  for (const image of report.images.filter((image) =>
    /^(tex-ship-|tex-player-halo|world-planet-envelope)/.test(image.texture),
  )) {
    for (const item of [...texts, ...buttons]) {
      if (overlaps(image.rect, item.rect))
        issues.push(`Schiff/UI: ${image.texture} / ${item.text ?? item.label}`);
    }
  }
  console.log(`${name}: ${issues.length === 0 ? 'OK' : issues.join('; ')}`);
  failures += issues.length;
}
process.exitCode = failures === 0 ? 0 : 1;
