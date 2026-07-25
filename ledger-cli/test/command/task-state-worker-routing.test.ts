import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';
import { writeLedgerJson } from '../../src/business/ledger/effect/write-ledger-json.js';
import { readLedgerJson } from '../../src/business/ledger/helper/read-ledger-json.js';
import { manageLedgerJsonController } from '../../src/business/ledger/controller/manage-ledger-json.js';

test('tasks.json aggregate mutations fail closed', async () => {
  await assert.rejects(
    () => writeLedgerJson('/workspace/.decision-os/tasks.json', { cards: [{ id: 'card-a', status: 'done' }] }),
    /aggregate_task_state_commit_removed/,
  );
});

test('tasks.json todo and done commands submit one scoped lifecycle transition', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    if (!init) return new Response(JSON.stringify({ ok: true, ledger: { cards: [{ id: 'card-a', status: 'todo' }] } }), { status: 200 });
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  try {
    const result = await dispatchLedgerCliCommandController(['done', '--ledger', '/workspace/.decision-os/tasks.json', '--card-id', 'card-a']);
    assert.equal(result.ok, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1]?.url, 'http://127.0.0.1:50150/api/task-state/transition-card-lifecycle');
    assert.equal(requests[1]?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), { projectId: 'project-a', cardId: 'card-a', lifecycleStatus: 'done' });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});

test('tasks.json answer submits one scoped agent note without an aggregate write', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    if (!init) return new Response(JSON.stringify({ ok: true, ledger: { cards: [], notes: {} } }), { status: 200 });
    const mutation = JSON.parse(String(init.body)) as { note: Record<string, unknown> };
    const persisted = { ...mutation.note, message: mutation.note.body, timestamp: '2026-07-21T00:00:00.000Z' };
    return new Response(JSON.stringify({ changedThread: { notes: { 'thread-card-a': [persisted] } } }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await dispatchLedgerCliCommandController([
      'answer', '--ledger', '/workspace/.decision-os/tasks.json', '--thread-id', 'thread-card-a', '--message', 'Treated.',
    ], { emit: () => undefined });
    assert.equal(result.ok, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1]?.url, 'http://127.0.0.1:50150/p/project-a/decision-os/tasks');
    assert.equal(requests[1]?.init?.method, 'PATCH');
    const mutation = JSON.parse(String(requests[1]?.init?.body)) as { action: string; note: Record<string, unknown> };
    assert.equal(mutation.action, 'append-note');
    assert.equal(mutation.note.role, 'agent');
    assert.equal(mutation.note.body, 'Treated.');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});

test('tasks.json generic mutate fails before applying an undeclared projection change', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  let requests = 0;
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ ok: true, ledger: { cards: [{ id: 'card-a', status: 'todo' }] } }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await manageLedgerJsonController({
      ledgerCommand: 'mutate', ledgerJsonFile: '/workspace/.decision-os/tasks.json', mutation: { cards: [] },
    });
    assert.deepEqual(result, { ok: false, error: 'scoped_task_command_required:mutate' });
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});

test('tasks.json reads use the current task-state projection instead of the migration source file', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  let requestedUrl = '';
  globalThis.fetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ ok: true, projectId: 'project-a', ledger: { cards: [{ id: 'current-card' }] } }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await readLedgerJson('/workspace/.decision-os/tasks.json');
    assert.deepEqual(result, { ok: true, value: { cards: [{ id: 'current-card' }] } });
    assert.equal(requestedUrl, 'http://127.0.0.1:50150/api/task-state/projection?projectId=project-a');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});

test('tasks.json aggregate mutation remains closed when no task-state worker is configured', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  delete process.env.DECISION_OS_SERVER_URL;
  delete process.env.DECISION_OS_PROJECT_ID;
  try {
    await assert.rejects(() => writeLedgerJson('/workspace/.decision-os/tasks.json', { cards: [] }), /aggregate_task_state_commit_removed/);
  } finally {
    if (previousServerUrl !== undefined) process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId !== undefined) process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});
