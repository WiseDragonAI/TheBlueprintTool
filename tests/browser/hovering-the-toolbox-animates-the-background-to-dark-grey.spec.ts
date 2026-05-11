/**
 * WHAT: Integration test for spec 3159faad: Hovering the toolbox animates the background to dark grey..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Hovering the toolbox animates the background to dark grey.', async () => {
  await assertFrontendSpec('Hovering the toolbox animates the background to dark grey.', '3159faad', 'toolbox');
});
