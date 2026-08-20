/**
 * WHAT: Covers one-command registered phase dispatch.
 * WHY: delegation must create its card, record chronology, and return complete bounded instructions without main-agent discovery.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('phase-start creates a registered card and emits prompt plus bounded context', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousProject = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  const cards = [
    { id: 'card-master', title: 'Feature', labels: ['master-task'], comment: { what: 'Operator request.' }, x: 60, y: 60, domainId: 'tasks' },
    { id: 'card-chrono', title: '00 - Chronologic Execution', comment: { what: '' } },
    { id: 'card-intent', title: '01 - Operator Intent', comment: { what: 'Bounded intent.' } },
    { id: 'card-git', title: '02 - Git Preparation', comment: { what: 'Prepared worktree.' } },
  ];
  const relationships = cards.slice(1).map((card, position) => ({ id: `rel-${position}`, from: 'card-master', to: card.id, label: 'subtask', position }));
  const mutations: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) return response({
      projects: [{ id: 'project-a', ownerNodeId: 'node-a' }],
      allTasks: [{ masterTask: true, cardId: 'card-master', projectId: 'project-a', ledgerId: 'tasks', assignedNodeId: 'node-a' }],
    });
    if (requestUrl.includes('/api/task-state/projection?projectId=project-a')) return response({ ledger: { cards, relationships } });
    if (requestUrl === 'http://127.0.0.1:50150/p/project-a/decision-os/tasks') {
      const mutation = JSON.parse(String(init?.body)) as Record<string, unknown>;
      mutations.push(mutation);
      if (mutation.action === 'create-subtask') {
        const card = mutation.card as { id: string; comment: { contentFile: string } };
        return response({ createdFiles: [{ kind: 'subtask', cardId: card.id, path: `/workspace/${card.comment.contentFile}` }] });
      }
      return response({ ok: true });
    }
    if (requestUrl.endsWith('/api/codex/server-skills/SoftwareIteration-Awareness')) {
      return response({ skill: { markdown: 'AWARENESS {{ exact }}' } });
    }
    const cardId = requestUrl.match(/\/cards\/([^/]+)$/)?.[1];
    const card = cards.find((candidate) => candidate.id === cardId);
    if (card) return response(card);
    return response({ error: 'unexpected' }, 500);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const result = await dispatchLedgerCliCommandController([
      'phase-start', '--phase', 'awareness', '--master-card-id', 'card-master',
    ], { emit: (message) => messages.push(message) });
    assert.equal(result.ok, true);
    assert.equal(mutations.length, 3);
    assert.equal(mutations[0].action, 'create-subtask');
    assert.equal((mutations[0].card as { title: string }).title, '03 - Awareness');
    assert.equal(mutations[1].action, 'patch-card');
    assert.match(String((mutations[1].cardPatch as { description: string }).description), /## Deliverable Matrix/);
    assert.equal(mutations[2].action, 'append-note');
    assert.match(String((mutations[2].note as { body: string }).body), /\| DISPATCHED \| attempt-/);
    assert.match(messages[0], /AWARENESS \{\{ exact \}\}/);
    assert.match(messages[0], /# Context Card: Feature/);
    assert.match(messages[0], /# Context Card: 01 - Operator Intent/);
    assert.match(messages[0], /# Context Card: 02 - Git Preparation/);
    assert.doesNotMatch(messages[0], /Chronologic Execution/);
    assert.match(messages[0], /STATUS: COMPLETED \| FAILED \| BLOCKED/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
    if (previousProject === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProject;
  }
});

test('phase-start rejects unknown roles before discovery', async () => {
  const result = await dispatchLedgerCliCommandController(['phase-start', '--phase', 'invented', '--master-card-id', 'card-master']);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /operator-intent.*verification.*rca/);
});
