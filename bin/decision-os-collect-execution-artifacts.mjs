#!/usr/bin/env node
/**
 * WHAT: Launches project-scoped execution artifact collection from any installation path.
 * WHY: Linux and Termux must use the same guarded cleanup implementation.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loader = resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs');
const entry = resolve(repoRoot, 'backend/src/cli/collect-execution-artifacts.ts');
const child = spawn(process.execPath, ['--import', loader, entry, ...process.argv.slice(2)], {
  env: { ...process.env, TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json') },
  stdio: 'inherit',
});
child.once('error', (error) => { console.error(error); process.exitCode = 1; });
child.once('exit', (code) => { process.exit(code ?? 1); });
