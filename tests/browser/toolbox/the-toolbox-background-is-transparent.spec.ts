/**
 * WHAT: Integration test for spec 93f778a8: The toolbox background is transparent..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('The toolbox background is transparent.', async () => {
  await assertFrontendSpec('The toolbox background is transparent.', '93f778a8', 'toolbox');
});
