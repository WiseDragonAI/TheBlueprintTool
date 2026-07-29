/**
 * WHAT: Proves requester nodes route assigned thread work before inspecting executor-local files.
 * WHY: A remote collaborator must not need the assigned node's mutable card, thread, or run artifacts.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { continueCardSkillRunController } from '@backend/business/codex/controller/continue-card-skill-run-controller.js';
import { startThreadCodexProcessController } from '@backend/business/codex/controller/start-thread-codex-process-controller.js';
import {
  createTaskExecutionRouter,
  type TaskExecutionLaunchRequest,
  type TaskExecutionReceipt,
} from '@backend/business/codex/helper/task-execution-router.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';

test('remote thread start and continuation route without requester-local content or run artifacts', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-remote-assignment-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerFile = join(decisionOsRoot, 'tasks.json');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(ledgerFile, JSON.stringify({
    cards: [
      {
        id: 'start-card',
        title: 'Remote start',
        status: 'todo',
        labels: ['master-task'],
        assignment: { nodeId: 'workstation', changedAt: '2026-07-29T01:00:00.000Z', revision: 1 },
        comment: { contentFile: '.decision-os/cards/tasks/start-card.md' },
      },
      {
        id: 'continue-card',
        title: 'Remote continuation',
        status: 'todo',
        labels: ['master-task'],
        assignment: { nodeId: 'workstation', changedAt: '2026-07-29T01:00:00.000Z', revision: 1 },
        comment: { contentFile: '.decision-os/cards/tasks/continue-card.md' },
        codexThreadRunId: 'remote-run',
        codexThreadRunOutputFile: '.decision-os/runs/codex-skills/tasks/remote-run.md',
      },
    ],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: {
      'thread-start-card': '.decision-os/threads/tasks/thread-start-card.md',
      'thread-continue-card': '.decision-os/threads/tasks/thread-continue-card.md',
    },
  }));
  const taskState = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'phone',
    decisionOsRoot,
    tasksLedgerFile: ledgerFile,
    initialize: true,
  });
  const dispatched: TaskExecutionLaunchRequest[] = [];
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    projectId: 'project-a',
    taskExecutionNodeId: 'phone',
    taskExecutionState: taskState,
    readTaskLedgerProjection: () => taskState.projection().ledger,
  };
  runtime.taskExecutionRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => taskState,
    localNodeId: () => 'phone',
    peer: (nodeId) => nodeId === 'workstation' ? { online: true } : null,
    dispatchRemote: async (assignedNodeId, request): Promise<TaskExecutionReceipt> => {
      dispatched.push(request);
      return {
        executionId: request.executionId,
        requestId: request.requestId,
        projectId: request.projectId,
        ledgerId: request.ledgerId,
        taskId: request.sourceCardId,
        assignedNodeId,
        executorNodeId: assignedNodeId,
        phase: 'queued',
        revision: 1,
        requestedAt: request.requestedAt,
      };
    },
  });
  context.after(async () => {
    await taskState.flush();
    rmSync(workspace, { recursive: true, force: true });
  });

  const started = await startThreadCodexProcessController({
    action_payload: {
      requestId: 'start-request',
      executionId: 'start-execution',
      reservedRunId: 'start-run',
      ledgerId: 'tasks',
      cardId: 'start-card',
      threadId: 'thread-start-card',
    },
    runtime_state: runtime,
  });
  assert.equal(started.statusCode, 202, JSON.stringify(started));
  assert.equal((started.receipt as TaskExecutionReceipt).executorNodeId, 'workstation');

  const continued = await continueCardSkillRunController({
    action_payload: {
      requestId: 'continue-request',
      executionId: 'continue-execution',
      ledgerId: 'tasks',
      cardId: 'continue-card',
      runId: 'remote-run',
    },
    runtime_state: runtime,
  });
  assert.equal(continued.statusCode, 202, JSON.stringify(continued));
  assert.equal((continued.receipt as TaskExecutionReceipt).executorNodeId, 'workstation');
  assert.deepEqual(dispatched.map((request) => request.kind), ['thread', 'continuation']);
});
