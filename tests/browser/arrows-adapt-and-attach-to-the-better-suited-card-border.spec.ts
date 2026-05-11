/**
 * WHAT: Integration test for spec 5027f419: Arrows adapt and attach to the better suited card border.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Arrows adapt and attach to the better suited card border', async () => {
  await assertFrontendSpec('Arrows adapt and attach to the better suited card border', '5027f419', 'relationship');
});
