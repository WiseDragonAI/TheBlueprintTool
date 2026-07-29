/**
 * WHAT: Verifies one task-group execution summary projects into exact source-card histories.
 * WHY: Concurrent master and subtask runs must not activate or populate sibling Codex Logs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  TaskExecutionStateItem,
  TaskExecutionStateSummary,
} from '../../../shared/schemas/task-execution-presentation-types.js';
import { scopeTaskExecutionState } from '../../src/runtime/codex/helper/scope-task-execution-state.js';

function execution(executionId: string, sourceCardId: string, phase: TaskExecutionStateItem['phase']): TaskExecutionStateItem {
  return {
    executionId,
    sessionId: `session-${executionId}`,
    sourceCardId,
    kind: 'thread',
    phase,
    requestedAt: `2026-07-28T07:0${executionId.at(-1)}:00.000Z`,
    startedAt: phase === 'queued' ? null : '2026-07-28T07:00:01.000Z',
    finishedAt: null,
    model: null,
    effort: null,
    predecessorExecutionId: null,
    executorNodeId: 'workstation',
    revision: 2,
    queuePosition: phase === 'queued' ? 2 : null,
    error: null,
    artifacts: { jsonl: false, stderr: false, telemetry: false, result: false },
  };
}

test('source scoping keeps active ids, history, and defaults on the requested card', () => {
  const summary: TaskExecutionStateSummary = {
    taskId: 'master',
    activeExecutionIds: ['execution-1', 'execution-2', 'execution-3'],
    defaultExecutionId: 'execution-3',
    sessions: [
      {
        sessionId: 'session-master',
        requestedAt: '2026-07-28T07:00:00.000Z',
        executions: [execution('execution-1', 'master', 'running')],
      },
      {
        sessionId: 'session-child-a',
        requestedAt: '2026-07-28T07:01:00.000Z',
        executions: [execution('execution-2', 'child-a', 'running')],
      },
      {
        sessionId: 'session-child-b',
        requestedAt: '2026-07-28T07:02:00.000Z',
        executions: [execution('execution-3', 'child-b', 'queued')],
      },
    ],
  };

  const childA = scopeTaskExecutionState(summary, 'child-a');
  const childB = scopeTaskExecutionState(summary, 'child-b');

  assert.deepEqual(childA.activeExecutionIds, ['execution-2']);
  assert.equal(childA.defaultExecutionId, 'execution-2');
  assert.deepEqual(childA.sessions.flatMap((session) => session.executions.map((entry) => entry.executionId)), ['execution-2']);
  assert.deepEqual(childB.activeExecutionIds, ['execution-3']);
  assert.equal(childB.defaultExecutionId, 'execution-3');
  assert.deepEqual(childB.sessions.flatMap((session) => session.executions.map((entry) => entry.executionId)), ['execution-3']);
});
