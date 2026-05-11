/**
 * WHAT: Integration test for spec eaced0c9: Threads are a primary model..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Threads are a primary model.', async () => {
  await assertFrontendSpec('Threads are a primary model.', 'eaced0c9', 'thread');
});
