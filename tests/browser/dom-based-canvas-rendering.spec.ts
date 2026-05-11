/**
 * WHAT: Integration test for spec a9ef20a7: DOM-based canvas rendering.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('DOM-based canvas rendering', async () => {
  await assertFrontendSpec('DOM-based canvas rendering', 'a9ef20a7', 'canvas');
});
