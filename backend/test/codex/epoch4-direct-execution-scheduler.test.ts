/**
 * WHAT: Proves direct thread admission, claim, spawn, and settlement use only epoch-4 execution entities.
 * WHY: The direct queue and legacy execution document must not participate in a new launch.
 */
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { continueCardSkillRunController } from '@backend/business/codex/controller/continue-card-skill-run-controller.js';
import { startThreadCodexProcessController } from '@backend/business/codex/controller/start-thread-codex-process-controller.js';
import { scheduleCodexProcesses } from '@backend/business/codex/helper/codex-process-scheduler.js';
import { createTaskExecutionRouter } from '@backend/business/codex/helper/task-execution-router.js';
import { taskExecutionProcesses } from '@backend/business/codex/helper/task-execution-runtime.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskProjectionCommand } from '@backend/business/task-state/helper/task-mutation-command.js';

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}.`);
}

test('offline local direct retry spawns one child and reaches terminal replicated state without the legacy queue', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-epoch4-direct-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardId = 'card-a';
  const threadId = `thread-${cardId}`;
  const cardRef = `.decision-os/cards/tasks/${cardId}.md`;
  const threadRef = `.decision-os/threads/tasks/${threadId}.md`;
  const ledgerFile = join(decisionOsRoot, 'tasks.json');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const spawnMarker = join(workspace, 'fake-codex-spawns.txt');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(ledgerFile, JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Epoch 4 direct execution',
      status: 'todo',
      labels: ['master-task'],
      assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 },
      comment: { contentFile: cardRef },
    }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { [threadId]: threadRef },
  }));
  writeFileSync(join(workspace, cardRef), '# Epoch 4 direct execution\n');
  writeFileSync(join(workspace, threadRef), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-23T01:01:00.000Z"} -->',
    '',
    'Run from the replicated execution queue.',
  ].join('\n'));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync } from "node:fs";',
    `appendFileSync(${JSON.stringify(spawnMarker)}, "spawn\\n");`,
    'for await (const _chunk of process.stdin) {}',
    'console.log(JSON.stringify({ type: "thread.started", thread_id: "provider-session-a" }));',
    'console.log(JSON.stringify({ type: "item.completed", item: { id: "answer", type: "agent_message", text: "Completed epoch 4 direct execution." } }));',
    'console.log(JSON.stringify({ type: "turn.completed" }));',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: ledgerFile,
    initialize: true,
  });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    projectId: 'project-a',
    taskExecutionNodeId: 'workstation',
    federationNodeConnector: {
      status: () => ({ connected: false, peers: [] }),
      request: async () => { throw new Error('relay_unreachable'); },
    },
    decisionOsSettings: {
      maxConcurrentCodexProcesses: 1,
      codexBin: fakeCodex,
    },
    taskExecutionState: state,
    readTaskLedgerProjection: () => state.projection().ledger,
    persistTaskLedgerProjection: (ledger: Record<string, unknown>, command: TaskProjectionCommand) => state.executeProjectionCommand(command, ledger),
  };
  runtime.taskExecutionRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => state,
    localNodeId: () => 'workstation',
    peer: () => null,
    localCapacity: () => 1,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  context.after(async () => {
    for (const process of taskExecutionProcesses(runtime)) {
      try { process.child.kill('SIGKILL'); } catch { /* already settled */ }
    }
    await state.flush();
    rmSync(workspace, { recursive: true, force: true });
  });

  const admitted = await startThreadCodexProcessController({
    action_payload: {
      requestId: 'request-a',
      executionId: 'execution-a',
      ledgerId: 'tasks',
      threadId,
      cardId,
    },
    runtime_state: runtime,
  });

  assert.equal(admitted.statusCode, 202);
  assert.equal(state.executions.find('execution-a')?.lifecycle.phase, 'queued');
  assert.equal(existsSync(join(decisionOsRoot, 'codex-process-queue.json')), false);
  assert.equal(existsSync(join(decisionOsRoot, 'codex-executions.json')), false);
  const retried = await startThreadCodexProcessController({
    action_payload: {
      requestId: 'request-a',
      executionId: 'execution-a',
      ledgerId: 'tasks',
      threadId,
      cardId,
    },
    runtime_state: runtime,
  });
  assert.equal((retried.run as Record<string, unknown>).executionId, 'execution-a');
  assert.equal(state.executions.byTaskId(cardId).length, 1);

  const scheduled = await scheduleCodexProcesses({ decisionOsRoot, runtime, launchLimit: 1 });
  assert.equal(scheduled.ok, true);
  await waitFor(() => state.executions.find('execution-a')?.lifecycle.phase === 'succeeded', 'terminal execution state');
  // Lifecycle settlement precedes immutable artifact-head capture. Continuation is
  // admitted only after that canonical barrier so it cannot mutate files mid-hash.
  await waitFor(() => {
    const execution = state.executions.find('execution-a');
    return execution?.artifacts.revision > 1
      && execution.artifacts.jsonl !== null
      && execution.artifacts.stderr !== null;
  }, 'terminal execution artifacts');

  assert.equal(state.executions.find('execution-a')?.lifecycle.result?.status, 'succeeded');
  assert.equal(readFileSync(spawnMarker, 'utf8').trim().split('\n').length, 1);
  assert.deepEqual(taskExecutionProcesses(runtime), []);
  assert.equal(existsSync(join(decisionOsRoot, 'codex-process-queue.json')), false);
  assert.equal(existsSync(join(decisionOsRoot, 'codex-executions.json')), false);

  appendFileSync(join(workspace, threadRef), [
    '',
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-b","timestamp":"2026-07-23T01:02:00.000Z"} -->',
    '',
    'Continue the same session.',
  ].join('\n'));
  const continued = await continueCardSkillRunController({
    action_payload: {
      requestId: 'request-b',
      executionId: 'execution-b',
      ledgerId: 'tasks',
      cardId,
      runId: String((admitted.run as Record<string, unknown>).id),
    },
    runtime_state: runtime,
  });
  assert.equal(continued.statusCode, 202, JSON.stringify(continued));
  assert.equal(state.executions.find('execution-b')?.metadata.kind, 'continuation');
  assert.equal(state.executions.find('execution-b')?.metadata.sessionId, (admitted.run as Record<string, unknown>).id);
  assert.equal(state.executions.find('execution-b')?.lifecycle.phase, 'queued');

  const continuationSchedule = await scheduleCodexProcesses({ decisionOsRoot, runtime, launchLimit: 1 });
  assert.equal(continuationSchedule.ok, true);
  await waitFor(() => state.executions.find('execution-b')?.lifecycle.phase === 'succeeded', 'terminal continuation state');
  await waitFor(() => {
    const execution = state.executions.find('execution-b');
    return execution?.artifacts.revision > 1
      && execution.artifacts.jsonl !== null
      && execution.artifacts.stderr !== null
      && taskExecutionProcesses(runtime).length === 0;
  }, 'terminal continuation artifacts and process cleanup');
  assert.deepEqual(taskExecutionProcesses(runtime), []);
  assert.equal(existsSync(join(decisionOsRoot, 'codex-process-queue.json')), false);
});

test('direct dispatch failure settles only its execution and leaves the scheduler usable', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-epoch4-direct-failure-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerFile = join(decisionOsRoot, 'tasks.json');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(ledgerFile, JSON.stringify({
    cards: [{
      id: 'task-a',
      title: 'Unaffected task',
      status: 'todo',
      labels: ['master-task'],
      assignment: { nodeId: 'workstation', changedAt: '2026-07-23T02:00:00.000Z', revision: 1 },
    }],
    annotations: [],
    relationships: [],
  }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: ledgerFile,
    initialize: true,
  });
  const incidents: Array<Record<string, unknown>> = [];
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    projectId: 'project-a',
    decisionOsSettings: { federationNodeId: 'workstation', maxConcurrentCodexProcesses: 1 },
    taskExecutionState: state,
    readTaskLedgerProjection: () => state.projection().ledger,
    persistTaskLedgerProjection: (ledger: Record<string, unknown>, command: TaskProjectionCommand) => state.executeProjectionCommand(command, ledger),
    onCodexBackgroundError: (incident: Record<string, unknown>) => incidents.push(incident),
  };
  context.after(async () => {
    await state.flush();
    rmSync(workspace, { recursive: true, force: true });
  });

  await state.executions.admit({
    metadata: {
      executionId: 'execution-missing-card',
      requestId: 'request-missing-card',
      sessionId: 'session-missing-card',
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'task-a',
      sourceCardId: 'missing-card',
      ownerCardId: 'missing-card',
      kind: 'thread',
      requestedAt: '2026-07-23T02:01:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    executorNodeId: 'workstation',
  });
  await state.executions.transition('execution-missing-card', { phase: 'queued' });

  const result = await scheduleCodexProcesses({ decisionOsRoot, runtime, launchLimit: 1 });
  assert.equal(result.ok, false);
  assert.equal(state.executions.find('execution-missing-card')?.lifecycle.phase, 'failed');
  assert.equal(state.executions.find('execution-missing-card')?.lifecycle.error?.code, 'task_execution_dispatch_failed');
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].operation, 'task-execution-dispatch-failed');
  assert.deepEqual(taskExecutionProcesses(runtime), []);
  assert.equal(existsSync(join(decisionOsRoot, 'codex-process-queue.json')), false);

  const emptyPass = await scheduleCodexProcesses({ decisionOsRoot, runtime, launchLimit: 1 });
  assert.deepEqual(emptyPass.launched, []);
  assert.equal(emptyPass.ok, true);
});

test('running-state persistence failure after spawn kills the child and settles only that execution', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-epoch4-running-persist-failure-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerFile = join(decisionOsRoot, 'tasks.json');
  const cardRef = '.decision-os/cards/tasks/card-a.md';
  const threadRef = '.decision-os/threads/tasks/thread-card-a.md';
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(ledgerFile, JSON.stringify({
    cards: [{
      id: 'card-a',
      title: 'Running persistence failure',
      status: 'todo',
      labels: ['master-task'],
      assignment: { nodeId: 'workstation', changedAt: '2026-07-23T03:00:00.000Z', revision: 1 },
      comment: { contentFile: cardRef },
    }],
    annotations: [],
    relationships: [],
    threadFiles: { 'thread-card-a': threadRef },
  }));
  writeFileSync(join(workspace, cardRef), '# Running persistence failure\n');
  writeFileSync(join(workspace, threadRef), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-23T03:01:00.000Z"} -->',
    '',
    'Start the child before the injected durable transition failure.',
  ].join('\n'));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'for await (const _chunk of process.stdin) {}',
    'setInterval(() => undefined, 1000);',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: ledgerFile,
    initialize: true,
  });
  const incidents: Array<Record<string, unknown>> = [];
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    projectId: 'project-a',
    taskExecutionNodeId: 'workstation',
    decisionOsSettings: {
      federationNodeId: 'workstation',
      maxConcurrentCodexProcesses: 1,
      codexBin: fakeCodex,
    },
    taskExecutionState: state,
    readTaskLedgerProjection: () => state.projection().ledger,
    persistTaskLedgerProjection: (ledger: Record<string, unknown>, command: TaskProjectionCommand) => state.executeProjectionCommand(command, ledger),
    onCodexBackgroundError: (incident: Record<string, unknown>) => incidents.push(incident),
  };
  runtime.taskExecutionRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => state,
    localNodeId: () => 'workstation',
    peer: () => null,
    localCapacity: () => 1,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  const transition = state.executions.transition;
  let spawnedProcess: ReturnType<typeof taskExecutionProcesses>[number] | undefined;
  state.executions.transition = async (...args: Parameters<typeof transition>) => {
    if (args[1].phase === 'running') {
      spawnedProcess = taskExecutionProcesses(runtime)[0];
      throw new Error('injected_running_state_persistence_failure');
    }
    return transition(...args);
  };
  context.after(async () => {
    for (const process of taskExecutionProcesses(runtime)) {
      try { process.child.kill('SIGKILL'); } catch { /* already settled */ }
    }
    await state.flush();
    rmSync(workspace, { recursive: true, force: true });
  });

  const admitted = await startThreadCodexProcessController({
    action_payload: {
      requestId: 'request-running-persist-failure',
      executionId: 'execution-running-persist-failure',
      ledgerId: 'tasks',
      threadId: 'thread-card-a',
      cardId: 'card-a',
    },
    runtime_state: runtime,
  });
  assert.equal(admitted.statusCode, 202);

  const result = await scheduleCodexProcesses({ decisionOsRoot, runtime, launchLimit: 1 });
  assert.equal(result.ok, false);
  assert.ok(spawnedProcess);
  await waitFor(
    () => spawnedProcess?.child.exitCode !== null || spawnedProcess?.child.signalCode !== null,
    'spawned child termination',
  );
  assert.equal(spawnedProcess.child.signalCode, 'SIGKILL');
  assert.deepEqual(taskExecutionProcesses(runtime), []);
  const execution = state.executions.find('execution-running-persist-failure');
  assert.equal(execution?.lifecycle.phase, 'failed');
  assert.equal(execution?.lifecycle.error?.code, 'task_execution_dispatch_failed');
  assert.equal(execution?.lifecycle.error?.message, 'injected_running_state_persistence_failure');
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].operation, 'task-execution-dispatch-failed');
  assert.deepEqual(incidents[0].context, {
    executionId: 'execution-running-persist-failure',
    taskId: 'card-a',
    sessionId: (admitted.run as Record<string, unknown>).id,
  });

  const nextPass = await scheduleCodexProcesses({ decisionOsRoot, runtime, launchLimit: 1 });
  assert.equal(nextPass.ok, true);
  assert.deepEqual(nextPass.launched, []);
});
