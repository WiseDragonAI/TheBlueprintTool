/**
 * WHAT: Verifies master-detail status projection keeps concurrent sibling executions independent.
 * WHY: One running child must not animate its siblings or replace their durable lifecycle labels.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskExecutionStateSummary } from '../../../shared/schemas/task-execution-presentation-types.js';
import { activeSubtaskExecutions } from '../../src/app/responsive/master-subtask-execution-state.js';

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
