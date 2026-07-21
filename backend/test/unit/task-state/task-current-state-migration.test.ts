/**
 * WHAT: Verifies the explicit offline cutover and rollback boundary.
 * WHY: Runtime startup must accept only the new format while migration preserves the old state outside active storage.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { migrateTaskCurrentState } from '../../../src/business/task-state/helper/task-current-state-migration.js';

test('offline migration installs current shards, immutable content, and a final format marker', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const cardFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  const threadFile = resolve(root, 'threads', 'tasks', 'thread-card-a.md');
  const tasksFile = resolve(root, 'tasks.json');
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  mkdirSync(stateRoot, { recursive: true });
  const retainedObject = Buffer.from('retained v2 object');
  const retainedObjectHash = createHash('sha256').update(retainedObject).digest('hex');
  mkdirSync(resolve(stateRoot, 'objects', retainedObjectHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(stateRoot, 'objects', retainedObjectHash.slice(0, 2), retainedObjectHash), retainedObject);
  writeFileSync(cardFile, '#master-task #task-active\n\nWaiting since: 2026-07-20T10:00:00.000Z\n\nMigrated body\n\n## B. Subtasks\n\n1. [Child](card:child-a)\n');
  writeFileSync(threadFile, '# OPERATOR\n<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-21T00:00:00.000Z"} -->\n\nMigrated note.\n');
  const ledger = {
    cards: [
      { id: 'card-a', title: 'Migrated', labels: ['master-task'], comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } },
      { id: 'child-a', title: 'Child', labels: ['subtask'] },
    ],
    annotations: [], relationships: [{ id: 'relationship-a', from: 'card-a', to: 'child-a', label: 'subtask' }],
    threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' },
    deletedNoteIds: { 'thread-card-a': ['note-a', 'genuinely-deleted'] },
  };
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 2, projectId, ledger, conflicts: [] }));
  writeFileSync(resolve(stateRoot, 'old-event-segment.jsonl'), '{}\n');
  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, tasksLedgerFile: tasksFile });
  context.after(() => rmSync(resolve(root, '..', `${basename(root)}-task-state-rollback`), { recursive: true, force: true }));
  assert.equal(existsSync(resolve(result.backup, 'decision-os', 'task-state', projectId, 'old-event-segment.jsonl')), true);
  assert.equal(existsSync(resolve(result.backup, 'decision-os', 'tasks.json')), true);
  assert.equal(existsSync(resolve(result.root, 'format.json')), true);
  assert.equal(existsSync(resolve(result.root, 'old-event-segment.jsonl')), false);
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const cards = store.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.equal(cards.find((card) => card.id === 'card-a')?.title, 'Migrated');
  assert.equal((cards.find((card) => card.id === 'card-a')?.lifecycle as Record<string, unknown>).waitingAt, '2026-07-20T10:00:00.000Z');
  assert.deepEqual(cards.find((card) => card.id === 'child-a')?.labels, []);
  assert.equal((store.projection().ledger.relationships as Array<Record<string, unknown>>)[0].position, 0);
  const head = store.contentHeads('.decision-os/cards/tasks/card-a.md')[0];
  assert.ok(head.hash);
  const rewrittenBody = readFileSync(resolve(result.root, 'objects', head.hash.slice(0, 2), head.hash), 'utf8');
  assert.match(rewrittenBody, /Migrated body/);
  assert.doesNotMatch(rewrittenBody, /Waiting since:|## B\. Subtasks|#task-active/);
  const note = (store.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0];
  assert.equal(note.message, undefined);
  assert.equal(note.timestamp, '2026-07-21T00:00:00.000Z');
  const threadHead = store.contentHeads('.decision-os/threads/tasks/thread-card-a.md')[0];
  assert.ok(threadHead.hash);
  assert.match(readFileSync(resolve(result.root, 'objects', threadHead.hash.slice(0, 2), threadHead.hash), 'utf8'), /Migrated note\./);
  const report = JSON.parse(readFileSync(result.report, 'utf8')) as Record<string, any>;
  assert.equal(report.semanticInventory.cards, 2);
  assert.equal(report.semanticInventory.notes, 1);
  assert.equal(report.semanticInventory.deletions, 1);
  assert.equal(report.semanticInventory.entityDeletions, 1);
  assert.equal(report.semanticInventory.resourceHeads, 2);
  assert.deepEqual(report.objectInventory, { sourceObjects: 1, installedObjects: 1, installedBytes: retainedObject.byteLength });
  assert.equal(readFileSync(resolve(result.root, 'objects', retainedObjectHash.slice(0, 2), retainedObjectHash), 'utf8'), retainedObject.toString());
  assert.deepEqual(report.recoveredNoteDeletions, [{ threadId: 'thread-card-a', noteId: 'note-a' }]);
  assert.equal(report.sourceValueAudit.find((entry: Record<string, unknown>) => entry.cardId === 'card-a').waitingAtSource, 'card-markdown');
  assert.match(report.canonicalProjectionChecksum, /^[a-f0-9]{64}$/);
});

test('migration preflight rejects broken subtask ownership before writing or backing up files', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-preflight-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(rollbackRoot, { recursive: true, force: true });
  });
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const ledger = {
    cards: [{ id: 'master-a', title: 'Master', labels: ['master-task'] }],
    annotations: [],
    relationships: [{ id: 'broken', from: 'master-a', to: 'missing-child', label: 'subtask' }],
  };
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 2, projectId, ledger, conflicts: [] }));
  const beforeLedger = readFileSync(tasksFile, 'utf8');
  const beforeProjection = readFileSync(resolve(stateRoot, 'projection.json'), 'utf8');

  await assert.rejects(migrateTaskCurrentState({ decisionOsRoot: root, projectId, tasksLedgerFile: tasksFile, backupRoot: rollbackRoot }), /invalid_subtask_relationships:broken/);

  assert.equal(readFileSync(tasksFile, 'utf8'), beforeLedger);
  assert.equal(readFileSync(resolve(stateRoot, 'projection.json'), 'utf8'), beforeProjection);
  assert.equal(existsSync(rollbackRoot), false);
});

test('migration refuses to publish epoch 3 when a retained resource head has no collected object', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-missing-object-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(rollbackRoot, { recursive: true, force: true });
  });
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const missingHash = createHash('sha256').update('missing').digest('hex');
  mkdirSync(resolve(stateRoot, 'current', 'resource'), { recursive: true });
  writeFileSync(resolve(stateRoot, 'format.json'), JSON.stringify({ version: 2, projectId, baselineRoot: 'legacy' }));
  writeFileSync(resolve(stateRoot, 'current', 'resource', 'missing.json'), JSON.stringify({
    version: 2, projectId, entityType: 'resource', entityId: '.decision-os/files/missing.bin', replication: 'active', stateHash: 'legacy',
    fields: { head: { clock: { desktop: 1 }, candidates: [{ dot: { replicaId: 'desktop', counter: 1 }, operation: 'set', value: { type: 'managed-asset', key: '.decision-os/files/missing.bin', hash: missingHash, bytes: 7, changedAt: '2026-07-21T00:00:00.000Z' } }] } },
  }));
  writeFileSync(tasksFile, JSON.stringify({ cards: [], annotations: [], relationships: [] }));

  await assert.rejects(migrateTaskCurrentState({ decisionOsRoot: root, projectId, tasksLedgerFile: tasksFile, backupRoot: rollbackRoot }), /missing_migrated_task_content_object/);

  assert.equal(existsSync(resolve(stateRoot, 'format.json')), false);
  assert.equal(existsSync(rollbackRoot), true);
});

test('migration joins legacy current entities from every writable node before encoding epoch 3', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-union-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-remote-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, remoteRoot, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const activeRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const entity = (replicaId: string, fields: Record<string, unknown>, entityType = 'card', entityId = 'card-a') => ({
    version: 2,
    projectId,
    entityType,
    entityId,
    fields: Object.fromEntries(Object.entries(fields).map(([path, value]) => [path, { clock: { [replicaId]: 1 }, candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set', value }] }])),
    replication: 'active',
    stateHash: 'legacy',
  });
  mkdirSync(resolve(activeRoot, 'current', 'card'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'card'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'ledger'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'resource'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'thread-note'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  writeFileSync(resolve(activeRoot, 'format.json'), JSON.stringify({ version: 2, projectId, baselineRoot: 'legacy-a' }));
  writeFileSync(resolve(activeRoot, 'current', 'card', 'card-a.json'), JSON.stringify(entity('desktop', { title: 'Joined title', labels: ['master-task'] })));
  writeFileSync(resolve(remoteRoot, 'current', 'card', 'card-a.json'), JSON.stringify(entity('mobile', { status: 'done' })));
  writeFileSync(resolve(remoteRoot, 'current', 'card', 'deleted-card.json'), JSON.stringify({
    version: 2, projectId, entityType: 'card', entityId: 'deleted-card',
    fields: { $entity: { clock: { mobile: 1 }, candidates: [{ dot: { replicaId: 'mobile', counter: 1 }, operation: 'tombstone' }] } }, replication: 'active', stateHash: 'legacy',
  }));
  const remoteObject = Buffer.from('remote-only immutable object');
  const remoteHash = createHash('sha256').update(remoteObject).digest('hex');
  const remoteKey = '.decision-os/files/remote-only.bin';
  mkdirSync(resolve(remoteRoot, 'objects', remoteHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(remoteRoot, 'objects', remoteHash.slice(0, 2), remoteHash), remoteObject);
  writeFileSync(resolve(remoteRoot, 'current', 'resource', 'remote-only.json'), JSON.stringify(entity('mobile', {
    head: { type: 'managed-asset', key: remoteKey, hash: remoteHash, bytes: remoteObject.byteLength, changedAt: '2026-07-21T00:00:00.000Z' },
  }, 'resource', remoteKey)));
  const threadId = 'thread-card-a';
  const noteId = 'note-recovered';
  writeFileSync(resolve(root, 'threads', 'tasks', `${threadId}.md`), `# OPERATOR\n<!-- decision-os:note {"id":"${noteId}","timestamp":"2026-07-21T01:00:00.000Z"} -->\n\nRecovered from sidecar.\n`);
  writeFileSync(resolve(remoteRoot, 'current', 'ledger', 'thread-file.json'), JSON.stringify(entity('mobile', {
    [`threadFiles/${threadId}`]: `.decision-os/threads/tasks/${threadId}.md`,
  }, 'ledger', `tasks:threadFiles/${threadId}`)));
  writeFileSync(resolve(remoteRoot, 'current', 'thread-note', `${encodeURIComponent(`${threadId}/${noteId}`)}.json`), JSON.stringify({
    version: 2, projectId, entityType: 'thread-note', entityId: `${threadId}/${noteId}`,
    fields: { $entity: { clock: { workstation: 17 }, candidates: [{ dot: { replicaId: 'workstation', counter: 17 }, operation: 'tombstone' }] } }, replication: 'active', stateHash: 'legacy',
  }));
  writeFileSync(tasksFile, JSON.stringify({
    cards: [{ id: 'card-a', title: 'Stale ledger', status: 'backlog' }], annotations: [], relationships: [],
    threadFiles: { [threadId]: `.decision-os/threads/tasks/${threadId}.md` },
  }));

  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, tasksLedgerFile: tasksFile, backupRoot: rollbackRoot, sourceStateRoots: [remoteRoot] });
  const report = JSON.parse(readFileSync(result.report, 'utf8')) as Record<string, any>;

  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const card = (store.projection().ledger.cards as Array<Record<string, any>>)[0];
  assert.equal(card.title, 'Joined title');
  assert.equal(card.lifecycle.status, 'done');
  assert.equal(existsSync(resolve(result.backup, 'source-state-roots', '1', 'current', 'card', 'card-a.json')), true);
  assert.equal(store.entity('card', 'deleted-card')?.fields.$entity.candidates[0].operation, 'tombstone');
  assert.equal(store.entity('card', 'deleted-card')?.fields.$entity.clock.mobile, 1);
  assert.equal(store.contentHeads(remoteKey)[0].hash, remoteHash);
  assert.equal(readFileSync(resolve(result.root, 'objects', remoteHash.slice(0, 2), remoteHash), 'utf8'), remoteObject.toString());
  const recoveredPresence = store.entity('thread-note', `${threadId}/${noteId}`)?.fields.$entity;
  assert.equal(recoveredPresence?.clock.workstation, 17);
  assert.equal(recoveredPresence?.candidates[0].operation, 'set');
  assert.deepEqual((store.projection().ledger.deletedNoteIds as Record<string, string[]>)[threadId], []);
  assert.equal(report.sourceEntityInventory.resource, 1);
  assert.equal(report.sourceEntityInventory.card, 2);
  assert.equal(report.currentEntityInventory.resource, 2);
  assert.equal(report.semanticInventory.entityDeletions, 1);
});
