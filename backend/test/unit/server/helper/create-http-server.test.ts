/**
 * WHAT: Unit test for implemented function create-http-server.
 * WHY: each generated function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('create-http-server executes implemented behavior and records telemetry', async () => {
  traces.length = 0;
  const runtime_state: Record<string, unknown> = {};
  const result = await createHttpServer({
    action_payload: { ok: true, mode: 'dry-run', name: 'Implemented', color: '#5b7cfa', markdown: '# Title #label', url: '/ledgers/default' },
    runtime_state,
    data_model: { cards: [{ id: 'card-1' }], document: {} }
  });
  assert.ok(traces.length > 0);
  assert.ok(result === undefined || typeof result === 'object');
});

test('create-http-server serves shared TypeScript modules through their browser JavaScript URL', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-shared-module-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  const sharedSchemasRoot = join(projectRoot, 'shared', 'schemas');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  mkdirSync(sharedSchemasRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(sharedSchemasRoot, 'options.ts'), "export const options: readonly string[] = ['shared'];\n");

  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const response = await fetch(`${baseUrl}/shared/schemas/options.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.match(await response.text(), /export const options = \['shared'\]/);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
