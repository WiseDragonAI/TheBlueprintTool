/**
 * WHAT: Integration test for spec f93e1bb7: SVG relationship arrow rendering.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('SVG relationship arrow rendering', async () => {
  await assertFrontendSpec('SVG relationship arrow rendering', 'f93e1bb7', 'relationship');
});
