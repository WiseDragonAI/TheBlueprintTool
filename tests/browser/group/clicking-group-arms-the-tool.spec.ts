/**
 * WHAT: Integration test for spec 90d84349: Clicking Group arms the tool.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Clicking Group arms the tool', async () => {
  await assertFrontendSpec('Clicking Group arms the tool', '90d84349', 'group');
});
