import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

type Frame = { type: string; requestId?: string; direction?: string; nodes?: Array<{ nodeId: string; online: boolean }> };

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

describe('federation relay', () => {
  it('authenticates nodes, publishes the shared catalog, and relays a credit-bounded stream', async () => {
    const federationId = `test-${crypto.randomUUID()}`;
    const [credentialA, credentialB] = await Promise.all([
      createNode(federationId, 'node-a'),
      createNode(federationId, 'node-b'),
    ]);
    const nodeA = await connect(federationId, 'node-a', credentialA);
    const nodeB = await connect(federationId, 'node-b', credentialB);

    const catalogReady = nextFrame(nodeA, (frame) => frame.type === 'catalog' && frame.nodes?.length === 2);
    nodeA.send(JSON.stringify({ version: 1, type: 'manifest', projects: [{ id: 'alpha', name: 'Alpha', description: '', color: '#38d9e8', ledgers: [] }] }));
    nodeB.send(JSON.stringify({ version: 1, type: 'manifest', projects: [{ id: 'beta', name: 'Beta', description: '', color: '#a78bfa', ledgers: [] }] }));
    const catalog = await catalogReady;
    expect(catalog.nodes?.map((node) => node.nodeId).sort()).toEqual(['node-a', 'node-b']);
    expect(catalog.nodes?.every((node) => node.online)).toBe(true);

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
});
