/**
 * WHAT: Verifies terminal subtask executions refresh only their canonical master lifecycle.
 * WHY: Settlement events retain source-card routing, while durable execution metadata owns task identity and time.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { taskExecutionState } from '@backend/business/codex/helper/task-execution-runtime.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';
import type { TaskExecutionMetadata } from '@backend/business/task-state/helper/task-current-state-types.js';

const originalWaitingAt = '2026-07-25T10:49:50.798Z';

function metadata(input: {
  executionId: string;
  requestId: string;
  sourceCardId: string;
  requestedAt: string;
}): TaskExecutionMetadata {
  return {
    executionId: input.executionId,
    requestId: input.requestId,
    sessionId: `session-${input.executionId}`,
    projectId: 'subtask-settlement-project',
    ledgerId: 'tasks',
    taskId: 'master',
    sourceCardId: input.sourceCardId,
    ownerCardId: input.sourceCardId,
    kind: 'thread',
    requestedAt: input.requestedAt,
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
}

async function succeedExecution(
  state: NonNullable<ReturnType<typeof taskExecutionState>>,
  execution: TaskExecutionMetadata,
  finishedAt: string,
): Promise<void> {
  await state.executions.admit({ metadata: execution, executorNodeId: 'workstation' });
  await state.executions.transition(execution.executionId, { phase: 'queued', changedAt: execution.requestedAt });
  await state.executions.transition(execution.executionId, { phase: 'starting', changedAt: execution.requestedAt });
  await state.executions.transition(execution.executionId, { phase: 'running', changedAt: execution.requestedAt });
  await state.executions.transition(execution.executionId, {
    phase: 'succeeded',
    changedAt: finishedAt,
    result: { status: 'succeeded', summary: 'complete' },
  });
}

async function cancelExecution(
  state: NonNullable<ReturnType<typeof taskExecutionState>>,
  execution: TaskExecutionMetadata,
  stopAcceptedAt: string,
  cleanupSettledAt: string,
): Promise<void> {
  await state.executions.admit({ metadata: execution, executorNodeId: 'workstation' });
  await state.executions.transition(execution.executionId, { phase: 'queued', changedAt: execution.requestedAt });
  await state.executions.transition(execution.executionId, { phase: 'starting', changedAt: execution.requestedAt });
  await state.executions.transition(execution.executionId, { phase: 'running', changedAt: execution.requestedAt });
  await state.executions.transition(execution.executionId, { phase: 'cancelling', changedAt: stopAcceptedAt });
  await state.executions.transition(execution.executionId, {
    phase: 'cancelled',
    changedAt: cleanupSettledAt,
    result: { status: 'cancelled', summary: 'cancelled' },
  });
}

test('subtask settlement targets the canonical master and keeps its waiting timestamp monotonic', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-subtask-settlement-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const tasksLedgerFile = join(decisionOsRoot, 'tasks.json');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'subtask-settlement-project' }));
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation' }));
  writeFileSync(tasksLedgerFile, JSON.stringify({
    cards: [
      {
        id: 'master',
        title: 'Master',
        status: 'todo',
        labels: ['master-task'],
        assignment: { nodeId: 'workstation', changedAt: originalWaitingAt, revision: 1 },
        lifecycle: { status: 'todo', changedAt: originalWaitingAt, waitingAt: originalWaitingAt, closedAt: null },
      },
      {
        id: 'child-a',
        title: 'Child A',
        status: 'todo',
        labels: ['subtask'],
        lifecycle: { status: 'todo', changedAt: originalWaitingAt, waitingAt: originalWaitingAt, closedAt: null },
      },
      {
        id: 'child-b',
        title: 'Child B',
        status: 'todo',
        labels: ['subtask'],
        lifecycle: { status: 'todo', changedAt: originalWaitingAt, waitingAt: originalWaitingAt, closedAt: null },
      },
    ],
    annotations: [],
    relationships: [
      { id: 'relationship-a', from: 'master', to: 'child-a', label: 'subtask', position: 0 },
      { id: 'relationship-b', from: 'master', to: 'child-b', label: 'subtask', position: 1 },
    ],
  }));
  await migrateTaskCurrentState({
    decisionOsRoot,
    projectId: 'subtask-settlement-project',
    nodeId: 'workstation',
    tasksLedgerFile,
  });

  process.chdir(workspace);
  const runtime: Record<string, unknown> = { decisionOsSettings: { federationNodeId: 'workstation' } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    const state = taskExecutionState(runtime);
    assert.ok(state);
    const firstFinishedAt = '2026-07-28T07:03:22.393Z';
    const secondFinishedAt = '2026-07-28T07:04:22.393Z';
    const cancelledFinishedAt = '2026-07-28T07:05:22.393Z';
    const first = metadata({
      executionId: 'execution-child-a',
      requestId: 'request-child-a',
      sourceCardId: 'child-a',
      requestedAt: '2026-07-28T07:00:00.000Z',
    });
    const second = metadata({
      executionId: 'execution-child-b',
      requestId: 'request-child-b',
      sourceCardId: 'child-b',
      requestedAt: '2026-07-28T07:01:00.000Z',
    });
    const cancelled = metadata({
      executionId: 'execution-child-cancelled',
      requestId: 'request-child-cancelled',
      sourceCardId: 'child-a',
      requestedAt: '2026-07-28T07:02:00.000Z',
    });
    await succeedExecution(state, first, firstFinishedAt);
    await succeedExecution(state, second, secondFinishedAt);
    await cancelExecution(state, cancelled, cancelledFinishedAt, '2026-07-28T07:05:24.393Z');
    const settle = runtime.onCodexRunSettled as (event: Record<string, unknown>) => Promise<void>;

    await settle({
      ledgerId: 'tasks',
      cardId: 'child-b',
      outputCardId: 'child-b',
      threadId: 'thread-child-b',
      runId: second.sessionId,
      executionId: second.executionId,
      status: 'complete',
      finishedAt: originalWaitingAt,
    });
    await settle({
      ledgerId: 'tasks',
      cardId: 'child-a',
      outputCardId: 'child-a',
      threadId: 'thread-child-a',
      runId: first.sessionId,
      executionId: first.executionId,
      status: 'complete',
      finishedAt: '2026-07-29T00:00:00.000Z',
    });
    await settle({
      ledgerId: 'tasks',
      cardId: 'child-a',
      outputCardId: 'child-a',
      threadId: 'thread-child-a',
      runId: cancelled.sessionId,
      executionId: cancelled.executionId,
      // The durable lifecycle must override a contradictory process observation.
      status: 'complete',
      finishedAt: '2026-07-29T00:00:00.000Z',
    });

    const cards = state.projection().ledger.cards as Array<Record<string, any>>;
    assert.equal(cards.find((card) => card.id === 'master')?.lifecycle?.waitingAt, cancelledFinishedAt);
    assert.equal(cards.find((card) => card.id === 'child-a')?.lifecycle?.waitingAt, originalWaitingAt);
    assert.equal(cards.find((card) => card.id === 'child-b')?.lifecycle?.waitingAt, originalWaitingAt);

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/control-room`);
    assert.equal(response.status, 200);
    const controlRoom = await response.json() as Record<string, any>;
    const projectedMaster = (controlRoom.allTasks as Array<Record<string, any>>)
      .find((task) => task.cardId === 'master');
    assert.equal(projectedMaster?.waitingSince, cancelledFinishedAt);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
