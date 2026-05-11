/**
 * WHAT: Integration test for spec 20000008: zones can contain cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones can contain cards', async () => {
  await assertFrontendSpec('zones can contain cards', '20000008', 'zone');
});
