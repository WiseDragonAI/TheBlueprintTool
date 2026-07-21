/**
 * WHAT: Verifies immediate current-state delivery and bucket repair through the relay contract.
 * WHY: Offline replicas must converge without durable outboxes, snapshots, and historical event replay.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createFederationTaskStateReplicator } from '../../../src/business/federation/helper/federation-task-state-replicator.js';
import type { FederationStateFrame } from '../../../src/business/federation/helper/federation-node-connector.js';
import { createTaskCurrentStateStore, type TaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity } from '../../../src/business/task-state/helper/task-current-state-types.js';
import { taskCurrentEntityKey } from '../../../../shared/task-current-state-core.js';

type Replicator = ReturnType<typeof createFederationTaskStateReplicator>;
const lifecycle = (status: 'todo' | 'done') => ({ status, changedAt: '2026-07-21T00:00:00.000Z', waitingAt: status === 'todo' ? '2026-07-21T00:00:00.000Z' : null, closedAt: status === 'done' ? '2026-07-21T00:00:00.000Z' : null });

function mismatched(left: TaskCurrentBucket[], right: TaskCurrentBucket[]): string[] {
  const a = new Map(left.map((entry) => [entry.bucket, entry]));
  const b = new Map(right.map((entry) => [entry.bucket, entry]));
  return [...new Set([...a.keys(), ...b.keys()])].filter((bucket) => a.get(bucket)?.checksum !== b.get(bucket)?.checksum || a.get(bucket)?.count !== b.get(bucket)?.count);
}

function fixture(prefix: string): { root: string; store: TaskCurrentStateStore } {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  return { root, store: createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} }) };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for replicated current state.');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
}

function relayHarness(relayStore: TaskCurrentStateStore) {
  const nodes = new Map<string, { online: boolean; replicator: Replicator }>();
  const pending = new Set<Promise<void>>();
  let relaySequence = Promise.resolve();
  const deliver = (nodeId: string, frame: Omit<FederationStateFrame, 'from'>): void => {
    const node = nodes.get(nodeId);
    if (node?.online) queueMicrotask(() => {
      const operation = node.replicator.handleFrame({ ...frame, from: 'relay' });
      pending.add(operation);
      void operation.finally(() => pending.delete(operation));
    });
  };
  const processRelayFrame = async (from: string, frame: Omit<FederationStateFrame, 'from'>): Promise<void> => {
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    if (frame.type === 'state-entity-batch') {
      const entries = Array.isArray(payload.entries) ? payload.entries as Array<{ key: string; stateHash: string; entity: TaskCurrentEntity }> : [];
      const entities = entries.map((entry) => entry.entity);
      const result = await relayStore.merge({ version: taskCurrentStateVersion, projectId: frame.projectId, entities });
      deliver(from, { type: 'state-relay-ack', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted: entries.map((entry) => ({ key: entry.key, stateHash: relayStore.entity(entry.entity.entityType, entry.entity.entityId)?.stateHash })), root: relayStore.rootHash() } });
      if (result.changed) for (const nodeId of nodes.keys()) if (nodeId !== from) deliver(nodeId, { type: 'state-entity-batch', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: result.delta.entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })) } });
    }
    if (frame.type === 'state-bucket-summary') {
      const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskCurrentBucket[] : [];
      const buckets = mismatched(relayStore.bucketManifest(), remote);
      if (buckets.length > 0) {
        const entities = relayStore.entitiesForBuckets(buckets);
        deliver(from, { type: 'state-entity-batch', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })) } });
        deliver(from, { type: 'state-missing-request', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, buckets } });
      }
      deliver(from, { type: 'state-bucket-summary', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: relayStore.rootHash(), buckets: relayStore.bucketManifest() } });
    }
    if (frame.type === 'state-subscribe') deliver(from, { type: 'state-bucket-summary', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: relayStore.rootHash(), buckets: relayStore.bucketManifest() } });
    if (frame.type === 'state-missing-request') {
      const buckets = Array.isArray(payload.buckets) ? payload.buckets.map(String) : [];
      const entities = relayStore.entitiesForBuckets(buckets);
      deliver(from, { type: 'state-entity-batch', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })) } });
    }
  };
  return {
    register(nodeId: string, replicator: Replicator): void { nodes.set(nodeId, { online: true, replicator }); },
    online(nodeId: string, value: boolean): void { nodes.get(nodeId)!.online = value; },
    async settle(): Promise<void> {
      await relaySequence;
      await Promise.resolve();
      while (pending.size > 0) {
        await Promise.all([...pending]);
        await relaySequence;
        await Promise.resolve();
      }
    },
    async publish(from: string, target: string, frame: Omit<FederationStateFrame, 'from'>): Promise<void> {
      if (target !== 'relay') {
        const node = nodes.get(target);
        if (node?.online) await node.replicator.handleFrame({ ...frame, from });
        return;
      }
      const operation = relaySequence.then(() => processRelayFrame(from, frame));
      relaySequence = operation.catch(() => undefined);
      await operation;
    },
  };
}

test('live delta reaches the relay and online replica immediately after local durability', async (context) => {
  const a = fixture('decision-os-repl-a-');
  const b = fixture('decision-os-repl-b-');
  const relay = fixture('decision-os-repl-relay-');
  const harness = relayHarness(relay.store);
  context.after(async () => { await harness.settle(); await Promise.all([a.store.flush(), b.store.flush(), relay.store.flush()]); [a, b, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true })); });
  const create = (nodeId: string, store: TaskCurrentStateStore) => createFederationTaskStateReplicator({ stores: () => new Map([['project-a', store]]), storeFor: () => store, publish: (target, frame) => { void harness.publish(nodeId, target, frame); return true; } });
  const replicaA = create('desktop', a.store);
  const replicaB = create('mobile', b.store);
  harness.register('desktop', replicaA);
  harness.register('mobile', replicaB);
  const mutation = await a.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('todo') }] }] });
  replicaA.publishDelta(mutation.delta);
  await waitFor(() => Boolean((b.store.projection().ledger.cards as Array<Record<string, unknown>>)[0]));
  assert.equal((b.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(relay.store.rootHash(), a.store.rootHash());
  await waitFor(() => replicaA.diagnostics().runtimeDirty.length === 0);
});

test('offline replica repairs current mismatched buckets without an outbox or snapshot', async (context) => {
  const a = fixture('decision-os-repair-a-');
  const b = fixture('decision-os-repair-b-');
  const relay = fixture('decision-os-repair-relay-');
  const harness = relayHarness(relay.store);
  context.after(async () => { await harness.settle(); await Promise.all([a.store.flush(), b.store.flush(), relay.store.flush()]); [a, b, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true })); });
  const create = (nodeId: string, store: TaskCurrentStateStore) => createFederationTaskStateReplicator({ stores: () => new Map([['project-a', store]]), storeFor: () => store, publish: (target, frame) => { void harness.publish(nodeId, target, frame); return true; } });
  const replicaA = create('desktop', a.store);
  const replicaB = create('mobile', b.store);
  harness.register('desktop', replicaA);
  harness.register('mobile', replicaB);
  harness.online('mobile', false);
  const mutation = await a.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('done') }] }] });
  replicaA.publishDelta(mutation.delta);
  await waitFor(() => relay.store.rootHash() === a.store.rootHash());
  assert.equal(b.store.diagnostics().entityCount, 0);
  harness.online('mobile', true);
  replicaB.reconcileRelay();
  await waitFor(() => Boolean((b.store.projection().ledger.cards as Array<Record<string, unknown>>)[0]));
  assert.equal(b.store.rootHash(), relay.store.rootHash());
  assert.equal((b.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
});

test('remote project state is discovered on demand through an owner summary', async (context) => {
  const owner = fixture('decision-os-owner-state-');
  const requester = fixture('decision-os-requester-state-');
  const relay = fixture('decision-os-requester-relay-');
  await owner.store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Remote card' }] }],
  });
  const harness = relayHarness(relay.store);
  context.after(async () => {
    await harness.settle();
    await Promise.all([owner.store.flush(), requester.store.flush(), relay.store.flush()]);
    [owner, requester, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const create = (nodeId: string, store: TaskCurrentStateStore) => createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', store]]),
    storeFor: () => store,
    publish: (target, frame) => { void harness.publish(nodeId, target, frame); return true; },
  });
  const ownerReplica = create('desktop', owner.store);
  const requesterReplica = create('mobile', requester.store);
  harness.register('desktop', ownerReplica);
  harness.register('mobile', requesterReplica);

  requesterReplica.reconcileProject('desktop', 'project-a');

  await waitFor(() => requester.store.rootHash() === owner.store.rootHash());
  assert.equal((requester.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].title, 'Remote card');
});

test('blank remote-only node reaches the durable relay root while every owner is offline', async (context) => {
  const owner = fixture('decision-os-offline-owner-state-');
  const requester = fixture('decision-os-blank-requester-state-');
  const relay = fixture('decision-os-offline-owner-relay-');
  const mutation = await owner.store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Durable relay card' }] }],
  });
  await relay.store.merge(mutation.delta);
  const harness = relayHarness(relay.store);
  context.after(async () => {
    await harness.settle();
    await Promise.all([owner.store.flush(), requester.store.flush(), relay.store.flush()]);
    [owner, requester, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const requesterReplica = createFederationTaskStateReplicator({
    stores: () => new Map<string, TaskCurrentStateStore>(),
    storeFor: () => requester.store,
    publish: (target, frame) => { void harness.publish('blank', target, frame); return true; },
  });
  harness.register('blank', requesterReplica);

  requesterReplica.reconcileProject('relay', 'project-a');

  await waitFor(() => requester.store.rootHash() === relay.store.rootHash());
  await waitFor(() => requesterReplica.diagnostics().convergence.some((entry) => entry.peerId === 'relay' && entry.projectId === 'project-a' && entry.converged));
  assert.equal((requester.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].title, 'Durable relay card');
});

test('relay acknowledgements clear only matching entity hashes from the project dirty map', async (context) => {
  const node = fixture('decision-os-ack-correlation-');
  context.after(async () => { await node.store.flush(); rmSync(node.root, { recursive: true, force: true }); });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', node.store]]),
    publish: (_target, frame) => { sent.push(frame); return true; },
  });
  const left = await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'left', changes: [{ path: 'title', operation: 'set', value: 'Left' }] }] });
  const right = await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'right', changes: [{ path: 'title', operation: 'set', value: 'Right' }] }] });
  replicator.publishDelta({ version: taskCurrentStateVersion, projectId: 'project-a', entities: [...left.delta.entities, ...right.delta.entities] });
  const delivery = sent.find((frame) => frame.type === 'state-entity-batch')!;
  const payload = delivery.payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> };
  await replicator.handleFrame({ type: 'state-relay-ack', from: 'relay', projectId: 'project-a', payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted: payload.entries.map((entry, index) => ({ key: entry.key, stateHash: index === 0 ? '0'.repeat(64) : entry.stateHash })) } });
  assert.equal(replicator.diagnostics().runtimeDirty.length, 1);
  assert.equal(replicator.diagnostics().runtimeDirty[0].entityKey, payload.entries[0].key);
});

test('duplicate entity delivery performs no second projection callback', async (context) => {
  const source = fixture('decision-os-duplicate-source-');
  const target = fixture('decision-os-duplicate-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const mutation = await source.store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('todo') }] }],
  });
  let projectionChanges = 0;
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    storeFor: () => target.store,
    publish: () => true,
    onProjectionChange: () => { projectionChanges += 1; },
  });
  const frame: FederationStateFrame = {
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: 'delivery-a',
      entries: mutation.delta.entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })),
    },
  };

  await replicator.handleFrame(frame);
  await replicator.handleFrame(frame);

  assert.equal(projectionChanges, 1);
});

test('large current-state publication is split by encoded bytes as well as entity count', async (context) => {
  const node = fixture('decision-os-byte-bounded-');
  context.after(async () => { await node.store.flush(); rmSync(node.root, { recursive: true, force: true }); });
  for (let index = 0; index < 10; index += 1) {
    await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: `card-${index}`, changes: [{ path: 'title', operation: 'set', value: `${index}${'x'.repeat(59_000)}` }] }] });
  }
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({ stores: () => new Map([['project-a', node.store]]), publish: (_target, frame) => { sent.push(frame); return true; } });
  replicator.publishDelta(node.store.activeDelta());
  const batches = sent.filter((frame) => frame.type === 'state-entity-batch');
  assert.ok(batches.length > 1);
  for (const frame of batches) {
    const encoded = JSON.stringify({ version: 1, type: frame.type, stateVersion: taskCurrentStateVersion, projectId: frame.projectId, payload: frame.payload });
    assert.ok(Buffer.byteLength(encoded) <= 512 * 1024);
    assert.ok(((frame.payload as { entries: unknown[] }).entries).length <= 128);
  }
});
