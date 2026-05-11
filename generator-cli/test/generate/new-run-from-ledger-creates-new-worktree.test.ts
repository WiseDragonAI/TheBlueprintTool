/**
 * WHAT: Spec 7fb12b4c test for fresh worktree generation.
 * WHY: each run must create a new generated worktree from scratch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { applyGeneratedWorktreeController } from '../../src/index.js';
import { fakeProcess, masterLedgerPath, specsLedgerPath, tempDir } from '../fixture/scenario.js';

test('New run from ledger creates a fresh git worktree from scratch', async () => {
  const output = join(await tempDir(), '.worktrees/fresh');
  const result = await applyGeneratedWorktreeController({ masterLedgerFile: masterLedgerPath, specsLedgerFile: specsLedgerPath, output }, { process: fakeProcess(0) });
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.value.sourceFiles.length > 0);
});
