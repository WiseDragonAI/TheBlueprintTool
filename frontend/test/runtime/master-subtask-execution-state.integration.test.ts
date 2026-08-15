/**
 * WHAT: Verifies master-detail execution projection decorates and clears mounted subtask rows independently.
 * WHY: Collapsed disclosures retain mounted rows whose durable labels must survive transient execution cleanup.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskExecutionStateSummary } from '../../../shared/schemas/task-execution-presentation-types.js';
import {
  activeSubtaskExecutions,
  applyMasterSubtaskExecutionState,
} from '../../src/app/responsive/master-subtask-execution-state.js';

function mountedSubtaskRow(cardId: string, taskTitle: string, taskStatus: string) {
  const attributes: Record<string, string> = {};
  const durableStatus = { textContent: taskStatus };
  return {
    dataset: { cardId, taskTitle, taskStatus },
    querySelector: (_selector: string) => durableStatus,
    setAttribute: (name: string, value: string) => { attributes[name] = String(value); },
    removeAttribute: (name: string) => { delete attributes[name]; },
    getAttribute: (name: string) => attributes[name] ?? null,
  };
}

function mountedExecution(executionId: string, sourceCardId: string, phase: 'running' | 'queued') {
  return {
    executionId,
    sessionId: `session-${sourceCardId}`,
    sourceCardId,
    kind: 'thread' as const,
    phase,
    requestedAt: '2026-07-28T07:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    model: null,
    effort: null,
    predecessorExecutionId: null,
    executorNodeId: 'workstation',
    revision: 2,
    queuePosition: 2,
    error: null,
    artifacts: { jsonl: true, stderr: true, telemetry: false, result: false },
  };
}

test('active execution presentation is keyed by source subtask', () => {
  const execution = (executionId: string, sourceCardId: string, phase: 'running' | 'queued') => ({
    executionId,
    sessionId: `session-${sourceCardId}`,
    sourceCardId,
    kind: 'thread' as const,
    phase,
    requestedAt: '2026-07-28T07:00:00.000Z',
    startedAt: phase === 'queued' ? null : '2026-07-28T07:00:01.000Z',
    finishedAt: null,
    model: null,
    effort: null,
    predecessorExecutionId: null,
    executorNodeId: 'workstation',
    revision: 2,
    queuePosition: phase === 'queued' ? 2 : null,
    error: null,
    artifacts: { jsonl: true, stderr: true, telemetry: false, result: false },
  });
  const summary: TaskExecutionStateSummary = {
    taskId: 'master',
    activeExecutionIds: ['execution-a', 'execution-b'],
    defaultExecutionId: 'execution-b',
    sessions: [
      { sessionId: 'session-child-a', requestedAt: '2026-07-28T07:00:00.000Z', executions: [execution('execution-a', 'child-a', 'running')] },
      { sessionId: 'session-child-b', requestedAt: '2026-07-28T07:01:00.000Z', executions: [execution('execution-b', 'child-b', 'queued')] },
    ],
  };

  const active = activeSubtaskExecutions(summary);
  assert.equal(active.get('child-a')?.phase, 'running');
  assert.equal(active.get('child-b')?.phase, 'queued');
  assert.equal(active.has('master'), false);
});

test('mounted collapsed disclosure rows receive independent execution decoration and retain durable labels after cleanup', () => {
  const runningRow = mountedSubtaskRow('child-running', 'Running child', 'open');
  const queuedRow = mountedSubtaskRow('child-queued', 'Queued child', 'blocked');
  const collapsedDisclosure = {
    querySelectorAll: () => [runningRow, queuedRow],
  };
  const activeSummary: TaskExecutionStateSummary = {
    taskId: 'master',
    activeExecutionIds: ['execution-running', 'execution-queued'],
    defaultExecutionId: 'execution-running',
    sessions: [
      { sessionId: 'session-child-running', requestedAt: '2026-07-28T07:00:00.000Z', executions: [mountedExecution('execution-running', 'child-running', 'running')] },
      { sessionId: 'session-child-queued', requestedAt: '2026-07-28T07:01:00.000Z', executions: [mountedExecution('execution-queued', 'child-queued', 'queued')] },
    ],
  };

  applyMasterSubtaskExecutionState(collapsedDisclosure, activeSummary);

  assert.deepEqual(runningRow.dataset, {
    cardId: 'child-running',
    taskTitle: 'Running child',
    taskStatus: 'open',
    runStatus: 'running',
    executionPhase: 'running',
  });
  assert.equal(runningRow.querySelector('small')?.textContent, 'running');
  assert.equal(runningRow.getAttribute('aria-label'), 'Running child, running');
  assert.deepEqual(queuedRow.dataset, {
    cardId: 'child-queued',
    taskTitle: 'Queued child',
    taskStatus: 'blocked',
    runStatus: 'pending',
    executionPhase: 'queued',
  });
  assert.equal(queuedRow.querySelector('small')?.textContent, 'queued');
  assert.equal(queuedRow.getAttribute('aria-label'), 'Queued child, queued');

  applyMasterSubtaskExecutionState(collapsedDisclosure, {
    taskId: 'master',
    activeExecutionIds: [],
    defaultExecutionId: null,
    sessions: [],
  });

  assert.deepEqual(runningRow.dataset, {
    cardId: 'child-running',
    taskTitle: 'Running child',
    taskStatus: 'open',
  });
  assert.equal(runningRow.querySelector('small')?.textContent, 'open');
  assert.equal(runningRow.getAttribute('aria-label'), null);
  assert.deepEqual(queuedRow.dataset, {
    cardId: 'child-queued',
    taskTitle: 'Queued child',
    taskStatus: 'blocked',
  });
  assert.equal(queuedRow.querySelector('small')?.textContent, 'blocked');
  assert.equal(queuedRow.getAttribute('aria-label'), null);
});
