import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  codexProcessQueuePosition,
  enqueueCodexContinuation,
  enqueueCodexThreadProcess,
  markCodexProcessQueueItemRunning,
  recordCodexProcessQueueItemProcess,
  readCodexProcessQueue,
  recoverCodexProcessQueue,
  removeCodexProcessQueueItem,
} from '../../src/business/codex/helper/codex-process-queue.js';
import { runningCodexProcessCount, unifiedCodexQueuePosition } from '../../src/business/codex/helper/codex-process-scheduler.js';
import { maxConcurrentCodexProcesses } from '../../src/business/codex/helper/codex-pipeline-runner.js';

test('persists mixed Codex work in FIFO order and recovers a claimed thread as a continuation', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-process-queue-'));
  try {
    enqueueCodexThreadProcess({ decisionOsRoot: root, id: 'thread-a', createdAt: '2026-07-14T10:00:00.000Z', payload: { cardId: 'a' } });
    enqueueCodexContinuation({ decisionOsRoot: root, id: 'continue-b', createdAt: '2026-07-14T10:00:01.000Z', payload: { runId: 'b' } });
    assert.equal(codexProcessQueuePosition(root, 'thread-a'), 1);
    assert.equal(codexProcessQueuePosition(root, 'continue-b'), 2);
    assert.equal(markCodexProcessQueueItemRunning(root, 'thread-a')?.status, 'running');
    assert.equal(codexProcessQueuePosition(root, 'continue-b'), 1);
    recoverCodexProcessQueue(root);
    const recovered = readCodexProcessQueue(root);
    assert.deepEqual(recovered.map((item) => [item.id, item.kind, item.status]), [['thread-a', 'continuation', 'pending'], ['continue-b', 'continuation', 'pending']]);
    assert.equal(recovered[0].startedAt, null);
    assert.equal(recovered[0].interruptedAt, null);
    assert.equal(recovered[0].interruptionReason, '');
    assert.deepEqual(recovered[0].payload, {
      cardId: 'a',
      runId: 'thread-a',
      newSession: false,
      restartRecovery: true,
    });
    assert.equal(codexProcessQueuePosition(root, 'thread-a'), 1);
    recoverCodexProcessQueue(root);
    assert.equal(readCodexProcessQueue(root)[0].status, 'pending');
    removeCodexProcessQueueItem(root, 'thread-a');
    assert.deepEqual(readCodexProcessQueue(root).map((item) => item.id), ['continue-b']);
    assert.equal(JSON.parse(readFileSync(resolve(root, 'codex-process-queue.json'), 'utf8')).version, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adopts a matching live process and settles it from its durable terminal event', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-live-process-adoption-'));
  try {
    const stdoutFile = resolve(root, 'run-a.jsonl');
    const stderrFile = resolve(root, 'run-a.log');
    writeFileSync(stdoutFile, `${JSON.stringify({ type: 'turn.started' })}\n`);
    writeFileSync(stderrFile, '');
    enqueueCodexThreadProcess({
      decisionOsRoot: root,
      id: 'run-a',
      createdAt: '2026-07-15T08:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a' },
    });
    markCodexProcessQueueItemRunning(root, 'run-a');
    recordCodexProcessQueueItemProcess({ decisionOsRoot: root, id: 'run-a', processId: process.pid, stdoutFile, stderrFile });
    const runtime: Record<string, unknown> = {};

    recoverCodexProcessQueue(root, runtime);

    assert.equal(readCodexProcessQueue(root)[0]?.status, 'running');
    assert.deepEqual((runtime.codexSkillRuns as Record<string, Record<string, unknown>>)['run-a'], {
      id: 'run-a',
      ledgerId: 'specs',
      outputCardId: 'card-a',
      stdoutFile,
      stderrFile,
      pid: process.pid,
      status: 'running',
      startedAt: readCodexProcessQueue(root)[0]?.startedAt,
      adopted: true,
      queueItemId: 'run-a',
    });
    writeFileSync(stdoutFile, [JSON.stringify({ type: 'turn.started' }), JSON.stringify({ type: 'turn.completed' })].join('\n'));
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline && readCodexProcessQueue(root).length > 0) await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(readCodexProcessQueue(root), []);
    assert.equal(((runtime.codexSkillRuns as Record<string, Record<string, unknown>>)['run-a']).status, 'complete');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal JSONL wins over a surviving process identity during restart recovery', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-terminal-process-recovery-'));
  try {
    const stdoutFile = resolve(root, 'run-complete.jsonl');
    const stderrFile = resolve(root, 'run-complete.log');
    writeFileSync(stdoutFile, [JSON.stringify({ type: 'turn.started' }), JSON.stringify({ type: 'turn.completed' })].join('\n'));
    writeFileSync(stderrFile, '');
    enqueueCodexThreadProcess({
      decisionOsRoot: root,
      id: 'run-complete',
      createdAt: '2026-07-15T08:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a' },
    });
    markCodexProcessQueueItemRunning(root, 'run-complete');
    recordCodexProcessQueueItemProcess({ decisionOsRoot: root, id: 'run-complete', processId: process.pid, stdoutFile, stderrFile });
    const runtime: Record<string, unknown> = {};

    recoverCodexProcessQueue(root, runtime);

    assert.deepEqual(readCodexProcessQueue(root), []);
    assert.equal(((runtime.codexSkillRuns as Record<string, Record<string, unknown>>)['run-complete']).status, 'complete');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('finds terminal output for a legacy running item without persisted process fields', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-legacy-terminal-recovery-'));
  try {
    const runId = 'legacy-run';
    const directory = resolve(root, 'runs', 'codex-skills', 'specs');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, `${runId}.jsonl`), JSON.stringify({ type: 'turn.completed' }));
    writeFileSync(resolve(root, 'codex-process-queue.json'), JSON.stringify({
      version: 1,
      items: [{
        id: runId,
        kind: 'thread',
        status: 'running',
        createdAt: '2026-07-15T08:00:00.000Z',
        startedAt: '2026-07-15T08:00:01.000Z',
        payload: { ledgerId: 'specs', cardId: 'card-a' },
      }],
    }));

    recoverCodexProcessQueue(root, {});

    assert.deepEqual(readCodexProcessQueue(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requeues one owned continuation per interrupted logical run and drops stale ownership', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-interrupted-logical-runs-'));
  try {
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }],
    }));
    writeFileSync(resolve(root, 'specs.json'), JSON.stringify({
      cards: [
        { id: 'card-owned', codexThreadRunId: 'run-owned' },
        { id: 'card-stale', codexThreadRunId: 'run-newer' },
      ],
    }));
    writeFileSync(resolve(root, 'codex-process-queue.json'), JSON.stringify({
      version: 1,
      items: [
        { id: 'continue-owned-a', kind: 'continuation', status: 'interrupted', createdAt: '2026-07-15T01:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'card-owned', runId: 'run-owned' } },
        { id: 'continue-owned-b', kind: 'continuation', status: 'interrupted', createdAt: '2026-07-15T02:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'card-owned', runId: 'run-owned' } },
        { id: 'continue-stale', kind: 'continuation', status: 'interrupted', createdAt: '2026-07-15T03:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'card-stale', runId: 'run-older' } },
      ],
    }));

    recoverCodexProcessQueue(root, {});

    const recovered = readCodexProcessQueue(root);
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].id, 'continue-owned-a');
    assert.equal(recovered[0].status, 'pending');
    assert.equal(recovered[0].payload.runId, 'run-owned');
    assert.equal(recovered[0].payload.restartRecovery, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('uses server-wide capacity, running count, and queue position callbacks', () => {
  const runtime = {
    decisionOsSettings: { maxConcurrentCodexProcesses: 2 },
    codexSkillRuns: { local: { status: 'running' } },
    globalCodexProcessCapacity: () => 5,
    globalCodexRunningProcessCount: () => 4,
    globalCodexQueuePosition: (id: string) => id === 'queued' ? 3 : 1,
  };
  assert.equal(maxConcurrentCodexProcesses(runtime), 5);
  assert.equal(runningCodexProcessCount(runtime), 4);
  assert.equal(unifiedCodexQueuePosition({ decisionOsRoot: '/unused', id: 'queued', createdAt: '', runtime }), 3);
});

test('recovers a claimed continuation without changing its durable run identity', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-continuation-recovery-'));
  try {
    enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'continuation-a',
      createdAt: '2026-07-15T07:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', newSession: false },
    });
    assert.equal(markCodexProcessQueueItemRunning(root, 'continuation-a')?.status, 'running');
    recoverCodexProcessQueue(root);
    const [recovered] = readCodexProcessQueue(root);
    assert.equal(recovered.status, 'pending');
    assert.equal(recovered.kind, 'continuation');
    assert.equal(recovered.payload.runId, 'run-a');
    assert.equal(recovered.payload.restartRecovery, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
