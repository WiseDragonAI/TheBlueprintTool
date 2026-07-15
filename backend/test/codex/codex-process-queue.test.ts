import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  codexProcessQueuePosition,
  enqueueCodexContinuation,
  enqueueCodexThreadProcess,
  markCodexProcessQueueItemRunning,
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
