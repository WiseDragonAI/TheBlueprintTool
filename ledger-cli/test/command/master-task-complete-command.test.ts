import test from 'node:test';
import assert from 'node:assert/strict';
import { completeMasterTask } from '../../src/business/ledger/helper/complete-master-task.js';
import { parseLedgerCliArgv } from '../../src/business/command/helper/parse-ledger-cli-argv.js';

test('master-task-complete defaults the ledger from the injected runtime', () => {
  const previous = process.env.DECISION_OS_LEDGER_FILE;
  process.env.DECISION_OS_LEDGER_FILE = '/workspace/.decision-os/specs.json';
  try {
    const command = parseLedgerCliArgv(['master-task-complete', '--card-id', 'master-a']);
    assert.equal(command.mode, 'master-task-complete');
    assert.equal(command.ledgerJsonFile, '/workspace/.decision-os/specs.json');
    assert.equal(command.cardOperation?.cardId, 'master-a');
  } finally {
    if (previous === undefined) delete process.env.DECISION_OS_LEDGER_FILE;
    else process.env.DECISION_OS_LEDGER_FILE = previous;
  }
});

test('master-task-complete sends one canonical project-scoped request', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await completeMasterTask({
    cardId: 'master-a',
    ledgerJsonFile: '/workspace/.decision-os/specs.json',
    projectId: 'project/a',
    serverUrl: 'http://127.0.0.1:50150/',
  }, async (url, init) => {
    calls.push({ url, init });
    return { headers: new Headers({ 'x-decision-os-completion-commit': 'abc123' }), ok: true, status: 200, text: async () => '{"cards":[]}' };
  }, async () => ({ ok: true, value: JSON.stringify({ version: 2, ready: true, discrepancies: [] }) }));

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:50150/p/project%2Fa/decision-os/specs');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { action: 'complete-master-task', masterTaskId: 'master-a' });
  if (result.ok) assert.deepEqual(JSON.parse(result.value), {
    version: 2,
    completed: true,
    projectId: 'project/a',
    ledgerId: 'specs',
    masterCardId: 'master-a',
    commitSha: 'abc123',
    gate: { version: 2, ready: true, discrepancies: [] },
  });
});

test('master-task-complete reports a failed post-transaction gate without hiding completion', async () => {
  const result = await completeMasterTask({
    cardId: 'master-a', ledgerJsonFile: '/workspace/.decision-os/specs.json', projectId: 'project-a', serverUrl: 'http://127.0.0.1:50150',
  }, async () => ({ headers: new Headers(), ok: true, status: 200, text: async () => '{}' }), async () => ({ ok: false, error: 'gate unavailable' }));
  assert.deepEqual(result, { ok: false, error: 'Master task completed, but its post-transaction gate failed: gate unavailable' });
});

test('master-task-complete returns the canonical route failure', async () => {
  const result = await completeMasterTask({
    cardId: 'master-a', ledgerJsonFile: '/workspace/.decision-os/specs.json', projectId: 'project-a', serverUrl: 'http://127.0.0.1:50150',
  }, async () => ({ headers: new Headers(), ok: false, status: 409, text: async () => '{"error":"commit failed"}' }));
  assert.deepEqual(result, { ok: false, error: 'Master task completion failed (409): {"error":"commit failed"}' });
});

test('master-task-complete rejects missing injected route identity before requesting', async () => {
  const previousProject = process.env.DECISION_OS_PROJECT_ID;
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  delete process.env.DECISION_OS_PROJECT_ID;
  delete process.env.DECISION_OS_SERVER_URL;
  let calls = 0;
  try {
    const result = await completeMasterTask({ cardId: 'master-a', ledgerJsonFile: '/workspace/.decision-os/specs.json' }, async () => {
      calls += 1;
      return { headers: new Headers(), ok: true, status: 200, text: async () => '' };
    });
    assert.deepEqual(result, { ok: false, error: 'master-task-complete requires DECISION_OS_SERVER_URL.' });
    assert.equal(calls, 0);
  } finally {
    if (previousProject === undefined) delete process.env.DECISION_OS_PROJECT_ID; else process.env.DECISION_OS_PROJECT_ID = previousProject;
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL; else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});
