import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('serves one compact multi-project Control Room projection and refreshes one changed task', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-control-room-'));
  const decisionOsRoot = join(home, 'project-a', '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), '## A. Goal\n\n1. First title.\n\n## B. Subtasks\n\n1. [Child](card:child)\n');
  writeFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-master.md'), '# OPERATOR\n<!-- decision-os:note {"id":"n1","timestamp":"2026-07-14T10:01:00.000Z"} -->\n\nStart.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [
      { id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], x: 10, y: 10, w: 300, h: 200, comment: { contentFile: '.decision-os/cards/tasks/master.md' } },
      { id: 'child', title: 'Child', status: 'done', labels: ['subtask'], x: 350, y: 10, w: 300, h: 200 },
      { id: 'worker', title: 'Worker', status: 'todo', codexActiveRunId: 'codex-skill-test', codexRunId: 'codex-skill-test' },
    ],
    annotations: [{ id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' }],
    relationships: [{ id: 'rel-a', from: 'master', to: 'child', label: 'subtask' }], notes: {}, threadFiles: { 'thread-master': '.decision-os/threads/tasks/thread-master.md' },
  }));
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = { codexSkillRuns: { 'codex-skill-test': { status: 'running', startedAt: '2026-07-14T10:02:00.000Z' } } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const firstResponse = await fetch(`${baseUrl}/api/control-room`);
    const firstText = await firstResponse.text();
    const first = JSON.parse(firstText) as Record<string, any>;
    assert.equal(firstResponse.ok, true, firstText);
    assert.equal(first.projectorVersion, 'control-room-v9-logical-project-identity');
    assert.ok(Buffer.byteLength(firstText) < 250_000);
    assert.equal(first.queue.length, 1);
    assert.equal(first.queue[0].zoneId, 'zone-a');
    assert.equal(first.queue[0].complete, 1);
    assert.equal(first.queue[0].subtasks[0].cardId, 'child');
    assert.equal(first.queue[0].ledger, 'Tasks');
    assert.equal(first.queue[0].waitingSince, '2026-07-14T10:01:00.000Z');
    assert.equal(first.queue[0].valid, true);
    assert.equal(first.queue[0].markdown, undefined);
    assert.equal(first.dependencies, undefined);
    assert.equal(first.projectSlices, undefined);
    const warmStartedAt = performance.now();
    const secondResponse = await fetch(`${baseUrl}/api/control-room`);
    const warmElapsedMs = performance.now() - warmStartedAt;
    const second = await secondResponse.json() as Record<string, any>;
    assert.equal(second.revision, first.revision);
    assert.ok(warmElapsedMs < 100, `warm Control Room response took ${warmElapsedMs.toFixed(1)}ms`);
    const notModified = await fetch(`${baseUrl}/api/control-room`, { headers: { 'if-none-match': firstResponse.headers.get('etag') ?? '' } });
    assert.equal(notModified.status, 304);
    const compactText = await fetch(`${baseUrl}/api/codex/skills/runs/codex-skill-test/status?ledgerId=tasks&cardId=worker`).then((response) => response.text());
    const compact = JSON.parse(compactText) as Record<string, any>;
    assert.equal(compact.status, 'running');
    assert.equal(compact.startedAt, '2026-07-14T10:02:00.000Z');
    assert.equal(compact.events, undefined);
    assert.equal(compact.diagnostics, undefined);
    assert.ok(Buffer.byteLength(compactText) < 2_000);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});

test('changes the Control Room ETag when the active continuation turn starts without another ledger write', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-control-room-continuation-etag-'));
  const decisionOsRoot = join(home, 'project-a', '.decision-os');
  const runId = 'run-continuation';
  const oldExecutionId = 'execution-old';
  const activeExecutionId = 'execution-new';
  const stderrFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', `${runId}.log`);
  const stdoutFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', `${runId}.jsonl`);
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'runs', 'codex-skills', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), 'Waiting since: 2026-07-14T09:00:00.000Z\nActive since: 2026-07-14T10:02:03.000Z\n\n## A. Work\n\n1. Running.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'],
      codexActiveRunId: runId, codexActiveExecutionId: activeExecutionId, executionStatus: 'running',
      comment: { contentFile: '.decision-os/cards/tasks/master.md' },
    }],
    annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));
  writeFileSync(stderrFile, [
    `decision-os:codex-run-segment ${JSON.stringify({ runId, executionId: oldExecutionId, startedAt: '2026-07-14T10:02:00.000Z', segment: 'start', startLine: 0 })}`,
    `decision-os:codex-turn-start ${JSON.stringify({ runId, executionId: oldExecutionId, startedAt: '2026-07-14T10:02:03.000Z', line: 1 })}`,
    `decision-os:codex-run-segment ${JSON.stringify({ runId, executionId: activeExecutionId, startedAt: '2026-07-14T10:12:00.000Z', segment: 'continue', startLine: 1 })}`,
    '',
  ].join('\n'));
  writeFileSync(stdoutFile, `${JSON.stringify({ type: 'turn.completed' })}\n`);
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, any> = {
    codexSkillRuns: {
      [runId]: { status: 'running', executionId: activeExecutionId, startedAt: '2026-07-14T10:12:00.000Z', stderrFile, stdoutFile },
    },
  };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: join(home, 'project-a'), decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const beforeResponse = await fetch(`${baseUrl}/api/control-room`);
    const before = await beforeResponse.json() as Record<string, any>;
    const beforeEtag = beforeResponse.headers.get('etag') ?? '';
    assert.equal(before.exec[0].executionSince, '');

    appendFileSync(stderrFile, `decision-os:codex-turn-start ${JSON.stringify({ runId, executionId: activeExecutionId, startedAt: '2026-07-14T10:12:03.000Z', line: 2 })}\n`);
    runtime.codexSkillRuns[runId].turnStartedAt = '2026-07-14T10:12:03.000Z';
    runtime.onCodexTurnStarted({ ledgerId: 'tasks', cardId: 'master', threadId: 'thread-master', runId, executionId: activeExecutionId, startedAt: '2026-07-14T10:12:03.000Z' });
    await new Promise((resolveWait) => setImmediate(resolveWait));

    const afterResponse = await fetch(`${baseUrl}/api/control-room`, { headers: { 'if-none-match': beforeEtag } });
    assert.equal(afterResponse.status, 200);
    assert.notEqual(afterResponse.headers.get('etag'), beforeEtag);
    const after = await afterResponse.json() as Record<string, any>;
    assert.equal(after.exec[0].executionSince, '2026-07-14T10:12:03.000Z');
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(home, { recursive: true, force: true });
  }
});

test('canvas and thread read models exclude each other while preserving card bodies', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-scoped-ledger-'));
  const decisionOsRoot = join(home, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'card-a.md'), 'Canvas body.');
  writeFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-card-a.md'), '# OPERATOR\n<!-- decision-os:note {"id":"n1","timestamp":"2026-07-14T10:01:00.000Z"} -->\n\nThread body.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [{ id: 'card-a', title: 'A', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }], annotations: [], relationships: [], notes: {}, threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' } }));
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const canvasResponse = await fetch(`${baseUrl}/api/ledgers/tasks/canvas`);
    const canvasText = await canvasResponse.text();
    assert.equal(canvasResponse.ok, true, canvasText);
    const canvas = JSON.parse(canvasText) as Record<string, any>;
    assert.equal(canvas.cards[0].comment.what, 'Canvas body.');
    assert.deepEqual(canvas.notes, {});
    const thread = await fetch(`${baseUrl}/api/ledgers/tasks/threads/thread-card-a`).then((response) => response.json()) as Record<string, any>;
    assert.equal(thread.notes['thread-card-a'][0].message, 'Thread body.');
    assert.equal(thread.cards, undefined);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});
