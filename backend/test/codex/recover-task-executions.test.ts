/**
 * WHAT: Verifies the single epoch-4 recovery pass for local active and queued executions.
 * WHY: Startup recovery must use replicated execution state plus exact process identity without legacy queue ownership.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import { codexProcessIdentity } from '@backend/business/codex/helper/codex-process-identity.js';
import { recoverTaskExecutions } from '@backend/business/codex/helper/recover-task-executions.js';
import { registerTaskExecutionProcess, taskExecutionProcesses } from '@backend/business/codex/helper/task-execution-runtime.js';
import type { TaskExecutionMetadata } from '@backend/business/task-state/helper/task-current-state-types.js';

function metadata(executionId: string, requestedAt: string): TaskExecutionMetadata {
  return {
    executionId,
    requestId: `request-${executionId}`,
    sessionId: `session-${executionId}`,
    projectId: 'project-a',
    ledgerId: 'tasks',
    taskId: 'task-a',
    sourceCardId: 'task-a',
    ownerCardId: 'task-a',
    kind: 'thread',
    requestedAt,
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
}

test('recovery adopts an exact live process, interrupts a missing process, and wakes queued work', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-task-execution-recovery-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerFile = join(decisionOsRoot, 'tasks.json');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(ledgerFile, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: ledgerFile,
    initialize: true,
  });
  await state.executions.admit({ metadata: metadata('execution-adopted', '2026-07-23T01:00:00.000Z'), executorNodeId: 'workstation' });
  await state.executions.transition('execution-adopted', { phase: 'queued' });
  await state.executions.transition('execution-adopted', { phase: 'starting' });
  await state.executions.transition('execution-adopted', { phase: 'running' });
  await state.executions.admit({ metadata: metadata('execution-missing', '2026-07-23T01:01:00.000Z'), executorNodeId: 'workstation' });
  await state.executions.transition('execution-missing', { phase: 'queued' });
  await state.executions.transition('execution-missing', { phase: 'starting' });
  await state.executions.admit({ metadata: metadata('execution-stale', '2026-07-23T01:02:00.000Z'), executorNodeId: 'workstation' });
  await state.executions.transition('execution-stale', { phase: 'queued' });
  await state.executions.transition('execution-stale', { phase: 'starting' });
  await state.executions.transition('execution-stale', { phase: 'running' });
  await state.executions.admit({ metadata: metadata('execution-queued', '2026-07-23T01:03:00.000Z'), executorNodeId: 'workstation' });
  await state.executions.transition('execution-queued', { phase: 'queued' });

  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  context.after(() => {
    try { child.kill('SIGKILL'); } catch { /* already settled */ }
    rmSync(workspace, { recursive: true, force: true });
  });
  const processId = child.pid ?? 0;
  const scheduled: string[] = [];
  const runtime: Record<string, unknown> = {
    taskExecutionState: state,
    taskExecutionNodeId: 'workstation',
    taskExecutionProcesses: new Map(),
    scheduleCodexProcesses: async () => { scheduled.push('scheduled'); },
  };
  registerTaskExecutionProcess(runtime, {
    executionId: 'execution-adopted',
    sessionId: 'session-execution-adopted',
    child,
    processId,
    processStartTime: codexProcessIdentity(processId),
    startedAt: '2026-07-23T01:00:00.000Z',
    stdoutFile: '',
    stderrFile: '',
  });
  const staleStdout = join(decisionOsRoot, 'stale.jsonl');
  const staleStderr = join(decisionOsRoot, 'stale.log');
  writeFileSync(staleStdout, '{"type":"turn.started"}\n');
  writeFileSync(staleStderr, 'executor stopped\n');
  const staleChild = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  const staleProcessId = staleChild.pid ?? 0;
  const staleProcessStartTime = codexProcessIdentity(staleProcessId);
  await once(staleChild, 'exit');
  registerTaskExecutionProcess(runtime, {
    executionId: 'execution-stale',
    sessionId: 'session-execution-stale',
    child: staleChild,
    processId: staleProcessId,
    processStartTime: staleProcessStartTime,
    startedAt: '2026-07-23T01:02:00.000Z',
    stdoutFile: staleStdout,
    stderrFile: staleStderr,
  });

  const recovered = await recoverTaskExecutions(runtime);

  assert.deepEqual(recovered, {
    adopted: ['execution-adopted'],
    interrupted: ['execution-missing', 'execution-stale'],
    queued: ['execution-queued'],
    failed: [],
  });
  assert.equal(state.executions.find('execution-adopted')?.lifecycle.phase, 'running');
  assert.equal(state.executions.find('execution-missing')?.lifecycle.phase, 'interrupted');
  assert.equal(state.executions.find('execution-stale')?.lifecycle.phase, 'interrupted');
  assert.notEqual(state.executions.find('execution-stale')?.artifacts.jsonl, null);
  assert.notEqual(state.executions.find('execution-stale')?.artifacts.stderr, null);
  assert.deepEqual(taskExecutionProcesses(runtime).map((entry) => entry.executionId), ['execution-adopted']);
  assert.deepEqual(scheduled, ['scheduled']);
});
