/**
 * WHAT: Integration test for spec ee77191d: Node test runner for unit and browser-runtime tests.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Node test runner for unit and browser-runtime tests', async () => {
  await assertFrontendSpec('Node test runner for unit and browser-runtime tests', 'ee77191d', 'canvas');
});
