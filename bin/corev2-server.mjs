#!/usr/bin/env node
/**
 * WHAT: Starts the CoreV2 backend from any workspace cwd.
 * WHY: Operators should not have to remember tsx loader, tsconfig, or frontend-root wiring.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const loader = resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs');
  const server = resolve(repoRoot, 'backend/src/server.ts');
  const env = {
    ...process.env,
    COREV2_FRONTEND_ROOT: process.env.COREV2_FRONTEND_ROOT ?? resolve(repoRoot, 'frontend'),
    TSX_TSCONFIG_PATH: process.env.TSX_TSCONFIG_PATH ?? resolve(repoRoot, 'backend/tsconfig.json')
  };
  if (process.argv.includes('--print-command')) {
    console.log(JSON.stringify({ node: process.execPath, args: ['--import', loader, server], env: { COREV2_FRONTEND_ROOT: env.COREV2_FRONTEND_ROOT, TSX_TSCONFIG_PATH: env.TSX_TSCONFIG_PATH }, cwd: process.cwd() }));
    return;
  }
  const child = spawn(process.execPath, ['--import', loader, server, ...process.argv.slice(2)], { env, stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
