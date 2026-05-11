/**
 * WHAT: Integration test for spec 53dc0295: Multiple arrows sharing the same card side use deterministic spread ports instead of stacking.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Multiple arrows sharing the same card side use deterministic spread ports instead of stacking', async () => {
  await assertFrontendSpec('Multiple arrows sharing the same card side use deterministic spread ports instead of stacking', '53dc0295', 'relationship');
});
