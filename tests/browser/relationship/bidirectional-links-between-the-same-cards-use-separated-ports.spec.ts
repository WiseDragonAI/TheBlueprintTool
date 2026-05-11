/**
 * WHAT: Integration test for spec 6f01b700: Bidirectional links between the same cards use separated ports.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Bidirectional links between the same cards use separated ports', async () => {
  await assertFrontendSpec('Bidirectional links between the same cards use separated ports', '6f01b700', 'relationship');
});
