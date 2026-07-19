import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createFederationTaskStateReplicator } from '../../../src/business/federation/helper/federation-task-state-replicator.js';
import type { FederationStateFrame } from '../../../src/business/federation/helper/federation-node-connector.js';
import { createTaskFieldEvent } from '../../../src/business/task-state/helper/task-event-codec.js';
import { createTaskEventStore } from '../../../src/business/task-state/helper/task-event-store.js';

test('priority state lane delivers, persists, acknowledges, and repairs offline events', async (context) => {
  const rootA = mkdtempSync(resolve(tmpdir(), 'decision-os-state-a-'));
  const rootB = mkdtempSync(resolve(tmpdir(), 'decision-os-state-b-'));
  context.after(() => { rmSync(rootA, { recursive: true, force: true }); rmSync(rootB, { recursive: true, force: true }); });
  const storeA = createTaskEventStore({ decisionOsRoot: resolve(rootA, 'owned'), projectId: 'project-a' });
  const storeB = createTaskEventStore({ decisionOsRoot: resolve(rootB, 'owned'), projectId: 'project-a' });
  const remoteAAtB = createTaskEventStore({ decisionOsRoot: resolve(rootB, 'remote-node-a'), projectId: 'project-a' });
  const remoteBAtA = createTaskEventStore({ decisionOsRoot: resolve(rootA, 'remote-node-b'), projectId: 'project-a' });
  let online = true;
  let replicatorA: ReturnType<typeof createFederationTaskStateReplicator>;
  let replicatorB: ReturnType<typeof createFederationTaskStateReplicator>;
  const deliver = (from: string, to: string, frame: Omit<FederationStateFrame, 'from'>): boolean => {
    if (!online) return false;
    const target = to === 'node-a' ? replicatorA : replicatorB;
    queueMicrotask(() => void target.handleFrame({ ...frame, from }));
    return true;
  };
  replicatorA = createFederationTaskStateReplicator({ nodeId: 'node-a', stores: () => new Map([['project-a', storeA]]), storeFor: () => remoteBAtA, peers: () => [{ nodeId: 'node-b', online }], publish: (to, frame) => deliver('node-a', to, frame) });
  replicatorB = createFederationTaskStateReplicator({ nodeId: 'node-b', stores: () => new Map([['project-a', storeB]]), storeFor: () => remoteAAtB, peers: () => [{ nodeId: 'node-a', online }], publish: (to, frame) => deliver('node-b', to, frame) });

  const first = createTaskFieldEvent({ eventId: 'event-a', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T01:00:00.000Z', entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'todo' }] });
  storeA.append(first);
  replicatorA.publishEvent(first);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  assert.equal(remoteAAtB.events().length, 1);
  assert.equal(storeA.pendingFor('node-b').length, 0);

  online = false;
  const second = createTaskFieldEvent({ eventId: 'event-b', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T02:00:00.000Z', entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'done' }] });
  storeA.append(second);
  replicatorA.publishEvent(second);
  assert.equal(storeA.pendingFor('node-b').length, 1);
  online = true;
  replicatorA.reconcilePeer('node-b');
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
  assert.equal(remoteAAtB.events().length, 2);
  assert.equal(storeA.pendingFor('node-b').length, 0);
  assert.equal((remoteAAtB.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
});

test('blank node installs a verified snapshot without replaying covered history', async (context) => {
  const rootA = mkdtempSync(resolve(tmpdir(), 'decision-os-bootstrap-a-'));
  const rootB = mkdtempSync(resolve(tmpdir(), 'decision-os-bootstrap-b-'));
  context.after(() => { rmSync(rootA, { recursive: true, force: true }); rmSync(rootB, { recursive: true, force: true }); });
  const storeA = createTaskEventStore({ decisionOsRoot: resolve(rootA, 'owned'), projectId: 'project-a' });
  const storeB = createTaskEventStore({ decisionOsRoot: resolve(rootB, 'owned'), projectId: 'project-a' });
  const remoteAAtB = createTaskEventStore({ decisionOsRoot: resolve(rootB, 'remote-node-a'), projectId: 'project-a' });
  const remoteBAtA = createTaskEventStore({ decisionOsRoot: resolve(rootA, 'remote-node-b'), projectId: 'project-a' });
  storeA.append(createTaskFieldEvent({ eventId: 'covered', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T01:00:00.000Z', entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'done' }] }));
  storeA.createSnapshot();
  let replicatorA: ReturnType<typeof createFederationTaskStateReplicator>;
  let replicatorB: ReturnType<typeof createFederationTaskStateReplicator>;
  const deliver = (from: string, to: string, frame: Omit<FederationStateFrame, 'from'>): boolean => {
    queueMicrotask(() => void (to === 'node-a' ? replicatorA : replicatorB).handleFrame({ ...frame, from }));
    return true;
  };
  replicatorA = createFederationTaskStateReplicator({ nodeId: 'node-a', stores: () => new Map([['project-a', storeA]]), storeFor: () => remoteBAtA, peers: () => [{ nodeId: 'node-b', online: true }], publish: (to, frame) => deliver('node-a', to, frame) });
  replicatorB = createFederationTaskStateReplicator({ nodeId: 'node-b', stores: () => new Map([['project-a', storeB]]), storeFor: () => remoteAAtB, peers: () => [{ nodeId: 'node-a', online: true }], publish: (to, frame) => deliver('node-b', to, frame) });
  replicatorA.reconcilePeer('node-b');
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
  assert.equal(remoteAAtB.snapshots().length, 1);
  assert.equal(remoteAAtB.events().length, 0, 'covered history is represented by the verified snapshot');
  assert.equal((remoteAAtB.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
  assert.deepEqual(remoteAAtB.bucketManifest(), storeA.bucketManifest());

  const retroactive = createTaskFieldEvent({ eventId: 'late-covered', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T00:30:00.000Z', entityType: 'card', entityId: 'card-b', changes: [{ path: 'status', operation: 'set', value: 'todo' }] });
  storeA.append(retroactive);
  replicatorA.publishEvent(retroactive);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  assert.equal(remoteAAtB.events().length, 0, 'a newer verified snapshot replaces covered history without a genesis replay');
  assert.equal((remoteAAtB.projection().ledger.cards as Array<Record<string, unknown>>).find((card) => card.id === 'card-b')?.status, 'todo');
  assert.equal(storeA.pendingFor('node-b').length, 0);
});
