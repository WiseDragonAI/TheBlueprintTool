/**
 * WHAT: Verifies exact resource heads, runtime demand, and content scheduling.
 * WHY: Content synchronization must avoid full-workspace scans and durable retry queues.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  assert.equal(store.status().queueDepth, 0);
  assert.deepEqual(store.due(), []);
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
  const untouchedBytes = Buffer.from('not requested');
  const untouchedHash = createHash('sha256').update(untouchedBytes).digest('hex');
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: new Date().toISOString(), resources: [
    { type: 'card-markdown', key: '.decision-os/cards/tasks/card-a.md', hash, bytes: bytes.byteLength, changedAt: new Date().toISOString() },
    { type: 'card-markdown', key: '.decision-os/cards/tasks/card-b.md', hash: untouchedHash, bytes: untouchedBytes.byteLength, changedAt: new Date().toISOString() },
  ] });
  assert.equal(store.status().queueDepth, 0);
  store.prioritize('node-a', 'project-a', '.decision-os/cards/tasks/card-a.md');
  let priority = true;
  let requests = 0;
  const scheduler = createFederationContentScheduler({ store, hasPriorityStateWork: () => priority, fetchContent: async (entry) => {
    requests += 1;
    mkdirSync(resolve(store.objectFile(entry.hash), '..'), { recursive: true });
    writeFileSync(store.objectFile(entry.hash), bytes);
  } });
  await scheduler.drain();
  assert.equal(requests, 1);
  assert.equal(store.resource('node-a', 'project-a', '.decision-os/cards/tasks/card-a.md').state, 'available');
  assert.equal(store.resource('node-a', 'project-a', '.decision-os/cards/tasks/card-b.md').state, 'missing');
  priority = false;
  await scheduler.drain();
  assert.equal(requests, 1);
  assert.equal(store.resource('node-a', 'project-a', '.decision-os/cards/tasks/card-a.md').state, 'available');
});

test('content sources include only replicas advertising the exact current head', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-sources-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createFederationContentReplicaStore({ decisionOsRoot: root });
  const key = '.decision-os/cards/tasks/card-a.md';
  const firstHash = createHash('sha256').update('first').digest('hex');
  const secondHash = createHash('sha256').update('second').digest('hex');
  const manifest = (hash: string) => ({ version: 1 as const, projectId: 'project-a', generatedAt: '', resources: [{ type: 'card-markdown' as const, key, hash, bytes: 5, changedAt: '' }] });
  store.applyManifest('node-b', manifest(firstHash));
  store.applyManifest('node-a', manifest(firstHash));
  store.applyManifest('node-c', manifest(secondHash));
  assert.deepEqual(store.sources('project-a', key, firstHash), ['node-a', 'node-b']);
});

test('corrupt content retains stale verified bytes and retries independently', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-stale-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createFederationContentReplicaStore({ decisionOsRoot: root });
  const first = Buffer.from('first');
  const firstHash = createHash('sha256').update(first).digest('hex');
  const key = '.decision-os/cards/tasks/card-a.md';
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: '', resources: [{ type: 'card-markdown', key, hash: firstHash, bytes: first.length, changedAt: '' }] });
  store.prioritize('node-a', 'project-a', key);
  mkdirSync(resolve(store.objectFile(firstHash), '..'), { recursive: true });
  writeFileSync(store.objectFile(firstHash), first);
  store.complete(store.due(1)[0]);
  const second = Buffer.from('second');
  const secondHash = createHash('sha256').update(second).digest('hex');
  store.applyManifest('node-a', { version: 1, projectId: 'project-a', generatedAt: '', resources: [{ type: 'card-markdown', key, hash: secondHash, bytes: second.length, changedAt: '' }] });
  assert.equal(store.resource('node-a', 'project-a', key).file, null);
  store.prioritize('node-a', 'project-a', key);
  const queued = store.due(1)[0];
  store.fail(queued, 'invalid hash');
  const retained = store.resource('node-a', 'project-a', key);
  assert.equal(retained.state, 'stale');
  assert.equal(retained.file, null);
});
