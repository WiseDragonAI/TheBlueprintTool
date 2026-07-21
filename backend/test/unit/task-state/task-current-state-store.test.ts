/**
 * WHAT: Verifies sharded crash durability and history-independent storage work.
 * WHY: A card mutation must never rewrite a project projection or retain permanent mutation files.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

const todoLifecycle = { status: 'todo', changedAt: '2026-07-21T00:00:00.000Z', waitingAt: '2026-07-21T00:00:00.000Z', closedAt: null };

test('one card mutation leaves one shard and removes its short-lived journal after materialization', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-store-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: todoLifecycle }] }] });
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
  await first.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: todoLifecycle }] }] });
  await first.flush();
  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal((restarted.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(restarted.clock().desktop, 1);
  assert.deepEqual(restarted.bucketManifest(), first.bucketManifest());
});

test('materialized collections use identity indexes and generation-cached sorted arrays', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-index-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', changes: [
    { entityType: 'card', entityId: 'card-b', changes: [{ path: 'title', operation: 'set', value: 'B' }] },
    { entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'A' }] },
  ] });
  const firstCards = store.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.deepEqual(firstCards.map((card) => card.id), ['card-a', 'card-b']);
  assert.equal(store.projection().ledger.cards, firstCards);
  assert.equal(store.projectedEntity('card', 'card-b')?.title, 'B');

  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'annotation', entityId: 'zone-a', changes: [{ path: 'title', operation: 'set', value: 'Zone' }] }] });
  assert.equal(store.projection().ledger.cards, firstCards, 'an unrelated collection keeps its cached read array');
  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-b', changes: [{ path: 'title', operation: 'set', value: 'Changed' }] }] });
  const changedCards = store.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.notEqual(changedCards, firstCards);
  assert.equal(changedCards[1].title, 'Changed');
  await store.flush();
});

test('missing format marker requires the offline migration entrypoint', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-format-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  assert.throws(() => createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' }), /offline_migration_required/);
});

test('held publication metadata stays local and activation does not change entity hashes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-held-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', activationTaskId: 'card-a', replication: 'held', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Local' }] }] });
  await store.flush();
  const entity = store.entity('card', 'card-a')!;
  const stateRoot = resolve(root, 'task-state', 'project-a');
  assert.equal(Object.hasOwn(entity, 'replication'), false);
  assert.equal(Object.hasOwn(entity, 'activationTaskId'), false);
  assert.equal(store.activeDelta().entities.length, 0);
  assert.equal(readdirSync(resolve(stateRoot, 'local', 'held')).length, 1);
  const beforeHash = entity.stateHash;
  const activated = await store.activate('card-a');
  assert.equal(activated.entities[0].stateHash, beforeHash);
  await store.flush();
  assert.equal(store.activeDelta().entities.length, 1);
  assert.equal(readdirSync(resolve(stateRoot, 'local', 'held')).length, 0);
});

test('duplicate incoming state creates no journal and no shard rewrite', async (context) => {
  const sourceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-duplicate-source-'));
  const targetRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-duplicate-target-'));
  context.after(() => { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(targetRoot, { recursive: true, force: true }); });
  const source = createTaskCurrentStateStore({ decisionOsRoot: sourceRoot, projectId: 'project-a', initializeLedger: {} });
  const target = createTaskCurrentStateStore({ decisionOsRoot: targetRoot, projectId: 'project-a', initializeLedger: {} });
  const mutation = await source.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Once' }] }] });
  await target.merge(mutation.delta);
  await target.flush();
  const shard = resolve(targetRoot, 'task-state', 'project-a', 'current', 'card', 'card-a.json');
  const beforeBytes = readFileSync(shard, 'utf8');
  const duplicate = await target.merge(mutation.delta);
  assert.equal(duplicate.changed, false);
  assert.equal(target.diagnostics().journalCount, 0);
  await target.flush();
  assert.equal(readFileSync(shard, 'utf8'), beforeBytes);
  await source.flush();
});

test('runtime rejects a v2 format marker without automatic migration', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-v2-reject-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const stateRoot = resolve(root, 'task-state', 'project-a');
  const formatFile = resolve(stateRoot, 'format.json');
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(formatFile, JSON.stringify({ version: 2, projectId: 'project-a', baselineRoot: '' }), { flag: 'wx' });
  assert.throws(() => createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' }), /unsupported_task_current_state_format/);
});

test('concurrent thread notes converge as independent entities', async (context) => {
  const desktopRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-note-desktop-'));
  const mobileRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-note-mobile-'));
  context.after(() => { rmSync(desktopRoot, { recursive: true, force: true }); rmSync(mobileRoot, { recursive: true, force: true }); });
  const initial = { notes: {}, threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' } };
  const desktop = createTaskCurrentStateStore({ decisionOsRoot: desktopRoot, projectId: 'project-a', initializeLedger: initial });
  const mobile = createTaskCurrentStateStore({ decisionOsRoot: mobileRoot, projectId: 'project-a', initializeLedger: initial });
  const left = await desktop.mutate({ replicaId: 'desktop', changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-left', changes: [{ path: 'threadId', operation: 'set', value: 'thread-card-a' }, { path: 'role', operation: 'set', value: 'operator' }] }] });
  const right = await mobile.mutate({ replicaId: 'mobile', changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-right', changes: [{ path: 'threadId', operation: 'set', value: 'thread-card-a' }, { path: 'role', operation: 'set', value: 'agent' }] }] });
  await desktop.merge(right.delta);
  await mobile.merge(left.delta);
  const desktopNotes = (desktop.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'];
  const mobileNotes = (mobile.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'];
  assert.deepEqual(desktopNotes, mobileNotes);
  assert.deepEqual(desktopNotes.map((note) => note.role), ['operator', 'agent']);
  await Promise.all([desktop.flush(), mobile.flush()]);
});

test('concurrent card update and deletion retain an explicit presence conflict', async (context) => {
  const desktopRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-presence-desktop-'));
  const mobileRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-presence-mobile-'));
  context.after(() => { rmSync(desktopRoot, { recursive: true, force: true }); rmSync(mobileRoot, { recursive: true, force: true }); });
  const initial = { cards: [{ id: 'card-a', title: 'Initial', status: 'todo' }], annotations: [], relationships: [] };
  const desktop = createTaskCurrentStateStore({ decisionOsRoot: desktopRoot, projectId: 'project-a', initializeLedger: initial });
  const mobile = createTaskCurrentStateStore({ decisionOsRoot: mobileRoot, projectId: 'project-a', initializeLedger: initial });
  const update = await desktop.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Updated' }] }] });
  const deletion = await mobile.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: '$entity', operation: 'tombstone' }] }] });

  await desktop.merge(deletion.delta);
  await mobile.merge(update.delta);

  assert.equal(desktop.rootHash(), mobile.rootHash());
  assert.equal(desktop.projection().conflicts.some((conflict) => conflict.entityId === 'card-a' && conflict.path === '$entity'), true);
  assert.deepEqual(desktop.projection(), mobile.projection());
});

test('thread-note tombstones retain the deleted-note projection', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-note-delete-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    initializeLedger: { notes: { 'thread-card-a': [{ id: 'note-a', role: 'operator', timestamp: '2026-07-21T00:00:00.000Z', message: 'Remove me.' }] } },
  });
  await store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-a', changes: [{ path: '$entity', operation: 'tombstone' }] }],
  });
  assert.deepEqual((store.projection().ledger.notes as Record<string, unknown[]>)['thread-card-a'], []);
  assert.deepEqual((store.projection().ledger.deletedNoteIds as Record<string, string[]>)['thread-card-a'], ['note-a']);
  await store.flush();
});
