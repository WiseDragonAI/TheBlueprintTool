import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { accessSync, constants, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from 'node:fs';
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

test('Termux relay deletes only one offline harness-owned canary federation', async (context) => {
  const port = await freePort();
  const directory = mkdtempSync(resolve(tmpdir(), 'decision-os-termux-canary-cleanup-'));
  const administratorSecret = randomBytes(32).toString('hex');
  const child = spawn(process.execPath, ['--import', resolve('..', 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'), resolve('src', 'termux-local-relay.ts')], {
    cwd: resolve('.'),
    env: { ...process.env, ADMIN_SECRET: administratorSecret, DECISION_OS_RELEASE_SHA: 'e'.repeat(40), DECISION_OS_RELAY_STATE_FILE: resolve(directory, 'relay.json'), HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => {
    // WHAT: Terminate and remove only resources owned by this cleanup test.
    // WHY: Persistent Decision OS relays and unrelated temp roots remain outside its authority.
    if (!child.killed) child.kill('SIGTERM');
    rmSync(directory, { recursive: true, force: true });
  });
  await waitForRelay(child);
  const base = `http://127.0.0.1:${port}`;
  const federationId = `release_canary_${'a'.repeat(24)}`;
  const controlFederationId = `release_canary_${'b'.repeat(24)}`;
  const provision = async (targetFederationId: string, nodeId: string): Promise<string> => {
    const response = await fetch(`${base}/admin/federations/${targetFederationId}/nodes/${nodeId}`, { method: 'POST', headers: { authorization: `Bearer ${administratorSecret}` } });
    assert.equal(response.status, 201);
    return String((await response.json() as { credential: string }).credential);
  };
  const credential = await provision(federationId, 'canary-a');
  const controlCredential = await provision(controlFederationId, 'control-a');
  const socket = new WebSocket(`ws://127.0.0.1:${port}/connect/${federationId}/canary-a`, { headers: { authorization: `Bearer ${credential}` } });
  await once(socket, 'open');

  const online = await fetch(`${base}/admin/federations/${federationId}/canary-state`, { method: 'DELETE', headers: { authorization: `Bearer ${administratorSecret}` } });
  assert.equal(online.status, 409);
  assert.deepEqual(await online.json(), { ok: false, error: 'federation_nodes_online', nodes: ['canary-a'] });
  const invalid = await fetch(`${base}/admin/federations/production/canary-state`, { method: 'DELETE', headers: { authorization: `Bearer ${administratorSecret}` } });
  assert.equal(invalid.status, 404);

  socket.close(1000, 'canary_cleanup');
  await once(socket, 'close');
  const deleted = await fetch(`${base}/admin/federations/${federationId}/canary-state`, { method: 'DELETE', headers: { authorization: `Bearer ${administratorSecret}` } });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { ok: true, federationId, deleted: true });

  const control = new WebSocket(`ws://127.0.0.1:${port}/connect/${controlFederationId}/control-a`, { headers: { authorization: `Bearer ${controlCredential}` } });
  await once(control, 'open');
  control.close(1000, 'test_complete');
  await once(control, 'close');
});

test('Termux relay serves one bucket once across restart and twenty reconnects', async (context) => {
  const implementationRoot = resolve(String(process.env.DECISION_OS_CANARY_IMPLEMENTATION_ROOT ?? '..'));
  const expectReconnectReplay = process.env.DECISION_OS_CANARY_EXPECT_RECONNECT_REPLAY === '1';
  const port = await freePort();
  const directory = mkdtempSync(resolve(tmpdir(), 'decision-os-termux-flood-proof-'));
  const stateFile = resolve(directory, 'relay.json');
  const administratorSecret = randomBytes(32).toString('hex');
  const releaseSha = 'b'.repeat(40);
  const start = async (): Promise<ChildProcess> => {
    const child = spawn(process.execPath, [
      '--import',
      resolve(implementationRoot, 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'),
      resolve(implementationRoot, 'federation-relay/src/termux-local-relay.ts'),
    ], {
      cwd: resolve(implementationRoot, 'federation-relay'),
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
  // WHAT: Exercise additive terminal-rejection evidence only on the candidate implementation.
  // WHY: The rel-0.3.12 baseline must reach its known reconnect replay instead of waiting for a field it did not emit.
  if (!expectReconnectReplay) {
    const conflicting = finalizeTaskCurrentEntity({
      version: stateSchema,
      projectId: 'shared',
      entityType: 'card',
      entityId: 'sentinel',
      fields: { title: { clock: { writer: 1 }, candidates: [{ dot: { replicaId: 'writer', counter: 1 }, operation: 'set', value: 'Conflicting sentinel' }] } },
    });
    const rejected = nextMatchingFrame(writer, (frame) => frame.type === 'state-relay-ack' && frame.payload?.deliveryId === 'delivery-collision');
    writer.send(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema, deliveryId: 'delivery-collision', entries: [{ key, stateHash: conflicting.stateHash, entity: conflicting }] } }));
    assert.deepEqual((await rejected).payload?.rejected, [{ key, stateHash: conflicting.stateHash, relayStateHash: value.stateHash, collisions: [{ path: 'title', replicaId: 'writer', counter: 1 }], code: 'task_current_dot_collision' }]);
  }

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
  const repairDigest = (): string => {
    const stored = JSON.parse(readFileSync(stateFile, 'utf8')) as { federations?: Record<string, { stateRepairRecords?: Record<string, unknown> }> };
    return createHash('sha256').update(JSON.stringify(stored.federations?.['flood-proof']?.stateRepairRecords ?? {})).digest('hex');
  };
  const repairRecordDigestBeforeReconnect = repairDigest();
  reader.close(1000, 'restart');
  writer.close(1000, 'restart');
  await Promise.all([once(reader, 'close'), once(writer, 'close')]);
  child.kill('SIGTERM');
  await once(child, 'exit');

  child = await start();
  let replacement: WebSocket | null = null;
  let reconnectRepairFrames = 0;
  let reconnectRepairBytes = 0;
  const reconnectCount = expectReconnectReplay ? 2 : 20;
  for (let attempt = 0; attempt < reconnectCount; attempt += 1) {
    replacement = await connect('reader', readerCredential);
    replacement.send(JSON.stringify(stateManifest('Reader', [])));
    const replacementSummary = nextMatchingFrame(replacement, (frame) => frame.type === 'state-bucket-summary' && frame.projectId === 'shared');
    replacement.send(JSON.stringify({ version: 1, type: 'state-subscribe', stateVersion: stateSchema, projectId: 'shared', payload: { stateVersion: stateSchema } }));
    await replacementSummary;
    const repeated = observeMatchingFrames(replacement, 50);
    replacement.send(JSON.stringify(request));
    const repairFrames = (await repeated).filter((frame) => ['state-entity-batch', 'state-bucket-summary'].includes(String(frame.type)));
    reconnectRepairFrames += repairFrames.length;
    reconnectRepairBytes += repairFrames.reduce((bytes, frame) => bytes + Buffer.byteLength(JSON.stringify(frame)), 0);
    replacement.close(1000, attempt === reconnectCount - 1 ? 'test_complete' : 'reconnect');
    await once(replacement, 'close');
  }
  const repairRecordDigestAfterReconnect = repairDigest();
  process.stdout.write(`${JSON.stringify({
    event: 'federation-reconnect-canary',
    implementationRoot,
    reconnectCount,
    reconnectRequestCount: reconnectCount,
    reconnectRepairFrames,
    reconnectRepairBytes,
    repairRecordDigestBeforeReconnect,
    repairRecordDigestAfterReconnect,
    repairRecordStable: repairRecordDigestBeforeReconnect === repairRecordDigestAfterReconnect,
    expectReconnectReplay,
  })}\n`);
  // WHAT: Require the baseline to replay and the candidate to remain flat under the identical reconnect request.
  // WHY: A candidate-only zero count would not prove that the harness reaches the original session-scoped bug.
  if (expectReconnectReplay) {
    assert.ok(reconnectRepairFrames >= 2);
    assert.ok(reconnectRepairBytes > 0);
    assert.equal(repairRecordDigestBeforeReconnect === repairRecordDigestAfterReconnect, false);
  } else {
    assert.equal(reconnectRepairFrames, 0);
    assert.equal(reconnectRepairBytes, 0);
    assert.equal(repairRecordDigestBeforeReconnect, repairRecordDigestAfterReconnect);
  }
  child.kill('SIGTERM');
  await once(child, 'exit');
});

test('a permanently divergent real node becomes quiescent inside one connection', { timeout: 15_000 }, async (context) => {
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
  const { finalizeTaskCurrentEntity, taskCurrentBucketForEntityKey, taskCurrentEntityKey } = await import('../../shared/task-current-state-core.js');
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
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  assert.equal(missingRequests, 1);
  assert.equal(droppedSentinels, 1);
  assert.equal((await observerFrames).filter((frame) => frame.type === 'state-bucket-summary').length, 0);
  assert.equal(replica.entity('card', 'sentinel'), null);
});

test('two real canary nodes synchronize a sanitized copied Decision OS state through the temporary relay', {
  skip: !process.env.DECISION_OS_CANARY_SOURCE_STATE_ROOT && !process.env.DECISION_OS_CANARY_SOURCE_CATALOG_ROOT,
  timeout: 14_400_000,
}, async (context) => {
  const proofStartedAt = Date.now();
  const sourceCatalogRoot = String(process.env.DECISION_OS_CANARY_SOURCE_CATALOG_ROOT ?? '');
  const directSourceStateRoot = String(process.env.DECISION_OS_CANARY_SOURCE_STATE_ROOT ?? '');
  const implementationRoot = resolve(String(process.env.DECISION_OS_CANARY_IMPLEMENTATION_ROOT ?? '..'));
  const selectedConnector = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-node-connector.ts')).href) as any;
  const selectedReplicator = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/federation/helper/federation-task-state-replicator.ts')).href) as any;
  const selectedStore = await import(pathToFileURL(resolve(implementationRoot, 'backend/src/business/task-state/helper/task-current-state-store.ts')).href) as any;
  const { taskCurrentBucketForEntityKey } = await import('../../shared/task-current-state-core.js');
  // WHAT: Classify the full authoritative registry when a catalog lane is supplied, otherwise describe the explicit direct-state fixture.
  // WHY: No-task-state projects must remain visible even though only epoch-4 stores participate in replication.
  const registryProjects = sourceCatalogRoot
    ? Object.values((JSON.parse(readFileSync(resolve(sourceCatalogRoot, '.decision-os', 'projects.json'), 'utf8')) as { projects: Record<string, { id: string; relativePath: string }> }).projects)
      .map((project) => ({
        projectId: project.id,
        relativePath: project.relativePath,
        // WHAT: Mark only a project with a copied format authority as task-state.
        // WHY: File absence is an explicit catalog condition, not permission to omit the registry identity.
        state: existsSync(resolve(sourceCatalogRoot, project.relativePath, '.decision-os', 'task-state', project.id, 'format.json'))
          ? 'task-state' as const
          : 'no-task-state' as const,
      }))
      .sort((left, right) => left.projectId.localeCompare(right.projectId))
    : [{
      projectId: (JSON.parse(readFileSync(resolve(directSourceStateRoot, 'format.json'), 'utf8')) as { projectId: string }).projectId,
      relativePath: '.',
      state: 'task-state' as const,
    }];
  // WHAT: Open every task-state project from the catalog lane, otherwise open the one explicit direct fixture.
  // WHY: Replication cannot construct a TaskCurrentStateStore for a project classified without task-state.
  const sourceStates = sourceCatalogRoot
    ? registryProjects
      .filter((project) => project.state === 'task-state')
      .map((project) => ({ projectId: project.projectId, stateRoot: resolve(sourceCatalogRoot, project.relativePath, '.decision-os', 'task-state', project.projectId) }))
      .sort((left, right) => left.projectId.localeCompare(right.projectId))
    : [{
      projectId: (JSON.parse(readFileSync(resolve(directSourceStateRoot, 'format.json'), 'utf8')) as { projectId: string }).projectId,
      stateRoot: resolve(directSourceStateRoot),
    }];
  assert.ok(sourceStates.length > 0);
  const proofRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-two-node-canary-'));
  const nodeARoot = resolve(proofRoot, 'node-a', '.decision-os');
  const nodeBRoot = resolve(proofRoot, 'node-b', '.decision-os');
  const sources = new Map<string, any>();
  const replicas = new Map<string, any>();
  for (const sourceState of sourceStates) {
    const nodeAState = resolve(nodeARoot, 'task-state', sourceState.projectId);
    const nodeBState = resolve(nodeBRoot, 'task-state', sourceState.projectId);
    mkdirSync(resolve(nodeAState, '..'), { recursive: true });
    mkdirSync(resolve(nodeBState, 'journal'), { recursive: true });
    cpSync(sourceState.stateRoot, nodeAState, { recursive: true, mode: constants.COPYFILE_FICLONE });
    writeFileSync(resolve(nodeBState, 'format.json'), `${JSON.stringify({ stateProtocol, stateSchema, baselineEpoch: stateBaselineEpoch, projectId: sourceState.projectId, baselineRoot: '' })}\n`);
    sources.set(sourceState.projectId, selectedStore.createTaskCurrentStateStore({ decisionOsRoot: nodeARoot, projectId: sourceState.projectId }));
    replicas.set(sourceState.projectId, selectedStore.createTaskCurrentStateStore({ decisionOsRoot: nodeBRoot, projectId: sourceState.projectId }));
  }
  await Promise.all([...sources.values()].map((store) => store.flush()));
  const selectedProject = [...sources].sort((left, right) => right[1].diagnostics().currentBytes - left[1].diagnostics().currentBytes || left[0].localeCompare(right[0]))[0];
  assert.ok(selectedProject);
  const [projectId, source] = selectedProject;
  const replica = replicas.get(projectId)!;
  const originalEntityInventories = new Map([...sources].map(([copiedProjectId, store]) => [copiedProjectId, store.activeDelta().entities
    .map((entity: any) => ({ key: `${entity.entityType}\u0000${entity.entityId}`, stateHash: entity.stateHash }))
    .sort((left: any, right: any) => left.key.localeCompare(right.key))]));
  const copiedProjects = [...sources].map(([copiedProjectId, store]) => {
    const entities = originalEntityInventories.get(copiedProjectId)!;
    return {
      projectId: copiedProjectId,
      originalEntityCount: entities.length,
      originalDurableEntityCount: store.diagnostics().entityCount,
      originalHeldEntityCount: store.diagnostics().entityCount - entities.length,
      originalRoot: store.rootHash(),
      originalEntityInventorySha256: createHash('sha256').update(entities.map((entry: any) => JSON.stringify(entry)).join('\n')).digest('hex'),
    };
  });
  const sourceCountBeforeAugmentation = source.activeDelta().entities.length;
  let syntheticCount = 0;
  const addSyntheticBatch = async (count: number): Promise<void> => {
    await source.mutate({
      replicaId: 'canary-augmentation',
      changes: Array.from({ length: count }, (_value, index) => ({
        entityType: 'card' as const,
        entityId: `canary-augmentation-${String(syntheticCount + index).padStart(6, '0')}`,
        changes: [{ path: 'title', operation: 'set' as const, value: `Canary ${syntheticCount + index}` }],
      })),
    });
    syntheticCount += count;
  };
  while (source.activeDelta().entities.length < 20_000) {
    await addSyntheticBatch(Math.min(256, 20_000 - source.activeDelta().entities.length));
  }
  await source.flush();
  let active = source.activeDelta();
  let encodedBytes = Buffer.byteLength(JSON.stringify(active));
  while (encodedBytes <= 32 * 1024 * 1024) {
    await source.mutate({
      replicaId: 'canary-augmentation',
      changes: Array.from({ length: 8 }, (_value, index) => ({
        entityType: 'card' as const,
        entityId: `canary-large-${String(syntheticCount + index).padStart(6, '0')}`,
        changes: [{ path: 'title', operation: 'set' as const, value: `${syntheticCount + index}:${'x'.repeat(59_000)}` }],
      })),
    });
    syntheticCount += 8;
    active = source.activeDelta();
    encodedBytes = Buffer.byteLength(JSON.stringify(active));
  }
  const occupiedBuckets = new Set(source.bucketManifest().map((entry: { bucket: string }) => entry.bucket));
  for (let bucketValue = 0; bucketValue < 256; bucketValue += 1) {
    const wanted = bucketValue.toString(16).padStart(2, '0');
    // WHAT: Add one deterministic entity only when the copied and size-augmentation state does not occupy this bucket.
    // WHY: The huge-state proof must exercise every epoch-4 repair bucket without discarding any copied entity.
    if (!occupiedBuckets.has(wanted)) {
      let suffix = 0;
      while (true) {
        const entityId = `canary-bucket-${wanted}-${suffix}`;
        // WHAT: Stop the deterministic search at the first entity key owned by the missing bucket.
        // WHY: Bucket coverage must derive from the production hash function instead of a placeholder manifest.
        if (taskCurrentBucketForEntityKey(`card\u0000${entityId}`) === wanted) {
          await source.mutate({
            replicaId: 'canary-augmentation',
            changes: [{ entityType: 'card' as const, entityId, changes: [{ path: 'title', operation: 'set' as const, value: `Bucket ${wanted}` }] }],
          });
          syntheticCount += 1;
          break;
        }
        suffix += 1;
      }
    }
  }
  await source.flush();
  active = source.activeDelta();
  encodedBytes = Buffer.byteLength(JSON.stringify(active));
  for (const [copiedProjectId, inventory] of originalEntityInventories) {
    const store = sources.get(copiedProjectId)!;
    for (const entry of inventory) {
      const [entityType, entityId] = entry.key.split('\u0000');
      assert.equal(store.entity(entityType, entityId)?.stateHash, entry.stateHash);
    }
  }
  const totalEntityCount = [...sources.values()].reduce((count, store) => count + store.activeDelta().entities.length, 0);
  const totalDurableBytes = [...sources.values()].reduce((bytes, store) => bytes + store.diagnostics().currentBytes, 0);
  assert.ok(source.activeDelta().entities.length >= 20_000);
  assert.equal(source.bucketManifest().length, 256);
  assert.ok(encodedBytes > 32 * 1024 * 1024);

  const externalRelayUrl = String(process.env.DECISION_OS_CANARY_RELAY_URL ?? '').replace(/\/$/, '');
  const federationId = String(process.env.DECISION_OS_CANARY_FEDERATION_ID ?? 'two-node-canary');
  const port = externalRelayUrl ? 0 : await freePort();
  // WHAT: Keep the temporary Termux relay away from registered Decision OS service ports.
  // WHY: The canary must not replace an operator-owned server.
  if (!externalRelayUrl) assert.ok(![50_150, 50_151, 50_152].includes(port));
  const administratorSecret = externalRelayUrl
    ? String(process.env.DECISION_OS_CANARY_ADMIN_SECRET ?? '')
    : randomBytes(32).toString('hex');
  // WHAT: Require noninteractive administrator authority for an external isolated relay.
  // WHY: Node provisioning and manifest-owned cleanup cannot fall back to browser authentication.
  if (externalRelayUrl && administratorSecret.length < 32) throw new Error('release_canary_admin_secret_missing');
  let relayStateRoot = proofRoot;
  try {
    const scratchRoot = '/dev/shm';
    accessSync(scratchRoot, constants.W_OK);
    const scratchStat = statSync(scratchRoot);
    const scratchFilesystem = statfsSync(scratchRoot);
    const scratchAvailableBytes = Number(scratchFilesystem.bavail) * Number(scratchFilesystem.bsize);
    // WHAT: Put only the temporary relay JSON on writable memory-backed scratch when it has ample capacity.
    // WHY: The canary must preserve identical JSON persistence semantics without making incidental disk latency part of federation correctness.
    if (!externalRelayUrl && scratchStat.isDirectory() && scratchAvailableBytes > 128 * 1024 * 1024) {
      relayStateRoot = mkdtempSync(resolve(scratchRoot, 'decision-os-canary-relay-state-'));
    }
  } catch {
    relayStateRoot = proofRoot;
  }
  const stateFile = resolve(relayStateRoot, 'relay.json');
  const relay = externalRelayUrl ? null : spawn(process.execPath, ['--import', resolve(implementationRoot, 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'), resolve(implementationRoot, 'federation-relay/src/termux-local-relay.ts')], {
    cwd: resolve(implementationRoot, 'federation-relay'),
    env: { ...process.env, ADMIN_SECRET: administratorSecret, DECISION_OS_RELEASE_SHA: 'c'.repeat(40), DECISION_OS_RELAY_STATE_FILE: stateFile, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // WHAT: Wait for readiness only for the process owned by this test.
  // WHY: The fixed env.dev Worker is deployed and health-checked by the delivery phase before this runtime phase.
  if (relay) await waitForRelay(relay);
  const relayUrl = externalRelayUrl || `http://127.0.0.1:${port}`;
  const provision = async (nodeId: string): Promise<string> => {
    const response = await fetch(`${relayUrl}/admin/federations/${federationId}/nodes/${nodeId}`, { method: 'POST', headers: { authorization: `Bearer ${administratorSecret}` } });
    assert.equal(response.status, 201);
    return String((await response.json() as { credential: string }).credential);
  };
  const [credentialA, credentialB] = await Promise.all([provision('canary-a'), provision('canary-b')]);
  let connectorA: any;
  let connectorB: any;
  const replicatorA = selectedReplicator.createFederationTaskStateReplicator({
    stores: () => sources,
    publish: (peerId: string, frame: any) => connectorA.publishStateFrame(peerId, frame),
  });
  const replicatorB = selectedReplicator.createFederationTaskStateReplicator({
    stores: () => new Map<string, any>(),
    storeFor: (requestedProjectId: string) => replicas.get(requestedProjectId) ?? null,
    publish: (peerId: string, frame: any) => connectorB.publishStateFrame(peerId, frame),
  });
  connectorA = selectedConnector.createFederationNodeConnector({
    settings: { federationRelayUrl: relayUrl, federationId, federationNodeId: 'canary-a', federationNodeCredential: credentialA, federationNodeLabel: 'Canary A' },
    localProjects: () => [...sources.keys()].map((id) => ({ id, name: `Copied ${id}`, description: '', color: '#38d9e8', ledgers: [], root: proofRoot, decisionOsRoot: nodeARoot, relativePath: '.', available: true, diagnostic: '', originFingerprint: `canary-source-${id}` })),
    localServerUrl: () => 'http://127.0.0.1:1',
    onStateConnected: () => replicatorA.reconcileRelay(),
    onStateFrame: (frame: any) => replicatorA.handleFrame(frame),
  });
  connectorB = selectedConnector.createFederationNodeConnector({
    settings: { federationRelayUrl: relayUrl, federationId, federationNodeId: 'canary-b', federationNodeCredential: credentialB, federationNodeLabel: 'Canary B' },
    localProjects: () => [],
    localServerUrl: () => 'http://127.0.0.1:1',
    onStateConnected: () => {
      for (const copiedProjectId of sources.keys()) replicatorB.reconcileProject('relay', copiedProjectId);
    },
    onStateFrame: (frame: any) => replicatorB.handleFrame(frame),
  });
  let externalTeardownProjectCount = 0;
  const teardownExternalFederation = async (): Promise<void> => {
    // WHAT: Skip external teardown when this run owns a local Termux process or teardown already completed.
    // WHY: Only the unique ephemeral canary federation requires remote resource deletion.
    if (!externalRelayUrl || externalTeardownProjectCount === sources.size) return;
    connectorA.stop();
    connectorB.stop();
    const deadline = Date.now() + 10_000;
    while (true) {
      const response = await fetch(`${relayUrl}/admin/federations/${federationId}/canary-state`, { method: 'DELETE', headers: { authorization: `Bearer ${administratorSecret}` } });
      // WHAT: Count every manifest-listed project clean only after whole-federation Durable Object deletion succeeds.
      // WHY: Partial deletion would leave harness node credentials and federation authority behind.
      if (response.status === 200) {
        const deletion = await response.json() as { ok?: boolean; deleted?: boolean; federationId?: string };
        assert.deepEqual(deletion, { ok: true, deleted: true, federationId });
        externalTeardownProjectCount = sources.size;
        break;
      }
      // WHAT: Bound the short disconnect-to-teardown admission wait.
      // WHY: An external Worker that retains online nodes must fail cleanup explicitly.
      if (Date.now() >= deadline) throw new Error(`release_canary_external_teardown_failed:${response.status}`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  };
  context.after(async () => {
    connectorA.stop();
    connectorB.stop();
    await Promise.all([...sources.values(), ...replicas.values()].map((store) => store.flush()));
    // WHAT: Delete only this run's unique ephemeral canary federation after both nodes disconnect.
    // WHY: Teardown removes temporary test resources and is not production state recovery or reconciliation.
    await teardownExternalFederation();
    // WHAT: Terminate and remove only resources rooted in this canary manifest.
    // WHY: The persistent Decision OS servers and source state are outside the proof's ownership.
    if (relay && !relay.killed) relay.kill('SIGTERM');
    // WHAT: Remove the exact extra relay scratch root only when this run created one outside the proof root.
    // WHY: Canary cleanup must not broaden to shared memory or another process's scratch state.
    if (relayStateRoot !== proofRoot) rmSync(relayStateRoot, { recursive: true, force: true });
    rmSync(proofRoot, { recursive: true, force: true });
  });
  for (const [copiedProjectId, store] of sources) replicatorA.publishDelta(copiedProjectId === projectId ? active : store.activeDelta());
  connectorA.start();
  const waitUntil = async (predicate: () => boolean, message: string): Promise<void> => {
    const deadline = Date.now() + 10_800_000;
    while (!predicate()) {
      // WHAT: Fail the canary at its finite deadline instead of waiting indefinitely.
      // WHY: A synchronization proof must own and bound every wait.
      if (Date.now() >= deadline) throw new Error(message);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
  };
  const publicationStartedAt = Date.now();
  await waitUntil(() => replicatorA.diagnostics().runtimeDirty.length === 0, 'Canary A did not finish all relay publication.');
  const publicationDurationMs = Date.now() - publicationStartedAt;
  connectorB.start();
  await waitUntil(() => [...sources].every(([id, store]) => replicas.get(id)?.rootHash() === store.rootHash()), 'Canary B did not reach every copied project root.');
  for (const [copiedProjectId, store] of sources) {
    assert.equal(replicas.get(copiedProjectId)!.diagnostics().entityCount, store.activeDelta().entities.length);
    assert.deepEqual(replicas.get(copiedProjectId)!.bucketManifest(), store.bucketManifest());
  }
  connectorB.stop();
  await Promise.all([...replicas.values()].map((store) => store.flush()));
  const reloadedProjects = [...sources].map(([copiedProjectId, store]) => {
    const reloaded = selectedStore.createTaskCurrentStateStore({ decisionOsRoot: nodeBRoot, projectId: copiedProjectId });
    assert.equal(reloaded.rootHash(), store.rootHash());
    assert.equal(reloaded.diagnostics().entityCount, store.activeDelta().entities.length);
    for (const entry of originalEntityInventories.get(copiedProjectId)!) {
      const [entityType, entityId] = entry.key.split('\u0000');
      assert.equal(reloaded.entity(entityType, entityId)?.stateHash, entry.stateHash);
    }
    return { projectId: copiedProjectId, root: reloaded.rootHash(), entityCount: reloaded.diagnostics().entityCount, store: reloaded };
  });
  await teardownExternalFederation();
  process.stdout.write(`${JSON.stringify({
    event: 'federation-huge-state-canary',
    sourceCountBeforeAugmentation,
    augmentationProjectId: projectId,
    registryProjects,
    syntheticCount,
    entityCount: source.diagnostics().entityCount,
    bucketCount: source.bucketManifest().length,
    encodedBytes,
    totalEntityCount,
    totalDurableBytes,
    sourceRoot: source.rootHash(),
    replicaRoot: reloadedProjects.find((entry) => entry.projectId === projectId)!.root,
    copiedProjects,
    sourceProjects: [...sources].map(([copiedProjectId, store]) => ({ projectId: copiedProjectId, root: store.rootHash(), entityCount: store.activeDelta().entities.length })),
    reloadedProjects: reloadedProjects.map(({ store: _store, ...entry }) => entry),
    relayRuntime: externalRelayUrl ? 'cloudflare-worker-env-dev' : 'termux-node',
    federationId,
    externalTeardownProjectCount,
    externalExpectedTeardownProjectCount: externalRelayUrl ? sources.size : 0,
    externalTeardownConfirmed: externalRelayUrl ? externalTeardownProjectCount === sources.size : null,
    proofDurationMs: Date.now() - proofStartedAt,
    publicationDurationMs,
    relayDurableBytes: relay && existsSync(stateFile) ? statSync(stateFile).size : null,
  })}\n`);
  await Promise.all(reloadedProjects.map((entry) => entry.store.flush()));
});
