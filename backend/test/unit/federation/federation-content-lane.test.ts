import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildFederationContentManifest } from '../../../src/business/federation/helper/federation-content-manifest.js';
import { createFederationContentReplicaStore } from '../../../src/business/federation/helper/federation-content-replica-store.js';
import { createFederationContentScheduler } from '../../../src/business/federation/helper/federation-content-scheduler.js';

test('content manifest includes card, thread, and referenced managed assets without task state', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-manifest-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'thread-images', 'thread-a'), { recursive: true });
  writeFileSync(resolve(root, 'thread-images', 'thread-a', 'image.png'), Buffer.from('image'));
  writeFileSync(resolve(root, 'cards', 'tasks', 'card-a.md'), 'Body\n\n![image](.decision-os/thread-images/thread-a/image.png)\n');
  writeFileSync(resolve(root, 'threads', 'tasks', 'thread-a.md'), 'Thread');
  const manifest = buildFederationContentManifest({
    projectId: 'project-a', decisionOsRoot: root,
    ledger: { cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }], threadFiles: { 'thread-a': '.decision-os/threads/tasks/thread-a.md' } },
  });
  assert.deepEqual(manifest.resources.map((entry) => entry.type).sort(), ['card-markdown', 'managed-asset', 'thread-markdown']);
  assert.equal(JSON.stringify(manifest).includes('status'), false);
});

test('content manifest covers normal file links and voice metadata across ledgers', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-coverage-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'files'), { recursive: true });
  mkdirSync(resolve(root, 'voice-uploads'), { recursive: true });
  writeFileSync(resolve(root, 'files', 'manual.pdf'), Buffer.from('pdf'));
  const voiceFile = resolve(root, 'voice-uploads', 'note.wav');
  writeFileSync(voiceFile, Buffer.from('voice'));
  writeFileSync(resolve(root, 'threads', 'tasks', 'thread-a.md'), [
    '# OPERATOR',
    `<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-20T00:00:00.000Z","voiceFileRef":"${voiceFile}"} -->`,
    '',
    '[manual](.decision-os/files/manual.pdf)',
    '',
  ].join('\n'));
  const manifest = buildFederationContentManifest({
    projectId: 'project-a', decisionOsRoot: root,
    ledgers: [{ cards: [], threadFiles: {} }, { cards: [], threadFiles: { 'thread-a': '.decision-os/threads/tasks/thread-a.md' } }],
  });
  assert.deepEqual(manifest.resources.map((entry) => entry.key), [
    '.decision-os/files/manual.pdf',
    '.decision-os/threads/tasks/thread-a.md',
    '.decision-os/voice-uploads/note.wav',
  ]);
});

test('resource-scoped manifests preserve unrelated cache entries and prioritize exact repair', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-partial-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createFederationContentReplicaStore({ decisionOsRoot: root });
  const resource = (key: string, value: string) => ({
    type: 'managed-asset' as const, key, hash: createHash('sha256').update(value).digest('hex'), bytes: value.length, changedAt: '',
  });
  const first = resource('.decision-os/files/a.bin', 'a');
  const second = resource('.decision-os/files/b.bin', 'b');
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: '', complete: true, resources: [first, second] });
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: '', complete: false, resources: [first] });
  assert.equal(store.status().resources.length, 2);
  assert.equal(store.prioritize('node-a', 'project-a', second.key), true);
  assert.equal(store.due(1)[0].key, second.key);
});

test('content scheduler guarantees a bounded content share during priority state work', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-store-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createFederationContentReplicaStore({ decisionOsRoot: root });
  const bytes = Buffer.from('verified markdown');
  const hash = createHash('sha256').update(bytes).digest('hex');
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: new Date().toISOString(), resources: [{ type: 'card-markdown', key: '.decision-os/cards/tasks/card-a.md', hash, bytes: bytes.byteLength, changedAt: new Date().toISOString() }] });
  let priority = true;
  let requests = 0;
  const scheduler = createFederationContentScheduler({ store, hasPriorityStateWork: () => priority, fetchContent: async () => { requests += 1; return bytes; } });
  await scheduler.drain();
  assert.equal(requests, 1);
  assert.equal(store.resource('node-a', 'project-a', '.decision-os/cards/tasks/card-a.md').state, 'available');
  priority = false;
  await scheduler.drain();
  assert.equal(requests, 1);
  assert.equal(store.resource('node-a', 'project-a', '.decision-os/cards/tasks/card-a.md').state, 'available');
});

test('corrupt content retains stale verified bytes and retries independently', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-stale-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createFederationContentReplicaStore({ decisionOsRoot: root });
  const first = Buffer.from('first');
  const firstHash = createHash('sha256').update(first).digest('hex');
  const key = '.decision-os/cards/tasks/card-a.md';
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: '', resources: [{ type: 'card-markdown', key, hash: firstHash, bytes: first.length, changedAt: '' }] });
  store.install(store.due(1)[0], first);
  const second = Buffer.from('second');
  const secondHash = createHash('sha256').update(second).digest('hex');
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: '', resources: [{ type: 'card-markdown', key, hash: secondHash, bytes: second.length, changedAt: '' }] });
  const queued = store.due(1)[0];
  assert.throws(() => store.install(queued, Buffer.from('corrupt')), /hash/);
  store.fail(queued, 'invalid hash');
  const retained = store.resource('node-a', 'project-a', key);
  assert.equal(retained.state, 'stale');
  assert.deepEqual(retained.bytes, first);
});
