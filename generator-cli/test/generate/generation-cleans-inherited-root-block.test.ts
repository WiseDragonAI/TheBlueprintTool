/**
 * WHAT: Spec de19f4a6 test for cleaning inherited worktree content.
 * WHY: a generated root block must not inherit implementation files from the git worktree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { applyGeneratedWorktreeController, nodeFileSystem } from '../../src/index.js';
import { masterLedgerPath, specsLedgerPath, fakeProcess, tempDir } from '../fixture/scenario.js';
import type { FileSystemPort } from '../../src/index.js';

test('apply mode removes the inherited root block before writing scaffold files', async () => {
  const output = await tempDir('generator-clean-');
  const removed: string[] = [];
  const fs: FileSystemPort = {
    ...nodeFileSystem,
    async rm(path: string) {
      removed.push(path);
      await nodeFileSystem.rm(path);
    },
  };
  const result = await applyGeneratedWorktreeController(
    { masterLedgerFile: masterLedgerPath, specsLedgerFile: specsLedgerPath, output },
    { fs, process: fakeProcess(0), cwd: process.cwd() },
  );

  assert.equal(result.ok, true);
  assert.equal(removed.includes(join(output, 'generator-cli')), true);
});
