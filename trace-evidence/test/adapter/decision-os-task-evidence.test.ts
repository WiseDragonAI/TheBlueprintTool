import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { DecisionOsAdapter } from '../../src/business/adapter/decision-os-adapter.js';

test('resolves multiple cards in caller order and isolates selected execution evidence', async () => {
  const cards = ['card-b', 'card-a'];
  const tasks = cards.map((cardId) => ({ cardId, projectId: 'project', ledgerId: 'tasks', title: `Title ${cardId}`, masterTask: true, subtasks: [], cardStatus: 'todo', status: 'task-waiting' }));
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    // WHAT: Serve the exact identity projection used by card discovery.
    // WHY: Adapter tests must exercise transport without session content shortcuts.
    if (request.url === '/api/control-room?localOnly=1') { response.end(JSON.stringify({ allTasks: tasks })); return; }
    const card = request.url?.match(/\/api\/tasks\/([^/]+)\/execution-state/)?.[1];
    // WHAT: Serve per-card execution identity without cross-card records.
    // WHY: Batch isolation is proven at the adapter boundary.
    if (card) { response.end(JSON.stringify({ sessions: [{ sessionId: 'shared-session', executions: [{ executionId: `execution-${card}`, sessionId: 'shared-session', kind: 'thread', phase: 'succeeded', requestedAt: '2026-01-01T00:00:00.000Z', artifacts: { jsonl: true } }] }] })); return; }
    const execution = request.url?.match(/\/api\/task-executions\/([^/]+)/)?.[1];
    // WHAT: Serve one exact selected presentation.
    // WHY: Presentation collection must not return the overlapping session's other card.
    if (execution) { response.end(JSON.stringify({ execution: { executionId: execution }, events: [{ id: `event-${execution}` }] })); return; }
    response.statusCode = 404; response.end('{}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try {
    const adapter = new DecisionOsAdapter(await mkdtemp(join(tmpdir(), 'trace-adapter-')), `http://127.0.0.1:${address.port}`);
    const discovered = await adapter.resolveCards({ projectId: 'project', cardIds: cards });
    assert.deepEqual(discovered.map((card) => card.cardId), cards);
    const scopes = await adapter.resolveScopes({ projectId: 'project', cardIds: cards, executionIds: ['execution-card-a'], sessionIds: [], includePresentation: true });
    assert.equal(scopes[0].status, 'failed');
    assert.equal(scopes[0].executionIds.length, 0);
    assert.deepEqual(scopes[1].executionIds, ['execution-card-a']);
    const records = [];
    for await (const record of adapter.collectEvidence(scopes[1])) records.push(record);
    assert.deepEqual(records.map((record) => [record.source, record.executionId]), [['presentation', 'execution-card-a']]);
    assert.doesNotMatch(records[0].bytes, /execution-card-b/);
  } finally { server.close(); }
});
