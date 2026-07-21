/**
 * WHAT: Verifies sharded crash durability and history-independent storage work.
 * WHY: A card mutation must never rewrite a project projection or retain permanent mutation files.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

test('one card mutation leaves one shard and removes its short-lived journal after materialization', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-store-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'todo' }] }] });
  await store.flush();
  const stateRoot = resolve(root, 'task-state', 'project-a');
  assert.equal(readdirSync(resolve(stateRoot, 'current', 'card')).length, 1);
  assert.equal(readdirSync(resolve(stateRoot, 'journal')).length, 0);
  assert.equal(existsSync(resolve(stateRoot, 'projection.json')), false);
  assert.equal(existsSync(resolve(stateRoot, 'events')), false);
  assert.equal(existsSync(resolve(stateRoot, 'snapshots')), false);
});

test('restart reconstructs projection, clock, and buckets from current shards only', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-restart-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await first.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'status', operation: 'set', value: 'todo' }] }] });
  await first.flush();
  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal((restarted.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(restarted.clock().desktop, 1);
  assert.deepEqual(restarted.bucketManifest(), first.bucketManifest());
});

test('missing format marker requires the offline migration entrypoint', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-format-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  assert.throws(() => createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' }), /offline_migration_required/);
});

test('concurrent thread notes converge as independent entities', async (context) => {
  const desktopRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-note-desktop-'));
  const mobileRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-note-mobile-'));
  context.after(() => { rmSync(desktopRoot, { recursive: true, force: true }); rmSync(mobileRoot, { recursive: true, force: true }); });
  const initial = { notes: {}, threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' } };
  const desktop = createTaskCurrentStateStore({ decisionOsRoot: desktopRoot, projectId: 'project-a', initializeLedger: initial });
  const mobile = createTaskCurrentStateStore({ decisionOsRoot: mobileRoot, projectId: 'project-a', initializeLedger: initial });
  const left = await desktop.mutate({ replicaId: 'desktop', changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-left', changes: [{ path: 'threadId', operation: 'set', value: 'thread-card-a' }, { path: 'message', operation: 'set', value: 'Desktop' }] }] });
  const right = await mobile.mutate({ replicaId: 'mobile', changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-right', changes: [{ path: 'threadId', operation: 'set', value: 'thread-card-a' }, { path: 'message', operation: 'set', value: 'Mobile' }] }] });
  await desktop.merge(right.delta);
  await mobile.merge(left.delta);
  const desktopNotes = (desktop.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'];
  const mobileNotes = (mobile.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'];
  assert.deepEqual(desktopNotes, mobileNotes);
  assert.deepEqual(desktopNotes.map((note) => note.message), ['Desktop', 'Mobile']);
  await Promise.all([desktop.flush(), mobile.flush()]);
});

test('thread-note tombstones retain the deleted-note projection', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-note-delete-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    initializeLedger: { notes: { 'thread-card-a': [{ id: 'note-a', message: 'Remove me.' }] } },
  });
  await store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-a', changes: [{ path: '$entity', operation: 'tombstone' }] }],
  });
  assert.deepEqual((store.projection().ledger.notes as Record<string, unknown[]>)['thread-card-a'], []);
  assert.deepEqual((store.projection().ledger.deletedNoteIds as Record<string, string[]>)['thread-card-a'], ['note-a']);
  await store.flush();
});
