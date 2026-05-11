/**
 * WHAT: Integration test for spec 9f9279ff: Selecting the zone tool opens the color picker..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Selecting the zone tool opens the color picker.', async () => {
  await assertFrontendSpec('Selecting the zone tool opens the color picker.', '9f9279ff', 'selection');
});
