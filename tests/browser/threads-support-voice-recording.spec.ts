/**
 * WHAT: Integration test for spec d38927c1: Threads support voice recording..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Threads support voice recording.', async () => {
  await assertFrontendSpec('Threads support voice recording.', 'd38927c1', 'voice');
});
