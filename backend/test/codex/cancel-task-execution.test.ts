/**
 * WHAT: Verifies canonical queued, live-process, and remote-executor cancellation.
 * WHY: Cancellation must mutate the exact replicated execution before process signalling and route by immutable executor identity.
 */
import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { cancelTaskExecution } from '../../src/business/codex/helper/cancel-task-execution.js';
import { registerTaskExecutionProcess } from '../../src/business/codex/helper/task-execution-runtime.js';
import { createTaskCurrentStateStore } from '../../src/business/task-state/helper/task-current-state-store.js';
import { createTaskExecutionRepository } from '../../src/business/task-state/helper/task-execution-repository.js';
import type { TaskExecutionMetadata } from '../../src/business/task-state/helper/task-current-state-types.js';

function metadata(executionId: string, executorNodeId: string): {
  metadata: TaskExecutionMetadata;
  executorNodeId: string;
} {
  return {
    executorNodeId,
    metadata: {
      executionId,
      requestId: `request-${executionId}`,
      sessionId: `session-${executionId}`,
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'master',
      sourceCardId: 'master',
      ownerCardId: 'master',
      kind: 'thread',
      requestedAt: '2026-07-23T10:00:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  };
}

function fixture(context: test.TestContext) {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-cancel-execution-'));
  const store = createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    initializeLedger: { cards: [], annotations: [], relationships: [] },
  });
  const executions = createTaskExecutionRepository({
    store,
    writerId: 'workstation',
    projectId: 'project-a',
    now: () => new Date('2026-07-23T10:00:05.000Z'),
  });
  context.after(async () => {
    await store.flush();
    rmSync(root, { recursive: true, force: true });
  });
  return { executions, runtime: { taskExecutionNodeId: 'workstation', taskExecutionState: { executions } } as Record<string, unknown> };
}

test('terminally cancels a queued execution without requiring process identity', async (context) => {
  const { executions, runtime } = fixture(context);
  const settled: Array<Record<string, unknown>> = [];
  const scheduled: string[] = [];
  runtime.onCodexRunSettled = async (event: Record<string, unknown>) => { settled.push(event); };
  runtime.scheduleCodexProcesses = async () => { scheduled.push('scheduled'); };
  await executions.admit(metadata('queued', 'workstation'));
  await executions.transition('queued', { phase: 'queued' });

  const result = await cancelTaskExecution({ runtime, executionId: 'queued' });

  assert.equal(result.ok, true);
  assert.equal(result.phase, 'cancelled');
  assert.equal(result.finishedAt, '2026-07-23T10:00:05.000Z');
  assert.equal(executions.find('queued')?.lifecycle.phase, 'cancelled');
  assert.equal(executions.find('queued')?.lifecycle.finishedAt, result.finishedAt);
  assert.deepEqual(settled.map((event) => ({ status: event.status, finishedAt: event.finishedAt })), [{
    status: 'cancelled',
    finishedAt: result.finishedAt,
  }]);
  assert.deepEqual(scheduled, ['scheduled']);
});

test('persists cancelling before signalling the registered live process', async (context) => {
  const { executions, runtime } = fixture(context);
  await executions.admit(metadata('running', 'workstation'));
  await executions.transition('running', { phase: 'queued' });
  await executions.transition('running', { phase: 'starting' });
  await executions.transition('running', { phase: 'running' });
  let phaseWhenSignalled = '';
  let finishedAtWhenSignalled: string | null = null;
  const child = {
    pid: 0,
    exitCode: null as number | null,
    kill() {
      phaseWhenSignalled = executions.find('running')?.lifecycle.phase ?? '';
      finishedAtWhenSignalled = executions.find('running')?.lifecycle.finishedAt ?? null;
      this.exitCode = 0;
      return true;
    },
  } as unknown as ChildProcess;
  registerTaskExecutionProcess(runtime, {
    executionId: 'running',
    sessionId: 'session-running',
    child,
    processId: 0,
    processStartTime: '',
    startedAt: '2026-07-23T10:00:01.000Z',
    stdoutFile: '',
    stderrFile: '',
  });

  const result = await cancelTaskExecution({ runtime, executionId: 'running' });

  assert.equal(result.ok, true);
  assert.equal(result.phase, 'cancelling');
  assert.equal(result.finishedAt, '2026-07-23T10:00:05.000Z');
  assert.equal(phaseWhenSignalled, 'cancelling');
  assert.equal(finishedAtWhenSignalled, result.finishedAt);
  assert.equal(executions.find('running')?.lifecycle.phase, 'cancelling');
  assert.equal(executions.find('running')?.lifecycle.finishedAt, result.finishedAt);
});

test('routes cancellation to the immutable remote executor without mutating locally', async (context) => {
  const { executions, runtime } = fixture(context);
  await executions.admit(metadata('remote', 'phone'));
  await executions.transition('remote', { phase: 'queued' });
  runtime.routeTaskExecutionCancellation = async (executionId: string, executorNodeId: string) => ({
    ok: true,
    statusCode: 202,
    executionId,
    executorNodeId,
    phase: 'cancelled',
    revision: 3,
    cancellationRequested: true,
  });

  const result = await cancelTaskExecution({ runtime, executionId: 'remote' });

  assert.equal(result.executorNodeId, 'phone');
  assert.equal(result.phase, 'cancelled');
  assert.equal(executions.find('remote')?.lifecycle.phase, 'queued');
});
