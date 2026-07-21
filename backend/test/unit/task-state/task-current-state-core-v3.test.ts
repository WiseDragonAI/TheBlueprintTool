import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  assertTaskCurrentEntity,
  canonicalJson,
  finalizeTaskCurrentEntity,
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
  hashTaskCurrentEntity,
  joinTaskEntities,
  sha256,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityByteLimit,
  taskCurrentStateVersion,
  type TaskCurrentEntity,
  type TaskCurrentRegister,
} from '../../../../shared/task-current-state-core.js';
import { materializeTaskCurrentEntity } from '../../../src/business/task-state/helper/materialize-task-current-entity.js';
import type { TaskCurrentProjection } from '../../../src/business/task-state/helper/task-current-state-types.js';

function register(replicaId: string, counter: number, value: unknown): TaskCurrentRegister {
  return { clock: { [replicaId]: counter }, candidates: [{ dot: { replicaId, counter }, operation: 'set', value }] };
}

function entity(replicaId: string, fields: TaskCurrentEntity['fields'], entityId = 'card-a'): TaskCurrentEntity {
  return finalizeTaskCurrentEntity({ version: taskCurrentStateVersion, projectId: 'project-a', entityType: 'card', entityId, fields });
}

function permutations<T>(values: T[]): T[][] {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [value, ...tail]));
}

test('platform-neutral SHA-256 and canonical JSON match authoritative vectors', () => {
  for (const value of ['', 'abc', 'Decision OS 🧭', canonicalJson({ z: [3, { b: true, a: null }], a: 'first' })]) {
    assert.equal(sha256(value), createHash('sha256').update(value).digest('hex'));
  }
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: 3 } }), '{"a":{"x":3,"y":2},"z":1}');
});

test('every entity delivery permutation has one byte-identical joined entity and bucket hash', () => {
  const candidates = [
    entity('desktop', { title: register('desktop', 1, 'Desktop') }),
    entity('mobile', { lifecycle: register('mobile', 1, { status: 'todo', changedAt: '2026-07-21T00:00:00.000Z', waitingAt: '2026-07-21T00:00:00.000Z', closedAt: null }) }),
    entity('tablet', { createdAt: register('tablet', 1, '2026-07-20T00:00:00.000Z') }),
  ];
  const results = permutations(candidates).map((ordered) => ordered.reduce<TaskCurrentEntity | undefined>((joined, next) => joinTaskEntities(joined, next), undefined)!);
  assert.equal(new Set(results.map((result) => canonicalJson(result))).size, 1);
  assert.equal(new Set(results.map(hashTaskCurrentEntity)).size, 1);
  const key = 'card\u0000card-a';
  assert.equal(new Set(results.map((result) => hashTaskCurrentBucket([[key, result]]))).size, 1);
  const roots = results.map((result) => hashTaskCurrentRoot([{ bucket: taskCurrentBucketForEntityKey(key), count: 1, checksum: hashTaskCurrentBucket([[key, result]]) }]));
  const projectionChecksums = results.map((result) => {
    const projection: TaskCurrentProjection = { version: taskCurrentStateVersion, projectId: 'project-a', ledger: { cards: [], annotations: [], relationships: [] }, conflicts: [], clock: {} };
    materializeTaskCurrentEntity(projection, result);
    return sha256(canonicalJson({ ledger: projection.ledger, conflicts: projection.conflicts }));
  });
  assert.equal(new Set(roots).size, 1);
  assert.equal(new Set(projectionChecksums).size, 1);
  assert.equal(taskCurrentBucketForEntityKey(key).length, 2);
});

test('join is associative, commutative, and idempotent', () => {
  const a = entity('desktop', { title: register('desktop', 1, 'A') });
  const b = entity('mobile', { title: register('mobile', 1, 'B') });
  const c = entity('tablet', { createdAt: register('tablet', 1, '2026-07-21T00:00:00.000Z') });
  assert.deepEqual(joinTaskEntities(joinTaskEntities(a, b), c), joinTaskEntities(a, joinTaskEntities(b, c)));
  assert.deepEqual(joinTaskEntities(a, b), joinTaskEntities(b, a));
  assert.deepEqual(joinTaskEntities(a, a), a);
});

test('generated concurrent registers satisfy the entity algebra', () => {
  let seed = 0x6d2b79f5;
  const next = (): number => {
    seed = Math.imul(seed ^ seed >>> 15, 1 | seed);
    seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed);
    return (seed ^ seed >>> 14) >>> 0;
  };
  for (let sample = 0; sample < 128; sample += 1) {
    const a = entity(`desktop-${sample}`, { title: register(`desktop-${sample}`, 1 + next() % 1000, `A-${next()}`) });
    const b = entity(`mobile-${sample}`, { title: register(`mobile-${sample}`, 1 + next() % 1000, `B-${next()}`) });
    const c = entity(`tablet-${sample}`, { createdAt: register(`tablet-${sample}`, 1 + next() % 1000, new Date(next() * 1000).toISOString()) });
    assert.deepEqual(joinTaskEntities(joinTaskEntities(a, b), c), joinTaskEntities(a, joinTaskEntities(b, c)));
    assert.deepEqual(joinTaskEntities(a, b), joinTaskEntities(b, a));
    assert.deepEqual(joinTaskEntities(a, a), a);
  }
});

test('epoch-3 admission rejects legacy, overlapping, invalid atomic, and oversized structural lanes', () => {
  assert.throws(() => entity('desktop', { status: register('desktop', 1, 'todo') }), /invalid_task_current_card_lane/);
  assert.throws(() => entity('desktop', { replicationState: register('desktop', 1, 'local-only') }), /invalid_task_current_card_lane/);
  assert.throws(() => entity('desktop', { persistenceState: register('desktop', 1, 'creating') }), /invalid_task_current_card_lane/);
  assert.throws(() => entity('desktop', { lifecycle: register('desktop', 1, { status: 'blocked', changedAt: 'x', waitingAt: null, closedAt: null }) }), /invalid_task_current_lifecycle/);
  assert.throws(() => entity('desktop', {
    lifecycle: register('desktop', 1, { status: 'todo', changedAt: 'x', waitingAt: 'x', closedAt: null }),
    'lifecycle/status': register('desktop', 1, 'todo'),
  }), /overlapping_task_current_lanes|invalid_task_current_card_lane/);
  assert.throws(() => entity('desktop', { 'executionIntent/state': register('desktop', 1, 'running') }), /invalid_task_current_card_lane/);
  assert.throws(() => entity('desktop', { executionIntent: register('desktop', 1, { id: 'run-a', state: 'running', updatedAt: 'legacy' }) }), /invalid_task_current_execution_intent/);
  assert.throws(() => finalizeTaskCurrentEntity({ version: taskCurrentStateVersion, projectId: 'project-a', entityType: 'thread-note', entityId: 'thread-a/note-a', fields: { message: register('desktop', 1, 'large body') } }), /invalid_task_current_thread_note_narrative_lane/);
  assert.throws(() => entity('desktop', { title: register('desktop', 1, 'x'.repeat(taskCurrentEntityByteLimit)) }), /task_current_entity_too_large/);
});

test('wire hashes exclude local publication metadata by rejecting it as an unhashed extension', () => {
  const valid = entity('desktop', { title: register('desktop', 1, 'A') });
  const invalid = { ...valid, replication: 'held', activationTaskId: 'card-a' } as unknown as TaskCurrentEntity;
  assert.throws(() => assertTaskCurrentEntity(invalid), /invalid_task_current_entity_hash/);
});
