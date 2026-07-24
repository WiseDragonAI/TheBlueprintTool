/**
 * WHAT: Admission coverage for authoritative operator-triggered thread executions.
 * WHY: Replicated execution state owns idempotency, phase, and live process cancellation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startThreadCodexProcessController, threadMarkdownForPrompt } from '@backend/business/codex/controller/start-thread-codex-process-controller.js';
import { readCardSkillRunController } from '@backend/business/codex/controller/read-card-skill-run-controller.js';
import { cancelCardSkillRunController } from '@backend/business/codex/controller/cancel-card-skill-run-controller.js';
import { createTaskExecutionRouter } from '@backend/business/codex/helper/task-execution-router.js';
import { taskExecutionProcess, taskExecutionProcesses } from '@backend/business/codex/helper/task-execution-runtime.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskExecutionMetadata } from '@backend/business/task-state/helper/task-current-state-types.js';
import type { TaskProjectionCommand } from '@backend/business/task-state/helper/task-mutation-command.js';

function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-authoritative-run-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardId = 'card-a';
  const threadId = `thread-${cardId}`;
  const runId = 'codex-skill-1784100000000-canonical';
  const executionId = 'execution-canonical';
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const cardRef = `.decision-os/cards/specs/${cardId}.md`;
  const threadRef = `.decision-os/threads/specs/${threadId}.md`;
  mkdirSync(join(decisionOsRoot, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'specs'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Authoritative Run Card',
      status: 'todo',
      comment: { contentFile: cardRef },
      facts: [],
      fields: [],
    }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { [threadId]: threadRef },
  }));
  writeFileSync(join(workspace, cardRef), '# Authoritative Run Card\n');
  writeFileSync(join(workspace, threadRef), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-15T08:10:40.966Z"} -->',
    '',
    'Run this thread now.',
    '',
  ].join('\n'));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    projectId: 'project-a',
    taskExecutionNodeId: 'workstation',
    taskExecutionState: state,
    readTaskLedgerProjection: () => state.projection().ledger,
    persistTaskLedgerProjection: (ledger: Record<string, unknown>, command: TaskProjectionCommand) => state.executeProjectionCommand(command, ledger),
    scheduleCodexProcesses: async () => ({ ok: true, launched: [] }),
  };
  runtime.taskExecutionRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => state,
    localNodeId: () => 'workstation',
    peer: () => null,
    localCapacity: () => 1,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  const request = {
    requestId: 'request-canonical',
    executionId,
    reservedRunId: runId,
    ledgerId: 'specs',
    threadId,
    cardId,
  };
  return { workspace, decisionOsRoot, ledgerPath, cardId, threadId, runId, executionId, state, runtime, request };
}

function executionMetadata(context: ReturnType<typeof fixture>): TaskExecutionMetadata {
  return {
    executionId: context.executionId,
    requestId: 'request-canonical',
    sessionId: context.runId,
    projectId: 'project-a',
    ledgerId: 'specs',
    taskId: '',
    sourceCardId: context.cardId,
    ownerCardId: context.cardId,
    kind: 'thread',
    requestedAt: '2026-07-23T10:00:00.000Z',
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
}

test('thread launch context excludes tombstoned notes that remain in the Markdown sidecar', async () => {
  const context = fixture();
  try {
    writeFileSync(join(context.decisionOsRoot, 'threads', 'specs', context.threadId + '.md'), [
      '# OPERATOR',
      '<!-- decision-os:note {"id":"note-deleted","timestamp":"2026-07-15T08:00:00.000Z"} -->',
      '',
      'Deleted operator text.',
      '',
      '# OPERATOR',
      '<!-- decision-os:note {"id":"note-live","timestamp":"2026-07-15T08:10:40.966Z"} -->',
      '',
      'Live operator text.',
      '',
    ].join('\n'));
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as Record<string, unknown>;
    ledger.deletedNoteIds = { [context.threadId]: ['note-deleted'] };

    const result = threadMarkdownForPrompt({ decisionOsRoot: context.decisionOsRoot, ledger, threadId: context.threadId });

    assert.ok(result);
    assert.doesNotMatch(result.markdown, /Deleted operator text/);
    assert.match(result.markdown, /Live operator text/);
    assert.equal(result.operatorNoteTimestamp, '2026-07-15T08:10:40.966Z');
  } finally {
    await context.state.flush();
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

async function cleanup(context: ReturnType<typeof fixture>): Promise<void> {
  for (const process of taskExecutionProcesses(context.runtime)) {
    try {
      process.child.kill('SIGKILL');
    } catch {
      // The execution already settled.
    }
  }
  await context.state.flush();
  rmSync(context.workspace, { recursive: true, force: true });
}

async function waitForCondition(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}.`);
}

test('repeated operator Run returns the already admitted queued execution', async () => {
  const context = fixture();
  try {
    const first = await startThreadCodexProcessController({
      action_payload: context.request,
      runtime_state: context.runtime,
    });
    const repeated = await startThreadCodexProcessController({
      action_payload: context.request,
      runtime_state: context.runtime,
    });

    assert.equal(first.ok, true);
    assert.equal(first.statusCode, 202);
    assert.equal(repeated.ok, true);
    assert.equal((repeated.run as Record<string, unknown>).id, context.runId);
    assert.equal((repeated.run as Record<string, unknown>).executionId, context.executionId);
    assert.equal(context.state.executions.find(context.executionId)?.lifecycle.phase, 'queued');
    assert.equal(context.state.executions.bySessionId(context.runId).length, 1);
    assert.equal(existsSync(join(context.decisionOsRoot, 'codex-process-queue.json')), false);
  } finally {
    await cleanup(context);
  }
});

test('repeated operator Run returns the already admitted running execution', async () => {
  const context = fixture();
  try {
    await startThreadCodexProcessController({
      action_payload: context.request,
      runtime_state: context.runtime,
    });
    await context.state.executions.transition(context.executionId, { phase: 'starting' });
    await context.state.executions.transition(context.executionId, { phase: 'running' });

    const repeated = await startThreadCodexProcessController({
      action_payload: context.request,
      runtime_state: context.runtime,
    });

    assert.equal(repeated.ok, true);
    assert.equal(repeated.statusCode, 202);
    assert.equal((repeated.run as Record<string, unknown>).id, context.runId);
    assert.equal((repeated.run as Record<string, unknown>).executionId, context.executionId);
    assert.equal(context.state.executions.find(context.executionId)?.lifecycle.phase, 'running');
    assert.equal(context.state.executions.bySessionId(context.runId).length, 1);
  } finally {
    await cleanup(context);
  }
});

test('turn lifecycle registers the exact execution child for cancellation', async () => {
  const context = fixture();
  const fakeCodex = join(context.workspace, 'fake-codex-live.mjs');
  const previousCodexBin = process.env.CODEX_BIN;
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'process.stdin.resume();',
    'process.stdin.on("end", () => {',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-live" }));',
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  setInterval(() => {}, 1000);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  await context.state.executions.admit({ metadata: executionMetadata(context), executorNodeId: 'workstation' });
  await context.state.executions.transition(context.executionId, { phase: 'queued' });
  await context.state.executions.transition(context.executionId, { phase: 'starting' });

  try {
    const result = await startThreadCodexProcessController({
      action_payload: {
        ...context.request,
        epoch4Dispatch: true,
      },
      runtime_state: context.runtime,
    });
    assert.equal(result.ok, true);
    const stdoutFile = String((result.run as Record<string, unknown>).stdoutFile ?? '');
    await waitForCondition(
      () => Boolean(stdoutFile && existsSync(stdoutFile) && readFileSync(stdoutFile, 'utf8').includes('turn.started')),
      'the turn.started event',
    );

    assert.equal(taskExecutionProcess(context.runtime, context.executionId)?.sessionId, context.runId);
    const cancellation = await cancelCardSkillRunController({
      action_payload: {
        ledgerId: 'specs',
        cardId: context.cardId,
        runId: context.runId,
        executionId: context.executionId,
      },
      runtime_state: context.runtime,
    });
    assert.equal(cancellation.ok, true);
    assert.equal(cancellation.statusCode, 202);
    assert.equal(cancellation.cancellationRequested, true);
    await waitForCondition(
      () => context.state.executions.find(context.executionId)?.lifecycle.phase === 'cancelled',
      'the cancelled execution to settle',
    );
  } finally {
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    await cleanup(context);
  }
});

test('terminal execution remains readable while immutable artifacts are finalizing', async () => {
  const context = fixture();
  const fakeCodex = join(context.workspace, 'fake-codex-complete.mjs');
  const previousCodexBin = process.env.CODEX_BIN;
  let releaseFinalization!: () => void;
  const finalizationGate = new Promise<void>((resolve) => {
    releaseFinalization = resolve;
  });
  let reportFinalization!: () => void;
  const finalizationStarted = new Promise<void>((resolve) => {
    reportFinalization = resolve;
  });
  const originalFinalize = context.state.finalizeExecutionArtifacts.bind(context.state);
  context.state.finalizeExecutionArtifacts = async (...args) => {
    reportFinalization();
    await finalizationGate;
    return originalFinalize(...args);
  };
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'process.stdin.resume();',
    'process.stdin.on("end", () => {',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-complete" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  await context.state.executions.admit({ metadata: executionMetadata(context), executorNodeId: 'workstation' });
  await context.state.executions.transition(context.executionId, { phase: 'queued' });
  await context.state.executions.transition(context.executionId, { phase: 'starting' });

  try {
    const result = await startThreadCodexProcessController({
      action_payload: {
        ...context.request,
        epoch4Dispatch: true,
      },
      runtime_state: context.runtime,
    });
    assert.equal(result.ok, true);
    await finalizationStarted;
    assert.equal(context.state.executions.find(context.executionId)?.lifecycle.phase, 'succeeded');
    assert.equal(taskExecutionProcess(context.runtime, context.executionId)?.sessionId, context.runId);

    const settling = await readCardSkillRunController({
      action_payload: {
        ledgerId: 'specs',
        cardId: context.cardId,
        runId: context.runId,
        since: 0,
      },
      runtime_state: context.runtime,
    });
    assert.equal(settling.ok, true);
    assert.equal(settling.phase, 'succeeded');
    assert.equal(settling.lineCount, 1);
    assert.equal((settling.events as Array<Record<string, unknown>>).length, 1);

    releaseFinalization();
    await waitForCondition(
      () => taskExecutionProcess(context.runtime, context.executionId) === null,
      'the settled process registration to be removed',
    );
    assert.ok(context.state.executions.find(context.executionId)?.artifacts.jsonl);
  } finally {
    releaseFinalization();
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    await cleanup(context);
  }
});
