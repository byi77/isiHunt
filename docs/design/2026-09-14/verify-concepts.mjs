// Prüft gemessene Browser-Geometrie; ersetzt weder neue Aufnahmen noch Touchtests.
import { readFileSync, writeFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';

const root = new URL('./', import.meta.url);
const overlap = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
const contains = (outer, inner) =>
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5;

const reports = [];
for (const [view, width, height] of [
  ['menu', 320, 568],
  ['menu', 390, 844],
  ['game', 320, 568],
  ['game', 390, 844],
]) {
  const name = `concept-${view}-${width}x${height}`;
  const { texts, buttons } = JSON.parse(
    readFileSync(new URL(`${name}.geometry.json`, root), 'utf8'),
  );
  const issues = [];
  const viewport = { left: 0, right: width, top: 0, bottom: height };
  for (const text of texts) {
    if (!contains(viewport, text.rect)) issues.push(`Text außerhalb des Viewports: ${text.text}`);
  }
  for (let i = 0; i < texts.length; i++) {
    for (const other of texts.slice(i + 1)) {
      if (overlap(texts[i].rect, other.rect))
        issues.push(`Textüberlappung: ${texts[i].text} / ${other.text}`);
    }
  }
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    if (!contains(viewport, button.rect))
      issues.push(`Button außerhalb des Viewports: ${button.id}`);
    if (!contains(button.rect, button.label))
      issues.push(`Beschriftung außerhalb des Buttons: ${button.id}`);
    if (Math.min(button.rect.width, button.rect.height) < 43.5)
      issues.push(`Button kleiner als 44 px: ${button.id}`);
    for (const other of buttons.slice(i + 1)) {
      if (overlap(button.rect, other.rect))
        issues.push(`Buttonüberlappung: ${button.id} / ${other.id}`);
    }
  }
  reports.push({ name, measuredTexts: texts.length, measuredButtons: buttons.length, issues });
}
writeFileSync(new URL('concept-checks.json', root), JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
if (reports.some((report) => report.issues.length > 0)) process.exitCode = 1;
