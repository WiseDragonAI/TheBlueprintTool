import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { createFederationNodeConnector } from '@backend/business/federation/helper/federation-node-connector.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { readRepositorySyncStatus } from '@backend/business/project-sync/helper/repository-sync-status.js';
import { canonicalDecisionOsGitIgnore } from '@backend/business/server/helper/ensure-decision-os-git-repository.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';
import type { CodexPipelineRun } from '../../../shared/schemas/codex-pipeline-types.js';
import { canonicalFederationRepairBuckets } from '../../../shared/federation-repair-guard.js';
import {
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
  joinTaskEntities,
  taskCurrentBucketForEntityKey,
  type TaskCurrentBucket,
  type TaskCurrentEntity,
} from '../../../shared/task-current-state-core.js';

type Frame = { type: string; requestId?: string; to?: string; projects?: unknown[]; path?: string; projectId?: string; stateVersion?: number; payload?: Record<string, any> };

async function projectHome(name: string): Promise<string> {
  const home = mkdtempSync(join(tmpdir(), `decision-os-federation-${name}-`));
  const decisionOsRoot = join(home, name, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: `${name} Tasks`, ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: `${name}-card`,
      title: `${name} card`,
      labels: ['master-task'],
      status: 'todo',
      comment: { contentFile: `.decision-os/cards/tasks/${name}-card.md` },
    }, {
      id: `${name}-headless-card`,
      title: `${name} headless card`,
      labels: ['note'],
      status: 'todo',
      comment: { contentFile: `.decision-os/cards/tasks/${name}-headless-card.md` },
    }],
    annotations: [],
    relationships: [],
  }));
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', `${name}-card.md`), `${name} replicated body.`);
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: `${name}-project` }));
  await migrateTaskCurrentState({ decisionOsRoot, projectId: `${name}-project`, nodeId: name, tasksLedgerFile: join(decisionOsRoot, 'tasks.json') });
  return home;
}

function federatedLibraryFixture(home: string, suffix: string): void {
  const skillName = `${suffix}-skill`;
  const skillDirectory = join(home, '.skills', skillName);
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(join(skillDirectory, 'SKILL.md'), `---\nname: ${skillName}\ndescription: ${suffix} federation skill\n---\n\n# Instructions\n\nRun ${suffix}.\n`);
  writeCodexPipelineStore({
    decisionOsRoot: join(home, '.decision-os'),
    store: {
      pipelines: [{ id: `${suffix}-pipeline`, name: `${suffix} pipeline`, purpose: '', stepIds: [`${suffix}-step`], createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z' }],
      steps: [{ id: `${suffix}-step`, name: `${suffix} step`, purpose: '', skills: [{ id: `${suffix}-pipeline-skill`, skillName, codexModel: null, codexEffort: null }], createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z' }],
      runs: [], skillLibrary: [], activeWorkspaceRun: null,
    },
  });
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: home, stdio: 'ignore' });
  } catch {
    execFileSync('git', ['init', '-q'], { cwd: home });
  }
  execFileSync('git', ['add', '--', '.skills', '.decision-os/codex-pipelines.json'], { cwd: home });
  execFileSync('git', [
    '-c', 'user.name=Decision OS Test',
    '-c', 'user.email=test@decision-os.invalid',
    'commit', '-q', '-m', `commit ${suffix} federated library`,
  ], { cwd: home });
}

async function waitFor<T>(read: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for federation state.');
}

test('duplicate live catalogs notify downstream only once', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-duplicate-federation-catalog-'));
  const catalogFile = join(workspace, 'catalog.json');
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  const frame = JSON.stringify({
    version: 1,
    type: 'catalog',
    nodes: [{
      nodeId: 'node-b', nodeLabel: 'Node B', online: true,
      projects: [{ id: 'project-b', name: 'Project B', description: '', color: '#123456', ledgers: [], originFingerprint: 'origin-b' }],
    }],
  });
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.send(frame);
    setTimeout(() => webSocket.send(frame), 25);
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  let changes = 0;
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof', federationNodeId: 'node-a', federationNodeCredential: 'credential',
    },
    catalogFile,
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    onRemoteCatalogChange: () => { changes += 1; },
  });
  context.after(async () => {
    connector.stop();
    relay.close();
    await new Promise<void>((resolveClose) => relayHttp.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  });
  connector.start();

  await waitFor(async () => changes === 1 && existsSync(catalogFile) ? true : null);
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.equal(changes, 1);
  assert.equal(connector.remoteProjects()[0]?.online, true);
});

test('retains configured node identity while relay transport is not configured', () => {
  const connector = createFederationNodeConnector({
    settings: { federationNodeId: 'workstation', federationNodeLabel: 'Workstation' },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
  });
  try {
    assert.equal(connector.status().configured, false);
    assert.deepEqual(connector.localOwner(), {
      ownerNodeId: 'workstation',
      ownerNodeLabel: 'Workstation',
      online: true,
    });
    connector.reconfigure({ federationNodeId: 'phone', federationNodeLabel: 'Mobile' });
    assert.equal(connector.status().configured, false);
    assert.deepEqual(connector.localOwner(), {
      ownerNodeId: 'phone',
      ownerNodeLabel: 'Mobile',
      online: true,
    });
  } finally {
    connector.stop();
  }
});

test('loads the retained remote project catalog as offline discovery state', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-retained-federation-catalog-'));
  const catalogFile = join(workspace, 'federation-project-catalog.json');
  writeFileSync(catalogFile, JSON.stringify({
    version: 1,
    federationId: 'proof',
    nodes: [{
      nodeId: 'node-b',
      nodeLabel: 'Node B',
      projects: [{
        id: 'project-b',
        name: 'Project B',
        description: '',
        color: '#123456',
        ledgers: [],
        originFingerprint: 'origin-b',
      }],
    }],
  }));
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: 'http://127.0.0.1:1',
      federationId: 'proof',
      federationNodeId: 'node-a',
      federationNodeCredential: 'credential',
    },
    catalogFile,
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
  });
  try {
    assert.deepEqual(connector.nodes(), [{
      nodeId: 'node-b',
      nodeLabel: 'Node B',
      online: false,
      projectCount: 1,
    }]);
    assert.deepEqual(connector.remoteProjects().map((project) => ({
      id: project.id,
      localProjectId: project.localProjectId,
      ownerNodeId: project.ownerNodeId,
      online: project.online,
    })), [{
      id: 'node-b:project-b',
      localProjectId: 'project-b',
      ownerNodeId: 'node-b',
      online: false,
    }]);
  } finally {
    connector.stop();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('preserves invalid retained project catalog bytes and reports the owning scope', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-invalid-federation-catalog-'));
  const catalogFile = join(workspace, 'federation-project-catalog.json');
  const invalid = '{"version":1,"nodes":';
  const operations: string[] = [];
  writeFileSync(catalogFile, invalid);
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: 'http://127.0.0.1:1',
      federationId: 'proof',
      federationNodeId: 'node-a',
      federationNodeCredential: 'credential',
    },
    catalogFile,
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    onError: (_error, context) => operations.push(context.operation),
  });
  try {
    assert.deepEqual(connector.remoteProjects(), []);
    assert.equal(readFileSync(catalogFile, 'utf8'), invalid);
    assert.deepEqual(operations, ['read-retained-project-catalog']);
    assert.equal(connector.status().catalogWritable, false);
    writeFileSync(catalogFile, JSON.stringify({
      version: 1,
      federationId: 'proof',
      nodes: [{
        nodeId: 'node-b',
        nodeLabel: 'Node B',
        projects: [{
          id: 'project-b',
          name: 'Project B',
          description: '',
          color: '#000000',
          ledgers: [],
          originFingerprint: 'proof-origin',
        }],
      }],
    }));
    connector.recoverRetainedProjectCatalog();
    assert.equal(connector.status().catalogWritable, true);
    assert.deepEqual(connector.remoteProjects().map((project) => project.localProjectId), ['project-b']);
  } finally {
    connector.stop();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('keeps relay catalogs paused and installs recovery only after durable persistence succeeds', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-paused-federation-catalog-'));
  const catalogFile = join(workspace, 'federation-project-catalog.json');
  const invalid = '{"version":1,"nodes":';
  writeFileSync(catalogFile, invalid);
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.send(JSON.stringify({
      type: 'catalog',
      nodes: [{
        nodeId: 'node-b',
        nodeLabel: 'Node B',
        online: true,
        projects: [{ id: 'relay-project', name: 'Relay', description: '', color: '#000000', ledgers: [], originFingerprint: 'relay-origin' }],
      }],
    }));
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'node-a',
      federationNodeCredential: 'credential',
    },
    catalogFile,
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
  });
  // WHAT: Start the connector so the fixture completes the same authenticated WebSocket handshake as production.
  // WHY: Creating a connector does not open its relay transport, so an unstarted fixture can never reach the connected phase or receive its catalog.
  connector.start();
  try {
    await waitFor(async () => connector.status().phase === 'connected' ? true : null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(connector.remoteProjects(), []);
    assert.equal(readFileSync(catalogFile, 'utf8'), invalid);

    writeFileSync(catalogFile, JSON.stringify({
      version: 1,
      federationId: 'proof',
      nodes: [{
        nodeId: 'node-c',
        nodeLabel: 'Node C',
        projects: [{ id: 'recovered-project', name: 'Recovered', description: '', color: '#000000', ledgers: [], originFingerprint: 'recovered-origin' }],
      }],
    }));
    mkdirSync(`${catalogFile}.tmp`);
    assert.throws(() => connector.recoverRetainedProjectCatalog());
    assert.equal(connector.status().catalogWritable, false);
    assert.deepEqual(connector.remoteProjects(), []);

    rmSync(`${catalogFile}.tmp`, { recursive: true, force: true });
    connector.recoverRetainedProjectCatalog();
    assert.equal(connector.status().catalogWritable, true);
    assert.deepEqual(connector.remoteProjects().map((project) => project.localProjectId), ['recovered-project']);
  } finally {
    connector.stop();
    relay.clients.forEach((client) => client.close());
    await new Promise<void>((resolve) => relayHttp.close(() => resolve()));
    relay.close();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('stops retrying when another server owns the configured node identity', async () => {
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let connectionCount = 0;
  let disconnectCount = 0;
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    connectionCount += 1;
    webSocket.close(4001, 'replaced');
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'duplicate-node',
      federationNodeCredential: 'credential',
    },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    onStateDisconnected: () => { disconnectCount += 1; },
  });
  connector.start();
  try {
    const status = await waitFor(async () => {
      const value = connector.status();
      return value.lastCloseCode === 4001 && value.phase === 'disconnected' ? value : null;
    });
    assert.equal(status.connected, false);
    assert.equal(status.lastCloseReason, 'replaced');
    assert.match(status.lastError, /unique node identity/);
    assert.equal(status.reconnectAttempt, 0);
    assert.equal(status.nextRetryAt, null);
    assert.equal(status.connectTimeoutMs, 10_000);
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    assert.equal(connectionCount, 1, 'a replaced connector must not fight the active owner');
    assert.equal(disconnectCount, 1, 'the replaced socket retires its state-lane deliveries exactly once');
  } finally {
    connector.stop();
    relay.close();
    relayHttp.close();
    await once(relayHttp, 'close');
  }
});

test('stops retrying when the relay rejects node authentication', async () => {
  const relayHttp = createServer();
  let connectionCount = 0;
  relayHttp.on('upgrade', (_request, socket) => {
    connectionCount += 1;
    socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
  });
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'unauthorized-node',
      federationNodeCredential: 'invalid',
    },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
  });
  connector.start();
  try {
    const status = await waitFor(async () => {
      const value = connector.status();
      return value.phase === 'disconnected' && value.lastError.includes('(401)') ? value : null;
    });
    assert.equal(status.nextRetryAt, null);
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    assert.equal(connectionCount, 1, 'invalid credentials must wait for explicit correction');
  } finally {
    connector.stop();
    relayHttp.close();
    await once(relayHttp, 'close');
  }
});

test('bounds internal federation requests and cancels a missing owner response', async () => {
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let cancelledRequestId = '';
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.on('message', (data) => {
      const frame = JSON.parse(data.toString()) as Frame;
      if (frame.type === 'manifest') {
        webSocket.send(JSON.stringify({
          version: 1,
          type: 'catalog',
          nodes: [
            { nodeId: 'requester', online: true, projects: [] },
            { nodeId: 'owner', online: true, projects: [] },
          ],
        }));
      }
      if (frame.type === 'cancel') cancelledRequestId = String(frame.requestId ?? '');
    });
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'requester',
      federationNodeCredential: 'credential',
    },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    internalRequestTimeoutMs: 1_000,
  });
  connector.start();
  try {
    await waitFor(async () => connector.status().peers.some((peer) => peer.nodeId === 'owner') ? true : null);
    const response = await connector.request('owner', '/held', { timeoutMs: 25 });
    assert.equal(response.status, 504);
    assert.equal(JSON.parse(response.body.toString('utf8')).error, 'federation_request_timeout');
    await waitFor(async () => cancelledRequestId ? true : null);
    assert.ok(cancelledRequestId);
    assert.equal(connector.status().internalRequestTimeoutMs, 1_000);
    assert.equal(connector.status().requesterStreamCount, 0);
  } finally {
    connector.stop();
    relay.close();
    relayHttp.close();
    await once(relayHttp, 'close');
  }
});

test('bounds owner response credit waits and releases the stalled stream', async () => {
  const ownerHttp = createServer((_request, response) => {
    response.setHeader('content-type', 'application/octet-stream');
    response.end(Buffer.alloc(1024 * 1024 + 64 * 1024, 1));
  });
  ownerHttp.listen(0, '127.0.0.1');
  await once(ownerHttp, 'listening');

  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let responseError: Record<string, unknown> | null = null;
  const connectorErrors: Array<{ message: string; operation: string }> = [];
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    let opened = false;
    webSocket.on('message', (data) => {
      const frame = JSON.parse(data.toString()) as Frame & Record<string, unknown>;
      if (frame.type === 'manifest' && !opened) {
        opened = true;
        webSocket.send(JSON.stringify({ version: 1, type: 'request-open', requestId: 'held-credit', method: 'GET', path: '/large', headers: {} }));
        webSocket.send(JSON.stringify({ version: 1, type: 'request-end', requestId: 'held-credit' }));
      }
      if (frame.type === 'response-error') responseError = frame;
    });
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'owner',
      federationNodeCredential: 'credential',
    },
    localProjects: () => [],
    localServerUrl: () => `http://127.0.0.1:${(ownerHttp.address() as AddressInfo).port}`,
    flowControlTimeoutMs: 25,
    onError: (error, context) => connectorErrors.push({
      message: error instanceof Error ? error.message : String(error),
      operation: context.operation,
    }),
  });
  connector.start();
  try {
    await waitFor(async () => responseError ? true : null);
    assert.equal(responseError?.code, 'owner_request_failed');
    assert.ok(connectorErrors.some((entry) => entry.operation === 'owner-request' && entry.message === 'federation_credit_timeout:25'));
    assert.equal(connector.status().ownerStreamCount, 0);
    assert.equal(connector.status().flowControlTimeoutMs, 25);
    assert.equal(connector.status().ownerRequestTimeoutMs, 30 * 60_000);
  } finally {
    connector.stop();
    relay.close();
    relayHttp.close();
    ownerHttp.close();
    await Promise.all([once(relayHttp, 'close'), once(ownerHttp, 'close')]);
  }
});

test('expires an owner stream that never receives its request end', async () => {
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let responseError: Record<string, unknown> | null = null;
  const connectorErrors: string[] = [];
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.on('message', (data) => {
      const frame = JSON.parse(data.toString()) as Frame & Record<string, unknown>;
      if (frame.type === 'manifest') webSocket.send(JSON.stringify({ version: 1, type: 'request-open', requestId: 'never-ended', method: 'POST', path: '/held', headers: {} }));
      if (frame.type === 'response-error') responseError = frame;
    });
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'owner',
      federationNodeCredential: 'credential',
    },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    ownerRequestTimeoutMs: 25,
    onError: (error, context) => connectorErrors.push(`${context.operation}:${error instanceof Error ? error.message : String(error)}`),
  });
  connector.start();
  try {
    await waitFor(async () => responseError ? true : null);
    assert.equal(responseError?.code, 'owner_request_timeout');
    assert.deepEqual(connectorErrors, ['owner-request-open:federation_owner_open_timeout:25']);
    assert.equal(connector.status().ownerStreamCount, 0);
  } finally {
    connector.stop();
    relay.close();
    relayHttp.close();
    await once(relayHttp, 'close');
  }
});

test('expires an HTTP proxy stream when the owner never responds', async () => {
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let cancelledRequestId = '';
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.on('message', (data) => {
      const frame = JSON.parse(data.toString()) as Frame;
      if (frame.type === 'manifest') webSocket.send(JSON.stringify({
        version: 1,
        type: 'catalog',
        nodes: [
          { nodeId: 'requester', online: true, projects: [] },
          { nodeId: 'owner', online: true, projects: [] },
        ],
      }));
      if (frame.type === 'cancel') cancelledRequestId = String(frame.requestId ?? '');
    });
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const connector = createFederationNodeConnector({
    settings: {
      federationRelayUrl: `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`,
      federationId: 'proof',
      federationNodeId: 'requester',
      federationNodeCredential: 'credential',
    },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    internalRequestTimeoutMs: 25,
  });
  const proxyHttp = createServer((request, response) => { void connector.proxy(request, response, 'owner', 'project', '/api/state'); });
  proxyHttp.listen(0, '127.0.0.1');
  await once(proxyHttp, 'listening');
  connector.start();
  try {
    await waitFor(async () => connector.status().peers.some((peer) => peer.nodeId === 'owner') ? true : null);
    const response = await fetch(`http://127.0.0.1:${(proxyHttp.address() as AddressInfo).port}/held`);
    assert.equal(response.status, 504);
    assert.equal((await response.json() as { error: string }).error, 'federation_request_timeout');
    await waitFor(async () => cancelledRequestId ? true : null);
    assert.equal(connector.status().requesterStreamCount, 0);
  } finally {
    connector.stop();
    relay.close();
    relayHttp.close();
    proxyHttp.close();
    await Promise.all([once(relayHttp, 'close'), once(proxyHttp, 'close')]);
  }
});

test('two Decision OS nodes materialize complete libraries locally and retain them after an owner disconnects', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const previousCodexBin = process.env.CODEX_BIN;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-codex-home-'));
  process.env.CODEX_HOME = codexHome;
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  const sockets = new Map<string, WebSocket>();
  const manifests = new Map<string, unknown[]>();
  const streams = new Map<string, { requester: string; owner: string }>();
  const proxiedPaths: string[] = [];
  const retainedState = new Map<string, Map<string, TaskCurrentEntity>>();
  const subscriptions = new Map<string, Set<string>>();
  const repairs = new Map<string, { projectId: string; attemptId: string; frames: Frame[]; next: number }>();
  const stateEvents: Array<Record<string, unknown>> = [];
  const recordStateEvent = (event: Record<string, unknown>): void => {
    stateEvents.push(event);
    // WHAT: Retain only the latest bounded fixture transitions.
    // WHY: A failed integration must expose its first missing repair boundary without unbounded logs.
    if (stateEvents.length > 200) stateEvents.shift();
  };
  const participates = (nodeId: string, projectId: string): boolean => (
    (manifests.get(nodeId) ?? []).some((project) => String((project as Record<string, unknown>).id ?? '') === projectId)
    || subscriptions.get(nodeId)?.has(projectId) === true
  );
  const relayManifest = (projectId: string): TaskCurrentBucket[] => {
    const buckets = new Map<string, Array<[string, { stateHash: string }]>>();
    for (const [key, entity] of retainedState.get(projectId) ?? []) {
      const bucket = taskCurrentBucketForEntityKey(key);
      const entries = buckets.get(bucket) ?? [];
      entries.push([key, { stateHash: entity.stateHash }]);
      buckets.set(bucket, entries);
    }
    return [...buckets].sort(([left], [right]) => left.localeCompare(right)).map(([bucket, entries]) => ({
      bucket,
      count: entries.length,
      checksum: hashTaskCurrentBucket(entries),
    }));
  };
  const sendRelaySummary = (target: WebSocket, projectId: string): void => {
    const buckets = relayManifest(projectId);
    recordStateEvent({ event: 'summary', projectId, root: hashTaskCurrentRoot(buckets), bucketCount: buckets.length });
    target.send(JSON.stringify({
      version: 1,
      type: 'state-bucket-summary',
      from: 'relay',
      projectId,
      stateVersion: 4,
      payload: { stateVersion: 4, root: hashTaskCurrentRoot(buckets), buckets },
    }));
  };
  const boundedRelayFrames = (projectId: string, entities: TaskCurrentEntity[]): Frame[] => {
    const sessionId = randomUUID();
    const frames: Frame[] = [];
    for (let offset = 0; offset < entities.length; offset += 128) {
      const entries = entities.slice(offset, offset + 128).map((entity) => ({
        key: `${entity.entityType}\u0000${entity.entityId}`,
        stateHash: entity.stateHash,
        entity,
      }));
      frames.push({
        type: 'state-entity-batch',
        projectId,
        stateVersion: 4,
        payload: { stateVersion: 4, deliveryId: `fixture-${sessionId}-${offset}`, entries },
      });
    }
    return frames;
  };
  const sendNextRepairFrame = (nodeId: string): void => {
    const socket = sockets.get(nodeId);
    // WHAT: Keep a disconnected receiver's retained relay state available for resubscription.
    // WHY: Socket lifetime must not own the canonical project state.
    if (!socket) return;
    const candidates = [...repairs].filter(([key]) => key.startsWith(`${nodeId}\u0000`));
    for (const [key, repair] of candidates) {
      const frame = repair.frames[repair.next];
      // WHAT: Send the terminal relay summary only after every bounded frame is acknowledged.
      // WHY: Equal-root comparison is the durable completion authority.
      if (!frame) {
        repairs.delete(key);
        sendRelaySummary(socket, repair.projectId);
        continue;
      }
      socket.send(JSON.stringify({
        ...frame,
        from: 'relay',
        payload: { ...frame.payload, attemptId: repair.attemptId },
      }));
      recordStateEvent({ event: 'delivery', nodeId, projectId: repair.projectId, attemptId: repair.attemptId, deliveryId: frame.payload?.deliveryId, entryCount: frame.payload?.entries?.length ?? 0 });
    }
  };

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
      if (frame.type === 'state-entity-batch' && !frame.to) {
        const entries = Array.isArray(frame.payload?.entries) ? frame.payload.entries : [];
        const projectState = retainedState.get(String(frame.projectId)) ?? new Map<string, TaskCurrentEntity>();
        const changed: TaskCurrentEntity[] = [];
        for (const entry of entries) {
          const key = String(entry.key);
          const current = projectState.get(key);
          const joined = joinTaskEntities(current, entry.entity as TaskCurrentEntity);
          projectState.set(key, joined);
          // WHAT: Forward only a durable joined entity whose canonical hash advanced.
          // WHY: Live participants need the same incremental state accepted by the relay authority.
          if (current?.stateHash !== joined.stateHash) changed.push(joined);
        }
        retainedState.set(String(frame.projectId), projectState);
        // WHAT: Acknowledge the persisted relay batch before the node advances its project publication lane.
        // WHY: The production relay owns delivery settlement; a test relay that omits it permanently blocks later state deltas.
        webSocket.send(JSON.stringify({
          version: 1,
          type: 'state-relay-ack',
          from: 'relay',
          projectId: frame.projectId,
          stateVersion: frame.stateVersion,
          payload: {
            stateVersion: frame.payload?.stateVersion,
            deliveryId: frame.payload?.deliveryId,
            accepted: entries.map((entry: Record<string, unknown>) => ({ key: entry.key, stateHash: entry.stateHash })),
          },
        }));
        for (const [targetId, target] of sockets) {
          // WHAT: Deliver durable joined deltas only to other project participants.
          // WHY: Manifest owners and subscribers share the production relay participation contract.
          if (targetId === nodeId || !participates(targetId, String(frame.projectId))) continue;
          for (const liveFrame of boundedRelayFrames(String(frame.projectId), changed)) {
            target.send(JSON.stringify({ ...liveFrame, from: 'relay' }));
          }
        }
        return;
      }
      if (frame.type === 'state-bucket-summary' && !frame.to) {
        const projectId = String(frame.projectId);
        const remoteBuckets = Array.isArray(frame.payload?.buckets) ? frame.payload.buckets : [];
        const relayRoot = hashTaskCurrentRoot(relayManifest(projectId));
        const remoteRoot = String(frame.payload?.root ?? '');
        // WHAT: Request the publisher's canonical buckets when the retained relay root differs.
        // WHY: Initial source state must enter relay authority before any subscriber can repair from it.
        if (remoteRoot !== relayRoot && remoteBuckets.length > 0) {
          const buckets = remoteBuckets.map((bucket: Record<string, unknown>) => String(bucket.bucket ?? ''));
          webSocket.send(JSON.stringify({
            version: 1,
            type: 'state-missing-request',
            from: 'relay',
            projectId,
            stateVersion: 4,
            payload: { stateVersion: 4, buckets },
          }));
          recordStateEvent({ event: 'source-missing', nodeId, projectId, bucketCount: buckets.length, remoteRoot, relayRoot });
        }
        for (const [targetId, target] of sockets) {
          // WHAT: Notify only nodes subscribed to this retained project.
          // WHY: Relay-owned repair must not broadcast entity state to nonparticipants.
          if (participates(targetId, projectId)) sendRelaySummary(target, projectId);
        }
        return;
      }
      if (frame.type === 'state-execution-observation' && !frame.to) {
        for (const [targetId, target] of sockets) {
          if (targetId !== nodeId) target.send(JSON.stringify({ ...frame, from: nodeId }));
        }
        return;
      }
      if (frame.type === 'state-subscribe') {
        const projectId = String(frame.projectId);
        recordStateEvent({ event: 'subscribe', nodeId, projectId });
        const owned = subscriptions.get(nodeId) ?? new Set<string>();
        owned.add(projectId);
        subscriptions.set(nodeId, owned);
        sendRelaySummary(webSocket, projectId);
        return;
      }
      if (frame.type === 'state-missing-request' && !frame.to) {
        const projectId = String(frame.projectId);
        const requested = new Set(canonicalFederationRepairBuckets(
          Array.isArray(frame.payload?.buckets) ? frame.payload.buckets : [],
        ));
        const entities = [...(retainedState.get(projectId)?.entries() ?? [])]
          .filter(([key]) => requested.has(taskCurrentBucketForEntityKey(key)))
          .map(([, entity]) => entity);
        recordStateEvent({ event: 'missing', nodeId, projectId, attemptId: frame.payload?.attemptId, requested: [...requested], selected: entities.length, retained: retainedState.get(projectId)?.size ?? 0 });
        const frames = boundedRelayFrames(projectId, entities);
        repairs.set(`${nodeId}\u0000${projectId}`, {
          projectId,
          attemptId: String(frame.payload?.attemptId ?? ''),
          frames,
          next: 0,
        });
        sendNextRepairFrame(nodeId);
        return;
      }
      if ((frame.type === 'state-ack' || frame.type === 'state-relay-ack') && !frame.to) {
        const key = `${nodeId}\u0000${String(frame.projectId)}`;
        const repair = repairs.get(key);
        const currentFrame = repair?.frames[repair.next];
        const accepted = new Map((Array.isArray(frame.payload?.accepted) ? frame.payload.accepted : [])
          .map((entry: Record<string, unknown>) => [String(entry.key), String(entry.stateHash)]));
        const currentEntries = Array.isArray(currentFrame?.payload?.entries) ? currentFrame.payload.entries : [];
        const exactAcknowledgement = Boolean(currentFrame
          && String(frame.payload?.deliveryId ?? '') === String(currentFrame.payload?.deliveryId ?? '')
          && String(frame.payload?.attemptId ?? '') === repair?.attemptId
          && accepted.size === currentEntries.length
          && currentEntries.every((entry: Record<string, unknown>) => accepted.get(String(entry.key)) === String(entry.stateHash)));
        recordStateEvent({ event: 'ack', nodeId, projectId: frame.projectId, attemptId: frame.payload?.attemptId, deliveryId: frame.payload?.deliveryId, accepted: accepted.size, exactAcknowledgement });
        // WHAT: Advance only the active receiver repair after its durable acknowledgement.
        // WHY: Socket delivery alone cannot release relay repair credit.
        if (repair && exactAcknowledgement) {
          repair.next += 1;
          sendNextRepairFrame(nodeId);
        }
        return;
      }
      if (frame.type === 'state-converged' && !frame.to) {
        recordStateEvent({ event: 'converged', nodeId, projectId: frame.projectId, root: frame.payload?.root, attemptId: frame.payload?.attemptId });
        repairs.delete(`${nodeId}\u0000${String(frame.projectId)}`);
        return;
      }
      if (frame.type.startsWith('state-') && frame.to) {
        sockets.get(frame.to)?.send(JSON.stringify({ ...frame, from: nodeId }));
        return;
      }
      if (frame.type === 'request-open' && frame.requestId && frame.to) {
        proxiedPaths.push(String(frame.path ?? ''));
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
    webSocket.on('close', () => {
      sockets.delete(nodeId);
      subscriptions.delete(nodeId);
      for (const key of [...repairs.keys()]) {
        // WHAT: Clear only repair sessions owned by the disconnected socket.
        // WHY: Retained relay entities and other receivers remain authoritative.
        if (key.startsWith(`${nodeId}\u0000`)) repairs.delete(key);
      }
      const catalog = JSON.stringify({ version: 1, type: 'catalog', nodes: [...manifests].map(([id, projects]) => ({ nodeId: id, online: sockets.has(id), projects })) });
      for (const target of sockets.values()) target.send(catalog);
    });
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const relayUrl = `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`;

  const homeA = await projectHome('alpha');
  const homeB = await projectHome('beta');
  federatedLibraryFixture(homeA, 'alpha');
  federatedLibraryFixture(homeB, 'beta');
  const betaRoot = join(homeB, 'beta');
  const betaOrigin = join(homeB, 'beta-origin.git');
  execFileSync('git', ['init', '--bare', betaOrigin]);
  execFileSync('git', ['-C', betaRoot, 'init', '-b', 'main']);
  execFileSync('git', ['-C', betaRoot, 'config', 'user.name', 'Decision OS Test']);
  execFileSync('git', ['-C', betaRoot, 'config', 'user.email', 'test@decision-os.invalid']);
  writeFileSync(join(betaRoot, '.gitignore'), [
    '.decision-os-codex-execution-rollback/',
    '.decision-os/codex-executions.json',
    '.decision-os/codex-pipelines.json',
    '.decision-os/runs/',
    '.decision-os/task-state/',
    '',
  ].join('\n'));
  writeFileSync(join(betaRoot, '.decision-os', '.gitignore'), canonicalDecisionOsGitIgnore);
  execFileSync('git', ['-C', betaRoot, 'add', '.']);
  execFileSync('git', ['-C', betaRoot, 'commit', '-m', 'initialize beta project']);
  execFileSync('git', ['-C', betaRoot, 'remote', 'add', 'origin', betaOrigin]);
  execFileSync('git', ['-C', betaRoot, 'push', '-u', 'origin', 'main']);
  execFileSync('git', ['-C', betaRoot, 'remote', 'set-url', 'origin', `git://127.0.0.1:${(relayHttp.address() as AddressInfo).port}/beta.git`]);
  const projectSyncSkill = join(homeB, '.skills', 'project-sync-initiator-reconciler');
  mkdirSync(projectSyncSkill, { recursive: true });
  writeFileSync(join(projectSyncSkill, 'SKILL.md'), [
    '---',
    'name: project-sync-initiator-reconciler',
    'description: Reconcile a federated project synchronization.',
    '---',
    '',
    'Return the verified repository SHA evidence as JSON.',
    '',
  ].join('\n'));
  const fakeCodex = join(homeB, 'fake-codex.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { execFileSync } from "node:child_process";',
    'import { writeFileSync } from "node:fs";',
    'import { join } from "node:path";',
    'let prompt = "";',
    'for await (const chunk of process.stdin) prompt += chunk;',
    'if (prompt.includes("initiator-reconciler")) {',
    '  if (prompt.includes("federated-cancellation-proof")) await new Promise(() => setInterval(() => undefined, 1000));',
    '  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "project-sync-thread" }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "evidence", type: "agent_message", text: JSON.stringify({ status: "complete", headSha: sha, originSha: sha }) } }));',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '  process.exit(0);',
    '}',
    'writeFileSync(join(process.cwd(), "node-message-prompt.txt"), prompt);',
    'if (prompt.includes("Wait for requester cancellation.")) await new Promise(() => setInterval(() => undefined, 1000));',
    'console.log(JSON.stringify({ type: "thread.started", thread_id: "node-message-thread" }));',
    'console.log(JSON.stringify({ type: "item.completed", item: { id: "answer", type: "agent_message", text: `Inspected beta on ${process.cwd()}.` } }));',
    'console.log(JSON.stringify({ type: "turn.completed" }));',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtimeA: Record<string, unknown> = { decisionOsSettings: { federationRelayUrl: relayUrl, federationId: 'proof', federationNodeId: 'node-a', federationNodeCredential: 'credential-a' } };
  const runtimeB: Record<string, unknown> = { decisionOsSettings: { federationRelayUrl: relayUrl, federationId: 'proof', federationNodeId: 'node-b', federationNodeCredential: 'credential-b', codexBin: fakeCodex } };
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
    const statusA = (runtimeA.federationNodeConnector as { status(): Record<string, unknown> }).status();
    const statusB = (runtimeB.federationNodeConnector as { status(): Record<string, unknown> }).status();
    assert.deepEqual({
      configured: statusA.configured, connected: statusA.connected, socketState: statusA.socketState, phase: statusA.phase,
      relayUrl: statusA.relayUrl, federationId: statusA.federationId, nodeId: statusA.nodeId, nodeLabel: statusA.nodeLabel,
      credentialConfigured: statusA.credentialConfigured, peers: statusA.peers,
    }, {
      configured: true, connected: true, socketState: 1, phase: 'connected', relayUrl, federationId: 'proof', nodeId: 'node-a', nodeLabel: 'node-a', credentialConfigured: true,
      peers: [{ nodeId: 'node-b', nodeLabel: 'node-b', online: true, projectCount: 1 }],
    });
    assert.equal(statusA.connectTimeoutMs, 10_000);
    assert.equal(typeof statusA.connectedAt, 'number');
    assert.equal(statusA.lastError, '');
    assert.deepEqual({
      configured: statusB.configured, connected: statusB.connected, socketState: statusB.socketState, phase: statusB.phase,
      relayUrl: statusB.relayUrl, federationId: statusB.federationId, nodeId: statusB.nodeId, nodeLabel: statusB.nodeLabel,
      credentialConfigured: statusB.credentialConfigured, peers: statusB.peers,
    }, {
      configured: true, connected: true, socketState: 1, phase: 'connected', relayUrl, federationId: 'proof', nodeId: 'node-b', nodeLabel: 'node-b', credentialConfigured: true,
      peers: [{ nodeId: 'node-a', nodeLabel: 'node-a', online: true, projectCount: 1 }],
    });
    assert.equal(sockets.size, 2, 'both Decision OS connectors reached the relay');
    assert.equal(manifests.size, 2, 'both Decision OS connectors published a manifest');
    const catalogA = await waitFor(async () => {
      const body = await fetch(`${baseA}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string; name: string; replicas: Array<{ nodeId: string }> }> };
      return body.projects.some((project) => project.replicas.some((replica) => replica.nodeId === 'node-b')) ? body.projects : null;
    });
    const catalogB = await fetch(`${baseB}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string; name: string; replicas: Array<{ nodeId: string }> }> };
    const remoteBeta = catalogA.find((project) => project.name === 'beta')!;
    const alphaProjectId = catalogA.find((project) => project.name === 'alpha')!.id;
    assert.equal(remoteBeta.id.includes(':'), false);
    assert.ok(catalogB.projects.some((project) => project.name === 'alpha' && project.replicas.some((replica) => replica.nodeId === 'node-a')));
    const betaProjectId = catalogB.projects.find((project) => project.name === 'beta')!.id;
    const nodeCatalog = await fetch(`${baseA}/api/federation/nodes`).then((response) => response.json()) as {
      ok: boolean;
      nodes: Array<{ nodeId: string; local: boolean; projects: Array<{ projectId: string }> }>;
    };
    assert.equal(nodeCatalog.ok, true);
    assert.ok(nodeCatalog.nodes.some((node) => node.nodeId === 'node-a' && node.local));
    assert.ok(nodeCatalog.nodes.some((node) => node.nodeId === 'node-b' && !node.local && node.projects.some((project) => project.projectId === betaProjectId)));
    const projectSyncSnapshot = readRepositorySyncStatus(betaRoot);
    const createdAt = '2026-07-23T07:00:00.000Z';
    const pipelineRunId = 'federated-project-sync-proof';
    const pipelineStepId = 'federated-project-sync-proof-step';
    const pipelineSkillRunId = 'federated-project-sync-proof-skill-run';
    const executionId = 'federated-project-sync-proof-execution';
    const pipelineRun: CodexPipelineRun = {
      id: pipelineRunId,
      restartOfPipelineRunId: null,
      pipelineId: 'project-sync',
      pipelineName: 'Federated project synchronization proof',
      temporary: true,
      executionMode: 'federated',
      ledgerId: 'tasks',
      sourceCardId: 'alpha-card',
      sourceCardTitle: 'alpha card',
      outputParentCardId: 'alpha-card',
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      finishedAt: null,
      resumedAt: null,
      error: '',
      steps: [{
        id: pipelineStepId,
        stepId: 'project-sync-initiator-reconciler',
        name: 'Initiator reconciler',
        purpose: 'Prove selected-node execution through the shared scheduler.',
        outputCardId: 'alpha-card',
        outputSubtaskPosition: 0,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
        error: '',
        skills: [{
          id: 'federated-project-sync-proof-skill',
          pipelineSkillId: 'project-sync-initiator-reconciler',
          skillName: 'project-sync-initiator-reconciler',
          runId: pipelineSkillRunId,
          executionId,
          status: 'pending',
          codexModel: 'gpt-5.6-sol',
          codexEffort: 'medium',
          stdoutFile: '/requester-only/project-sync.jsonl',
          stderrFile: '/requester-only/project-sync.log',
          startedAt: null,
          finishedAt: null,
          error: '',
          executor: {
            kind: 'federated',
            nodeId: 'node-b',
            projectId: betaProjectId,
            role: 'initiator-reconciler',
          },
        }],
      }],
    };
    const executionMetadata = {
      executionId,
      requestId: `pipeline:${pipelineRunId}:${executionId}`,
      sessionId: pipelineSkillRunId,
      projectId: alphaProjectId,
      ledgerId: 'tasks',
      taskId: 'alpha-card',
      sourceCardId: 'alpha-card',
      ownerCardId: 'alpha-card',
      kind: 'pipeline-skill',
      requestedAt: createdAt,
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId,
      pipelineStepId,
      pipelineSkillRunId,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    };
    const alphaDecisionOsRoot = join(homeA, 'alpha', '.decision-os');
    const alphaPipelineStore = readCodexPipelineStore({ decisionOsRoot: alphaDecisionOsRoot }).store;
    writeCodexPipelineStore({
      decisionOsRoot: alphaDecisionOsRoot,
      store: { ...alphaPipelineStore, runs: [...alphaPipelineStore.runs, pipelineRun] },
    });
    const selectedNodeResponse = await (runtimeA.federationNodeConnector as {
      request(nodeId: string, path: string, options: {
        method: string;
        headers: Record<string, string>;
        body: Buffer;
        timeoutMs: number;
      }): Promise<{ status: number; body: Buffer }>;
    }).request('node-b', '/api/project-sync/role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeoutMs: 10_000,
      body: Buffer.from(JSON.stringify({
        syncId: 'federated-project-sync-proof',
        initiatorNodeId: 'node-a',
        projectId: betaProjectId,
        role: 'initiator-reconciler',
        originFingerprint: projectSyncSnapshot.originFingerprint,
        snapshot: projectSyncSnapshot,
        pipelineRunId,
        pipelineSkillRunId,
        executionId,
        executionMetadata,
        pipelineRun,
        masterTask: { projectId: alphaProjectId, ledgerId: 'tasks', cardId: 'alpha-card' },
      })),
    });
    const selectedNodeBody = JSON.parse(selectedNodeResponse.body.toString('utf8')) as Record<string, any>;
    assert.equal(selectedNodeResponse.status, 200, JSON.stringify(selectedNodeBody));
    assert.equal(selectedNodeBody.ok, true);
    assert.equal(selectedNodeBody.executorNodeId, 'node-b');
    assert.equal(selectedNodeBody.codexRunId, pipelineSkillRunId);
    const selectedNodePipeline = await waitFor(async () => {
      const body = await fetch(
        `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/pipelines/runs/${pipelineRunId}`,
      ).then((response) => response.json()) as Record<string, any>;
      return body.run?.status === 'complete' ? body : null;
    });
    assert.equal(selectedNodePipeline.run.status, 'complete');
    assert.equal(selectedNodePipeline.run.steps[0].skills[0].status, 'complete');
    assert.equal(selectedNodePipeline.run.steps[0].skills[0].executor.nodeId, 'node-b');
    const proxyCountBeforeRemotePipelinePoll = proxiedPaths.length;
    const remoteAlphaPipeline = await waitFor(async () => {
      const response = await fetch(
        `${baseB}/p/${encodeURIComponent(alphaProjectId)}/api/codex/pipelines/runs/${pipelineRunId}`,
        { headers: { 'x-decision-os-replica-node': 'node-a' } },
      );
      if (response.status !== 200) return null;
      const body = await response.json() as Record<string, any>;
      return body.run?.status === 'complete' ? body : null;
    });
    assert.equal(remoteAlphaPipeline.run.steps[0].skills[0].status, 'complete');
    assert.equal(
      proxiedPaths.slice(proxyCountBeforeRemotePipelinePoll).some((path) => path === `/api/codex/pipelines/runs/${pipelineRunId}`),
      false,
      'remote pipeline polling must not open a relay HTTP request',
    );
    assert.ok(existsSync(join(betaRoot, '.decision-os', 'runs', 'codex-skills', 'tasks', `${pipelineSkillRunId}.jsonl`)));
    assert.equal(execFileSync('git', ['-C', betaRoot, 'status', '--porcelain=v1'], { encoding: 'utf8' }).trim(), '');
    const cancellationPipelineRunId = 'federated-cancellation-proof';
    const cancellationSkillRunId = 'federated-cancellation-proof-skill';
    const cancellationExecutionId = 'federated-cancellation-proof-execution';
    const cancellationRun: CodexPipelineRun = {
      ...pipelineRun,
      id: cancellationPipelineRunId,
      createdAt: '2026-07-23T07:10:00.000Z',
      updatedAt: '2026-07-23T07:10:00.000Z',
      steps: pipelineRun.steps.map((step, index) => index > 0 ? step : {
        ...step,
        id: 'federated-cancellation-proof-step-run',
        skills: step.skills.map((skill, skillIndex) => skillIndex > 0 ? skill : {
          ...skill,
          id: 'federated-cancellation-proof-skill-run',
          runId: cancellationSkillRunId,
          executionId: cancellationExecutionId,
        }),
      }),
    };
    const cancellationMetadata = {
      ...executionMetadata,
      executionId: cancellationExecutionId,
      requestId: `pipeline:${cancellationPipelineRunId}:${cancellationExecutionId}`,
      sessionId: cancellationSkillRunId,
      requestedAt: cancellationRun.createdAt,
      pipelineRunId: cancellationPipelineRunId,
      pipelineSkillRunId: cancellationSkillRunId,
    };
    const cancellationStore = readCodexPipelineStore({ decisionOsRoot: alphaDecisionOsRoot }).store;
    writeCodexPipelineStore({
      decisionOsRoot: alphaDecisionOsRoot,
      store: { ...cancellationStore, runs: [...cancellationStore.runs, cancellationRun] },
    });
    const heldRoleRequest = (runtimeA.federationNodeConnector as {
      request(nodeId: string, path: string, options: {
        method: string;
        headers: Record<string, string>;
        body: Buffer;
        timeoutMs: number;
      }): Promise<{ status: number; body: Buffer }>;
    }).request('node-b', '/api/project-sync/role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeoutMs: 10_000,
      body: Buffer.from(JSON.stringify({
        syncId: pipelineRunId,
        initiatorNodeId: 'node-a',
        projectId: betaProjectId,
        role: 'initiator-reconciler',
        originFingerprint: projectSyncSnapshot.originFingerprint,
        snapshot: projectSyncSnapshot,
        pipelineRunId: cancellationPipelineRunId,
        pipelineSkillRunId: cancellationSkillRunId,
        executionId: cancellationExecutionId,
        executionMetadata: cancellationMetadata,
        pipelineRun: cancellationRun,
        masterTask: { projectId: alphaProjectId, ledgerId: 'tasks', cardId: 'alpha-card' },
      })),
    });
    let lastCancellationStatus: Record<string, any> = {};
    try {
      await waitFor(async () => {
        lastCancellationStatus = await fetch(
          `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/pipelines/runs/${cancellationPipelineRunId}/status`,
        ).then((response) => response.json()) as Record<string, any>;
        return lastCancellationStatus.phase === 'running' && lastCancellationStatus.executorNodeId === 'node-b'
          ? lastCancellationStatus
          : null;
      });
    } catch {
      throw new Error(`Remote cancellation execution did not reach running: ${JSON.stringify(lastCancellationStatus)}`);
    }
    const proxyCountBeforeFrontendPolls = proxiedPaths.length;
    const remoteTaskState = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/tasks/alpha-card/execution-state`,
    ).then((response) => response.json()) as Record<string, any>;
    const remotePresentationResponse = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/task-executions/${cancellationExecutionId}`,
    );
    const remotePresentation = await remotePresentationResponse.json() as Record<string, any>;
    const remoteLiveDetail = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/skills/runs/${cancellationSkillRunId}?ledgerId=tasks&cardId=alpha-card`,
    ).then((response) => response.json()) as Record<string, any>;
    const concurrentFrontendPolls = await Promise.all(Array.from({ length: 10 }, async () => {
      const [taskStateResponse, presentationResponse, pipelineResponse] = await Promise.all([
        fetch(`${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/tasks/alpha-card/execution-state`),
        fetch(`${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/task-executions/${cancellationExecutionId}`),
        fetch(`${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/pipelines/runs/${cancellationPipelineRunId}`),
      ]);
      return [taskStateResponse.status, presentationResponse.status, pipelineResponse.status];
    }));
    const frontendPollRelayPaths = proxiedPaths.slice(proxyCountBeforeFrontendPolls);
    const remoteCancellation = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/pipelines/runs/${cancellationPipelineRunId}/cancel`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ executionId: cancellationExecutionId }),
      },
    );
    const remoteCancellationBody = await remoteCancellation.json() as Record<string, any>;
    assert.equal(remoteCancellation.status, 202, JSON.stringify(remoteCancellationBody));
    assert.equal(remoteCancellationBody.cancellationRequested, true);
    assert.equal(remoteCancellationBody.executorNodeId, 'node-b');
    assert.ok(remoteTaskState.activeExecutionIds.includes(cancellationExecutionId), JSON.stringify(remoteTaskState));
    assert.equal(remotePresentationResponse.status, 200, JSON.stringify(remotePresentation));
    assert.equal(remotePresentation.execution.executionId, cancellationExecutionId);
    assert.equal(remoteLiveDetail.ok, true, JSON.stringify(remoteLiveDetail));
    assert.equal(remoteLiveDetail.phase, 'running');
    assert.equal(remoteLiveDetail.executorNodeId, 'node-b');
    assert.deepEqual(
      concurrentFrontendPolls,
      Array.from({ length: 10 }, () => [200, 200, 200]),
      JSON.stringify(concurrentFrontendPolls),
    );
    assert.equal(
      frontendPollRelayPaths.filter((path) => path.includes(`/api/internal/task-executions/${cancellationExecutionId}/presentation`)).length,
      1,
      `the selected log was not hydrated exactly once: ${JSON.stringify(frontendPollRelayPaths)}`,
    );
    assert.equal(
      frontendPollRelayPaths.some((path) => path.includes(`/api/internal/task-executions/${cancellationExecutionId}/status`)),
      false,
      `frontend polling opened execution status relay requests: ${JSON.stringify(frontendPollRelayPaths)}`,
    );
    const heldRoleResult = await heldRoleRequest;
    assert.equal(heldRoleResult.status, 409);
    try {
      await waitFor(async () => {
        lastCancellationStatus = await fetch(
          `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/pipelines/runs/${cancellationPipelineRunId}/status`,
        ).then((response) => response.json()) as Record<string, any>;
        return lastCancellationStatus.phase === 'cancelled' ? lastCancellationStatus : null;
      });
    } catch {
      throw new Error(`Remote cancellation execution did not settle cancelled: ${JSON.stringify(lastCancellationStatus)}`);
    }
    const remoteTerminalDetail = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/skills/runs/${cancellationSkillRunId}?ledgerId=tasks&cardId=alpha-card`,
    ).then((response) => response.json()) as Record<string, any>;
    assert.equal(remoteTerminalDetail.ok, true, JSON.stringify(remoteTerminalDetail));
    assert.equal(remoteTerminalDetail.phase, 'cancelled');
    assert.equal(remoteTerminalDetail.executorNodeId, 'node-b');
    assert.match(String(remoteTerminalDetail.artifacts?.stderr?.hash ?? ''), /^[a-f0-9]{64}$/);
    const unauthenticatedExecution = await fetch(`${baseB}/api/federation/node-message-executions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: betaProjectId, message: 'bypass' }),
    });
    assert.equal(unauthenticatedExecution.status, 403);
    const nodeMessageResponse = await fetch(`${baseA}/api/federation/nodes/node-b/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: betaProjectId, message: 'Inspect the remote federation state.', codexModel: 'gpt-5.4', codexEffort: 'high' }),
    });
    const nodeMessage = await nodeMessageResponse.json() as {
      ok: boolean;
      runId: string;
      answer: string;
      executorNodeId: string;
      projectId: string;
      model: string;
      effort: string;
      artifacts: { manifest: string; stdout: string; stderr: string };
    };
    assert.equal(nodeMessageResponse.status, 200, JSON.stringify(nodeMessage));
    assert.equal(nodeMessage.ok, true);
    assert.equal(nodeMessage.executorNodeId, 'node-b');
    assert.equal(nodeMessage.projectId, betaProjectId);
    assert.equal(nodeMessage.model, 'gpt-5.4');
    assert.equal(nodeMessage.effort, 'high');
    assert.match(nodeMessage.answer, /Inspected beta/);
    const capturedNodeMessage = readFileSync(join(homeB, 'beta', 'node-message-prompt.txt'), 'utf8');
    assert.match(capturedNodeMessage, /Follow every instruction loaded from this target workspace/);
    assert.match(capturedNodeMessage, /Inspect the remote federation state/);
    for (const artifact of Object.values(nodeMessage.artifacts)) assert.ok(existsSync(join(homeB, 'beta', artifact)), artifact);
    const nodeMessageManifest = JSON.parse(readFileSync(join(homeB, 'beta', nodeMessage.artifacts.manifest), 'utf8')) as Record<string, unknown>;
    assert.equal(nodeMessageManifest.status, 'complete');
    assert.equal(nodeMessageManifest.requesterNodeId, 'node-a');
    const requesterBeforeAbort = Number((runtimeA.federationNodeConnector as { status(): Record<string, unknown> }).status().requesterStreamCount ?? 0);
    const ownerBeforeAbort = Number((runtimeB.federationNodeConnector as { status(): Record<string, unknown> }).status().ownerStreamCount ?? 0);
    const disconnect = new AbortController();
    const abandonedMessage = fetch(`${baseA}/api/federation/nodes/node-b/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: betaProjectId, message: 'Wait for requester cancellation.' }),
      signal: disconnect.signal,
    });
    await waitFor(async () => {
      const requester = Number((runtimeA.federationNodeConnector as { status(): Record<string, unknown> }).status().requesterStreamCount ?? 0);
      const owner = Number((runtimeB.federationNodeConnector as { status(): Record<string, unknown> }).status().ownerStreamCount ?? 0);
      return requester > requesterBeforeAbort && owner > ownerBeforeAbort ? true : null;
    });
    disconnect.abort();
    await assert.rejects(abandonedMessage, /abort/i);
    await waitFor(async () => {
      const requester = Number((runtimeA.federationNodeConnector as { status(): Record<string, unknown> }).status().requesterStreamCount ?? 0);
      const owner = Number((runtimeB.federationNodeConnector as { status(): Record<string, unknown> }).status().ownerStreamCount ?? 0);
      return requester === requesterBeforeAbort && owner === ownerBeforeAbort ? true : null;
    });
    let lastControlRoomA: unknown = null;
    const controlRoomA = await waitFor(async () => {
      const body = await fetch(`${baseA}/api/control-room`).then((response) => response.json()) as {
      projects: Array<{ id: string; ownerNodeId: string }>;
      allTasks: Array<{ projectId: string; ownerNodeId: string; title: string; ownerOnline: boolean }>;
      federation: { nodeCount: number; remoteNodeCount: number };
      };
      lastControlRoomA = body;
      return body.allTasks.some((task) => task.title === 'beta card' && task.ownerOnline) ? body : null;
    }).catch((error) => {
      throw new Error([
        error instanceof Error ? error.message : error,
        `Last Control Room projection: ${JSON.stringify(lastControlRoomA)}`,
        `Node A federation: ${JSON.stringify((runtimeA.federationNodeConnector as { status(): unknown }).status())}`,
        `Node B federation: ${JSON.stringify((runtimeB.federationNodeConnector as { status(): unknown }).status())}`,
        `Relay sockets: ${JSON.stringify([...sockets.keys()])}`,
        `Relay state events: ${JSON.stringify(stateEvents)}`,
      ].join('\n'));
    });
    assert.deepEqual(controlRoomA.federation, { nodeCount: 2, remoteNodeCount: 1 });
    assert.ok(controlRoomA.projects.some((project) => project.id === remoteBeta.id && project.ownerNodeId === 'node-b'));
    assert.ok(controlRoomA.allTasks.some((task) => task.title === 'beta card' && task.projectId === remoteBeta.id && task.ownerNodeId === 'node-b'));
    const settingsA = await fetch(`${baseA}/api/settings/federation`).then((response) => response.json()) as Record<string, unknown>;
    assert.equal(settingsA.connected, true);
    assert.equal(settingsA.credentialConfigured, true);
    assert.equal(Object.hasOwn(settingsA, 'nodeCredential'), false);
    const connectionEpoch = settingsA.connectedAt;
    const observedAgain = await fetch(`${baseA}/api/settings/federation`).then((response) => response.json()) as Record<string, unknown>;
    assert.equal(observedAgain.connectedAt, connectionEpoch, 'reading Settings must not recreate the backend connection');
    assert.equal(sockets.size, 2, 'reading Settings must not open another relay socket');

    const events = await fetch(`${baseA}/api/control-room-events`);
    const eventReader = events.body!.getReader();
    await eventReader.read();
    const directMutation = await fetch(`${baseB}/p/${encodeURIComponent(catalogB.projects.find((project) => project.name === 'beta')!.id)}/decision-os/tasks`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'beta-card', title: 'changed on owner' } }),
    });
    assert.equal(directMutation.status, 200);
    const lifecycleMutation = await fetch(`${baseB}/p/${encodeURIComponent(catalogB.projects.find((project) => project.name === 'beta')!.id)}/decision-os/tasks`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'transition-card-lifecycle', cardId: 'beta-card', lifecycleStatus: 'backlog' }),
    });
    assert.equal(lifecycleMutation.status, 200);
    const localBetaId = catalogB.projects.find((project) => project.name === 'beta')!.id;
    const synchronizedBeforeControlRoom = await waitFor(async () => {
      const body = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/tasks`, {
        headers: { 'x-decision-os-replica-node': 'node-b' },
      }).then((response) => response.json()) as { cards?: Array<{ id: string; status: string }> };
      return body.cards?.find((card) => card.id === 'beta-card' && card.status === 'backlog') ?? null;
    });
    assert.equal(synchronizedBeforeControlRoom.id, 'beta-card');
    const locallyAuthoritative = await fetch(`${baseB}/p/${encodeURIComponent(localBetaId)}/decision-os/state?replica=node-a`, {
      headers: { 'x-decision-os-replica-node': 'node-a' },
    });
    assert.equal(locallyAuthoritative.status, 200, 'a foreign selector cannot mask a project hosted by this node');
    assert.equal(((await locallyAuthoritative.json()) as { projectName: string }).projectName, 'beta');
    const remoteEvent = await Promise.race([
      eventReader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for federated Control Room event.')), 2_000)),
    ]);
    assert.match(new TextDecoder().decode(remoteEvent.value), /ledger-content-change/);
    await eventReader.cancel();
    const synchronizedState = await waitFor(async () => {
      const body = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/tasks`, { headers: { 'x-decision-os-replica-node': 'node-b' } }).then((response) => response.json()) as { cards?: Array<{ id: string; status: string }> };
      return body.cards?.find((card) => card.id === 'beta-card' && card.status === 'backlog') ?? null;
    });
    assert.equal(synchronizedState.id, 'beta-card');
    const synchronizedContent = await waitFor(async () => {
      const response = await fetch(
        `${baseA}/p/${encodeURIComponent(remoteBeta.id)}/api/ledgers/tasks/cards/beta-card`,
        { headers: { 'x-decision-os-replica-node': 'node-b' } },
      );
      // WHAT: Continue polling until the replicated card is locally readable.
      // WHY: Structural state may converge before its independently scheduled immutable content object.
      if (response.status !== 200) return null;
      const body = await response.json() as {
        comment?: { what?: string };
        state?: { content?: { status?: string } };
      };
      return body.state?.content?.status === 'available' ? body : null;
    });
    assert.equal(synchronizedContent.comment?.what, 'beta replicated body.');

    const contentManifest = await fetch(`${baseB}/api/federation/content-manifest?projectId=${encodeURIComponent(catalogB.projects.find((project) => project.name === 'beta')!.id)}`);
    assert.equal(contentManifest.status, 200, 'content discovery remains available on its independent asynchronous lane');
    const retiredReplica = await fetch(`${baseB}/api/federation/task-replica?projectId=${encodeURIComponent(catalogB.projects.find((project) => project.name === 'beta')!.id)}`);
    const retiredReplicaBody = await retiredReplica.text();
    assert.equal(retiredReplica.status, 404, `the hydrated task replica endpoint is retired: ${retiredReplicaBody.slice(0, 200)}`);
    const replicationStatus = await fetch(`${baseA}/api/federation/replication-status`).then((response) => response.json()) as {
      stateLane: { projects: Array<{ projectId: string; entityCount: number; currentBytes: number }> };
      contentLane: { queueDepth: number; running: boolean };
    };
    assert.ok(replicationStatus.stateLane.projects.some((project) => project.projectId === remoteBeta.id && project.entityCount > 0 && project.currentBytes >= 0));
    assert.equal(typeof replicationStatus.contentLane.queueDepth, 'number');
    assert.equal(typeof replicationStatus.contentLane.running, 'boolean');

    const registryAPath = join(homeA, '.decision-os', 'projects.json');
    const registryBPath = join(homeB, '.decision-os', 'projects.json');
    const registryA = readFileSync(registryAPath, 'utf8');
    const registryB = readFileSync(registryBPath, 'utf8');

    const remoteHeaders = { 'x-decision-os-replica-node': 'node-b' };
    const headlessCardResponse = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/api/ledgers/tasks/cards/beta-headless-card`, { headers: remoteHeaders });
    const headlessCard = await headlessCardResponse.json() as {
      id?: string;
      comment?: { contentFile?: string; what?: string };
      state?: { status?: string; content?: { status?: string; candidates?: unknown[] } };
    };
    assert.equal(headlessCardResponse.status, 200, 'a converged headless card keeps its structural state readable');
    assert.equal(headlessCard.id, 'beta-headless-card');
    assert.equal(headlessCard.comment?.contentFile, '.decision-os/cards/tasks/beta-headless-card.md');
    assert.equal(headlessCard.comment?.what, undefined);
    assert.equal(headlessCard.state?.status, 'degraded');
    assert.equal(headlessCard.state?.content?.status, 'missing-head');
    assert.deepEqual(headlessCard.state?.content?.candidates, []);
    const remoteLedger = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/tasks`, { headers: remoteHeaders }).then((response) => response.json()) as { cards: Array<{ title: string }> };
    assert.equal(remoteLedger.cards[0].title, 'changed on owner');
    const queryRoutedLedger = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/tasks?replica=node-b`).then((response) => response.json()) as { cards: Array<{ title: string }> };
    assert.equal(queryRoutedLedger.cards[0].title, 'changed on owner');
    const mutation = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...remoteHeaders },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'beta-card', title: 'mutated by node-a' } }),
    });
    assert.equal(mutation.status, 200);
    const mutationBody = await mutation.json() as {
      locallyCommitted: boolean;
      ledger: { cards: Array<{ id: string; title: string }> };
    };
    assert.equal(mutationBody.locallyCommitted, true);
    assert.equal(mutationBody.ledger.cards.find((card) => card.id === 'beta-card')?.title, 'mutated by node-a');
    assert.doesNotMatch(readFileSync(join(homeB, 'beta', '.decision-os', 'tasks.json'), 'utf8'), /mutated by node-a/);
    assert.doesNotMatch(readFileSync(join(homeA, 'alpha', '.decision-os', 'tasks.json'), 'utf8'), /mutated by node-a/);
    assert.equal(readFileSync(registryAPath, 'utf8'), registryA);
    assert.equal(readFileSync(registryBPath, 'utf8'), registryB);
    const convergedRemoteMutation = await waitFor(async () => {
      const body = await fetch(`${baseB}/p/${encodeURIComponent(localBetaId)}/decision-os/tasks`).then((response) => response.json()) as {
        cards?: Array<{ id: string; title: string }>;
      };
      return body.cards?.find((card) => card.id === 'beta-card' && card.title === 'mutated by node-a') ?? null;
    });
    assert.equal(convergedRemoteMutation.id, 'beta-card');

    const localLibraries = await waitFor(async () => {
      const [skills, pipelines] = await Promise.all([
        fetch(`${baseA}/api/codex/server-skills`).then((response) => response.json()) as Promise<{ skills: Array<{ name: string }> }>,
        fetch(`${baseA}/api/codex/server-pipelines`).then((response) => response.json()) as Promise<{ pipelines: Array<{ id: string }> }>,
      ]);
      return skills.skills.some((skill) => skill.name === 'beta-skill') && pipelines.pipelines.some((pipeline) => pipeline.id === 'beta-pipeline')
        ? { skills, pipelines }
        : null;
    });
    assert.ok(existsSync(join(homeA, '.skills', 'beta-skill', 'SKILL.md')));
    assert.ok(existsSync(join(homeB, '.skills', 'alpha-skill', 'SKILL.md')));
    assert.ok(localLibraries.skills.skills.some((skill) => skill.name === 'alpha-skill'));

    // Direct fixture writes deliberately publish no catalog event: the operator action must initiate reconciliation.
    federatedLibraryFixture(homeB, 'manual');
    const manualSynchronization = await fetch(`${baseA}/api/federation/libraries/synchronize`, { method: 'POST' });
    assert.equal(manualSynchronization.status, 200);
    assert.deepEqual(await manualSynchronization.json(), { ok: true, synchronizedPeerCount: 1 });
    const manuallySynchronizedLibraries = await Promise.all([
      fetch(`${baseA}/api/codex/server-skills`).then((response) => response.json()) as Promise<{ skills: Array<{ name: string }> }>,
      fetch(`${baseA}/api/codex/server-pipelines`).then((response) => response.json()) as Promise<{ pipelines: Array<{ id: string }> }>,
    ]);
    assert.ok(manuallySynchronizedLibraries[0].skills.some((skill) => skill.name === 'manual-skill'));
    assert.ok(manuallySynchronizedLibraries[1].pipelines.some((pipeline) => pipeline.id === 'manual-pipeline'));

    await waitFor(async () => {
      const response = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/api/ledgers/tasks/cards/beta-card`, { headers: remoteHeaders });
      if (response.status !== 200) return null;
      const body = await response.json() as { title?: string };
      return body.title === 'mutated by node-a' ? body : null;
    });

    serverB.close();
    await once(serverB, 'close');
    const offlineCard = await waitFor(async () => {
      const response = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/api/ledgers/tasks/cards/beta-card`, { headers: remoteHeaders });
      if (response.status !== 200) return null;
      const body = await response.json() as {
        title?: string;
        comment?: { what?: string };
        state?: { status?: string; content?: { status?: string } };
      };
      return body.title === 'mutated by node-a' && body.state?.status === 'offline' ? body : null;
    });
    assert.equal(offlineCard.title, 'mutated by node-a', 'card detail remains readable from the local replica after owner disconnect');
    assert.equal(offlineCard.comment?.what, 'beta replicated body.');
    assert.equal(offlineCard.state?.content?.status, 'available');
    const offlineMutation = await fetch(`${baseA}/p/${encodeURIComponent(remoteBeta.id)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...remoteHeaders },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'beta-card', title: 'mutated while owner offline' } }),
    });
    assert.equal(offlineMutation.status, 200);
    const offlineMutationBody = await offlineMutation.json() as {
      locallyCommitted: boolean;
      ledger: { cards: Array<{ id: string; title: string }> };
    };
    assert.equal(offlineMutationBody.locallyCommitted, true);
    assert.equal(offlineMutationBody.ledger.cards.find((card) => card.id === 'beta-card')?.title, 'mutated while owner offline');
    const offlineLocalRead = await fetch(
      `${baseA}/p/${encodeURIComponent(remoteBeta.id)}/api/ledgers/tasks/cards/beta-card`,
      { headers: remoteHeaders },
    ).then((response) => response.json()) as { title?: string; state?: { status?: string } };
    assert.equal(offlineLocalRead.title, 'mutated while owner offline');
    assert.equal(offlineLocalRead.state?.status, 'offline');
    const offlineTerminalDetail = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/skills/runs/${cancellationSkillRunId}?ledgerId=tasks&cardId=alpha-card`,
    ).then((response) => response.json()) as Record<string, any>;
    assert.equal(offlineTerminalDetail.ok, true, JSON.stringify(offlineTerminalDetail));
    assert.equal(offlineTerminalDetail.phase, 'cancelled');
    assert.equal(offlineTerminalDetail.executorNodeId, 'node-b');
    assert.match(String(offlineTerminalDetail.artifacts?.stderr?.hash ?? ''), /^[a-f0-9]{64}$/);
    const retainedSkills = await fetch(`${baseA}/p/${encodeURIComponent(catalogA.find((project) => project.name === 'alpha')!.id)}/api/codex/skills`).then((response) => response.json()) as { skills: Array<{ name: string }> };
    const retainedPipelines = await fetch(`${baseA}/p/${encodeURIComponent(catalogA.find((project) => project.name === 'alpha')!.id)}/api/codex/pipelines`).then((response) => response.json()) as { pipelines: Array<{ id: string }> };
    assert.ok(retainedSkills.skills.some((skill) => skill.name === 'beta-skill'), 'Process Card skill catalog remains local after beta disconnects');
    assert.ok(retainedPipelines.pipelines.some((pipeline) => pipeline.id === 'beta-pipeline'), 'Process Card pipeline catalog remains local after beta disconnects');
  } finally {
    const closing: Promise<unknown>[] = [];
    if (serverA.listening) { serverA.close(); closing.push(once(serverA, 'close')); }
    if (serverB.listening) { serverB.close(); closing.push(once(serverB, 'close')); }
    await Promise.all(closing);
    relay.close();
    relayHttp.close();
    await once(relayHttp, 'close');
    rmSync(homeA, { recursive: true, force: true });
    rmSync(homeB, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
  }
});
