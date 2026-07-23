import assert from 'node:assert/strict';
import test from 'node:test';
import { createCodexExecutionRecord, transitionCodexExecution } from '@backend/business/codex/helper/codex-execution-transition.js';

const base = () => createCodexExecutionRecord({
  executionId: 'execution-a',
  sessionId: 'session-a',
  projectId: 'project-a',
  ledgerId: 'tasks',
  taskId: 'task-a',
  ownerCardId: 'card-a',
  kind: 'thread',
  requestedAt: '2026-07-23T01:00:00.000Z',
});

test('applies the canonical lifecycle with monotonic revision and exact phase timestamps', () => {
  const queued = transitionCodexExecution({ record: base(), expectedExecutionId: 'execution-a', phase: 'queued', changedAt: '2026-07-23T01:00:01.000Z' });
  const starting = transitionCodexExecution({ record: queued, expectedExecutionId: 'execution-a', phase: 'starting', changedAt: '2026-07-23T01:00:02.000Z', executorNodeId: 'workstation' });
  const running = transitionCodexExecution({ record: starting, expectedExecutionId: 'execution-a', phase: 'running', changedAt: '2026-07-23T01:00:03.000Z', processId: 42, processStartTime: '100' });
  const succeeded = transitionCodexExecution({ record: running, expectedExecutionId: 'execution-a', phase: 'succeeded', changedAt: '2026-07-23T01:00:04.000Z', result: { status: 'succeeded', summary: 'complete' } });
  assert.deepEqual([queued.revision, starting.revision, running.revision, succeeded.revision], [2, 3, 4, 5]);
  assert.equal(starting.startedAt, '2026-07-23T01:00:02.000Z');
  assert.equal(running.startedAt, starting.startedAt);
  assert.equal(running.phaseSince, '2026-07-23T01:00:03.000Z');
  assert.equal(succeeded.finishedAt, '2026-07-23T01:00:04.000Z');
  assert.equal(succeeded.executorNodeId, 'workstation');
});

test('rejects stale identity, illegal transitions, and incomplete pipeline identity', () => {
  assert.throws(() => transitionCodexExecution({ record: base(), expectedExecutionId: 'execution-b', phase: 'queued' }), /identity_mismatch/);
  assert.throws(() => transitionCodexExecution({ record: base(), expectedExecutionId: 'execution-a', phase: 'running', executorNodeId: 'workstation' }), /transition_invalid/);
  assert.throws(() => createCodexExecutionRecord({
    executionId: 'pipeline-a', sessionId: 'session-a', projectId: 'project-a', ledgerId: 'tasks', taskId: 'task-a', ownerCardId: 'card-a', kind: 'pipeline-skill',
  }), /pipeline_identity_invalid/);
});

test('supports explicit interrupted recovery through the queue without reopening terminal success', () => {
  const queued = transitionCodexExecution({ record: base(), expectedExecutionId: 'execution-a', phase: 'queued' });
  const firstStart = transitionCodexExecution({ record: queued, expectedExecutionId: 'execution-a', phase: 'starting', executorNodeId: 'workstation' });
  const firstRun = transitionCodexExecution({ record: firstStart, expectedExecutionId: 'execution-a', phase: 'running', processId: 42, processStartTime: '100' });
  const interrupted = transitionCodexExecution({ record: firstRun, expectedExecutionId: 'execution-a', phase: 'interrupted', result: { status: 'interrupted', summary: 'server restart' } });
  const requeued = transitionCodexExecution({ record: interrupted, expectedExecutionId: 'execution-a', phase: 'queued' });
  assert.equal(requeued.finishedAt, null);
  assert.equal(requeued.result, null);
  assert.equal(requeued.executorNodeId, null);
  assert.equal(requeued.processId, null);
  assert.equal(requeued.processStartTime, null);
  assert.equal(requeued.startedAt, null);
  const starting = transitionCodexExecution({ record: requeued, expectedExecutionId: 'execution-a', phase: 'starting', executorNodeId: 'workstation' });
  const running = transitionCodexExecution({ record: starting, expectedExecutionId: 'execution-a', phase: 'running' });
  const succeeded = transitionCodexExecution({ record: running, expectedExecutionId: 'execution-a', phase: 'succeeded' });
  assert.throws(() => transitionCodexExecution({ record: succeeded, expectedExecutionId: 'execution-a', phase: 'queued' }), /transition_invalid/);
});

test('persists cancelling before terminal cancellation', () => {
  const queued = transitionCodexExecution({ record: base(), expectedExecutionId: 'execution-a', phase: 'queued' });
  const starting = transitionCodexExecution({ record: queued, expectedExecutionId: 'execution-a', phase: 'starting', executorNodeId: 'workstation' });
  const running = transitionCodexExecution({ record: starting, expectedExecutionId: 'execution-a', phase: 'running', processId: 42, processStartTime: '100' });
  const cancelling = transitionCodexExecution({ record: running, expectedExecutionId: 'execution-a', phase: 'cancelling', changedAt: '2026-07-23T01:00:04.000Z' });
  const cancelled = transitionCodexExecution({ record: cancelling, expectedExecutionId: 'execution-a', phase: 'cancelled', changedAt: '2026-07-23T01:00:05.000Z' });
  assert.equal(cancelling.startedAt, running.startedAt);
  assert.equal(cancelling.finishedAt, null);
  assert.equal(cancelled.result?.status, 'cancelled');
  assert.equal(cancelled.finishedAt, '2026-07-23T01:00:05.000Z');
});
