/**
 * WHAT: Integration test for spec 30000001: Ctrl-click can select multiple zones and cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Ctrl-click can select multiple zones and cards', async () => {
  await assertFrontendSpec('Ctrl-click can select multiple zones and cards', '30000001', 'selection');
});
