#!/usr/bin/env node
/**
 * WHAT: Launches the fixed dev-to-main merge command through the pinned TypeScript runtime.
 * WHY: Agent promotions must execute implementation from the checked-out Decision OS release.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [
  '--import',
  resolve(root, 'backend/node_modules/tsx/dist/loader.mjs'),
  resolve(root, 'backend/src/cli/decision-os-merge-dev.ts'),
  ...process.argv.slice(2),
], {
  cwd: process.cwd(),
  env: { ...process.env, TSX_TSCONFIG_PATH: resolve(root, 'backend/tsconfig.json') },
  stdio: 'inherit',
});

// WHAT: Convert launcher failure into one stable nonzero exit.
// WHY: Agents need a deterministic failure signal when the pinned runtime cannot start.
child.once('error', () => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: 'merge_dev_spawn_failed', message: 'The merge CLI child process could not be started.' })}\n`);
  process.exitCode = 3;
});

// WHAT: Preserve the implementation process exit status.
// WHY: Automation must distinguish rejected admission from successful promotion.
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 3 : code ?? 3;
});
