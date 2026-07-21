/**
 * WHAT: Verifies the explicit offline cutover and rollback boundary.
 * WHY: Runtime startup must accept only the new format while migration preserves the old state outside active storage.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
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
  writeFileSync(cardFile, 'Migrated body');
  writeFileSync(threadFile, '# OPERATOR\n<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-21T00:00:00.000Z"} -->\n\nMigrated note.\n');
  const ledger = { cards: [{ id: 'card-a', title: 'Migrated', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }], annotations: [], relationships: [], threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' } };
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 2, projectId, ledger, conflicts: [] }));
  writeFileSync(resolve(stateRoot, 'old-event-segment.jsonl'), '{}\n');
  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, tasksLedgerFile: tasksFile });
  assert.equal(existsSync(resolve(result.backup, 'old-event-segment.jsonl')), true);
  assert.equal(existsSync(resolve(result.root, 'format.json')), true);
  assert.equal(existsSync(resolve(result.root, 'old-event-segment.jsonl')), false);
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  assert.equal((store.projection().ledger.cards as Array<Record<string, unknown>>)[0].title, 'Migrated');
  const head = store.contentHeads('.decision-os/cards/tasks/card-a.md')[0];
  assert.ok(head.hash);
  assert.equal(readFileSync(resolve(result.root, 'objects', head.hash.slice(0, 2), head.hash), 'utf8'), 'Migrated body');
  assert.equal((store.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0].message, 'Migrated note.');
  assert.equal(store.contentHeads('.decision-os/threads/tasks/thread-card-a.md').length, 0);
});
