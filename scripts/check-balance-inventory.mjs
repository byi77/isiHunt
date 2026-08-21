/**
 * Schützt die zentrale Balance-Kette vor neuen Inline-Gutschriften.
 *
 * Rohwerte dürfen in den ausdrücklich dafür vorgesehenen Config-Dateien und
 * Test-Fixtures vorkommen. Scenes, Entities und produktive Systems dürfen
 * Coins/XP/Punkte dagegen nur über die Balance- oder Fachsysteme verrechnen.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const roots = ['scenes', 'entities', 'systems'];
const files = [];

function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      collect(path);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      files.push(path);
    }
  }
}

for (const directory of roots) collect(join(root, directory));

const violations = [];
const checks = [
  {
    label: 'direkte Coin-Gutschrift',
    pattern: /\b(?:data\.)?coins\s*\+=\s*\d[\d_]*/g,
  },
  {
    label: 'direkter Coin-Abzug',
    pattern: /\b(?:data\.)?coins\s*-=\s*\d[\d_]*/g,
  },
  {
    label: 'harte XP-/Coin-/Punkte-Ausgabe',
    pattern:
      /(?:^|[,{]\s*)(?:coinsGained|xpGained|awardedPoints|dailyRewardCoins|dailyRewardXp)\s*:\s*\d[\d_]*/gm,
  },
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const check of checks) {
    for (const match of source.matchAll(check.pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(`${relative(process.cwd(), file)}:${line} ${check.label}: ${match[0]}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Balance-Inventur fehlgeschlagen:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Balance-Inventur OK: ${files.length} produktive Dateien ohne Inline-Gutschriften.`);
