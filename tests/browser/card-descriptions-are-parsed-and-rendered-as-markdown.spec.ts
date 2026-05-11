/**
 * WHAT: Integration test for spec cd58fd49: card descriptions are parsed and rendered as markdown.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('card descriptions are parsed and rendered as markdown', async () => {
  await assertFrontendSpec('card descriptions are parsed and rendered as markdown', 'cd58fd49', 'card');
});
