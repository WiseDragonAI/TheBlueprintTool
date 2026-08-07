#!/usr/bin/env node
/**
 * WHAT: Launches the fixed production-state backup CLI through the repository-pinned TypeScript runtime.
 * WHY: Backup and verification must execute reviewed code without exposing reset, deployment, or cleanup operations.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [
  '--import',
  resolve(root, 'backend/node_modules/tsx/dist/loader.mjs'),
  resolve(root, 'backend/src/cli/decision-os-production-state-backup.ts'),
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
  process.stdout.write(`${JSON.stringify({ ok: false, error: 'production_state_backup_cli_spawn_failed' })}\n`);
  process.exitCode = 3;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 3 : code ?? 3;
});
