/**
 * WHAT: Covers replicated execution recovery and exclusion of the retired direct-process queue.
 * WHY: Startup must schedule canonical queued work without reviving legacy queue authority.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { enqueueCodexThreadProcess, readCodexProcessQueue } from '@backend/business/codex/helper/codex-process-queue.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskExecutionMetadata } from '@backend/business/task-state/helper/task-current-state-types.js';

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

async function waitForFile(file: string, decisionOsRoot: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (existsSync(file)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${file}; queue=${JSON.stringify(readCodexProcessQueue(decisionOsRoot))}`);
}

function createProject(root: string, ledger: Record<string, unknown> | null, projectId: string): string {
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId, name: projectId }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [
      ...(ledger ? [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] : []),
      { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' },
    ],
  }, null, 2));
  if (ledger) writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify(ledger, null, 2));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  return decisionOsRoot;
}

async function seedQueuedExecution(input: {
  decisionOsRoot: string;
  projectId: string;
  executionId: string;
  runId: string;
  cardId: string;
  requestedAt: string;
}): Promise<void> {
  const tasksLedgerFile = join(input.decisionOsRoot, 'tasks.json');
  writeFileSync(tasksLedgerFile, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const state = createProjectTaskState({
    projectId: input.projectId,
    writerId: 'local',
    decisionOsRoot: input.decisionOsRoot,
    tasksLedgerFile,
    initialize: true,
  });
  const metadata: TaskExecutionMetadata = {
    executionId: input.executionId,
    requestId: `request-${input.executionId}`,
    sessionId: input.runId,
    projectId: input.projectId,
    ledgerId: 'specs',
    taskId: '',
    sourceCardId: input.cardId,
    ownerCardId: input.cardId,
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
  await state.executions.admit({ metadata, executorNodeId: 'local' });
  await state.executions.transition(input.executionId, { phase: 'queued' });
}

test('server startup schedules a queued replicated execution discovered after an empty project', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const home = mkdtempSync(join(tmpdir(), 'decision-os-restart-queue-'));
  const masterDecisionOsRoot = createProject(home, null, 'master-project');
  createProject(join(home, 'a-empty'), null, 'empty-project');
  const queuedProject = join(home, 'b-queued');
  const executionId = 'execution-queued';
  const queuedDecisionOsRoot = createProject(queuedProject, {
    cards: [{ id: 'card-queued', title: 'Queued card', comment: { what: 'Queued card body.' }, facts: [], fields: [] }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-queued': '.decision-os/threads/specs/thread-card-queued.md' },
  }, 'queued-project');
  const threadDirectory = join(queuedDecisionOsRoot, 'threads', 'specs');
  mkdirSync(threadDirectory, { recursive: true });
  writeFileSync(join(threadDirectory, 'thread-card-queued.md'), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-queued","timestamp":"2026-07-15T06:00:00.000Z"} -->',
    '',
    'Resume this queued task.',
  ].join('\n'));
  await seedQueuedExecution({
    decisionOsRoot: queuedDecisionOsRoot,
    projectId: 'queued-project',
    executionId,
    runId: 'run-queued',
    cardId: 'card-queued',
    requestedAt: '2026-07-15T06:00:01.000Z',
  });
  const invocationFile = join(queuedProject, 'invoked.txt');
  const fakeCodex = join(home, 'fake-codex.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    `writeFileSync(${JSON.stringify(invocationFile)}, "started");`,
    'process.stdin.resume();',
    'process.stdin.on("end", () => console.log(JSON.stringify({ type: "turn.completed" })));',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot: masterDecisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    await waitForFile(invocationFile, queuedDecisionOsRoot);
    assert.equal(readFileSync(invocationFile, 'utf8'), 'started');
    assert.equal(existsSync(join(queuedDecisionOsRoot, 'codex-process-queue.json')), false);
    const terminalDeadline = Date.now() + 3_000;
    let phase = '';
    while (Date.now() < terminalDeadline && phase !== 'succeeded') {
      const response = await fetch(`http://127.0.0.1:${address.port}/p/${encodeURIComponent('queued-project')}/api/codex/skills/runs/${encodeURIComponent('run-queued')}?ledgerId=specs&cardId=card-queued`);
      if (response.ok) phase = String(((await response.json()) as { phase?: string }).phase ?? '');
      if (phase !== 'succeeded') await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(phase, 'succeeded');
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(home, { recursive: true, force: true });
  }
});

test('server scheduler ignores a legacy queue entry added after startup', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const home = mkdtempSync(join(tmpdir(), 'decision-os-recurring-queue-scan-'));
  const decisionOsRoot = createProject(home, {
    cards: [{ id: 'card-late', title: 'Late queued card', codexThreadRunId: 'run-late', codexActiveRunId: 'run-late', codexActiveExecutionId: 'execution-late', comment: { what: 'Late body.' }, facts: [], fields: [] }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-late': '.decision-os/threads/specs/thread-card-late.md' },
  }, 'late-project');
  const threadDirectory = join(decisionOsRoot, 'threads', 'specs');
  mkdirSync(threadDirectory, { recursive: true });
  writeFileSync(join(threadDirectory, 'thread-card-late.md'), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-late","timestamp":"2026-07-15T06:00:00.000Z"} -->',
    '',
    'Launch after startup.',
  ].join('\n'));
  const invocationFile = join(home, 'invoked-late.txt');
  const fakeCodex = join(home, 'fake-codex-late.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    `writeFileSync(${JSON.stringify(invocationFile)}, "started");`,
    'process.stdin.resume();',
    'process.stdin.on("end", () => console.log(JSON.stringify({ type: "turn.completed" })));',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');

  try {
    enqueueCodexThreadProcess({
      decisionOsRoot,
      id: 'run-late',
      createdAt: new Date().toISOString(),
      payload: { ledgerId: 'specs', threadId: 'thread-card-late', cardId: 'card-late', runId: 'run-late', executionId: 'execution-late' },
    });
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    assert.equal(existsSync(invocationFile), false);
    assert.equal(readCodexProcessQueue(decisionOsRoot).length, 1);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(home, { recursive: true, force: true });
  }
});
