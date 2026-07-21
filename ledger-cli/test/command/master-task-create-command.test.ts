import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

test('projects lists ids and names without a format flag', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  globalThis.fetch = (async () => new Response(JSON.stringify({ projects: [
    { id: 'project-z', name: 'Zulu' },
    { id: 'project-a', name: 'Alpha' },
  ] }), { status: 200 })) as typeof fetch;
  const messages: string[] = [];
  try {
    const result = await dispatchLedgerCliCommandController(['projects'], { emit: (message) => messages.push(message) });
    assert.equal(result.ok, true);
    assert.equal(messages.join('\n'), 'project-a\tAlpha\nproject-z\tZulu');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('master-task-create sends one Tasks mutation and prints every Markdown path', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  let mutation: Record<string, unknown> = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) {
      return new Response(JSON.stringify({ projects: [{ id: 'project-a', name: 'Alpha', color: '#123456' }] }), { status: 200 });
    }
    if (requestUrl.includes('/api/task-state/projection?')) {
      return new Response(JSON.stringify({ ledger: { annotations: [{ id: 'zone-old', color: '#ffffff', x: 10, y: 20, width: 1200, height: 900 }] } }), { status: 200 });
    }
    assert.equal(requestUrl, 'http://127.0.0.1:50150/p/project-a/decision-os/tasks');
    assert.equal(init?.method, 'PATCH');
    mutation = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const cards = [mutation.card, ...(mutation.cards as unknown[])] as Array<{ id: string; comment: { contentFile: string } }>;
    return new Response(JSON.stringify({ createdFiles: cards.map((card, index) => ({
      kind: index === 0 ? 'master-task' : 'subtask',
      cardId: card.id,
      path: `/workspace/${card.comment.contentFile}`,
    })) }), { status: 200 });
  }) as typeof fetch;
  const messages: string[] = [];
  try {
    const result = await dispatchLedgerCliCommandController([
      'master-task-create', '--project', 'project-a', '--title', 'Context metrics',
      '--subtask', 'Collect metrics', '--subtask', 'Render metrics',
    ], { emit: (message) => messages.push(message) });
    assert.equal(result.ok, true);
    assert.equal(mutation.action, 'create-master-task');
    assert.deepEqual(mutation.annotation, { id: (mutation.annotation as { id: string }).id, x: 10, y: 1040, width: 1200, height: 900, color: '#123456', label: 'Context metrics', comments: [] });
    assert.deepEqual((mutation.card as { labels: string[] }).labels, ['master-task']);
    assert.deepEqual((mutation.cards as Array<{ title: string; labels: string[] }>).map((card) => [card.title, card.labels]), [
      ['Collect metrics', ['subtask']],
      ['Render metrics', ['subtask']],
    ]);
    assert.equal((mutation.relationships as unknown[]).length, 2);
    assert.match((mutation.card as { comment: { what: string } }).comment.what, /Ledger: Tasks/);
    assert.match((mutation.card as { comment: { what: string } }).comment.what, /\[Collect metrics\]\(card:card-/);
    assert.equal(messages.join('\n').split('\n').length, 3);
    assert.match(messages[0], /^master-task\tcard-.*\t\/workspace\/\.decision-os\/cards\/tasks\/card-.*\.md/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});
