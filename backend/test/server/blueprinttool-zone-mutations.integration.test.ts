import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('blueprinttool zone create and delete mutations are applied by the server ledger endpoint', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-ledger-'));
  mkdirSync(join(workspace, '.blueprinttool'));
  writeFileSync(join(workspace, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }]
  }));
  writeFileSync(join(workspace, '.blueprinttool', 'specs.json'), JSON.stringify({
    cards: [{ id: 'card-a', x: 10, y: 20, w: 240 }],
    annotations: [
      { id: 'zone-keep', label: 'Keep', variant: 'zone', x: 1, y: 2, width: 180, height: 140 },
      { id: 'group-keep', label: 'Group', variant: 'group', x: 3, y: 4, width: 280, height: 180 }
    ],
    relationships: []
  }));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${address.port}/blueprinttool/specs`;

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create-zone',
        annotation: { id: 'zone-created', label: 'New zone', variant: 'zone', x: 40, y: 50, width: 260, height: 170 }
      })
    });
    assert.equal(createResponse.ok, true);
    const createdLedger = await createResponse.json() as { annotations: Array<Record<string, unknown>> };
    assert.equal(createdLedger.annotations.some((entry) => entry.id === 'zone-created'), true);

    const deleteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-zones', zoneIds: ['zone-created', 'group-keep'] })
    });
    assert.equal(deleteResponse.ok, true);
    const deletedLedger = await deleteResponse.json() as { annotations: Array<Record<string, unknown>> };
    assert.deepEqual(deletedLedger.annotations.map((entry) => entry.id), ['zone-keep', 'group-keep']);

    const persistedLedger = JSON.parse(readFileSync(join(workspace, '.blueprinttool', 'specs.json'), 'utf8')) as { annotations: Array<Record<string, unknown>> };
    assert.deepEqual(persistedLedger.annotations.map((entry) => entry.id), ['zone-keep', 'group-keep']);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
