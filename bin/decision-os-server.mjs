#!/usr/bin/env node
/**
 * WHAT: Starts the decision-os backend from any workspace cwd.
 * WHY: Operators should not have to remember tsx loader, tsconfig, or frontend-root wiring.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const loader = resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs');
  const server = resolve(repoRoot, 'backend/src/server.ts');
  const serverEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => (
    !key.startsWith('DECISION_OS_') || key === 'DECISION_OS_FRONTEND_ROOT'
  )));
  const env = {
    ...serverEnvironment,
    DECISION_OS_FRONTEND_ROOT: process.env.DECISION_OS_FRONTEND_ROOT ?? resolve(repoRoot, 'frontend'),
    TSX_TSCONFIG_PATH: process.env.TSX_TSCONFIG_PATH ?? resolve(repoRoot, 'backend/tsconfig.json')
  };
  if (process.argv.includes('--print-command')) {
    console.log(JSON.stringify({
      node: process.execPath,
      args: ['--import', loader, server],
      env: { DECISION_OS_FRONTEND_ROOT: env.DECISION_OS_FRONTEND_ROOT, TSX_TSCONFIG_PATH: env.TSX_TSCONFIG_PATH },
      scopedDecisionOsKeys: Object.keys(env).filter((key) => key.startsWith('DECISION_OS_') && key !== 'DECISION_OS_FRONTEND_ROOT'),
      cwd: process.cwd()
    }));
    return;
  }
  const child = spawn(process.execPath, ['--import', loader, server, ...process.argv.slice(2)], { env, stdio: 'inherit' });
  let forwardedSignal = null;
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.once(signal, () => {
      forwardedSignal = signal;
      if (!child.killed) child.kill(signal);
    });
  }
  child.once('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (forwardedSignal || signal) process.exit(0);
    process.exit(code ?? 1);
  });
}

main();
