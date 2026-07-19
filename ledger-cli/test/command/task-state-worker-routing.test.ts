import assert from 'node:assert/strict';
import test from 'node:test';
import { writeLedgerJson } from '../../src/business/ledger/effect/write-ledger-json.js';

test('tasks.json mutations are submitted to the running task-state worker', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  try {
    await writeLedgerJson('/workspace/.decision-os/tasks.json', { cards: [{ id: 'card-a', status: 'done' }] });
    assert.equal(requests[0]?.url, 'http://127.0.0.1:50150/api/task-state/commit');
    assert.equal(requests[0]?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), { projectId: 'project-a', ledger: { cards: [{ id: 'card-a', status: 'done' }] } });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});

test('tasks.json mutation fails closed when no task-state worker is configured', async () => {
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  delete process.env.DECISION_OS_SERVER_URL;
  delete process.env.DECISION_OS_PROJECT_ID;
  try {
    await assert.rejects(() => writeLedgerJson('/workspace/.decision-os/tasks.json', { cards: [] }), /running Decision OS worker/);
  } finally {
    if (previousServerUrl !== undefined) process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId !== undefined) process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});
