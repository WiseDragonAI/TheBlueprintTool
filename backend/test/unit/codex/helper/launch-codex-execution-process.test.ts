/**
 * WHAT: Covers the shared Codex child launcher's failure boundary.
 * WHY: A persistence failure after spawn must not leave an untracked process tree alive.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchCodexExecutionProcess } from '@backend/business/codex/helper/launch-codex-execution-process.js';
import { signalCodexProcessTree } from '@backend/business/codex/helper/reconcile-terminal-codex-process.js';

function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

test('spawn metadata failure kills the new process group before returning the error', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-launch-failure-'));
  const stdoutFile = join(root, 'run.jsonl');
  const stderrFile = join(root, 'run.log');
  let childPid = 0;
  try {
    await assert.rejects(launchCodexExecutionProcess({
      decisionOsRoot: root,
      runtime: {},
      workspaceRoot: root,
      ledgerId: 'specs',
      ledgerPath: join(root, 'specs.json'),
      cardId: 'card-a',
      runId: 'run-a',
      executionId: 'execution-a',
      command: { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], model: 'test', effort: 'test' },
      env: { ...process.env },
      prompt: '',
      stdoutFile,
      stderrFile,
      segment: 'start',
      startLine: 0,
      onSpawn(child) {
        childPid = child.pid ?? 0;
        throw new Error('injected metadata persistence failure');
      },
      onSettled() {},
    }), /injected metadata persistence failure/);
    assert.ok(childPid > 0);
    const deadline = Date.now() + 2_000;
    while (processExists(childPid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(processExists(childPid), false);
    assert.equal(existsSync(stderrFile), true);
  } finally {
    if (childPid && processExists(childPid)) {
      try { process.kill(process.platform === 'win32' ? childPid : -childPid, 'SIGKILL'); } catch { /* already exited */ }
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('asynchronous settlement failures are reported without becoming unhandled rejections', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-settlement-failure-'));
  const stdoutFile = join(root, 'run.jsonl');
  const stderrFile = join(root, 'run.log');
  let resolveFailure!: (value: { operation: string; error: Error }) => void;
  const failure = new Promise<{ operation: string; error: Error }>((resolve) => { resolveFailure = resolve; });
  try {
    await launchCodexExecutionProcess({
      decisionOsRoot: root,
      runtime: { onCodexBackgroundError: resolveFailure },
      workspaceRoot: root,
      ledgerId: 'specs',
      ledgerPath: join(root, 'specs.json'),
      cardId: 'card-a',
      runId: 'run-a',
      executionId: 'execution-a',
      command: { command: process.execPath, args: ['-e', 'process.exit(0)'], model: 'test', effort: 'test' },
      env: { ...process.env },
      prompt: '',
      stdoutFile,
      stderrFile,
      segment: 'start',
      startLine: 0,
      onSpawn() {},
      async onSettled() { throw new Error('injected asynchronous settlement failure'); },
    });
    const observed = await failure;
    assert.equal(observed.operation, 'settle-codex-process');
    assert.match(observed.error.message, /injected asynchronous settlement failure/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('execution deadline stops a non-terminating Codex process and reports the scoped failure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-execution-timeout-'));
  const stdoutFile = join(root, 'run.jsonl');
  const stderrFile = join(root, 'run.log');
  let childPid = 0;
  let resolveFailure!: (value: { operation: string; error: Error }) => void;
  let resolveSettlement!: () => void;
  const failure = new Promise<{ operation: string; error: Error }>((resolve) => { resolveFailure = resolve; });
  const settlement = new Promise<void>((resolve) => { resolveSettlement = resolve; });
  try {
    await launchCodexExecutionProcess({
      decisionOsRoot: root,
      runtime: { codexExecutionTimeoutMs: 25, onCodexBackgroundError: resolveFailure },
      workspaceRoot: root,
      ledgerId: 'specs',
      ledgerPath: join(root, 'specs.json'),
      cardId: 'card-a',
      runId: 'run-a',
      executionId: 'execution-a',
      command: { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], model: 'test', effort: 'test' },
      env: { ...process.env },
      prompt: '',
      stdoutFile,
      stderrFile,
      segment: 'start',
      startLine: 0,
      onSpawn(child) { childPid = child.pid ?? 0; },
      onSettled() { resolveSettlement(); },
    });
    const observed = await failure;
    assert.equal(observed.operation, 'codex-execution-timeout');
    assert.match(observed.error.message, /exceeded 25ms/);
    await settlement;
    assert.equal(processExists(childPid), false);
    let unrelatedPid = 0;
    let resolveUnrelatedSettlement!: () => void;
    const unrelatedSettlement = new Promise<void>((resolve) => { resolveUnrelatedSettlement = resolve; });
    await launchCodexExecutionProcess({
      decisionOsRoot: root,
      runtime: { codexExecutionTimeoutMs: 1_000 },
      workspaceRoot: root,
      ledgerId: 'specs',
      ledgerPath: join(root, 'specs.json'),
      cardId: 'card-b',
      runId: 'run-b',
      executionId: 'execution-b',
      command: { command: process.execPath, args: ['-e', 'process.exit(0)'], model: 'test', effort: 'test' },
      env: { ...process.env },
      prompt: '',
      stdoutFile: join(root, 'unrelated.jsonl'),
      stderrFile: join(root, 'unrelated.log'),
      segment: 'start',
      startLine: 0,
      onSpawn(child) { unrelatedPid = child.pid ?? 0; },
      onSettled() { resolveUnrelatedSettlement(); },
    });
    await unrelatedSettlement;
    assert.ok(unrelatedPid > 0);
    assert.equal(processExists(unrelatedPid), false);
  } finally {
    if (childPid && processExists(childPid)) {
      try { process.kill(process.platform === 'win32' ? childPid : -childPid, 'SIGKILL'); } catch { /* already exited */ }
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('process-tree cancellation terminates the wrapper and its descendant', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-process-tree-'));
  const descendantPidFile = join(root, 'descendant.pid');
  const parent = spawn(process.execPath, ['-e', [
    'const { spawn } = require("node:child_process");',
    'const { writeFileSync } = require("node:fs");',
    'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
    'writeFileSync(process.argv[1], String(child.pid));',
    'setInterval(() => {}, 1000);',
  ].join(''), descendantPidFile], { detached: true, stdio: 'ignore' });
  try {
    const deadline = Date.now() + 2_000;
    while (!existsSync(descendantPidFile) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(existsSync(descendantPidFile), true);
    const descendantPid = Number(readFileSync(descendantPidFile, 'utf8'));
    assert.ok(descendantPid > 0);
    assert.equal(signalCodexProcessTree({ child: parent, signal: 'SIGTERM' }), true);
    await once(parent, 'close');
    const descendantDeadline = Date.now() + 2_000;
    while (processExists(descendantPid) && Date.now() < descendantDeadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(processExists(descendantPid), false);
  } finally {
    if (parent.exitCode === null) {
      try { process.kill(-(parent.pid ?? 0), 'SIGKILL'); } catch { /* already exited */ }
    }
    rmSync(root, { recursive: true, force: true });
  }
});
