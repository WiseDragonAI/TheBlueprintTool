/**
 * WHAT: Exercises authenticated relay streaming, epoch-4 state durability, admission, and routing.
 * WHY: Relay acknowledgements and offline bootstrap require Worker-runtime behavioral evidence.
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  finalizeTaskCurrentEntity,
  hashTaskCurrentBucket,
  taskCurrentBucketForEntityKey,
  taskCurrentBaselineEpoch,
  taskCurrentEntityKey,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../shared/task-current-state-core';
import { nextRepairStateEntityFrame, nextStateEntityFrame } from '../src/state-entity-frames';

type FramePayload = {
  buckets?: Array<{ bucket?: string; count?: number; checksum?: string }>;
  data?: string;
  deliveryId?: string;
  entries?: Array<{ key: string; stateHash: string; entity: unknown }>;
  accepted?: Array<{ key: string; stateHash: string; resultingStateHash?: string }>;
  rejected?: Array<{ key: string; stateHash: string; receiverStateHash: string; code: string; collisions: unknown[] }>;
  root?: string;
  executionId?: string;
  observation?: unknown;
};
type Frame = { type: string; requestId?: string; direction?: string; from?: string; stateVersion?: number; projectId?: string; payload?: FramePayload; nodes?: Array<{ nodeId: string; nodeLabel: string; online: boolean }> };
const maximumStateFrameBytes = 512 * 1024;

it('packs relay repair by wire bytes beyond the node publication count ceiling', () => {
  const entities = Array.from({ length: 129 }, (_, index) => finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entityType: 'card',
    entityId: `card-${index}`,
    fields: {},
  }));
  const packed = nextStateEntityFrame('project-a', entities, {
    maximumEntities: Number.MAX_SAFE_INTEGER,
    payload: { attemptId: `${'a'.repeat(64)}:${'b'.repeat(64)}` },
  });
  expect(packed.consumed).toBe(129);
  expect((packed.frame.payload as FramePayload).entries).toHaveLength(129);
  expect(Buffer.byteLength(JSON.stringify(packed.frame))).toBeLessThanOrEqual(maximumStateFrameBytes);
});

it('accounts exact repair frame bytes with unicode and attempt metadata', () => {
  const entities = Array.from({ length: 180 }, (_, index) => finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entityType: 'card',
    entityId: `card-${index}`,
    fields: {
      title: {
        clock: { source: index + 1 },
        candidates: [{ dot: { replicaId: 'source', counter: index + 1 }, operation: 'set', value: `ไทย "quoted" \\ ${index}` }],
      },
    },
  }));
  const byKey = new Map(entities.map((entity) => [taskCurrentEntityKey(entity), entity]));
  const remaining = entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash }));
  const packed = nextRepairStateEntityFrame('project-a', `${'a'.repeat(64)}:${'b'.repeat(64)}`, remaining, (key) => byKey.get(key));
  expect(packed.consumed).toBe(180);
  expect(packed.candidateCount).toBe(180);
  expect(packed.encodedBytes).toBe(Buffer.byteLength(JSON.stringify(packed.frame)));
  expect(packed.encodedBytes).toBeLessThanOrEqual(maximumStateFrameBytes);
});

async function createNode(federationId: string, nodeId: string): Promise<string> {
  const response = await SELF.fetch(`https://relay.test/admin/federations/${federationId}/nodes/${nodeId}`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-admin-secret' },
  });
  expect(response.status).toBe(201);
  return String((await response.json() as { credential: string }).credential);
}

async function connect(federationId: string, nodeId: string, credential: string): Promise<WebSocket> {
  const response = await SELF.fetch(`https://relay.test/connect/${federationId}/${nodeId}`, {
    headers: { upgrade: 'websocket', authorization: `Bearer ${credential}` },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  return socket;
}

function nextFrame(socket: WebSocket, predicate: (frame: Frame) => boolean): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for relay frame.')), 2_000);
    const listener = (event: MessageEvent) => {
      const frame = JSON.parse(String(event.data)) as Frame;
      if (!predicate(frame)) return;
      clearTimeout(timeout);
      socket.removeEventListener('message', listener);
      resolve(frame);
    };
    socket.addEventListener('message', listener);
  });
}

function manifest(nodeLabel: string, projectIds = ['shared']) {
  return {
    version: 1,
    type: 'manifest',
    nodeLabel,
    stateProtocol: taskStateProtocol,
    stateSchema: taskCurrentStateVersion,
    baselineEpoch: taskCurrentBaselineEpoch,
    projects: projectIds.map((id) => ({ id, name: id, description: '', color: '#38d9e8', ledgers: [] })),
  };
}

function currentEntity(projectId: string, entityId: string, value: string) {
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId,
    entityType: 'card',
    entityId,
    fields: { lifecycle: { clock: { 'node-a': 1 }, candidates: [{ dot: { replicaId: 'node-a', counter: 1 }, operation: 'set', value: { status: value, changedAt: '2026-07-21T00:00:00.000Z', waitingAt: value === 'todo' ? '2026-07-21T00:00:00.000Z' : null, closedAt: value === 'done' ? '2026-07-21T00:00:00.000Z' : null } }] } },
  });
}

function stateBatch(projectId: string, entity: ReturnType<typeof currentEntity>, deliveryId = crypto.randomUUID()) {
  return {
    version: 1,
    type: 'state-entity-batch',
    stateVersion: taskCurrentStateVersion,
    projectId,
    payload: { stateVersion: taskCurrentStateVersion, deliveryId, entries: [{ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }] },
  };
}

function largeCurrentEntity(projectId: string, entityId: string, marker: string) {
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId,
    entityType: 'card',
    entityId,
    fields: { title: { clock: { 'node-a': 1 }, candidates: [{ dot: { replicaId: 'node-a', counter: 1 }, operation: 'set', value: `${marker}${'x'.repeat(59_000)}` }] } },
  });
}

describe('federation relay', () => {
  it('exposes exact release, protocol, environment, and Durable Object namespace identity', async () => {
    const response = await SELF.fetch('https://relay.test/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: 'ready',
      service: 'decision-os-federation-relay',
      releaseSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      deliveryProtocol: 1,
      protocolVersion: 1,
      stateProtocol: taskStateProtocol,
      stateSchema: taskCurrentStateVersion,
      baselineEpoch: taskCurrentBaselineEpoch,
      environment: 'dev',
      workerName: 'decision-os-federation-relay-dev',
      durableObjectNamespace: 'decision-os-federations-dev',
    });
  });

  it('resets one offline project state without deleting federation credentials', async () => {
    const federationId = `reset-${crypto.randomUUID()}`;
    const credential = await createNode(federationId, 'workstation');
    const writer = await connect(federationId, 'workstation', credential);
    writer.send(JSON.stringify(manifest('Workstation')));
    const entity = currentEntity('shared', 'card-before-reset', 'todo');
    const acknowledged = nextFrame(writer, (frame) => frame.type === 'state-relay-ack');
    writer.send(JSON.stringify(stateBatch('shared', entity)));
    await acknowledged;

    const onlineReset = await SELF.fetch(`https://relay.test/admin/federations/${federationId}/projects/shared/reset-state`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-admin-secret' },
    });
    expect(onlineReset.status).toBe(409);
    await expect(onlineReset.json()).resolves.toMatchObject({ ok: false, error: 'project_nodes_online', nodes: ['workstation'] });

    writer.close(1000, 'cutover');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const reset = await SELF.fetch(`https://relay.test/admin/federations/${federationId}/projects/shared/reset-state`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-admin-secret' },
    });
    expect(reset.status).toBe(200);
    await expect(reset.json()).resolves.toMatchObject({ ok: true, projectId: 'shared', entitiesDeleted: 1, bucketsDeleted: 1 });

    const reconnected = await connect(federationId, 'workstation', credential);
    const empty = nextFrame(reconnected, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    reconnected.send(JSON.stringify(manifest('Workstation')));
    await expect(empty).resolves.toMatchObject({ payload: { buckets: [] } });
    reconnected.close(1000, 'test_complete');
  });

  it('replaces a same-node socket without failing the new handshake', async () => {
    const federationId = `replacement-${crypto.randomUUID()}`;
    const credential = await createNode(federationId, 'workstation');
    const first = await connect(federationId, 'workstation', credential);
    const firstClosed = new Promise<CloseEvent>((resolve) => first.addEventListener('close', resolve, { once: true }));

    const replacement = await connect(federationId, 'workstation', credential);

    await expect(firstClosed).resolves.toMatchObject({ code: 4001, reason: 'replaced' });
    expect(replacement.readyState).toBe(WebSocket.OPEN);
    replacement.close(1000, 'test_complete');
  });

  it('authenticates nodes, publishes the shared catalog, and relays a credit-bounded stream', async () => {
    const federationId = `test-${crypto.randomUUID()}`;
    const [credentialA, credentialB] = await Promise.all([
      createNode(federationId, 'node-a'),
      createNode(federationId, 'node-b'),
    ]);
    const nodeA = await connect(federationId, 'node-a', credentialA);
    const nodeB = await connect(federationId, 'node-b', credentialB);

    const catalogReady = nextFrame(nodeA, (frame) => frame.type === 'catalog' && frame.nodes?.length === 2);
    nodeA.send(JSON.stringify(manifest('Workstation')));
    nodeB.send(JSON.stringify(manifest('Phone')));
    const catalog = await catalogReady;
    expect(catalog.nodes?.map((node) => node.nodeId).sort()).toEqual(['node-a', 'node-b']);
    expect(catalog.nodes?.every((node) => node.online)).toBe(true);
    expect(catalog.nodes?.find((node) => node.nodeId === 'node-b')?.nodeLabel).toBe('Phone');

    const remoteChange = nextFrame(nodeB, (frame) => frame.type === 'content-change');
    nodeA.send(JSON.stringify({ version: 1, type: 'content-change' }));
    await expect(remoteChange).resolves.toMatchObject({ type: 'content-change' });

    const entity = currentEntity('shared', 'card-live', 'todo');
    const stateEntity = nextFrame(nodeB, (frame) => frame.type === 'state-entity-batch');
    nodeA.send(JSON.stringify(stateBatch('shared', entity)));
    await expect(stateEntity).resolves.toMatchObject({ type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, from: 'relay', projectId: 'shared', payload: { entries: [{ key: 'card\u0000card-live', stateHash: entity.stateHash, entity }] } });

    const observedAt = new Date().toISOString();
    const observation = { executionId: 'execution-live', executorNodeId: 'node-a', phase: 'running', observedAt, expiresAt: new Date(Date.parse(observedAt) + 15_000).toISOString(), revision: 3 };
    const relayedObservation = nextFrame(nodeB, (frame) => frame.type === 'state-execution-observation');
    nodeA.send(JSON.stringify({ version: 1, type: 'state-execution-observation', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { executionId: observation.executionId, observation } }));
    await expect(relayedObservation).resolves.toMatchObject({ type: 'state-execution-observation', stateVersion: taskCurrentStateVersion, from: 'node-a', projectId: 'shared', payload: { executionId: 'execution-live', observation } });

    const requestId = crypto.randomUUID();
    const ownerOpen = nextFrame(nodeB, (frame) => frame.type === 'request-open' && frame.requestId === requestId);
    nodeA.send(JSON.stringify({ version: 1, type: 'request-open', requestId, to: 'node-b', method: 'PATCH', path: '/p/beta/api/ledgers/tasks/canvas', headers: { 'content-type': 'application/json' } }));
    await expect(ownerOpen).resolves.toMatchObject({ type: 'request-open', requestId });

    const ownerChunk = nextFrame(nodeB, (frame) => frame.type === 'request-chunk' && frame.requestId === requestId);
    nodeA.send(JSON.stringify({ version: 1, type: 'request-chunk', requestId, data: btoa('{"action":"patch-card"}') }));
    await expect(ownerChunk).resolves.toMatchObject({ type: 'request-chunk', requestId });

    const requesterCredit = nextFrame(nodeA, (frame) => frame.type === 'credit' && frame.direction === 'request');
    nodeB.send(JSON.stringify({ version: 1, type: 'credit', requestId, direction: 'request', bytes: 23 }));
    await expect(requesterCredit).resolves.toMatchObject({ type: 'credit', direction: 'request' });

    const requesterResponse = nextFrame(nodeA, (frame) => frame.type === 'response-end' && frame.requestId === requestId);
    nodeB.send(JSON.stringify({ version: 1, type: 'response-open', requestId, status: 200, headers: { 'content-type': 'application/json' } }));
    nodeB.send(JSON.stringify({ version: 1, type: 'response-chunk', requestId, data: btoa('{"ok":true}') }));
    const ownerCredit = nextFrame(nodeB, (frame) => frame.type === 'credit' && frame.direction === 'response');
    nodeA.send(JSON.stringify({ version: 1, type: 'credit', requestId, direction: 'response', bytes: 11 }));
    await expect(ownerCredit).resolves.toMatchObject({ type: 'credit', direction: 'response' });
    nodeB.send(JSON.stringify({ version: 1, type: 'response-end', requestId }));
    await expect(requesterResponse).resolves.toMatchObject({ type: 'response-end', requestId });

    nodeA.close(1000, 'test_complete');
    nodeB.close(1000, 'test_complete');
  });

  it('durably reconciles current entities when writer and reader never overlap online', async () => {
    const federationId = `durable-state-${crypto.randomUUID()}`;
    const [credentialA, credentialB] = await Promise.all([
      createNode(federationId, 'node-a'),
      createNode(federationId, 'node-b'),
    ]);
    const nodeA = await connect(federationId, 'node-a', credentialA);
    nodeA.send(JSON.stringify(manifest('Writer')));
    const entity = currentEntity('shared', 'card-a', 'todo');
    const entityKey = taskCurrentEntityKey(entity);
    const bucket = taskCurrentBucketForEntityKey(entityKey);
    const checksum = hashTaskCurrentBucket([[entityKey, entity]]);
    const deliveryId = crypto.randomUUID();
    const acknowledged = nextFrame(nodeA, (frame) => frame.type === 'state-relay-ack');
    nodeA.send(JSON.stringify(stateBatch('shared', entity, deliveryId)));
    await expect(acknowledged).resolves.toMatchObject({ from: 'relay', stateVersion: taskCurrentStateVersion, payload: { deliveryId, accepted: [{ key: entityKey, stateHash: entity.stateHash }] } });
    nodeA.close(1000, 'writer_offline');

    const nodeB = await connect(federationId, 'node-b', credentialB);
    const storedSummary = nextFrame(nodeB, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared' && frame.payload?.buckets?.[0]?.count === 1);
    nodeB.send(JSON.stringify(manifest('Remote-only reader', [])));
    nodeB.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    await expect(storedSummary).resolves.toMatchObject({ from: 'relay', payload: { buckets: [{ bucket, count: 1, checksum }] } });

    const replay = nextFrame(nodeB, (frame) => frame.type === 'state-entity-batch' && frame.projectId === 'shared');
    nodeB.send(JSON.stringify({ version: 1, type: 'state-missing-request', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion, buckets: [bucket] } }));
    await expect(replay).resolves.toMatchObject({ from: 'relay', payload: { entries: [{ key: entityKey, stateHash: entity.stateHash, entity }] } });
    nodeB.close(1000, 'test_complete');
  });

  it('acknowledges the submitted hash separately from the joined relay hash', async () => {
    const federationId = `relay-ack-join-${crypto.randomUUID()}`;
    const credential = await createNode(federationId, 'writer');
    const writer = await connect(federationId, 'writer', credential);
    writer.send(JSON.stringify(manifest('Writer')));
    const retained = finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId: 'shared',
      entityType: 'card',
      entityId: 'concurrent-card',
      fields: { title: { clock: { relay: 1 }, candidates: [{ dot: { replicaId: 'relay', counter: 1 }, operation: 'set', value: 'Relay value' }] } },
    });
    const seeded = nextFrame(writer, (frame) => frame.type === 'state-relay-ack' && frame.payload?.deliveryId === 'seed-concurrent');
    writer.send(JSON.stringify(stateBatch('shared', retained, 'seed-concurrent')));
    await seeded;
    const submitted = finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId: 'shared',
      entityType: 'card',
      entityId: 'concurrent-card',
      fields: { title: { clock: { node: 1 }, candidates: [{ dot: { replicaId: 'node', counter: 1 }, operation: 'set', value: 'Node value' }] } },
    });
    const joined = finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId: 'shared',
      entityType: 'card',
      entityId: 'concurrent-card',
      fields: { title: { clock: { node: 1, relay: 1 }, candidates: [
        { dot: { replicaId: 'node', counter: 1 }, operation: 'set', value: 'Node value' },
        { dot: { replicaId: 'relay', counter: 1 }, operation: 'set', value: 'Relay value' },
      ] } },
    });
    expect(joined.stateHash).not.toBe(submitted.stateHash);
    expect(joined.stateHash).not.toBe(retained.stateHash);
    const acknowledged = nextFrame(writer, (frame) => frame.type === 'state-relay-ack' && frame.payload?.deliveryId === 'join-concurrent');
    writer.send(JSON.stringify(stateBatch('shared', submitted, 'join-concurrent')));
    await expect(acknowledged).resolves.toMatchObject({ payload: { accepted: [{
      key: taskCurrentEntityKey(submitted),
      stateHash: submitted.stateHash,
      resultingStateHash: joined.stateHash,
    }] } });
    writer.close(1000, 'test_complete');
  });

  it('byte-bounds relay replay frames as well as node publication frames', async () => {
    const federationId = `relay-byte-bound-${crypto.randomUUID()}`;
    const [writerCredential, readerCredential] = await Promise.all([
      createNode(federationId, 'writer'),
      createNode(federationId, 'reader'),
    ]);
    const writer = await connect(federationId, 'writer', writerCredential);
    writer.send(JSON.stringify(manifest('Writer')));
    const entities = Array.from({ length: 10 }, (_value, index) => largeCurrentEntity('shared', `large-${index}`, String(index)));
    for (const entity of entities) {
      const acknowledged = nextFrame(writer, (frame) => frame.type === 'state-relay-ack');
      writer.send(JSON.stringify(stateBatch('shared', entity)));
      await acknowledged;
    }
    writer.close(1000, 'writer_offline');

    const reader = await connect(federationId, 'reader', readerCredential);
    const summaryPromise = nextFrame(reader, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared' && frame.payload?.buckets?.reduce((count, bucket) => count + Number(bucket.count ?? 0), 0) === entities.length);
    reader.send(JSON.stringify(manifest('Reader', [])));
    reader.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    const summary = await summaryPromise;
    const received: string[] = [];
    const frameSizes: number[] = [];
    const repairedSummary = nextFrame(reader, (frame) => frame.type === 'state-bucket-summary'
      && frame.projectId === 'shared'
      && frame.payload?.root === summary.payload?.root);
    const complete = new Promise<void>((resolve) => reader.addEventListener('message', (event) => {
      const text = String(event.data);
      const frame = JSON.parse(text) as Frame;
      if (frame.type !== 'state-entity-batch') return;
      frameSizes.push(new TextEncoder().encode(text).byteLength);
      received.push(...(frame.payload?.entries ?? []).map((entry) => entry.key));
      if (received.length === entities.length) resolve();
    }));
    reader.send(JSON.stringify({ version: 1, type: 'state-missing-request', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion, buckets: summary.payload?.buckets?.map((bucket) => bucket.bucket) } }));
    await complete;
    await expect(repairedSummary).resolves.toMatchObject({ from: 'relay', payload: { root: summary.payload?.root } });

    expect(frameSizes.length).toBeGreaterThan(1);
    expect(frameSizes.every((bytes) => bytes <= maximumStateFrameBytes)).toBe(true);
    expect(received.sort()).toEqual(entities.map(taskCurrentEntityKey).sort());
    reader.close(1000, 'test_complete');
  });

  it('rejects interrupted, oversized, and mixed-invalid batches without partial durable state', async () => {
    const federationId = `relay-atomic-reject-${crypto.randomUUID()}`;
    const credential = await createNode(federationId, 'writer');
    const writer = await connect(federationId, 'writer', credential);
    writer.send(JSON.stringify(manifest('Writer')));
    const valid = currentEntity('shared', 'valid-card', 'todo');
    const invalid = currentEntity('shared', 'invalid-card', 'done');
    const interruptedResponse = nextFrame(writer, (frame) => frame.type === 'response-error');
    writer.send(JSON.stringify(stateBatch('shared', valid)).slice(0, -12));
    await expect(interruptedResponse).resolves.toMatchObject({ type: 'response-error' });

    const invalidDeliveryId = 'rejected-delivery';
    const invalidBatch = stateBatch('shared', valid, invalidDeliveryId) as ReturnType<typeof stateBatch>;
    invalidBatch.payload.entries.push({ key: 'card\u0000wrong-id', stateHash: invalid.stateHash, entity: invalid });
    const invalidResponse = nextFrame(writer, (frame) => frame.type === 'response-error');
    writer.send(JSON.stringify(invalidBatch));
    await expect(invalidResponse).resolves.toMatchObject({
      type: 'response-error',
      projectId: 'shared',
      code: 'invalid_state_entity_envelope',
      payload: { deliveryId: invalidDeliveryId },
    });

    const oversizedResponse = nextFrame(writer, (frame) => frame.type === 'response-error');
    writer.send(JSON.stringify({ ...stateBatch('shared', valid), message: 'x'.repeat(maximumStateFrameBytes) }));
    await expect(oversizedResponse).resolves.toMatchObject({ type: 'response-error' });

    const emptySummary = nextFrame(writer, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    writer.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    await expect(emptySummary).resolves.toMatchObject({ payload: { buckets: [] } });
    writer.close(1000, 'test_complete');
  });

  it('accepts healthy publication entries while durably rejecting a same-dot collision', async () => {
    const federationId = `relay-mixed-collision-${crypto.randomUUID()}`;
    const [writerCredential, readerCredential] = await Promise.all([
      createNode(federationId, 'writer'),
      createNode(federationId, 'reader'),
    ]);
    const writer = await connect(federationId, 'writer', writerCredential);
    const reader = await connect(federationId, 'reader', readerCredential);
    writer.send(JSON.stringify(manifest('Writer')));
    reader.send(JSON.stringify(manifest('Reader')));
    const retained = currentEntity('shared', 'collision-card', 'todo');
    const seeded = nextFrame(writer, (frame) => frame.type === 'state-relay-ack');
    writer.send(JSON.stringify(stateBatch('shared', retained, 'seed-collision')));
    await seeded;

    const conflicting = currentEntity('shared', 'collision-card', 'done');
    const healthy = currentEntity('shared', 'healthy-card', 'todo');
    const mixed = stateBatch('shared', conflicting, 'mixed-collision');
    mixed.payload.entries.push({ key: taskCurrentEntityKey(healthy), stateHash: healthy.stateHash, entity: healthy });
    const acknowledgement = nextFrame(writer, (frame) => frame.type === 'state-relay-ack' && frame.payload?.deliveryId === 'mixed-collision');
    const forwarded = nextFrame(reader, (frame) => frame.type === 'state-entity-batch' && frame.payload?.entries?.some((entry) => entry.key === taskCurrentEntityKey(healthy)) === true);
    writer.send(JSON.stringify(mixed));
    await expect(acknowledgement).resolves.toMatchObject({
      payload: {
        accepted: [{ key: taskCurrentEntityKey(healthy), stateHash: healthy.stateHash }],
        rejected: [{
          key: taskCurrentEntityKey(conflicting),
          stateHash: conflicting.stateHash,
          receiverStateHash: retained.stateHash,
          code: 'task_current_dot_collision',
          collisions: [{ entityType: 'card', entityId: 'collision-card', path: 'lifecycle', dot: { replicaId: 'node-a', counter: 1 } }],
        }],
      },
    });
    await expect(forwarded).resolves.toMatchObject({ payload: { entries: [{ key: taskCurrentEntityKey(healthy) }] } });
    writer.close(1000, 'test_complete');
    reader.close(1000, 'test_complete');
  });

  it('rejects incompatible manifests before state participation', async () => {
    const federationId = `admission-${crypto.randomUUID()}`;
    const credential = await createNode(federationId, 'legacy');
    const node = await connect(federationId, 'legacy', credential);
    const rejected = nextFrame(node, (frame) => frame.type === 'response-error');
    node.send(JSON.stringify({
      version: 1,
      type: 'manifest',
      nodeLabel: 'Legacy',
      stateProtocol: 'decision-os-task-state/3',
      stateSchema: 3,
      baselineEpoch: 3,
      projects: [],
    }));
    await expect(rejected).resolves.toMatchObject({ type: 'response-error', code: 'incompatible_state_protocol' });
    node.close(1000, 'test_complete');
  });

  it('forwards live state only to project hosts and exact subscribers', async () => {
    const federationId = `subscription-${crypto.randomUUID()}`;
    const credentials = await Promise.all(['host', 'subscriber', 'bystander'].map((nodeId) => createNode(federationId, nodeId)));
    const [host, subscriber, bystander] = await Promise.all(['host', 'subscriber', 'bystander'].map((nodeId, index) => connect(federationId, nodeId, credentials[index])));
    host.send(JSON.stringify(manifest('Host')));
    subscriber.send(JSON.stringify(manifest('Subscriber', [])));
    bystander.send(JSON.stringify(manifest('Bystander', [])));
    const subscribed = nextFrame(subscriber, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    subscriber.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    await subscribed;
    let bystanderReceived = false;
    bystander.addEventListener('message', (event) => {
      const frame = JSON.parse(String(event.data)) as Frame;
      if (frame.type === 'state-entity-batch') bystanderReceived = true;
    });
    const entity = currentEntity('shared', 'card-subscribed', 'todo');
    const delivered = nextFrame(subscriber, (frame) => frame.type === 'state-entity-batch' && frame.projectId === 'shared');
    host.send(JSON.stringify(stateBatch('shared', entity)));
    await expect(delivered).resolves.toMatchObject({ payload: { entries: [{ key: taskCurrentEntityKey(entity) }] } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bystanderReceived).toBe(false);
    host.close(1000, 'test_complete'); subscriber.close(1000, 'test_complete'); bystander.close(1000, 'test_complete');
  });
});
