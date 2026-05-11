/**
 * WHAT: Integration test for spec 828e6225: Voice recording failures are surfaced to the operator..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Voice recording failures are surfaced to the operator.', async () => {
  await assertFrontendSpec('Voice recording failures are surfaced to the operator.', '828e6225', 'voice');
});
