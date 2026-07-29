import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
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
