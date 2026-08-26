import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  authorizeLocalDeliveryDispatch,
  createDeliveryHttpRequestScope,
  DeliveryHttpBoundaryError,
  maximumDeliveryRequestBytes,
  readDeliveryRequestJson,
} from '../../src/business/delivery/helper/delivery-http-boundary.js';
import { createHttpServer } from '../../src/business/server/application/create-decision-os-server.js';

function requestFixture(headers: Record<string, string> = {}): IncomingMessage {
  const request = new PassThrough() as PassThrough & Partial<IncomingMessage>;
  request.headers = headers;
  request.complete = false;
  return request as IncomingMessage;
}

function responseFixture(): ServerResponse {
  const response = new EventEmitter() as EventEmitter & Partial<ServerResponse>;
  Object.defineProperty(response, 'writableEnded', { value: false, configurable: true });
  return response as ServerResponse;
}

test('local delivery authority is settings-owned and rejects absent or forged HTTP credentials', () => {
  const token = 'a'.repeat(43);
  assert.throws(
    () => authorizeLocalDeliveryDispatch({ authorization: undefined, settings: { deliveryLocalDispatchToken: token } }),
    (error: unknown) => error instanceof DeliveryHttpBoundaryError
      && error.code === 'delivery_local_dispatch_authority_invalid'
      && error.statusCode === 403,
  );
  assert.throws(
    () => authorizeLocalDeliveryDispatch({ authorization: `Bearer ${'b'.repeat(43)}`, settings: { deliveryLocalDispatchToken: token } }),
    (error: unknown) => error instanceof DeliveryHttpBoundaryError && error.code === 'delivery_local_dispatch_authority_invalid',
  );
  authorizeLocalDeliveryDispatch({
    authorization: `Bearer ${token}`,
    settings: { deliveryLocalDispatchToken: token },
  });
});

test('actual HTTP delivery dispatch rejects authority before waiting for the request body', async (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-http-authority-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'delivery-http-fixture' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({
    deliveryLocalDispatchToken: 'a'.repeat(43),
  }));
  const runtime: Record<string, unknown> = {
    decisionOsSettings: { deliveryLocalDispatchToken: 'a'.repeat(43) },
  };
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: root,
      decisionOsFrontendRoot: resolve(import.meta.dirname, '../../../frontend'),
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  context.after(async () => await new Promise<void>((resolveClose) => server.close(() => resolveClose())));
  const address = server.address() as AddressInfo;
  const response = await new Promise<{ statusCode: number; body: string }>((resolveResponse, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port: address.port,
      method: 'POST',
      path: '/api/federation/nodes/workstation/delivery',
      headers: {
        authorization: `Bearer ${'b'.repeat(43)}`,
        'content-type': 'application/json',
        'content-length': '1024',
      },
    });
    const timeout = setTimeout(() => reject(new Error('HTTP authority waited for request body.')), 1_000);
    request.once('response', (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      incoming.once('end', () => {
        clearTimeout(timeout);
        request.destroy();
        resolveResponse({
          statusCode: incoming.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    request.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    request.write('{');
  });
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).error, 'delivery_local_dispatch_authority_invalid');
});

test('delivery JSON collection rejects oversized bodies and releases every listener', async () => {
  const request = requestFixture();
  const response = responseFixture();
  const scope = createDeliveryHttpRequestScope({ request, response, timeoutMs: 1_000 });
  const reading = readDeliveryRequestJson(request, scope.signal);
  (request as unknown as PassThrough).end(Buffer.alloc(maximumDeliveryRequestBytes + 1, 0x61));
  await assert.rejects(
    reading,
    (error: unknown) => error instanceof DeliveryHttpBoundaryError
      && error.code === 'delivery_request_too_large'
      && error.statusCode === 413,
  );
  scope.dispose();
  assert.equal(request.listenerCount('data'), 0);
  assert.equal(request.listenerCount('end'), 0);
  assert.equal(request.listenerCount('error'), 0);
  assert.equal(request.listenerCount('aborted'), 0);
  assert.equal(request.listenerCount('close'), 0);
  assert.equal(response.listenerCount('close'), 0);
});

test('response close cancels body collection before command execution and settles resources', async () => {
  const request = requestFixture();
  const response = responseFixture();
  const scope = createDeliveryHttpRequestScope({ request, response, timeoutMs: 1_000 });
  const reading = readDeliveryRequestJson(request, scope.signal);
  response.emit('close');
  await assert.rejects(
    reading,
    (error: unknown) => error instanceof DeliveryHttpBoundaryError
      && error.code === 'delivery_request_cancelled'
      && error.statusCode === 499,
  );
  assert.equal(scope.signal.aborted, true);
  scope.dispose();
  assert.equal(request.listenerCount('data'), 0);
  assert.equal(request.listenerCount('end'), 0);
  assert.equal(response.listenerCount('close'), 0);
});

test('delivery request timeout aborts collection and removes deadline listeners', async () => {
  const request = requestFixture();
  const response = responseFixture();
  const scope = createDeliveryHttpRequestScope({ request, response, timeoutMs: 5 });
  await assert.rejects(
    readDeliveryRequestJson(request, scope.signal),
    (error: unknown) => error instanceof DeliveryHttpBoundaryError
      && error.code === 'delivery_request_timeout'
      && error.statusCode === 504,
  );
  scope.dispose();
  assert.equal(request.listenerCount('aborted'), 0);
  assert.equal(request.listenerCount('close'), 0);
  assert.equal(response.listenerCount('close'), 0);
});
