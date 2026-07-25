import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { createFederationNodeConnector } from '@backend/business/federation/helper/federation-node-connector.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { readRepositorySyncStatus } from '@backend/business/project-sync/helper/repository-sync-status.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';
import type { CodexPipelineRun } from '../../../shared/schemas/codex-pipeline-types.js';

type Frame = { type: string; requestId?: string; to?: string; projects?: unknown[] };

async function projectHome(name: string): Promise<string> {
  const home = mkdtempSync(join(tmpdir(), `decision-os-federation-${name}-`));
  const decisionOsRoot = join(home, name, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: `${name} Tasks`, ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [{ id: `${name}-card`, title: `${name} card`, labels: ['master-task'], status: 'todo' }], annotations: [], relationships: [] }));
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

test('stops retrying when another server owns the configured node identity', async () => {
  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let connectionCount = 0;
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
        for (const [targetId, target] of sockets) {
          if (targetId !== nodeId) target.send(JSON.stringify({ ...frame, from: 'relay' }));
        }
        return;
      }
      if (frame.type === 'state-bucket-summary' && !frame.to) {
        webSocket.send(JSON.stringify({ ...frame, from: 'relay' }));
        return;
      }
      if (frame.type === 'state-subscribe') return;
      if (frame.type.startsWith('state-') && frame.to) {
        sockets.get(frame.to)?.send(JSON.stringify({ ...frame, from: nodeId }));
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
    webSocket.on('close', () => {
      sockets.delete(nodeId);
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
    const remoteLiveDetail = await fetch(
      `${baseA}/p/${encodeURIComponent(alphaProjectId)}/api/codex/skills/runs/${cancellationSkillRunId}?ledgerId=tasks&cardId=alpha-card`,
    ).then((response) => response.json()) as Record<string, any>;
    assert.equal(remoteLiveDetail.ok, true, JSON.stringify(remoteLiveDetail));
    assert.equal(remoteLiveDetail.phase, 'running');
    assert.equal(remoteLiveDetail.executorNodeId, 'node-b');
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
      throw new Error(`${error instanceof Error ? error.message : error}\nLast Control Room projection: ${JSON.stringify(lastControlRoomA)}`);
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
      const body = await response.json() as { title?: string; state?: { status?: string } };
      return body.title === 'mutated by node-a' && body.state?.status === 'offline' ? body : null;
    });
    assert.equal(offlineCard.title, 'mutated by node-a', 'card detail remains readable from the local replica after owner disconnect');
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
