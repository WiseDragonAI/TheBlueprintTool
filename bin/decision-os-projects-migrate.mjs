#!/usr/bin/env node
/**
 * WHAT: Launches the TypeScript project-registry migration from any installation path.
 * WHY: The migration command must share the server's loader and path resolution contract.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loader = resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs');
const entry = resolve(repoRoot, 'backend/src/project-registry-migrate.ts');
const child = spawn(process.execPath, ['--import', loader, entry, ...process.argv.slice(2)], {
  env: { ...process.env, TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json') },
  stdio: 'inherit',
});
child.once('error', (error) => { console.error(error); process.exitCode = 1; });
child.once('exit', (code) => { process.exit(code ?? 1); });
