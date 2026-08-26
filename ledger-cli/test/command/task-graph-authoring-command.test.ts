import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const controlRoom = {
  projects: [{ id: 'project-a', ownerNodeId: 'node-a' }],
  allTasks: [{
    masterTask: true,
    cardId: 'card-master',
    projectId: 'project-a',
    ledgerId: 'tasks',
    subtasks: [{ cardId: 'card-existing', position: 0 }],
  }],
};

test('subtask-create discovers owner context, creates one atomic graph addition, and prints its Markdown path', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  let mutation: Record<string, unknown> = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url);
    // WHAT: return the local master-task owner for catalog discovery.
    // WHY: the command must derive project and ledger context from the master ID.
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) return response(controlRoom);
    // WHAT: return current master geometry for subtask placement.
    // WHY: the command must prepare its card from authoritative task state.
    if (requestUrl.includes('/api/task-state/projection?projectId=project-a')) {
      return response({ ledger: {
        cards: [{ id: 'card-master', domainId: 'tasks', x: 60, y: 80 }],
        relationships: [{ id: 'rel-existing', from: 'card-master', to: 'card-existing', label: 'subtask', position: 0 }],
      } });
    }
    assert.equal(requestUrl, 'http://127.0.0.1:50150/p/project-a/decision-os/tasks');
    assert.equal(init?.method, 'PATCH');
    mutation = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const card = mutation.card as { id: string; comment: { contentFile: string } };
    return response({ createdFiles: [{ kind: 'subtask', cardId: card.id, path: `/workspace/${card.comment.contentFile}` }] });
  }) as typeof fetch;
  const messages: string[] = [];
  try {
    const result = await dispatchLedgerCliCommandController([
      'subtask-create', '--master-card-id', 'card-master', '--title', '05 - Implementation: Deltas',
    ], { emit: (message) => messages.push(message) });
    assert.equal(result.ok, true);
    assert.equal(mutation.action, 'create-subtask');
    assert.equal(mutation.assignedNodeId, 'node-a');
    assert.equal(mutation.masterTaskId, 'card-master');
    assert.equal((mutation.card as { title: string }).title, '05 - Implementation: Deltas');
    assert.equal((mutation.card as { comment: { what: string } }).comment.what, '');
    assert.equal((mutation.relationship as { from: string }).from, 'card-master');
    assert.equal((mutation.relationship as { position: number }).position, 1);
    const receipt = JSON.parse(messages[0]);
    assert.equal(receipt.created, true);
    assert.equal(receipt.assignedNodeId, 'node-a');
    assert.match(receipt.path, /^\/workspace\/\.decision-os\/cards\/tasks\/card-.*\.md$/);

    const rejected = await dispatchLedgerCliCommandController([
      'subtask-create', '--master-card-id', 'card-master', '--title', 'Rejected', '--markdown-file', '/tmp/input.md',
    ]);
    assert.deepEqual(rejected, { ok: false, error: 'subtask-create does not accept --markdown-file.' });
  } finally {
    globalThis.fetch = previousFetch;
    // WHAT: restore absence or the prior server URL after the isolated command test.
    // WHY: process environment must not leak between test cases.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('master-task-commit discovers owner context and prints exact graph Git evidence', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url);
    // WHAT: return the local master-task owner for commit discovery.
    // WHY: the commit command must derive its repository route from the master ID.
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) return response(controlRoom);
    assert.equal(requestUrl, 'http://127.0.0.1:50150/p/project-a/api/task-content/master-task-commit');
    assert.equal(init?.method, 'POST');
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response({
      projectId: 'project-a',
      ledgerId: 'tasks',
      masterCardId: 'card-master',
      commit: 'a'.repeat(40),
      files: ['cards/tasks/card-master.md', 'cards/tasks/card-existing.md'],
    });
  }) as typeof fetch;
  const messages: string[] = [];
  try {
    const result = await dispatchLedgerCliCommandController([
      'master-task-commit', '--master-card-id', 'card-master',
    ], { emit: (message) => messages.push(message) });
    assert.equal(result.ok, true);
    assert.deepEqual(requestBody, { masterCardId: 'card-master', ledgerId: 'tasks' });
    assert.deepEqual(JSON.parse(messages[0]), {
      version: 1,
      operation: 'master-task-commit',
      projectId: 'project-a',
      ledgerId: 'tasks',
      masterCardId: 'card-master',
      commit: 'a'.repeat(40),
      files: ['cards/tasks/card-master.md', 'cards/tasks/card-existing.md'],
    });
  } finally {
    globalThis.fetch = previousFetch;
    // WHAT: restore absence or the prior server URL after the isolated commit test.
    // WHY: process environment must not leak between test cases.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});
