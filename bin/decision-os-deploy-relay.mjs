#!/usr/bin/env node
/**
 * WHAT: Launches tag-owned production relay deployment through the pinned TypeScript runtime.
 * WHY: Relay deployment must execute repository-owned code from the canonical primary main checkout.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [
  '--import',
  resolve(root, 'backend/node_modules/tsx/dist/loader.mjs'),
  resolve(root, 'backend/src/cli/decision-os-deploy-relay.ts'),
  ...process.argv.slice(2),
], {
  cwd: process.cwd(),
  env: { ...process.env, TSX_TSCONFIG_PATH: resolve(root, 'backend/tsconfig.json') },
  stdio: 'inherit',
});

child.once('error', () => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: 'deploy_relay_spawn_failed', message: 'The relay deployment CLI child process could not be started.' })}\n`);
  process.exitCode = 3;
});

child.once('exit', (code, signal) => {
  process.exitCode = signal ? 3 : code ?? 3;
});
