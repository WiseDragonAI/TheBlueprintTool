#!/usr/bin/env node
/**
 * WHAT: Launches the single Decision OS delivery CLI through the repository-pinned TypeScript runtime.
 * WHY: Delivery commands must resolve implementation from the exact release checkout.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  TSX_TSCONFIG_PATH: resolve(root, 'backend/tsconfig.json'),
};
const child = spawn(process.execPath, [
  '--import',
  resolve(root, 'backend/node_modules/tsx/dist/loader.mjs'),
  resolve(root, 'backend/src/cli/decision-os-delivery.ts'),
  ...process.argv.slice(2),
], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});
child.once('error', () => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: 'delivery_cli_spawn_failed', message: 'The delivery CLI child process could not be started.' })}\n`);
  process.exitCode = 3;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 3 : code ?? 3;
});
