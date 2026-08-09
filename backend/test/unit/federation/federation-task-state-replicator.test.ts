/**
 * WHAT: Verifies immediate current-state delivery and bucket repair through the relay contract.
 * WHY: Offline replicas must converge without durable outboxes, snapshots, and historical event replay.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createFederationTaskStateReplicator } from '../../../src/business/federation/helper/federation-task-state-replicator.js';
import type { FederationStateFrame } from '../../../src/business/federation/helper/federation-node-connector.js';
import { createTaskCurrentStateStore, type TaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity } from '../../../src/business/task-state/helper/task-current-state-types.js';
import { createTaskExecutionRepository } from '../../../src/business/task-state/helper/task-execution-repository.js';
import { finalizeTaskCurrentEntity, taskCurrentEntityKey } from '../../../../shared/task-current-state-core.js';
import { migrateTaskCurrentState } from '../../../src/business/task-state/helper/task-current-state-migration.js';

type Replicator = ReturnType<typeof createFederationTaskStateReplicator>;
const lifecycle = (status: 'todo' | 'done') => ({ status, changedAt: '2026-07-21T00:00:00.000Z', waitingAt: status === 'todo' ? '2026-07-21T00:00:00.000Z' : null, closedAt: status === 'done' ? '2026-07-21T00:00:00.000Z' : null });

function mismatched(left: TaskCurrentBucket[], right: TaskCurrentBucket[]): string[] {
  const a = new Map(left.map((entry) => [entry.bucket, entry]));
  const b = new Map(right.map((entry) => [entry.bucket, entry]));
  return [...new Set([...a.keys(), ...b.keys()])].filter((bucket) => a.get(bucket)?.checksum !== b.get(bucket)?.checksum || a.get(bucket)?.count !== b.get(bucket)?.count);
}

function fixture(prefix: string, projectId = 'project-a'): { root: string; store: TaskCurrentStateStore } {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  return { root, store: createTaskCurrentStateStore({ decisionOsRoot: root, projectId, initializeLedger: {} }) };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for replicated current state.');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
}

function relayHarness(relayStore: TaskCurrentStateStore) {
  const nodes = new Map<string, { online: boolean; replicator: Replicator; queue: Promise<void> }>();
  const pending = new Set<Promise<void>>();
  let relaySequence = Promise.resolve();
  const deliver = (nodeId: string, frame: Omit<FederationStateFrame, 'from'>, source = 'relay'): void => {
    const node = nodes.get(nodeId);
    // WHAT: Deliver relay frames on a fresh event-loop turn, as a socket would.
    // WHY: Recursive summary repair must not starve timers, while each socket still preserves frame order.
    if (node?.online) setImmediate(() => {
      const operation = node.queue.then(() => node.replicator.handleFrame({ ...frame, from: source }));
      node.queue = operation.catch(() => undefined);
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
      deliver(from, { type: 'state-relay-ack', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted: entries.map((entry) => ({ key: entry.key, stateHash: relayStore.entity(entry.entity.entityType, entry.entity.entityId)?.stateHash })) } });
      if (result.changed) for (const nodeId of nodes.keys()) if (nodeId !== from) deliver(nodeId, { type: 'state-entity-batch', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: result.delta.entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })) } });
    }
    if (frame.type === 'state-bucket-summary') {
      const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskCurrentBucket[] : [];
      const buckets = mismatched(relayStore.bucketManifest(), remote);
      if (buckets.length > 0) {
        const entities = relayStore.entitiesForBuckets(buckets);
        if (entities.length > 0) deliver(from, { type: 'state-entity-batch', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })) } });
        deliver(from, { type: 'state-missing-request', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, buckets } });
      }
      for (const nodeId of nodes.keys()) deliver(nodeId, { type: 'state-bucket-summary', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: relayStore.rootHash(), buckets: relayStore.bucketManifest() } });
    }
    if (frame.type === 'state-subscribe') deliver(from, { type: 'state-bucket-summary', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: relayStore.rootHash(), buckets: relayStore.bucketManifest() } });
    if (frame.type === 'state-missing-request') {
      const buckets = Array.isArray(payload.buckets) ? payload.buckets.map(String) : [];
      const entities = relayStore.entitiesForBuckets(buckets);
      if (entities.length > 0) deliver(from, { type: 'state-entity-batch', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })) } });
      deliver(from, { type: 'state-bucket-summary', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: relayStore.rootHash(), buckets: relayStore.bucketManifest() } });
    }
  };
  return {
    register(nodeId: string, replicator: Replicator): void { nodes.set(nodeId, { online: true, replicator, queue: Promise.resolve() }); },
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
        deliver(target, frame, from);
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

test('two-node task-content head converges after its live notification is dropped and the replica reconnects', async (context) => {
  const local = fixture('decision-os-content-reconnect-local-');
  const remote = fixture('decision-os-content-reconnect-remote-');
  const relay = fixture('decision-os-content-reconnect-relay-');
  const harness = relayHarness(relay.store);
  context.after(async () => {
    await harness.settle();
    await Promise.all([local.store.flush(), remote.store.flush(), relay.store.flush()]);
    [local, remote, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const create = (nodeId: string, store: TaskCurrentStateStore) => createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', store]]),
    storeFor: () => store,
    publish: (target, frame) => { void harness.publish(nodeId, target, frame); return true; },
  });
  const localReplicator = create('desktop', local.store);
  const remoteReplicator = create('mobile', remote.store);
  harness.register('desktop', localReplicator);
  harness.register('mobile', remoteReplicator);
  harness.online('mobile', false);
  const key = '.decision-os/threads/tasks/thread-card-a.md';
  const head = { type: 'thread-markdown', key, hash: 'a'.repeat(64), bytes: 91, changedAt: '2026-08-04T00:00:00.000Z' };
  const mutation = await local.store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'resource', entityId: key, changes: [{ path: 'head', operation: 'set', value: head }] }],
  });
  localReplicator.publishDelta(mutation.delta);
  await waitFor(() => relay.store.contentHeads(key)[0]?.hash === head.hash);
  assert.deepEqual(remote.store.contentHeads(key), []);

  harness.online('mobile', true);
  remoteReplicator.reconcileRelay();
  await waitFor(() => remote.store.contentHeads(key)[0]?.hash === head.hash);
  assert.deepEqual(remote.store.contentHeads(key).map((candidate) => ({
    type: candidate.type,
    key: candidate.key,
    hash: candidate.hash,
    bytes: candidate.bytes,
    changedAt: candidate.changedAt,
  })), [head]);
  assert.equal(remote.store.contentHeads(key)[0].sourceReplicaId, 'desktop');
  assert.equal(remote.store.rootHash(), relay.store.rootHash());
});

test('relay publication failure retains a completed execution as dirty state and converges after reconnect', async (context) => {
  const local = fixture('decision-os-execution-outage-local-');
  const remote = fixture('decision-os-execution-outage-remote-');
  const relay = fixture('decision-os-execution-outage-relay-');
  const harness = relayHarness(relay.store);
  let relayOnline = false;
  context.after(async () => {
    await harness.settle();
    await Promise.all([local.store.flush(), remote.store.flush(), relay.store.flush()]);
    [local, remote, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const localReplicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', local.store]]),
    storeFor: () => local.store,
    publish: (target, frame) => {
      if (target === 'relay' && !relayOnline) return false;
      void harness.publish('desktop', target, frame);
      return true;
    },
  });
  const remoteReplicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', remote.store]]),
    storeFor: () => remote.store,
    publish: (target, frame) => { void harness.publish('mobile', target, frame); return true; },
  });
  harness.register('desktop', localReplicator);
  harness.register('mobile', remoteReplicator);
  const executions = createTaskExecutionRepository({
    store: local.store,
    writerId: 'desktop',
    projectId: 'project-a',
  });
  await executions.admit({
    executorNodeId: 'desktop',
    metadata: {
      executionId: 'execution-outage',
      requestId: 'request-outage',
      sessionId: 'session-outage',
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'master-a',
      sourceCardId: 'master-a',
      ownerCardId: 'master-a',
      kind: 'thread',
      requestedAt: '2026-07-23T12:00:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  });
  await executions.transition('execution-outage', { phase: 'queued' });
  await executions.transition('execution-outage', { phase: 'starting' });
  await executions.transition('execution-outage', { phase: 'running' });
  await executions.transition('execution-outage', {
    phase: 'succeeded',
    result: { status: 'succeeded', summary: 'Completed while relay was unavailable.' },
  });
  const terminalEntity = local.store.entity('execution', 'execution-outage')!;
  localReplicator.publishDelta({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entities: [terminalEntity],
  });

  assert.equal(executions.find('execution-outage')?.lifecycle.phase, 'succeeded');
  assert.equal(relay.store.entity('execution', 'execution-outage'), null);
  assert.deepEqual(localReplicator.diagnostics().runtimeDirty.map((entry) => entry.entityKey), [taskCurrentEntityKey(terminalEntity)]);

  relayOnline = true;
  localReplicator.reconcileRelay();
  await waitFor(() => relay.store.entity('execution', 'execution-outage')?.stateHash === terminalEntity.stateHash);
  remoteReplicator.reconcileRelay();
  await waitFor(() => remote.store.entity('execution', 'execution-outage')?.stateHash === terminalEntity.stateHash);
  await waitFor(() => localReplicator.diagnostics().runtimeDirty.length === 0);
  assert.equal(local.store.rootHash(), relay.store.rootHash());
  assert.equal(remote.store.rootHash(), relay.store.rootHash());
});

test('independently migrated nodes automatically join through an empty relay at startup', async (context) => {
  const rootA = mkdtempSync(resolve(tmpdir(), 'decision-os-migrated-repl-a-'));
  const rootB = mkdtempSync(resolve(tmpdir(), 'decision-os-migrated-repl-b-'));
  const relay = fixture('decision-os-migrated-repl-relay-');
  const backupA = `${rootA}-rollback`;
  const backupB = `${rootB}-rollback`;
  const projectId = 'project-a';
  const tasksA = resolve(rootA, 'tasks.json');
  const tasksB = resolve(rootB, 'tasks.json');
  writeFileSync(tasksA, JSON.stringify({ cards: [{ id: 'shared', title: 'Desktop title' }, { id: 'desktop-only', title: 'Desktop only' }], annotations: [], relationships: [] }));
  writeFileSync(tasksB, JSON.stringify({ cards: [{ id: 'shared', title: 'Mobile title' }, { id: 'mobile-only', title: 'Mobile only' }], annotations: [], relationships: [] }));
  await migrateTaskCurrentState({ decisionOsRoot: rootA, projectId, nodeId: 'desktop', tasksLedgerFile: tasksA, backupRoot: backupA });
  await migrateTaskCurrentState({ decisionOsRoot: rootB, projectId, nodeId: 'mobile', tasksLedgerFile: tasksB, backupRoot: backupB });
  const a = createTaskCurrentStateStore({ decisionOsRoot: rootA, projectId });
  const b = createTaskCurrentStateStore({ decisionOsRoot: rootB, projectId });
  const harness = relayHarness(relay.store);
  context.after(async () => {
    await Promise.all([a.flush(), b.flush(), relay.store.flush()]);
    [rootA, rootB, relay.root, backupA, backupB].forEach((entry) => rmSync(entry, { recursive: true, force: true }));
  });
  const create = (nodeId: string, store: TaskCurrentStateStore) => createFederationTaskStateReplicator({
    stores: () => new Map([[projectId, store]]),
    storeFor: () => store,
    publish: (target, frame) => { void harness.publish(nodeId, target, frame); return true; },
  });
  const replicaA = create('desktop', a);
  const replicaB = create('mobile', b);
  harness.register('desktop', replicaA);
  harness.register('mobile', replicaB);

  replicaA.reconcileRelay();
  await waitFor(() => a.rootHash() === relay.store.rootHash(), 2_000);
  replicaB.reconcileRelay();

  await waitFor(() => a.rootHash() === relay.store.rootHash() && b.rootHash() === relay.store.rootHash(), 2_000);
  assert.deepEqual(new Set((a.projection().ledger.cards as Array<Record<string, unknown>>).map((card) => card.id)), new Set(['shared', 'desktop-only', 'mobile-only']));
  assert.deepEqual(a.projection(), b.projection());
  assert.equal(a.projection().conflicts.some((conflict) => conflict.entityId === 'shared' && conflict.path === 'title'), true);

  const postCutover = await a.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'desktop-only', changes: [{ path: 'title', operation: 'set', value: 'Writable after convergence' }] }] });
  replicaA.publishDelta(postCutover.delta);
  await waitFor(() => relay.store.rootHash() === a.rootHash() && b.rootHash() === a.rootHash(), 2_000);
  const executions = createTaskExecutionRepository({ store: a, writerId: 'desktop', projectId });
  await executions.admit({
    executorNodeId: 'desktop',
    metadata: {
      executionId: 'execution-convergence',
      requestId: 'request-convergence',
      sessionId: 'session-convergence',
      projectId,
      ledgerId: 'tasks',
      taskId: 'desktop-only',
      sourceCardId: 'desktop-only',
      ownerCardId: 'desktop-only',
      kind: 'thread',
      requestedAt: '2026-07-23T12:30:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  });
  await executions.transition('execution-convergence', { phase: 'queued' });
  await executions.transition('execution-convergence', { phase: 'starting' });
  await executions.transition('execution-convergence', { phase: 'running' });
  await executions.transition('execution-convergence', {
    phase: 'succeeded',
    result: { status: 'succeeded', summary: 'Converged execution.' },
  });
  const executionEntity = a.entity('execution', 'execution-convergence')!;
  replicaA.publishDelta({ version: taskCurrentStateVersion, projectId, entities: [executionEntity] });
  await waitFor(() => relay.store.rootHash() === a.rootHash() && b.rootHash() === a.rootHash(), 2_000);
  const projections = [a.projection(), b.projection(), relay.store.projection()];
  const taskCards = projections.map((projection) => projection.ledger.cards as Array<Record<string, unknown>>);
  const taskCounts = taskCards.map((cards) => cards.length);
  const assignments = taskCards.map((cards) => JSON.stringify(cards.map((card) => ({
    id: card.id,
    assignment: card.assignment,
  }))));
  const executionHistories = [a, b, relay.store].map((store) => createTaskExecutionRepository({
    store,
    writerId: 'audit',
    projectId,
  }).all());
  assert.deepEqual(new Set([a.rootHash(), b.rootHash(), relay.store.rootHash()]).size, 1);
  assert.deepEqual(new Set(taskCounts).size, 1);
  assert.deepEqual(new Set(assignments).size, 1);
  assert.deepEqual(executionHistories[0], executionHistories[1]);
  assert.deepEqual(executionHistories[0], executionHistories[2]);
  assert.equal(JSON.stringify(projections[0]), JSON.stringify(projections[1]));
  assert.equal(JSON.stringify(projections[0]), JSON.stringify(projections[2]));
  await Promise.all([a.flush(), b.flush()]);
  const restartedA = createTaskCurrentStateStore({ decisionOsRoot: rootA, projectId });
  const restartedB = createTaskCurrentStateStore({ decisionOsRoot: rootB, projectId });
  assert.equal(restartedA.rootHash(), restartedB.rootHash());
  assert.deepEqual(restartedA.projection(), restartedB.projection());
});

test('a dropped live batch is repaired from current shards through root anti-entropy', async (context) => {
  const node = fixture('decision-os-dropped-live-node-');
  const relay = fixture('decision-os-dropped-live-relay-');
  const harness = relayHarness(relay.store);
  context.after(async () => {
    await harness.settle();
    await Promise.all([node.store.flush(), relay.store.flush()]);
    [node, relay].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  let dropped = false;
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', node.store]]),
    storeFor: () => node.store,
    publish: (target, frame) => {
      // WHAT: Drop the first live entity frame while allowing its root advertisement through.
      // WHY: The repair loop must recover from transport loss without a durable event outbox.
      if (!dropped && target === 'relay' && frame.type === 'state-entity-batch') { dropped = true; return false; }
      void harness.publish('desktop', target, frame);
      return true;
    },
  });
  harness.register('desktop', replicator);
  const mutation = await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Recovered after loss' }] }] });

  replicator.publishDelta(mutation.delta);

  await waitFor(() => relay.store.rootHash() === node.store.rootHash());
  await waitFor(() => replicator.diagnostics().runtimeDirty.length === 0);
  assert.equal(dropped, true);
  assert.equal((relay.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].title, 'Recovered after loss');
});

test('reordered live batches converge to one root and canonical projection', async (context) => {
  const left = fixture('decision-os-reordered-left-');
  const right = fixture('decision-os-reordered-right-');
  const forward = fixture('decision-os-reordered-forward-');
  const reverse = fixture('decision-os-reordered-reverse-');
  context.after(async () => {
    await Promise.all([left.store.flush(), right.store.flush(), forward.store.flush(), reverse.store.flush()]);
    [left, right, forward, reverse].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const title = await left.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Independent title' }] }] });
  const status = await right.store.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle('done') }] }] });
  const frame = (deliveryId: string, entity: TaskCurrentEntity): FederationStateFrame => ({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, deliveryId, entries: [{ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }] },
  });
  const forwardReplicator = createFederationTaskStateReplicator({ stores: () => new Map([['project-a', forward.store]]), publish: () => true });
  const reverseReplicator = createFederationTaskStateReplicator({ stores: () => new Map([['project-a', reverse.store]]), publish: () => true });

  await forwardReplicator.handleFrame(frame('title-forward', title.delta.entities[0]));
  await forwardReplicator.handleFrame(frame('status-forward', status.delta.entities[0]));
  await reverseReplicator.handleFrame(frame('status-reverse', status.delta.entities[0]));
  await reverseReplicator.handleFrame(frame('title-reverse', title.delta.entities[0]));

  assert.equal(forward.store.rootHash(), reverse.store.rootHash());
  assert.deepEqual(forward.store.projection(), reverse.store.projection());
});

test('a rejected entity envelope changes no state and emits no projection invalidation', async (context) => {
  const target = fixture('decision-os-rejected-envelope-');
  const source = fixture('decision-os-rejected-envelope-source-');
  context.after(async () => {
    await Promise.all([target.store.flush(), source.store.flush()]);
    [target, source].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const mutation = await source.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Must be rejected' }] }] });
  const entity = mutation.delta.entities[0];
  const beforeRoot = target.store.rootHash();
  let invalidations = 0;
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: () => true,
    onProjectionChange: () => { invalidations += 1; },
  });

  await assert.rejects(replicator.handleFrame({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, deliveryId: 'rejected', entries: [{ key: 'card\u0000wrong', stateHash: entity.stateHash, entity }] },
  }), /invalid_state_entity_envelope/);

  assert.equal(target.store.rootHash(), beforeRoot);
  assert.equal(target.store.diagnostics().entityCount, 0);
  assert.equal(invalidations, 0);
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

test('relay acknowledgements require an exact accepted and rejected partition before settlement', async (context) => {
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
  await assert.rejects(replicator.handleFrame({ type: 'state-relay-ack', from: 'relay', projectId: 'project-a', payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted: payload.entries.map((entry, index) => ({ key: entry.key, stateHash: index === 0 ? '0'.repeat(64) : entry.stateHash })) } }), /invalid_state_acknowledgement/);
  assert.equal(replicator.diagnostics().runtimeDirty.length, 2);
  assert.deepEqual(replicator.diagnostics().pendingDeliveryIds, [payload.deliveryId]);

  await replicator.handleFrame({
    type: 'state-relay-ack',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: payload.deliveryId,
      accepted: [payload.entries[1]],
      rejected: [{
        code: 'task_current_dot_collision',
        key: payload.entries[0].key,
        stateHash: payload.entries[0].stateHash,
        receiverStateHash: '1'.repeat(64),
        collisions: [{ entityType: 'card', entityId: 'left', path: 'title', dot: { replicaId: 'desktop', counter: 1 } }],
      }],
    },
  });
  assert.equal(replicator.diagnostics().runtimeDirty.length, 1);
  assert.equal(replicator.diagnostics().runtimeDirty[0].entityKey, payload.entries[0].key);
  assert.equal(replicator.diagnostics().pendingDeliveryIds.length, 0);
});

test('relay publication advances a bounded project window and advertises only after settlement', async (context) => {
  const node = fixture('decision-os-single-flight-publication-');
  context.after(async () => { await node.store.flush(); rmSync(node.root, { recursive: true, force: true }); });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', node.store]]),
    publish: (_target, frame) => { sent.push(frame); return true; },
  });
  const left = await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'left', changes: [{ path: 'title', operation: 'set', value: 'Left' }] }] });
  replicator.publishDelta(left.delta);
  const firstBatch = sent.find((frame) => frame.type === 'state-entity-batch')!;
  const firstPayload = firstBatch.payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> };

  const right = await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'right', changes: [{ path: 'title', operation: 'set', value: 'Right' }] }] });
  replicator.publishDelta(right.delta);

  assert.equal(sent.filter((frame) => frame.type === 'state-entity-batch').length, 2);
  assert.equal(sent.filter((frame) => frame.type === 'state-bucket-summary').length, 0);

  await replicator.handleFrame({
    type: 'state-relay-ack',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: firstPayload.deliveryId,
      accepted: firstPayload.entries,
    },
  });
  const batches = sent.filter((frame) => frame.type === 'state-entity-batch');
  assert.equal(batches.length, 2);
  assert.equal(sent.filter((frame) => frame.type === 'state-bucket-summary').length, 0);
  const secondPayload = batches[1].payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> };

  await replicator.handleFrame({
    type: 'state-relay-ack',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: secondPayload.deliveryId,
      accepted: secondPayload.entries,
    },
  });

  assert.equal(sent.filter((frame) => frame.type === 'state-bucket-summary').length, 1);
  assert.equal(replicator.diagnostics().pendingDeliveryIds.length, 0);
  assert.equal(replicator.diagnostics().runtimeDirty.length, 0);
});

test('relay entity batches acknowledge without advertising intermediate roots', async (context) => {
  const source = fixture('decision-os-single-flight-source-');
  const target = fixture('decision-os-single-flight-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const first = await source.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'first', changes: [{ path: 'title', operation: 'set', value: 'First' }] }] });
  const second = await source.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'second', changes: [{ path: 'title', operation: 'set', value: 'Second' }] }] });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: (_target, frame) => { sent.push(frame); return true; },
  });
  const frame = (deliveryId: string, entity: TaskCurrentEntity): FederationStateFrame => ({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId,
      entries: [{ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }],
    },
  });

  const terminalSummary: FederationStateFrame = {
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      root: source.store.rootHash(),
      buckets: source.store.bucketManifest(),
    },
  };
  await replicator.handleFrame(terminalSummary);
  await replicator.handleFrame(frame('first-delivery', first.delta.entities[0]));
  await replicator.handleFrame(frame('second-delivery', second.delta.entities[0]));
  await replicator.handleFrame(terminalSummary);

  assert.equal(sent.filter((entry) => entry.type === 'state-relay-ack').length, 2);
  assert.equal(sent.filter((entry) => entry.type === 'state-bucket-summary').length, 0);
  assert.equal(sent.filter((entry) => entry.type === 'state-missing-request').length, 1);
  assert.equal(target.store.rootHash(), source.store.rootHash());
});

test('relay disconnect retires transport deliveries while preserving durable retry state', async (context) => {
  const node = fixture('decision-os-disconnect-retry-');
  context.after(async () => { await node.store.flush(); rmSync(node.root, { recursive: true, force: true }); });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', node.store]]),
    publish: (_target, frame) => { sent.push(frame); return true; },
  });
  const mutation = await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Retry me' }] }] });
  replicator.publishDelta(mutation.delta);
  assert.equal(replicator.diagnostics().pendingDeliveryIds.length, 1);

  replicator.disconnectPeer('relay');

  assert.equal(replicator.diagnostics().pendingDeliveryIds.length, 0);
  assert.equal(replicator.diagnostics().runtimeDirty.length, 1);
  replicator.reconcileRelay();
  assert.equal(sent.filter((frame) => frame.type === 'state-entity-batch').length, 2);
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

test('projection observer failure leaves the accepted causal state readable', async (context) => {
  const source = fixture('decision-os-observer-source-');
  const target = fixture('decision-os-observer-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const mutation = await source.store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Preserved task' }] }],
  });
  const errors: unknown[] = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    storeFor: () => target.store,
    publish: () => true,
    onProjectionChange: () => { throw new Error('projection-observer-failed'); },
    onProjectionError: ({ error }) => { errors.push(error); },
  });

  await replicator.handleFrame({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: 'delivery-observer',
      entries: mutation.delta.entities.map((entity) => ({
        key: taskCurrentEntityKey(entity),
        stateHash: entity.stateHash,
        entity,
      })),
    },
  });

  assert.match(String(errors[0]), /projection-observer-failed/);
  assert.equal((target.store.projection().ledger.cards as Array<Record<string, unknown>>)[0].title, 'Preserved task');
});

test('large current-state publication is split by encoded bytes as well as entity count', async (context) => {
  const node = fixture('decision-os-byte-bounded-');
  context.after(async () => { await node.store.flush(); rmSync(node.root, { recursive: true, force: true }); });
  for (let index = 0; index < 40; index += 1) {
    await node.store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: `card-${index}`, changes: [{ path: 'title', operation: 'set', value: `${index}${'x'.repeat(59_000)}` }] }] });
  }
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({ stores: () => new Map([['project-a', node.store]]), publish: (_target, frame) => { sent.push(frame); return true; } });
  replicator.publishDelta(node.store.activeDelta());
  let batches = sent.filter((frame) => frame.type === 'state-entity-batch');
  assert.equal(batches.length, 4);
  for (const frame of batches) {
    const encoded = JSON.stringify({ version: 1, type: frame.type, stateVersion: taskCurrentStateVersion, projectId: frame.projectId, payload: frame.payload });
    assert.ok(Buffer.byteLength(encoded) <= 512 * 1024);
    assert.ok(((frame.payload as { entries: unknown[] }).entries).length <= 128);
  }
  const first = batches[0].payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> };
  await replicator.handleFrame({ type: 'state-relay-ack', from: 'relay', projectId: 'project-a', payload: { stateVersion: taskCurrentStateVersion, deliveryId: first.deliveryId, accepted: first.entries } });
  batches = sent.filter((frame) => frame.type === 'state-entity-batch');
  assert.equal(batches.length, 5);
});

test('receiver durably accepts one byte-bounded relay repair frame above 128 entities', async (context) => {
  const source = fixture('decision-os-repair-wide-source-');
  const target = fixture('decision-os-repair-wide-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  for (let index = 0; index < 129; index += 1) {
    await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: `card-${index}`, changes: [{ path: 'title', operation: 'set', value: `Card ${index}` }] }] });
  }
  await source.store.flush();
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
  });
  await replicator.handleFrame({
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  });
  const request = sent.find((frame) => frame.type === 'state-missing-request')!;
  const attemptId = String((request.payload as { attemptId: string }).attemptId);
  const entries = source.store.activeDelta().entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }));
  assert.equal(entries.length, 129);
  await replicator.handleFrame({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, deliveryId: 'wide-delivery', attemptId, entries },
  });
  const acknowledgement = sent.find((frame) => frame.type === 'state-relay-ack')!;
  assert.equal((acknowledgement.payload as { accepted: unknown[] }).accepted.length, 129);
  assert.equal(target.store.rootHash(), source.store.rootHash());
});

test('enhanced receiver shares one project WAL commit across the bounded relay window', async (context) => {
  const source = fixture('decision-os-repair-group-source-');
  const target = fixture('decision-os-repair-group-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  for (let index = 0; index < 4; index += 1) {
    await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: `group-${index}`, changes: [{ path: 'title', operation: 'set', value: `Group ${index}` }] }] });
  }
  await source.store.flush();
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  let groupCommitCount = 0;
  const mergeRepairGroup = target.store.mergeRepairGroup.bind(target.store);
  target.store.mergeRepairGroup = async (...argumentsList) => {
    groupCommitCount += 1;
    return mergeRepairGroup(...argumentsList);
  };
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
  });
  await replicator.handleFrame({
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  });
  const request = sent.find((frame) => frame.type === 'state-missing-request')!;
  const attemptId = String((request.payload as { attemptId: string }).attemptId);
  const entities = source.store.activeDelta().entities.filter((entity) => entity.entityType === 'card');
  const operations = entities.map((entity, index) => replicator.handleFrame({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: `group-delivery-${index}`,
      attemptId,
      entries: [{ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }],
    },
  }));
  await Promise.all(operations);
  assert.equal(groupCommitCount, 1);
  assert.equal(sent.filter((frame) => frame.type === 'state-relay-ack').length, 4);
  assert.equal(replicator.diagnostics().receiverTiming.groupCommitCount, 1);
  assert.equal(replicator.diagnostics().receiverTiming.groupCommitFrameCount, 4);
});

test('enhanced repair durably partitions healthy state from a terminal collision without timing out or replaying the same summary', async (context) => {
  const source = fixture('decision-os-repair-collision-source-');
  const target = fixture('decision-os-repair-collision-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  const local = await target.store.mutate({ replicaId: 'workstation', changes: [{ entityType: 'card', entityId: 'collision-card', changes: [{ path: 'title', operation: 'set', value: 'Local' }] }] });
  await target.store.flush();
  const localEntity = local.delta.entities[0];
  const remoteCollision = finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entityType: 'card',
    entityId: 'collision-card',
    fields: { ...structuredClone(localEntity.fields), title: { ...structuredClone(localEntity.fields.title), candidates: [{ ...structuredClone(localEntity.fields.title.candidates[0]), value: 'Remote' }] } },
  });
  const healthy = finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entityType: 'card',
    entityId: 'healthy-card',
    fields: {
      '$entity': { clock: { relay: 1 }, candidates: [{ dot: { replicaId: 'relay', counter: 1 }, operation: 'set', value: true }] },
      title: { clock: { relay: 1 }, candidates: [{ dot: { replicaId: 'relay', counter: 1 }, operation: 'set', value: 'Healthy' }] },
    },
  });
  await source.store.merge({ version: taskCurrentStateVersion, projectId: 'project-a', entities: [healthy, remoteCollision] });
  await source.store.flush();
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const collisions: Array<{ attemptId: string; deliveryId: string; rejected: unknown[]; evidence: unknown[] }> = [];
  const timeouts: string[] = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
    noProgressTimeoutMs: 1_000,
    onRepairCollision: ({ attemptId, deliveryId, rejected, evidence }) => { collisions.push({ attemptId, deliveryId, rejected, evidence }); },
    onRepairTimeout: ({ attemptId }) => { timeouts.push(attemptId); },
  });
  const summary: FederationStateFrame = {
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  };
  await replicator.handleFrame(summary);
  const request = sent.find((frame) => frame.type === 'state-missing-request')!;
  const attemptId = String((request.payload as { attemptId: string }).attemptId);
  await replicator.handleFrame({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: 'mixed-delivery',
      attemptId,
      entries: [healthy, remoteCollision].map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })),
    },
  });

  const acknowledgement = sent.find((frame) => frame.type === 'state-relay-ack')!;
  const disposition = acknowledgement.payload as { accepted: Array<{ key: string }>; rejected: Array<{ key: string }> };
  assert.deepEqual(disposition.accepted.map(({ key }) => key), ['card\u0000healthy-card']);
  assert.deepEqual(disposition.rejected.map(({ key }) => key), ['card\u0000collision-card']);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].attemptId, attemptId);
  assert.equal(collisions[0].deliveryId, 'mixed-delivery');
  assert.equal(collisions[0].evidence.length, 1);
  assert.equal(target.store.projectedEntity('card', 'healthy-card')?.title, 'Healthy');
  assert.equal(target.store.projectedEntity('card', 'collision-card')?.title, 'Local');
  assert.equal(replicator.diagnostics().activeRepairCount, 0);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_100));
  assert.deepEqual(timeouts, []);

  const evidenceCountBeforeReplay = target.store.repairCollisionEvidence(attemptId).length;
  await replicator.handleFrame({
    type: 'state-entity-batch',
    from: 'relay',
    projectId: 'project-a',
    payload: {
      stateVersion: taskCurrentStateVersion,
      deliveryId: 'mixed-delivery',
      attemptId,
      entries: [healthy, remoteCollision].map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity })),
    },
  });
  const replayAcknowledgements = sent.filter((frame) => frame.type === 'state-relay-ack');
  assert.equal(replayAcknowledgements.length, 2);
  assert.deepEqual(replayAcknowledgements[1].payload, replayAcknowledgements[0].payload);
  assert.equal(target.store.repairCollisionEvidence(attemptId).length, evidenceCountBeforeReplay);

  await replicator.handleFrame(summary);
  assert.equal(sent.filter((frame) => frame.type === 'state-missing-request').length, 1);
  const restartedStore = createTaskCurrentStateStore({ decisionOsRoot: target.root, projectId: 'project-a' });
  assert.equal(restartedStore.repairCollisionEvidence(attemptId).length, 1);
  const restartedSent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const restartedReplicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', restartedStore]]),
    publish: (_peer, frame) => { restartedSent.push(frame); return true; },
  });
  restartedReplicator.restoreTerminalRepair('project-a', 'relay', attemptId);
  await restartedReplicator.handleFrame(summary);
  assert.equal(restartedSent.filter((frame) => frame.type === 'state-missing-request').length, 0);
});

test('enhanced relay repair coalesces final projection observation after exact convergence', async (context) => {
  const source = fixture('decision-os-repair-observer-source-');
  const target = fixture('decision-os-repair-observer-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: 'first', changes: [{ path: 'title', operation: 'set', value: 'First' }] }] });
  await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: 'second', changes: [{ path: 'title', operation: 'set', value: 'Second' }] }] });
  await source.store.flush();
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const observed: TaskCurrentEntity[][] = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
    onProjectionChange: ({ delta }) => { observed.push(delta.entities); },
  });
  const summary: FederationStateFrame = {
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  };
  await replicator.handleFrame(summary);
  const attemptId = String((sent.find((frame) => frame.type === 'state-missing-request')!.payload as { attemptId: string }).attemptId);
  for (const [index, entity] of source.store.activeDelta().entities.entries()) {
    await replicator.handleFrame({
      type: 'state-entity-batch',
      from: 'relay',
      projectId: 'project-a',
      payload: { stateVersion: taskCurrentStateVersion, deliveryId: `delivery-${index}`, attemptId, entries: [{ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }] },
    });
  }
  assert.equal(observed.length, 0);
  await replicator.handleFrame(summary);
  await waitFor(() => observed.length === 1);
  assert.deepEqual(observed[0].map(taskCurrentEntityKey).sort(), source.store.activeDelta().entities.map(taskCurrentEntityKey).sort());
  assert.equal(replicator.diagnostics().receiverTiming.pendingObserverCount, 0);
});

test('enhanced project observers wait until every active relay repair settles', async (context) => {
  const sourceA = fixture('decision-os-repair-observer-source-a-');
  const sourceB = fixture('decision-os-repair-observer-source-b-', 'project-b');
  const targetA = fixture('decision-os-repair-observer-target-a-');
  const targetB = fixture('decision-os-repair-observer-target-b-', 'project-b');
  context.after(async () => {
    await Promise.all([sourceA.store.flush(), sourceB.store.flush(), targetA.store.flush(), targetB.store.flush()]);
    [sourceA, sourceB, targetA, targetB].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  await sourceA.store.mutate({ replicaId: 'source-a', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'A' }] }] });
  await sourceB.store.mutate({ replicaId: 'source-b', changes: [{ entityType: 'card', entityId: 'card-b', changes: [{ path: 'title', operation: 'set', value: 'B' }] }] });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const observed: string[] = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', targetA.store], ['project-b', targetB.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
    onProjectionChange: ({ projectId }) => { observed.push(projectId); },
  });
  const summary = (projectId: string, store: typeof sourceA.store): FederationStateFrame => ({
    type: 'state-bucket-summary',
    from: 'relay',
    projectId,
    payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash(), buckets: store.bucketManifest() },
  });
  await replicator.handleFrame(summary('project-a', sourceA.store));
  await replicator.handleFrame(summary('project-b', sourceB.store));
  for (const [projectId, source] of [['project-a', sourceA], ['project-b', sourceB]] as const) {
    const request = sent.find((frame) => frame.type === 'state-missing-request' && frame.projectId === projectId)!;
    const attemptId = String((request.payload as { attemptId: string }).attemptId);
    const entity = source.store.activeDelta().entities[0];
    await replicator.handleFrame({
      type: 'state-entity-batch',
      from: 'relay',
      projectId,
      payload: { stateVersion: taskCurrentStateVersion, deliveryId: `delivery-${projectId}`, attemptId, entries: [{ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }] },
    });
  }
  await replicator.handleFrame(summary('project-a', sourceA.store));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(observed, []);
  assert.equal(replicator.diagnostics().receiverTiming.pendingObserverCount, 1);

  await replicator.handleFrame(summary('project-b', sourceB.store));
  await waitFor(() => observed.length === 2);
  assert.deepEqual(observed.sort(), ['project-a', 'project-b']);
  assert.equal(replicator.diagnostics().receiverTiming.pendingObserverCount, 0);
});

test('one peer root generation emits one missing request until the remote manifest changes', async (context) => {
  const source = fixture('decision-os-repair-source-');
  const target = fixture('decision-os-repair-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: 'first', changes: [{ path: 'title', operation: 'set', value: 'First' }] }] });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
  });
  const summary = (): FederationStateFrame => ({
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  });

  await replicator.handleFrame(summary());
  await replicator.handleFrame(summary());
  assert.equal(sent.filter((frame) => frame.type === 'state-missing-request').length, 1);

  replicator.disconnectPeer('relay');
  await replicator.handleFrame(summary());
  assert.equal(sent.filter((frame) => frame.type === 'state-missing-request').length, 2);

  await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: 'second', changes: [{ path: 'title', operation: 'set', value: 'Second' }] }] });
  await replicator.handleFrame(summary());
  assert.equal(sent.filter((frame) => frame.type === 'state-missing-request').length, 3);
});

test('a repair with no durable receiver progress expires only its project attempt', async (context) => {
  const source = fixture('decision-os-repair-deadline-source-');
  const target = fixture('decision-os-repair-deadline-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    [source, target].forEach((entry) => rmSync(entry.root, { recursive: true, force: true }));
  });
  await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: 'late', changes: [{ path: 'title', operation: 'set', value: 'Late' }] }] });
  const timeouts: Array<{ projectId: string; from: string; attemptId: string }> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', target.store]]),
    publish: () => true,
    noProgressTimeoutMs: 20,
    onRepairTimeout: (timeout) => { timeouts.push(timeout); },
  });
  await replicator.handleFrame({
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  });
  await waitFor(() => timeouts.length === 1);
  assert.equal(timeouts[0].projectId, 'project-a');
  assert.equal(timeouts[0].from, 'relay');
  assert.match(timeouts[0].attemptId, /^[a-f0-9]{64}:[a-f0-9]{64}$/);
  assert.equal(replicator.diagnostics().activeRepairCount, 0);
});

test('one peer missing request replays a local root only once', async (context) => {
  const node = fixture('decision-os-served-repair-');
  context.after(async () => { await node.store.flush(); rmSync(node.root, { recursive: true, force: true }); });
  await node.store.mutate({ replicaId: 'node', changes: [{ entityType: 'card', entityId: 'first', changes: [{ path: 'title', operation: 'set', value: 'First' }] }] });
  const sent: Array<Omit<FederationStateFrame, 'from'>> = [];
  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([['project-a', node.store]]),
    publish: (_peer, frame) => { sent.push(frame); return true; },
  });
  const request: FederationStateFrame = {
    type: 'state-missing-request',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, buckets: node.store.bucketManifest().map((entry) => entry.bucket) },
  };

  await replicator.handleFrame(request);
  await replicator.handleFrame({ ...request, payload: { stateVersion: taskCurrentStateVersion, buckets: [...(request.payload as { buckets: string[] }).buckets, ...(request.payload as { buckets: string[] }).buckets] } });
  assert.equal(sent.filter((frame) => frame.type === 'state-entity-batch').length, 1);
  replicator.disconnectPeer('relay');
  await replicator.handleFrame(request);
  assert.equal(sent.filter((frame) => frame.type === 'state-entity-batch').length, 2);
  const delivery = sent.filter((frame) => frame.type === 'state-entity-batch').at(-1)!;
  const entries = (delivery.payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> });
  await replicator.handleFrame({
    type: 'state-relay-ack',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, deliveryId: entries.deliveryId, accepted: entries.entries.map(({ key, stateHash }) => ({ key, stateHash })) },
  });
  assert.equal(sent.filter((frame) => frame.type === 'state-bucket-summary').length, 1);
});
