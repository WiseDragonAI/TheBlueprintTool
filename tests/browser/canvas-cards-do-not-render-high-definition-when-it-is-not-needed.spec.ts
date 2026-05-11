/**
 * WHAT: Integration test for spec 30000009: canvas cards do not render high definition when it is not needed.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('canvas cards do not render high definition when it is not needed', async () => {
  await assertFrontendSpec('canvas cards do not render high definition when it is not needed', '30000009', 'card');
});
