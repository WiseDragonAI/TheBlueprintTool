/**
 * WHAT: Verifies deterministic task, session, and execution summary projection.
 * WHY: The frontend must receive the complete Epoch 4 hierarchy without reading card session aliases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectTaskExecutionState } from '@backend/business/codex/helper/project-task-execution-state.js';
import type { ProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskExecutionPhase } from '@backend/business/task-state/helper/task-current-state-types.js';

function record(input: {
  executionId: string;
  sessionId: string;
  requestedAt: string;
  phase: TaskExecutionPhase;
  ledgerId?: string;
  taskId?: string;
  sourceCardId?: string;
}) {
  return {
    metadata: {
      executionId: input.executionId,
      requestId: `request-${input.executionId}`,
      sessionId: input.sessionId,
      projectId: 'project-a',
      ledgerId: input.ledgerId ?? 'tasks',
      taskId: input.taskId ?? 'task-a',
      sourceCardId: input.sourceCardId ?? 'task-a',
      ownerCardId: input.sourceCardId ?? 'task-a',
      kind: 'pipeline-skill' as const,
      requestedAt: input.requestedAt,
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId: 'pipeline-a',
      pipelineStepId: 'step-a',
      pipelineSkillRunId: input.sessionId,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    lifecycle: {
      phase: input.phase,
      phaseSince: input.requestedAt,
      startedAt: input.requestedAt,
      finishedAt: null,
      executorNodeId: 'workstation',
      providerSessionId: null,
      result: null,
      error: null,
      revision: 2,
    },
    artifacts: {
      jsonl: null,
      stderr: null,
      telemetry: null,
      result: null,
      changedAt: input.requestedAt,
      revision: 1,
    },
  };
}

test('projects several sessions and preserves every valid active pipeline execution', () => {
  const records = [
    record({ executionId: 'execution-1', sessionId: 'session-1', requestedAt: '2026-07-25T01:00:00.000Z', phase: 'succeeded' }),
    record({ executionId: 'execution-2', sessionId: 'session-1', requestedAt: '2026-07-25T02:00:00.000Z', phase: 'running' }),
    record({ executionId: 'execution-3', sessionId: 'session-2', requestedAt: '2026-07-25T03:00:00.000Z', phase: 'queued' }),
  ];
  const state = {
    executions: {
      byTaskId: (taskId: string) => taskId === 'task-a' ? records : [],
      bySourceCardId: () => [],
    },
  } as unknown as ProjectTaskState;

  const summary = projectTaskExecutionState({
    scope: {
      ledgerId: 'tasks',
      requestedCardId: 'task-a',
      taskId: 'task-a',
      sourceCardId: 'task-a',
      includeLegacyUnscopedExecutions: false,
    },
    state,
  });

  assert.deepEqual(summary.sessions.map((session) => ({
    sessionId: session.sessionId,
    executionIds: session.executions.map((execution) => execution.executionId),
  })), [
    { sessionId: 'session-1', executionIds: ['execution-1', 'execution-2'] },
    { sessionId: 'session-2', executionIds: ['execution-3'] },
  ]);
  assert.deepEqual(summary.activeExecutionIds, ['execution-2', 'execution-3']);
  assert.equal(summary.defaultExecutionId, 'execution-3');
  assert.equal(summary.sessions[0].executions[0].sourceCardId, 'task-a');
  assert.deepEqual(summary.sessions[0].executions[0].artifacts, {
    jsonl: false,
    stderr: false,
    telemetry: false,
    result: false,
  });
});

test('projects immutable historical ordinary-card executions with an empty task identity', () => {
  const historical = record({
    executionId: 'execution-old',
    sessionId: 'session-old',
    requestedAt: '2026-07-25T01:00:00.000Z',
    phase: 'succeeded',
    ledgerId: 'rust-serverless',
    taskId: '',
    sourceCardId: 'card-overview',
  });
  const current = record({
    executionId: 'execution-new',
    sessionId: 'session-new',
    requestedAt: '2026-07-25T02:00:00.000Z',
    phase: 'running',
    ledgerId: 'rust-serverless',
    taskId: 'card-overview',
    sourceCardId: 'card-overview',
  });
  const wrongLedger = record({
    executionId: 'execution-other',
    sessionId: 'session-other',
    requestedAt: '2026-07-25T03:00:00.000Z',
    phase: 'running',
    ledgerId: 'another-ledger',
    taskId: '',
    sourceCardId: 'card-overview',
  });
  const state = {
    executions: {
      byTaskId: (taskId: string) => taskId === 'card-overview' ? [current] : [],
      bySourceCardId: (cardId: string) => cardId === 'card-overview' ? [historical, current, wrongLedger] : [],
    },
  } as unknown as ProjectTaskState;

  const summary = projectTaskExecutionState({
    scope: {
      ledgerId: 'rust-serverless',
      requestedCardId: 'card-overview',
      taskId: 'card-overview',
      sourceCardId: 'card-overview',
      includeLegacyUnscopedExecutions: true,
    },
    state,
  });

  assert.deepEqual(summary.sessions.flatMap((session) => session.executions.map((execution) => execution.executionId)), [
    'execution-old',
    'execution-new',
  ]);
  assert.deepEqual(summary.activeExecutionIds, ['execution-new']);
  assert.equal(summary.defaultExecutionId, 'execution-new');
});
