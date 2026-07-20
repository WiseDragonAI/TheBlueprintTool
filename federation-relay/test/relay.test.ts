import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

type FramePayload = {
  buckets?: Array<{ bucket?: string; count?: number; checksum?: string }>;
  data?: string;
  snapshotId?: string;
  total?: number;
  checksum?: string;
  events?: unknown[];
};
type Frame = { type: string; requestId?: string; direction?: string; from?: string; stateVersion?: number; projectId?: string; payload?: FramePayload; nodes?: Array<{ nodeId: string; nodeLabel: string; online: boolean }> };

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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('federation relay', () => {
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
    nodeA.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Workstation', projects: [{ id: 'alpha', name: 'Alpha', description: '', color: '#38d9e8', ledgers: [] }] }));
    nodeB.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Phone', projects: [{ id: 'beta', name: 'Beta', description: '', color: '#a78bfa', ledgers: [] }] }));
    const catalog = await catalogReady;
    expect(catalog.nodes?.map((node) => node.nodeId).sort()).toEqual(['node-a', 'node-b']);
    expect(catalog.nodes?.every((node) => node.online)).toBe(true);
    expect(catalog.nodes?.find((node) => node.nodeId === 'node-b')?.nodeLabel).toBe('Phone');

    const remoteChange = nextFrame(nodeB, (frame) => frame.type === 'content-change');
    nodeA.send(JSON.stringify({ version: 1, type: 'content-change' }));
    await expect(remoteChange).resolves.toMatchObject({ type: 'content-change' });

    const stateEvent = nextFrame(nodeB, (frame) => frame.type === 'state-event-batch');
    nodeA.send(JSON.stringify({ version: 1, type: 'state-event-batch', stateVersion: 1, to: 'node-b', projectId: 'beta', payload: { events: [{ eventId: 'event-a' }] } }));
    await expect(stateEvent).resolves.toMatchObject({ type: 'state-event-batch', stateVersion: 1, from: 'node-a', projectId: 'beta', payload: { events: [{ eventId: 'event-a' }] } });

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

  it('durably reconciles task events when writer and reader never overlap online', async () => {
    const federationId = `durable-state-${crypto.randomUUID()}`;
    const [credentialA, credentialB] = await Promise.all([
      createNode(federationId, 'node-a'),
      createNode(federationId, 'node-b'),
    ]);
    const nodeA = await connect(federationId, 'node-a', credentialA);
    nodeA.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Writer', projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }] }));
    const missing = nextFrame(nodeA, (frame) => frame.type === 'state-missing-request' && frame.projectId === 'shared');
    nodeA.send(JSON.stringify({
      version: 1,
      type: 'state-bucket-summary',
      stateVersion: 1,
      projectId: 'shared',
      payload: { buckets: [{ bucket: '2026-07-20T09', count: 1, checksum: 'a'.repeat(64) }] },
    }));
    await expect(missing).resolves.toMatchObject({ from: 'relay', payload: { buckets: ['2026-07-20T09'] } });

    const event = {
      eventId: 'event-a',
      projectId: 'shared',
      writerId: 'node-a',
      emittedAt: '2026-07-20T09:00:00.000Z',
      entityType: 'card',
      entityId: 'card-a',
      changes: [{ path: 'status', operation: 'set', value: 'todo' }],
      checksum: 'a'.repeat(64),
    };
    const acknowledged = nextFrame(nodeA, (frame) => frame.type === 'state-relay-ack');
    nodeA.send(JSON.stringify({ version: 1, type: 'state-event-batch', stateVersion: 1, projectId: 'shared', payload: { events: [event] } }));
    await expect(acknowledged).resolves.toMatchObject({ from: 'relay', payload: { eventIds: ['event-a'] } });

    const snapshot = {
      manifest: { version: 1, snapshotId: 'snapshot-a', projectId: 'shared', reducerVersion: 1, createdAt: '2026-07-20T09:01:00.000Z' },
      projection: { version: 1, projectId: 'shared', ledger: { cards: [{ id: 'card-a', status: 'todo' }] }, conflicts: [], appliedEventIds: ['event-a'] },
    };
    const snapshotBody = JSON.stringify(snapshot);
    const snapshotChecksum = await sha256(snapshotBody);
    const snapshotStored = nextFrame(nodeA, (frame) => frame.type === 'state-ack' && frame.payload?.snapshotId === 'snapshot-a');
    nodeA.send(JSON.stringify({
      version: 1,
      type: 'state-snapshot-chunk',
      stateVersion: 1,
      projectId: 'shared',
      payload: { transferId: 'upload-a', index: 0, total: 1, checksum: snapshotChecksum, data: btoa(snapshotBody) },
    }));
    nodeA.send(JSON.stringify({ version: 1, type: 'state-snapshot-end', stateVersion: 1, projectId: 'shared', payload: { transferId: 'upload-a', total: 1, checksum: snapshotChecksum } }));
    await expect(snapshotStored).resolves.toMatchObject({ from: 'relay', payload: { snapshotId: 'snapshot-a' } });
    nodeA.close(1000, 'writer_offline');

    const nodeB = await connect(federationId, 'node-b', credentialB);
    const snapshotManifest = nextFrame(nodeB, (frame) => frame.type === 'state-snapshot-manifest' && frame.projectId === 'shared');
    const storedSummary = nextFrame(nodeB, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared' && frame.payload?.buckets?.[0]?.count === 1);
    nodeB.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Reader', projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }] }));
    await expect(snapshotManifest).resolves.toMatchObject({ from: 'relay', payload: { manifests: [{ snapshotId: 'snapshot-a', eventCount: 1 }] } });
    await expect(storedSummary).resolves.toMatchObject({ from: 'relay', payload: { buckets: [{ bucket: '2026-07-20T09', count: 1, checksum: 'a'.repeat(64) }] } });

    const snapshotChunk = nextFrame(nodeB, (frame) => frame.type === 'state-snapshot-chunk' && frame.projectId === 'shared');
    const snapshotEnd = nextFrame(nodeB, (frame) => frame.type === 'state-snapshot-end' && frame.projectId === 'shared');
    nodeB.send(JSON.stringify({ version: 1, type: 'state-snapshot-request', stateVersion: 1, projectId: 'shared', payload: { snapshotId: 'snapshot-a' } }));
    const transferred = await snapshotChunk;
    await expect(snapshotEnd).resolves.toMatchObject({ from: 'relay', payload: { total: 1, checksum: snapshotChecksum } });
    expect(atob(String(transferred.payload?.data ?? ''))).toBe(snapshotBody);

    const replay = nextFrame(nodeB, (frame) => frame.type === 'state-event-batch' && frame.projectId === 'shared');
    nodeB.send(JSON.stringify({ version: 1, type: 'state-missing-request', stateVersion: 1, projectId: 'shared', payload: { buckets: ['2026-07-20T09'] } }));
    await expect(replay).resolves.toMatchObject({ from: 'relay', payload: { events: [event] } });
    nodeB.close(1000, 'test_complete');
  });
});
