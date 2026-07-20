import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createFederationTaskStateReplicator } from '../../../src/business/federation/helper/federation-task-state-replicator.js';
import type { FederationStateFrame } from '../../../src/business/federation/helper/federation-node-connector.js';
import { createTaskFieldEvent, sha256 } from '../../../src/business/task-state/helper/task-event-codec.js';
import { createTaskEventStore, type TaskEventStore } from '../../../src/business/task-state/helper/task-event-store.js';
import type { TaskFieldEvent } from '../../../src/business/task-state/helper/task-event-types.js';

type Replicator = ReturnType<typeof createFederationTaskStateReplicator>;

function createRelay() {
  const events = new Map<string, Map<string, TaskFieldEvent>>();
  const nodes = new Map<string, { replicator: Replicator; online: boolean }>();
  const deliver = (nodeId: string, frame: Omit<FederationStateFrame, 'from'>): void => {
    const node = nodes.get(nodeId);
    if (node?.online) queueMicrotask(() => void node.replicator.handleFrame({ ...frame, from: 'relay' }));
  };
  return {
    register(nodeId: string, replicator: Replicator): void { nodes.set(nodeId, { replicator, online: true }); },
    setOnline(nodeId: string, online: boolean): void { nodes.get(nodeId)!.online = online; },
    publish(from: string, target: string, frame: Omit<FederationStateFrame, 'from'>): boolean {
      if (target !== 'relay') return false;
      const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
      if (frame.type === 'state-event-batch') {
        const project = events.get(frame.projectId) ?? new Map<string, TaskFieldEvent>();
        const batch = Array.isArray(payload.events) ? payload.events as TaskFieldEvent[] : [];
        for (const event of batch) project.set(event.eventId, event);
        events.set(frame.projectId, project);
        deliver(from, { type: 'state-relay-ack', projectId: frame.projectId, payload: { eventIds: batch.map((event) => event.eventId) } });
        for (const nodeId of nodes.keys()) if (nodeId !== from) deliver(nodeId, { type: 'state-event-batch', projectId: frame.projectId, payload: { events: batch } });
      }
      if (frame.type === 'state-bucket-summary') {
        const buckets = Array.isArray(payload.buckets) ? payload.buckets as Array<{ bucket: string }> : [];
        if (buckets.length > 0) deliver(from, { type: 'state-missing-request', projectId: frame.projectId, payload: { buckets: buckets.map((entry) => entry.bucket) } });
        const stored = [...(events.get(frame.projectId)?.values() ?? [])];
        if (stored.length > 0) deliver(from, { type: 'state-event-batch', projectId: frame.projectId, payload: { events: stored } });
      }
      return true;
    },
    eventCount(projectId: string): number { return events.get(projectId)?.size ?? 0; },
  };
}

function taskStore(root: string): TaskEventStore {
  return createTaskEventStore({ decisionOsRoot: root, projectId: 'project-a' });
}

test('relay durability acknowledges a writer while the destination is offline and repairs it later', async (context) => {
  const rootA = mkdtempSync(resolve(tmpdir(), 'decision-os-state-a-'));
  const rootB = mkdtempSync(resolve(tmpdir(), 'decision-os-state-b-'));
  context.after(() => { rmSync(rootA, { recursive: true, force: true }); rmSync(rootB, { recursive: true, force: true }); });
  const storeA = taskStore(rootA);
  const storeB = taskStore(rootB);
  const relay = createRelay();
  const replicatorA = createFederationTaskStateReplicator({ nodeId: 'node-a', stores: () => new Map([['project-a', storeA]]), storeFor: () => storeA, peers: () => [], publish: (to, frame) => relay.publish('node-a', to, frame) });
  const replicatorB = createFederationTaskStateReplicator({ nodeId: 'node-b', stores: () => new Map([['project-a', storeB]]), storeFor: () => storeB, peers: () => [], publish: (to, frame) => relay.publish('node-b', to, frame) });
  relay.register('node-a', replicatorA);
  relay.register('node-b', replicatorB);
  relay.setOnline('node-b', false);

  const event = createTaskFieldEvent({ eventId: 'event-a', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T01:00:00.000Z', entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'todo' }] });
  storeA.append(event);
  replicatorA.publishEvent(event);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
  assert.equal(relay.eventCount('project-a'), 1);
  assert.equal(storeA.pendingFor('relay').length, 0);
  assert.equal(storeB.events().length, 0);

  relay.setOnline('node-b', true);
  replicatorB.reconcileRelay();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
  assert.equal(storeB.events().length, 1);
  assert.equal((storeB.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
});

test('independent genesis event sets converge to one complete project projection', async (context) => {
  const rootA = mkdtempSync(resolve(tmpdir(), 'decision-os-genesis-a-'));
  const rootB = mkdtempSync(resolve(tmpdir(), 'decision-os-genesis-b-'));
  context.after(() => { rmSync(rootA, { recursive: true, force: true }); rmSync(rootB, { recursive: true, force: true }); });
  const storeA = taskStore(rootA);
  const storeB = taskStore(rootB);
  storeA.append(createTaskFieldEvent({ eventId: 'desktop-event', projectId: 'project-a', writerId: 'desktop', emittedAt: '2026-07-20T01:00:00.000Z', entityType: 'card', entityId: 'desktop-card', changes: [{ path: 'status', operation: 'set', value: 'todo' }] }));
  storeB.append(createTaskFieldEvent({ eventId: 'mobile-event', projectId: 'project-a', writerId: 'mobile', emittedAt: '2026-07-20T01:01:00.000Z', entityType: 'card', entityId: 'mobile-card', changes: [{ path: 'status', operation: 'set', value: 'todo' }] }));
  const relay = createRelay();
  const replicatorA = createFederationTaskStateReplicator({ nodeId: 'desktop', stores: () => new Map([['project-a', storeA]]), storeFor: () => storeA, peers: () => [], publish: (to, frame) => relay.publish('desktop', to, frame) });
  const replicatorB = createFederationTaskStateReplicator({ nodeId: 'mobile', stores: () => new Map([['project-a', storeB]]), storeFor: () => storeB, peers: () => [], publish: (to, frame) => relay.publish('mobile', to, frame) });
  relay.register('desktop', replicatorA);
  relay.register('mobile', replicatorB);

  replicatorA.reconcileRelay();
  replicatorB.reconcileRelay();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  const idsA = (storeA.projection().ledger.cards as Array<Record<string, unknown>>).map((card) => card.id).sort();
  const idsB = (storeB.projection().ledger.cards as Array<Record<string, unknown>>).map((card) => card.id).sort();
  assert.deepEqual(idsA, ['desktop-card', 'mobile-card']);
  assert.deepEqual(idsB, idsA);
  assert.equal(relay.eventCount('project-a'), 2);
});

test('direct peer anti-entropy hydrates a remote-only project when relay durability is unavailable', async (context) => {
  const sourceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-direct-source-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-direct-remote-'));
  context.after(() => { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(remoteRoot, { recursive: true, force: true }); });
  const source = taskStore(sourceRoot);
  const remote = taskStore(remoteRoot);
  const event = createTaskFieldEvent({ eventId: 'direct-event', projectId: 'project-a', writerId: 'node-a', emittedAt: '2026-07-20T02:00:00.000Z', entityType: 'card', entityId: 'direct-card', changes: [{ path: 'status', operation: 'set', value: 'todo' }] });
  source.append(event);

  let replicatorA: Replicator;
  let replicatorB: Replicator;
  const route = (from: string, to: string, frame: Omit<FederationStateFrame, 'from'>): boolean => {
    if (to === 'relay') return true;
    const target = to === 'node-a' ? replicatorA : to === 'node-b' ? replicatorB : null;
    if (!target) return false;
    queueMicrotask(() => void target.handleFrame({ ...frame, from }));
    return true;
  };
  replicatorA = createFederationTaskStateReplicator({
    nodeId: 'node-a',
    stores: () => new Map([['project-a', source]]),
    storeFor: () => source,
    peers: () => [{ nodeId: 'node-b', online: true }],
    publish: (to, frame) => route('node-a', to, frame),
  });
  replicatorB = createFederationTaskStateReplicator({
    nodeId: 'node-b',
    stores: () => new Map(),
    storeFor: () => remote,
    peers: () => [{ nodeId: 'node-a', online: true }],
    publish: (to, frame) => route('node-b', to, frame),
  });

  replicatorA.reconcilePeer('node-b');
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));

  assert.equal(remote.snapshots().length, 1, 'covered history is installed as a verified peer checkpoint');
  assert.equal((remote.projection().ledger.cards as Array<Record<string, unknown>>)[0].id, 'direct-card');
  assert.equal(source.pendingFor('node-b').length, 0);
});

test('fresh node installs a relay checkpoint before requesting the uncovered event tail', async (context) => {
  const sourceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-source-'));
  const targetRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-checkpoint-target-'));
  context.after(() => { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(targetRoot, { recursive: true, force: true }); });
  const source = taskStore(sourceRoot);
  const target = taskStore(targetRoot);
  source.append(createTaskFieldEvent({ eventId: 'covered', projectId: 'project-a', writerId: 'desktop', emittedAt: '2026-07-20T01:00:00.000Z', entityType: 'card', entityId: 'covered-card', changes: [{ path: 'status', operation: 'set', value: 'done' }] }));
  const snapshot = source.createSnapshot();
  const bytes = Buffer.from(JSON.stringify(snapshot));
  const published: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    nodeId: 'mobile',
    stores: () => new Map([['project-a', target]]),
    storeFor: () => target,
    peers: () => [],
    publish: (_to, frame) => { published.push(frame); return true; },
  });

  await replicator.handleFrame({ type: 'state-snapshot-manifest', from: 'relay', projectId: 'project-a', payload: { manifests: [snapshot.manifest] } });
  assert.equal(published.at(-1)?.type, 'state-snapshot-request');
  await replicator.handleFrame({ type: 'state-bucket-summary', from: 'relay', projectId: 'project-a', payload: { buckets: source.bucketManifest() } });
  assert.equal(published.at(-1)?.type, 'state-snapshot-request', 'event repair waits until checkpoint installation');
  await replicator.handleFrame({ type: 'state-snapshot-chunk', from: 'relay', projectId: 'project-a', payload: { transferId: 'checkpoint', index: 0, total: 1, checksum: sha256(bytes), data: bytes.toString('base64') } });
  await replicator.handleFrame({ type: 'state-snapshot-end', from: 'relay', projectId: 'project-a', payload: { transferId: 'checkpoint', total: 1, checksum: sha256(bytes) } });

  assert.equal(target.events().length, 0, 'covered history remains compacted in the verified checkpoint');
  assert.equal((target.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'done');
  assert.equal(published.at(-1)?.type, 'state-bucket-summary', 'tail reconciliation resumes after checkpoint installation');
});
