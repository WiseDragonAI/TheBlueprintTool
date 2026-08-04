/**
 * WHAT: Proves the Worker bounds repeated epoch-4 repair work across duplicate traffic and reconnects.
 * WHY: A divergent authenticated node must not rescan storage or fan out unchanged summaries indefinitely.
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  finalizeTaskCurrentEntity,
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
  taskCurrentBaselineEpoch,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityKey,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../shared/task-current-state-core';

type Frame = { type: string; projectId?: string; payload?: Record<string, any>; nodes?: unknown[] };

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

function nextFrame(socket: WebSocket, predicate: (frame: Frame) => boolean, timeoutMs = 2_000): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for relay frame.')), timeoutMs);
    const listener = (event: MessageEvent) => {
      const frame = JSON.parse(String(event.data)) as Frame;
      // WHAT: Retain the listener until the exact protocol boundary under test arrives.
      // WHY: Catalog traffic must not satisfy a state-repair assertion.
      if (!predicate(frame)) return;
      clearTimeout(timeout);
      socket.removeEventListener('message', listener);
      resolve(frame);
    };
    socket.addEventListener('message', listener);
  });
}

function observeFrames(socket: WebSocket, durationMs: number): Promise<Frame[]> {
  return new Promise((resolve) => {
    const frames: Frame[] = [];
    const listener = (event: MessageEvent) => { frames.push(JSON.parse(String(event.data)) as Frame); };
    socket.addEventListener('message', listener);
    setTimeout(() => {
      socket.removeEventListener('message', listener);
      resolve(frames);
    }, durationMs);
  });
}

function manifest(nodeLabel: string, projectIds: string[] = ['shared']) {
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

function entity(projectId: string) {
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId,
    entityType: 'card',
    entityId: 'sentinel',
    fields: { title: { clock: { writer: 1 }, candidates: [{ dot: { replicaId: 'writer', counter: 1 }, operation: 'set', value: 'Sentinel' }] } },
  });
}

function largeEntities(projectId: string, count: number) {
  return Array.from({ length: count }, (_value, index) => finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId,
    entityType: 'card',
    entityId: `canary-${String(index).padStart(5, '0')}`,
    fields: { title: { clock: { writer: index + 1 }, candidates: [{ dot: { replicaId: 'writer', counter: index + 1 }, operation: 'set', value: `${index}:${'x'.repeat(1_800)}` }] } },
  }));
}

function manifestForEntities(values: ReturnType<typeof largeEntities>) {
  const buckets = new Map<string, Array<readonly [string, (typeof values)[number]]>>();
  for (const value of values) {
    const key = taskCurrentEntityKey(value);
    const bucket = taskCurrentBucketForEntityKey(key);
    const entries = buckets.get(bucket) ?? [];
    entries.push([key, value]);
    buckets.set(bucket, entries);
  }
  return [...buckets].sort(([left], [right]) => left.localeCompare(right)).map(([bucket, entries]) => ({
    bucket,
    count: entries.length,
    checksum: hashTaskCurrentBucket(entries),
  }));
}

describe('federation relay flood proof', () => {
  it('suppresses duplicate summaries without unchanged participant fan-out', async () => {
    const federationId = `summary-flood-${crypto.randomUUID()}`;
    const [senderCredential, observerCredential] = await Promise.all([
      createNode(federationId, 'sender'),
      createNode(federationId, 'observer'),
    ]);
    const sender = await connect(federationId, 'sender', senderCredential);
    const observer = await connect(federationId, 'observer', observerCredential);
    const senderInitial = nextFrame(sender, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    const observerInitial = nextFrame(observer, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    sender.send(JSON.stringify(manifest('Sender')));
    observer.send(JSON.stringify(manifest('Observer')));
    await Promise.all([senderInitial, observerInitial]);
    const buckets: Array<{ bucket: string; count: number; checksum: string }> = [];
    const summary = { version: 1, type: 'state-bucket-summary', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion, root: hashTaskCurrentRoot(buckets), buckets } };
    const senderFrames = observeFrames(sender, 250);
    const observerFrames = observeFrames(observer, 250);
    sender.send(JSON.stringify(summary));
    sender.send(JSON.stringify(summary));
    expect((await senderFrames).filter((frame) => frame.type === 'state-bucket-summary')).toHaveLength(1);
    expect((await observerFrames).filter((frame) => frame.type === 'state-bucket-summary')).toHaveLength(0);
    sender.close(1000, 'test_complete');
    observer.close(1000, 'test_complete');
  });

  it('serves one bucket once across duplicate requests and reconnect', async () => {
    const federationId = `bucket-flood-${crypto.randomUUID()}`;
    const [writerCredential, readerCredential] = await Promise.all([
      createNode(federationId, 'writer'),
      createNode(federationId, 'reader'),
    ]);
    const writer = await connect(federationId, 'writer', writerCredential);
    writer.send(JSON.stringify(manifest('Writer')));
    const value = entity('shared');
    const key = taskCurrentEntityKey(value);
    const bucket = taskCurrentBucketForEntityKey(key);
    const acknowledged = nextFrame(writer, (frame) => frame.type === 'state-relay-ack');
    writer.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries: [{ key, stateHash: value.stateHash, entity: value }] } }));
    await acknowledged;

    const reader = await connect(federationId, 'reader', readerCredential);
    reader.send(JSON.stringify(manifest('Reader', [])));
    const subscribed = nextFrame(reader, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    reader.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    await subscribed;
    const request = { version: 1, type: 'state-missing-request', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion, buckets: [bucket] } };
    const firstFrames = observeFrames(reader, 300);
    reader.send(JSON.stringify(request));
    reader.send(JSON.stringify(request));
    expect((await firstFrames).filter((frame) => frame.type === 'state-entity-batch')).toHaveLength(1);

    reader.close(1000, 'reconnect');
    const replacement = await connect(federationId, 'reader', readerCredential);
    replacement.send(JSON.stringify(manifest('Reader', [])));
    const replacementSummary = nextFrame(replacement, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    replacement.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    await replacementSummary;
    const repeatedFrames = observeFrames(replacement, 250);
    replacement.send(JSON.stringify(request));
    expect((await repeatedFrames).filter((frame) => ['state-entity-batch', 'state-bucket-summary'].includes(frame.type))).toHaveLength(0);

    const expectedChecksum = hashTaskCurrentBucket([[key, value]]);
    expect(expectedChecksum).toMatch(/^[a-f0-9]{64}$/);
    writer.close(1000, 'test_complete');
    replacement.close(1000, 'test_complete');
  });

  it('synchronizes a 20,000-entity state larger than 32 MiB across every epoch-4 bucket', async () => {
    const federationId = `huge-state-${crypto.randomUUID()}`;
    const [writerCredential, readerCredential] = await Promise.all([
      createNode(federationId, 'writer'),
      createNode(federationId, 'reader'),
    ]);
    const writer = await connect(federationId, 'writer', writerCredential);
    writer.send(JSON.stringify(manifest('Writer')));
    const values = largeEntities('shared', 20_000);
    const encodedBytes = values.reduce((bytes, value) => bytes + new TextEncoder().encode(JSON.stringify(value)).byteLength, 0);
    const bucketManifest = manifestForEntities(values);
    expect(encodedBytes).toBeGreaterThan(32 * 1024 * 1024);
    expect(bucketManifest).toHaveLength(256);

    for (let offset = 0; offset < values.length; offset += 128) {
      const batch = values.slice(offset, offset + 128);
      const deliveryId = crypto.randomUUID();
      const acknowledged = nextFrame(writer, (frame) => frame.type === 'state-relay-ack' && frame.payload?.deliveryId === deliveryId, 10_000);
      writer.send(JSON.stringify({
        version: 1,
        type: 'state-entity-batch',
        stateVersion: taskCurrentStateVersion,
        projectId: 'shared',
        payload: {
          stateVersion: taskCurrentStateVersion,
          deliveryId,
          entries: batch.map((value) => ({ key: taskCurrentEntityKey(value), stateHash: value.stateHash, entity: value })),
        },
      }));
      await acknowledged;
    }

    const expectedRoot = hashTaskCurrentRoot(bucketManifest);
    const reader = await connect(federationId, 'reader', readerCredential);
    reader.send(JSON.stringify(manifest('Reader', [])));
    const subscribed = nextFrame(reader, (frame) => frame.type === 'state-bucket-summary' && frame.payload?.root === expectedRoot, 10_000);
    reader.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion } }));
    const summary = await subscribed;
    expect(summary.payload?.buckets).toHaveLength(256);

    let received = 0;
    let frames = 0;
    const complete = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Huge-state replay stopped at ${received} entities in ${frames} frames.`)), 60_000);
      const listener = (event: MessageEvent) => {
        const frame = JSON.parse(String(event.data)) as Frame;
        // WHAT: Count only replay entities for the copied project.
        // WHY: Catalog and summary traffic cannot prove complete state synchronization.
        if (frame.type !== 'state-entity-batch' || frame.projectId !== 'shared') return;
        frames += 1;
        received += Array.isArray(frame.payload?.entries) ? frame.payload.entries.length : 0;
        // WHAT: Settle only after every expected entity crosses the relay boundary.
        // WHY: Root summaries without their complete entity population are insufficient convergence evidence.
        if (received !== values.length) return;
        clearTimeout(timeout);
        reader.removeEventListener('message', listener);
        resolve();
      };
      reader.addEventListener('message', listener);
    });
    reader.send(JSON.stringify({ version: 1, type: 'state-missing-request', stateVersion: taskCurrentStateVersion, projectId: 'shared', payload: { stateVersion: taskCurrentStateVersion, buckets: bucketManifest.map((bucket) => bucket.bucket) } }));
    await complete;
    expect(frames).toBeGreaterThan(64);
    expect(received).toBe(values.length);
    writer.close(1000, 'test_complete');
    reader.close(1000, 'test_complete');
  }, 120_000);
});
