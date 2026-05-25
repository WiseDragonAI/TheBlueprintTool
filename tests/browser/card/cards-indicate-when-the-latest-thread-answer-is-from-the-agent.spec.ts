/**
 * WHAT: Integration test for spec c4e8b91a: Cards indicate when the latest thread answer is from the agent.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Cards indicate when the latest thread answer is from the agent.', async () => {
  await assertFrontendSpec('Cards indicate when the latest thread answer is from the agent.', 'c4e8b91a', 'card');
});
