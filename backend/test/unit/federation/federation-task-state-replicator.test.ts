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
import type { TaskCurrentBucket, TaskCurrentEntity } from '../../../src/business/task-state/helper/task-current-state-types.js';

type Replicator = ReturnType<typeof createFederationTaskStateReplicator>;

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
  const deliver = (nodeId: string, frame: Omit<FederationStateFrame, 'from'>): void => {
    const node = nodes.get(nodeId);
    if (node?.online) queueMicrotask(() => {
      const operation = node.replicator.handleFrame({ ...frame, from: 'relay' });
      pending.add(operation);
      void operation.finally(() => pending.delete(operation));
    });
  };
  return {
    register(nodeId: string, replicator: Replicator): void { nodes.set(nodeId, { online: true, replicator }); },
    online(nodeId: string, value: boolean): void { nodes.get(nodeId)!.online = value; },
    async settle(): Promise<void> {
      await Promise.resolve();
      while (pending.size > 0) {
        await Promise.all([...pending]);
        await Promise.resolve();
      }
    },
    async publish(from: string, target: string, frame: Omit<FederationStateFrame, 'from'>): Promise<void> {
      if (target !== 'relay') {
        const node = nodes.get(target);
        if (node?.online) await node.replicator.handleFrame({ ...frame, from });
        return;
      }
      const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
      if (frame.type === 'state-entity-batch') {
        const entities = Array.isArray(payload.entities) ? payload.entities as TaskCurrentEntity[] : [];
        const result = await relayStore.merge({ version: 2, projectId: frame.projectId, entities });
        deliver(from, { type: 'state-relay-ack', projectId: frame.projectId, payload: {} });
        if (result.changed) for (const nodeId of nodes.keys()) if (nodeId !== from) deliver(nodeId, { type: 'state-entity-batch', projectId: frame.projectId, payload: { entities: result.delta.entities } });
      }
      if (frame.type === 'state-bucket-summary') {
        const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskCurrentBucket[] : [];
        const buckets = mismatched(relayStore.bucketManifest(), remote);
        if (buckets.length > 0) {
          deliver(from, { type: 'state-entity-batch', projectId: frame.projectId, payload: { entities: relayStore.entitiesForBuckets(buckets) } });
          deliver(from, { type: 'state-missing-request', projectId: frame.projectId, payload: { buckets } });
        }
      }
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
  const mutation = await a.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'todo' }] }] });
  replicaA.publishDelta(mutation.delta);
  await waitFor(() => Boolean((b.store.projection().ledger.cards as Array<Record<string, unknown>>)[0]));
  assert.equal((b.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(relay.store.rootHash(), a.store.rootHash());
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
  const mutation = await a.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'done' }] }] });
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
