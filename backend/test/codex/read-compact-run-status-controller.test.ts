/**
 * WHAT: Verifies compact status projection from the replicated execution repository.
 * WHY: Card leases, runtime maps, and log files must not override canonical epoch-4 lifecycle state.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readCompactSkillRunStatusController } from '../../src/business/codex/controller/read-compact-run-status-controller.js';
import { createProjectTaskState } from '../../src/business/task-state/helper/project-task-state.js';

test('projects active compact status from the latest matching replicated execution', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-compact-execution-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'tasks.json');
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{
        id: 'master',
        title: 'Master',
        labels: ['master-task'],
        assignment: { nodeId: 'workstation', changedAt: '2026-07-23T08:00:00.000Z', revision: 1 },
      }],
      annotations: [],
      relationships: [],
    }));
    const state = createProjectTaskState({
      projectId: 'project-a',
      writerId: 'workstation',
      decisionOsRoot,
      tasksLedgerFile: ledgerPath,
      initialize: true,
    });
    await state.executions.admit({
      executorNodeId: 'workstation',
      metadata: {
        executionId: 'execution-running',
        requestId: 'request-running',
        sessionId: 'session-running',
        projectId: 'project-a',
        ledgerId: 'tasks',
        taskId: 'master',
        sourceCardId: 'master',
        ownerCardId: 'master',
        kind: 'thread',
        requestedAt: '2026-07-23T08:01:00.000Z',
        model: 'gpt-5.6-sol',
        effort: 'medium',
        pipelineRunId: null,
        pipelineStepId: null,
        pipelineSkillRunId: null,
        predecessorExecutionId: null,
        restartOfExecutionId: null,
      },
    });
    await state.executions.transition('execution-running', {
      phase: 'queued',
      changedAt: '2026-07-23T08:01:01.000Z',
    });
    await state.executions.transition('execution-running', {
      phase: 'starting',
      changedAt: '2026-07-23T08:01:02.000Z',
    });
    await state.executions.transition('execution-running', {
      phase: 'running',
      changedAt: '2026-07-23T08:01:03.000Z',
    });
    const runtime = {
      decisionOsRoot,
      taskExecutionState: state,
      readTaskLedgerProjection: () => state.projection().ledger,
    };

    const status = readCompactSkillRunStatusController({
      runId: 'session-running',
      ledgerId: 'tasks',
      cardId: 'master',
      runtime,
    });

    assert.equal(status.ok, true);
    assert.equal(status.status, 'running');
    assert.equal(status.phase, 'running');
    assert.equal(status.startedAt, '2026-07-23T08:01:02.000Z');
    assert.equal(status.phaseSince, '2026-07-23T08:01:03.000Z');
    assert.equal(status.lifecycleRevision, 4);
    assert.equal(status.assignedNodeId, 'workstation');
    assert.equal(status.executorNodeId, 'workstation');
    assert.deepEqual(status.validActions, ['cancel', 'open-log']);
    assert.equal((status.execution as Record<string, unknown>).executionId, 'execution-running');
    assert.equal(status.events, undefined);
    assert.equal(status.diagnostics, undefined);
    await state.flush();
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
