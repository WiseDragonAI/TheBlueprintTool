/**
 * WHAT: Integration test for spec dff19657: Click precedence is currently: card -> regular zone -> group background.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Click precedence is currently: card -> regular zone -> group background', async () => {
  await assertFrontendSpec('Click precedence is currently: card -> regular zone -> group background', 'dff19657', 'group');
});
