import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';
import { writeLedgerJson } from '../../src/business/ledger/effect/write-ledger-json.js';
import { readLedgerJson } from '../../src/business/ledger/helper/read-ledger-json.js';

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
