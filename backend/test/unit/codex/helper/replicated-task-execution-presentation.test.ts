/**
 * WHAT: Verifies replica presentation updates remain bounded, idempotent, and metadata-complete.
 * WHY: Executor push batches must merge into the same local browser response regardless of replay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTaskExecutionPresentationUpdate,
  isTaskExecutionPresentationEvent,
  isTaskExecutionPresentationUpdate,
  replicatedTaskExecutionPresentation,
} from '@backend/business/codex/helper/replicated-task-execution-presentation.js';
import { replicatedCardSkillRunStatus } from '@backend/business/codex/helper/replicated-card-skill-run-status.js';
import type { ReplicatedTaskExecutionRecord } from '@backend/business/task-state/helper/task-execution-repository.js';

const message = {
  id: 'agent_message:message-a',
  kind: 'agent_message' as const,
  title: 'Codex message',
  status: '',
  severity: 'info' as const,
  text: 'First',
};
const toolStarted = {
  id: 'tool_call:tool-a',
  kind: 'tool_call' as const,
  title: 'rg TODO',
  status: 'in_progress',
  severity: 'info' as const,
  command: 'rg TODO',
  exitCode: '',
};
const toolCompleted = { ...toolStarted, status: 'completed', exitCode: '0' };
const subagent = {
  id: 'subagent:tool-b',
  kind: 'subagent' as const,
  title: 'Subagent · product-analysis',
  status: 'completed',
  severity: 'info' as const,
  skillName: 'product-analysis',
  model: 'gpt-5.6-luna',
  effort: 'low',
};

test('merges replayed presentation batches by stable event identity', () => {
  const initial = applyTaskExecutionPresentationUpdate([], {
    reset: true,
    events: [message, toolStarted],
  });
  const replayed = applyTaskExecutionPresentationUpdate(initial, {
    reset: false,
    events: [toolCompleted],
  });
  assert.deepEqual(replayed, [message, toolCompleted]);
  assert.deepEqual(applyTaskExecutionPresentationUpdate(replayed, {
    reset: false,
    events: [toolCompleted],
  }), replayed);
});

test('rejects oversized presentation batches and projects replicated counts', () => {
  assert.equal(isTaskExecutionPresentationUpdate({
    reset: false,
    events: Array.from({ length: 257 }, () => message),
  }), false);
  assert.equal(isTaskExecutionPresentationUpdate({ reset: false, events: [message, toolCompleted, subagent] }), true);
  assert.equal(Array.from({ length: 257 }, () => message).every(isTaskExecutionPresentationEvent), true);
  const record = {
    metadata: {
      executionId: 'execution-a',
      requestId: 'request-a',
      sessionId: 'session-a',
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'task-a',
      sourceCardId: 'task-a',
      ownerCardId: 'task-a',
      kind: 'thread',
      requestedAt: '2026-07-28T00:00:00.000Z',
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    lifecycle: {
      phase: 'running',
      phaseSince: '2026-07-28T00:00:01.000Z',
      startedAt: '2026-07-28T00:00:01.000Z',
      finishedAt: null,
      executorNodeId: 'node-b',
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
      changedAt: '2026-07-28T00:00:01.000Z',
      revision: 1,
    },
  } as ReplicatedTaskExecutionRecord;
  const presentation = replicatedTaskExecutionPresentation(record, [message, toolCompleted]);
  assert.equal(presentation.execution.executorNodeId, 'node-b');
  assert.equal(presentation.execution.phase, 'running');
  assert.deepEqual(presentation.execution.counts, {
    tools: 1,
    messages: 1,
    comments: 0,
    thinking: 0,
    files: 0,
    warnings: 0,
    errors: 0,
  });
  const status = replicatedCardSkillRunStatus({
    runId: 'session-a',
    ledgerId: 'tasks',
    cardId: 'task-a',
    executions: [record],
    events: [message, toolCompleted],
  });
  assert.equal(status.phase, 'running');
  assert.equal(status.executorNodeId, 'node-b');
  assert.equal(status.toolCallCount, 1);
  assert.equal((status.latestEvent as Record<string, unknown>).tool, 'rg TODO');
});
