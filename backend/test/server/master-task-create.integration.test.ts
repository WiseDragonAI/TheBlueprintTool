import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('master-task creation persists the complete graph and returns absolute Markdown paths', async (context) => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-create-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], threadFiles: {} }));
  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  context.after(async () => {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const catalog = await fetch(`${baseUrl}/api/control-room?localOnly=1`).then((response) => response.json()) as { projects: Array<{ id: string }> };
  const projectId = catalog.projects[0].id;
  const master = { id: 'card-master', title: 'Context metrics', cardType: 'note', domainId: 'tasks', status: 'todo', labels: ['master-task'], x: 60, y: 60, w: 360, h: 240, comment: { what: 'Ledger: Tasks\nWaiting since: now\n', contentFile: '.decision-os/cards/tasks/card-master.md' }, facts: [], fields: [] };
  const subtask = { id: 'card-subtask', title: 'Collect metrics', cardType: 'note', domainId: 'tasks', status: 'todo', labels: ['subtask'], x: 450, y: 60, w: 310, h: 180, comment: { what: '', contentFile: '.decision-os/cards/tasks/card-subtask.md' }, facts: [], fields: [] };
  const rejectedResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      action: 'create-master-task',
      annotation: { id: 'zone-rejected', x: 0, y: 0, width: 1200, height: 900, color: '#123456', label: 'Rejected', comments: [] },
      card: { ...master, id: 'card-rejected', comment: { what: '', contentFile: '.decision-os/cards/tasks/card-rejected.md' } },
      cards: [],
      relationships: [],
    }),
  });
  assert.equal(rejectedResponse.status, 400);
  assert.deepEqual(await rejectedResponse.json(), { ok: false, error: 'assigned_node_id_required' });
  assert.equal(existsSync(join(decisionOsRoot, 'cards', 'tasks', 'card-rejected.md')), false);

  const response = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      action: 'create-master-task',
      assignedNodeId: 'workstation',
      annotation: { id: 'zone-master', x: 0, y: 0, width: 1200, height: 900, color: '#123456', label: 'Context metrics', comments: [] },
      card: master,
      cards: [subtask],
      relationships: [{ id: 'rel-subtask', from: 'card-master', to: 'card-subtask', label: 'subtask', position: 0 }],
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { createdFiles: Array<{ kind: string; cardId: string; path: string }> };
  assert.deepEqual(body.createdFiles.map((entry) => [entry.kind, entry.cardId]), [['master-task', 'card-master'], ['subtask', 'card-subtask']]);
  assert.ok(body.createdFiles.every((entry) => entry.path.startsWith(workspace)));
  assert.ok(body.createdFiles.every((entry) => existsSync(entry.path)));
  assert.match(readFileSync(body.createdFiles[0].path, 'utf8'), /Ledger: Tasks/);
  const creationProjection = await fetch(`${baseUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`).then((result) => result.json()) as { ledger: { cards: Array<{ id: string; assignment?: { nodeId: string; changedAt: string; revision: number } }> } };
  assert.equal(creationProjection.ledger.cards.find((card) => card.id === 'card-master')?.assignment?.nodeId, 'workstation');
  assert.equal(creationProjection.ledger.cards.find((card) => card.id === 'card-master')?.assignment?.revision, 1);
  assert.equal(creationProjection.ledger.cards.find((card) => card.id === 'card-subtask')?.assignment, undefined);
  for (const note of [
    { id: 'note-first', threadId: 'thread-card-master', body: 'First operator note.' },
    { id: 'note-second', threadId: 'thread-card-master', body: 'Second operator note.' },
  ]) {
    const noteResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note }),
    });
    assert.equal(noteResponse.status, 200, await noteResponse.clone().text());
  }
  const noteProjection = await fetch(`${baseUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`).then((result) => result.json()) as {
    ledger: {
      notes: Record<string, Array<{ id: string }>>;
      deletedNoteIds: Record<string, string[]>;
    };
  };
  assert.deepEqual(noteProjection.ledger.notes['thread-card-master'].map((note) => note.id), ['note-first', 'note-second']);
  assert.deepEqual(noteProjection.ledger.deletedNoteIds['thread-card-master'], []);
  const threadMarkdown = readFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-card-master.md'), 'utf8');
  assert.match(threadMarkdown, /First operator note\./);
  assert.match(threadMarkdown, /Second operator note\./);
  const deleteNoteResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'delete-note', note: { id: 'note-first', threadId: 'thread-card-master' } }),
  });
  assert.equal(deleteNoteResponse.status, 200);
  const restoreNoteResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'restore-note', note: { id: 'note-first', threadId: 'thread-card-master', body: 'First operator note.' } }),
  });
  assert.equal(restoreNoteResponse.status, 200, await restoreNoteResponse.clone().text());
  const restoredProjection = await fetch(`${baseUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`).then((result) => result.json()) as {
    ledger: {
      notes: Record<string, Array<{ id: string }>>;
      deletedNoteIds: Record<string, string[]>;
    };
  };
  assert.deepEqual(restoredProjection.ledger.deletedNoteIds['thread-card-master'], []);
  assert.deepEqual(restoredProjection.ledger.notes['thread-card-master'].map((note) => note.id).sort(), ['note-first', 'note-second']);
  assert.match(readFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-card-master.md'), 'utf8'), /First operator note\./);
  const originalImage = await sharp({
    create: {
      width: 1200,
      height: 600,
      channels: 4,
      background: { r: 18, g: 52, b: 86, alpha: 1 },
    },
  }).png().toBuffer();
  const imageUploadResponse = await fetch(`${baseUrl}/p/${projectId}/api/thread-image-upload`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-ledger-id': 'tasks',
      'x-thread-id': 'thread-card-master',
    },
    body: originalImage,
  });
  assert.equal(imageUploadResponse.status, 201, await imageUploadResponse.clone().text());
  const imageUpload = await imageUploadResponse.json() as {
    imageFileRef: string;
    previewFileRef: string;
    previewProfile: string;
  };
  assert.equal(imageUpload.previewProfile, 'canvas-preview-v1');
  assert.match(imageUpload.previewFileRef, /\.canvas-preview-v1\.webp$/);
  const originalFile = join(workspace, imageUpload.imageFileRef.slice(1));
  const previewFile = join(workspace, imageUpload.previewFileRef.slice(1));
  assert.deepEqual(readFileSync(originalFile), originalImage);
  const previewMetadata = await sharp(previewFile).metadata();
  assert.equal(previewMetadata.width, 768);
  assert.equal(previewMetadata.height, 384);
  const repeatedImageUpload = await fetch(`${baseUrl}/p/${projectId}/api/thread-image-upload`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-ledger-id': 'tasks',
      'x-thread-id': 'thread-card-master',
    },
    body: originalImage,
  }).then((result) => result.json()) as { previewFileRef: string };
  assert.deepEqual(
    readFileSync(join(workspace, repeatedImageUpload.previewFileRef.slice(1))),
    readFileSync(previewFile),
  );
  const imageDirectory = join(decisionOsRoot, 'thread-images', 'thread-card-master');
  const installedImageFiles = readdirSync(imageDirectory).sort();
  const missingOwnerDirectory = join(decisionOsRoot, 'thread-images', 'thread-missing-card');
  const missingOwnerUpload = await fetch(`${baseUrl}/p/${projectId}/api/thread-image-upload`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-ledger-id': 'tasks',
      'x-thread-id': 'thread-missing-card',
    },
    body: originalImage,
  });
  assert.equal(missingOwnerUpload.status, 404);
  assert.equal(existsSync(missingOwnerDirectory), false);
  const invalidImageUpload = await fetch(`${baseUrl}/p/${projectId}/api/thread-image-upload`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-ledger-id': 'tasks',
      'x-thread-id': 'thread-card-master',
    },
    body: Buffer.from('not an image'),
  });
  assert.equal(invalidImageUpload.status, 422);
  assert.deepEqual(readdirSync(imageDirectory).sort(), installedImageFiles);
  const contentManifest = await fetch(
    `${baseUrl}/api/federation/content-manifest?projectId=${encodeURIComponent(projectId)}`,
  ).then((result) => result.json()) as { resources: Array<{ key: string; hash: string }> };
  assert.ok(contentManifest.resources.some((resource) => resource.key === imageUpload.imageFileRef.replace(/^\//, '')));
  assert.ok(contentManifest.resources.some((resource) => resource.key === imageUpload.previewFileRef.replace(/^\//, '')));
  const inheritedReassignment = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      action: 'reassign-task', cardId: 'card-subtask', assignedNodeId: 'phone',
    }),
  });
  assert.equal(inheritedReassignment.status, 409);
  assert.deepEqual(await inheritedReassignment.json(), { ok: false, error: 'task_assignment_inherited' });
  const reassignment = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      action: 'reassign-task', cardId: 'card-master', assignedNodeId: 'phone',
    }),
  });
  assert.equal(reassignment.status, 200);
  const lifecycleResponse = await fetch(`${baseUrl}/api/task-state/transition-card-lifecycle`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, cardId: 'card-master', lifecycleStatus: 'done' }),
  });
  assert.equal(lifecycleResponse.status, 200);
  assert.deepEqual(await lifecycleResponse.json(), { ok: true, cardId: 'card-master', lifecycleStatus: 'done', changedBatchCount: 1 });
  const aggregateResponse = await fetch(`${baseUrl}/api/task-state/commit`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, ledger: { cards: [] } }),
  });
  assert.equal(aggregateResponse.status, 410);
  assert.deepEqual(await aggregateResponse.json(), { ok: false, error: 'aggregate_task_state_commit_removed' });
  const projection = await fetch(`${baseUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`).then((result) => result.json()) as { ledger: { cards: Array<{ id: string; status: string; assignment?: { nodeId: string; changedAt: string; revision: number } }>; relationships: Array<{ id: string }>; annotations: Array<{ id: string }> } };
  assert.deepEqual(projection.ledger.cards.map((card) => card.id).sort(), ['card-master', 'card-subtask']);
  assert.equal(projection.ledger.cards.find((card) => card.id === 'card-master')?.status, 'done');
  assert.deepEqual(projection.ledger.cards.find((card) => card.id === 'card-master')?.assignment, {
    nodeId: 'phone',
    changedAt: projection.ledger.cards.find((card) => card.id === 'card-master')?.assignment?.changedAt,
    revision: 2,
  });
  assert.equal(projection.ledger.cards.find((card) => card.id === 'card-subtask')?.assignment, undefined);
  assert.deepEqual(projection.ledger.relationships.map((relationship) => relationship.id), ['rel-subtask']);
  assert.deepEqual(projection.ledger.annotations.map((annotation) => annotation.id), ['zone-master']);
});
