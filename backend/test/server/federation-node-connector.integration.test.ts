import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

type Frame = { type: string; requestId?: string; to?: string; projects?: unknown[] };

function projectHome(name: string): string {
  const home = mkdtempSync(join(tmpdir(), `decision-os-federation-${name}-`));
  const decisionOsRoot = join(home, name, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title: `${name} Specs`, ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({ cards: [{ id: `${name}-card`, title: `${name} card`, labels: ['master-task'], status: 'todo' }], annotations: [], relationships: [] }));
  return home;
}

async function waitFor<T>(read: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for federation state.');
}

test('two Decision OS nodes expose remote owner state without changing either local project registry', async () => {
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  const sockets = new Map<string, WebSocket>();
  const manifests = new Map<string, unknown[]>();
  const streams = new Map<string, { requester: string; owner: string }>();

  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    const nodeId = new URL(request.url ?? '/', 'http://relay.test').pathname.split('/').at(-1)!;
    sockets.set(nodeId, webSocket);
    webSocket.on('message', (data) => {
      const frame = JSON.parse(data.toString()) as Frame;
      if (frame.type === 'manifest') {
        manifests.set(nodeId, frame.projects ?? []);
        const catalog = JSON.stringify({ version: 1, type: 'catalog', nodes: [...manifests].map(([id, projects]) => ({ nodeId: id, online: sockets.has(id), projects })) });
        for (const target of sockets.values()) target.send(catalog);
        return;
      }
      if (frame.type === 'content-change') {
        for (const [targetId, target] of sockets) if (targetId !== nodeId) target.send(JSON.stringify({ version: 1, type: 'content-change' }));
        return;
      }
      if (frame.type === 'request-open' && frame.requestId && frame.to) {
        streams.set(frame.requestId, { requester: nodeId, owner: frame.to });
        sockets.get(frame.to)?.send(JSON.stringify({ ...frame, to: undefined }));
        return;
      }
      const stream = frame.requestId ? streams.get(frame.requestId) : undefined;
      if (!stream) return;
      const target = nodeId === stream.requester ? stream.owner : stream.requester;
      sockets.get(target)?.send(JSON.stringify(frame));
      if (frame.type === 'response-end' || frame.type === 'response-error' || frame.type === 'cancel') streams.delete(frame.requestId!);
    });
    webSocket.on('close', () => sockets.delete(nodeId));
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const relayUrl = `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`;

  const homeA = projectHome('alpha');
  const homeB = projectHome('beta');
  const runtimeA: Record<string, unknown> = { decisionOsSettings: { federationRelayUrl: relayUrl, federationId: 'proof', federationNodeId: 'node-a', federationNodeCredential: 'credential-a' } };
  const runtimeB: Record<string, unknown> = { decisionOsSettings: { federationRelayUrl: relayUrl, federationId: 'proof', federationNodeId: 'node-b', federationNodeCredential: 'credential-b' } };
  const repositoryRoot = join(process.cwd(), '..');
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: homeA, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtimeA });
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: homeB, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtimeB });
  const serverA = runtimeA.server as Server;
  const serverB = runtimeB.server as Server;
  await Promise.all([once(serverA, 'listening'), once(serverB, 'listening')]);
  const baseA = `http://127.0.0.1:${(serverA.address() as AddressInfo).port}`;
  const baseB = `http://127.0.0.1:${(serverB.address() as AddressInfo).port}`;

  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.ok(runtimeA.federationNodeConnector, `runtime A properties: ${Object.getOwnPropertyNames(runtimeA).join(',')}`);
    assert.ok(runtimeB.federationNodeConnector, `runtime B properties: ${Object.getOwnPropertyNames(runtimeB).join(',')}`);
    assert.deepEqual((runtimeA.federationNodeConnector as { status(): unknown }).status(), {
      configured: true, connected: true, socketState: 1, relayUrl, federationId: 'proof', nodeId: 'node-a', nodeLabel: 'node-a', credentialConfigured: true,
      peers: [{ nodeId: 'node-b', nodeLabel: 'node-b', online: true, projectCount: 1 }],
    });
    assert.deepEqual((runtimeB.federationNodeConnector as { status(): unknown }).status(), {
      configured: true, connected: true, socketState: 1, relayUrl, federationId: 'proof', nodeId: 'node-b', nodeLabel: 'node-b', credentialConfigured: true,
      peers: [{ nodeId: 'node-a', nodeLabel: 'node-a', online: true, projectCount: 1 }],
    });
    assert.equal(sockets.size, 2, 'both Decision OS connectors reached the relay');
    assert.equal(manifests.size, 2, 'both Decision OS connectors published a manifest');
    const catalogA = await waitFor(async () => {
      const body = await fetch(`${baseA}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string; name: string; remote?: boolean }> };
      return body.projects.some((project) => project.remote) ? body.projects : null;
    });
    const catalogB = await fetch(`${baseB}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string; name: string; remote?: boolean }> };
    const remoteBeta = catalogA.find((project) => project.remote && project.name === 'beta')!;
    assert.ok(remoteBeta.id.startsWith('node-b:'));
    assert.ok(catalogB.projects.some((project) => project.remote && project.name === 'alpha'));
    const controlRoomA = await fetch(`${baseA}/api/control-room`).then((response) => response.json()) as {
      projects: Array<{ id: string; ownerNodeId: string }>;
      allTasks: Array<{ projectId: string; ownerNodeId: string; title: string }>;
      federation: { nodeCount: number; remoteNodeCount: number };
    };
    assert.deepEqual(controlRoomA.federation, { nodeCount: 2, remoteNodeCount: 1 });
    assert.ok(controlRoomA.projects.some((project) => project.id.startsWith('node-b:') && project.ownerNodeId === 'node-b'));
    assert.ok(controlRoomA.allTasks.some((task) => task.title === 'beta card' && task.projectId.startsWith('node-b:') && task.ownerNodeId === 'node-b'));
    const settingsA = await fetch(`${baseA}/api/settings/federation`).then((response) => response.json()) as Record<string, unknown>;
    assert.equal(settingsA.connected, true);
    assert.equal(settingsA.credentialConfigured, true);
    assert.equal(Object.hasOwn(settingsA, 'nodeCredential'), false);

    const events = await fetch(`${baseA}/api/control-room-events`);
    const eventReader = events.body!.getReader();
    await eventReader.read();
    const directMutation = await fetch(`${baseB}/p/${encodeURIComponent(catalogB.projects.find((project) => !project.remote)!.id)}/decision-os/specs`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'beta-card', title: 'changed on owner' } }),
    });
    assert.equal(directMutation.status, 200);
    const remoteEvent = await Promise.race([
      eventReader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for federated Control Room event.')), 2_000)),
    ]);
    assert.match(new TextDecoder().decode(remoteEvent.value), /ledger-content-change/);
    await eventReader.cancel();

    const registryAPath = join(homeA, '.decision-os', 'projects.json');
    const registryBPath = join(homeB, '.decision-os', 'projects.json');
    const registryA = readFileSync(registryAPath, 'utf8');
    const registryB = readFileSync(registryBPath, 'utf8');

    const remoteLedger = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/specs`).then((response) => response.json()) as { cards: Array<{ title: string }> };
    assert.equal(remoteLedger.cards[0].title, 'changed on owner');
    const mutation = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/specs`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'beta-card', title: 'mutated by node-a' } }),
    });
    assert.equal(mutation.status, 200);
    assert.match(readFileSync(join(homeB, 'beta', '.decision-os', 'specs.json'), 'utf8'), /mutated by node-a/);
    assert.doesNotMatch(readFileSync(join(homeA, 'alpha', '.decision-os', 'specs.json'), 'utf8'), /mutated by node-a/);
    assert.equal(readFileSync(registryAPath, 'utf8'), registryA);
    assert.equal(readFileSync(registryBPath, 'utf8'), registryB);
  } finally {
    serverA.close();
    serverB.close();
    await Promise.all([once(serverA, 'close'), once(serverB, 'close')]);
    relay.close();
    relayHttp.close();
    await once(relayHttp, 'close');
    rmSync(homeA, { recursive: true, force: true });
    rmSync(homeB, { recursive: true, force: true });
  }
});
