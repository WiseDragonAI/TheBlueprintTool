/**
 * WHAT: Verifies the explicit offline cutover and rollback boundary.
 * WHY: Runtime startup must accept only the new format while migration preserves the old state outside active storage.
 */
import assert from 'node:assert/strict';
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
  assert.equal(report.semanticInventory.resourceHeads, 2);
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

test('migration joins legacy current entities from every writable node before encoding epoch 3', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-union-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-remote-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, remoteRoot, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const activeRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const entity = (replicaId: string, fields: Record<string, unknown>) => ({
    version: 2,
    projectId,
    entityType: 'card',
    entityId: 'card-a',
    fields: Object.fromEntries(Object.entries(fields).map(([path, value]) => [path, { clock: { [replicaId]: 1 }, candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set', value }] }])),
    replication: 'active',
    stateHash: 'legacy',
  });
  mkdirSync(resolve(activeRoot, 'current', 'card'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'card'), { recursive: true });
  writeFileSync(resolve(activeRoot, 'format.json'), JSON.stringify({ version: 2, projectId, baselineRoot: 'legacy-a' }));
  writeFileSync(resolve(activeRoot, 'current', 'card', 'card-a.json'), JSON.stringify(entity('desktop', { title: 'Joined title', labels: ['master-task'] })));
  writeFileSync(resolve(remoteRoot, 'current', 'card', 'card-a.json'), JSON.stringify(entity('mobile', { status: 'done' })));
  writeFileSync(tasksFile, JSON.stringify({ cards: [{ id: 'card-a', title: 'Stale ledger', status: 'backlog' }], annotations: [], relationships: [] }));

  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, tasksLedgerFile: tasksFile, backupRoot: rollbackRoot, sourceStateRoots: [remoteRoot] });

  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const card = (store.projection().ledger.cards as Array<Record<string, any>>)[0];
  assert.equal(card.title, 'Joined title');
  assert.equal(card.lifecycle.status, 'done');
  assert.equal(existsSync(resolve(result.backup, 'source-state-roots', '1', 'current', 'card', 'card-a.json')), true);
});
