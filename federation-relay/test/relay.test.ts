import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

type FramePayload = {
  buckets?: Array<{ bucket?: string; count?: number; checksum?: string }>;
  data?: string;
  entities?: unknown[];
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

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
}

async function currentEntity(projectId: string, entityId: string, value: string) {
  const entity = {
    version: 2 as const,
    projectId,
    entityType: 'card',
    entityId,
    fields: { status: { clock: { 'node-a': 1 }, candidates: [{ dot: { replicaId: 'node-a', counter: 1 }, operation: 'set', value }] } },
    replication: 'active' as const,
    stateHash: '',
  };
  const { stateHash: _stateHash, ...body } = entity;
  entity.stateHash = await sha256(canonical(body));
  return entity;
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
    nodeA.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Workstation', projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }] }));
    nodeB.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Phone', projects: [{ id: 'shared', name: 'Shared', description: '', color: '#a78bfa', ledgers: [] }] }));
    const catalog = await catalogReady;
    expect(catalog.nodes?.map((node) => node.nodeId).sort()).toEqual(['node-a', 'node-b']);
    expect(catalog.nodes?.every((node) => node.online)).toBe(true);
    expect(catalog.nodes?.find((node) => node.nodeId === 'node-b')?.nodeLabel).toBe('Phone');

    const remoteChange = nextFrame(nodeB, (frame) => frame.type === 'content-change');
    nodeA.send(JSON.stringify({ version: 1, type: 'content-change' }));
    await expect(remoteChange).resolves.toMatchObject({ type: 'content-change' });

    const entity = await currentEntity('shared', 'card-live', 'todo');
    const stateEntity = nextFrame(nodeB, (frame) => frame.type === 'state-entity-batch');
    nodeA.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: 2, projectId: 'shared', payload: { stateVersion: 2, entities: [entity] } }));
    await expect(stateEntity).resolves.toMatchObject({ type: 'state-entity-batch', stateVersion: 2, from: 'relay', projectId: 'shared', payload: { entities: [entity] } });

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
    nodeA.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Writer', projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }] }));
    const entity = await currentEntity('shared', 'card-a', 'todo');
    const bucket = (await sha256('card\u0000card-a')).slice(0, 2);
    const checksum = await sha256(`card\u0000card-a\u0000${entity.stateHash}`);
    const acknowledged = nextFrame(nodeA, (frame) => frame.type === 'state-relay-ack');
    nodeA.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: 2, projectId: 'shared', payload: { stateVersion: 2, entities: [entity] } }));
    await expect(acknowledged).resolves.toMatchObject({ from: 'relay', stateVersion: 2 });
    nodeA.close(1000, 'writer_offline');

    const nodeB = await connect(federationId, 'node-b', credentialB);
    const storedSummary = nextFrame(nodeB, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared' && frame.payload?.buckets?.[0]?.count === 1);
    nodeB.send(JSON.stringify({ version: 1, type: 'manifest', nodeLabel: 'Reader', projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }] }));
    await expect(storedSummary).resolves.toMatchObject({ from: 'relay', payload: { buckets: [{ bucket, count: 1, checksum }] } });

    const replay = nextFrame(nodeB, (frame) => frame.type === 'state-entity-batch' && frame.projectId === 'shared');
    nodeB.send(JSON.stringify({ version: 1, type: 'state-missing-request', stateVersion: 2, projectId: 'shared', payload: { stateVersion: 2, buckets: [bucket] } }));
    await expect(replay).resolves.toMatchObject({ from: 'relay', payload: { entities: [entity] } });
    nodeB.close(1000, 'test_complete');
  });
});
