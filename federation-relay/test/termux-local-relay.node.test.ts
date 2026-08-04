import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { constants, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import test from 'node:test';
import { WebSocket } from 'ws';
import { stateBaselineEpoch, stateProtocol, stateSchema } from '../src/protocol.js';

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForRelay(child: ChildProcess): Promise<void> {
  let output = '';
  child.stdout?.setEncoding('utf8');
  for await (const chunk of child.stdout ?? []) {
    output += chunk;
    if (output.includes('"runtime":"termux-node"')) return;
  }
  throw new Error(`Termux relay exited before readiness: ${output}`);
}

async function nextFrame(socket: WebSocket): Promise<Record<string, unknown>> {
  const [message] = await once(socket, 'message');
  return JSON.parse(String(message)) as Record<string, unknown>;
}

async function nextMatchingFrame(socket: WebSocket, predicate: (frame: Record<string, any>) => boolean, timeoutMs = 2_000): Promise<Record<string, any>> {
  return await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for matching Termux relay frame.')), timeoutMs);
    const listener = (message: import('ws').RawData) => {
      const frame = JSON.parse(String(message)) as Record<string, any>;
      // WHAT: Ignore unrelated catalog traffic while retaining the exact state-frame wait.
      // WHY: Relay readiness and state repair are independent protocol boundaries.
      if (!predicate(frame)) return;
      clearTimeout(timeout);
      socket.off('message', listener);
      resolvePromise(frame);
    };
    socket.on('message', listener);
  });
}

async function observeMatchingFrames(socket: WebSocket, durationMs: number): Promise<Record<string, any>[]> {
  return await new Promise((resolvePromise) => {
    const frames: Record<string, any>[] = [];
    const listener = (message: import('ws').RawData) => { frames.push(JSON.parse(String(message)) as Record<string, any>); };
    socket.on('message', listener);
    setTimeout(() => {
      socket.off('message', listener);
      resolvePromise(frames);
    }, durationMs);
  });
}

test('Termux relay exposes dev health, provisions one node, and publishes its catalog', async (context) => {
  const port = await freePort();
  const directory = mkdtempSync(resolve(tmpdir(), 'decision-os-termux-relay-'));
  const administratorSecret = randomBytes(32).toString('hex');
  const releaseSha = 'a'.repeat(40);
  const child = spawn(process.execPath, [
    '--import',
    resolve('..', 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'),
    resolve('src', 'termux-local-relay.ts'),
  ], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      ADMIN_SECRET: administratorSecret,
      DECISION_OS_RELEASE_SHA: releaseSha,
      DECISION_OS_RELAY_STATE_FILE: resolve(directory, 'relay.json'),
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => {
    if (!child.killed) child.kill('SIGTERM');
  });
  await waitForRelay(child);

  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json() as Record<string, unknown>;
  assert.match(String(healthBody.observedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual({ ...healthBody, observedAt: '<timestamp>' }, {
    ok: true,
    status: 'ready',
    service: 'decision-os-federation-relay',
    observedAt: '<timestamp>',
    releaseSha,
    deliveryProtocol: 1,
    protocolVersion: 1,
    stateProtocol,
    stateSchema,
    baselineEpoch: stateBaselineEpoch,
    environment: 'dev',
    workerName: 'decision-os-federation-relay-dev',
    durableObjectNamespace: 'decision-os-federations-dev',
    runtime: 'termux-node',
  });

  const unauthorized = await fetch(`http://127.0.0.1:${port}/admin/federations/test/nodes/phone-dev`, { method: 'POST' });
  assert.equal(unauthorized.status, 401);

  const provisioned = await fetch(`http://127.0.0.1:${port}/admin/federations/test/nodes/phone-dev`, {
    method: 'POST',
    headers: { authorization: `Bearer ${administratorSecret}` },
  });
  assert.equal(provisioned.status, 201);
  const provisionedBody = await provisioned.json() as { credential: string };
  assert.match(provisionedBody.credential, /^[A-Za-z0-9_-]{64}$/);

  const socket = new WebSocket(`ws://127.0.0.1:${port}/connect/test/phone-dev`, {
    headers: { authorization: `Bearer ${provisionedBody.credential}` },
  });
  await once(socket, 'open');
  await nextFrame(socket);
  socket.send(JSON.stringify({
    version: 1,
    type: 'manifest',
    nodeLabel: 'Mobile Canary',
    projects: [],
    stateProtocol,
    stateSchema,
    baselineEpoch: stateBaselineEpoch,
  }));
  const catalog = await nextFrame(socket);
  assert.equal(catalog.type, 'catalog');
  assert.deepEqual(catalog.nodes, [{
    nodeId: 'phone-dev',
    nodeLabel: 'Mobile Canary',
    projects: [],
    online: true,
  }]);
  socket.close();
  await once(socket, 'close');
  child.kill('SIGTERM');
  await once(child, 'exit');
});

test('Termux relay persists served-bucket suppression across reconnect and restart', async (context) => {
  const port = await freePort();
  const directory = mkdtempSync(resolve(tmpdir(), 'decision-os-termux-flood-proof-'));
  const stateFile = resolve(directory, 'relay.json');
  const administratorSecret = randomBytes(32).toString('hex');
  const releaseSha = 'b'.repeat(40);
  const start = async (): Promise<ChildProcess> => {
    const child = spawn(process.execPath, [
      '--import',
      resolve('..', 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'),
      resolve('src', 'termux-local-relay.ts'),
    ], {
      cwd: resolve('.'),
      env: { ...process.env, ADMIN_SECRET: administratorSecret, DECISION_OS_RELEASE_SHA: releaseSha, DECISION_OS_RELAY_STATE_FILE: stateFile, HOST: '127.0.0.1', PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForRelay(child);
    return child;
  };
  let child = await start();
  context.after(() => {
    // WHAT: Terminate only the relay child owned by this test.
    // WHY: Canary cleanup must not signal an unrelated server process.
    if (!child.killed) child.kill('SIGTERM');
  });
  const provision = async (nodeId: string): Promise<string> => {
    const response = await fetch(`http://127.0.0.1:${port}/admin/federations/flood-proof/nodes/${nodeId}`, { method: 'POST', headers: { authorization: `Bearer ${administratorSecret}` } });
    assert.equal(response.status, 201);
    return String((await response.json() as { credential: string }).credential);
  };
  const [writerCredential, readerCredential] = await Promise.all([provision('writer'), provision('reader')]);
  const connect = async (nodeId: string, credential: string): Promise<WebSocket> => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/connect/flood-proof/${nodeId}`, { headers: { authorization: `Bearer ${credential}` } });
    await once(socket, 'open');
    return socket;
  };
  const stateManifest = (nodeLabel: string, projects: string[]) => ({
    version: 1,
    type: 'manifest',
    nodeLabel,
    projects: projects.map((id) => ({ id, name: id, description: '', color: '#38d9e8', ledgers: [] })),
    stateProtocol,
    stateSchema,
    baselineEpoch: stateBaselineEpoch,
  });
  const writer = await connect('writer', writerCredential);
  writer.send(JSON.stringify(stateManifest('Writer', ['shared'])));
  const { finalizeTaskCurrentEntity, taskCurrentBucketForEntityKey, taskCurrentEntityKey } = await import('../../shared/task-current-state-core.js');
  const value = finalizeTaskCurrentEntity({
    version: stateSchema,
    projectId: 'shared',
    entityType: 'card',
    entityId: 'sentinel',
    fields: { title: { clock: { writer: 1 }, candidates: [{ dot: { replicaId: 'writer', counter: 1 }, operation: 'set', value: 'Sentinel' }] } },
  });
  const key = taskCurrentEntityKey(value);
  const bucket = taskCurrentBucketForEntityKey(key);
  const acknowledged = nextMatchingFrame(writer, (frame) => frame.type === 'state-relay-ack');
  writer.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, deliveryId: 'delivery-one', entries: [{ key, stateHash: value.stateHash, entity: value }] } }));
  await acknowledged;

  const reader = await connect('reader', readerCredential);
  reader.send(JSON.stringify(stateManifest('Reader', [])));
  const subscribed = nextMatchingFrame(reader, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
  reader.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema } }));
  await subscribed;
  const request = { version: 1, type: 'state-missing-request', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, buckets: [bucket] } };
  const first = observeMatchingFrames(reader, 300);
  reader.send(JSON.stringify(request));
  reader.send(JSON.stringify(request));
  assert.equal((await first).filter((frame) => frame.type === 'state-entity-batch').length, 1);
  reader.close(1000, 'restart');
  writer.close(1000, 'restart');
  await Promise.all([once(reader, 'close'), once(writer, 'close')]);
  child.kill('SIGTERM');
  await once(child, 'exit');

  child = await start();
  const replacement = await connect('reader', readerCredential);
  replacement.send(JSON.stringify(stateManifest('Reader', [])));
  const replacementSummary = nextMatchingFrame(replacement, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
  replacement.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema } }));
  await replacementSummary;
  const repeated = observeMatchingFrames(replacement, 250);
  replacement.send(JSON.stringify(request));
  assert.equal((await repeated).filter((frame) => ['state-entity-batch', 'state-bucket-summary'].includes(String(frame.type))).length, 0);
  replacement.close(1000, 'test_complete');
  await once(replacement, 'close');
  child.kill('SIGTERM');
  await once(child, 'exit');
});

test('a permanently divergent real node becomes quiescent and stays suppressed after reconnect', { timeout: 15_000 }, async (context) => {
  const implementationRoot = resolve(String(process.env.DECISION_OS_CANARY_IMPLEMENTATION_ROOT ?? '..'));
  const expectFlood = process.env.DECISION_OS_CANARY_EXPECT_FLOOD === '1';
  const selectedConnector = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-node-connector.ts')).href) as any;
  const selectedReplicator = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-task-state-replicator.ts')).href) as any;
  const selectedStore = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/task-state/helper/task-current-state-store.ts')).href) as any;
  const port = await freePort();
  const directory = mkdtempSync(resolve(tmpdir(), 'decision-os-termux-divergence-'));
  const administratorSecret = randomBytes(32).toString('hex');
  const relay = spawn(process.execPath, ['--import', resolve('..', 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'), resolve(implementationRoot, 'federation-relay/src/termux-local-relay.ts')], {
    cwd: resolve(implementationRoot, 'federation-relay'),
    env: { ...process.env, ADMIN_SECRET: administratorSecret, DECISION_OS_RELEASE_SHA: 'd'.repeat(40), DECISION_OS_RELAY_STATE_FILE: resolve(directory, 'relay.json'), HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForRelay(relay);
  const provision = async (nodeId: string): Promise<string> => {
    const response = await fetch(`http://127.0.0.1:${port}/admin/federations/permanent-divergence/nodes/${nodeId}`, { method: 'POST', headers: { authorization: `Bearer ${administratorSecret}` } });
    assert.equal(response.status, 201);
    return String((await response.json() as { credential: string }).credential);
  };
  const [writerCredential, readerCredential, observerCredential] = await Promise.all([provision('writer'), provision('reader'), provision('observer')]);
  const open = async (nodeId: string, credential: string): Promise<WebSocket> => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/connect/permanent-divergence/${nodeId}`, { headers: { authorization: `Bearer ${credential}` } });
    await once(socket, 'open');
    return socket;
  };
  const stateManifest = (nodeLabel: string, projects: string[]) => ({ version: 1, type: 'manifest', nodeLabel, projects: projects.map((id) => ({ id, name: id, description: '', color: '#38d9e8', ledgers: [] })), stateProtocol, stateSchema, baselineEpoch: stateBaselineEpoch });
  const writer = await open('writer', writerCredential);
  writer.send(JSON.stringify(stateManifest('Writer', ['shared'])));
  const { finalizeTaskCurrentEntity, taskCurrentEntityKey } = await import('../../shared/task-current-state-core.js');
  const sentinel = finalizeTaskCurrentEntity({ version: stateSchema, projectId: 'shared', entityType: 'card', entityId: 'sentinel', fields: { title: { clock: { writer: 1 }, candidates: [{ dot: { replicaId: 'writer', counter: 1 }, operation: 'set', value: 'Dropped sentinel' }] } } });
  const sentinelKey = taskCurrentEntityKey(sentinel);
  const acknowledged = nextMatchingFrame(writer, (frame) => frame.type === 'state-relay-ack');
  writer.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, deliveryId: 'sentinel-delivery', entries: [{ key: sentinelKey, stateHash: sentinel.stateHash, entity: sentinel }] } }));
  await acknowledged;

  const observer = await open('observer', observerCredential);
  const observerInitial = nextMatchingFrame(observer, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
  observer.send(JSON.stringify(stateManifest('Observer', ['shared'])));
  await observerInitial;
  const replicaRoot = resolve(directory, 'reader-state');
  mkdirSync(resolve(replicaRoot, 'task-state', 'shared', 'journal'), { recursive: true });
  writeFileSync(resolve(replicaRoot, 'task-state', 'shared', 'format.json'), `${JSON.stringify({ stateProtocol, stateSchema, baselineEpoch: stateBaselineEpoch, projectId: 'shared', baselineRoot: '' })}\n`);
  const replica = selectedStore.createTaskCurrentStateStore({ decisionOsRoot: replicaRoot, projectId: 'shared' });
  let connector: any;
  let missingRequests = 0;
  let droppedSentinels = 0;
  const replicator = selectedReplicator.createFederationTaskStateReplicator({
    stores: () => new Map<string, any>(),
    storeFor: () => replica,
    publish: (peerId: string, frame: any) => {
      // WHAT: Count the exact repair request before handing it to the real connector.
      // WHY: Stable emission counts prove quiescence without inferring from elapsed time.
      if (frame.type === 'state-missing-request') missingRequests += 1;
      // WHAT: Stop admitting baseline repair traffic at the fixed canary ceiling.
      // WHY: Reproducing the flood must not allow the intentionally vulnerable implementation to run unbounded.
      if (missingRequests >= 32) {
        setImmediate(() => connector.stop());
        return false;
      }
      return connector.publishStateFrame(peerId, frame);
    },
  });
  connector = selectedConnector.createFederationNodeConnector({
    settings: { federationRelayUrl: `http://127.0.0.1:${port}`, federationId: 'permanent-divergence', federationNodeId: 'reader', federationNodeCredential: readerCredential, federationNodeLabel: 'Reader' },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    onStateConnected: () => replicator.reconcileProject('relay', 'shared'),
    onStateDisconnected: () => replicator.disconnectPeer('relay'),
    onStateFrame: async (frame: any) => {
      const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, any> : {};
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      // WHAT: Drop only the batch containing the fixed sentinel at the canary transport boundary.
      // WHY: Permanent divergence must use valid durable state and otherwise unmodified protocol traffic.
      if (frame.type === 'state-entity-batch' && entries.some((entry) => entry.key === sentinelKey)) {
        droppedSentinels += 1;
        return;
      }
      await replicator.handleFrame(frame);
    },
  });
  context.after(async () => {
    connector.stop();
    writer.close(1000, 'test_complete');
    observer.close(1000, 'test_complete');
    await replica.flush();
    // WHAT: Remove only this test's relay and replica roots.
    // WHY: Canary cleanup must preserve production state and unrelated temporary evidence.
    if (!relay.killed) relay.kill('SIGTERM');
    rmSync(directory, { recursive: true, force: true });
  });
  const observerFrames = observeMatchingFrames(observer, 2_000);
  connector.start();
  const deadline = Date.now() + 5_000;
  while (missingRequests < 1) {
    // WHAT: Bound the wait for the first admitted repair request.
    // WHY: A disconnected canary cannot be reported as flood suppression.
    if (Date.now() >= deadline) throw new Error('Reader never requested the dropped sentinel bucket.');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  process.stdout.write(`${JSON.stringify({ event: 'federation-flood-canary', implementationRoot, expectFlood, missingRequests, droppedSentinels })}\n`);
  // WHAT: Use the identical harness to prove the baseline loop and patched quiescence.
  // WHY: A post-patch-only assertion cannot establish that the test exercises the original failure.
  if (expectFlood) {
    assert.ok(missingRequests > 1);
    assert.ok(droppedSentinels > 1);
    connector.stop();
    await observerFrames;
    return;
  }
  assert.equal(missingRequests, 1);
  assert.equal(droppedSentinels, 1);
  connector.stop();
  connector.start();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  assert.equal(missingRequests, 1);
  assert.equal(droppedSentinels, 1);
  assert.equal((await observerFrames).filter((frame) => frame.type === 'state-bucket-summary').length, 0);
  assert.equal(replica.entity('card', 'sentinel'), null);
});

test('two real canary nodes synchronize a sanitized copied Decision OS state through the temporary relay', {
  skip: !process.env.DECISION_OS_CANARY_SOURCE_STATE_ROOT,
  timeout: 900_000,
}, async (context) => {
  const sourceStateRoot = resolve(String(process.env.DECISION_OS_CANARY_SOURCE_STATE_ROOT));
  const implementationRoot = resolve('..');
  const selectedConnector = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-node-connector.ts')).href) as any;
  const selectedReplicator = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-task-state-replicator.ts')).href) as any;
  const selectedStore = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/task-state/helper/task-current-state-store.ts')).href) as any;
  const sourceFormat = JSON.parse(readFileSync(resolve(sourceStateRoot, 'format.json'), 'utf8')) as { projectId: string };
  const projectId = sourceFormat.projectId;
  const proofRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-two-node-canary-'));
  const nodeARoot = resolve(proofRoot, 'node-a', '.decision-os');
  const nodeBRoot = resolve(proofRoot, 'node-b', '.decision-os');
  const nodeAState = resolve(nodeARoot, 'task-state', projectId);
  const nodeBState = resolve(nodeBRoot, 'task-state', projectId);
  mkdirSync(nodeAState, { recursive: true });
  mkdirSync(resolve(nodeBState, 'journal'), { recursive: true });
  cpSync(resolve(sourceStateRoot, 'format.json'), resolve(nodeAState, 'format.json'), { mode: constants.COPYFILE_FICLONE });
  cpSync(resolve(sourceStateRoot, 'current'), resolve(nodeAState, 'current'), { recursive: true, mode: constants.COPYFILE_FICLONE });
  writeFileSync(resolve(nodeBState, 'format.json'), `${JSON.stringify({
    stateProtocol,
    stateSchema,
    baselineEpoch: stateBaselineEpoch,
    projectId,
    baselineRoot: '',
  })}\n`);
  const source = selectedStore.createTaskCurrentStateStore({ decisionOsRoot: nodeARoot, projectId });
  const replica = selectedStore.createTaskCurrentStateStore({ decisionOsRoot: nodeBRoot, projectId });
  const sourceCountBeforeAugmentation = source.diagnostics().entityCount;
  for (let offset = sourceCountBeforeAugmentation; offset < 20_000; offset += 256) {
    const count = Math.min(256, 20_000 - offset);
    await source.mutate({
      replicaId: 'canary-augmentation',
      changes: Array.from({ length: count }, (_value, index) => ({
        entityType: 'card' as const,
        entityId: `canary-augmentation-${String(offset + index).padStart(5, '0')}`,
        changes: [{ path: 'title', operation: 'set' as const, value: `${offset + index}:${'x'.repeat(1_800)}` }],
      })),
    });
  }
  await source.flush();
  const active = source.activeDelta();
  const encodedBytes = Buffer.byteLength(JSON.stringify(active));
  assert.equal(source.diagnostics().entityCount, 20_000);
  assert.equal(source.bucketManifest().length, 256);
  assert.ok(encodedBytes > 32 * 1024 * 1024);

  const port = await freePort();
  assert.ok(![50_150, 50_151, 50_152].includes(port));
  const administratorSecret = randomBytes(32).toString('hex');
  const stateFile = resolve(proofRoot, 'relay.json');
  const relay = spawn(process.execPath, ['--import', resolve('..', 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'), resolve('src', 'termux-local-relay.ts')], {
    cwd: resolve('.'),
    env: { ...process.env, ADMIN_SECRET: administratorSecret, DECISION_OS_RELEASE_SHA: 'c'.repeat(40), DECISION_OS_RELAY_STATE_FILE: stateFile, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForRelay(relay);
  const provision = async (nodeId: string): Promise<string> => {
    const response = await fetch(`http://127.0.0.1:${port}/admin/federations/two-node-canary/nodes/${nodeId}`, { method: 'POST', headers: { authorization: `Bearer ${administratorSecret}` } });
    assert.equal(response.status, 201);
    return String((await response.json() as { credential: string }).credential);
  };
  const [credentialA, credentialB] = await Promise.all([provision('canary-a'), provision('canary-b')]);
  let connectorA: any;
  let connectorB: any;
  const replicatorA = selectedReplicator.createFederationTaskStateReplicator({
    stores: () => new Map([[projectId, source]]),
    publish: (peerId: string, frame: any) => connectorA.publishStateFrame(peerId, frame),
  });
  const replicatorB = selectedReplicator.createFederationTaskStateReplicator({
    stores: () => new Map<string, any>(),
    storeFor: (requestedProjectId: string) => requestedProjectId === projectId ? replica : null,
    publish: (peerId: string, frame: any) => connectorB.publishStateFrame(peerId, frame),
  });
  const relayUrl = `http://127.0.0.1:${port}`;
  connectorA = selectedConnector.createFederationNodeConnector({
    settings: { federationRelayUrl: relayUrl, federationId: 'two-node-canary', federationNodeId: 'canary-a', federationNodeCredential: credentialA, federationNodeLabel: 'Canary A' },
    localProjects: () => [{ id: projectId, name: 'Copied Decision OS', description: '', color: '#38d9e8', ledgers: [], root: proofRoot, decisionOsRoot: nodeARoot, relativePath: '.', available: true, diagnostic: '', originFingerprint: 'canary-source' }],
    localServerUrl: () => 'http://127.0.0.1:1',
    onStateConnected: () => replicatorA.reconcileRelay(),
    onStateFrame: (frame: any) => replicatorA.handleFrame(frame),
  });
  connectorB = selectedConnector.createFederationNodeConnector({
    settings: { federationRelayUrl: relayUrl, federationId: 'two-node-canary', federationNodeId: 'canary-b', federationNodeCredential: credentialB, federationNodeLabel: 'Canary B' },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    onStateConnected: () => replicatorB.reconcileProject('relay', projectId),
    onStateFrame: (frame: any) => replicatorB.handleFrame(frame),
  });
  context.after(async () => {
    connectorA.stop();
    connectorB.stop();
    await Promise.all([source.flush(), replica.flush()]);
    // WHAT: Terminate and remove only resources rooted in this canary manifest.
    // WHY: The persistent Decision OS servers and source state are outside the proof's ownership.
    if (!relay.killed) relay.kill('SIGTERM');
    rmSync(proofRoot, { recursive: true, force: true });
  });
  replicatorA.publishDelta(active);
  connectorA.start();
  const waitUntil = async (predicate: () => boolean, message: string): Promise<void> => {
    const deadline = Date.now() + 120_000;
    while (!predicate()) {
      // WHAT: Fail the canary at its finite deadline instead of waiting indefinitely.
      // WHY: A synchronization proof must own and bound every wait.
      if (Date.now() >= deadline) throw new Error(message);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
  };
  await waitUntil(() => replicatorA.diagnostics().runtimeDirty.length === 0, 'Canary A did not finish relay publication.');
  connectorB.start();
  await waitUntil(() => replica.rootHash() === source.rootHash(), 'Canary B did not reach the copied huge-state root.');
  assert.equal(replica.diagnostics().entityCount, source.diagnostics().entityCount);
  assert.deepEqual(replica.bucketManifest(), source.bucketManifest());
  connectorB.stop();
  await replica.flush();
  const reloaded = selectedStore.createTaskCurrentStateStore({ decisionOsRoot: nodeBRoot, projectId });
  assert.equal(reloaded.rootHash(), source.rootHash());
  assert.equal(reloaded.diagnostics().entityCount, source.diagnostics().entityCount);
  process.stdout.write(`${JSON.stringify({
    event: 'federation-huge-state-canary',
    sourceCountBeforeAugmentation,
    entityCount: source.diagnostics().entityCount,
    bucketCount: source.bucketManifest().length,
    encodedBytes,
    sourceRoot: source.rootHash(),
    replicaRoot: reloaded.rootHash(),
  })}\n`);
  await reloaded.flush();
});
