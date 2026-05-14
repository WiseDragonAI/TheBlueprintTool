import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('blueprinttool canvas mutations are applied by the authoritative server ledger endpoint', async () => {
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
    relationships: [],
    notes: { 'thread-card-a': [] }
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

    const createGroupResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create-group',
        annotation: { id: 'group-created', label: 'New group', variant: 'group', x: 60, y: 70, width: 300, height: 190 }
      })
    });
    assert.equal(createGroupResponse.ok, true);
    const groupLedger = await createGroupResponse.json() as { annotations: Array<Record<string, unknown>> };
    assert.equal(groupLedger.annotations.some((entry) => entry.id === 'group-created'), true);

    const geometryResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'patch-geometry',
        geometry: {
          cards: { 'card-a': { x: 111, y: 122, width: 333, height: 99 } },
          zones: { 'zone-keep': { x: 11, y: 22, width: 188, height: 144 } },
          groups: { 'group-keep': { x: 33, y: 44, width: 288, height: 188 } }
        }
      })
    });
    assert.equal(geometryResponse.ok, true);
    const geometryLedger = await geometryResponse.json() as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
    assert.deepEqual(geometryLedger.cards[0], { id: 'card-a', x: 111, y: 122, w: 333 });
    assert.deepEqual(geometryLedger.annotations.find((entry) => entry.id === 'zone-keep'), { id: 'zone-keep', label: 'Keep', variant: 'zone', x: 11, y: 22, width: 188, height: 144 });
    assert.deepEqual(geometryLedger.annotations.find((entry) => entry.id === 'group-keep'), { id: 'group-keep', label: 'Group', variant: 'group', x: 33, y: 44, width: 288, height: 188 });

    const regionResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-region', region: { id: 'zone-keep', kind: 'zone', label: 'Renamed', color: '#ffcc00' } })
    });
    assert.equal(regionResponse.ok, true);
    const regionLedger = await regionResponse.json() as { annotations: Array<Record<string, unknown>> };
    assert.deepEqual(regionLedger.annotations.find((entry) => entry.id === 'zone-keep'), { id: 'zone-keep', label: 'Renamed', variant: 'zone', color: '#ffcc00', x: 11, y: 22, width: 188, height: 144 });

    const appendNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { threadId: 'thread-card-a', body: 'server note' } })
    });
    assert.equal(appendNoteResponse.ok, true);
    const noteLedger = await appendNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(noteLedger.notes['thread-card-a'].length, 1);
    assert.equal(noteLedger.notes['thread-card-a'][0].message, 'server note');

    const deleteNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-note', note: { threadId: 'thread-card-a' } })
    });
    assert.equal(deleteNoteResponse.ok, true);
    const deletedNoteLedger = await deleteNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(deletedNoteLedger.notes['thread-card-a'].length, 0);

    const pasteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'paste-selection', selection: { cardIds: ['card-a'], zoneIds: ['zone-keep'], groupIds: ['group-keep'] } })
    });
    assert.equal(pasteResponse.ok, true);
    const pastedLedger = await pasteResponse.json() as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
    assert.equal(pastedLedger.cards.length, 2);
    assert.equal(pastedLedger.annotations.length, 6);

    const deleteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-zones', zoneIds: ['zone-created', 'group-keep'] })
    });
    assert.equal(deleteResponse.ok, true);
    const deletedLedger = await deleteResponse.json() as { annotations: Array<Record<string, unknown>> };
    assert.equal(deletedLedger.annotations.some((entry) => entry.id === 'zone-created'), false);
    assert.equal(deletedLedger.annotations.some((entry) => entry.id === 'group-keep'), true);

    const persistedLedger = JSON.parse(readFileSync(join(workspace, '.blueprinttool', 'specs.json'), 'utf8')) as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
    assert.equal(persistedLedger.cards.length, 2);
    assert.equal(persistedLedger.annotations.some((entry) => entry.id === 'zone-created'), false);
    assert.equal(persistedLedger.annotations.some((entry) => entry.id === 'group-keep'), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
