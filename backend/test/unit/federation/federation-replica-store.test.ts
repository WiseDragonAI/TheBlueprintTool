import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createFederationReplicaStore, type FederationReplicaSnapshot } from '../../../src/business/federation/helper/federation-replica-store.js';

function snapshot(revision: string, generatedAt: string): FederationReplicaSnapshot {
  return {
    version: 1,
    revision,
    generatedAt,
    project: { id: 'project-a', name: 'A', ledgers: [] },
    controlRoom: { allTasks: [{ projectId: 'project-a', status: 'task-waiting' }] },
    state: { projectId: 'project-a', ledgers: [] },
    ledgers: {},
  };
}

test('persists replicas and schedules selected work ahead of the normal backlog', () => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-replicas-'));
  let current = new Date('2026-07-17T10:00:00.000Z');
  const store = createFederationReplicaStore({ decisionOsRoot, now: () => current });
  store.setPeer('peer-a', 'Peer A', true);
  store.enqueue('peer-a', 'project-a');
  store.enqueue('peer-a', 'project-b');
  store.enqueue('peer-a', 'project-b', 'selected', '/cards/card-b');
  assert.equal(store.next('peer-a')?.projectId, 'project-b');
  assert.equal(store.next('peer-a')?.priority, 'selected');

  store.complete('peer-a', 'project-b', snapshot('new', '2026-07-17T10:00:00.000Z'));
  current = new Date('2026-07-17T10:01:00.000Z');
  store.complete('peer-a', 'project-b', snapshot('stale', '2026-07-17T09:00:00.000Z'));
  assert.equal(store.replica('peer-a', 'project-b')?.revision, 'new', 'an older revision cannot replace a verified replica');

  const restored = createFederationReplicaStore({ decisionOsRoot, now: () => current });
  assert.equal(restored.replica('peer-a', 'project-b')?.revision, 'new');
  assert.equal(restored.next('peer-a')?.projectId, 'project-a');
  restored.setPeer('peer-a', 'Peer A', false);
  assert.equal(restored.status('peer-a', 'project-b').status, 'offline');
  assert.doesNotThrow(() => JSON.parse(readFileSync(restored.file, 'utf8')));
});

test('retains failed work with retry metadata and exposes blocked state without data', () => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-replica-retry-'));
  let current = new Date('2026-07-17T10:00:00.000Z');
  const store = createFederationReplicaStore({ decisionOsRoot, now: () => current });
  store.setPeer('peer-a', 'Peer A', true);
  store.enqueue('peer-a', 'project-a', 'selected', '/cards/card-a');
  store.fail('peer-a', 'project-a', 'owner rejected snapshot');
  assert.equal(store.next('peer-a'), null, 'backoff prevents a hot retry loop');
  assert.equal(store.status('peer-a', 'project-a').status, 'blocked');
  assert.equal(store.status('peer-a', 'project-a').message, 'owner rejected snapshot');
  current = new Date('2026-07-17T10:01:00.000Z');
  assert.equal(store.next('peer-a')?.resource, '/cards/card-a');
});
