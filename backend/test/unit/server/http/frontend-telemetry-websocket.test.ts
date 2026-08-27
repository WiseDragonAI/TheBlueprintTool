import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { installFrontendTelemetryWebSocket } from '../../../../src/business/server/http/frontend-telemetry-websocket.js';
import { handleDiagnosticReadRoutes } from '../../../../src/business/server/http/diagnostic-routes.js';

async function waitFor(check: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // WHAT: Finish as soon as the asynchronous durable observation becomes readable.
    // WHY: The test must synchronize on evidence instead of sleeping for a fixed workstation-dependent duration.
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for frontend telemetry evidence.');
}

test('accepts same-origin browser telemetry and persists a bounded diagnostic record', async (context) => {
  const decisionOsRoot = await mkdtemp(join(tmpdir(), 'decision-os-frontend-telemetry-'));
  const server = createServer((_request, response) => response.end('ok'));
  const failures: unknown[] = [];
  const transport = installFrontendTelemetryWebSocket({
    decisionOsRoot,
    enabled: true,
    server,
    recordFailure: (_operation, error) => failures.push(error),
  });
  context.after(async () => {
    transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(decisionOsRoot, { recursive: true, force: true });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/diagnostics/frontend-telemetry`, { origin });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify([{
    name: 'codex-log-refresh-failed',
    at: '2026-07-31T15:00:00.000Z',
    browserSessionId: 'browser-session-1',
    route: '/p/project/ledgers/tasks/cards/card-1',
    args: { operation: 'scope-task-execution-state', error: 'sessions is not iterable' },
  }]));
  await waitFor(async () => (await readFile(transport.file, 'utf8').catch(() => '')).includes('codex-log-refresh-failed'));
  const record = JSON.parse((await readFile(transport.file, 'utf8')).trim()) as Record<string, unknown>;
  assert.equal(record.source, 'frontend');
  assert.equal(record.browserSessionId, 'browser-session-1');
  assert.equal(record.route, '/p/project/ledgers/tasks/cards/card-1');
  assert.deepEqual(record.args, { operation: 'scope-task-execution-state', error: 'sessions is not iterable' });
  assert.deepEqual(failures, []);
  socket.close();
});

test('rejects cross-origin browser telemetry handshakes', async (context) => {
  const decisionOsRoot = await mkdtemp(join(tmpdir(), 'decision-os-frontend-telemetry-origin-'));
  const server = createServer();
  const transport = installFrontendTelemetryWebSocket({ decisionOsRoot, enabled: true, server, recordFailure: () => undefined });
  context.after(async () => {
    transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(decisionOsRoot, { recursive: true, force: true });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/diagnostics/frontend-telemetry`, { origin: 'https://untrusted.example' });
  const outcome = await new Promise<string>((resolve) => {
    socket.once('open', () => resolve('opened'));
    socket.once('error', () => resolve('rejected'));
  });
  assert.equal(outcome, 'rejected');
});

test('contains an oversized browser message to its telemetry client socket', async (context) => {
  const decisionOsRoot = await mkdtemp(join(tmpdir(), 'decision-os-frontend-telemetry-oversized-'));
  const server = createServer();
  const failures: Array<{ operation: string; error: unknown }> = [];
  const transport = installFrontendTelemetryWebSocket({
    decisionOsRoot,
    enabled: true,
    server,
    recordFailure: (operation, error) => failures.push({ operation, error }),
  });
  context.after(async () => {
    transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(decisionOsRoot, { recursive: true, force: true });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/diagnostics/frontend-telemetry`, { origin });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send('x'.repeat(65 * 1024));
  const closeCode = await new Promise<number>((resolve) => socket.once('close', resolve));
  const secondSocket = new WebSocket(`ws://127.0.0.1:${address.port}/api/diagnostics/frontend-telemetry`, { origin });
  await new Promise<void>((resolve, reject) => {
    secondSocket.once('open', resolve);
    secondSocket.once('error', reject);
  });
  secondSocket.send(JSON.stringify([{
    name: 'telemetry-after-oversized-message',
    at: '2026-08-27T15:30:00.000Z',
    browserSessionId: 'browser-session-after-oversized-message',
    route: '/',
  }]));
  await waitFor(async () => (await readFile(transport.file, 'utf8').catch(() => ''))
    .includes('telemetry-after-oversized-message'));

  assert.equal(closeCode, 1009);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.operation, 'frontend-telemetry-client');
  assert.equal(server.listening, true);
  secondSocket.close();
});

test('exposes only the telemetry opt-in through the global diagnostic configuration route', () => {
  const headers = new Map<string, string>();
  let body = '';
  const outcome = handleDiagnosticReadRoutes({
    incidentLedger: {} as never,
    incidentSupervisor: {} as never,
    request: { method: 'GET' } as never,
    requestPath: '/api/diagnostics/frontend-telemetry-config',
    response: {
      setHeader: (name: string, value: string) => headers.set(name, value),
      end: (value: string) => { body = value; },
    } as never,
    settings: { frontendTelemetryWebSocketEnabled: true, openaiApiKey: 'must-not-leak' },
  });
  assert.equal(outcome.handled, true);
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.deepEqual(JSON.parse(body), {
    ok: true,
    enabled: true,
    endpoint: '/api/diagnostics/frontend-telemetry',
  });
  assert.equal(body.includes('must-not-leak'), false);
});
