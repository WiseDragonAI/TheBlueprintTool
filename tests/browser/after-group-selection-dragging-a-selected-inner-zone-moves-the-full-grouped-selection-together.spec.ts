/**
 * WHAT: Integration test for spec 5b918cd3: After group selection, dragging a selected inner zone moves the full grouped selection together.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('After group selection, dragging a selected inner zone moves the full grouped selection together', async () => {
  await assertFrontendSpec('After group selection, dragging a selected inner zone moves the full grouped selection together', '5b918cd3', 'group');
});
