import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

// Node webstorage shadows jsdom Storage; tests must use the browser environment.
const flags = process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : [];
const root = realpathSync('.');
const args = process.argv.slice(2);
if (args.includes('run') && !args.some((arg) => arg.startsWith('--maxWorkers')))
  args.push('--maxWorkers=4');
const result = spawnSync(
  process.execPath,
  [...flags, resolve(root, 'node_modules/vitest/vitest.mjs'), ...args],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} ${flags.join(' ')}`.trim(),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
