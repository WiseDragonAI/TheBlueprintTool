/**
 * WHAT: Spec efaafd16 test for dry-run mode.
 * WHY: dry-run must print planned files without writing the worktree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { planGeneratedWorktreeController } from '../../src/index.js';
import { masterLedgerPath, tempDir } from '../fixture/scenario.js';

test('Dry-run mode prints planned files imports graph and output without writing worktree', async () => {
  const messages: string[] = [];
  const output = join(await tempDir(), '.worktrees/dry');
  const result = await planGeneratedWorktreeController({ mode: 'dry-run', masterLedgerFile: masterLedgerPath, output, emit: (message) => messages.push(message) });
  assert.equal(result.ok, true);
  assert.equal(existsSync(output), false);
  assert.ok(messages[0].includes('dependency-graph.json'));
});
