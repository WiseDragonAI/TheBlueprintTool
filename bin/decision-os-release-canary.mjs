#!/usr/bin/env node
/**
 * WHAT: Launches the fixed release-canary CLI through the repository-pinned TypeScript runtime.
 * WHY: Canary evidence must execute implementation from the exact candidate or published release checkout.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [
  '--import',
  resolve(root, 'backend/node_modules/tsx/dist/loader.mjs'),
  resolve(root, 'backend/src/cli/decision-os-release-canary.ts'),
  ...process.argv.slice(2),
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    TSX_TSCONFIG_PATH: resolve(root, 'backend/tsconfig.json'),
  },
  stdio: 'inherit',
});

child.once('error', () => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: 'release_canary_cli_spawn_failed', message: 'The release-canary CLI child process could not be started.' })}\n`);
  process.exitCode = 3;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 3 : code ?? 3;
});
