/**
 * WHAT: Integration test for spec aa42ff94: cards have labels show top right.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('cards have labels show top right', async () => {
  await assertFrontendSpec('cards have labels show top right', 'aa42ff94', 'card');
});
