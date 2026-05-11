/**
 * WHAT: Integration test for spec cfed85d3: Refresh Button.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Refresh Button', async () => {
  await assertFrontendSpec('Refresh Button', 'cfed85d3', 'toolbox');
});
