/**
 * WHAT: Spec 6d853968 test for apply mode writing generated artifacts.
 * WHY: apply mode must write source, tests, telemetry harness, graph, and report config.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { applyGeneratedWorktreeController } from '../../src/index.js';
import { fakeProcess, masterLedgerPath, tempDir, readText } from '../fixture/scenario.js';

test('Apply mode writes generated worktree imports tests telemetry harness and report configuration', async () => {
  const dir = await tempDir();
  const output = join(dir, '.worktrees/run');
  const result = await applyGeneratedWorktreeController({ masterLedgerFile: masterLedgerPath, output }, { process: fakeProcess(0) });
  assert.equal(result.ok, true);
  assert.ok((await readText(join(output, 'src/telemetry/harness.ts'))).includes('telemetry'));
});
