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
  mkdirSync(join(workspace, '.blueprinttool', 'ui-mockups'));
  writeFileSync(join(workspace, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }]
  }));
  writeFileSync(join(workspace, '.blueprinttool', 'ui-mockups', 'mock.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
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
  const assetEndpoint = `http://127.0.0.1:${address.port}/.blueprinttool/ui-mockups/mock.png`;

  try {
    const assetResponse = await fetch(assetEndpoint);
    assert.equal(assetResponse.ok, true);
    assert.equal(assetResponse.headers.get('content-type'), 'image/png');
    assert.equal((await assetResponse.arrayBuffer()).byteLength, 4);

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

    const createRelationshipResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create-relationship',
        relationship: { id: 'rel-created', from: 'card-a', to: 'zone-keep', label: 'targets' }
      })
    });
    assert.equal(createRelationshipResponse.ok, true);
    const relationshipLedger = await createRelationshipResponse.json() as { relationships: Array<Record<string, unknown>> };
    assert.deepEqual(relationshipLedger.relationships.find((entry) => entry.id === 'rel-created'), { id: 'rel-created', from: 'card-a', to: 'zone-keep', label: 'targets' });

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
    assert.deepEqual(geometryLedger.cards[0], { id: 'card-a', x: 111, y: 122, w: 333, h: 99 });
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

    const imageSizeResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'card-a', imageSizes: { '/.blueprinttool/ui-mockups/mock.png': { width: 320, height: 180 } } } })
    });
    assert.equal(imageSizeResponse.ok, true);
    const imageSizeLedger = await imageSizeResponse.json() as { cards: Array<Record<string, unknown>> };
    assert.deepEqual(imageSizeLedger.cards.find((entry) => entry.id === 'card-a')?.imageSizes, { '/.blueprinttool/ui-mockups/mock.png': { width: 320, height: 180 } });

    const cardStatusResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'card-a', status: 'done' } })
    });
    assert.equal(cardStatusResponse.ok, true);
    const cardStatusLedger = await cardStatusResponse.json() as { cards: Array<Record<string, unknown>> };
    assert.equal(cardStatusLedger.cards.find((entry) => entry.id === 'card-a')?.status, 'done');

    const appendNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { threadId: 'thread-card-a', body: 'server note' } })
    });
    assert.equal(appendNoteResponse.ok, true);
    const noteLedger = await appendNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(noteLedger.notes['thread-card-a'].length, 1);
    assert.equal(noteLedger.notes['thread-card-a'][0].message, 'server note');

    const appendVoiceNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { threadId: 'thread-card-a', body: 'voice note', source: 'voice', voiceFileRef: '/tmp/voice.webm', status: 'pending' } })
    });
    assert.equal(appendVoiceNoteResponse.ok, true);
    const voiceNoteLedger = await appendVoiceNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(voiceNoteLedger.notes['thread-card-a'].at(-1)?.role, 'operator');
    assert.equal(voiceNoteLedger.notes['thread-card-a'].at(-1)?.voiceFileRef, '/tmp/voice.webm');
    assert.equal(voiceNoteLedger.notes['thread-card-a'].at(-1)?.status, 'pending');
    assert.match(readFileSync(join(workspace, '.blueprinttool', 'threads', 'specs', 'thread-card-a.md'), 'utf8'), /^# OPERATOR/m);
    const voiceNoteId = String(voiceNoteLedger.notes['thread-card-a'].at(-1)?.id ?? '');

    const updateVoiceNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update-note', note: { id: voiceNoteId, threadId: 'thread-card-a', body: 'transcribed text', source: 'voice', voiceFileRef: '/tmp/voice.webm', status: 'transcribed' } })
    });
    assert.equal(updateVoiceNoteResponse.ok, true);
    const updatedVoiceNoteLedger = await updateVoiceNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(updatedVoiceNoteLedger.notes['thread-card-a'].at(-1)?.message, 'transcribed text');
    assert.equal(updatedVoiceNoteLedger.notes['thread-card-a'].at(-1)?.status, 'transcribed');

    const deleteNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-note', note: { threadId: 'thread-card-a', id: voiceNoteId } })
    });
    assert.equal(deleteNoteResponse.ok, true);
    const deletedNoteLedger = await deleteNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>>; deletedNoteIds: Record<string, string[]> };
    assert.equal(deletedNoteLedger.notes['thread-card-a'].length, 1);
    assert.deepEqual(deletedNoteLedger.deletedNoteIds['thread-card-a'], [voiceNoteId]);

    const appendDeletedNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { id: voiceNoteId, threadId: 'thread-card-a', body: 'late deleted voice note', source: 'voice', voiceFileRef: '/tmp/voice.webm', status: 'uploading' } })
    });
    assert.equal(appendDeletedNoteResponse.ok, true);
    const appendDeletedLedger = await appendDeletedNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(appendDeletedLedger.notes['thread-card-a'].some((note) => note.id === voiceNoteId), false);

    const upsertVoiceNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update-note', note: { id: 'note-client-voice', threadId: 'thread-card-a', body: 'late voice update', source: 'voice', voiceFileRef: '/tmp/late.webm', status: 'transcribing' } })
    });
    assert.equal(upsertVoiceNoteResponse.ok, true);
    const upsertVoiceLedger = await upsertVoiceNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(upsertVoiceLedger.notes['thread-card-a'].at(-1)?.id, 'note-client-voice');
    assert.equal(upsertVoiceLedger.notes['thread-card-a'].at(-1)?.message, 'late voice update');

    const appendSameVoiceNoteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { id: 'note-client-voice', threadId: 'thread-card-a', body: 'late voice append', source: 'voice', voiceFileRef: '/tmp/late.webm', status: 'uploading' } })
    });
    assert.equal(appendSameVoiceNoteResponse.ok, true);
    const appendSameVoiceLedger = await appendSameVoiceNoteResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(appendSameVoiceLedger.notes['thread-card-a'].filter((note) => note.id === 'note-client-voice').length, 1);
    assert.equal(appendSameVoiceLedger.notes['thread-card-a'].at(-1)?.status, 'transcribing');

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

    const deleteGroupResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-zones', zoneIds: [], groupIds: ['group-keep'] })
    });
    assert.equal(deleteGroupResponse.ok, true);
    const deletedGroupLedger = await deleteGroupResponse.json() as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
    assert.equal(deletedGroupLedger.annotations.some((entry) => entry.id === 'group-keep'), false);
    assert.equal(deletedGroupLedger.cards.length, 2);

    const persistedLedger = JSON.parse(readFileSync(join(workspace, '.blueprinttool', 'specs.json'), 'utf8')) as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
    assert.equal(persistedLedger.cards.length, 2);
    assert.equal(persistedLedger.annotations.some((entry) => entry.id === 'zone-created'), false);
    assert.equal(persistedLedger.annotations.some((entry) => entry.id === 'group-keep'), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('blueprinttool note mutations normalize legacy notes arrays and persist from nested cwd', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-notes-'));
  const nested = join(workspace, 'Project', 'Subdir');
  mkdirSync(join(workspace, '.blueprinttool'), { recursive: true });
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(workspace, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'game-design', title: 'Game Design', ledgerFile: '.blueprinttool/game-design.json' }]
  }));
  writeFileSync(join(workspace, '.blueprinttool', 'game-design.json'), JSON.stringify({
    cards: [],
    annotations: [],
    relationships: [],
    notes: []
  }));

  process.chdir(nested);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${address.port}/blueprinttool/game-design`;

  try {
    const appendResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { id: 'note-client-1', threadId: 'thread-card-a', body: 'voice uploaded', source: 'voice', voiceFileRef: '/tmp/voice.webm', status: 'uploading' } })
    });
    assert.equal(appendResponse.ok, true);
    const appendLedger = await appendResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(Array.isArray(appendLedger.notes), false);
    assert.equal(appendLedger.notes['thread-card-a'][0].id, 'note-client-1');

    const updateResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update-note', note: { id: 'note-client-1', threadId: 'thread-card-a', body: 'transcription failed', source: 'voice', voiceFileRef: '/tmp/voice.webm', status: 'transcription failed', error: 'provider failed' } })
    });
    assert.equal(updateResponse.ok, true);
    const persisted = JSON.parse(readFileSync(join(workspace, '.blueprinttool', 'game-design.json'), 'utf8')) as { notes: Record<string, Array<Record<string, unknown>>>; threadFiles: Record<string, string> };
    assert.equal(Array.isArray(persisted.notes), false);
    assert.equal(persisted.notes['thread-card-a'], undefined);
    assert.equal(persisted.threadFiles['thread-card-a'], '.blueprinttool/threads/game-design/thread-card-a.md');
    const threadMarkdown = readFileSync(join(workspace, '.blueprinttool', 'threads', 'game-design', 'thread-card-a.md'), 'utf8');
    assert.match(threadMarkdown, /^# OPERATOR/m);
    assert.match(threadMarkdown, /transcription failed/);
    assert.equal(threadMarkdown.includes('"voiceFileRef":"/tmp/voice.webm"'), true);

    const reloadResponse = await fetch(endpoint);
    const reloaded = await reloadResponse.json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.equal(reloaded.notes['thread-card-a'][0].message, 'transcription failed');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
