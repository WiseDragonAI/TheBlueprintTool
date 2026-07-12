#!/usr/bin/env node
/**
 * WHAT: Repository launcher for the ledger-cli TypeScript executable.
 * WHY: local operators need a working ledger editor command without committed build output.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loaderCandidates = [
  resolve(repoRoot, 'ledger-cli/node_modules/tsx/dist/loader.mjs'),
  resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs'),
  resolve(repoRoot, 'frontend/node_modules/tsx/dist/loader.mjs'),
];
const loader = loaderCandidates.find(existsSync);
const entrypoint = resolve(repoRoot, 'ledger-cli/bin/ledger-cli.ts');
if (!loader) {
  console.error('ledger-cli requires tsx dependencies. Run npm install in ledger-cli/.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--import', loader, entrypoint, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});

if (typeof result.status === 'number') {
  process.exitCode = result.status;
} else if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
}
