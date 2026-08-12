#!/usr/bin/env node
/**
 * WHAT: Fast-forwards a clean decision-os main checkout, restarts its supervised
 * service, and waits for the operator-facing route to become healthy.
 * WHY: Updating the running Termux instance should be one safe, repeatable command.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const service = process.env.DECISION_OS_SERVICE ?? 'decision-os';
const healthUrl = process.env.DECISION_OS_URL ?? 'http://127.0.0.1:50150/';
const healthTimeoutMs = Number(process.env.DECISION_OS_HEALTH_TIMEOUT_MS ?? 60_000);

function run(command, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const detail = capture ? String(result.stderr || result.stdout).trim() : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function output(command, args) {
  return String(run(command, args, { capture: true }).stdout).trim();
}

async function waitForHealth() {
  const deadline = Date.now() + healthTimeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) {
        process.stdout.write(`Decision OS is healthy: ${response.status} ${healthUrl}\n`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
  }
  throw new Error(`Decision OS did not become healthy within ${healthTimeoutMs}ms (${lastError}).`);
}

async function main() {
  const detectedRoot = output('git', ['rev-parse', '--show-toplevel']);
  if (resolve(detectedRoot) !== repoRoot) {
    throw new Error(`Expected Git root ${repoRoot}, found ${detectedRoot}.`);
  }
  output('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);

  const changes = output('git', ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=all']);
  if (changes) {
    throw new Error([
      'Refusing to pull or restart because the main checkout has local changes outside .decision-os.',
      'Direct changes on main are forbidden. Move the work to a feature worktree, then restore main to a clean state.',
      changes,
    ].join('\n'));
  }

  run('git', ['pull', '--ff-only', '--recurse-submodules=no']);
  run('sv', ['restart', service]);
  await waitForHealth();
  run('sv', ['status', service]);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
