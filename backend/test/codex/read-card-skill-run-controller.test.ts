/**
 * WHAT: Behavioral coverage for observational Codex run status reads.
 * WHY: Repeated polling must report progress without rewriting ledger, thread, or event-stream state.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { ChildProcess } from 'node:child_process';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { readCardSkillRunController } from '@backend/business/codex/controller/read-card-skill-run-controller.js';
import { registerTaskExecutionProcess, removeTaskExecutionProcess, taskExecutionState } from '@backend/business/codex/helper/task-execution-runtime.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskExecutionMetadata } from '@backend/business/task-state/helper/task-current-state-types.js';

async function waitForText(file: string, text: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if (existsSync(file) && readFileSync(file, 'utf8').includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${text} in ${file}`);
}

function runExecutionMetadata(input: {
  executionId: string;
  runId: string;
  cardId: string;
  requestedAt: string;
  kind?: 'thread' | 'pipeline-skill';
  model?: string | null;
  effort?: string | null;
}): TaskExecutionMetadata {
  const pipelineSkill = input.kind === 'pipeline-skill';
  return {
    executionId: input.executionId,
    requestId: `request-${input.executionId}`,
    sessionId: input.runId,
    projectId: 'local',
    ledgerId: 'specs',
    taskId: input.cardId,
    sourceCardId: input.cardId,
    ownerCardId: input.cardId,
    kind: input.kind ?? 'thread',
    requestedAt: input.requestedAt,
    model: input.model ?? null,
    effort: input.effort ?? null,
    pipelineRunId: pipelineSkill ? `pipeline-${input.runId}` : null,
    pipelineStepId: pipelineSkill ? 'step-a' : null,
    pipelineSkillRunId: pipelineSkill ? input.runId : null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
}

async function seedExecution(input: {
  runtime: Record<string, unknown>;
  metadata: TaskExecutionMetadata;
  phase: 'running' | 'succeeded' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  stdoutFile: string;
  stderrFile: string;
  error?: { code: string; message: string };
}): Promise<void> {
  const state = taskExecutionState(input.runtime);
  assert.ok(state);
  const metadata = { ...input.metadata, projectId: state.store.activeDelta().projectId };
  await state.executions.admit({ metadata, executorNodeId: 'local' });
  await state.executions.transition(input.metadata.executionId, { phase: 'queued', changedAt: input.startedAt });
  await state.executions.transition(input.metadata.executionId, { phase: 'starting', changedAt: input.startedAt });
  await state.executions.transition(input.metadata.executionId, { phase: 'running', changedAt: input.startedAt });
  if (input.phase === 'running') {
    registerTaskExecutionProcess(input.runtime, {
      executionId: input.metadata.executionId,
      sessionId: input.metadata.sessionId,
      child: { pid: process.pid, exitCode: null, killed: false } as unknown as ChildProcess,
      processId: process.pid,
      processStartTime: '',
      startedAt: input.startedAt,
      stdoutFile: input.stdoutFile,
      stderrFile: input.stderrFile,
    });
    return;
  }
  await state.executions.transition(input.metadata.executionId, {
    phase: input.phase,
    changedAt: input.finishedAt ?? new Date().toISOString(),
    ...(input.phase === 'failed' ? { error: input.error ?? { code: 'codex_execution_failed', message: 'Codex execution failed.' } } : {}),
    ...(input.phase === 'succeeded' ? { result: { status: 'succeeded' as const, summary: 'Codex execution completed.' } } : {}),
    ...(input.phase === 'cancelled' ? { result: { status: 'cancelled' as const, summary: 'Cancelled by operator.' } } : {}),
  });
  await state.finalizeExecutionArtifacts(input.metadata.executionId, {
    jsonl: input.stdoutFile,
    stderr: input.stderrFile,
  });
}

test('status read ignores a stale runtime execution when a newer queued execution owns the card lease', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-execution-fence-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const runId = `codex-skill-${Date.now() - 60000}-execfence`;
  const cardId = 'card-execution-fence';
  const runDirectory = join(decisionOsRoot, 'runs', 'codex-skills', 'specs');
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Execution fence',
      codexThreadRunId: runId,
      codexThreadRunIds: [runId],
      codexActiveRunId: runId,
      codexActiveExecutionId: 'execution-new',
      codexThreadRunOutputFile: `.decision-os/runs/codex-skills/specs/${runId}.md`,
      comment: { what: 'Execution fence body.' },
      facts: [],
      fields: [],
    }],
    annotations: [],
    relationships: [],
    notes: {},
  }));
  writeFileSync(join(runDirectory, `${runId}.md`), '# Previous execution\n');
  writeFileSync(join(runDirectory, `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started', thread_id: 'session-execution-fence' }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(join(runDirectory, `${runId}.log`), [
    `decision-os:codex-run-segment ${JSON.stringify({ runId, executionId: 'execution-old', startedAt: new Date(Date.now() - 60000).toISOString(), segment: 'start', startLine: 0 })}`,
    `decision-os:codex-execution-finished ${JSON.stringify({ runId, executionId: 'execution-old', finishedAt: new Date(Date.now() - 30000).toISOString(), status: 'complete' })}`,
  ].join('\n'));
  const taskState = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'local',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'specs.json'),
    initialize: true,
  });
  const executionMetadata = (executionId: string, requestedAt: string): TaskExecutionMetadata => ({
    executionId,
    requestId: `request-${executionId}`,
    sessionId: runId,
    projectId: 'project-a',
    ledgerId: 'specs',
    taskId: cardId,
    sourceCardId: cardId,
    ownerCardId: cardId,
    kind: 'thread',
    requestedAt,
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  });
  await taskState.executions.admit({
    metadata: executionMetadata('execution-old', new Date(Date.now() - 60_000).toISOString()),
    executorNodeId: 'local',
  });
  await taskState.executions.transition('execution-old', { phase: 'succeeded', result: { status: 'succeeded', summary: 'Prior execution complete.' } });
  await taskState.executions.admit({
    metadata: executionMetadata('execution-new', new Date().toISOString()),
    executorNodeId: 'local',
  });
  await taskState.executions.transition('execution-new', { phase: 'queued' });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    taskExecutionState: taskState,
    codexSkillRuns: {
      [runId]: {
        id: runId,
        executionId: 'execution-old',
        status: 'running',
        startedAt: new Date(Date.now() - 60000).toISOString(),
        child: { pid: process.pid, exitCode: null, killed: false },
      },
    },
  };

  try {
    const result = await readCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId, runId },
      runtime_state: runtime,
    });
    assert.equal(result.ok, true);
    assert.equal(result.executionId, 'execution-new');
    assert.equal(result.status, 'pending');
    assert.equal(result.active, false);
    assert.equal(result.queuePosition, 1);
  } finally {
    await taskState.flush();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('thread-launched run reads return chronological diagnostics without changing the conversation', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-thread-skill-run-'));
  const startedAt = Date.now() - 600000;
  const completedAt = new Date(startedAt + 90000);
  const runId = `codex-skill-${startedAt}-feed1234`;
  const latestRunId = `codex-skill-${startedAt + 120000}-latest12`;
  const cardId = 'card-thread-run';
  const threadId = `thread-${cardId}`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'threads', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Thread target',
      codexThreadRunId: latestRunId,
      codexThreadRunIds: [runId, latestRunId],
      comment: { what: 'Thread target body.' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { [threadId]: `.decision-os/threads/specs/${threadId}.md` }
  }, null, 2));
  const threadPath = join(workspace, '.decision-os', 'threads', 'specs', `${threadId}.md`);
  writeFileSync(threadPath, [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-operator-1","timestamp":"2026-07-10T00:00:00.000Z"} -->',
    '',
    'Please inspect this thread.',
    '',
    '# AGENT',
    '<!-- decision-os:note {"id":"note-agent-final","timestamp":"2026-07-10T00:01:00.000Z"} -->',
    '',
    'The scoped final answer remains the only agent reply.',
  ].join('\n'));
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'think-1', type: 'reasoning', text: 'Inspecting the scoped files.' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: 'Interim progress remains log data.' } }),
    JSON.stringify({ type: 'item.started', item: { id: 'cmd-1', type: 'command_execution', command: 'rg TODO', aggregated_output: '', exit_code: null, status: 'in_progress' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'rg TODO', aggregated_output: 'found TODO', exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'pwd', aggregated_output: workspace, exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'file-1', type: 'file_change', changes: [{ path: 'result.md', kind: 'updated' }], status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'warn-1', type: 'warning', message: 'A recoverable warning.' } }),
    JSON.stringify({ type: 'error', message: 'Reconnecting... 2/5 (request timed out)' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'error-1', type: 'error', message: 'A non-terminal tool error.' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(logPath, [
    `decision-os:codex-run-segment ${JSON.stringify({ runId, startedAt: new Date(startedAt).toISOString(), segment: 'start', metadata: { sourceCardTitle: 'Thread target', sourceThreadId: threadId, codexModel: 'gpt-5.5', codexEffort: 'xhigh' } })}`,
    'WARNING retry budget is low',
    'Reconnecting transport after request timed out',
  ].join('\n'));
  utimesSync(jsonlPath, completedAt, completedAt);
  utimesSync(logPath, completedAt, completedAt);

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const ledgerPath = join(workspace, '.decision-os', 'specs.json');
  await seedExecution({
    runtime,
    metadata: runExecutionMetadata({
      executionId: 'execution-thread-feed',
      runId,
      cardId,
      requestedAt: new Date(startedAt).toISOString(),
      model: 'gpt-5.5',
      effort: 'xhigh',
    }),
    phase: 'succeeded',
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: completedAt.toISOString(),
    stdoutFile: jsonlPath,
    stderrFile: logPath,
  });

  try {
    const ledgerBefore = readFileSync(ledgerPath, 'utf8');
    const threadBefore = readFileSync(threadPath, 'utf8');
    const ledgerMtimeBefore = statSync(ledgerPath).mtimeMs;
    const threadMtimeBefore = statSync(threadPath).mtimeMs;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${cardId}&since=2`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      ok: boolean;
      active: boolean;
      runKind: string;
      status: string;
      lineCount: number;
      nextSince: number;
      elapsedMs: number;
      toolCallCount: number;
      agentMessageCount: number;
      fileChangeCount: number;
      thinkingCount: number;
      warningCount: number;
      errorCount: number;
      transportStatus: string;
      metadata: { sourceCardTitle: string; sourceThreadId: string; codexModel: string; codexEffort: string };
      events: Array<{ line: number; source: string; sourceLine: number; kind: string; itemId: string; output: string; severity: string }>;
      diagnostics: Array<{ source: string; sourceLine: number; kind: string; text: string; status: string }>;
      persistedEventCount: number;
    };
    assert.equal(body.ok, true);
    assert.equal(body.active, false);
    assert.equal(body.runKind, 'thread');
    assert.equal(body.status, 'complete');
    assert.equal(body.lineCount, 12);
    assert.equal(body.nextSince, 12);
    assert.ok(body.elapsedMs >= 89000 && body.elapsedMs <= 91000);
    assert.equal(body.toolCallCount, 3);
    assert.equal(body.agentMessageCount, 1);
    assert.equal(body.fileChangeCount, 1);
    assert.equal(body.thinkingCount, 1);
    assert.equal(body.warningCount, 2);
    assert.deepEqual({
      errorCount: body.errorCount,
      eventErrors: body.events.filter((event) => event.kind === 'error').map((event) => `${event.source}:${event.sourceLine}`),
      diagnosticErrors: body.diagnostics.filter((event) => event.kind === 'error').map((event) => `${event.source}:${event.sourceLine}`),
    }, { errorCount: 1, eventErrors: ['jsonl:11'], diagnosticErrors: [] });
    assert.equal(body.transportStatus, 'degraded');
    assert.equal(body.persistedEventCount, 0);
    assert.deepEqual(body.metadata, { sourceCardTitle: 'Thread target', sourceThreadId: threadId, codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
    assert.deepEqual(body.events.map((event) => event.line), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(body.events.map((event) => event.kind), ['thinking', 'agent_message', 'tool_call', 'tool_call', 'tool_call', 'tool_call', 'warning', 'transport', 'error', 'run_status']);
    assert.deepEqual(body.events.filter((event) => event.itemId === 'cmd-1').map((event) => event.line), [5, 6]);
    assert.equal(body.events.find((event) => event.line === 6)?.output, 'found TODO');
    assert.equal(body.events.every((event) => event.source === 'jsonl' && event.sourceLine === event.line), true);
    assert.deepEqual(body.diagnostics.map((event) => event.kind), ['warning', 'transport']);
    assert.equal(body.diagnostics.every((event) => event.source === 'stderr'), true);

    const repeatedResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${cardId}&since=12`);
    assert.equal(repeatedResponse.status, 200);
    const repeated = await repeatedResponse.json() as { nextSince: number; persistedEventCount: number; events: unknown[] };
    assert.equal(repeated.nextSince, 12);
    assert.equal(repeated.persistedEventCount, 0);
    assert.deepEqual(repeated.events, []);
    assert.equal(readFileSync(ledgerPath, 'utf8'), ledgerBefore);
    assert.equal(readFileSync(threadPath, 'utf8'), threadBefore);
    assert.equal(statSync(ledgerPath).mtimeMs, ledgerMtimeBefore);
    assert.equal(statSync(threadPath).mtimeMs, threadMtimeBefore);
    assert.match(threadBefore, /# OPERATOR[\s\S]*# AGENT[\s\S]*The scoped final answer/);
    assert.doesNotMatch(threadBefore, /codexRunId|Codex turn completed|Tool call/);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill run route returns command output containing thread markdown as one event without writing a thread artifact', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-fenced-output-'));
  const startedAt = Date.now() - 600000;
  const runId = `codex-skill-${startedAt}-fenced1`;
  const outputCardId = `card-${runId}`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: outputCardId,
      title: 'Skill Result',
      cardType: 'codex-skill-run',
      comment: { what: `Codex run: ${runId}` },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  const capturedThread = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"embedded-operator","timestamp":"2026-07-08T00:00:00.000Z"} -->',
    '',
    'Embedded operator text.',
    '',
    '```markdown',
    '# AGENT',
    'Nested fenced heading.',
    '```',
  ].join('\n');
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'sed thread.md', aggregated_output: capturedThread, exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(logPath, '');

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  await seedExecution({
    runtime,
    metadata: runExecutionMetadata({
      executionId: 'execution-fenced-output',
      runId,
      cardId: outputCardId,
      requestedAt: new Date(startedAt).toISOString(),
      kind: 'pipeline-skill',
    }),
    phase: 'succeeded',
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(startedAt + 60_000).toISOString(),
    stdoutFile: jsonlPath,
    stderrFile: logPath,
  });

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      persistedEventCount: number;
      events: Array<{ line: number; kind: string; text: string }>;
    };
    assert.equal(body.persistedEventCount, 0);
    const commandEvent = body.events.find((event) => event.line === 2);
    assert.equal(commandEvent?.kind, 'tool_call');
    assert.match(String(commandEvent?.text ?? ''), /````text\n# OPERATOR/);
    assert.match(String(commandEvent?.text ?? ''), /```markdown\n# AGENT/);
    const threadPath = join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`);
    assert.equal(existsSync(threadPath), false);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill run route infers status from the latest continued JSONL segment and ignores a non-fatal model refresh timeout', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-continued-'));
  const startedAt = Date.now() - 600000;
  const runId = `codex-skill-${startedAt}-feed9876`;
  const outputCardId = `card-${runId}`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: outputCardId,
      title: 'Skill Result',
      cardType: 'codex-skill-run',
      comment: { what: `Codex run: ${runId}` },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.completed' }),
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.started' }),
  ].join('\n'));
  writeFileSync(logPath, '');
  const fresh = new Date();
  utimesSync(jsonlPath, fresh, fresh);
  utimesSync(logPath, new Date(startedAt), new Date(startedAt));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const runningExecutionId = 'execution-continued-running';
  await seedExecution({
    runtime,
    metadata: runExecutionMetadata({
      executionId: runningExecutionId,
      runId,
      cardId: outputCardId,
      requestedAt: new Date(startedAt).toISOString(),
      kind: 'pipeline-skill',
    }),
    phase: 'running',
    startedAt: new Date(startedAt).toISOString(),
    stdoutFile: jsonlPath,
    stderrFile: logPath,
  });

  try {
    const runningResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(runningResponse.status, 200);
    const running = await runningResponse.json() as { ok: boolean; status: string; lineCount: number; persistedEventCount: number; events: Array<{ line: number; type: string; text: string }> };
    assert.equal(running.ok, true);
    assert.equal(running.status, 'running');
    assert.equal(running.lineCount, 4);
    assert.equal(running.persistedEventCount, 0);
    assert.deepEqual(running.events.at(-1), {
      line: 4,
      source: 'jsonl',
      sourceLine: 4,
      type: 'turn.started',
      kind: 'run_status',
      title: 'Turn started',
      text: 'Codex turn started.',
      status: 'running',
      itemId: '',
      tool: '',
      output: '',
      exitCode: '',
      severity: 'info',
      persist: true,
    });
    const threadPath = join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`);
    assert.equal(existsSync(threadPath), false);

    const modelRefreshDiagnostic = '2026-07-10T13:03:18.970080Z ERROR codex_models_manager::manager: failed to refresh available models: timeout waiting for child process to exit';
    writeFileSync(logPath, `${modelRefreshDiagnostic}\n`);
    const diagnosticAt = new Date(Date.now() + 5);
    utimesSync(logPath, diagnosticAt, diagnosticAt);
    const nonFatalDiagnosticResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(nonFatalDiagnosticResponse.status, 200);
    const nonFatalDiagnostic = await nonFatalDiagnosticResponse.json() as {
      ok: boolean;
      status: string;
      errorCount: number;
      diagnostics: Array<{ kind: string; text: string }>;
    };
    assert.equal(nonFatalDiagnostic.ok, true);
    assert.equal(nonFatalDiagnostic.status, 'running');
    assert.equal(nonFatalDiagnostic.errorCount, 0);
    assert.deepEqual(nonFatalDiagnostic.diagnostics, []);
    assert.match(readFileSync(logPath, 'utf8'), /codex_models_manager::manager: failed to refresh available models/);

    const patchVerificationDiagnostic = [
      '2026-07-12T07:43:52.933040Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in thread.md:',
      'import { readFile } from \'node:fs/promises\';',
    ].join('\n');
    writeFileSync(logPath, `${patchVerificationDiagnostic}\n`);
    const patchDiagnosticAt = new Date(Date.now() + 7);
    utimesSync(logPath, patchDiagnosticAt, patchDiagnosticAt);
    const patchDiagnosticResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(patchDiagnosticResponse.status, 200);
    const patchDiagnostic = await patchDiagnosticResponse.json() as { status: string; errorCount: number; diagnostics: unknown[] };
    assert.equal(patchDiagnostic.status, 'running');
    assert.equal(patchDiagnostic.errorCount, 0);
    assert.deepEqual(patchDiagnostic.diagnostics, []);
    assert.match(readFileSync(logPath, 'utf8'), /apply_patch verification failed/);

    writeFileSync(logPath, 'Codex run cancelled: terminated by operator\n');
    const cancelledAt = new Date();
    utimesSync(logPath, cancelledAt, cancelledAt);
    const executionState = taskExecutionState(runtime)!;
    await executionState.executions.transition(runningExecutionId, {
      phase: 'cancelled',
      changedAt: cancelledAt.toISOString(),
      result: { status: 'cancelled', summary: 'Cancelled by operator.' },
    });
    removeTaskExecutionProcess(runtime, runningExecutionId);
    await executionState.finalizeExecutionArtifacts(runningExecutionId, { jsonl: jsonlPath, stderr: logPath });
    const cancelledResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(cancelledResponse.status, 200);
    const cancelled = await cancelledResponse.json() as { ok: boolean; status: string; lineCount: number };
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.lineCount, 4);
    assert.equal(existsSync(threadPath), false);

    writeFileSync(logPath, 'spawn failed: ENOENT while starting Codex\n');
    const failedAt = new Date(Date.now() + 10);
    utimesSync(logPath, failedAt, failedAt);
    await seedExecution({
      runtime,
      metadata: runExecutionMetadata({
        executionId: 'execution-continued-failed',
        runId,
        cardId: outputCardId,
        requestedAt: failedAt.toISOString(),
        kind: 'pipeline-skill',
      }),
      phase: 'failed',
      startedAt: failedAt.toISOString(),
      finishedAt: new Date(failedAt.getTime() + 1).toISOString(),
      stdoutFile: jsonlPath,
      stderrFile: logPath,
      error: { code: 'codex_spawn_failed', message: 'spawn failed: ENOENT while starting Codex' },
    });
    const failedResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(failedResponse.status, 200);
    const failed = await failedResponse.json() as { ok: boolean; status: string; errorCount: number; diagnostics: Array<{ kind: string; text: string }> };
    assert.equal(failed.ok, true);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.errorCount, 1);
    assert.deepEqual(failed.diagnostics.map((event) => event.kind), ['error']);
    assert.match(failed.diagnostics[0]?.text ?? '', /ENOENT/);
    assert.equal(existsSync(threadPath), false);

    const multilineCommandRejection = [
      '2026-07-18T05:48:47.327650Z ERROR codex_core::tools::router: error=exec_command failed for a multiline command:',
      'trap \'rm -f "$plan_json"\' EXIT',
      'jq -n \'{',
      '  masterCardId: "card-sync",',
      '  title: "Agent-authorized production database sync"',
      '}\'',
      'rejected: rm -f style commands are not permitted',
    ].join('\n');
    writeFileSync(logPath, `${multilineCommandRejection}\n`);
    const multilineDiagnosticAt = new Date(Date.now() + 15);
    utimesSync(logPath, multilineDiagnosticAt, multilineDiagnosticAt);
    await seedExecution({
      runtime,
      metadata: runExecutionMetadata({
        executionId: 'execution-continued-command-rejected',
        runId,
        cardId: outputCardId,
        requestedAt: multilineDiagnosticAt.toISOString(),
        kind: 'pipeline-skill',
      }),
      phase: 'failed',
      startedAt: multilineDiagnosticAt.toISOString(),
      finishedAt: new Date(multilineDiagnosticAt.getTime() + 1).toISOString(),
      stdoutFile: jsonlPath,
      stderrFile: logPath,
      error: { code: 'codex_command_rejected', message: multilineCommandRejection },
    });
    const multilineDiagnosticResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(multilineDiagnosticResponse.status, 200);
    const multilineDiagnostic = await multilineDiagnosticResponse.json() as { status: string; errorCount: number; diagnostics: Array<{ kind: string; title: string; text: string }> };
    assert.equal(multilineDiagnostic.status, 'failed');
    assert.equal(multilineDiagnostic.errorCount, 1);
    assert.equal(multilineDiagnostic.diagnostics.length, 1);
    assert.equal(multilineDiagnostic.diagnostics[0]?.kind, 'error');
    assert.equal(multilineDiagnostic.diagnostics[0]?.title, 'Error');
    assert.equal(multilineDiagnostic.diagnostics[0]?.text, multilineCommandRejection);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill continue route excludes codex artifact notes from resumed prompt', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-continue-filter-'));
  const runStartedAt = Date.now() - 600000;
  const runId = `codex-skill-${runStartedAt}-contflt`;
  const cardId = 'card-a';
  const fakeCodex = join(workspace, 'fake-codex-resume.mjs');
  const inputFile = join(workspace, 'resume-input.txt');
  const runSummaryRef = `.decision-os/runs/codex-skills/specs/${runId}.md`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Thread Card',
      codexThreadRunId: runId,
      codexThreadRunOutputFile: runSummaryRef,
      comment: { what: 'Card body' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {
      'thread-card-a': [
        {
          id: `codex-${runId}-line-1`,
          role: 'agent',
          message: 'Codex thread started.',
          timestamp: '2026-07-08T00:00:00.000Z',
          codexRunId: runId,
          codexLine: '1',
          codexKind: 'run_status',
          codexEventType: 'thread.started'
        },
        {
          id: `codex-${runId}-line-2`,
          role: 'agent',
          message: 'Codex turn completed.',
          timestamp: '2026-07-08T00:01:00.000Z',
          codexRunId: runId,
          codexLine: '2',
          codexKind: 'run_status',
          codexEventType: 'turn.completed'
        },
        {
          id: 'codex-old-artifact-line-x',
          role: 'agent',
          message: 'Artifact after boundary must not resume.',
          timestamp: '2026-07-08T00:02:00.000Z'
        },
        {
          id: 'note-operator-new',
          role: 'operator',
          message: 'Continue with this real operator message.',
          timestamp: '2026-07-08T00:03:00.000Z'
        }
      ]
    }
  }, null, 2));
  writeFileSync(join(workspace, runSummaryRef.replace(/^\.decision-os\//, '.decision-os/')), '# Run Summary\n');
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started', thread_id: 'session-resume-filter' }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), '');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);

  process.chdir(workspace);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}/continue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId })
    });
    assert.equal(response.status, 202);
    await waitForText(inputFile, 'Continue with this real operator message.');
    const prompt = readFileSync(inputFile, 'utf8');
    assert.match(prompt, /Continue with this real operator message\./);
    assert.doesNotMatch(prompt, /Artifact after boundary must not resume\./);
    assert.doesNotMatch(prompt, /Codex turn completed\./);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill run route measures active resumed segment from the latest persisted segment marker', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-resume-clock-'));
  const firstStartedAt = Date.now() - 8 * 60 * 60 * 1000;
  const resumedAt = Date.now() - 30000;
  const resumedAtIso = new Date(resumedAt).toISOString();
  const runId = `codex-skill-${firstStartedAt}-feedclock`;
  const outputCardId = `card-${runId}`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: outputCardId,
      title: 'Skill Result',
      cardType: 'codex-skill-run',
      comment: { what: `Codex run: ${runId}` },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'old-command', type: 'command_execution', command: 'old command', status: 'completed' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(logPath, [
    `decision-os:codex-run-segment ${JSON.stringify({ runId, executionId: 'execution-a', startedAt: new Date(firstStartedAt).toISOString(), segment: 'start', startLine: 0 })}`,
    `decision-os:codex-execution-finished ${JSON.stringify({ runId, executionId: 'execution-a', finishedAt: new Date(firstStartedAt + 45000).toISOString(), status: 'complete' })}`,
    'error: stale failure from the previous session',
    `decision-os:codex-run-segment ${JSON.stringify({ runId, executionId: 'execution-b', startedAt: resumedAtIso, segment: 'restart', startLine: 3 })}`,
  ].join('\n'));
  const fresh = new Date();
  utimesSync(jsonlPath, fresh, fresh);
  utimesSync(logPath, fresh, fresh);

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {
    codexSkillRuns: {
      [runId]: {
        id: runId,
        executionId: 'execution-b',
        status: 'running',
        startedAt: resumedAtIso,
        finishedAt: new Date(resumedAt - 1000).toISOString(),
      },
    },
  };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  await seedExecution({
    runtime,
    metadata: runExecutionMetadata({
      executionId: 'execution-a',
      runId,
      cardId: outputCardId,
      requestedAt: new Date(firstStartedAt).toISOString(),
      kind: 'pipeline-skill',
    }),
    phase: 'succeeded',
    startedAt: new Date(firstStartedAt).toISOString(),
    finishedAt: new Date(firstStartedAt + 45_000).toISOString(),
    stdoutFile: jsonlPath,
    stderrFile: logPath,
  });
  await seedExecution({
    runtime,
    metadata: runExecutionMetadata({
      executionId: 'execution-b',
      runId,
      cardId: outputCardId,
      requestedAt: resumedAtIso,
      kind: 'pipeline-skill',
    }),
    phase: 'running',
    startedAt: resumedAtIso,
    stdoutFile: jsonlPath,
    stderrFile: logPath,
  });

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    const body = await response.json() as { ok: boolean; status: string; executionId: string; startedAt: string; elapsedMs: number; toolCallCount: number; agentMessageCount: number; fileChangeCount: number; latestEvent: unknown; events: Array<{ line: number }>; executions: Array<{ executionId: string; status: string; elapsedMs: number }> };
    if (response.status !== 200) {
      const diagnostics = await fetch(`http://127.0.0.1:${address.port}/api/diagnostics/incidents`).then((result) => result.json());
      assert.equal(response.status, 200, JSON.stringify({ body, diagnostics }));
    }
    assert.equal(body.ok, true);
    assert.equal(body.status, 'running');
    assert.equal(body.executionId, 'execution-b');
    assert.equal(body.startedAt, resumedAtIso);
    assert.ok(body.elapsedMs >= 29000 && body.elapsedMs < 45000);
    assert.equal(body.toolCallCount, 0);
    assert.equal(body.agentMessageCount, 0);
    assert.equal(body.fileChangeCount, 0);
    assert.equal(body.latestEvent, null);
    assert.deepEqual(body.events.map((event) => event.line), [1, 2, 3]);
    assert.deepEqual(body.executions.map((execution) => [execution.executionId, execution.status]), [
      ['execution-a', 'complete'],
      ['execution-b', 'running'],
    ]);
    assert.equal(body.executions[0].elapsedMs, 45000);
    assert.ok(body.executions[1].elapsedMs >= 29000 && body.executions[1].elapsedMs < 45000);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('server startup interrupts a replicated running execution whose process registry is missing', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-interrupted-thread-run-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const runId = `codex-skill-${Date.now() - 1000}-restart1`;
  const executionId = 'execution-restart1';
  const cardId = 'card-interrupted-run';
  const runDirectory = join(decisionOsRoot, 'runs', 'codex-skills', 'specs');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const invocationFile = join(workspace, 'invoked.txt');
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'restart-project', name: 'Restart project' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [
      { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
      { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' },
    ]
  }, null, 2));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Interrupted thread run',
      comment: { what: 'Thread body.' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  writeFileSync(join(runDirectory, `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started', thread_id: 'session-restart1' }),
    JSON.stringify({ type: 'turn.started' }),
  ].join('\n'));
  writeFileSync(join(runDirectory, `${runId}.log`), '');
  writeFileSync(join(runDirectory, `${runId}.md`), '# Thread Codex Run\n\nStatus: processing\n');
  const tasksLedgerFile = join(decisionOsRoot, 'tasks.json');
  writeFileSync(tasksLedgerFile, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const taskState = createProjectTaskState({
    projectId: 'restart-project',
    writerId: 'local',
    decisionOsRoot,
    tasksLedgerFile,
    initialize: true,
  });
  const metadata: TaskExecutionMetadata = {
    executionId,
    requestId: 'request-restart1',
    sessionId: runId,
    projectId: 'restart-project',
    ledgerId: 'specs',
    taskId: '',
    sourceCardId: cardId,
    ownerCardId: cardId,
    kind: 'thread',
    requestedAt: new Date(Date.now() - 2000).toISOString(),
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
  await taskState.executions.admit({ metadata, executorNodeId: 'local' });
  await taskState.executions.transition(executionId, { phase: 'queued' });
  await taskState.executions.transition(executionId, { phase: 'starting' });
  await taskState.executions.transition(executionId, { phase: 'running' });
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    `writeFileSync(${JSON.stringify(invocationFile)}, "relaunched");`,
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);

  process.chdir(workspace);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${cardId}`);
    assert.equal(response.status, 200);
    const body = await response.json() as { status: string; phase: string; active: boolean; queuePosition: number | null };
    assert.equal(body.status, 'failed');
    assert.equal(body.phase, 'interrupted');
    assert.equal(body.active, false);
    assert.equal(body.queuePosition, null);
    assert.equal(existsSync(invocationFile), false);
    assert.equal(existsSync(join(decisionOsRoot, 'codex-process-queue.json')), false);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});
