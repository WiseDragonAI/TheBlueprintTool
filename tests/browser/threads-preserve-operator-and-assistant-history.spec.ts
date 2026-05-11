/**
 * WHAT: Integration test for spec 5f8c7152: Threads preserve operator and assistant history..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Threads preserve operator and assistant history.', async () => {
  await assertFrontendSpec('Threads preserve operator and assistant history.', '5f8c7152', 'thread');
});
