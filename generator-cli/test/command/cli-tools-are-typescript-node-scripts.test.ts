/**
 * WHAT: Spec c8f02619 test for TypeScript Node CLI scripts.
 * WHY: the executable command must be backed by TypeScript source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgv } from '../../src/index.js';

test('CLI tools are executable TypeScript Node scripts under generator-cli', () => {
  const command = parseCliArgv(['dry-run', '--master-ledger', 'ledger.md', '--output', '.worktrees/x']);
  assert.equal(command.mode, 'dry-run');
  assert.equal(command.masterLedgerFile, 'ledger.md');
});
