import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskFieldEvent } from '../../../src/business/task-state/helper/task-event-codec.js';
import { reduceTaskEvents } from '../../../src/business/task-state/helper/task-event-reducer.js';

function event(input: { id: string; writer: string; at: string; path: string; value: unknown }) {
  return createTaskFieldEvent({
    eventId: input.id,
    projectId: 'project-a',
    writerId: input.writer,
    emittedAt: input.at,
    entityType: 'card',
    entityId: 'card-a',
    changes: [{ path: input.path, operation: 'set', value: input.value }],
  });
}

test('chronological reduction is independent from arrival order', () => {
  const values = [
    event({ id: 'a', writer: 'node-a', at: '2026-07-20T01:00:00.000Z', path: 'title', value: 'First' }),
    event({ id: 'b', writer: 'node-b', at: '2026-07-20T02:00:00.000Z', path: 'status', value: 'done' }),
    event({ id: 'c', writer: 'node-a', at: '2026-07-20T03:00:00.000Z', path: 'title', value: 'Last' }),
  ];
  const permutations = [values, [values[2], values[0], values[1]], [values[1], values[2], values[0]]];
  const ledgers = permutations.map((events) => reduceTaskEvents({ projectId: 'project-a', events }).ledger);
  assert.deepEqual(ledgers[0], ledgers[1]);
  assert.deepEqual(ledgers[1], ledgers[2]);
  assert.deepEqual((ledgers[0].cards as Array<Record<string, unknown>>)[0], { id: 'card-a', title: 'Last', status: 'done' });
});

test('same-date incompatible writes remain conflicts until a later event resolves them', () => {
  const first = event({ id: 'a', writer: 'node-a', at: '2026-07-20T01:00:00.000Z', path: 'status', value: 'todo' });
  const left = event({ id: 'b', writer: 'node-a', at: '2026-07-20T02:00:00.000Z', path: 'status', value: 'done' });
  const right = event({ id: 'c', writer: 'node-b', at: '2026-07-20T02:00:00.000Z', path: 'status', value: 'backlog' });
  const conflicted = reduceTaskEvents({ projectId: 'project-a', events: [right, first, left] });
  assert.equal((conflicted.ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(conflicted.conflicts.length, 1);

  const resolution = event({ id: 'd', writer: 'node-a', at: '2026-07-20T03:00:00.000Z', path: 'status', value: 'done' });
  const resolved = reduceTaskEvents({ projectId: 'project-a', events: [right, resolution, first, left] });
  assert.equal((resolved.ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
  assert.deepEqual(resolved.conflicts, []);
});

test('event validation rejects sequence and content fields', () => {
  assert.throws(() => createTaskFieldEvent({
    eventId: 'a', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T01:00:00.000Z', entityType: 'card', entityId: 'card-a',
    changes: [{ path: 'comment/what', operation: 'set', value: 'markdown' }],
  }), /content_forbidden/);
  assert.throws(() => createTaskFieldEvent({
    eventId: 'b', projectId: 'project-a', writerId: 'node-a', emittedAt: 'not-a-date', entityType: 'card', entityId: 'card-a',
    changes: [{ path: 'status', operation: 'set', value: 'todo' }],
  }), /invalid_task_event_date/);
  const withSequence = {
    ...event({ id: 'c', writer: 'node-a', at: '2026-07-20T01:00:00.000Z', path: 'status', value: 'todo' }),
    sequence: 1,
  };
  assert.throws(() => createTaskFieldEvent(withSequence), /sequence_forbidden/);
});
