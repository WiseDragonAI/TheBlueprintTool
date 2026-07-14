import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureDecisionOsMemoryStore } from '@backend/business/server/helper/ensure-decision-os-memory-store.js';

test('ensureDecisionOsMemoryStore creates one healthy database in the master scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-memory-server-'));
  const decisionOsRoot = join(root, '.decision-os');
  try {
    const databasePath = ensureDecisionOsMemoryStore(decisionOsRoot);
    assert.equal(databasePath, join(decisionOsRoot, 'memories.sqlite3'));
    assert.equal(existsSync(databasePath), true);
    assert.equal(ensureDecisionOsMemoryStore(decisionOsRoot), databasePath);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    assert.equal(database.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.deepEqual(database.prepare('PRAGMA table_info(memories)').all().map((row) => row.name), [
      'id', 'title', 'body', 'tag', 'subtag', 'project_id', 'type', 'source', 'created_at', 'updated_at'
    ]);
    database.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
