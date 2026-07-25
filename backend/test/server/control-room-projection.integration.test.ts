import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';

test('serves one compact multi-project Control Room projection and refreshes one changed task', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-control-room-'));
  const decisionOsRoot = join(home, 'project-a', '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), '## A. Goal\n\n1. First title.\n\n## B. Subtasks\n\n1. [Child](card:child)\n');
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master-done.md'), 'Completed at: 2026-07-14T10:04:00.000Z\n\n## A. Goal\n\n1. Completed title.\n');
  writeFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-master.md'), '# OPERATOR\n<!-- decision-os:note {"id":"n1","timestamp":"2026-07-14T10:01:00.000Z"} -->\n\nStart.\n');
  writeFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-master-done.md'), '# AGENT\n<!-- decision-os:note {"id":"n2","timestamp":"2026-07-14T10:03:00.000Z"} -->\n\nFinished.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [
      { id: 'master', title: 'Master', status: 'todo', createdAt: '2026-07-14T10:00:00.000Z', lifecycle: { status: 'todo', changedAt: '2026-07-14T10:01:00.000Z', waitingAt: '2026-07-14T10:01:00.000Z', closedAt: null }, labels: ['master-task', 'delivery'], x: 10, y: 10, w: 300, h: 200, comment: { contentFile: '.decision-os/cards/tasks/master.md' } },
      { id: 'master-done', title: 'Completed master', status: 'done', createdAt: '2026-07-14T10:00:00.000Z', lifecycle: { status: 'done', changedAt: '2026-07-14T10:04:00.000Z', waitingAt: null, closedAt: '2026-07-14T10:04:00.000Z' }, labels: ['master-task', 'release'], x: 10, y: 240, w: 300, h: 200, comment: { contentFile: '.decision-os/cards/tasks/master-done.md' } },
      { id: 'child', title: 'Child', status: 'done', createdAt: '2026-07-14T10:00:00.000Z', lifecycle: { status: 'done', changedAt: '2026-07-14T10:04:00.000Z', waitingAt: null, closedAt: '2026-07-14T10:04:00.000Z' }, labels: [], x: 350, y: 10, w: 300, h: 200 },
      { id: 'worker', title: 'Worker', status: 'todo', codexActiveRunId: 'codex-skill-test', codexActiveExecutionId: 'execution-test', codexRunId: 'codex-skill-test' },
      { id: 'orphan', title: 'Orphaned execution', status: 'backlog', labels: ['master-task'], lifecycle: { status: 'backlog', changedAt: '2026-07-14T10:05:00.000Z', waitingAt: null, closedAt: null }, executionIntent: { id: 'lost-run', state: 'waiting', changedAt: '2026-07-14T10:05:00.000Z' } },
    ],
    annotations: [{ id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' }],
    relationships: [{ id: 'rel-a', from: 'master', to: 'child', label: 'subtask', position: 0 }], notes: {}, threadFiles: {
      'thread-master': '.decision-os/threads/tasks/thread-master.md',
      'thread-master-done': '.decision-os/threads/tasks/thread-master-done.md',
    },
  }));
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'control-room-project' }));
  await migrateTaskCurrentState({ decisionOsRoot, projectId: 'control-room-project', nodeId: 'workstation', tasksLedgerFile: join(decisionOsRoot, 'tasks.json') });
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = { codexSkillRuns: { 'codex-skill-test': { status: 'running', executionId: 'execution-test', startedAt: '2026-07-14T10:02:00.000Z', child: { pid: process.pid, exitCode: null, killed: false } } } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const firstResponse = await fetch(`${baseUrl}/api/control-room`);
    const firstText = await firstResponse.text();
    const first = JSON.parse(firstText) as Record<string, any>;
    assert.equal(firstResponse.ok, true, firstText);
    assert.equal(first.projectorVersion, 'control-room-v18-replicated-execution');
    assert.ok(Buffer.byteLength(firstText) < 250_000);
    assert.equal(first.queue.length, 1);
    assert.equal(first.exec.some((task: Record<string, unknown>) => task.cardId === 'orphan'), false);
    const orphan = first.allTasks.find((task: Record<string, unknown>) => task.cardId === 'orphan');
    assert.ok(orphan, JSON.stringify(first.allTasks.map((task: Record<string, unknown>) => task.cardId)));
    assert.equal(orphan.status, 'task-backlog');
    assert.equal(first.queue[0].zoneId, 'zone-a');
    assert.equal(first.queue[0].complete, 1);
    assert.equal(first.queue[0].subtasks[0].cardId, 'child');
    assert.equal(first.queue[0].ledger, 'Tasks');
    assert.equal(first.queue[0].waitingSince, '2026-07-14T10:01:00.000Z');
    assert.equal(first.queue[0].valid, true);
    assert.deepEqual(first.queue[0].labels, ['delivery']);
    assert.equal(first.done.length, 1);
    assert.deepEqual(first.done[0].labels, ['release']);
    assert.equal(first.done[0].completedAt, '2026-07-14T10:04:00.000Z');
    assert.equal(first.done[0].completedTime, Date.parse('2026-07-14T10:04:00.000Z'));
    assert.deepEqual(first.allTasks.find((task: Record<string, unknown>) => task.cardId === 'master-done')?.labels, ['release']);
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
    assert.equal(compact.status, 'failed');
    assert.equal(compact.phase, 'interrupted');
    assert.equal(compact.active, false);
    assert.equal(compact.executorNodeId, 'workstation');
    assert.deepEqual(compact.validActions, ['restart', 'open-log']);
    assert.equal(compact.queuePosition, null);
    assert.equal(compact.execution.phase, 'interrupted');
    assert.deepEqual(compact.execution.validActions, ['restart', 'open-log']);
    assert.equal(compact.events, undefined);
    assert.equal(compact.diagnostics, undefined);
    assert.ok(Buffer.byteLength(compactText) < 2_000);
    const doneRoute = await fetch(`${baseUrl}/done`);
    const doneHtml = await doneRoute.text();
    assert.equal(doneRoute.status, 200);
    assert.match(doneHtml, /id="done-view"/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
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
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'scoped-ledger-project' }));
  await migrateTaskCurrentState({ decisionOsRoot, projectId: 'scoped-ledger-project', nodeId: 'workstation', tasksLedgerFile: join(decisionOsRoot, 'tasks.json') });
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
    const taskClockHeader = canvasResponse.headers.get('x-decision-os-task-clock') ?? '';
    const taskClock = JSON.parse(Buffer.from(taskClockHeader, 'base64url').toString('utf8')) as Record<string, number>;
    assert.ok(Buffer.byteLength(taskClockHeader) < 16 * 1024);
    assert.deepEqual(Object.keys(taskClock), ['workstation']);
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

test('held task creation and deletion invalidate the local Control Room without federation publication', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-held-control-room-'));
  const decisionOsRoot = join(home, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {} }));
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'held-project' }));
  await migrateTaskCurrentState({ decisionOsRoot, projectId: 'held-project', nodeId: 'workstation', tasksLedgerFile: join(decisionOsRoot, 'tasks.json') });
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const mutationUrl = `${baseUrl}/p/held-project/decision-os/tasks`;
  const controlRoom = async (): Promise<Record<string, any>> => fetch(`${baseUrl}/api/control-room`, { cache: 'no-store' }).then((response) => response.json());
  const waitForTaskCount = async (count: number): Promise<Record<string, any>> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const projection = await controlRoom();
      if (projection.allTasks.length === count) return projection;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return controlRoom();
  };

  try {
    assert.equal((await controlRoom()).allTasks.length, 0);
    const creation = await fetch(mutationUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create-task-intake',
        assignedNodeId: 'workstation',
        annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456', label: 'Held' },
        card: { id: 'card-a', title: 'Held task', status: 'todo', labels: ['master-task'], domainId: 'tasks', x: 20, y: 20, w: 300, h: 180, comment: { what: 'Held body.' } },
      }),
    });
    const creationBody = await creation.json() as Record<string, any>;
    assert.equal(creation.status, 200, JSON.stringify(creationBody));
    assert.equal(creationBody.changedCard?.id, 'card-a', JSON.stringify(creationBody));
    const taskProjection = await fetch(`${baseUrl}/api/task-state/projection?projectId=held-project`).then((response) => response.json()) as Record<string, any>;
    assert.equal(taskProjection.ledger.cards[0]?.id, 'card-a', JSON.stringify(taskProjection));
    const createdProjection = await waitForTaskCount(1);
    assert.equal(createdProjection.allTasks[0]?.cardId, 'card-a', JSON.stringify(createdProjection));
    assert.equal(createdProjection.allTasks[0]?.assignedNodeId, 'workstation', JSON.stringify(createdProjection));

    const deletion = await fetch(mutationUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-card', cardId: 'card-a' }),
    });
    assert.equal(deletion.status, 200, await deletion.text());
    assert.equal((await waitForTaskCount(0)).allTasks.length, 0);

    const rejected = await fetch(mutationUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'transition-card-lifecycle', cardId: 'missing-card', lifecycleStatus: 'done' }),
    });
    assert.equal(rejected.status, 404);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});
