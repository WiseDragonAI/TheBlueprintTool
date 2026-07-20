import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';
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

test('master-task migration commits the canonical ledger through the task-state worker on every write', async (context) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-task-backfill-routing-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const sourceLedger = resolve(decisionOsRoot, 'specs.json');
  const targetLedger = resolve(decisionOsRoot, 'tasks.json');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(sourceLedger, JSON.stringify({
    cards: [{ id: 'card-master', title: 'Master', labels: ['master-task'], x: 10, y: 10, w: 100, h: 100 }],
    annotations: [{ id: 'zone-task', variant: 'zone', x: 0, y: 0, width: 500, height: 500 }],
    relationships: [],
  }));
  writeFileSync(targetLedger, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  context.after(() => rmSync(workspace, { recursive: true, force: true }));

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
    const first = await dispatchLedgerCliCommandController([
      'migrate-master-tasks', '--source-ledger', sourceLedger, '--target-ledger', targetLedger, '--write', '--json',
    ], { emit: () => undefined });
    const second = await dispatchLedgerCliCommandController([
      'migrate-master-tasks', '--source-ledger', sourceLedger, '--target-ledger', targetLedger, '--write', '--json',
    ], { emit: () => undefined });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(requests.length, 2);
    assert.ok(requests.every((request) => request.url === 'http://127.0.0.1:50150/api/task-state/commit'));
    const submitted = requests.map((request) => JSON.parse(String(request.init?.body)));
    assert.ok(submitted.every((body) => body.projectId === 'project-a'));
    assert.ok(submitted.every((body) => body.ledger.cards.some((card: { id?: string }) => card.id === 'card-master')));
    assert.equal((JSON.parse(readFileSync(sourceLedger, 'utf8')).cards as unknown[]).length, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
    if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
  }
});
