#!/usr/bin/env node
/**
 * WHAT: Fast-forwards decision-os with an automatic stash, restarts its supervised
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

function restoreStash(stashRef) {
  if (!stashRef) return;
  process.stdout.write(`Restoring local changes from ${stashRef}...\n`);
  const result = run('git', ['stash', 'pop', '--index', stashRef], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`Could not restore ${stashRef}. The stash was kept; resolve the reported conflicts before restarting.`);
  }
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

  const dirty = output('git', ['status', '--porcelain=v1', '--untracked-files=all']).length > 0;
  let stashRef = '';
  if (dirty) {
    const marker = `decision-os-pull-restart-${process.pid}-${Date.now()}`;
    process.stdout.write('Stashing tracked and untracked local changes...\n');
    run('git', ['stash', 'push', '--include-untracked', '--message', marker]);
    const stashRecord = output('git', ['stash', 'list', '-1', '--format=%gd%x00%gs']).split('\0');
    if (stashRecord.length !== 2 || !stashRecord[1].includes(marker)) {
      throw new Error('Git created a stash, but its identity could not be verified. The server was not restarted.');
    }
    stashRef = stashRecord[0];
  }

  let pullError;
  try {
    run('git', ['pull', '--ff-only']);
  } catch (error) {
    pullError = error;
  }

  try {
    restoreStash(stashRef);
  } catch (restoreError) {
    if (pullError) {
      throw new AggregateError([pullError, restoreError], 'Pull and stash restoration both failed. The server was not restarted.');
    }
    throw restoreError;
  }
  if (pullError) throw pullError;

  run('sv', ['restart', service]);
  await waitForHealth();
  run('sv', ['status', service]);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
