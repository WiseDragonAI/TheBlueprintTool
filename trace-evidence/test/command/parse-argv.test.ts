/**
 * WHAT: Verifies repeated selectors and direct child argv parsing.
 * WHY: Batch scope and shell-free test admission depend on exact argument boundaries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgv, values } from '../../src/business/command/helper/parse-argv.js';

test('preserves repeated selectors and child argv', () => {
  const action = parseArgv(['start-tests', '--test-file', 'a.test.ts', '--test-file', 'b.test.ts', '--', 'node', '--test', 'a.test.ts', 'b.test.ts']);
  assert.deepEqual(values(action, 'test-file'), ['a.test.ts', 'b.test.ts']);
  assert.deepEqual(action.childCommand, ['node', '--test', 'a.test.ts', 'b.test.ts']);
});
