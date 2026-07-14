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

test('persists mixed Codex work in FIFO order and recovers an interrupted claim', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-process-queue-'));
  try {
    enqueueCodexThreadProcess({ decisionOsRoot: root, id: 'thread-a', createdAt: '2026-07-14T10:00:00.000Z', payload: { cardId: 'a' } });
    enqueueCodexContinuation({ decisionOsRoot: root, id: 'continue-b', createdAt: '2026-07-14T10:00:01.000Z', payload: { runId: 'b' } });
    assert.equal(codexProcessQueuePosition(root, 'thread-a'), 1);
    assert.equal(codexProcessQueuePosition(root, 'continue-b'), 2);
    assert.equal(markCodexProcessQueueItemRunning(root, 'thread-a')?.status, 'running');
    assert.equal(codexProcessQueuePosition(root, 'continue-b'), 1);
    recoverCodexProcessQueue(root);
    assert.deepEqual(readCodexProcessQueue(root).map((item) => [item.id, item.status]), [['thread-a', 'pending'], ['continue-b', 'pending']]);
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
