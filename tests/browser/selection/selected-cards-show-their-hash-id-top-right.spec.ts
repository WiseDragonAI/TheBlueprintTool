/**
 * WHAT: Integration test for spec 4dfbf38c: selected cards show their hash id top right.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('selected cards show their hash id top right', async () => {
  await assertFrontendSpec('selected cards show their hash id top right', '4dfbf38c', 'selection');
});
