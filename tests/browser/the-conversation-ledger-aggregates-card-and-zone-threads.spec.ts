/**
 * WHAT: Integration test for spec 667ae9a9: The conversation ledger aggregates card and zone threads..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('The conversation ledger aggregates card and zone threads.', async () => {
  await assertFrontendSpec('The conversation ledger aggregates card and zone threads.', '667ae9a9', 'zone');
});
