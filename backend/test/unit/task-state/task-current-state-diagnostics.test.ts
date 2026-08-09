/**
 * WHAT: Proves current-state diagnostics ignore atomic persistence artifacts.
 * WHY: A status read must remain available while canonical shards are being replaced.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { taskCurrentStateDiagnostics } from '../../../src/business/task-state/helper/task-current-state-diagnostics.js';

test('diagnostics excludes atomic temporary shards and reports settled canonical bytes', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-state-diagnostics-'));
  const directory = resolve(root, 'current', 'card');
  const journalDirectory = resolve(root, 'journal');
  mkdirSync(directory, { recursive: true });
  mkdirSync(journalDirectory, { recursive: true });
  const canonical = resolve(directory, 'card-a.json');
  const temporary = resolve(directory, 'card-b.json.tmp-test');
  writeFileSync(canonical, 'canonical');
  writeFileSync(temporary, 'temporary bytes must not count');

  try {
    assert.deepEqual(taskCurrentStateDiagnostics({ root, journalDirectory, entityCount: 1 }), {
      entityCount: 1,
      journalCount: 0,
      currentBytes: Buffer.byteLength('canonical'),
    });
    renameSync(temporary, resolve(directory, 'card-b.json'));
    assert.equal(
      taskCurrentStateDiagnostics({ root, journalDirectory, entityCount: 2 }).currentBytes,
      Buffer.byteLength('canonicaltemporary bytes must not count'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
