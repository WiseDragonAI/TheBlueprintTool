import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { constants, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import test from 'node:test';
import { WebSocket } from 'ws';
import { stateBaselineEpoch, stateProtocol, stateSchema } from '../src/protocol.js';
import { summarizeBucket } from '../src/state-storage.js';

async function freePort(): Promise<number> {
  const server = createNetServer();
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
    repairTelemetry: {
      persistenceCount: 0,
      persistenceBytes: 0,
      persistenceMs: 0,
      ackPersistenceCount: 0,
      ackPersistenceBytes: 0,
      ackPersistenceMs: 0,
      outboundFrameCount: 0,
      outboundEntityCount: 0,
      outboundEncodedBytes: 0,
      packingCandidateCount: 0,
      packingMs: 0,
    },
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

test('Termux relay replays an acknowledged entity journal after a crash before checkpoint', async (context) => {
  const port = await freePort();
  const directory = mkdtempSync(resolve(tmpdir(), 'decision-os-termux-entity-journal-'));
  const stateFile = resolve(directory, 'relay.json');
  const administratorSecret = randomBytes(32).toString('hex');
  const releaseSha = 'f'.repeat(40);
  const start = async (): Promise<ChildProcess> => {
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
        DECISION_OS_RELAY_STATE_CHECKPOINT_DELAY_MS: '60000',
        DECISION_OS_RELAY_STATE_FILE: stateFile,
        HOST: '127.0.0.1',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForRelay(child);
    return child;
  };
  let child = await start();
  context.after(() => {
    // WHAT: Terminate only the relay process still owned by this crash-recovery test.
    // WHY: Test settlement must not signal production or another canary process.
    if (child.exitCode === null) child.kill('SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  });
  const provisioned = await fetch(`http://127.0.0.1:${port}/admin/federations/journal-proof/nodes/writer`, {
    method: 'POST',
    headers: { authorization: `Bearer ${administratorSecret}` },
  });
  assert.equal(provisioned.status, 201);
  const credential = String((await provisioned.json() as { credential: string }).credential);
  const connect = async (): Promise<WebSocket> => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/connect/journal-proof/writer`, { headers: { authorization: `Bearer ${credential}` } });
    await once(socket, 'open');
    return socket;
  };
  const writer = await connect();
  writer.send(JSON.stringify({
    version: 1,
    type: 'manifest',
    nodeLabel: 'Writer',
    projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }],
    stateProtocol,
    stateSchema,
    baselineEpoch: stateBaselineEpoch,
  }));
  await nextMatchingFrame(writer, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
  const { finalizeTaskCurrentEntity, hashTaskCurrentRoot, taskCurrentBucketForEntityKey, taskCurrentEntityKey } = await import('../../shared/task-current-state-core.js');
  const entity = finalizeTaskCurrentEntity({
    version: stateSchema,
    projectId: 'shared',
    entityType: 'card',
    entityId: 'journal-sentinel',
    fields: { title: { clock: { writer: 1 }, candidates: [{ dot: { replicaId: 'writer', counter: 1 }, operation: 'set', value: 'Journal sentinel' }] } },
  });
  const key = taskCurrentEntityKey(entity);
  const acknowledged = nextMatchingFrame(writer, (frame) => frame.type === 'state-relay-ack');
  writer.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, deliveryId: 'journal-delivery', entries: [{ key, stateHash: entity.stateHash, entity }] } }));
  await acknowledged;
  assert.equal(readdirSync(`${stateFile}.entity-journal`).filter((name) => name.endsWith('.json')).length, 1);
  child.kill('SIGKILL');
  await once(child, 'exit');

  child = await start();
  const replacement = await connect();
  const summaryPromise = nextMatchingFrame(replacement, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
  replacement.send(JSON.stringify({
    version: 1,
    type: 'manifest',
    nodeLabel: 'Writer',
    projects: [{ id: 'shared', name: 'Shared', description: '', color: '#38d9e8', ledgers: [] }],
    stateProtocol,
    stateSchema,
    baselineEpoch: stateBaselineEpoch,
  }));
  const summary = await summaryPromise;
  const bucket = taskCurrentBucketForEntityKey(key);
  assert.equal(summary.payload.root, hashTaskCurrentRoot([summarizeBucket(bucket, { [key]: entity.stateHash })]));
  replacement.close();
  await once(replacement, 'close');
  child.kill('SIGTERM');
  await once(child, 'exit');
  assert.equal(readdirSync(`${stateFile}.entity-journal`).filter((name) => name.endsWith('.json')).length, 0);
});

test('Termux relay suppresses duplicate requests per connection and retries after reconnect and restart', async (context) => {
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
  const { finalizeTaskCurrentEntity, hashTaskCurrentRoot, taskCurrentBucketForEntityKey, taskCurrentEntityKey } = await import('../../shared/task-current-state-core.js');
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
  const relaySummary = await subscribed;
  const relayRoot = String(relaySummary.payload.root);
  const receiverRoot = hashTaskCurrentRoot([]);
  const attemptId = `${relayRoot}:${receiverRoot}`;
  const request = { version: 1, type: 'state-missing-request', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, buckets: [bucket], attemptId, relayRoot, receiverRoot } };
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
  const retried = nextMatchingFrame(replacement, (frame) => frame.type === 'state-entity-batch' && frame.projectId === 'shared');
  replacement.send(JSON.stringify(request));
  const retriedBatch = await retried;
  const terminalSummary = nextMatchingFrame(replacement, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared' && frame.payload?.root === relayRoot);
  replacement.send(JSON.stringify({
    version: 1,
    type: 'state-relay-ack',
    stateVersion: stateSchema,
    projectId: 'shared',
    payload: {
      stateVersion: stateSchema,
      attemptId,
      deliveryId: retriedBatch.payload.deliveryId,
      accepted: retriedBatch.payload.entries.map((entry: Record<string, unknown>) => ({ key: entry.key, stateHash: entry.stateHash })),
    },
  }));
  await terminalSummary;
  replacement.send(JSON.stringify({ version: 1, type: 'state-converged', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, attemptId, root: relayRoot } }));
  replacement.close(1000, 'test_complete');
  await once(replacement, 'close');
  child.kill('SIGTERM');
  await once(child, 'exit');

  child = await start();
  const completed = await connect('reader', readerCredential);
  completed.send(JSON.stringify(stateManifest('Reader', [])));
  const completedSummary = nextMatchingFrame(completed, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
  completed.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema } }));
  await completedSummary;
  const afterCompletion = observeMatchingFrames(completed, 250);
  completed.send(JSON.stringify(request));
  assert.equal((await afterCompletion).filter((frame) => frame.type === 'state-entity-batch').length, 0);
  completed.close(1000, 'test_complete');
  await once(completed, 'close');
  child.kill('SIGTERM');
  await once(child, 'exit');
});

test('an unacknowledged real-node transfer retries once on the replacement connection', { timeout: 15_000 }, async (context) => {
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
  assert.equal(missingRequests, 2);
  assert.equal(droppedSentinels, 2);
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
  const relayPublicationStartedAt = Date.now();
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
  const relayPublicationMs = Date.now() - relayPublicationStartedAt;
  const relayReplayStartedAt = Date.now();
  connectorB.start();
  await waitUntil(() => replica.rootHash() === source.rootHash(), 'Canary B did not reach the copied huge-state root.');
  const relayReplayMs = Date.now() - relayReplayStartedAt;
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
    relayPublicationMs,
    relayReplayMs,
    synchronizationMs: relayPublicationMs + relayReplayMs,
    sourceRoot: source.rootHash(),
    replicaRoot: reloaded.rootHash(),
  })}\n`);
  await reloaded.flush();
});

test('copied normal catalog converges with readable card and thread content in three cold and three warm runs', {
  skip: !process.env.DECISION_OS_CANARY_CATALOG_ROOT,
  timeout: 900_000,
}, async (context) => {
  const catalogRoot = resolve(String(process.env.DECISION_OS_CANARY_CATALOG_ROOT));
  const implementationRoot = resolve('..');
  const selectedConnector = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-node-connector.ts')).href) as any;
  const selectedReplicator = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-task-state-replicator.ts')).href) as any;
  const selectedStore = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/task-state/helper/task-current-state-store.ts')).href) as any;
  const selectedContentStore = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-content-replica-store.ts')).href) as any;
  const selectedContentScheduler = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-content-scheduler.ts')).href) as any;
  const sourceManifest = JSON.parse(readFileSync(resolve(catalogRoot, '..', 'source-manifest.json'), 'utf8')) as {
    capture: { projects: Array<{ id: string; class: string; status: { available: boolean; federatedActive: boolean; paused: boolean; localOnly: boolean; incidentBearing: boolean } }> };
  };
  const projects = sourceManifest.capture.projects
    .filter((project) => project.class === 'local'
      && project.id !== '__master_runtime__'
      && project.status.available
      && project.status.federatedActive
      && !project.status.paused
      && !project.status.localOnly
      && !project.status.incidentBearing)
    .map((project) => ({
      id: project.id,
      decisionOsRoot: resolve(catalogRoot, project.id),
      stateRoot: resolve(catalogRoot, project.id, 'task-state', project.id),
    }))
    .filter((project) => existsSync(resolve(project.stateRoot, 'format.json')));
  assert.ok(projects.length >= 2, 'the copied catalog must contain multiple normal local projects');
  const sourceStores = new Map(projects.map((project) => [
    project.id,
    selectedStore.createTaskCurrentStateStore({ decisionOsRoot: project.decisionOsRoot, projectId: project.id }),
  ]));
  const requiredHeads = new Map(projects.map((project) => [
    project.id,
    sourceStores.get(project.id).contentHeads().filter((head: any) => head.type === 'card-markdown' || head.type === 'thread-markdown'),
  ]));
  const sourceContentFile = (projectId: string, hash: string): string => {
    const project = projects.find((candidate) => candidate.id === projectId);
    const head = (requiredHeads.get(projectId) ?? []).find((candidate: any) => candidate.hash === hash);
    const objectFile = project ? resolve(project.stateRoot, 'objects', hash.slice(0, 2), hash) : '';
    // WHAT: Prefer the collected immutable object when the copied state owns it.
    // WHY: The task object store is the stable source independent of mutable project paths.
    if (objectFile && existsSync(objectFile)) return objectFile;
    const referencedFile = project && head
      ? resolve(project.decisionOsRoot, String(head.key).replace(/^\.?decision-os\//, ''))
      : '';
    // WHAT: Admit the captured referenced file only while it matches the advertised immutable hash.
    // WHY: This mirrors the production content endpoint fallback without trusting a mutable path.
    if (referencedFile && existsSync(referencedFile)
      && createHash('sha256').update(readFileSync(referencedFile)).digest('hex') === hash) return referencedFile;
    return '';
  };
  for (const [projectId, heads] of requiredHeads) {
    // WHAT: Reject a capture whose advertised required content object is absent or corrupt.
    // WHY: A source-side hole cannot be misreported as a synchronization regression.
    for (const head of heads as any[]) {
      const file = sourceContentFile(projectId, head.hash);
      assert.ok(file, `missing copied content ${projectId}:${head.key}:${head.hash}`);
      assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), head.hash);
    }
  }

  let contentRequests = 0;
  const contentServer = createHttpServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://canary-source.test');
    // WHAT: Serve only the immutable task-content endpoint used by the real connector.
    // WHY: The canary source must not expose unrelated copied catalog files.
    if (url.pathname !== '/api/federation/content-object') {
      response.writeHead(404).end();
      return;
    }
    const projectId = String(url.searchParams.get('projectId') ?? '');
    const hash = String(url.searchParams.get('hash') ?? '');
    const file = /^[a-f0-9]{64}$/.test(hash) ? sourceContentFile(projectId, hash) : '';
    // WHAT: Refuse a hash not durably held by the selected copied project.
    // WHY: Successful content transfer must originate from the admitted immutable object store.
    if (!file || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    const bytes = readFileSync(file);
    // WHAT: Preserve the captured object when its bytes no longer match the requested identity.
    // WHY: A mutable-path response cannot satisfy immutable content convergence.
    if (createHash('sha256').update(bytes).digest('hex') !== hash) {
      response.writeHead(409).end();
      return;
    }
    contentRequests += 1;
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': String(bytes.byteLength) });
    response.end(bytes);
  });
  contentServer.listen(0, '127.0.0.1');
  await once(contentServer, 'listening');
  const contentPort = (contentServer.address() as { port: number }).port;

  const relayPort = await freePort();
  const proofRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-catalog-canary-'));
  const administratorSecret = randomBytes(32).toString('hex');
  const relay = spawn(process.execPath, ['--import', resolve('..', 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'), resolve('src', 'termux-local-relay.ts')], {
    cwd: resolve('.'),
    env: { ...process.env, ADMIN_SECRET: administratorSecret, DECISION_OS_RELEASE_SHA: 'e'.repeat(40), DECISION_OS_RELAY_STATE_FILE: resolve(proofRoot, 'relay.json'), HOST: '127.0.0.1', PORT: String(relayPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForRelay(relay);
  context.after(async () => {
    await Promise.all([...sourceStores.values()].map((store: any) => store.flush()));
    // WHAT: Terminate only the temporary catalog relay and content source owned by this proof.
    // WHY: Production servers and the immutable capture remain outside canary ownership.
    if (!relay.killed) relay.kill('SIGTERM');
    contentServer.close();
    rmSync(proofRoot, { recursive: true, force: true });
  });
  const relayUrl = `http://127.0.0.1:${relayPort}`;
  const provision = async (federationId: string, nodeId: string): Promise<string> => {
    const response = await fetch(`http://127.0.0.1:${relayPort}/admin/federations/${federationId}/nodes/${nodeId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${administratorSecret}` },
    });
    assert.equal(response.status, 201);
    return String((await response.json() as { credential: string }).credential);
  };
  const waitUntil = async (predicate: () => boolean, message: string | (() => string), timeoutMs: number): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      // WHAT: Fail the catalog lane at its explicit performance deadline.
      // WHY: Eventual convergence without a bound does not prove fast synchronization.
      if (Date.now() >= deadline) throw new Error(typeof message === 'function' ? message() : message);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    }
  };
  const results: Array<Record<string, number | string>> = [];
  const coldTimeoutMs = Number(process.env.DECISION_OS_CANARY_COLD_TIMEOUT_MS ?? 120_000);

  // WHAT: Repeat the same ordinary cold and restart-warm qualification three times.
  // WHY: One favorable run cannot establish the plan's worst-duration threshold.
  for (let repetition = 1; repetition <= 3; repetition += 1) {
    const federationId = `catalog-canary-${repetition}-${randomBytes(4).toString('hex')}`;
    const sourceNodeId = `catalog-source-${repetition}`;
    const destinationNodeId = `catalog-destination-${repetition}`;
    const [sourceCredential, destinationCredential] = await Promise.all([
      provision(federationId, sourceNodeId),
      provision(federationId, destinationNodeId),
    ]);
    let sourceConnector: any;
    let sourceFrames = 0;
    let sourceBytes = 0;
    const sourceReplicator = selectedReplicator.createFederationTaskStateReplicator({
      stores: () => sourceStores,
      publish: (peerId: string, frame: any) => {
        // WHAT: Count only source entity payload admitted to the relay.
        // WHY: Cold-run reporting must distinguish state bytes from comparison traffic.
        if (frame.type === 'state-entity-batch') {
          sourceFrames += 1;
          sourceBytes += Buffer.byteLength(JSON.stringify(frame));
        }
        return sourceConnector.publishStateFrame(peerId, frame);
      },
    });
    sourceConnector = selectedConnector.createFederationNodeConnector({
      settings: { federationRelayUrl: relayUrl, federationId, federationNodeId: sourceNodeId, federationNodeCredential: sourceCredential, federationNodeLabel: 'Catalog source' },
      localProjects: () => projects.map((project) => ({ id: project.id, name: project.id, description: '', color: '#38d9e8', ledgers: [], root: project.decisionOsRoot, decisionOsRoot: project.decisionOsRoot, relativePath: '.', available: true, diagnostic: '', originFingerprint: 'catalog-canary' })),
      localServerUrl: () => `http://127.0.0.1:${contentPort}`,
      onStateConnected: () => sourceReplicator.reconcileRelay(),
      onStateDisconnected: () => sourceReplicator.disconnectPeer('relay'),
      onStateFrame: (frame: any) => sourceReplicator.handleFrame(frame),
    });
    const destinationRoot = resolve(proofRoot, `destination-${repetition}`, '.decision-os');
    const destinationStores = new Map<string, any>();
    for (const project of projects) {
      const stateRoot = resolve(destinationRoot, 'task-state', project.id);
      mkdirSync(resolve(stateRoot, 'journal'), { recursive: true });
      writeFileSync(resolve(stateRoot, 'format.json'), `${JSON.stringify({ stateProtocol, stateSchema, baselineEpoch: stateBaselineEpoch, projectId: project.id, baselineRoot: '' })}\n`);
      destinationStores.set(project.id, selectedStore.createTaskCurrentStateStore({ decisionOsRoot: destinationRoot, projectId: project.id }));
    }
    const contentStore = selectedContentStore.createFederationContentReplicaStore({ decisionOsRoot: destinationRoot });
    let destinationConnector: any;
    let receivedFrames = 0;
    let receivedBytes = 0;
    let acknowledgements = 0;
    let requestedBuckets = 0;
    const contentScheduler = selectedContentScheduler.createFederationContentScheduler({
      store: contentStore,
      hasPriorityStateWork: () => {
        const diagnostics = destinationReplicator.diagnostics();
        return diagnostics.runtimeDirty.length > 0 || diagnostics.pendingDeliveryIds.length > 0;
      },
      fetchContent: async (entry: any) => {
        const result = await destinationConnector.requestToFile(
          sourceNodeId,
          `/api/federation/content-object?projectId=${encodeURIComponent(entry.projectId)}&hash=${encodeURIComponent(entry.hash)}`,
          contentStore.objectFile(entry.hash),
          entry.hash,
        );
        // WHAT: Reject a content request that did not return the immutable object.
        // WHY: Queue settlement requires verified bytes rather than transport completion alone.
        if (result.status !== 200) throw new Error(`content_object_failed:${result.status}`);
      },
    });
    const destinationReplicator = selectedReplicator.createFederationTaskStateReplicator({
      stores: () => new Map<string, any>(),
      storeFor: (projectId: string) => destinationStores.get(projectId) ?? null,
      publish: (peerId: string, frame: any) => {
        // WHAT: Count durable acknowledgements and the exact requested bucket work.
        // WHY: The ordinary canary must expose flood-relevant work instead of inferring quiescence.
        if (frame.type === 'state-ack' || frame.type === 'state-relay-ack') acknowledgements += 1;
        // WHAT: Count the canonical bucket selections sent for relay repair.
        // WHY: Bucket count exposes repeated scans independently from entity frame size.
        if (frame.type === 'state-missing-request') requestedBuckets += Array.isArray(frame.payload?.buckets) ? frame.payload.buckets.length : 0;
        return destinationConnector.publishStateFrame(peerId, frame);
      },
      onProjectionChange: ({ projectId, delta }: any) => {
        const store = destinationStores.get(projectId);
        const heads = delta.entities
          .filter((entity: any) => entity.entityType === 'resource')
          .flatMap((entity: any) => store.contentHeads(entity.entityId))
          .filter((head: any) => head.type === 'card-markdown' || head.type === 'thread-markdown');
        contentStore.applyManifest(sourceNodeId, { version: 1, projectId, generatedAt: new Date().toISOString(), complete: false, resources: heads.map(({ sourceReplicaId: _sourceReplicaId, ...head }: any) => head) });
        for (const head of heads) contentStore.prioritize(sourceNodeId, projectId, head.key);
      },
    });
    destinationConnector = selectedConnector.createFederationNodeConnector({
      settings: { federationRelayUrl: relayUrl, federationId, federationNodeId: destinationNodeId, federationNodeCredential: destinationCredential, federationNodeLabel: 'Catalog destination' },
      localProjects: () => [],
      localServerUrl: () => 'http://127.0.0.1:1',
      onStateConnected: () => {
        for (const project of projects) destinationReplicator.reconcileProject('relay', project.id);
      },
      onStateDisconnected: () => destinationReplicator.disconnectPeer('relay'),
      onStateFrame: async (frame: any) => {
        // WHAT: Measure only relay-to-destination entity payloads.
        // WHY: Comparison summaries cannot satisfy complete catalog transfer.
        if (frame.type === 'state-entity-batch') {
          receivedFrames += 1;
          receivedBytes += Buffer.byteLength(JSON.stringify(frame));
        }
        await destinationReplicator.handleFrame(frame);
        void contentScheduler.drain();
      },
    });

    const coldContentBefore = contentRequests;
    const coldStartedAt = Date.now();
    // WHAT: Enter every copied project baseline into the real relay publication lane before connecting.
    // WHY: Source readiness must wait for durable relay acknowledgements instead of an initially empty runtime queue.
    for (const store of sourceStores.values()) sourceReplicator.publishDelta(store.activeDelta());
    sourceConnector.start();
    await waitUntil(() => sourceReplicator.diagnostics().runtimeDirty.length === 0, `cold ${repetition} source publication exceeded ${coldTimeoutMs} milliseconds`, coldTimeoutMs);
    destinationConnector.start();
    await waitUntil(() => {
      void contentScheduler.drain();
      const rootsEqual = projects.every((project) => destinationStores.get(project.id).rootHash() === sourceStores.get(project.id).rootHash());
      const stateSettled = destinationReplicator.diagnostics().pendingDeliveryIds.length === 0
        && destinationReplicator.diagnostics().runtimeDirty.length === 0;
      return rootsEqual && stateSettled && contentStore.status().queueDepth === 0;
    }, () => `cold ${repetition} destination convergence exceeded 120 seconds: ${JSON.stringify({
      projects: projects.map((project) => ({
        projectId: project.id,
        sourceRoot: sourceStores.get(project.id).rootHash(),
        destinationRoot: destinationStores.get(project.id).rootHash(),
      })),
      state: destinationReplicator.diagnostics(),
      content: contentStore.status(),
      contentRequests: contentRequests - coldContentBefore,
    })}`, coldTimeoutMs);
    const coldMs = Date.now() - coldStartedAt;
    assert.ok(coldMs <= 120_000);
    for (const [projectId, heads] of requiredHeads) {
      for (const head of heads as any[]) {
        const resource = contentStore.resource(sourceNodeId, projectId, head.key);
        assert.equal(resource.state, 'available');
        assert.equal(createHash('sha256').update(readFileSync(resource.file!)).digest('hex'), head.hash);
      }
    }
    destinationConnector.stop();
    await Promise.all([...destinationStores.values()].map((store: any) => store.flush()));
    const reopenedStores = new Map(projects.map((project) => [
      project.id,
      selectedStore.createTaskCurrentStateStore({ decisionOsRoot: destinationRoot, projectId: project.id }),
    ]));
    for (const project of projects) {
      assert.equal(reopenedStores.get(project.id).rootHash(), sourceStores.get(project.id).rootHash());
    }

    let warmConnector: any;
    let warmEntityFrames = 0;
    const warmSummaries = new Set<string>();
    const warmReplicator = selectedReplicator.createFederationTaskStateReplicator({
      stores: () => new Map<string, any>(),
      storeFor: (projectId: string) => reopenedStores.get(projectId) ?? null,
      publish: (peerId: string, frame: any) => warmConnector.publishStateFrame(peerId, frame),
    });
    warmConnector = selectedConnector.createFederationNodeConnector({
      settings: { federationRelayUrl: relayUrl, federationId, federationNodeId: destinationNodeId, federationNodeCredential: destinationCredential, federationNodeLabel: 'Catalog destination' },
      localProjects: () => [],
      localServerUrl: () => 'http://127.0.0.1:1',
      onStateConnected: () => {
        for (const project of projects) warmReplicator.reconcileProject('relay', project.id);
      },
      onStateDisconnected: () => warmReplicator.disconnectPeer('relay'),
      onStateFrame: async (frame: any) => {
        // WHAT: Record each warm comparison and reject hidden entity replay.
        // WHY: A converged restart must exchange summaries without reopening completed transfer work.
        if (frame.type === 'state-bucket-summary') warmSummaries.add(String(frame.projectId ?? ''));
        // WHAT: Count any state payload emitted after the reopened destination already has equal roots.
        // WHY: Warm comparison must not consume a new transfer budget.
        if (frame.type === 'state-entity-batch') warmEntityFrames += 1;
        await warmReplicator.handleFrame(frame);
      },
    });
    const warmContentBefore = contentRequests;
    const warmStartedAt = Date.now();
    warmConnector.start();
    await waitUntil(() => warmSummaries.size === projects.length, `warm ${repetition} comparison exceeded 15 seconds`, 15_000);
    const warmMs = Date.now() - warmStartedAt;
    assert.equal(warmEntityFrames, 0);
    assert.equal(contentRequests, warmContentBefore);
    assert.ok(warmMs <= 15_000);
    warmConnector.stop();
    sourceConnector.stop();
    await Promise.all([...reopenedStores.values()].map((store: any) => store.flush()));
    results.push({
      repetition,
      coldMs,
      warmMs,
      sourceFrames,
      sourceBytes,
      receivedFrames,
      receivedBytes,
      acknowledgements,
      requestedBuckets,
      contentRequests: contentRequests - coldContentBefore,
    });
  }
  const coldDurations = results.map((result) => Number(result.coldMs)).sort((left, right) => left - right);
  const warmDurations = results.map((result) => Number(result.warmMs)).sort((left, right) => left - right);
  process.stdout.write(`${JSON.stringify({
    event: 'federation-complete-catalog-canary',
    projectCount: projects.length,
    requiredContentObjects: [...requiredHeads.values()].reduce((total, heads) => total + heads.length, 0),
    coldMedianMs: coldDurations[1],
    coldWorstMs: coldDurations.at(-1),
    warmMedianMs: warmDurations[1],
    warmWorstMs: warmDurations.at(-1),
    results,
  })}\n`);
});
