/**
 * WHAT: Integration test for spec 747b461e: Voice recording is thread-scoped..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice recording is thread-scoped.', async () => {
  await assertFrontendSpec('Voice recording is thread-scoped.', '747b461e', 'voice');
});
